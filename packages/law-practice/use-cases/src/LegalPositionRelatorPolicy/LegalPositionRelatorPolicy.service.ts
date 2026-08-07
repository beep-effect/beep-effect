/**
 * Legal position relator policy implementation.
 *
 * Nothing here stores a derived view, and nothing here computes a legal
 * judgment. Admission answers whether a record can be read as a relation, the
 * two views are pure derivations over one stored relation, and the screen
 * answers two set-theoretic questions about recorded values — whether two
 * scopes intersect on every axis, and whether one relation's opposite view
 * coincides with the other's correlative view.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  correlativePosition,
  HohfeldPosition,
  LegalPositionRelator,
  LegalScopeContext,
  legalActContentEquivalence,
  oppositePosition,
} from "@beep/law-practice-domain";
import { Effect, Equal, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { LegalPositionRelatorAdmissionError } from "./LegalPositionRelatorPolicy.errors.ts";
import { LegalPositionRelatorPolicy, LegalPositionRelatorPolicyShape } from "./LegalPositionRelatorPolicy.ports.ts";
import { LegalOppositionCandidateInput, LegalPositionRelatorView } from "./LegalPositionRelatorPolicy.values.ts";

/**
 * Read a stored relation's two position fields back as the pair the
 * derivations are defined over. They are stored apart because only a separate
 * field can carry the advantage-side narrowing, and they are only ever derived
 * over together.
 */
const storedPosition = (relator: LegalPositionRelator): HohfeldPosition =>
  HohfeldPosition.make({ content: relator.content, kind: relator.positionKind });

/**
 * The cross-party reading: the same relation seen from the other end, so the
 * roles swap and the content is carried through untouched.
 */
const correlativeViewOf = (relator: LegalPositionRelator): LegalPositionRelatorView =>
  LegalPositionRelatorView.make({
    bearer: relator.counterparty,
    counterparty: relator.bearer,
    position: correlativePosition(storedPosition(relator)),
    relator: relator.id,
    viewKind: "correlative",
  });

/**
 * The same-party negation: the roles stay where they are, and the position
 * kind and the act polarity move together in one step.
 */
const oppositeViewOf = (relator: LegalPositionRelator): LegalPositionRelatorView =>
  LegalPositionRelatorView.make({
    bearer: relator.bearer,
    counterparty: relator.counterparty,
    position: oppositePosition(storedPosition(relator)),
    relator: relator.id,
    viewKind: "opposite",
  });

/**
 * The five per-axis intersections of two recorded scopes.
 *
 * Each axis is a set of recorded values rather than a range, so overlap is one
 * operation applied five times with no axis-specific algebra. The intersections
 * are computed once and then serve twice: they decide whether the scopes
 * overlap at all, and they are the recorded basis a candidate carries.
 */
const scopeOverlap = (left: LegalScopeContext, right: LegalScopeContext): LegalScopeContext =>
  LegalScopeContext.make({
    material: HashSet.intersection(left.material, right.material),
    quantitative: HashSet.intersection(left.quantitative, right.quantitative),
    subjective: HashSet.intersection(left.subjective, right.subjective),
    temporal: HashSet.intersection(left.temporal, right.temporal),
    territorial: HashSet.intersection(left.territorial, right.territorial),
  });

/**
 * Whether an overlap is non-empty on every one of the five axes. A single empty
 * axis means the two relations were never recorded as applying to the same
 * situation, which is the whole of what this answers.
 */
const overlapsOnEveryAxis = (overlap: LegalScopeContext): boolean =>
  A.every(
    [overlap.material, overlap.quantitative, overlap.subjective, overlap.temporal, overlap.territorial],
    (axis) => !HashSet.isEmpty(axis)
  );

/**
 * Whether one relation's opposite view coincides with the other's correlative
 * view on bearer, counterparty, kind, and content.
 *
 * The comparison is deliberately across the two derivations rather than between
 * the two stored kinds. Every stored kind is advantage-side and every kind's
 * opposite is burden-side, so comparing stored against stored is vacuously
 * false and would silently find nothing at all.
 *
 * Parties are compared by the party each role names, not by the roles
 * themselves: two norms may give the same party differently named roles, and
 * the question here is whether the same two parties are involved.
 *
 * The relation is symmetric — the derivations commute and are involutive, so
 * `opposite(left) = correlative(right)` implies `opposite(right) =
 * correlative(left)` — which is what makes an unordered pair the honest shape
 * for the answer.
 */
