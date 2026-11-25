/**
 * Instrument declarations owned by `@beep/observability`: the generic
 * attribute keys every package's telemetry may carry.
 *
 * **Details**
 *
 * The repo catalog command merges this file with every other package's
 * `*.instruments.ts` file. Each key here is static or bounded, so it is valid
 * as a metric label, and is allowed at every tier.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import { IdentitySource, PackageFamily, SignalKind, TelemetryTier } from "./catalog/Catalog.literals.ts";
import { AttributeKey, InstrumentDeclarations, MetricInstrument } from "./catalog/Catalog.models.ts";
import { AttributeKeyName, MetricName, PackageName, UcumUnit } from "./catalog/Catalog.names.ts";

const $I = $ObservabilityId.create("Observability.instruments");

const owner = PackageName.make("@beep/observability");

/**
 * Why an emitter refused a telemetry record or attribute, the value of the
 * `beep.schema_failure_tag` label on {@link TelemetryRefused}.
 *
 * **Details**
 *
 * The catalog enrichment layer counts three refusals:
 * `attribute-not-allowed` for an attribute whose key is not allowed on spans
 * at the `shape-only` tier, `stamped-key-override` for an attempt to set a key
 * the layer stamps itself, and `span-event-dropped` for a span event dropped
 * at the `shape-only` tier. The strict-tier gate (`@beep/observability/strict`)
 * adds one tag per thing it drops or rewrites: a span whose name is not a tool
 * id, a span link, a span status message, a log record, an input resource it
 * replaced, a metric or series whose name or kind is not allowed, a metric
 * point carrying a key or value that is not allowed, a raw histogram
 * aggregate (`sum`, `min`, `max`) it dropped, and an export its egress client
 * held back. Its encrypted spool adds five: an old segment evicted for
 * space, an old segment it tried to evict but could not remove, a body that
 * could not be sealed, encoded or written, a segment
 * refused at replay because its tier is looser than the current one, and a
 * segment refused at replay because it does not decode, authenticate or
 * match the current key epoch.
 *
 * **Example** (Read the attribute refusal tag)
 *
 * ```ts import.meta.vitest name="Read the attribute refusal tag"
 * import { TelemetryRefusalTag } from "@beep/observability/catalog"
 *
 * TelemetryRefusalTag.Enum["attribute-not-allowed"] // => "attribute-not-allowed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TelemetryRefusalTag = LiteralKit([
  "attribute-not-allowed",
  "stamped-key-override",
  "span-event-dropped",
  "span-name-not-allowed",
  "span-link-dropped",
  "span-status-message-dropped",
  "log-record-dropped",
  "resource-rebuilt",
  "metric-not-allowed",
  "metric-attribute-not-allowed",
  "metric-value-dropped",
  "egress-refused",
  "spool-evicted",
  "spool-evict-failed",
  "spool-write-failed",
  "spool-tier-refused",
  "spool-segment-invalid",
]).pipe(
  $I.annoteSchema("TelemetryRefusalTag", {
    description: "Reason an emitter refused a telemetry record or attribute.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type TelemetryRefusalTag = typeof TelemetryRefusalTag.Type;

/**
 * Attribute key that labels {@link TelemetryRefused} with a
 * {@link TelemetryRefusalTag}.
 *
 * **Example** (Read the refusal label key)
 *
 * ```ts import.meta.vitest name="Read the refusal label key"
 * import { SchemaFailureTagKey } from "@beep/observability/catalog"
 *
 * SchemaFailureTagKey // => "beep.schema_failure_tag"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SchemaFailureTagKey = AttributeKeyName.make("beep.schema_failure_tag");

/**
 * Coarse duration class a strict-tier span carries instead of its exact
 * duration, named by the bucket's upper bound.
 *
 * **Details**
 *
 * The bounds are 10, 50, 100, 250 and 500 ms, then 1, 2.5, 5 and 10 s;
 * anything longer is `over-10s`.
 *
 * **Example** (Read the open-ended bucket)
 *
 * ```ts import.meta.vitest name="Read the open-ended bucket"
 * import { TelemetryDurationBucket } from "@beep/observability/catalog"
 *
 * TelemetryDurationBucket.Enum["over-10s"] // => "over-10s"
 * TelemetryDurationBucket.literals.length // => 10
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TelemetryDurationBucket = LiteralKit([
  "10ms",
  "50ms",
  "100ms",
  "250ms",
  "500ms",
  "1s",
  "2.5s",
  "5s",
  "10s",
  "over-10s",
]).pipe(
  $I.annoteSchema("TelemetryDurationBucket", {
    description: "Coarse duration class named by its upper bound, carried instead of an exact duration.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type TelemetryDurationBucket = typeof TelemetryDurationBucket.Type;

/**
 * Attribute key that carries a {@link TelemetryDurationBucket} on a span or a
 * metric point.
 *
 * **Example** (Read the duration bucket key)
 *
 * ```ts import.meta.vitest name="Read the duration bucket key"
 * import { DurationBucketKey } from "@beep/observability/catalog"
 *
 * DurationBucketKey // => "beep.duration_bucket"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DurationBucketKey = AttributeKeyName.make("beep.duration_bucket");

/**
 * Counter of telemetry an emitter refused, labelled by
 * `beep.schema_failure_tag`.
 *
 * **Details**
 *
 * A refusal means the emitter met telemetry its tier does not allow; it
 * carries no content, so it is safe at every tier.
 *
 * **Example** (Read the refusal counter name)
 *
 * ```ts import.meta.vitest name="Read the refusal counter name"
 * import { TelemetryRefused } from "@beep/observability/catalog"
 *
 * TelemetryRefused.name // => "beep.telemetry.refused"
 * TelemetryRefused.kind // => "counter"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TelemetryRefused = MetricInstrument.make({
  name: MetricName.make("beep.telemetry.refused"),
  owner,
  attributes: [SchemaFailureTagKey],
  minTier: "shape-only",
  description: "Telemetry an emitter refused, by schema failure tag.",
  kind: "counter",
  unit: UcumUnit.make("{attribute}"),
});

/**
 * Kernel declarations: `beep.package`, `beep.family`, `beep.privacy_tier`,
 * `beep.identity_source`, `beep.outcome`, `beep.schema_failure_tag` and
 * `beep.duration_bucket`, plus the `beep.telemetry.refused` counter.
 *
 * **Example** (List the kernel attribute keys)
 *
 * ```ts import.meta.vitest name="List the kernel attribute keys"
 * import { ObservabilityInstruments } from "@beep/observability/catalog"
 *
 * ObservabilityInstruments.attributes.length // => 7
 * ObservabilityInstruments.attributes[0]?.key // => "beep.package"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ObservabilityInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: AttributeKeyName.make("beep.package"),
      type: "string",
      signals: SignalKind.literals,
      cardinality: "bounded",
      minTier: "shape-only",
      owner,
      description: "Scoped name of the package that emitted the record.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.family"),
      type: "string",
      signals: SignalKind.literals,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(PackageFamily.literals),
      owner,
      description: "Package family of the emitting package, derived from its path.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.privacy_tier"),
      type: "string",
      signals: SignalKind.literals,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(TelemetryTier.literals),
      owner,
      description: "Effective privacy tier the record was emitted at.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.identity_source"),
      type: "string",
      signals: SignalKind.literals,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(IdentitySource.literals),
      owner,
      description: "Whether the emitter identity was vouched for or self-claimed.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.outcome"),
      type: "string",
      signals: [SignalKind.Enum.metric],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(["started", "completed", "failed", "interrupted"]),
      owner,
      description: "Workflow lifecycle outcome stamped by observeWorkflow on its outcomes counter.",
    }),
    AttributeKey.make({
      key: SchemaFailureTagKey,
      type: "string",
      signals: [SignalKind.Enum.metric],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(TelemetryRefusalTag.literals),
      owner,
      description: "Reason an emitter refused telemetry, labelling the refusal counter.",
    }),
    AttributeKey.make({
      key: DurationBucketKey,
      type: "string",
      signals: [SignalKind.Enum.span, SignalKind.Enum.metric],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(TelemetryDurationBucket.literals),
      owner,
      description: "Coarse duration class of a span or metric point, carried instead of an exact duration.",
    }),
  ],
  instruments: [TelemetryRefused],
});
