/**
 * Typed conflicts raised when instrument declarations do not merge into a
 * valid catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { SignalKind, TelemetryTier } from "./Catalog.literals.ts";
import { AttributeKeyName, InstrumentName, MetricName, PackageName } from "./Catalog.names.ts";

const $I = $ObservabilityId.create("catalog/Catalog.errors");

/**
 * **Example** (Construct a duplicate-name conflict)
 *
 * ```ts import.meta.vitest name="Construct a duplicate-name conflict"
 * import { DuplicateInstrumentName, PackageName, SpanName } from "@beep/observability/catalog"
 *
 * const conflict = DuplicateInstrumentName.make({
 *   signal: "span",
 *   instrumentName: SpanName.make("Parcels.read"),
 *   owners: [PackageName.make("@beep/a"), PackageName.make("@beep/b")]
 * })
 * conflict._tag // => "DuplicateInstrumentName"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateInstrumentName extends S.TaggedError<DuplicateInstrumentName, { readonly brand: unique symbol }>(
  $I`DuplicateInstrumentName`
)(
  "DuplicateInstrumentName",
  {
    signal: SignalKind,
    instrumentName: InstrumentName,
    owners: S.NonEmptyArray(PackageName),
  },
  $I.annoteError<DuplicateInstrumentName>("DuplicateInstrumentName", {
    description: "Two or more instruments of one signal share a name.",
  })
) {}

/**
 * **Example** (Construct a duplicate-key conflict)
 *
 * ```ts import.meta.vitest name="Construct a duplicate-key conflict"
 * import { AttributeKeyName, DuplicateAttributeKey, PackageName } from "@beep/observability/catalog"
 *
 * const conflict = DuplicateAttributeKey.make({
 *   key: AttributeKeyName.make("beep.package"),
 *   owners: [PackageName.make("@beep/a")]
 * })
 * conflict._tag // => "DuplicateAttributeKey"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DuplicateAttributeKey extends S.TaggedError<DuplicateAttributeKey, { readonly brand: unique symbol }>(
  $I`DuplicateAttributeKey`
)(
  "DuplicateAttributeKey",
  {
    key: AttributeKeyName,
    owners: S.NonEmptyArray(PackageName),
  },
  $I.annoteError<DuplicateAttributeKey>("DuplicateAttributeKey", {
    description: "Two or more declarations define the same attribute key.",
  })
) {}

/**
 * **Example** (Construct a missing-key conflict)
 *
 * ```ts import.meta.vitest name="Construct a missing-key conflict"
 * import { MetricName, AttributeKeyName, MissingAttributeKey } from "@beep/observability/catalog"
 *
 * const conflict = MissingAttributeKey.make({
 *   signal: "metric",
 *   instrumentName: MetricName.make("beep.docket.intake_runs"),
 *   key: AttributeKeyName.make("beep.unknown")
 * })
 * conflict._tag // => "MissingAttributeKey"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MissingAttributeKey extends S.TaggedError<MissingAttributeKey, { readonly brand: unique symbol }>(
  $I`MissingAttributeKey`
)(
  "MissingAttributeKey",
  {
    signal: SignalKind,
    instrumentName: InstrumentName,
    key: AttributeKeyName,
  },
  $I.annoteError<MissingAttributeKey>("MissingAttributeKey", {
    description: "An instrument references an attribute key that no declaration defines.",
  })
) {}

/**
 * **Example** (Construct a signal conflict)
 *
 * ```ts import.meta.vitest name="Construct a signal conflict"
 * import { MetricName, AttributeKeyName, SignalNotAllowed } from "@beep/observability/catalog"
 *
 * const conflict = SignalNotAllowed.make({
 *   signal: "metric",
 *   instrumentName: MetricName.make("beep.docket.intake_runs"),
 *   key: AttributeKeyName.make("beep.span_only")
 * })
 * conflict._tag // => "SignalNotAllowed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SignalNotAllowed extends S.TaggedError<SignalNotAllowed, { readonly brand: unique symbol }>(
  $I`SignalNotAllowed`
)(
  "SignalNotAllowed",
  {
    signal: SignalKind,
    instrumentName: InstrumentName,
    key: AttributeKeyName,
  },
  $I.annoteError<SignalNotAllowed>("SignalNotAllowed", {
    description: "An instrument uses an attribute key whose signal set excludes the instrument's signal.",
  })
) {}

/**
 * **Example** (Construct an unbounded-label conflict)
 *
 * ```ts import.meta.vitest name="Construct an unbounded-label conflict"
 * import { AttributeKeyName, MetricName, UnboundedMetricLabel } from "@beep/observability/catalog"
 *
 * const conflict = UnboundedMetricLabel.make({
 *   instrumentName: MetricName.make("beep.docket.intake_runs"),
 *   key: AttributeKeyName.make("beep.matter_id")
 * })
 * conflict._tag // => "UnboundedMetricLabel"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnboundedMetricLabel extends S.TaggedError<UnboundedMetricLabel, { readonly brand: unique symbol }>(
  $I`UnboundedMetricLabel`
)(
  "UnboundedMetricLabel",
  {
    instrumentName: MetricName,
    key: AttributeKeyName,
  },
  $I.annoteError<UnboundedMetricLabel>("UnboundedMetricLabel", {
    description: "A metric uses an unbounded attribute key as a label.",
  })
) {}

/**
 * **Details**
 *
 * `minTier` is the strictest tier allowed to carry an entry. An instrument
 * whose `minTier` is stricter than an attribute's `minTier` would carry that
 * attribute at a tier where it is forbidden.
 *
 * **Example** (Construct a tier conflict)
 *
 * ```ts import.meta.vitest name="Construct a tier conflict"
 * import { SpanName, AttributeKeyName, TierLooserThanAttribute } from "@beep/observability/catalog"
 *
 * const conflict = TierLooserThanAttribute.make({
 *   signal: "span",
 *   instrumentName: SpanName.make("Parcels.read"),
 *   key: AttributeKeyName.make("beep.matter_id"),
 *   instrumentTier: "shape-only",
 *   attributeTier: "standard"
 * })
 * conflict.instrumentTier // => "shape-only"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TierLooserThanAttribute extends S.TaggedError<TierLooserThanAttribute, { readonly brand: unique symbol }>(
  $I`TierLooserThanAttribute`
)(
  "TierLooserThanAttribute",
  {
    signal: SignalKind,
    instrumentName: InstrumentName,
    key: AttributeKeyName,
    instrumentTier: TelemetryTier,
    attributeTier: TelemetryTier,
  },
  $I.annoteError<TierLooserThanAttribute>("TierLooserThanAttribute", {
    description: "An instrument's minTier admits a stricter tier than one of its attributes allows.",
  })
) {}

/**
 * **Example** (Describe a conflict)
 *
 * ```ts import.meta.vitest name="Describe a conflict"
 * import { AttributeKeyName, CatalogConflict, DuplicateAttributeKey, PackageName } from "@beep/observability/catalog"
 *
 * const conflict = DuplicateAttributeKey.make({
 *   key: AttributeKeyName.make("beep.package"),
 *   owners: [PackageName.make("@beep/a")]
 * })
 * CatalogConflict.guards.DuplicateAttributeKey(conflict) // => true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const CatalogConflict = S.Union([
  DuplicateInstrumentName,
  DuplicateAttributeKey,
  MissingAttributeKey,
  SignalNotAllowed,
  UnboundedMetricLabel,
  TierLooserThanAttribute,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("CatalogConflict", {
    description: "Conflict found while merging instrument declarations into a catalog.",
  })
);

/**
 * @category errors
 * @since 0.0.0
 */
