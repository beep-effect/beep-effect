/**
 * Governed egress: the destination boundary for outbound HTTP.
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
import { EpistemicConfig, resolveSinkAudience } from "@beep/epistemic-config/server";
import {
  ExecutionGrant,
  ExecutionSink,
  GrantBudget,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  destinationDigestOf,
  digestForLedger,
  ExecutionRunKey,
  ExecutionSettlement,
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
import {
  DraftGrantSet,
  ExecutionRequestEvaluationOptions,
  evaluateExecutionRequest,
  freezeGrantSet,
} from "@beep/epistemic-domain/values/GrantSet";
import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import { $EpistemicServerId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import { A, O } from "@beep/utils";
import { DateTime, Duration, Effect, Ref, Semaphore } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DecisionRecordHash } from "@beep/epistemic-domain/values/ExecutionRecord";

const $I = $EpistemicServerId.create("GovernedEgress/GovernedEgress.fetch");
// The settlement write happens *after* the request has already gone out, so it
// can never fail the fetch — but an unbounded one would hold the caller's
// response hostage to a stalled ledger. This bound is what makes "best effort"
// literally true. It is deliberately generous: a measured PGlite write-ahead
// append is ~2ms, so a second is roughly 500x headroom and a timeout here means
// the ledger is genuinely unwell rather than merely busy.
//
// The cost of exceeding it is real and is why it is not tighter: the decision
// stays allowed-with-no-outcome, which `readUnsettledAllowed` reports as
// "decided, outcome unknown". That is the honest answer — the request did go
// out and we cannot say how it ended — and the dropped write is logged at
// warning with its cause.
const outcomeAppendTimeout = Duration.seconds(1);

/**
 * Session-static inputs the composition root supplies to the governed egress
 * boundary. The destinations themselves are never passed here — they come from
 * `EpistemicConfig`, so the allowlist has exactly one owner.
 *
 * **Example** (Usage)
 * ```ts
 * import { GovernedEgressOptions } from "@beep/epistemic-server/GovernedEgress"
 * import { GrantOperation, GrantPurpose, GrantResource } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration } from "effect"
 *
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
export class GovernedEgressOptions extends S.Class<GovernedEgressOptions>($I`GovernedEgressOptions`)(
  {
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
  },
  $I.annote("GovernedEgressOptions", {
    description: "Session-static inputs the composition root supplies to the governed egress boundary.",
  })
) {
  static readonly is = S.is(GovernedEgressOptions);
}

const egressPrincipal = SystemPrincipal.make({ component: "Runtime", kind: "System" });

// Canonical form for *coverage comparison*: origin plus path, with any trailing
// slash removed and the query deliberately dropped — a query string must never
// widen or narrow what an allowlist entry covers. Parsing through `URL` is what
// makes the comparison safe: `https://allowed.example@evil.test/` and
// `https://allowed.example:443` both normalize to the origin they actually
// resolve to, not the one they read like.
const canonicalize = (value: string): O.Option<string> => {
  try {
    const url = new URL(value);
    return O.some(`${url.origin}${Str.replace(/\/+$/, "")(url.pathname)}`);
  } catch {
    return O.none();
  }
};

// Canonical form for the *record*, which keeps the query and fragment. These
// are dropped from coverage on purpose but must survive into the decision row:
// an agent can carry a payload out in a query string under an allowed prefix,
// and if the row named only the allowlist entry, that request would be
// byte-identical in the ledger to a benign one. Only the digest is stored, so
// recording the full form reveals nothing an auditor could not already see.
const canonicalizeForRecord = (value: string): O.Option<string> => {
  try {
    const url = new URL(value);
    return O.some(`${url.origin}${Str.replace(/\/+$/, "")(url.pathname)}${url.search}${url.hash}`);
  } catch {
    return O.none();
  }
};

// An allowlist entry covers itself and everything beneath it, and nothing else.
// The `/` boundary is the whole point: a bare `startsWith` would let
// `https://allowed.example.evil.test` match an `https://allowed.example` entry.
const coveredBy = (entry: string, requested: string): boolean =>
  requested === entry || Str.startsWith(`${entry}/`)(requested);

/**
 * Build the governed egress `fetch`.
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
 * **Example** (Usage)
 * ```ts
 * import { GovernedEgressOptions, makeGovernedEgressFetch } from "@beep/epistemic-server/GovernedEgress"
 * import { GrantOperation, GrantPurpose, GrantResource } from "@beep/epistemic-domain/values/ExecutionGrant"
 * import { Duration, Effect } from "effect"
 *
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
export const makeGovernedEgressFetch = Effect.fn("Epistemic.GovernedEgress.make")(function* (
  options: GovernedEgressOptions,
  baseFetch?: typeof globalThis.fetch
) {
  const config = yield* EpistemicConfig;
  const ledger = yield* ExecutionLedger;
  const frozenAt = yield* DateTime.now;
  const expiresAt = DateTime.add(frozenAt, { milliseconds: Duration.toMillis(options.grantTtl) });

  // One grant per allowed destination. An entry that does not parse as a URL is
  // dropped rather than granted: a malformed entry must never be able to buy
  // authority, and the drop is logged so it is not silent.
  const entries = A.getSomes(A.map(config.destinationAllowlist, canonicalize));
  yield* A.length(entries) === A.length(config.destinationAllowlist)
    ? Effect.void
    : Effect.logWarning("governed egress dropped unparseable destination allowlist entries").pipe(
        Effect.annotateLogs({
          dropped: A.length(config.destinationAllowlist) - A.length(entries),
          subsystem: "epistemic_governed_egress",
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
        // Derived from the destination, never declared: a caller that could
        // name its own audience would name the friendlier one.
        audience: resolveSinkAudience(destination),
        destination,
        sinkClass: "network-egress",
      }),
    });
  });
  const frozen = freezeGrantSet(DraftGrantSet.make({ grants, policyRevision: config.policyRevision }), frozenAt);
  const runKey = ExecutionRunKey.make(
    digestForLedger(`epistemic-egress/${DateTime.toEpochMillis(frozenAt)}/${frozen.digest}`)
  );
  const chain = yield* Ref.make({ lastHash: O.none<DecisionRecordHash>(), nextSeq: 0 });
  const lock = yield* Semaphore.make(1);

  // Resolve the requested URL to the allowlist entry that covers it, so the
  // evaluator's exact-match comparison stays exact. An uncovered URL is carried
  // through as its own canonical form, which matches no grant and is therefore
  // denied with the destination recorded as what was actually attempted.
  const destinationFor = (requested: string): SinkDestination => {
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
        subsystem: "epistemic_governed_egress",
      })
    );

  const authorize = Effect.fn("Epistemic.GovernedEgress.authorize")(function* (requested: string) {
    const now = yield* DateTime.now;
    const destination = destinationFor(requested);
    // The evaluator compares against the covering allowlist entry, but the row
    // records what was actually asked for, query and all. Recording the entry
    // would make an exfiltration under an allowed prefix
    // (`.../publish?payload=…`) indistinguishable in the ledger from a benign
    // publish to that same prefix.
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
          seq: NonNegativeInt.make(state.nextSeq),
          sinkClass: request.sinkClass,
        };
        const record = sealExecutionDecision(
          ExecutionVerdict.match(verdict, {
            allowed: () => ({ ...common, verdict: "allowed" as const }),
            denied: ({ reason }) => ({ ...common, reason, verdict: "denied" as const }),
          })
        );
        // Uninterruptible for the same reason the gate's append is: an
        // interruption between a successful append and the chain advance would
        // strand the run on a sequence slot the ledger already holds.
        const appended = yield* Effect.uninterruptible(
          ledger.appendDecision(record).pipe(
            Effect.andThen(Ref.set(chain, { lastHash: O.some(record.hash), nextSeq: state.nextSeq + 1 })),
            Effect.as(true),
            Effect.catchCause((cause) =>
              Effect.logError("governed egress could not write the write-ahead decision").pipe(
                Effect.annotateLogs({ cause, subsystem: "epistemic_governed_egress" }),
                Effect.as(false)
              )
            )
          )
        );
        if (!appended) {
          // No record, no request — the same fail-closed rule the gate applies.
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

  const recordOutcome = Effect.fn("Epistemic.GovernedEgress.recordOutcome")(function* (
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
            subsystem: "epistemic_governed_egress",
          })
        )
      )
    );
  });

  const platformFetch = baseFetch ?? globalThis.fetch;
  // The authorization runs detached from whatever fiber called `fetch`, because
  // `fetch` is a plain function and there is no fiber to inherit from. Running
  // it *with* the build context is what keeps the boundary's own logs and spans
  // inside the application's logger and tracer instead of a bare default
  // runtime — the decision log is the only place a denial's reason survives.
  const runInContext = Effect.runPromiseWith(yield* Effect.context<never>());

  // `Fetch` is `typeof globalThis.fetch`, so the contract is a promise-returning
  // function and this cannot be an Effect. It is written as a `.then` chain
  // rather than an `async` function so the boundary needs no diagnostic
  // suppression to exist.
  //
  // Redirects are refused rather than followed. `fetch` follows them by
  // default, which would let an allowlisted destination hand the request to any
  // host it likes *after* the check passed — the authorization would cover the
  // first hop only. `error` makes the redirect itself the failure, so an
  // operator who allowlists a host that redirects gets a broken publish rather
  // than a silent one to somewhere they never named.
  const governedFetch = (
    input: Parameters<typeof globalThis.fetch>[0],
    init?: Parameters<typeof globalThis.fetch>[1]
  ): Promise<Response> =>
    runInContext(authorize(input instanceof Request ? input.url : String(input))).then(
      O.match({
        onNone: () => Promise.reject(EgressDenied.make({})),
        onSome: (decisionHash) =>
          Promise.resolve()
            .then(() => platformFetch(input, { ...init, redirect: "error" }))
            .then(
              (response) =>
                runInContext(recordOutcome(decisionHash, ExecutionSettlement.Enum.completed)).then(() => response),
              (cause: unknown) =>
                runInContext(recordOutcome(decisionHash, ExecutionSettlement.Enum.failed)).then(() =>
                  Promise.reject(cause)
                )
            ),
      })
    );

  return governedFetch as typeof globalThis.fetch;
});
