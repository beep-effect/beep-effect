/**
 * Governed tier gate: the enforcement boundary between the MCP agent surface
 * and the execution ledger.
 *
 * Implements `@beep/mcp-kit`'s `TierGateShape` from the epistemic slice —
 * foundation-mediated port inversion: `ontology/server` keeps consuming
 * `TierGate`, this module implements it, and neither slice names the other.
 * The binding happens at the app composition root.
 *
 * Three properties are load-bearing here:
 *
 * - **Write-ahead, fail-closed.** Every evaluation seals an
 *   `ExecutionDecisionRecord` and appends it to the ledger *before* the
 *   verdict is returned, so an approved effect can only run after its
 *   decision row exists. A failed decision write refuses the dispatch —
 *   no record, no action — with the bounded `ledger-unavailable` reason.
 * - **Session-frozen authority.** A run is one MCP session, keyed by the
 *   transport-assigned `clientId` read from `CurrentMcpCaller`. The grant set
 *   is built from session-static inputs only (composition-root options plus
 *   `EpistemicConfig`) and frozen on the session's first dispatch; nothing an
 *   agent reads mid-session can widen it.
 * - **Refusal is a value.** Both gate methods are total. The bounded denial
 *   reason goes to the ledger and the server log; the audit record carries a
 *   constant guidance string per reason, never interpolated with request
 *   data, and the agent-facing refusal is reason-free.
 *
 * Run eviction is expiry-based rather than lifecycle-hooked: `clientId`
 * arrives value-only through `CurrentMcpCaller`, so the gate has no seam onto
 * the client's scope. A run whose grants have all expired can only deny, so
 * sweeping it on the next run creation is behavior-preserving.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { EpistemicConfig } from "@beep/epistemic-config/server";
import { ExecutionGrant, GrantBudget, GrantOperation } from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  destinationDigestOf,
  digestForLedger,
  ExecutionRunKey,
  operationDigestOf,
  sealExecutionDecision,
  sealExecutionOutcome,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import { denialGuidance, ExecutionRequest, ExecutionVerdict } from "@beep/epistemic-domain/values/ExecutionVerdict";
import { DraftGrantSet, evaluateExecutionRequest, freezeGrantSet } from "@beep/epistemic-domain/values/GrantSet";
import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import { CurrentMcpCaller, TierGate, TierGateAuditRecord, TierGateVerdict } from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import { A, O } from "@beep/utils";
import { Context, DateTime, Duration, Effect, HashMap, Ref, Semaphore } from "effect";
import * as AiTool from "effect/unstable/ai/Tool";
import type { ExecutionSink, GrantPurpose, GrantResource } from "@beep/epistemic-domain/values/ExecutionGrant";
import type { DecisionRecordHash, ExecutionDecisionRecord } from "@beep/epistemic-domain/values/ExecutionRecord";
import type { FrozenGrantSet } from "@beep/epistemic-domain/values/GrantSet";
import type { TierGateSettlement, ToolCallRequest } from "@beep/mcp-kit";

/**
 * Session-static inputs the composition root supplies to the governed gate.
 *
 * The gate cannot name the tools it governs — that would be a slice-to-slice
 * import — so the granted operations, the sink they all target, and the grant
 * metadata arrive as data from the app entrypoint that already imports both
 * sides. The sink carries its audience by construction: every operation the
 * gate governs in one branch targets the same sink, and for an `mcp-write`
 * workspace sink the boundary owns the classification (the URL-parsing
 * network resolver would misclassify a non-network destination).
 *
 * @example
 * ```ts
 * import type { GovernedTierGateOptions } from "@beep/epistemic-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration } from "effect"
 *
 * const options: GovernedTierGateOptions = {
 *   grantTtl: Duration.hours(12),
 *   operations: [GrantOperation.make("ontology_propose_change_batch")],
 *   purpose: GrantPurpose.make("ontology-workspace-mutation"),
 *   resource: GrantResource.make("ontology-workspace"),
 *   sink: ExecutionSink.make({
 *     audience: "local-workspace",
 *     destination: SinkDestination.make("workspace://ontology"),
 *     sinkClass: "mcp-write"
 *   })
 * }
 * console.log(options.operations.length)
 * // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface GovernedTierGateOptions {
  /** Lifetime of a session's frozen grants, measured from the freeze. */
  readonly grantTtl: Duration.Duration;
  /** Tool operations granted against the sink; exact match, no wildcard. */
  readonly operations: ReadonlyArray<GrantOperation>;
  /** Purpose recorded on every session grant. */
  readonly purpose: GrantPurpose;
  /** Resource selector recorded on every session grant. */
  readonly resource: GrantResource;
  /** Governed sink every gated dispatch in this branch targets. */
  readonly sink: ExecutionSink;
}

