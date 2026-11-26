/**
 * Instrument declarations owned by `@beep/nlp-processing`: the
 * `Operation.run` span with its activity attributes and the `beep.nlp.*`
 * metrics.
 *
 * **Details**
 *
 * The repo catalog command merges this file with every other package's
 * `*.instruments.ts` file. Every metric label here is static or bounded:
 * workflow runs count by `beep.outcome`, cache lookups by
 * `beep.nlp.cache_result` and backend fallbacks and failures by
 * `beep.nlp.cause_classification`. Activity ids and counts are unbounded, so
 * they ride spans only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $NlpProcessingId } from "@beep/identity/packages";
import { ActivityOutcome } from "@beep/jsonc/ActivityRecord";
import { CauseClassification } from "@beep/observability/CauseDiagnostics";
import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  MetricInstrument,
  MetricName,
  PackageName,
  SignalKind,
  SpanInstrument,
  SpanName,
  UcumUnit,
} from "@beep/observability/catalog";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import type * as A from "effect/Array";

const $I = $NlpProcessingId.create("NlpProcessing.instruments");

const owner = PackageName.make("@beep/nlp-processing");

const spanAndMetric: A.NonEmptyReadonlyArray<SignalKind> = [SignalKind.Enum.span, SignalKind.Enum.metric];

/**
 * **Example** (Read a cache result spelling)
 *
 * ```ts import.meta.vitest name="Read a cache result spelling"
 * import { NlpCacheResult } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpCacheResult.Enum.hit // => "hit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NlpCacheResult = LiteralKit(["hit", "miss"]).pipe(
  $I.annoteSchema("NlpCacheResult", { description: "Whether an NLP cache lookup found its entry." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type NlpCacheResult = typeof NlpCacheResult.Type;

/**
 * Attribute key `beep.package`, declared by `@beep/observability`.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the package key"
 * import { PackageAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * PackageAttribute // => "beep.package"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PackageAttribute = AttributeKeyName.make("beep.package");

/**
 * Attribute key `beep.outcome`, declared by `@beep/observability` and
 * stamped by `observeWorkflow` on its outcomes counter.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the outcome key"
 * import { OutcomeAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * OutcomeAttribute // => "beep.outcome"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OutcomeAttribute = AttributeKeyName.make("beep.outcome");

/**
 * Attribute key carrying {@link NlpCacheResult}.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the cache result key"
 * import { CacheResultAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * CacheResultAttribute // => "beep.nlp.cache_result"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CacheResultAttribute = AttributeKeyName.make("beep.nlp.cache_result");

/**
 * Attribute key carrying the cause classification of an NLP failure or
 * backend fallback.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the cause classification key"
 * import { CauseClassificationAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * CauseClassificationAttribute // => "beep.nlp.cause_classification"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CauseClassificationAttribute = AttributeKeyName.make("beep.nlp.cause_classification");

/**
 * Attribute key carrying the operation term IRI an attributed run ran.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the operation term key"
 * import { OperationTermAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * OperationTermAttribute // => "beep.operation.term"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OperationTermAttribute = AttributeKeyName.make("beep.operation.term");

/**
 * Attribute key carrying the `activity/v1` id of an attributed run.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the activity id key"
 * import { ActivityIdAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * ActivityIdAttribute // => "beep.activity.id"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ActivityIdAttribute = AttributeKeyName.make("beep.activity.id");

/**
 * Attribute key carrying how many entities an attributed run used.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the used count key"
 * import { ActivityUsedCountAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * ActivityUsedCountAttribute // => "beep.activity.used_count"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ActivityUsedCountAttribute = AttributeKeyName.make("beep.activity.used_count");

/**
 * Attribute key carrying how many entities an attributed run generated.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the generated count key"
 * import { ActivityGeneratedCountAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * ActivityGeneratedCountAttribute // => "beep.activity.generated_count"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ActivityGeneratedCountAttribute = AttributeKeyName.make("beep.activity.generated_count");

/**
 * Attribute key carrying how an attributed run ended.
 *
 * **Example** (Read the key)
 *
 * ```ts import.meta.vitest name="Read the activity outcome key"
 * import { ActivityOutcomeAttribute } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * ActivityOutcomeAttribute // => "beep.activity.outcome"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ActivityOutcomeAttribute = AttributeKeyName.make("beep.activity.outcome");

/**
 * The `Operation.run` span: one attributed operation run.
 *
 * **Example** (Read the span name)
 *
 * ```ts import.meta.vitest name="Read the span name"
 * import { OperationRunSpan } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * OperationRunSpan.name // => "Operation.run"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OperationRunSpan = SpanInstrument.make({
  name: SpanName.make("Operation.run"),
  owner,
  family: "foundation",
  attributes: [
    OperationTermAttribute,
    ActivityIdAttribute,
    ActivityUsedCountAttribute,
    ActivityGeneratedCountAttribute,
    ActivityOutcomeAttribute,
  ],
  minTier: "standard",
  description: "Runs one attributed operation and records its prov activity.",
  kind: "internal",
});

/**
 * The `beep.nlp.workflow_runs` counter: NLP workflow runs by lifecycle
 * outcome.
 *
 * **Example** (Read the metric name)
 *
 * ```ts import.meta.vitest name="Read the workflow runs name"
 * import { NlpWorkflowRuns } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpWorkflowRuns.name // => "beep.nlp.workflow_runs"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpWorkflowRuns = MetricInstrument.make({
  name: MetricName.make("beep.nlp.workflow_runs"),
  owner,
  attributes: [PackageAttribute, OutcomeAttribute],
  minTier: "shape-only",
  description: "NLP workflow runs, counted once when started and once per terminal outcome.",
  kind: "counter",
  unit: UcumUnit.make("{run}"),
});

/**
 * The `beep.nlp.workflow_duration` histogram: wall time of one NLP workflow.
 *
 * **Example** (Read the metric unit)
 *
 * ```ts import.meta.vitest name="Read the workflow duration unit"
 * import { NlpWorkflowDuration } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpWorkflowDuration.unit // => "ms"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpWorkflowDuration = MetricInstrument.make({
  name: MetricName.make("beep.nlp.workflow_duration"),
  owner,
  attributes: [PackageAttribute],
  minTier: "shape-only",
  description: "Wall time of one NLP workflow.",
  kind: "histogram",
  unit: UcumUnit.make("ms"),
});

/**
 * The `beep.nlp.operation_duration` histogram: wall time of one NLP step.
 *
 * **Example** (Read the metric unit)
 *
 * ```ts import.meta.vitest name="Read the operation duration unit"
 * import { NlpOperationDuration } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpOperationDuration.unit // => "ms"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpOperationDuration = MetricInstrument.make({
  name: MetricName.make("beep.nlp.operation_duration"),
  owner,
  attributes: [PackageAttribute],
  minTier: "shape-only",
  description: "Wall time of one NLP step inside a workflow.",
  kind: "histogram",
  unit: UcumUnit.make("ms"),
});

/**
 * The `beep.nlp.cache_lookups` counter: NLP cache lookups by result.
 *
 * **Example** (Read the metric name)
 *
 * ```ts import.meta.vitest name="Read the cache lookups name"
 * import { NlpCacheLookups } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpCacheLookups.name // => "beep.nlp.cache_lookups"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpCacheLookups = MetricInstrument.make({
  name: MetricName.make("beep.nlp.cache_lookups"),
  owner,
  attributes: [PackageAttribute, CacheResultAttribute],
  minTier: "shape-only",
  description: "NLP backend cache lookups, labelled hit or miss.",
  kind: "counter",
  unit: UcumUnit.make("{lookup}"),
});

/**
 * The `beep.nlp.backend_fallbacks` counter: primary backend failures that
 * fell back to the secondary backend.
 *
 * **Example** (Read the metric name)
 *
 * ```ts import.meta.vitest name="Read the backend fallbacks name"
 * import { NlpBackendFallbacks } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpBackendFallbacks.name // => "beep.nlp.backend_fallbacks"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpBackendFallbacks = MetricInstrument.make({
  name: MetricName.make("beep.nlp.backend_fallbacks"),
  owner,
  attributes: [PackageAttribute, CauseClassificationAttribute],
  minTier: "shape-only",
  description: "Primary NLP backend failures that fell back to the secondary backend.",
  kind: "counter",
  unit: UcumUnit.make("{fallback}"),
});

/**
 * The `beep.nlp.failures` counter: NLP failures recorded by cause
 * classification.
 *
 * **Example** (Read the metric name)
 *
 * ```ts import.meta.vitest name="Read the failures name"
 * import { NlpFailures } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpFailures.name // => "beep.nlp.failures"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpFailures = MetricInstrument.make({
  name: MetricName.make("beep.nlp.failures"),
  owner,
  attributes: [PackageAttribute, CauseClassificationAttribute],
  minTier: "shape-only",
  description: "NLP failures, labelled by cause classification.",
  kind: "counter",
  unit: UcumUnit.make("{failure}"),
});

/**
 * NLP processing declarations: the cache result, cause classification,
 * operation term and activity keys, the `Operation.run` span and the six
 * `beep.nlp.*` metrics.
 *
 * **Details**
 *
 * The cache result and cause classification keys are static and allowed at
 * `shape-only`. The operation term is a bounded registry IRI. Activity ids
 * and counts are unbounded, so they need `standard` and ride spans only.
 *
 * **Example** (List the declared keys)
 *
 * ```ts import.meta.vitest name="List the declared keys"
 * import { NlpProcessingInstruments } from "@beep/nlp-processing/NlpProcessing.instruments"
 *
 * NlpProcessingInstruments.attributes.length // => 7
 * NlpProcessingInstruments.instruments.length // => 7
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const NlpProcessingInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: CacheResultAttribute,
      type: "string",
      signals: spanAndMetric,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(NlpCacheResult.literals),
      owner,
      description: "Whether an NLP cache lookup found its entry.",
    }),
    AttributeKey.make({
      key: CauseClassificationAttribute,
      type: "string",
      signals: spanAndMetric,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(CauseClassification.literals),
      owner,
      description: "Classification of the cause behind an NLP failure or backend fallback.",
    }),
    AttributeKey.make({
      key: OperationTermAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "bounded",
      minTier: "shape-only",
      owner,
      description: "Registry IRI of the operation term an attributed run ran.",
    }),
    AttributeKey.make({
      key: ActivityIdAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "unbounded",
      minTier: "standard",
      owner,
      description: "The activity/v1 id of an attributed run.",
    }),
    AttributeKey.make({
      key: ActivityUsedCountAttribute,
      type: "int",
      signals: [SignalKind.Enum.span],
      cardinality: "unbounded",
      minTier: "standard",
      owner,
      description: "How many entities an attributed run used.",
    }),
    AttributeKey.make({
      key: ActivityGeneratedCountAttribute,
      type: "int",
      signals: [SignalKind.Enum.span],
      cardinality: "unbounded",
      minTier: "standard",
      owner,
      description: "How many entities an attributed run generated.",
    }),
    AttributeKey.make({
      key: ActivityOutcomeAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(ActivityOutcome.literals),
      owner,
      description: "How an attributed run ended.",
    }),
  ],
  instruments: [
    OperationRunSpan,
    NlpWorkflowRuns,
    NlpWorkflowDuration,
    NlpOperationDuration,
    NlpCacheLookups,
    NlpBackendFallbacks,
    NlpFailures,
  ],
});
