/**
 * Branded, regex-checked names for catalog instruments, attribute keys and
 * owners.
 *
 * **Details**
 *
 * Each name is checked by a pattern at decode time, so a catalog entry can
 * only hold a static, well-formed name. Interpolated names cannot pass.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { ScopedPackageName } from "@beep/package-json/PackageName";
import * as S from "effect/Schema";

const $I = $ObservabilityId.create("catalog/Catalog.names");

const spanNamePattern = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*\.[a-z][A-Za-z0-9]*$/;
const metricNamePattern =
  /^beep\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$(?<!_total|_seconds|_milliseconds|_ms|_bytes|_ratio|_percent)/;
const eventNamePattern = /^[A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*\.[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;
const attributeKeyNamePattern = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/;
const protocolSpanNamePattern = /^\S(?:.*\S)?$/;
const unitPattern = /^[\x21-\x7e]+$/;
const hostNamePattern = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const cloudProviderPattern = /^[a-z][a-z0-9_]*$/;
const vcsRevisionPattern = /^[0-9a-f]{7,64}$/;

/**
 * Span name in `Concept(.Sub)*.action` form, for example `Parcels.read`.
 *
 * **Details**
 *
 * Concept segments are PascalCase and the final action segment is camelCase.
 * Semantic-convention protocol spans use {@link ProtocolSpanName} instead.
 *
 * **Example** (Check span names)
 *
 * ```ts import.meta.vitest name="Check span names"
 * import * as S from "effect/Schema"
 * import { SpanName } from "@beep/observability/catalog"
 *
 * S.is(SpanName)("Parcels.Docket.read") // => true
 * S.is(SpanName)("parcels.read") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SpanName = S.String.check(
  S.isPattern(
    spanNamePattern,
    $I.annote("SpanNamePatternCheck", {
      title: "Span Name Pattern",
      description: "A span name in Concept(.Sub)*.action form.",
      message: "Expected a span name like Parcels.read",
    })
  )
).pipe(
  S.brand("SpanName"),
  $I.annoteSchema("SpanName", {
    description: "Static span name in Concept(.Sub)*.action form.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type SpanName = typeof SpanName.Type;

/**
 * Span name owned by a semantic convention, such as an HTTP server route span.
 *
 * **Details**
 *
 * Only spans declared with `protocol: true` may use a name outside the
 * {@link SpanName} pattern. The name must be non-empty with no surrounding
 * whitespace.
 *
 * **Example** (Check a protocol span name)
 *
 * ```ts import.meta.vitest name="Check a protocol span name"
 * import * as S from "effect/Schema"
 * import { ProtocolSpanName } from "@beep/observability/catalog"
 *
 * S.is(ProtocolSpanName)("GET /parcels/:id") // => true
 * S.is(ProtocolSpanName)(" padded") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ProtocolSpanName = S.String.check(
  S.isPattern(
    protocolSpanNamePattern,
    $I.annote("ProtocolSpanNamePatternCheck", {
      title: "Protocol Span Name Pattern",
      description: "A non-empty span name with no surrounding whitespace.",
      message: "Expected a non-empty protocol span name without surrounding whitespace",
    })
  )
).pipe(
  S.brand("ProtocolSpanName"),
  $I.annoteSchema("ProtocolSpanName", {
    description: "Semantic-convention span name, allowed only on protocol spans.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type ProtocolSpanName = typeof ProtocolSpanName.Type;

/**
 * Metric name in lowercase dotted `beep.<area>.<noun>` form.
 *
 * **Details**
 *
 * Unit and `_total` suffixes are rejected because the exporter appends them.
 *
 * **Example** (Check metric names)
 *
 * ```ts import.meta.vitest name="Check metric names"
 * import * as S from "effect/Schema"
 * import { MetricName } from "@beep/observability/catalog"
 *
 * S.is(MetricName)("beep.docket.intake_runs") // => true
 * S.is(MetricName)("beep.docket.runs_total") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const MetricName = S.String.check(
  S.isPattern(
    metricNamePattern,
    $I.annote("MetricNamePatternCheck", {
      title: "Metric Name Pattern",
      description: "A lowercase dotted beep.<area>.<noun> metric name without unit or _total suffix.",
      message: "Expected a metric name like beep.area.noun without unit or _total suffix",
    })
  )
).pipe(
  S.brand("MetricName"),
  $I.annoteSchema("MetricName", {
    description: "Static metric name in beep.<area>.<noun> form.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type MetricName = typeof MetricName.Type;

/**
 * **Example** (Check event names)
 *
 * ```ts import.meta.vitest name="Check event names"
 * import * as S from "effect/Schema"
 * import { EventName } from "@beep/observability/catalog"
 *
 * S.is(EventName)("Docket.intake_completed") // => true
 * S.is(EventName)("Docket.intakeCompleted") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const EventName = S.String.check(
  S.isPattern(
    eventNamePattern,
    $I.annote("EventNamePatternCheck", {
      title: "Event Name Pattern",
      description: "An event name in Concept.event_happened form.",
      message: "Expected an event name like Docket.intake_completed",
    })
  )
).pipe(
  S.brand("EventName"),
  $I.annoteSchema("EventName", {
    description: "Static event name in Concept.event_happened form.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type EventName = typeof EventName.Type;

/**
 * Any instrument name: a span, protocol span, metric or event name.
 *
 * **Example** (Check an instrument name)
 *
 * ```ts import.meta.vitest name="Check an instrument name"
 * import * as S from "effect/Schema"
 * import { InstrumentName } from "@beep/observability/catalog"
 *
 * S.is(InstrumentName)("beep.docket.intake_runs") // => true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InstrumentName = S.Union([SpanName, MetricName, EventName, ProtocolSpanName]).pipe(
  $I.annoteSchema("InstrumentName", {
    description: "Name of any catalog instrument.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type InstrumentName = typeof InstrumentName.Type;

/**
 * Attribute key in lowercase dotted form, for example `beep.package`.
 *
 * **Example** (Check attribute key names)
 *
 * ```ts import.meta.vitest name="Check attribute key names"
 * import * as S from "effect/Schema"
 * import { AttributeKeyName } from "@beep/observability/catalog"
 *
 * S.is(AttributeKeyName)("beep.privacy_tier") // => true
 * S.is(AttributeKeyName)("Beep.Package") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const AttributeKeyName = S.String.check(
  S.isPattern(
    attributeKeyNamePattern,
    $I.annote("AttributeKeyNamePatternCheck", {
      title: "Attribute Key Name Pattern",
      description: "A lowercase dotted attribute key.",
      message: "Expected a lowercase dotted attribute key like beep.package",
    })
  )
).pipe(
  S.brand("AttributeKeyName"),
  $I.annoteSchema("AttributeKeyName", {
    description: "Static lowercase dotted attribute key.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type AttributeKeyName = typeof AttributeKeyName.Type;

/**
 * Scoped npm package name that owns a catalog entry, for example
 * `@beep/observability`.
 *
 * **Details**
 *
 * Validated by `@beep/package-json` `ScopedPackageName`, the npm naming rules
 * for scoped names, including the 214-character limit. Its brand is
 * `ScopedPackageName`, so values decoded by `@beep/package-json` are catalog
 * owner names without re-validation, and a malformed owner fails with the
 * generic pattern message of that schema.
 *
 * **Example** (Check package names)
 *
 * ```ts import.meta.vitest name="Check package names"
 * import * as S from "effect/Schema"
 * import { PackageName } from "@beep/observability/catalog"
 *
 * S.is(PackageName)("@beep/observability") // => true
 * S.is(PackageName)("observability") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PackageName = ScopedPackageName.pipe(
  $I.annoteSchema("PackageName", {
    description: "Scoped package name that owns a catalog entry.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type PackageName = typeof PackageName.Type;

/**
 * UCUM unit code for a metric, for example `ms`, `By` or `{request}`.
 *
 * **Details**
 *
 * Only the lexical shape is checked: printable ASCII with no whitespace.
 *
 * **Example** (Check unit codes)
 *
 * ```ts import.meta.vitest name="Check unit codes"
 * import * as S from "effect/Schema"
 * import { UcumUnit } from "@beep/observability/catalog"
 *
 * S.is(UcumUnit)("{request}") // => true
 * S.is(UcumUnit)("per second") // => false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const UcumUnit = S.String.check(
  S.isPattern(
    unitPattern,
    $I.annote("UcumUnitPatternCheck", {
      title: "UCUM Unit Pattern",
      description: "A UCUM unit code in printable ASCII without whitespace.",
      message: "Expected a UCUM unit code like ms or {request}",
    })
  )
).pipe(
  S.brand("UcumUnit"),
  $I.annoteSchema("UcumUnit", {
    description: "UCUM unit code of a metric instrument.",
  })
);

/**
 * @category value-objects
 * @since 0.0.0
 */
