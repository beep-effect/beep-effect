/**
 * Governed tier gate: the enforcement boundary between the MCP agent surface
 * and the execution ledger.
 *
 * **Details**
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
 *   `ExecutionAuthorityConfig`) and frozen on the session's first dispatch; nothing an
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

import { ExecutionAuthorityConfig } from "@beep/execution-authority-config/server";
import {
  destinationDigestOf,
  digestForLedger,
  ExecutionRunKey,
  operationDigestOf,
  sealExecutionDecision,
  sealExecutionOutcome,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";
import {
  ExecutionGrant,
  ExecutionSink,
  GrantBudget,
  GrantOperation,
  GrantPurpose,
  GrantResource,
} from "@beep/execution-authority-domain/values/ExecutionGrant";
import {
  DenialReason,
  denialGuidance,
  ExecutionRequest,
  ExecutionVerdict,
} from "@beep/execution-authority-domain/values/ExecutionVerdict";
import {
  DraftGrantSet,
  ExecutionRequestEvaluationOptions,
  evaluateExecutionRequest,
  freezeGrantSet,
} from "@beep/execution-authority-domain/values/GrantSet";
import { ExecutionLedger } from "@beep/execution-authority-use-cases/ExecutionLedger";
import { $ExecutionAuthorityServerId } from "@beep/identity/packages";
import { CurrentMcpCaller, TierGate, TierGateAuditRecord, TierGateVerdict } from "@beep/mcp-kit";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import { A, O } from "@beep/utils";
import * as AiTool from "effect/ai/Tool";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import type {
  DecisionRecordHash,
  ExecutionDecisionRecord,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";
import type { FrozenGrantSet } from "@beep/execution-authority-domain/values/GrantSet";
import type { McpCallerIdentity, TierGateSettlement, ToolCallRequest } from "@beep/mcp-kit";

const $I = $ExecutionAuthorityServerId.create("GovernedTierGate/GovernedTierGate.gate");

/**
 * **Details**
 *
 * The gate cannot name the tools it governs — that would be a slice-to-slice
 * import — so the granted operations, the sink they all target, and the grant
 * metadata arrive as data from the app entrypoint that already imports both
 * sides. The sink carries its audience by construction: every operation the
 * gate governs in one branch targets the same sink, and for an `mcp-write`
 * workspace sink the boundary owns the classification (the URL-parsing
 * network resolver would misclassify a non-network destination).
 *
 * **Example** (Usage)
 * ```ts
 * import { GovernedTierGateOptions } from "@beep/execution-authority-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/execution-authority-domain/values/ExecutionGrant"
 * import * as Duration from "effect/Duration";
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
export class GovernedTierGateOptions extends S.Opaque<GovernedTierGateOptions, { readonly brand: unique symbol }>()(
  S.Struct({
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
  }).pipe(
    $I.annoteSchema("GovernedTierGateOptions", {
      description: "Session-static inputs the composition root supplies to the governed tier gate.",
    })
  )
) {}

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
 * **Details**
 *
 * A denial reaches the agent reason-free: differential refusal text is a
 * grant-set enumeration oracle, and it also tells an agent whether it hit a
 * policy denial or an infrastructure outage. The bounded reason goes to the
 * ledger row and the server log, neither of which the agent can read. Exported
 * so a test can assert that refusals are indistinguishable.
 *
 * **Example** (Usage)
 * ```ts
 * import { refusalGuidance } from "@beep/execution-authority-server/GovernedTierGate"
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

const runIdOf = (caller: McpCallerIdentity): string =>
  O.match(caller.sessionId, {
    onNone: () => `client:${caller.clientId}`,
    onSome: (sessionId) => `session:${sessionId}`,
  });

const currentDispatchId: Effect.Effect<number> = Effect.withFiber((fiber) => Effect.succeed(fiber.id));

/**
 * Build the governed tier gate service.
 *
 * **Details**
 *
 * Reads `ExecutionAuthorityConfig` and `ExecutionLedger` once at construction, so both
 * gate methods stay total (`R = never`) as `TierGateShape` requires; the only
 * per-request context is the `CurrentMcpCaller` reference the sanitized
 * toolkit populates on each dispatch. A transport that issues no session
 * identifier (stdio) keys its run by client id, since there the connection is
 * the session.
 *
 * **Gotchas**
 *
 * A settlement is matched to its decision by fiber id: `recordOutcome` must run
 * on the fiber that ran `evaluate` for the same dispatch, as
 * `dispatchWithTierGate` does through `Effect.onExit`. Correlating by anything
 * coarser, such as the operation, binds a settlement to the wrong decision once
 * two dispatches of one operation overlap and finish out of order.
 *
 * **Example** (Usage)
 * ```ts
 * import { GovernedTierGateOptions, makeGovernedTierGate } from "@beep/execution-authority-server/GovernedTierGate"
 * import { ExecutionSink, GrantOperation, GrantPurpose, GrantResource, SinkDestination } from "@beep/execution-authority-domain/values/ExecutionGrant"
 * import * as Duration from "effect/Duration";
 * import * as Effect from "effect/Effect";
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
export const makeGovernedTierGate = Effect.fn("ExecutionAuthority.GovernedTierGate.make")(function* (
  options: GovernedTierGateOptions
) {
  const config = yield* ExecutionAuthorityConfig;
  const ledger = yield* ExecutionLedger;
  const runs = yield* Ref.make(HashMap.empty<string, RunState>());
  // decision: single-gate-lock
  const lock = yield* Semaphore.make(1);

  const freezeRunFor = (runId: string, now: DateTime.Utc): Result.Result<RunState, S.SchemaError> => {
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
    // decision: epistemic-run-key-labels-frozen
    const runKey = ExecutionRunKey.make(digestForLedger(`epistemic-run/${runId}/${DateTime.toEpochMillis(now)}`));
    return Result.map(
      freezeGrantSet(DraftGrantSet.make({ grants, policyRevision: config.policyRevision }), now),
      (frozen): RunState => ({
        expiresAtMillis: DateTime.toEpochMillis(expiresAt),
        frozen,
        lastHash: O.none(),
        nextSeq: 0,
        pendingOutcomes: HashMap.empty(),
        runKey,
      })
    );
  };

  const resolveRun = (runId: string, now: DateTime.Utc): Effect.Effect<RunState> =>
    Effect.flatMap(Ref.get(runs), (map) =>
      O.match(HashMap.get(map, runId), {
        onNone: () =>
          freezeRunFor(runId, now).pipe(
            Effect.fromResult,
            Effect.orDie,
            Effect.tap((created) => Ref.update(runs, HashMap.set(runId, created)))
          ),
        onSome: Effect.succeed,
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

  const refuse = (request: ToolCallRequest, reason: DenialReason, now: DateTime.Utc): Effect.Effect<TierGateVerdict> =>
    Effect.logWarning("governed tier gate refused a dispatch").pipe(
      Effect.annotateLogs({
        guidance: denialGuidance[reason],
        reason,
        subsystem: "execution_authority_governed_tier_gate",
        tool: request.tool.name,
      }),
      Effect.as(TierGateVerdict.make({ audit: auditFor(request, "refused", refusalGuidance, now), verdict: "refused" }))
    );

  const evaluate = Effect.fn("ExecutionAuthority.GovernedTierGate.evaluate")(function* (request: ToolCallRequest) {
    const caller = yield* CurrentMcpCaller;
    const now = yield* DateTime.now;
    if (O.isNone(caller)) {
      return yield* refuse(request, DenialReason.Enum["no-grant-in-scope"], now);
    }
    const runId = runIdOf(caller.value);
    const dispatchId = yield* currentDispatchId;
    return yield* lock.withPermit(
      Effect.gen(function* () {
        const state = yield* resolveRun(runId, now);
        const executionRequest = ExecutionRequest.make({
          destination: options.sink.destination,
          operation: GrantOperation.make(request.tool.name),
          principal: grantPrincipal,
          resolvedAudience: options.sink.audience,
          sinkClass: options.sink.sinkClass,
        });
        const verdict = evaluateExecutionRequest(
          state.frozen,
          executionRequest,
          ExecutionRequestEvaluationOptions.make({ currentPolicyRevision: config.policyRevision, now })
        );
        const common = {
          audience: executionRequest.resolvedAudience,
          decidedAt: now,
          destinationDigest: destinationDigestOf(executionRequest.destination),
          grantSetDigest: state.frozen.digest,
          operationDigest: operationDigestOf(executionRequest.operation),
          policyRevision: state.frozen.policyRevision,
          prevHash: state.lastHash,
          runKey: state.runKey,
          seq: S.Natural.make(state.nextSeq),
          sinkClass: executionRequest.sinkClass,
        };
        const record = sealExecutionDecision(
          ExecutionVerdict.match(verdict, {
            allowed: () => ({ ...common, verdict: "allowed" as const }),
            denied: ({ reason }) => ({ ...common, reason, verdict: "denied" as const }),
          })
        );
        // decision: decision-append-advances-chain-atomically
        const appended = yield* Effect.uninterruptible(
          ledger.appendDecision(record).pipe(
            Effect.andThen(commitDecision(runId, dispatchId, record)),
            Effect.as(true),
            Effect.catchCause((cause) =>
              Effect.logError("governed tier gate could not write the write-ahead decision").pipe(
                Effect.annotateLogs({
                  cause,
                  subsystem: "execution_authority_governed_tier_gate",
                  tool: request.tool.name,
                }),
                Effect.as(false)
              )
            )
          )
        );
        if (!appended) {
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

  const settlePending = Effect.fn("ExecutionAuthority.GovernedTierGate.settlePending")(function* (input: {
    readonly decisionHash: DecisionRecordHash;
    readonly dispatchId: number;
    readonly now: DateTime.Utc;
    readonly request: ToolCallRequest;
    readonly runId: string;
    readonly runKey: ExecutionRunKey;
    readonly settlement: TierGateSettlement;
  }) {
    // decision: settlement-write-is-best-effort
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
            subsystem: "execution_authority_governed_tier_gate",
            tool: input.request.tool.name,
          })
        )
      )
    );
  });

  const recordOutcome = Effect.fn("ExecutionAuthority.GovernedTierGate.recordOutcome")(function* (
    request: ToolCallRequest,
    settlement: TierGateSettlement
  ) {
    const caller = yield* CurrentMcpCaller;
    const now = yield* DateTime.now;
    if (O.isNone(caller)) {
      return yield* Effect.logDebug("governed tier gate dropped a caller-less settlement").pipe(
        Effect.annotateLogs({ subsystem: "execution_authority_governed_tier_gate", tool: request.tool.name })
      );
    }
    const runId = runIdOf(caller.value);
    const dispatchId = yield* currentDispatchId;
    yield* lock.withPermit(
      Effect.gen(function* () {
        const map = yield* Ref.get(runs);
        const pending = O.flatMap(HashMap.get(map, runId), (state) =>
          O.map(HashMap.get(state.pendingOutcomes, dispatchId), (decisionHash) => ({
            decisionHash,
            runKey: state.runKey,
          }))
        );
        yield* O.match(pending, {
          onNone: () =>
            Effect.logDebug("governed tier gate dropped a settlement with no pending decision").pipe(
              Effect.annotateLogs({ subsystem: "execution_authority_governed_tier_gate", tool: request.tool.name })
            ),
          onSome: ({ decisionHash, runKey }) =>
            settlePending({ decisionHash, dispatchId, now, request, runId, runKey, settlement }),
        });
      })
    );
  });

  return TierGate.of({ evaluate, recordOutcome });
});