const isPrimaFacieOpposed = (left: LegalPositionRelator, right: LegalPositionRelator): boolean => {
  const opposed = oppositeViewOf(left);
  const correlated = correlativeViewOf(right);
  return (
    Equal.equals(opposed.bearer.player, correlated.bearer.player) &&
    Equal.equals(opposed.counterparty.player, correlated.counterparty.player) &&
    Equal.equals(opposed.position.kind, correlated.position.kind) &&
    legalActContentEquivalence(opposed.position.content, correlated.position.content)
  );
};

/**
 * The candidate input for one pair, when both facts hold and not otherwise.
 *
 * The act description is read off the left relation because the two are
 * necessarily equal: the views coincide on content, and neither derivation ever
 * rewrites a description.
 */
const candidateFor = (
  left: LegalPositionRelator,
  right: LegalPositionRelator
): O.Option<LegalOppositionCandidateInput> => {
  const overlap = scopeOverlap(left.scope, right.scope);
  return overlapsOnEveryAxis(overlap) && isPrimaFacieOpposed(left, right)
    ? O.some(
        LegalOppositionCandidateInput.make({
          act: left.content.description,
          overlappingScope: overlap,
          relators: HashSet.make(left.id, right.id),
        })
      )
    : O.none();
};

/**
 * Build the relator policy implementation.
 *
 * **When to use**
 *
 * Use when composing a runtime that reads recorded legal relations. Most
 * callers should take {@link LegalPositionRelatorPolicyLive} instead; this
 * constructor exists so a caller can wrap the shape without re-implementing the
 * derivations.
 *
 * **Details**
 *
 * The screen walks unordered pairs — each relation against every later one —
 * rather than all ordered pairs. That is not an optimisation. Opposition is
 * symmetric, but the burden-side kind the two views coincide on depends on
 * which relation is read as the opposite and which as the correlative, so
 * walking ordered pairs would emit the same conflict twice under two different
 * readings.
 *
 * **Example** (Screen through the constructed shape)
 *
 * ```ts
 * import { makeLegalPositionRelatorPolicy } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(HashSet.size(makeLegalPositionRelatorPolicy().screenForOpposition([]))) // 0
 * ```
 *
 * @returns The relator policy service shape.
 * @category constructors
 * @since 0.0.0
 */
export const makeLegalPositionRelatorPolicy = (): LegalPositionRelatorPolicyShape =>
  LegalPositionRelatorPolicyShape.make({
    admit: Effect.fn("LegalPositionRelatorPolicy.admit")(function* (record: unknown) {
      return yield* S.decodeUnknownEffect(LegalPositionRelator)(record).pipe(
        Effect.mapError(LegalPositionRelatorAdmissionError.fromSchemaError)
      );
    }),
    correlativeView: correlativeViewOf,
    oppositeView: oppositeViewOf,
    screenForOpposition: (relators) =>
      HashSet.fromIterable(
        A.getSomes(
          A.flatMap(relators, (left, index) => A.map(A.drop(relators, index + 1), (right) => candidateFor(left, right)))
        )
      ),
  });

/**
 * Layer providing the relator policy.
 *
 * **Details**
 *
 * The layer has no dependencies and needs none: admission is a schema question,
 * both views are pure derivations over one stored relation, and the screen reads
 * only the relations its caller hands it. Nothing here reaches for a store, a
 * clock, or any capability outside this slice.
 *
 * **Example** (Provide the policy)
 *
 * ```ts
 * import { LegalPositionRelatorPolicyLive } from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(LegalPositionRelatorPolicyLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LegalPositionRelatorPolicyLive: Layer.Layer<LegalPositionRelatorPolicy> = Layer.succeed(
  LegalPositionRelatorPolicy,
  makeLegalPositionRelatorPolicy()
);