interface RunState {
  readonly expiresAtMillis: number;
  readonly frozen: FrozenGrantSet;
  readonly lastHash: O.Option<DecisionRecordHash>;
  readonly nextSeq: number;
  readonly pendingOutcomes: HashMap.HashMap<string, ReadonlyArray<DecisionRecordHash>>;
  readonly runKey: ExecutionRunKey;
}

const approvedGuidance = "Approved by a grant in the session's frozen grant set.";

const grantPrincipal = SystemPrincipal.make({ component: "Runtime", kind: "System" });

const destructiveOf = (tool: AiTool.Any): boolean =>
  Context.getOrElse(tool.annotations, AiTool.Destructive, () => true);

const pendingFor = (state: RunState, operationDigest: string): ReadonlyArray<DecisionRecordHash> =>
  O.getOrElse(HashMap.get(state.pendingOutcomes, operationDigest), A.empty<DecisionRecordHash>);

/**
 * Build the governed tier gate service.
 *
 * Reads `EpistemicConfig` and `ExecutionLedger` once at construction, so both
 * gate methods stay total (`R = never`) as `TierGateShape` requires; the only
 * per-request context is the `CurrentMcpCaller` reference the sanitized
 * toolkit populates on each dispatch.
 *
 * @example
 * ```ts
 * import { makeGovernedTierGate } from "@beep/epistemic-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration, Effect } from "effect"
 *
 * const gate = makeGovernedTierGate({
 *   grantTtl: Duration.hours(12),
 *   operations: [GrantOperation.make("ontology_propose_change_batch")],
 *   purpose: GrantPurpose.make("ontology-workspace-mutation"),
 *   resource: GrantResource.make("ontology-workspace"),
 *   sink: ExecutionSink.make({
 *     audience: "local-workspace",
 *     destination: SinkDestination.make("workspace://ontology"),
 *     sinkClass: "mcp-write"
 *   })
 * })
 * console.log(Effect.isEffect(gate))
 * // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGovernedTierGate = Effect.fn("Epistemic.GovernedTierGate.make")(function* (
  options: GovernedTierGateOptions
) {
  const config = yield* EpistemicConfig;
  const ledger = yield* ExecutionLedger;
  const runs = yield* Ref.make(HashMap.empty<number, RunState>());
  // One lock serializes run creation and ledger appends so chain sequencing
  // stays dense per run. Global rather than per-run: the desktop surface has
  // one interactive caller, and a coarser critical section cannot deadlock —
  // the wrapped effect always runs outside it.
  const lock = yield* Semaphore.make(1);

  const freezeRunFor = (clientId: number, now: DateTime.Utc): RunState => {
    const expiresAt = DateTime.add(now, { milliseconds: Duration.toMillis(options.grantTtl) });
    const grants = A.map(options.operations, (operation) =>
      ExecutionGrant.make({
        budget: GrantBudget.make({}),
        expiresAt,
        operation,
        policyRevision: config.policyRevision,
        principal: grantPrincipal,
        purpose: options.purpose,
        resource: options.resource,
        sink: options.sink,
      })
    );
    const frozen = freezeGrantSet(DraftGrantSet.make({ grants, policyRevision: config.policyRevision }), now);
    // Deterministic per (clientId, freeze instant): a session freezes at most
    // one run, and a successor run for the same client can only exist after
    // expiry sweeping, so the pair cannot recur. A collision would surface as
    // a chain primary-key violation, which refuses fail-closed rather than
    // corrupting the chain.
    const runKey = ExecutionRunKey.make(digestForLedger(`epistemic-run/${clientId}/${DateTime.toEpochMillis(now)}`));
    return {
      expiresAtMillis: DateTime.toEpochMillis(expiresAt),
      frozen,
      lastHash: O.none(),
      nextSeq: 0,
      pendingOutcomes: HashMap.empty(),
      runKey,
    };
  };

  const resolveRun = (clientId: number, now: DateTime.Utc): Effect.Effect<RunState> =>
    Ref.modify(runs, (map) =>
      O.match(HashMap.get(map, clientId), {
        onNone: () => {
          const created = freezeRunFor(clientId, now);
          // A run past its grants' expiry can only deny, so sweeping it here
          // is behavior-preserving; see the module doc for why eviction is
          // expiry-based rather than lifecycle-hooked.
          const nowMillis = DateTime.toEpochMillis(now);
          const swept = HashMap.filter(map, (state) => state.expiresAtMillis > nowMillis);
          return [created, HashMap.set(swept, clientId, created)] as const;
        },
        onSome: (state) => [state, map] as const,
      })
    );

  const commitDecision = (clientId: number, record: ExecutionDecisionRecord): Effect.Effect<void> =>
    Ref.update(runs, (map) =>
      O.match(HashMap.get(map, clientId), {
        onNone: () => map,
        onSome: (state) =>
          HashMap.set(map, clientId, {
            ...state,
            lastHash: O.some(record.hash),
            nextSeq: state.nextSeq + 1,
            pendingOutcomes:
              record.verdict === "allowed"
                ? HashMap.set(
                    state.pendingOutcomes,
                    record.operationDigest,
                    A.append(pendingFor(state, record.operationDigest), record.hash)
                  )
                : state.pendingOutcomes,
          }),
      })
    );

  const auditFor = (
    request: ToolCallRequest,
    outcome: "approved" | "refused",
    reason: string,
    now: DateTime.Utc
  ): TierGateAuditRecord =>
    TierGateAuditRecord.make({
      destructive: destructiveOf(request.tool),
      occurredAt: DateTime.formatIso(now),
      outcome,
      reason,
      tool: request.tool.name,
      toolCallId: request.toolCallId,
    });

  const refused = (request: ToolCallRequest, reason: string, now: DateTime.Utc): TierGateVerdict =>
    TierGateVerdict.make({ audit: auditFor(request, "refused", reason, now), verdict: "refused" });

  const evaluate = Effect.fn("Epistemic.GovernedTierGate.evaluate")(function* (request: ToolCallRequest) {
    const caller = yield* CurrentMcpCaller;
    const now = yield* DateTime.now;
    if (O.isNone(caller)) {
      // No MCP session means no run, hence no chain to append to; the refusal
      // is still fail-closed and still audited.
      yield* Effect.logWarning("governed tier gate refused a caller-less dispatch").pipe(
        Effect.annotateLogs({
          reason: "no-grant-in-scope",
          subsystem: "epistemic_governed_tier_gate",
          tool: request.tool.name,
        })
      );
      return refused(request, denialGuidance["no-grant-in-scope"], now);
    }
    const clientId = caller.value.clientId;
    return yield* lock.withPermit(
      Effect.gen(function* () {
        const state = yield* resolveRun(clientId, now);
        const executionRequest = ExecutionRequest.make({
          destination: options.sink.destination,
          operation: GrantOperation.make(request.tool.name),
          // The boundary owns the classification for this branch's sink:
          // every governed operation here targets the composition-root sink
          // triple, so its audience is a construction fact, not a resolver
          // question. The network resolver applies to network-egress
          // destinations, which carry per-destination grants.
          resolvedAudience: options.sink.audience,
          sinkClass: options.sink.sinkClass,
        });
        const verdict = evaluateExecutionRequest(state.frozen, executionRequest, now, config.policyRevision);
        const common = {
          audience: executionRequest.resolvedAudience,
          decidedAt: now,
          destinationDigest: destinationDigestOf(executionRequest.destination),
          grantSetDigest: state.frozen.digest,
          operationDigest: operationDigestOf(executionRequest.operation),
          policyRevision: state.frozen.policyRevision,
          prevHash: state.lastHash,
          runKey: state.runKey,
          seq: NonNegativeInt.make(state.nextSeq),
          sinkClass: executionRequest.sinkClass,
        };
        const record = sealExecutionDecision(
          ExecutionVerdict.match(verdict, {
            allowed: () => ({ ...common, verdict: "allowed" as const }),
            denied: ({ reason }) => ({ ...common, reason, verdict: "denied" as const }),
          })
        );
        // Uninterruptible so an interruption cannot land between a successful
        // append and the state commit — that gap would strand the run on a
        // sequence slot the database already holds, wedging every later
        // dispatch of the run into a chain-key refusal.
        const appended = yield* Effect.uninterruptible(
          ledger.appendDecision(record).pipe(
            Effect.andThen(commitDecision(clientId, record)),
            Effect.as(true),
            Effect.catchCause((cause) =>
              Effect.logError("governed tier gate could not write the write-ahead decision").pipe(
                Effect.annotateLogs({ cause, subsystem: "epistemic_governed_tier_gate", tool: request.tool.name }),
                Effect.as(false)
              )
            )
          )
        );
        if (!appended) {
          // No record, no action: an unwritable decision refuses the dispatch
          // regardless of what the evaluator concluded, and the run state does
          // not advance, so the next dispatch reuses this sequence slot.
          return refused(request, denialGuidance["ledger-unavailable"], now);
        }
        return ExecutionVerdict.match(verdict, {
          allowed: () =>
            TierGateVerdict.make({ audit: auditFor(request, "approved", approvedGuidance, now), verdict: "approved" }),
          denied: ({ reason }) => refused(request, denialGuidance[reason], now),
        });
      })
    );
  });

  const settlePending = Effect.fn("Epistemic.GovernedTierGate.settlePending")(function* (input: {
    readonly clientId: number;
    readonly decisionHash: DecisionRecordHash;
    readonly now: DateTime.Utc;
    readonly operationDigest: string;
    readonly request: ToolCallRequest;
    readonly rest: ReadonlyArray<DecisionRecordHash>;
    readonly runKey: ExecutionRunKey;
    readonly settlement: TierGateSettlement;
  }) {
    // Dequeue before the append attempt: the dispatch has settled and no
    // retry is coming, so a failed outcome write must leave the decision
    // visibly unsettled in the derived unknown-outcome view rather than
    // queued forever.
    yield* Ref.update(runs, (map) =>
      O.match(HashMap.get(map, input.clientId), {
        onNone: () => map,
        onSome: (state) =>
          HashMap.set(map, input.clientId, {
            ...state,
            pendingOutcomes:
              input.rest.length === 0
                ? HashMap.remove(state.pendingOutcomes, input.operationDigest)
                : HashMap.set(state.pendingOutcomes, input.operationDigest, input.rest),
          }),
      })
    );
    const outcome = sealExecutionOutcome({
      decisionHash: input.decisionHash,
      recordedAt: input.now,
      runKey: input.runKey,
      settlement: input.settlement,
    });
    yield* ledger.appendOutcome(outcome).pipe(
      Effect.catchCause((cause) =>
        Effect.logWarning("governed tier gate could not write a settlement outcome").pipe(
          Effect.annotateLogs({
            cause,
            settlement: input.settlement,
            subsystem: "epistemic_governed_tier_gate",
            tool: input.request.tool.name,
          })
        )
      )
    );
  });

  const recordOutcome = Effect.fn("Epistemic.GovernedTierGate.recordOutcome")(function* (
    request: ToolCallRequest,
    settlement: TierGateSettlement
  ) {
    const caller = yield* CurrentMcpCaller;
    const now = yield* DateTime.now;
    if (O.isNone(caller)) {
      return yield* Effect.logDebug("governed tier gate dropped a caller-less settlement").pipe(
        Effect.annotateLogs({ subsystem: "epistemic_governed_tier_gate", tool: request.tool.name })
      );
    }
    const clientId = caller.value.clientId;
    const droppedSettlement = (detail: string) =>
      Effect.logDebug(`governed tier gate dropped a settlement with no ${detail}`).pipe(
        Effect.annotateLogs({ subsystem: "epistemic_governed_tier_gate", tool: request.tool.name })
      );
    yield* lock.withPermit(
      Effect.gen(function* () {
        const map = yield* Ref.get(runs);
        yield* O.match(HashMap.get(map, clientId), {
          onNone: () => droppedSettlement("run"),
          onSome: (state) => {
            const operationDigest = operationDigestOf(GrantOperation.make(request.tool.name));
            const pending = pendingFor(state, operationDigest);
            return O.match(A.head(pending), {
              onNone: () => droppedSettlement("pending decision"),
              onSome: (decisionHash) =>
                settlePending({
                  clientId,
                  decisionHash,
                  now,
                  operationDigest,
                  request,
                  rest: A.drop(pending, 1),
                  runKey: state.runKey,
                  settlement,
                }),
            });
          },
        });
      })
    );
  });

  return TierGate.of({ evaluate, recordOutcome });
});
