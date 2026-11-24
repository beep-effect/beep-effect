/**
 * Closed literal domains of the instrumentation catalog.
 *
 * **Details**
 *
 * Every value here is a {@link LiteralKit} so the catalog schemas, the repo
 * harvest command and the strict-tier gate share one spelling for tiers,
 * package families, signals and metric shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Order from "effect/Order";

const $I = $ObservabilityId.create("catalog/Catalog.literals");

/**
 * **Details**
 *
 * `shape-only` carries record shape and no content, `standard` carries bounded
 * operational attributes, and `dev-verbose` is reserved for workstation
 * debugging. When two tier ceilings meet, the stricter one wins; see
 * {@link stricterTier}.
 *
 * **Example** (Read the strictest tier)
 *
 * ```ts import.meta.vitest name="Read the strictest tier"
 * import { TelemetryTier } from "@beep/observability/catalog"
 *
 * TelemetryTier.literals[0] // => "shape-only"
 * TelemetryTier.Enum["dev-verbose"] // => "dev-verbose"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TelemetryTier = LiteralKit(["shape-only", "standard", "dev-verbose"]).pipe(
  $I.annoteSchema("TelemetryTier", {
    description: "Privacy tier of a telemetry record, ordered strictest first.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type TelemetryTier = typeof TelemetryTier.Type;

const telemetryTierRank = TelemetryTier.match({
  "shape-only": () => 0,
  standard: () => 1,
  "dev-verbose": () => 2,
});

const TelemetryTierOrder: Order.Order<TelemetryTier> = Order.mapInput(Order.Number, telemetryTierRank);

/**
 * The stricter of two tiers, which is how tier ceilings combine.
 *
 * **Example** (Pick the stricter tier)
 *
 * ```ts import.meta.vitest name="Pick the stricter tier"
 * import { stricterTier } from "@beep/observability/catalog"
 *
 * stricterTier("standard", "shape-only") // => "shape-only"
 * stricterTier("dev-verbose")("standard") // => "standard"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const stricterTier: {
  (that: TelemetryTier): (self: TelemetryTier) => TelemetryTier;
  (self: TelemetryTier, that: TelemetryTier): TelemetryTier;
} = Order.min(TelemetryTierOrder);

/**
 * Whether `self` is a strictly stricter tier than `that`.
 *
 * **Example** (Compare tiers)
 *
 * ```ts import.meta.vitest name="Compare tiers"
 * import { isStricterTier } from "@beep/observability/catalog"
 *
 * isStricterTier("shape-only", "standard") // => true
 * isStricterTier("standard", "standard") // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isStricterTier: {
  (that: TelemetryTier): (self: TelemetryTier) => boolean;
  (self: TelemetryTier, that: TelemetryTier): boolean;
} = Order.isLessThan(TelemetryTierOrder);

/**
 * Package family a telemetry owner belongs to.
 *
 * **Details**
 *
 * The family is derived from the owning package's path, never written by hand.
 *
 * **Example** (List package families)
 *
 * ```ts import.meta.vitest name="List package families"
 * import { PackageFamily } from "@beep/observability/catalog"
 *
 * PackageFamily.is.foundation("foundation") // => true
 * PackageFamily.literals.length // => 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PackageFamily = LiteralKit(["slice", "foundation", "driver", "tooling", "ecosystem", "app", "lab"]).pipe(
  $I.annoteSchema("PackageFamily", {
    description: "Repository package family, derived from the owning package path.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type PackageFamily = typeof PackageFamily.Type;

/**
 * Telemetry signal an instrument or attribute key applies to.
 *
 * **Example** (Check a signal kind)
 *
 * ```ts import.meta.vitest name="Check a signal kind"
 * import { SignalKind } from "@beep/observability/catalog"
 *
 * SignalKind.Enum.metric // => "metric"
 * SignalKind.is.log("log") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SignalKind = LiteralKit(["span", "metric", "event", "log"]).pipe(
  $I.annoteSchema("SignalKind", {
    description: "Telemetry signal kind: span, metric, event or log.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SignalKind = typeof SignalKind.Type;

/**
 * **Details**
 *
 * Metric labels accept only `static` and `bounded` keys; `unbounded` keys are
 * span, event or log attributes only.
 *
 * **Example** (Check a cardinality class)
 *
 * ```ts import.meta.vitest name="Check a cardinality class"
 * import { CardinalityClass } from "@beep/observability/catalog"
 *
 * CardinalityClass.is.unbounded("unbounded") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CardinalityClass = LiteralKit(["static", "bounded", "unbounded"]).pipe(
  $I.annoteSchema("CardinalityClass", {
    description: "Cardinality class of an attribute value space; metric labels accept static and bounded only.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CardinalityClass = typeof CardinalityClass.Type;

/**
 * **Example** (Read an attribute value type)
 *
 * ```ts import.meta.vitest name="Read an attribute value type"
 * import { AttributeValueType } from "@beep/observability/catalog"
 *
 * AttributeValueType.Enum["string-array"] // => "string-array"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AttributeValueType = LiteralKit(["string", "boolean", "int", "double", "string-array"]).pipe(
  $I.annoteSchema("AttributeValueType", {
    description: "OpenTelemetry attribute value type carried by an attribute key.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AttributeValueType = typeof AttributeValueType.Type;

/**
 * **Example** (Read a metric kind)
 *
 * ```ts import.meta.vitest name="Read a metric kind"
 * import { MetricKind } from "@beep/observability/catalog"
 *
 * MetricKind.Enum.histogram // => "histogram"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MetricKind = LiteralKit(["counter", "up-down-counter", "gauge", "histogram", "summary"]).pipe(
  $I.annoteSchema("MetricKind", {
    description: "Metric instrument kind.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type MetricKind = typeof MetricKind.Type;

/**
 * **Example** (Read a span kind)
 *
 * ```ts import.meta.vitest name="Read a span kind"
 * import { SpanKind } from "@beep/observability/catalog"
 *
 * SpanKind.Enum.server // => "server"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SpanKind = LiteralKit(["internal", "server", "client", "producer", "consumer"]).pipe(
  $I.annoteSchema("SpanKind", {
    description: "OpenTelemetry span kind.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SpanKind = typeof SpanKind.Type;

/**
 * How an emitter's identity was established.
 *
 * **Details**
 *
 * `vouched` identities were stamped by a trusted gateway or runner;
 * `self-claimed` identities come from the emitter itself.
 *
 * **Example** (Read an identity source)
 *
 * ```ts import.meta.vitest name="Read an identity source"
 * import { IdentitySource } from "@beep/observability/catalog"
 *
 * IdentitySource.Enum["self-claimed"] // => "self-claimed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const IdentitySource = LiteralKit(["vouched", "self-claimed"]).pipe(
  $I.annoteSchema("IdentitySource", {
    description: "Whether an emitter identity was vouched for by a trusted stamp or self-claimed.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type IdentitySource = typeof IdentitySource.Type;

/**
 * Where a span instrument entry came from.
 *
 * **Details**
 *
 * `harvested` entries are generated from literal span names in source;
 * `declared` entries are written by hand in a package's instruments file, and
 * replace the harvested entry of the same name and owner.
 *
 * **Example** (Read an instrument origin)
 *
 * ```ts import.meta.vitest name="Read an instrument origin"
 * import { InstrumentOrigin } from "@beep/observability/catalog"
 *
 * InstrumentOrigin.Enum.harvested // => "harvested"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InstrumentOrigin = LiteralKit(["harvested", "declared"]).pipe(
  $I.annoteSchema("InstrumentOrigin", {
    description: "Whether a span entry was harvested from source literals or declared by hand.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type InstrumentOrigin = typeof InstrumentOrigin.Type;
