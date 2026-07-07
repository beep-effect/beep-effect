/**
 * Internal observability helpers for `@beep/nlp`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { observeWorkflow, redactCauseSummary, summarizeCause, trackDuration } from "@beep/observability";
import { Effect, Metric } from "effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import type { Cause } from "effect";

const packageAttributes = {
  package: "@beep/nlp",
} satisfies Record<string, string>;

const workflowStarted = Metric.counter("nlp_workflow_started_total");
const workflowCompleted = Metric.counter("nlp_workflow_completed_total");
const workflowFailed = Metric.counter("nlp_workflow_failed_total");
const workflowInterrupted = Metric.counter("nlp_workflow_interrupted_total");
const workflowDuration = Metric.timer("nlp_workflow_duration");

const operationDuration = Metric.timer("nlp_operation_duration");
const cacheHitTotal = Metric.counter("nlp_cache_hit_total");
const cacheMissTotal = Metric.counter("nlp_cache_miss_total");
const fallbackTotal = Metric.counter("nlp_backend_fallback_total");
const failureTotal = Metric.counter("nlp_failure_total");

const withPackageAttributes = (attributes: Record<string, string>): Record<string, string> => ({
  ...packageAttributes,
  ...attributes,
});

// Only the stable, low-cardinality classification is safe for metric labels and
// span attributes. The raw `primaryMessage` and message-derived `fingerprint`
// are attacker-influenced and unbounded in cardinality, so they must never
// become metric labels (cardinality DoS) or leak into spans/metrics (info leak).
const causeMetricAttributes = <E>(cause: Cause.Cause<E>): Record<string, string> => ({
  cause_classification: summarizeCause(cause).classification,
});

// Bounded, sanitized cause detail for the log channel only. `redactCauseSummary`
// strips secrets/tokens/home paths, caps length, and keeps a stable fingerprint;
// the redacted message/detail are emitted to logs but never to metric labels.
const causeLogAttributes = <E>(cause: Cause.Cause<E>): Record<string, string> => {
  const redacted = pipe(cause, summarizeCause, (summary) => redactCauseSummary(summary));
  const base: Record<string, string> = {
    cause_classification: redacted.tag,
    cause_fingerprint: redacted.fingerprint,
    cause_message: redacted.message,
  };
  return O.match(redacted.detail, {
    onNone: () => base,
    onSome: (detail) => ({ ...base, cause_detail: detail }),
  });
};

/**
 * Annotate the current span with package-scoped NLP attributes.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
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
 * Observe a full NLP workflow with shared counters, duration metrics, and a span.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { observeNlpWorkflow } from "./observability"
 *
 * const program = Effect.succeed("ok").pipe(
 *   observeNlpWorkflow("nlp.example", { operation: "example" })
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
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    name: string,
    attributes: Record<string, string>
  ): Effect.Effect<A, E, R> => {
    const metricAttributes = withPackageAttributes(attributes);
    return observeWorkflow(effect, {
      attributes: metricAttributes,
      completed: workflowCompleted,
      duration: workflowDuration,
      failed: workflowFailed,
      interrupted: workflowInterrupted,
      name,
      started: workflowStarted,
    }).pipe(Effect.withSpan(name, { attributes: metricAttributes }));
  }
);

/**
 * Track the duration of one NLP operation with shared metric naming.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { trackNlpDuration } from "./observability"
 *
 * const program = Effect.succeed("ok").pipe(
 *   trackNlpDuration("nlp.example.step", { operation: "example" })
 * )
 *
 * console.log(program)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const trackNlpDuration: {
  <A, E, R>(effect: Effect.Effect<A, E, R>, name: string, attributes: Record<string, string>): Effect.Effect<A, E, R>;
  (
    name: string,
    attributes: Record<string, string>
  ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
} = dual(
  3,
  <A, E, R>(
    effect: Effect.Effect<A, E, R>,
    name: string,
    attributes: Record<string, string>
  ): Effect.Effect<A, E, R> => {
    const metricAttributes = withPackageAttributes(attributes);
    return trackDuration(effect, operationDuration, { attributes: metricAttributes }).pipe(
      Effect.withSpan(name, { attributes: metricAttributes })
    );
  }
);

/**
 * Record an NLP cache lookup as a hit or miss.
 *
 * @example
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
export const recordNlpCacheLookup = (hit: boolean, attributes: Record<string, string>): Effect.Effect<void> => {
  const metricAttributes = withPackageAttributes({
    ...attributes,
    cache_hit: hit ? "true" : "false",
  });
  const counter = hit ? cacheHitTotal : cacheMissTotal;
  return Metric.update(Metric.withAttributes(counter, metricAttributes), 1).pipe(
    Effect.andThen(Effect.annotateCurrentSpan(metricAttributes))
  );
};

/**
 * Record and log a backend fallback event.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
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
export const recordNlpBackendFallback = <E>(
  cause: Cause.Cause<E>,
  attributes: Record<string, string>
): Effect.Effect<void> => {
  const metricAttributes = withPackageAttributes({
    ...attributes,
    ...causeMetricAttributes(cause),
    fallback: "true",
  });
  const logAttributes = { ...metricAttributes, ...causeLogAttributes(cause) };
  return Metric.update(Metric.withAttributes(fallbackTotal, metricAttributes), 1).pipe(
    Effect.andThen(Effect.annotateCurrentSpan(metricAttributes)),
    Effect.andThen(
      Effect.logWarning({
        message: "nlp backend fallback",
        attributes: logAttributes,
      })
    )
  );
};

/**
 * Record and log an NLP failure cause.
 *
 * @example
 * ```ts
 * import { Cause } from "effect"
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
export const recordNlpFailure = <E>(cause: Cause.Cause<E>, attributes: Record<string, string>): Effect.Effect<void> => {
  const metricAttributes = withPackageAttributes({
    ...attributes,
    ...causeMetricAttributes(cause),
  });
  const logAttributes = { ...metricAttributes, ...causeLogAttributes(cause) };
  return Metric.update(Metric.withAttributes(failureTotal, metricAttributes), 1).pipe(
    Effect.andThen(Effect.annotateCurrentSpan(metricAttributes)),
    Effect.andThen(
      Effect.logError({
        message: "nlp operation failed",
        attributes: logAttributes,
      })
    )
  );
};
