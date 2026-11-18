import { type Capability, ResourceScope } from "@proto/kernel/Capability";
import { type CurrentInvocation, requireGrant } from "@proto/kernel/CurrentInvocation.context";
import type { OrgId, RunId } from "@proto/kernel/Ids";
import type { Invocation } from "@proto/kernel/Invocation";
import type { MissingGrant } from "@proto/kernel/MissingGrant.rejection";
import { AdmissionGateUnmet, type AdmissionGate } from "@proto/party-contract/Claim/AcceptClaim.command";
import type { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimNotPending } from "@proto/party-contract/Claim/ClaimNotPending.rejection";
import { Proposition } from "@proto/party-contract/Proposition";
import * as A from "effect/Array";
import type * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import { reviewRun } from "../Review/ReviewPlan.ts";
// Type-only back-edge: the aggregate imports these guards as values.
import type { ClaimState, Pending } from "./Claim.aggregate.ts";

/**
 * The claim narrowed to `Pending`, or the rejection every decision on a
 * non-pending claim returns. Each `decide` that acts on a pending claim
 * starts from it.
 *
 * @category guards
 * @since 0.0.0
 */
export const requirePending = (state: ClaimState): Effect.Effect<Pending, ClaimNotPending> =>
  // `Match` on `_tag`, not `ClaimState.match`: the schema value lives in the
  // aggregate's file, which imports this one, so the dependency stays type-only.
  Match.value(state).pipe(
    Match.tag("Pending", (pending) => Effect.succeed(pending)),
    Match.orElse((other) => Effect.fail(ClaimNotPending.make({ status: other._tag }))),
  );

/**
 * The invocation, when a grant covers the operation on this claim; checked
 * before anything about the claim's state is revealed. A claim nobody has
 * asserted has no org to check, so it answers `ClaimNotPending` alone.
 *
 * @category guards
 * @since 0.0.0
 */
export const requireGranted = ({
  capability,
  operation,
  state,
  stream,
  at,
}: {
  readonly capability: Capability;
  readonly operation: string;
  readonly state: ClaimState;
  readonly stream: string;
  readonly at: DateTime.Utc;
}): Effect.Effect<Invocation, ClaimNotPending | MissingGrant, CurrentInvocation> =>
  Match.value(state).pipe(
    Match.tag("Unasserted", () => Effect.fail(ClaimNotPending.make({ status: "Unasserted" }))),
    Match.orElse((known) => requireGrant(capability, operation, claimIn(known.org, stream), at)),
  );

/**
 * The resource a decision on one claim touches: its stream, in its org. A
 * grant on the org or on this one record covers it.
 *
 * @category rules
 * @since 0.0.0
 */
export const claimIn: {
  (stream: string): (org: OrgId) => ResourceScope;
  (org: OrgId, stream: string): ResourceScope;
} = dual(2, (org: OrgId, stream: string): ResourceScope => ResourceScope.cases.Record.make({ org, record: stream }));

/**
 * The admission gate a pending claim's proposition must clear: which gate,
 * how many independent sources it has, and how many it needs. Two signals
 * from one source count once.
 *
 * @category rules
 * @since 0.0.0
 */
export const admission = (
  pending: Pending,
): { readonly gate: AdmissionGate; readonly have: number; readonly need: number } => {
  const have = HashSet.size(HashSet.fromIterable(A.map(pending.signals, (signal) => signal.source)));
  return Proposition.match(pending.proposition, {
    SameParty: () => ({ gate: "independent-corroboration" as const, have, need: 2 }),
    HasIdentifier: () => ({ gate: "source-support" as const, have, need: 1 }),
  });
};

/**
 * The gate, when the claim clears it; otherwise `AdmissionGateUnmet` with the counts.
 *
 * @category guards
 * @since 0.0.0
 */
export const requireAdmission: (
  pending: Pending,
) => Effect.Effect<ReturnType<typeof admission>, AdmissionGateUnmet> = flow(
  admission,
  Effect.succeed,
  Effect.filterOrFail(
    (gate) => gate.have >= gate.need,
    (gate) => AdmissionGateUnmet.make(gate),
  ),
);

/**
 * A decision's scope as a decision event carries it.
 *
 * @category models
 * @since 0.0.0
 */
export type DecisionScope = { readonly org: O.Option<OrgId>; readonly reviewRuns: O.Option<ReadonlyArray<RunId>> };

/**
 * A decision's scope (D43): the pending claim's org, and every review run
 * asked for it, `review:<claim>:1` to `review:<claim>:<reviews>` in order.
 * Each decision event carries it, so the published fact needs nothing else.
 *
 * **Example** (The scope of a claim with one review)
 * ```ts
 * import { scopeOf } from "@proto/party-model/Claim/Claim.rules";
 * import { ClaimState } from "@proto/party-model/Claim/Claim.aggregate";
 * import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
 * import { OrgId } from "@proto/kernel/Ids";
 * import { Proposition } from "@proto/party-contract/Proposition";
 * import { PartyId } from "@proto/party-contract/Party/Party.id";
 * import * as O from "effect/Option";
 *
 * const pending = ClaimState.cases.Pending.make({
 *   org: OrgId.make("org_acme"),
 *   proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" }),
 *   signals: [],
 *   revision: 1,
 *   reviews: 1,
 *   proposal: O.none(),
 * });
 * const scope = scopeOf(ClaimId.make("claim_1"), pending);
 * ```
 *
 * @category rules
 * @since 0.0.0
 */
export const scopeOf: {
  (pending: Pending): (claim: ClaimId) => DecisionScope;
  (claim: ClaimId, pending: Pending): DecisionScope;
} = dual(2, (claim: ClaimId, pending: Pending): DecisionScope => ({
  org: O.some(pending.org),
  reviewRuns: O.some(
    A.unfold(1, (n) => (n > pending.reviews ? O.none() : O.some([reviewRun(claim, n), n + 1] as const))),
  ),
}));
