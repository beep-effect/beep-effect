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
 *   transport-assigned session identifier read from `CurrentMcpCaller` — not
 *   by `clientId`, which the HTTP protocol mints per request and which would
 *   therefore open a new run per dispatch. The grant set is built from
 *   session-static inputs only (composition-root options plus
 *   `EpistemicConfig`) and frozen on the session's first dispatch; nothing an
 *   agent reads mid-session can widen it.
 * - **Refusal is a value, and it is reason-free.** Both gate methods are
 *   total. Every refusal carries the same constant audit reason whatever the
 *   bounded denial reason was: differential refusal text lets an agent
 *   enumerate the grant set and distinguish a policy denial from an
 *   infrastructure outage. The bounded reason goes to the ledger row and the
 *   server log, neither of which the agent can read.
 *
 * Runs are never evicted, and that is deliberate. Evicting an expired run
 * would let the next dispatch of that same session freeze fresh grants, so
 * the grant TTL would bound nothing — retaining the expired run is what makes
 * `grant-expired` permanent for the session that earned it. The store grows
 * by one small entry per MCP session; a session exists only after an
 * `initialize` that already cleared the origin allowlist and the per-launch
 * bearer token. Releasing entries at end of session needs a client-lifecycle
 * seam `mcp-kit` does not expose today.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { EpistemicConfig } from "@beep/epistemic-config/server";
