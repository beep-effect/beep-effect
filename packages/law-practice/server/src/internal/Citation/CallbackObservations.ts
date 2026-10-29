/**
 * Issued branch evidence for default callback None results.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationMentionId } from "@beep/law-practice-domain/values";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationCallbackFailure, CitationCallbackResource } from "./CallbackResource.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CallbackObservations");
/**
 * Actual default branch and matched resources, not inferred final membership.
 * Distinct count comes from the source-equivalent candidate set already run.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationDefaultObservation = S.TaggedUnion({
  Unresolved: {
    mentionId: CitationMentionId,
    reason: S.Literals(["missing-antecedent", "no-matching-authority", "no-previous-authority", "invalid-pin-cite"]),
  },
  Ambiguous: {
    mentionId: CitationMentionId,
    distinctCount: S.Natural.check(
      S.isGreaterThanOrEqualTo(2),
      S.isLessThanOrEqualTo(CitationEngineAbsoluteMaxima.authorities)
    ),
    resources: S.Array(CitationCallbackResource).check(
      S.isMinLength(2),
      S.isMaxLength(CitationEngineAbsoluteMaxima.resolutionEdges)
    ),
  },
}).pipe(
  $I.annoteSchema("CitationDefaultObservation", {
    description: "Issued source-branch evidence; candidate resources are not chosen assignments.",
  })
);
/**
 * Schema-derived default branch observation.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationDefaultObservation = typeof CitationDefaultObservation.Type;
const Json = S.fromJsonString(CitationDefaultObservation);
const issued = new WeakMap<object, string>();
const invalid = () => CitationCallbackFailure.make({ reason: "invalid-input" });
/**
 * Return None and bind immutable evidence to that exact callback result object.
 * Copying fields does not transfer issuance; no native key hook runs here.
 * @internal
 * @category capabilities
 * @since 0.0.0
 */
export const issueCitationDefaultNone = Effect.fn("Citation.issueDefaultNone")(function* (
  observation: CitationDefaultObservation
) {
  const json = yield* S.encodeEffect(Json)(observation).pipe(Effect.mapError(invalid));
  const result = { resource: CitationCallbackResource.cases.None.make({}) };
  issued.set(result, json);
  return result;
});
/**
 * Read only evidence issued for the exact result and current occurrence.
 * @internal
 * @category capabilities
 * @since 0.0.0
 */
export const readCitationDefaultObservation = Effect.fn("Citation.readDefaultObservation")(function* (
  result: object,
  mentionId: CitationMentionId
) {
  const json = O.fromUndefinedOr(issued.get(result));
  if (O.isNone(json)) return O.none<CitationDefaultObservation>();
  const observation = yield* S.decodeEffect(Json)(json.value).pipe(Effect.mapError(invalid));
  if (observation.mentionId !== mentionId) return O.none<CitationDefaultObservation>();
  return O.some(observation);
});
