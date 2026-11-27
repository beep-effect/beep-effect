/**
 * Legal position relator policy implementation.
 *
 * **Details**
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
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { LegalPositionRelatorAdmissionError } from "./LegalPositionRelatorPolicy.errors.ts";
import { LegalPositionRelatorPolicy, LegalPositionRelatorPolicyShape } from "./LegalPositionRelatorPolicy.ports.ts";
import { LegalOppositionCandidateInput, LegalPositionRelatorView } from "./LegalPositionRelatorPolicy.values.ts";

const decodeUnknownLegalPositionRelator = S.decodeUnknownEffect(LegalPositionRelator);

const storedPosition = (relator: LegalPositionRelator): HohfeldPosition =>
  HohfeldPosition.make({ content: relator.content, kind: relator.positionKind });

const correlativeViewOf = (relator: LegalPositionRelator): LegalPositionRelatorView =>
  LegalPositionRelatorView.make({
    bearer: relator.counterparty,
    counterparty: relator.bearer,
    position: correlativePosition(storedPosition(relator)),
    relator: relator.id,
    viewKind: "correlative",
  });

const oppositeViewOf = (relator: LegalPositionRelator): LegalPositionRelatorView =>
  LegalPositionRelatorView.make({
    bearer: relator.bearer,
    counterparty: relator.counterparty,
    position: oppositePosition(storedPosition(relator)),
    relator: relator.id,
    viewKind: "opposite",
  });

const scopeOverlap = (left: LegalScopeContext, right: LegalScopeContext): LegalScopeContext =>
  LegalScopeContext.make({
    material: HashSet.intersection(left.material, right.material),
    quantitative: HashSet.intersection(left.quantitative, right.quantitative),
    subjective: HashSet.intersection(left.subjective, right.subjective),
    temporal: HashSet.intersection(left.temporal, right.temporal),
    territorial: HashSet.intersection(left.territorial, right.territorial),
  });

const overlapsOnEveryAxis = (overlap: LegalScopeContext): boolean =>
  A.every(
    [overlap.material, overlap.quantitative, overlap.subjective, overlap.temporal, overlap.territorial],
    (axis) => !HashSet.isEmpty(axis)
  );

// decision: legal-opposition-crosses-the-two-derivations
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

// decision: legal-opposition-crosses-the-two-derivations
const candidateFor = (
  left: LegalPositionRelator,
  right: LegalPositionRelator
): O.Option<LegalOppositionCandidateInput> => {
  const overlap = scopeOverlap(LegalScopeContext.make(left.scope), LegalScopeContext.make(right.scope));
  return overlapsOnEveryAxis(overlap) && isPrimaFacieOpposed(left, right)
    ? LegalOppositionCandidateInput.makeOption({
        act: left.content.description,
        overlappingScope: overlap,
        relators: HashSet.make(left.id, right.id),
      })
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
      return yield* decodeUnknownLegalPositionRelator(record).pipe(
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
 * import * as Layer from "effect/Layer";
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
