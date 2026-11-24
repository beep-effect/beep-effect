/**
 * Instrument declarations owned by `@beep/palantiri`: the `Parcels.read` span,
 * the `beep.accounts.window_remaining` and `beep.host.pressure_stall` gauges,
 * and the attribute keys they carry.
 *
 * **Details**
 *
 * The repo catalog command merges this file with every other package's
 * `*.instruments.ts` file. `beep.provider` is declared by
 * `@beep/repo-ai-metrics`, so it is referenced here, never redeclared. Account
 * ordinals stay span-side: the gauge is labelled only by provider and window,
 * so its series stay bounded.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
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
import { AccountWindowKind } from "./AccountHeadroom.models.ts";
import { PressureResource } from "./HostPressure.models.ts";
import { ParcelId } from "./Parcel.models.ts";

const $I = $PalantiriId.create("Palantiri.instruments");

const owner = PackageName.make("@beep/palantiri");

/**
 * Freshness state stamped on a `Parcels.read` span, the value of
 * `beep.parcel_freshness`.
 *
 * **Example** (Read a freshness state)
 *
 * ```ts
 * import { ParcelFreshnessState } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(ParcelFreshnessState.Enum.unknown) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ParcelFreshnessState = LiteralKit(["fresh", "unknown"]).pipe(
  $I.annoteSchema("ParcelFreshnessState", {
    description: "Whether a parcel read was fresh or unknown, as a span attribute value.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ParcelFreshnessState = typeof ParcelFreshnessState.Type;

/**
 * Attribute key naming the parcel a `Parcels.read` span read.
 *
 * **Example** (Read the parcel key)
 *
 * ```ts
 * import { ParcelAttribute } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(ParcelAttribute) // "beep.parcel"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ParcelAttribute = AttributeKeyName.make("beep.parcel");

/**
 * Attribute key carrying the freshness state of a `Parcels.read` span.
 *
 * **Example** (Read the freshness key)
 *
 * ```ts
 * import { ParcelFreshnessAttribute } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(ParcelFreshnessAttribute) // "beep.parcel_freshness"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ParcelFreshnessAttribute = AttributeKeyName.make("beep.parcel_freshness");

/**
 * Attribute key naming the plan-limit window a quota gauge series measures.
 *
 * **Details**
 *
 * Catalog attribute keys are dotted, so the design's `window` label is
 * spelled `beep.window`.
 *
 * **Example** (Read the window key)
 *
 * ```ts
 * import { WindowAttribute } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(WindowAttribute) // "beep.window"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WindowAttribute = AttributeKeyName.make("beep.window");

/**
 * Attribute key naming the model group a scoped plan-limit window covers.
 *
 * **Details**
 *
 * Unscoped windows carry `all`. The values are the provider's model-group
 * names, so the set is bounded but not fixed.
 *
 * **Example** (Read the window scope key)
 *
 * ```ts
 * import { WindowScopeAttribute } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(WindowScopeAttribute) // "beep.window_scope"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WindowScopeAttribute = AttributeKeyName.make("beep.window_scope");

/**
 * Attribute key naming the model provider, declared by `@beep/repo-ai-metrics`.
 *
 * **Example** (Read the provider key)
 *
 * ```ts
 * import { ProviderAttribute } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(ProviderAttribute) // "beep.provider"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ProviderAttribute = AttributeKeyName.make("beep.provider");

/**
 * Attribute key naming the resource a pressure stall gauge series measures:
 * `cpu`, `memory` or `io`.
 *
 * **Example** (Read the resource key)
 *
 * ```ts
 * import { ResourceAttribute } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(ResourceAttribute) // "beep.resource"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ResourceAttribute = AttributeKeyName.make("beep.resource");

/**
 * The `Parcels.read` span: one parcel read, labelled by parcel and freshness.
 *
 * **Example** (Read the span name)
 *
 * ```ts
 * import { ParcelsReadSpan } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(ParcelsReadSpan.name) // "Parcels.read"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ParcelsReadSpan = SpanInstrument.make({
  name: SpanName.make("Parcels.read"),
  owner,
  family: "tooling",
  attributes: [ParcelAttribute, ParcelFreshnessAttribute],
  minTier: "shape-only",
  description: "Reads one Palantiri parcel and checks its freshness.",
  kind: "internal",
});

/**
 * The `beep.accounts.window_remaining` gauge: percent of a plan-limit window
 * still unused, the best account per provider and window.
 *
 * **Details**
 *
 * Several accounts of one provider share a series, so the gauge reports the
 * most headroom any of them has. Account ordinals never become labels.
 *
 * **Example** (Read the gauge name and unit)
 *
 * ```ts
 * import { AccountsWindowRemaining } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(AccountsWindowRemaining.name) // "beep.accounts.window_remaining"
 * console.log(AccountsWindowRemaining.unit) // "%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AccountsWindowRemaining = MetricInstrument.make({
  name: MetricName.make("beep.accounts.window_remaining"),
  owner,
  attributes: [ProviderAttribute, WindowAttribute, WindowScopeAttribute],
  minTier: "shape-only",
  description: "Percent of a plan-limit window still unused, best account per provider, window and scope.",
  kind: "gauge",
  unit: UcumUnit.make("%"),
});

/**
 * The `beep.host.pressure_stall` gauge: percent of the last 10 seconds in
 * which some tasks stalled on a resource, from the kernel's pressure stall
 * information.
 *
 * **Details**
 *
 * One series per resource (`beep.resource`: cpu, memory, io). It is recorded
 * only from fresh readings, so a host without pressure stall information
 * records nothing rather than zero.
 *
 * **Example** (Read the gauge name and unit)
 *
 * ```ts
 * import { HostPressureStall } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(HostPressureStall.name) // "beep.host.pressure_stall"
 * console.log(HostPressureStall.unit) // "%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HostPressureStall = MetricInstrument.make({
  name: MetricName.make("beep.host.pressure_stall"),
  owner,
  attributes: [ResourceAttribute],
  minTier: "shape-only",
  description: "Percent of the last 10 seconds some tasks stalled on a resource (PSI some avg10).",
  kind: "gauge",
  unit: UcumUnit.make("%"),
});

/**
 * Palantiri declarations: `beep.parcel`, `beep.parcel_freshness`,
 * `beep.window`, `beep.window_scope` and `beep.resource`, plus the
 * `Parcels.read` span and the
 * `beep.accounts.window_remaining` and `beep.host.pressure_stall` gauges.
 *
 * **Example** (List the Palantiri attribute keys)
 *
 * ```ts
 * import { PalantiriInstruments } from "@beep/palantiri/Palantiri.instruments"
 *
 * console.log(PalantiriInstruments.attributes.length) // 5
 * console.log(PalantiriInstruments.instruments.length) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PalantiriInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: ParcelAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(ParcelId.literals),
      owner,
      description: "Parcel a Palantiri read served.",
    }),
    AttributeKey.make({
      key: ParcelFreshnessAttribute,
      type: "string",
      signals: [SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(ParcelFreshnessState.literals),
      owner,
      description: "Whether the parcel read was fresh or unknown.",
    }),
    AttributeKey.make({
      key: WindowAttribute,
      type: "string",
      signals: [SignalKind.Enum.metric, SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(AccountWindowKind.literals),
      owner,
      description: "Plan-limit window a quota reading measures.",
    }),
    AttributeKey.make({
      key: WindowScopeAttribute,
      type: "string",
      signals: [SignalKind.Enum.metric, SignalKind.Enum.span],
      cardinality: "bounded",
      minTier: "shape-only",
      values: O.none(),
      owner,
      description: "Model group a scoped plan-limit window covers, or all when unscoped.",
    }),
    AttributeKey.make({
      key: ResourceAttribute,
      type: "string",
      signals: [SignalKind.Enum.metric, SignalKind.Enum.span],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(PressureResource.literals),
      owner,
      description: "Resource a pressure stall reading measures.",
    }),
  ],
  instruments: [ParcelsReadSpan, AccountsWindowRemaining, HostPressureStall],
});
