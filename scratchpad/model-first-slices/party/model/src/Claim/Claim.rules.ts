import type { Actor } from "@proto/kernel/Actor";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import { Proposition } from "../Proposition.ts";
import { AdmissionGateUnmet, type AdmissionGate } from "./AcceptClaim.command.ts";
// Type-only back-edge: the aggregate imports these guards as values.
import type { ClaimState, Pending } from "./Claim.aggregate.ts";
import { ClaimNotPending } from "./ClaimNotPending.rejection.ts";

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
    Match.orElse((other) => Effect.fail(new ClaimNotPending({ status: other._tag }))),
  );

/**
 * Keep a pending claim only when the actor acts for the claim's org.
 *
 * @category guards
 * @since 0.0.0
 */
export const requireMember =
  (actor: Actor) =>
  (pending: Pending): Effect.Effect<Pending, NotAMember> =>
    Effect.succeed(pending).pipe(
      Effect.filterOrFail(
        (claim) => claim.org === actor.org,
        () => new NotAMember(),
      ),
    );

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
    (gate) => new AdmissionGateUnmet(gate),
  ),
);
