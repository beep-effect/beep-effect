/**
 * Governed egress: the destination boundary for outbound HTTP.
 *
 * **Details**
 *
 * This is the second enforcement surface of the execution-authority packet,
 * and it answers a different question from the tier gate. The gate decides
 * *whether a session may invoke an operation*; this decides *whether a request
 * may reach a destination*. They are separate because `ToolCallRequest` carries
 * the tool and nothing else — no parameters — so a gate physically cannot see
 * the URL a tool intends to contact.
 *
 * It is installed as `FetchHttpClient.Fetch` rather than as an `HttpClient`
 * wrapper on purpose: a driver that builds its own client from
 * `FetchHttpClient.layer` would slip past a client-level wrapper, and the
 * `Fetch` reference is the one seam every such driver still resolves through.
 *
 * **Two properties, and one honest limitation.**
 *
 * - **Default-deny by construction.** The allowlist defaults to empty, an empty
 *   allowlist freezes an empty grant set, and an empty grant set denies every
 *   destination. Reaching anything at all requires an operator to have named it.
 * - **Write-ahead, like the gate.** The decision row is appended before the
 *   request is issued, and a decision that cannot be written denies the request.
 * - **Its records are not correlated to an MCP session.** `Fetch` is a plain
 *   function returning a promise, so it has no fiber and therefore no
 *   `CurrentMcpCaller`: this boundary cannot know which session provoked the
 *   request. Its decisions are chained into their own run, keyed to the process
 *   that built the layer, and an auditor correlates them to session rows by
 *   time. Closing that gap needs a request-scoped seam that `Fetch` does not
 *   have, and inferring the session from ambient state would reintroduce
 *   exactly the cross-dispatch misattribution the gate's fiber correlation
 *   exists to prevent.
 *
 * @packageDocumentation
 * @category services
 * @since 0.0.0
 */