export type CatalogConflict = typeof CatalogConflict.Type;

/**
 * Renders a conflict as one human-readable line.
 *
 * **Example** (Render a conflict)
 *
 * ```ts import.meta.vitest name="Render a conflict"
 * import { AttributeKeyName, MetricName, UnboundedMetricLabel, describeConflict } from "@beep/observability/catalog"
 *
 * const line = describeConflict(
 *   UnboundedMetricLabel.make({
 *     instrumentName: MetricName.make("beep.docket.intake_runs"),
 *     key: AttributeKeyName.make("beep.matter_id")
 *   })
 * )
 * line // => "metric beep.docket.intake_runs uses unbounded attribute beep.matter_id as a label"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const describeConflict: (conflict: CatalogConflict) => string = CatalogConflict.match({
  DuplicateInstrumentName: ({ signal, instrumentName, owners }) =>
    `${signal} ${instrumentName} is declared by ${A.join(owners, ", ")}`,
  DuplicateAttributeKey: ({ key, owners }) => `attribute ${key} is declared by ${A.join(owners, ", ")}`,
  MissingAttributeKey: ({ signal, instrumentName, key }) =>
    `${signal} ${instrumentName} references undeclared attribute ${key}`,
  SignalNotAllowed: ({ signal, instrumentName, key }) =>
    `${signal} ${instrumentName} uses attribute ${key}, which does not allow ${signal}`,
  UnboundedMetricLabel: ({ instrumentName, key }) =>
    `metric ${instrumentName} uses unbounded attribute ${key} as a label`,
  TierLooserThanAttribute: ({ signal, instrumentName, key, instrumentTier, attributeTier }) =>
    `${signal} ${instrumentName} admits tier ${instrumentTier} but attribute ${key} requires ${attributeTier}`,
});
