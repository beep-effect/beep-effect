/**
 * Claim projection.
 *
 * The signature is the federation invariant: a pure, read-only fold from a
 * single-owner authority array into a deterministic read model. It takes a local
 * authority array and returns a view — it has no write capability and no central
 * store, and rebuilding from the same authority yields a structurally-equal view.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as DomainCandidateClaim from "@beep/epistemic-domain/entities/CandidateClaim";
import { ClaimLifecycle, ClaimProjectionView } from "@beep/epistemic-domain/values";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import { Order, pipe } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("ClaimProjection/ClaimProjection");

/**
 * Executable pure read-only projection contract from a single-owner authority
 * array of candidate claims to a deterministic {@link ClaimProjectionView}.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ClaimProjection, projectClaims } from "@beep/epistemic-use-cases/ClaimProjection"
 * import * as S from "effect/Schema"
 *
 * const project = S.decodeUnknownSync(ClaimProjection)(projectClaims)
 *
 * strictEqual(project([]).total, 0)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const ClaimProjection = Fn({
  input: S.Array(DomainCandidateClaim.CandidateClaim.pipe(S.toType)),
  output: ClaimProjectionView,
}).pipe(
  $I.annoteSchema("ClaimProjection", {
    description: "Pure read-only projection from candidate-claim authority to deterministic read model.",
  })
);

/**
 * Runtime type for {@link ClaimProjection}.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { projectClaims, type ClaimProjection } from "@beep/epistemic-use-cases/ClaimProjection"
 *
 * const project: ClaimProjection = projectClaims
 *
 * strictEqual(project([]).total, 0)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export type ClaimProjection = typeof ClaimProjection.Type;

/**
 * Deterministic pure projection implementation. Counts claims per lifecycle
 * state and lists the admitted claims' fixture keys in sorted order so rebuilds
 * from the same authority are structurally equal.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { projectClaims } from "@beep/epistemic-use-cases/ClaimProjection"
 *
 * strictEqual(projectClaims([]).counts.admitted, 0)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const projectClaims: ClaimProjection = ClaimProjection.implementSync((authority) => {
  const countOf = (state: DomainCandidateClaim.CandidateClaim["lifecycle"]): number =>
    A.length(A.filter(authority, (claim) => claim.lifecycle === state));
  const admittedKeys = pipe(
    authority,
    A.filter((claim) => claim.lifecycle === ClaimLifecycle.Enum.admitted),
    A.map((claim) => claim.fixtureKey),
    A.sort(Order.String)
  );
  const counts = R.fromEntries(A.map(ClaimLifecycle.Options, (state) => [state, countOf(state)] as const));

  // decode brands the folded counts/total into NonNegativeInt from known-good plain numbers.
  return S.decodeUnknownSync(ClaimProjectionView)({
    total: A.length(authority),
    counts,
    admittedKeys,
  });
});
