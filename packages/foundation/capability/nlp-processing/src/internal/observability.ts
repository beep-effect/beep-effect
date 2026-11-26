/**
 * Internal observability helpers for `@beep/nlp-processing`.
 *
 * **Details**
 *
 * The helpers record the metrics declared in `NlpProcessing.instruments.ts`
 * and annotate the current span; they open no span of their own, so every
 * span keeps the literal name of the `Effect.fn` or `Effect.withSpan` that
 * opened it. Metric labels are the declared static or bounded keys only; the
 * caller's free-form attributes go to the span and the log.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { observeWorkflow, redactCauseSummary, summarizeCause, trackDuration } from "@beep/observability";
import { O as OptionUtils } from "@beep/utils";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import {
  CacheResultAttribute,
  CauseClassificationAttribute,
  NlpBackendFallbacks,
  NlpCacheLookups,
  NlpFailures,
  NlpOperationDuration,
  NlpWorkflowDuration,
  NlpWorkflowRuns,
  PackageAttribute,
} from "../NlpProcessing.instruments.ts";
import type * as Cause from "effect/Cause";

const packageAttributes: Record<string, string> = {
  [PackageAttribute]: "@beep/nlp-processing",
};

const workflowRuns = Metric.counter(NlpWorkflowRuns.name);
const workflowDuration = Metric.timer(NlpWorkflowDuration.name);
const operationDuration = Metric.timer(NlpOperationDuration.name);
const cacheLookups = Metric.counter(NlpCacheLookups.name);
const backendFallbacks = Metric.counter(NlpBackendFallbacks.name);
const failures = Metric.counter(NlpFailures.name);

const withPackageAttributes = (attributes: Record<string, string>): Record<string, string> => ({
  ...attributes,
  ...packageAttributes,
});

const causeMetricAttributes = <E>(cause: Cause.Cause<E>): Record<string, string> => ({
  ...packageAttributes,
  [CauseClassificationAttribute]: summarizeCause(cause).classification,
});

const causeLogAttributes = <E>(cause: Cause.Cause<E>): Record<string, string> => {
  const redacted = pipe(cause, summarizeCause, (summary) => redactCauseSummary(summary));
  return OptionUtils.getSomesStruct({
    cause_classification: O.some(redacted.tag),
    cause_fingerprint: O.some(redacted.fingerprint),
    cause_message: O.some(redacted.message),
    cause_detail: redacted.detail,
  });
};

/**
 * Annotate the current span with package-scoped NLP attributes.
 *
 * **Example** (Annotate span then succeed)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { annotateNlpSpan } from "./observability"
 *
 * const program = annotateNlpSpan({ operation: "example" }).pipe(
 *   Effect.andThen(Effect.succeed("ok"))
 * )
 *
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const annotateNlpSpan = (attributes: Record<string, string>): Effect.Effect<void> =>
  Effect.annotateCurrentSpan(withPackageAttributes(attributes));

/**
 * Observe a full NLP workflow on `beep.nlp.workflow_runs` and
 * `beep.nlp.workflow_duration`, annotating the current span.
 *
 * **Example** (Observe workflow around effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { observeNlpWorkflow } from "./observability"
 *
 * const program = Effect.succeed("ok").pipe(
 *   observeNlpWorkflow("Example.run", { operation: "example" }),
 *   Effect.withSpan("Example.run")
 * )
 *
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const observeNlpWorkflow: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, name: string, attributes: Record<string, string>): Effect.Effect<A, E, R>;
  (
    name: string,
    attributes: Record<string, string>
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(
  3,
  <A, E, R>(effect: Effect.Effect<A, E, R>, name: string, attributes: Record<string, string>): Effect.Effect<A, E, R> =>
    Effect.andThen(
      annotateNlpSpan(attributes),
      observeWorkflow(effect, {
        attributes: packageAttributes,
        duration: workflowDuration,
        name,
        outcomes: workflowRuns,
      })
    )
);

/**
 * Track the duration of one NLP step on `beep.nlp.operation_duration`,
 * annotating the current span.
 *
 * **Example** (Track duration of effect)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { trackNlpDuration } from "./observability"
 *
 * const program = Effect.succeed("ok").pipe(
 *   trackNlpDuration({ operation: "example" }),
 *   Effect.withSpan("Example.step")
 * )
 *
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const trackNlpDuration: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, attributes: Record<string, string>): Effect.Effect<A, E, R>;
  (attributes: Record<string, string>): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(
  2,
  <A, E, R>(effect: Effect.Effect<A, E, R>, attributes: Record<string, string>): Effect.Effect<A, E, R> =>
    Effect.andThen(
      annotateNlpSpan(attributes),
      trackDuration(effect, operationDuration, { attributes: packageAttributes })
    )
);

/**
 * Record an NLP cache lookup on `beep.nlp.cache_lookups` as a hit or miss.
 *
 * **Example** (Record cache hit lookup)
 *
 * ```ts
 * import { recordNlpCacheLookup } from "./observability"
 *
 * const program = recordNlpCacheLookup(true, { operation: "tokenize" })
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const recordNlpCacheLookup: {
  (hit: boolean, attributes: Record<string, string>): Effect.Effect<void>;
  (attributes: Record<string, string>): (hit: boolean) => Effect.Effect<void>;
} = dual(2, (hit: boolean, attributes: Record<string, string>): Effect.Effect<void> => {
  const metricAttributes = { ...packageAttributes, [CacheResultAttribute]: hit ? "hit" : "miss" };
  return Metric.update(Metric.withAttributes(cacheLookups, metricAttributes), 1).pipe(
    Effect.andThen(annotateNlpSpan({ ...attributes, ...metricAttributes }))
  );
});

/**
 * Record and log a backend fallback on `beep.nlp.backend_fallbacks`.
 *
 * **Example** (Record backend fallback event)
 *
 * ```ts
 * import * as Cause from "effect/Cause";
 * import { recordNlpBackendFallback } from "./observability"
 *
 * const program = recordNlpBackendFallback(Cause.fail("primary failed"), {
 *   operation: "tokenize",
 *   primary_backend: "primary",
 *   secondary_backend: "secondary"
 * })
 *
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const recordNlpBackendFallback: {
  <E>(cause: Cause.Cause<E>, attributes: Record<string, string>): Effect.Effect<void>;
  (attributes: Record<string, string>): <E>(cause: Cause.Cause<E>) => Effect.Effect<void>;
} = dual(2, <E>(cause: Cause.Cause<E>, attributes: Record<string, string>): Effect.Effect<void> => {
  const metricAttributes = causeMetricAttributes(cause);
  const spanAttributes = { ...attributes, ...metricAttributes, fallback: "true" };
  return Metric.update(Metric.withAttributes(backendFallbacks, metricAttributes), 1).pipe(
    Effect.andThen(annotateNlpSpan(spanAttributes)),
    Effect.andThen(
      Effect.logWarning({
        message: "nlp backend fallback",
        attributes: { ...spanAttributes, ...causeLogAttributes(cause) },
      })
    )
  );
});

/**
 * Record and log an NLP failure on `beep.nlp.failures`.
 *
 * **Example** (Record failure with cause)
 *
 * ```ts
 * import * as Cause from "effect/Cause";
 * import { recordNlpFailure } from "./observability"
 *
 * const program = recordNlpFailure(Cause.fail("failed"), {
 *   operation: "tool.handle"
 * })
 *
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const recordNlpFailure: {
  <E>(cause: Cause.Cause<E>, attributes: Record<string, string>): Effect.Effect<void>;
  (attributes: Record<string, string>): <E>(cause: Cause.Cause<E>) => Effect.Effect<void>;
} = dual(2, <E>(cause: Cause.Cause<E>, attributes: Record<string, string>): Effect.Effect<void> => {
  const metricAttributes = causeMetricAttributes(cause);
  const spanAttributes = { ...attributes, ...metricAttributes };
  return Metric.update(Metric.withAttributes(failures, metricAttributes), 1).pipe(
    Effect.andThen(annotateNlpSpan(spanAttributes)),
    Effect.andThen(
      Effect.logError({
        message: "nlp operation failed",
        attributes: { ...spanAttributes, ...causeLogAttributes(cause) },
      })
    )
  );
});
