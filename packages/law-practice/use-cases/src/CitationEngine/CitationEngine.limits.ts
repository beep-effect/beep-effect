/**
 * Schema-owned absolute ceilings and explicitly supplied citation policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.limits");

/**
 * Non-configurable per-operation/per-service ceilings used by the schemas.
 *
 * **Details**
 *
 * Counts are integers. Duration ceilings are expressed in milliseconds here;
 * decoded policy values use Duration. Queue/concurrency ceilings apply to one
 * composed engine Layer. No ambient configuration can increase these values.
 *
 * **Example** (Inspect the canonical source ceiling)
 *
 * ```ts
 * import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineAbsoluteMaxima.sourceUtf16) // 1000000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CitationEngineAbsoluteMaxima = Object.freeze({
  sourceUtf16: 1_000_000,
  tokens: 1_000_000,
  candidates: 100_000,
  mentions: 25_000,
  authorities: 25_000,
  patterns: 16_384,
  patternUtf16: 8_192,
  patternEvaluations: 1_000_000,
  patternMatches: 250_000,
  resolutionEdges: 1_000_000,
  resolutionIterations: 1_000_000,
  annotationReplacements: 25_000,
  annotationOutputUtf16: 4_000_000,
  annotationGrowthUtf16: 1_000_000,
  producedTextUtf16: 8_000_000,
  diffInputUtf16: 4_000_000,
  diffSteps: 2_000_000,
  processMessageBytes: 32_000_000,
  concurrentOperations: 2,
  concurrentRegexProcesses: 2,
  queuedOperations: 16,
  cleanDeadlineMillis: 30_000,
  extractDeadlineMillis: 30_000,
  resolveDeadlineMillis: 30_000,
  annotateDeadlineMillis: 30_000,
  operationDeadlineMillis: 60_000,
  regexDeadlineMillis: 1_000,
  queueDeadlineMillis: 5_000,
  cleanupDeadlineMillis: 5_000,
});
const max = CitationEngineAbsoluteMaxima;
const count = (name: string, maximum: number) =>
  S.Natural.check(S.isBetween({ minimum: 1, maximum })).pipe(
    $I.annoteSchema(name, {
      description: `Positive integer budget, at most ${maximum}; exhaustion fails rather than truncates.`,
    })
  );
const deadline = (name: string, maximum: number) =>
  S.DurationFromMillis.check(
    S.makeFilter(
      (duration) =>
        Duration.isFinite(duration) &&
        Duration.between(duration, { minimum: Duration.millis(1), maximum: Duration.millis(maximum) }) &&
        duration.pipe(Duration.toMillis, S.is(S.Natural)),
      $I.annote(name, {
        description: `Finite whole-millisecond deadline from 1 to ${maximum} ms.`,
        message: "Deadline must be finite whole milliseconds within the absolute ceiling.",
      })
    )
  ).pipe($I.annoteSchema(name, { description: `Duration decoded from whole milliseconds, at most ${maximum} ms.` }));
const CountFields = {
  sourceUtf16: count("SourceUtf16Budget", max.sourceUtf16),
  tokens: count("TokenBudget", max.tokens),
  candidates: count("CandidateBudget", max.candidates),
  mentions: count("MentionBudget", max.mentions),
  authorities: count("AuthorityBudget", max.authorities),
  patterns: count("PatternBudget", max.patterns),
  patternUtf16: count("PatternUtf16Budget", max.patternUtf16),
  patternEvaluations: count("PatternEvaluationBudget", max.patternEvaluations),
  patternMatches: count("PatternMatchBudget", max.patternMatches),
  resolutionEdges: count("ResolutionEdgeBudget", max.resolutionEdges),
  resolutionIterations: count("ResolutionIterationBudget", max.resolutionIterations),
  annotationReplacements: count("AnnotationReplacementBudget", max.annotationReplacements),
  annotationOutputUtf16: count("AnnotationOutputBudget", max.annotationOutputUtf16),
  annotationGrowthUtf16: count("AnnotationGrowthBudget", max.annotationGrowthUtf16),
  producedTextUtf16: count("ProducedTextBudget", max.producedTextUtf16),
  diffInputUtf16: count("DiffInputBudget", max.diffInputUtf16),
  diffSteps: count("DiffStepBudget", max.diffSteps),
  processMessageBytes: count("ProcessMessageBudget", max.processMessageBytes),
  concurrentOperations: count("OperationConcurrencyBudget", max.concurrentOperations),
  concurrentRegexProcesses: count("RegexProcessConcurrencyBudget", max.concurrentRegexProcesses),
  queuedOperations: count("OperationQueueBudget", max.queuedOperations),
};
const DeadlineFields = {
  cleanDeadline: deadline("CleanDeadline", max.cleanDeadlineMillis),
  extractDeadline: deadline("ExtractDeadline", max.extractDeadlineMillis),
  resolveDeadline: deadline("ResolveDeadline", max.resolveDeadlineMillis),
  annotateDeadline: deadline("AnnotateDeadline", max.annotateDeadlineMillis),
  operationDeadline: deadline("OperationDeadline", max.operationDeadlineMillis),
  regexDeadline: deadline("RegexDeadline", max.regexDeadlineMillis),
  queueDeadline: deadline("QueueDeadline", max.queueDeadlineMillis),
  cleanupDeadline: deadline("CleanupDeadline", max.cleanupDeadlineMillis),
};

/**
 * Complete decoded budgets enforced by every citation operation.
 *
 * **Details**
 *
 * Count equality at a ceiling is allowed; attempting the next unit fails. Work
 * counters include discarded candidates and unsuccessful pattern evaluations.
 * Output growth counts only positive growth. Produced text includes repeated
 * material, bounding allocation before serialization. Duration codecs preserve
 * whole milliseconds exactly in both directions and reject non-finite values.
 *
 * **Example** (Guard a decoded budget object)
 *
 * ```ts
 * import { CitationEngineLimits } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationEngineLimits)({})) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CitationEngineLimits extends S.Opaque<CitationEngineLimits, { readonly brand: unique symbol }>()(
  S.Struct({ ...CountFields, ...DeadlineFields }).pipe(
    $I.annoteSchema("CitationEngineLimits", {
      description:
        "Complete finite citation budgets bounded by non-configurable absolute ceilings; durations encode as milliseconds.",
    })
  )
) {}

/**
 * Explicit Layer-construction policy; it has no ambient configuration defaults.
 *
 * **Example** (Reject an unknown execution mode)
 *
 * ```ts
 * import { CitationEngineEffectivePolicy } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationEngineEffectivePolicy)({ execution: "unbounded" })) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CitationEngineEffectivePolicy extends S.Opaque<
  CitationEngineEffectivePolicy,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("citation-engine-policy/v1"),
    execution: S.tag("isolated-process"),
    limits: CitationEngineLimits,
  }).pipe(
    $I.annoteSchema("CitationEngineEffectivePolicy", {
      description:
        "Explicit decoded limits for one composed Layer using force-stoppable regex processes; no environment reads.",
    })
  )
) {}
const Tightening = S.Struct({ effective: CitationEngineEffectivePolicy, requested: CitationEngineLimits });

/**
 * Validates that request-local limits only tighten the supplied Layer policy.
 *
 * **Details**
 *
 * Each count and Duration is compared independently. The runtime uses the
 * earliest applicable deadline; a tighter operation budget cannot be extended
 * by a later stage deadline. This schema is a data relation, not an engine
 * method or an exception translator.
 *
 * **Example** (Reject a missing effective policy)
 *
 * ```ts
 * import { CitationEngineLimitTightening } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(S.is(CitationEngineLimitTightening)({})) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CitationEngineLimitTightening extends S.Opaque<
  CitationEngineLimitTightening,
  { readonly brand: unique symbol }
>()(
  Tightening.check(
    S.makeFilter(
      ({ effective, requested }: typeof Tightening.Type) =>
        A.every(R.keys(CountFields), (key) => requested[key] <= effective.limits[key]) &&
        A.every(R.keys(DeadlineFields), (key) => Duration.isLessThanOrEqualTo(requested[key], effective.limits[key])),
      $I.annote("RequestLimitTightening", {
        description: "A request may retain or reduce every effective limit, never increase it.",
        message: "Requested limits exceed the effective Layer policy.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationEngineLimitTightening", {
      description: "Schema-owned componentwise count/Duration tightening relative to an explicit decoded Layer policy.",
    })
  )
) {}
