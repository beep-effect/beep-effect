/**
 * Schemas of the strict-tier OTLP gate: the gate rule switches, the export
 * window, duration buckets, keyed span ids, the shape-only wire shapes and
 * the gate configuration.
 *
 * **Details**
 *
 * The gate never filters a record into shape: it constructs every exported
 * value from these schemas and from constants, so a field the schemas do not
 * name cannot reach the wire.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { InstrumentCatalog } from "../catalog/Catalog.models.ts";
import { AttributeKeyName } from "../catalog/Catalog.names.ts";
import { TelemetryDurationBucket, TelemetryRefusalTag } from "../Observability.instruments.ts";

const $I = $ObservabilityId.create("strict/StrictGate.schemas");

/**
 * **Details**
 *
 * Production runs with every rule on. A rule exists as a switch only so a
 * test can turn it off and prove some other test then fails.
 *
 * **Example** (List the gate rules)
 *
 * ```ts import.meta.vitest name="List the gate rules"
 * import { GateRule } from "@beep/observability/strict"
 *
 * GateRule.literals.length // => 12
 * GateRule.Enum["span-ids"] // => "span-ids"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateRule = LiteralKit([
  "span-name",
  "span-attributes",
  "span-events",
  "span-links",
  "span-status-message",
  "span-ids",
  "span-timestamps",
  "resource",
  "logs",
  "metric-names",
  "metric-attributes",
  "metric-values",
]).pipe(
  $I.annoteSchema("GateRule", {
    description: "One switch of the strict-tier gate, one per kind of data it drops or rewrites.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type GateRule = typeof GateRule.Type;

/**
 * **Example** (Decode a rule table)
 *
 * ```ts import.meta.vitest name="Decode a rule table"
 * import { GateRules, StrictGateRulesOn } from "@beep/observability/strict"
 * import * as S from "effect/Schema"
 *
 * S.is(GateRules)(StrictGateRulesOn) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GateRules = S.Record(GateRule, S.Boolean).pipe(
  $I.annoteSchema("GateRules", {
    description: "Whether each strict-tier gate rule is on; production turns every rule on.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type GateRules = typeof GateRules.Type;

/**
 * The production rule table: every gate rule on.
 *
 * **Example** (Check one production rule)
 *
 * ```ts import.meta.vitest name="Check one production rule"
 * import { StrictGateRulesOn } from "@beep/observability/strict"
 *
 * StrictGateRulesOn.logs // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const StrictGateRulesOn: GateRules = {
  "span-name": true,
  "span-attributes": true,
  "span-events": true,
  "span-links": true,
  "span-status-message": true,
  "span-ids": true,
  "span-timestamps": true,
  resource: true,
  logs: true,
  "metric-names": true,
  "metric-attributes": true,
  "metric-values": true,
};

/**
 * Width of the export window. Every exported timestamp is floored to it, and
 * the strict OTLP layer exports once per window.
 *
 * **Example** (Read the window length)
 *
 * ```ts import.meta.vitest name="Read the window length"
 * import { StrictExportWindow } from "@beep/observability/strict"
 * import * as Duration from "effect/Duration"
 *
 * Duration.toMinutes(StrictExportWindow) // => 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const StrictExportWindow: Duration.Duration = Duration.minutes(5);

class DurationBucketBound extends S.Opaque<DurationBucketBound, { readonly brand: unique symbol }>()(
  S.Struct({
    bucket: TelemetryDurationBucket,
    upperMs: S.Finite,
  }).pipe(
    $I.annoteSchema("DurationBucketBound", {
      description: "Inclusive upper bound, in milliseconds, of one closed duration bucket.",
    })
  )
) {}

const durationBucketBounds: ReadonlyArray<DurationBucketBound> = [
  DurationBucketBound.make({ bucket: "10ms", upperMs: 10 }),
  DurationBucketBound.make({ bucket: "50ms", upperMs: 50 }),
  DurationBucketBound.make({ bucket: "100ms", upperMs: 100 }),
  DurationBucketBound.make({ bucket: "250ms", upperMs: 250 }),
  DurationBucketBound.make({ bucket: "500ms", upperMs: 500 }),
  DurationBucketBound.make({ bucket: "1s", upperMs: 1_000 }),
  DurationBucketBound.make({ bucket: "2.5s", upperMs: 2_500 }),
  DurationBucketBound.make({ bucket: "5s", upperMs: 5_000 }),
  DurationBucketBound.make({ bucket: "10s", upperMs: 10_000 }),
];

/**
 * The duration bucket a span of the given length in milliseconds falls in.
 *
 * **Example** (Bucket two durations)
 *
 * ```ts import.meta.vitest name="Bucket two durations"
 * import { durationBucketOf } from "@beep/observability/strict"
 *
 * durationBucketOf(42) // => "50ms"
 * durationBucketOf(60_000) // => "over-10s"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const durationBucketOf = (durationMs: number): TelemetryDurationBucket =>
  A.findFirst(durationBucketBounds, (bound) => durationMs <= bound.upperMs).pipe(
    O.map((bound) => bound.bucket),
    O.getOrElse(() => TelemetryDurationBucket.Enum["over-10s"])
  );

/**
 * Largest exported metric value; anything above it is reported as this step.
 *
 * **Example** (Read the ceiling)
 *
 * ```ts import.meta.vitest name="Read the ceiling"
 * import { metricValueCeiling } from "@beep/observability/strict"
 *
 * metricValueCeiling // => 1000000000000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const metricValueCeiling = 1_000_000_000_000;

const ladderExponents = A.range(0, 12);

const metricValueLadder: ReadonlyArray<number> = [
  0,
  ...A.filter(
    A.flatMap(ladderExponents, (exponent) => A.map([1, 2.5, 5], (mantissa) => Math.floor(mantissa * 10 ** exponent))),
    (step) => step <= metricValueCeiling
  ),
];

/**
 * Floors a metric value onto the fixed 1/2.5/5-per-decade ladder (0, 1, 2, 5,
 * 10, 25, 50, 100, 250, 500, 1 000, ...), saturating at
 * {@link metricValueCeiling}. Negative values keep their sign and floor their
 * magnitude.
 *
 * **Details**
 *
 * The strict gate applies this to every exported number point and to each
 * histogram count, so an exported value never reveals more than its order of
 * magnitude and the half-decade it sits in.
 *
 * **Example** (Coarsen two values)
 *
 * ```ts import.meta.vitest name="Coarsen two values"
 * import { coarsenMetricValue } from "@beep/observability/strict"
 *
 * coarsenMetricValue(1_234_567) // => 1000000
 * coarsenMetricValue(3.7) // => 2
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const coarsenMetricValue = (value: number): number => {
  const magnitude = Math.abs(value);
  const step = A.findLast(metricValueLadder, (candidate) => candidate <= magnitude).pipe(O.getOrElse(() => 0));
  return value < 0 ? -step : step;
};

/**
 * OTLP trace id produced by the gate: 32 lowercase hex characters, keyed by
 * the salt and a per-batch nonce.
 *
 * **Example** (Check a trace id)
 *
 * ```ts import.meta.vitest name="Check a trace id"
 * import { HmacTraceId } from "@beep/observability/strict"
 * import * as S from "effect/Schema"
 *
 * S.is(HmacTraceId)("0123456789abcdef0123456789abcdef") // => true
 * S.is(HmacTraceId)("not-an-id") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HmacTraceId = S.String.check(
  S.isPattern(
    /^[0-9a-f]{32}$/,
    $I.annote("HmacTraceIdPatternCheck", {
      title: "Keyed Trace Id",
      description: "32 lowercase hex characters.",
      message: "Expected a 32-character lowercase hex trace id",
    })
  )
).pipe(
  S.brand("HmacTraceId"),
  $I.annoteSchema("HmacTraceId", {
    description: "Trace id keyed by the gate salt and a per-batch nonce, at OTLP trace id width.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type HmacTraceId = typeof HmacTraceId.Type;

/**
 * OTLP span id produced by the gate: 16 lowercase hex characters, keyed by
 * the salt and a per-batch nonce.
 *
 * **Example** (Check a span id)
 *
 * ```ts import.meta.vitest name="Check a span id"
 * import { HmacSpanId } from "@beep/observability/strict"
 * import * as S from "effect/Schema"
 *
 * S.is(HmacSpanId)("0123456789abcdef") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HmacSpanId = S.String.check(
  S.isPattern(
    /^[0-9a-f]{16}$/,
    $I.annote("HmacSpanIdPatternCheck", {
      title: "Keyed Span Id",
      description: "16 lowercase hex characters.",
      message: "Expected a 16-character lowercase hex span id",
    })
  )
).pipe(
  S.brand("HmacSpanId"),
  $I.annoteSchema("HmacSpanId", {
    description: "Span id keyed by the gate salt and a per-batch nonce, at OTLP span id width.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type HmacSpanId = typeof HmacSpanId.Type;

const UnixNanos = S.String.check(
  S.isPattern(
    /^\d+$/,
    $I.annote("UnixNanosPatternCheck", {
      title: "Unix Nanoseconds",
      description: "Decimal digits of a Unix time in nanoseconds.",
      message: "Expected decimal Unix nanoseconds",
    })
  )
).pipe(
  $I.annoteSchema("UnixNanos", {
    description: "Unix time in nanoseconds as OTLP JSON writes it.",
  })
);

/**
 * One attribute the gate exports: a catalogued key and a literal string
 * value.
 *
 * **Example** (Make a tool attribute)
 *
 * ```ts import.meta.vitest name="Make a tool attribute"
 * import { AttributeKeyName } from "@beep/observability/catalog"
 * import { ShapeOnlyAttribute } from "@beep/observability/strict"
 *
 * const attribute = ShapeOnlyAttribute.make({
 *   key: AttributeKeyName.make("beep.privacy_tier"),
 *   value: { stringValue: "shape-only" },
 * })
 * attribute.value.stringValue // => "shape-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShapeOnlyAttribute extends S.Opaque<ShapeOnlyAttribute, { readonly brand: unique symbol }>()(
  S.Struct({
    key: AttributeKeyName,
    value: S.Struct({ stringValue: S.String }),
  }).pipe(
    $I.annoteSchema("ShapeOnlyAttribute", {
      description: "Exported attribute: a catalogued key with a literal string value.",
    })
  )
) {}

/**
 * The resource every strict export carries, built from constants: service
 * name and version, the privacy tier and the key epoch. It names no host.
 *
 * **Example** (Count the resource attributes)
 *
 * ```ts import.meta.vitest name="Count the resource attributes"
 * import { AttributeKeyName } from "@beep/observability/catalog"
 * import { ShapeOnlyAttribute, ShapeOnlyResource } from "@beep/observability/strict"
 *
 * const resource = ShapeOnlyResource.make({
 *   attributes: [
 *     ShapeOnlyAttribute.make({ key: AttributeKeyName.make("service.name"), value: { stringValue: "demo" } }),
 *   ],
 *   droppedAttributesCount: 0,
 * })
 * resource.attributes.length // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShapeOnlyResource extends S.Opaque<ShapeOnlyResource, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: S.Array(ShapeOnlyAttribute),
    droppedAttributesCount: S.tag(0),
  }).pipe(
    $I.annoteSchema("ShapeOnlyResource", {
      description: "Constant resource of a strict export: service, tier and key epoch, never a host.",
    })
  )
) {}

/**
 * Wire shape of a span the gate exports with every rule on.
 *
 * **Details**
 *
 * The name is a tool id, the timestamps are floored to the export window,
 * the ids are keyed per batch, the status carries a code and no message, and
 * events and links are always empty.
 *
 * **Example** (Check an exported span)
 *
 * ```ts import.meta.vitest name="Check an exported span"
 * import { ShapeOnlySpan } from "@beep/observability/strict"
 * import * as S from "effect/Schema"
 *
 * S.is(ShapeOnlySpan)({ name: "kg_find" }) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShapeOnlySpan extends S.Opaque<ShapeOnlySpan, { readonly brand: unique symbol }>()(
  S.Struct({
    traceId: HmacTraceId,
    spanId: HmacSpanId,
    parentSpanId: S.optionalKey(HmacSpanId),
    name: S.NonEmptyString,
    kind: S.Int,
    startTimeUnixNano: UnixNanos,
    endTimeUnixNano: UnixNanos,
    attributes: S.Array(ShapeOnlyAttribute),
    droppedAttributesCount: S.tag(0),
    events: S.Tuple([]),
    droppedEventsCount: S.tag(0),
    status: S.Struct({ code: S.Literals([0, 1, 2]) }),
    links: S.Tuple([]),
    droppedLinksCount: S.tag(0),
  }).pipe(
    $I.annoteSchema("ShapeOnlySpan", {
      description: "Exported strict-tier span: tool name, floored times, keyed ids, status code, literal attributes.",
    })
  )
) {}

/**
 * Cumulative count of every refusal the gate has made, by tag.
 *
 * **Example** (Decode an empty ledger)
 *
 * ```ts import.meta.vitest name="Decode an empty ledger"
 * import { RefusalLedger } from "@beep/observability/strict"
 * import * as HashMap from "effect/HashMap"
 * import * as S from "effect/Schema"
 *
 * S.is(RefusalLedger)(HashMap.empty()) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RefusalLedger = S.HashMap(TelemetryRefusalTag, S.Natural).pipe(
  $I.annoteSchema("RefusalLedger", {
    description: "Cumulative strict-gate refusal counts by refusal tag.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type RefusalLedger = typeof RefusalLedger.Type;

/**
 * OTLP signal of one export, read from the path it was posted to.
 *
 * **Example** (Read a signal)
 *
 * ```ts import.meta.vitest name="Read a signal"
 * import { StrictSignal } from "@beep/observability/strict"
 *
 * StrictSignal.Enum.traces // => "traces"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StrictSignal = LiteralKit(["traces", "metrics", "logs"]).pipe(
  $I.annoteSchema("StrictSignal", {
    description: "OTLP signal of one strict export.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type StrictSignal = typeof StrictSignal.Type;

/**
 * One export body the egress client held back instead of sending.
 *
 * **Example** (Record a held-back body)
 *
 * ```ts import.meta.vitest name="Record a held-back body"
 * import { StrictEgressRecord } from "@beep/observability/strict"
 *
 * const record = StrictEgressRecord.make({ signal: "logs", body: '{"resourceLogs":[]}' })
 * record.signal // => "logs"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictEgressRecord extends S.Opaque<StrictEgressRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    signal: StrictSignal,
    body: S.String,
  }).pipe(
    $I.annoteSchema("StrictEgressRecord", {
      description: "One strict export body held back by the egress client.",
    })
  )
) {}

/**
 * What a strict gate is built from: the service identity it stamps, the tool
 * ids and span-name prefixes it maps, the attribute key it writes the tool id
 * to, the catalog that decides which keys and metrics pass, and the rule table.
 *
 * **Details**
 *
 * A span passes only when its name is a prefix from `toolSpanPrefixes`
 * followed by one of `toolIds`, and it is exported under the bare tool id. An
 * attribute passes only when the catalog allows its key on spans at the
 * `shape-only` tier and lists its value. `rules` defaults to
 * {@link StrictGateRulesOn}.
 *
 * **Example** (Configure a gate)
 *
 * ```ts import.meta.vitest name="Configure a gate"
 * import { AttributeKeyName, InstrumentCatalog } from "@beep/observability/catalog"
 * import { StrictGateConfig } from "@beep/observability/strict"
 *
 * const config = StrictGateConfig.make({
 *   serviceName: "demo-mcp",
 *   serviceVersion: "0.0.0",
 *   keyEpoch: "1",
 *   toolIds: ["lookup"],
 *   toolSpanPrefixes: ["mcp.tool.call."],
 *   toolKey: AttributeKeyName.make("beep.demo.tool"),
 *   catalog: InstrumentCatalog.make({ attributes: [], instruments: [] }),
 * })
 * config.rules.logs // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictGateConfig extends S.Opaque<StrictGateConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    serviceName: S.NonEmptyString,
    serviceVersion: S.NonEmptyString,
    keyEpoch: S.NonEmptyString,
    toolIds: S.NonEmptyArray(S.NonEmptyString).check(S.isUnique()),
    toolSpanPrefixes: S.NonEmptyArray(S.NonEmptyString).check(S.isUnique()),
    toolKey: AttributeKeyName,
    catalog: InstrumentCatalog,
    rules: GateRules.pipe(S.withConstructorDefault(Effect.succeed(StrictGateRulesOn))),
  }).pipe(
    $I.annoteSchema("StrictGateConfig", {
      description: "Inputs of a strict-tier gate: service identity, tool mapping, catalog and rule table.",
    })
  )
) {}