import {
  ExecutionGrant,
  ExecutionSink,
  GrantBudget,
  GrantOperation,
  GrantPurpose,
  GrantResource,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  destinationDigestOf,
  digestForLedger,
  ExecutionRunKey,
  operationDigestOf,
  sealExecutionDecision,
  sealExecutionOutcome,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import {
  DenialReason,
  denialGuidance,
  ExecutionRequest,
  ExecutionVerdict,
} from "@beep/epistemic-domain/values/ExecutionVerdict";
import { DraftGrantSet, evaluateExecutionRequest, freezeGrantSet } from "@beep/epistemic-domain/values/GrantSet";
import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import { $EpistemicServerId } from "@beep/identity/packages";
import { CurrentMcpCaller, TierGate, TierGateAuditRecord, TierGateVerdict } from "@beep/mcp-kit";
import { NonNegativeInt } from "@beep/schema";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import { A, O } from "@beep/utils";
import { Context, DateTime, Duration, Effect, HashMap, Ref, Semaphore } from "effect";
import * as S from "effect/Schema";
import * as AiTool from "effect/unstable/ai/Tool";
import type { DecisionRecordHash, ExecutionDecisionRecord } from "@beep/epistemic-domain/values/ExecutionRecord";
import type { FrozenGrantSet } from "@beep/epistemic-domain/values/GrantSet";
import type { TierGateSettlement, ToolCallRequest } from "@beep/mcp-kit";

const $I = $EpistemicServerId.create("GovernedTierGate/GovernedTierGate.gate");

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
 * import { GovernedTierGateOptions } from "@beep/epistemic-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration } from "effect"
 *
 * const options = GovernedTierGateOptions.make({
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
 * console.log(options.operations.length)
 * // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GovernedTierGateOptions extends S.Class<GovernedTierGateOptions>($I`GovernedTierGateOptions`)(
  {
    grantTtl: S.Duration.annotateKey({
      description: "Lifetime of a session's frozen grants, measured from the freeze.",
    }),
    operations: S.Array(GrantOperation).annotateKey({
      description: "Tool operations granted against the sink; exact match, no wildcard.",
    }),
    purpose: GrantPurpose.annotateKey({
      description: "Purpose recorded on every session grant.",
    }),
    resource: GrantResource.annotateKey({
      description: "Resource selector recorded on every session grant.",
    }),
    sink: ExecutionSink.annotateKey({
      description: "Governed sink every gated dispatch in this branch targets.",
    }),
  },
  $I.annote("GovernedTierGateOptions", {
    description: "Session-static inputs the composition root supplies to the governed tier gate.",
  })
) {
  static readonly is = S.is(GovernedTierGateOptions);
}

interface RunState {
  readonly expiresAtMillis: number;
  readonly frozen: FrozenGrantSet;
  readonly lastHash: O.Option<DecisionRecordHash>;
  readonly nextSeq: number;
  readonly pendingOutcomes: HashMap.HashMap<number, DecisionRecordHash>;
  readonly runKey: ExecutionRunKey;
}

const approvedGuidance = "Approved by a grant in the session's frozen grant set.";

/**
 * The one guidance string every governed refusal carries, whatever the bounded
 * denial reason was.
 *
 * A denial reaches the agent reason-free: differential refusal text is a
 * grant-set enumeration oracle, and it also tells an agent whether it hit a
 * policy denial or an infrastructure outage. The bounded reason goes to the
 * ledger row and the server log, neither of which the agent can read. Exported
 * so a test can assert that refusals are indistinguishable.
 *
 * @example
 * ```ts
 * import { refusalGuidance } from "@beep/epistemic-server/GovernedTierGate"
 *
 * console.log(refusalGuidance)
 * // "This action is not authorized for this session."
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const refusalGuidance = "This action is not authorized for this session.";

const grantPrincipal = SystemPrincipal.make({ component: "Runtime", kind: "System" });

const destructiveOf = (tool: AiTool.Any): boolean =>
  Context.getOrElse(tool.annotations, AiTool.Destructive, () => true);

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
 * import { GovernedTierGateOptions, makeGovernedTierGate } from "@beep/epistemic-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration, Effect } from "effect"
 *
 * const gate = makeGovernedTierGate(GovernedTierGateOptions.make({
 *   grantTtl: Duration.hours(12),
 *   operations: [GrantOperation.make("ontology_propose_change_batch")],
 *   purpose: GrantPurpose.make("ontology-workspace-mutation"),
 *   resource: GrantResource.make("ontology-workspace"),
 *   sink: ExecutionSink.make({
 *     audience: "local-workspace",
 *     destination: SinkDestination.make("workspace://ontology"),
 *     sinkClass: "mcp-write"
 *   })
 * }))
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
  const runs = yield* Ref.make(HashMap.empty<string, RunState>());
  // One lock serializes run creation and ledger appends so chain sequencing
  // stays dense per run. Global rather than per-run: the desktop surface has
  // one interactive caller, and a coarser critical section cannot deadlock —
  // the wrapped effect always runs outside it.
  const lock = yield* Semaphore.make(1);

  const freezeRunFor = (runId: string, now: DateTime.Utc): RunState => {
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
    // Deterministic per (run id, freeze instant). The run id is the transport's
    // session identifier, which never recurs, so the pair cannot repeat. A
    // collision would surface as a chain primary-key violation, which refuses
    // fail-closed rather than corrupting the chain.
    const runKey = ExecutionRunKey.make(digestForLedger(`epistemic-run/${runId}/${DateTime.toEpochMillis(now)}`));
    return {
      expiresAtMillis: DateTime.toEpochMillis(expiresAt),
      frozen,
      lastHash: O.none(),
      nextSeq: 0,
      pendingOutcomes: HashMap.empty(),
      runKey,
    };
  };

  // Runs are never evicted. Eviction plus re-freeze would hand an expired
  // session brand-new authority on its next dispatch, turning the grant TTL
  // into a delay rather than a bound; retaining the expired run is what makes
  // `grant-expired` permanent for the session that earned it. Growth is one
  // small entry per MCP session — sessions are minted only by an `initialize`
  // that already passed the origin allowlist and the per-launch bearer token.
  const resolveRun = (runId: string, now: DateTime.Utc): Effect.Effect<RunState> =>
    Ref.modify(runs, (map) =>
      O.match(HashMap.get(map, runId), {
        onNone: () => {
          const created = freezeRunFor(runId, now);
          return [created, HashMap.set(map, runId, created)] as const;
        },
        onSome: (state) => [state, map] as const,
      })
    );

  const commitDecision = (runId: string, dispatchId: number, record: ExecutionDecisionRecord): Effect.Effect<void> =>
    Ref.update(runs, (map) =>
      O.match(HashMap.get(map, runId), {
        onNone: () => map,
        onSome: (state) =>
          HashMap.set(map, runId, {
            ...state,
            lastHash: O.some(record.hash),
            nextSeq: state.nextSeq + 1,
            pendingOutcomes:
              record.verdict === "allowed"
                ? HashMap.set(state.pendingOutcomes, dispatchId, record.hash)
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

  // The bounded reason names the log line and nothing else: every refusal the
  // agent sees carries the same constant guidance.
  const refuse = (request: ToolCallRequest, reason: DenialReason, now: DateTime.Utc): Effect.Effect<TierGateVerdict> =>
    Effect.logWarning("governed tier gate refused a dispatch").pipe(
      Effect.annotateLogs({
        guidance: denialGuidance[reason],
        reason,
        subsystem: "epistemic_governed_tier_gate",
        tool: request.tool.name,
      }),
      Effect.as(TierGateVerdict.make({ audit: auditFor(request, "refused", refusalGuidance, now), verdict: "refused" }))
    );

  const evaluate = Effect.fn("Epistemic.GovernedTierGate.evaluate")(function* (request: ToolCallRequest) {
    const caller = yield* CurrentMcpCaller;
    const now = yield* DateTime.now;
    if (O.isNone(caller)) {
      // No MCP session means no run, hence no chain to append to; the refusal
      // is still fail-closed and still audited.
      return yield* refuse(request, DenialReason.Enum["no-grant-in-scope"], now);
    }
    // The run is the MCP session. `clientId` cannot key it: the HTTP protocol
    // mints a fresh one per request, so keying on it would open a new run per
    // dispatch and reduce every chain to a single genesis row. `sessionId` is
    // the transport's session identifier; transports that issue none (stdio)
    // fall back to the client id, where the connection is the session.
    const runId = O.match(caller.value.sessionId, {
      onNone: () => `client:${caller.value.clientId}`,
      onSome: (sessionId) => `session:${sessionId}`,
    });
    const dispatchId = yield* Effect.withFiber((fiber) => Effect.succeed(fiber.id));
    return yield* lock.withPermit(
      Effect.gen(function* () {
        const state = yield* resolveRun(runId, now);
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
            Effect.andThen(commitDecision(runId, dispatchId, record)),
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
          return yield* refuse(request, DenialReason.Enum["ledger-unavailable"], now);
        }
        return yield* ExecutionVerdict.match(verdict, {
          allowed: () =>
            Effect.succeed(
              TierGateVerdict.make({
                audit: auditFor(request, "approved", approvedGuidance, now),
                verdict: "approved",
              })
            ),
          denied: ({ reason }) => refuse(request, reason, now),
        });
      })
    );
  });

  const settlePending = Effect.fn("Epistemic.GovernedTierGate.settlePending")(function* (input: {
    readonly decisionHash: DecisionRecordHash;
    readonly dispatchId: number;
    readonly now: DateTime.Utc;
    readonly request: ToolCallRequest;
    readonly runId: string;
    readonly runKey: ExecutionRunKey;
    readonly settlement: TierGateSettlement;
  }) {
    // Dequeue before the append attempt: the dispatch has settled and no
    // retry is coming, so a failed outcome write must leave the decision
    // visibly unsettled in the derived unknown-outcome view rather than
    // queued forever.
    yield* Ref.update(runs, (map) =>
      O.match(HashMap.get(map, input.runId), {
        onNone: () => map,
        onSome: (state) =>
          HashMap.set(map, input.runId, {
            ...state,
            pendingOutcomes: HashMap.remove(state.pendingOutcomes, input.dispatchId),
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
    const runId = O.match(caller.value.sessionId, {
      onNone: () => `client:${caller.value.clientId}`,
      onSome: (sessionId) => `session:${sessionId}`,
    });
    // `dispatchWithTierGate` calls `evaluate` and then, via `Effect.onExit`,
    // `recordOutcome` on the same fiber, so the fiber identifies the dispatch
    // exactly. A queue keyed by anything coarser (the operation, say) binds
    // the wrong settlement to the wrong decision as soon as two dispatches of
    // one operation overlap and finish out of order.
    const dispatchId = yield* Effect.withFiber((fiber) => Effect.succeed(fiber.id));
    const droppedSettlement = (detail: string) =>
      Effect.logDebug(`governed tier gate dropped a settlement with no ${detail}`).pipe(
        Effect.annotateLogs({ subsystem: "epistemic_governed_tier_gate", tool: request.tool.name })
      );
    yield* lock.withPermit(
      Effect.gen(function* () {
        const map = yield* Ref.get(runs);
        yield* O.match(HashMap.get(map, runId), {
          onNone: () => droppedSettlement("run"),
          onSome: (state) =>
            O.match(HashMap.get(state.pendingOutcomes, dispatchId), {
              onNone: () => droppedSettlement("pending decision"),
              onSome: (decisionHash) =>
                settlePending({ decisionHash, dispatchId, now, request, runId, runKey: state.runKey, settlement }),
            }),
        });
      })
    );
  });

  return TierGate.of({ evaluate, recordOutcome });
});