import { EgressDenied } from "@beep/api-transport";
import { ExecutionAuthorityConfig, resolveSinkAudience } from "@beep/execution-authority-config/server";
import {
  destinationDigestOf,
  digestForLedger,
  ExecutionRunKey,
  ExecutionSettlement,
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
  SinkDestination,
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
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import { A, O } from "@beep/utils";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import type { DecisionRecordHash } from "@beep/execution-authority-domain/entities/ExecutionRecord";

const $I = $ExecutionAuthorityServerId.create("GovernedEgress/GovernedEgress.fetch");
// decision: settlement-write-is-best-effort
const outcomeAppendTimeout = Duration.seconds(1);

/**
 * Session-static inputs the composition root supplies to the governed egress
 * boundary. The destinations themselves are never passed here — they come from
 * `ExecutionAuthorityConfig`, so the allowlist has exactly one owner.
 *
 * **Details**
 *
 * There is no audience option either: each grant's audience is derived from its
 * destination, because a caller that could declare its own audience would
 * declare the friendlier one.
 *
 * **Example** (Usage)
 * ```ts
 * import { GovernedEgressOptions } from "@beep/execution-authority-server/GovernedEgress"
 * import { GrantOperation, GrantPurpose, GrantResource } from "@beep/execution-authority-domain/values/ExecutionGrant"
 * import * as Duration from "effect/Duration";
 * const options = GovernedEgressOptions.make({
 *   grantTtl: Duration.hours(12),
 *   operation: GrantOperation.make("http-egress"),
 *   purpose: GrantPurpose.make("ontology-provenance-publication"),
 *   resource: GrantResource.make("ontology-workspace")
 * })
 * console.log(options.operation)
 * // "http-egress"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GovernedEgressOptions extends S.Opaque<GovernedEgressOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    grantTtl: S.Duration.annotateKey({
      description: "Lifetime of the frozen egress grant set, measured from layer build.",
    }),
    operation: GrantOperation.annotateKey({
      description: "Operation name recorded on every egress grant and decision.",
    }),
    purpose: GrantPurpose.annotateKey({
      description: "Purpose recorded on every egress grant.",
    }),
    resource: GrantResource.annotateKey({
      description: "Resource selector recorded on every egress grant.",
    }),
  }).pipe(
    $I.annoteSchema("GovernedEgressOptions", {
      description: "Session-static inputs the composition root supplies to the governed egress boundary.",
    })
  )
) {}

const egressPrincipal = SystemPrincipal.make({ component: "Runtime", kind: "System" });

const canonicalize = (value: string): O.Option<string> =>
  Result.try(() => {
    const url = new URL(value);
    return O.some(`${url.origin}${Str.replace(/\/+$/, "")(url.pathname)}`);
  }).pipe(Result.getOrElse(O.none));

const canonicalizeForRecord = (value: string): O.Option<string> =>
  Result.try(() => {
    const url = new URL(value);
    return O.some(`${url.origin}${Str.replace(/\/+$/, "")(url.pathname)}${url.search}${url.hash}`);
  }).pipe(Result.getOrElse(O.none));

const coveredBy = (entry: string, requested: string): boolean =>
  requested === entry || Str.startsWith(`${entry}/`)(requested);

/**
 * Build the governed egress `fetch`.
 *
 * **Details**
 *
 * Wraps `baseFetch` (defaulting to the platform `fetch`) with the destination
 * check. An allowed destination is delegated; a denied one rejects with
 * {@link EgressDenied}, which `HttpClient` surfaces as a `TransportError`
 * carrying that error as its cause — the shape a consumer matches on to return
 * its own typed refusal.
 *
 * The rejection is deliberately reason-free. Which of "not on the allowlist",
 * "the grant expired", or "the ledger is down" produced it is written to the
 * decision row and the server log; an agent that could tell them apart could
 * map the allowlist by probing it.
 *
 * **Gotchas**
 *
 * - An allowlist entry covers its own origin and path and everything beneath
 *   the next `/`, never a lookalike host: `https://allowed.example` does not
 *   cover `https://allowed.example.evil.test`. Entries and requests are parsed
 *   as URLs, so `https://allowed.example@evil.test/` and
 *   `https://allowed.example:443` compare as the origin they resolve to, and a
 *   query string never widens or narrows coverage.
 * - An allowlist entry that does not parse as a URL is dropped with a logged
 *   warning, never granted.
 * - The decision row records the destination as requested, query and fragment
 *   included (as a digest), not the covering entry, so an exfiltration under an
 *   allowed prefix (`.../publish?payload=…`) stays distinguishable in the
 *   ledger from a benign request to that prefix.
 * - Redirects are refused (`redirect: "error"`), because the check covers the
 *   first hop only: an allowlisted host that redirects fails the request
 *   instead of handing it to a host the operator never named.
 *
 * **Example** (Usage)
 * ```ts
 * import { GovernedEgressOptions, makeGovernedEgressFetch } from "@beep/execution-authority-server/GovernedEgress"
 * import { GrantOperation, GrantPurpose, GrantResource } from "@beep/execution-authority-domain/values/ExecutionGrant"
 * import * as Duration from "effect/Duration";
 * import * as Effect from "effect/Effect";
 * const fetch = makeGovernedEgressFetch(GovernedEgressOptions.make({
 *   grantTtl: Duration.hours(12),
 *   operation: GrantOperation.make("http-egress"),
 *   purpose: GrantPurpose.make("ontology-provenance-publication"),
 *   resource: GrantResource.make("ontology-workspace")
 * }))
 * console.log(Effect.isEffect(fetch))
 * // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGovernedEgressFetch = Effect.fn("ExecutionAuthority.GovernedEgress.make")(function* (
  options: GovernedEgressOptions,
  baseFetch?: typeof globalThis.fetch
) {
  const config = yield* ExecutionAuthorityConfig;
  const ledger = yield* ExecutionLedger;
  const frozenAt = yield* DateTime.now;
  const expiresAt = DateTime.add(frozenAt, { milliseconds: Duration.toMillis(options.grantTtl) });

  const entries = A.getSomes(A.map(config.destinationAllowlist, canonicalize));
  yield* A.length(entries) === A.length(config.destinationAllowlist)
    ? Effect.void
    : Effect.logWarning("governed egress dropped unparseable destination allowlist entries").pipe(
        Effect.annotateLogs({
          dropped: A.length(config.destinationAllowlist) - A.length(entries),
          subsystem: "execution_authority_governed_egress",
        })
      );

  const grants = A.map(entries, (entry) => {
    const destination = SinkDestination.make(entry);
    return ExecutionGrant.make({
      budget: GrantBudget.make({}),
      expiresAt,
      operation: options.operation,
      policyRevision: config.policyRevision,
      principal: egressPrincipal,
      purpose: options.purpose,
      resource: options.resource,
      sink: ExecutionSink.make({
        audience: resolveSinkAudience(destination),
        destination,
        sinkClass: "network-egress",
      }),
    });
  });
  const frozen = yield* Effect.fromResult(
    freezeGrantSet(DraftGrantSet.make({ grants, policyRevision: config.policyRevision }), frozenAt)
  ).pipe(Effect.orDie);
  // decision: epistemic-run-key-labels-frozen
  const runKey = ExecutionRunKey.make(
    digestForLedger(`epistemic-egress/${DateTime.toEpochMillis(frozenAt)}/${frozen.digest}`)
  );
  const chain = yield* Ref.make({ lastHash: O.none<DecisionRecordHash>(), nextSeq: 0 });
  const lock = yield* Semaphore.make(1);

  const coveringEntryOrSelf = (requested: string): SinkDestination => {
    const canonical = canonicalize(requested);
    const covering = O.flatMap(canonical, (value) => A.findFirst(entries, (entry) => coveredBy(entry, value)));
    return SinkDestination.make(O.getOrElse(covering, () => O.getOrElse(canonical, () => requested)));
  };

  const deny = (reason: DenialReason, destination: SinkDestination): Effect.Effect<void> =>
    Effect.logWarning("governed egress refused a destination").pipe(
      Effect.annotateLogs({
        destinationDigest: destinationDigestOf(destination),
        guidance: denialGuidance[reason],
        reason,
        subsystem: "execution_authority_governed_egress",
      })
    );

  const authorize = Effect.fn("ExecutionAuthority.GovernedEgress.authorize")(function* (requested: string) {
    const now = yield* DateTime.now;
    const destination = coveringEntryOrSelf(requested);
    const recordedDestination = SinkDestination.make(O.getOrElse(canonicalizeForRecord(requested), () => requested));
    const request = ExecutionRequest.make({
      destination,
      operation: options.operation,
      principal: egressPrincipal,
      resolvedAudience: resolveSinkAudience(destination),
      sinkClass: "network-egress",
    });
    const verdict = evaluateExecutionRequest(
      frozen,
      request,
      ExecutionRequestEvaluationOptions.make({ currentPolicyRevision: config.policyRevision, now })
    );
    return yield* lock.withPermit(
      Effect.gen(function* () {
        const state = yield* Ref.get(chain);
        const common = {
          audience: request.resolvedAudience,
          decidedAt: now,
          destinationDigest: destinationDigestOf(recordedDestination),
          grantSetDigest: frozen.digest,
          operationDigest: operationDigestOf(request.operation),
          policyRevision: frozen.policyRevision,
          prevHash: state.lastHash,
          runKey,
          seq: S.Natural.make(state.nextSeq),
          sinkClass: request.sinkClass,
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
            Effect.andThen(Ref.set(chain, { lastHash: O.some(record.hash), nextSeq: state.nextSeq + 1 })),
            Effect.as(true),
            Effect.catchCause((cause) =>
              Effect.logError("governed egress could not write the write-ahead decision").pipe(
                Effect.annotateLogs({ cause, subsystem: "execution_authority_governed_egress" }),
                Effect.as(false)
              )
            )
          )
        );
        if (!appended) {
          yield* deny(DenialReason.Enum["ledger-unavailable"], recordedDestination);
          return O.none<DecisionRecordHash>();
        }
        return yield* ExecutionVerdict.match(verdict, {
          allowed: () => Effect.succeedSome(record.hash),
          denied: ({ reason }) => deny(reason, recordedDestination).pipe(Effect.as(O.none<DecisionRecordHash>())),
        });
      })
    );
  });

  const recordOutcome = Effect.fn("ExecutionAuthority.GovernedEgress.recordOutcome")(function* (
    decisionHash: DecisionRecordHash,
    settlement: ExecutionSettlement
  ) {
    const recordedAt = yield* DateTime.now;
    const outcome = sealExecutionOutcome({ decisionHash, recordedAt, runKey, settlement });
    yield* ledger.appendOutcome(outcome).pipe(
      Effect.timeout(outcomeAppendTimeout),
      Effect.catchCause((cause) =>
        Effect.logWarning("governed egress could not write a settlement outcome").pipe(
          Effect.annotateLogs({
            cause,
            settlement,
            subsystem: "execution_authority_governed_egress",
          })
        )
      )
    );
  });

  const platformFetch = baseFetch ?? globalThis.fetch;
  const buildContext = yield* Effect.context<never>();
  const runInBuildContext = Effect.runPromiseWith(buildContext);

  const governedFetch = (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1]
  ): Promise<Response> =>
    runInBuildContext(authorize(input instanceof Request ? input.url : String(input))).then(
      O.match({
        onNone: () => Promise.reject(EgressDenied.make({})),
        onSome: (decisionHash) =>
          Promise.resolve()
            .then(() => platformFetch(input, { ...init, redirect: "error" }))
            .then(
              (response) =>
                runInBuildContext(recordOutcome(decisionHash, ExecutionSettlement.Enum.completed)).then(() => response),
              (cause: unknown) =>
                runInBuildContext(recordOutcome(decisionHash, ExecutionSettlement.Enum.failed)).then(() =>
                  Promise.reject(cause)
                )
            ),
      })
    );

  return governedFetch as typeof globalThis.fetch;
});