export type UcumUnit = typeof UcumUnit.Type;

/**
 * Host name an emitter reports, for example `dankstation`.
 *
 * **Example** (Check host names)
 *
 * ```ts import.meta.vitest name="Check host names"
 * import * as S from "effect/Schema"
 * import { HostName } from "@beep/observability/catalog"
 *
 * S.is(HostName)("build-01.tailnet") // => true
 * S.is(HostName)("-bad") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const HostName = S.String.check(
  S.isPattern(
    hostNamePattern,
    $I.annote("HostNamePatternCheck", {
      title: "Host Name Pattern",
      description: "A DNS-style host name.",
      message: "Expected a DNS-style host name",
    })
  )
).pipe(
  S.brand("HostName"),
  $I.annoteSchema("HostName", {
    description: "DNS-style host name reported by an emitter.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type HostName = typeof HostName.Type;

/**
 * Cloud provider token in semantic-convention `cloud.provider` form, for
 * example `aws` or `gcp`.
 *
 * **Example** (Check cloud provider tokens)
 *
 * ```ts import.meta.vitest name="Check cloud provider tokens"
 * import * as S from "effect/Schema"
 * import { CloudProviderName } from "@beep/observability/catalog"
 *
 * S.is(CloudProviderName)("alibaba_cloud") // => true
 * S.is(CloudProviderName)("AWS") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CloudProviderName = S.String.check(
  S.isPattern(
    cloudProviderPattern,
    $I.annote("CloudProviderNamePatternCheck", {
      title: "Cloud Provider Name Pattern",
      description: "A lowercase snake_case cloud provider token.",
      message: "Expected a lowercase cloud provider token like aws",
    })
  )
).pipe(
  S.brand("CloudProviderName"),
  $I.annoteSchema("CloudProviderName", {
    description: "Semantic-convention cloud.provider token.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type CloudProviderName = typeof CloudProviderName.Type;

/**
 * Lowercase hexadecimal VCS revision, 7 to 64 characters.
 *
 * **Example** (Check revisions)
 *
 * ```ts import.meta.vitest name="Check revisions"
 * import * as S from "effect/Schema"
 * import { VcsRevision } from "@beep/observability/catalog"
 *
 * S.is(VcsRevision)("4e66575c64") // => true
 * S.is(VcsRevision)("main") // => false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const VcsRevision = S.String.check(
  S.isPattern(
    vcsRevisionPattern,
    $I.annote("VcsRevisionPatternCheck", {
      title: "VCS Revision Pattern",
      description: "A lowercase hexadecimal commit revision of 7 to 64 characters.",
      message: "Expected a lowercase hexadecimal revision",
    })
  )
).pipe(
  S.brand("VcsRevision"),
  $I.annoteSchema("VcsRevision", {
    description: "Commit revision a CI run built.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type VcsRevision = typeof VcsRevision.Type;
