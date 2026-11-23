/**
 * Schemas for instrument declarations, the merged instrument catalog, and the
 * emitter context a telemetry record ran in.
 *
 * **Details**
 *
 * {@link InstrumentCatalog} runs {@link catalogConflicts} as a decode-time
 * check, so a catalog that decodes is free of duplicate names, missing or
 * misapplied attribute keys, unbounded metric labels, and tier violations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  DuplicateAttributeKey,
  DuplicateInstrumentName,
  describeConflict,
  MissingAttributeKey,
  SignalNotAllowed,
  TierLooserThanAttribute,
  UnboundedMetricLabel,
} from "./Catalog.errors.ts";
import {
  AttributeValueType,
  CardinalityClass,
  IdentitySource,
  InstrumentOrigin,
  isStricterTier,
  MetricKind,
  PackageFamily,
  SignalKind,
  SpanKind,
  TelemetryTier,
} from "./Catalog.literals.ts";
import {
  AttributeKeyName,
  CloudProviderName,
  EventName,
  HostName,
  MetricName,
  PackageName,
  ProtocolSpanName,
  SpanName,
  UcumUnit,
  VcsRevision,
} from "./Catalog.names.ts";
import type { CatalogConflict } from "./Catalog.errors.ts";

const $I = $ObservabilityId.create("catalog/Catalog.models");

const Description = S.NonEmptyString.check(S.isTrimmed()).pipe(
  $I.annoteSchema("CatalogDescription", {
    description: "Non-empty, trimmed human description of a catalog entry.",
  })
);

const Token = S.NonEmptyString.check(S.isTrimmed()).pipe(
  $I.annoteSchema("CatalogToken", {
    description: "Non-empty, trimmed identifier reported by an emitter.",
  })
);

const AttributeKeyNames = S.Array(AttributeKeyName).pipe(
  S.check(S.isUnique()),
  S.withDecodingDefaultKey(Effect.succeed([])),
  S.withConstructorDefault(Effect.succeed([]))
);

const isStrictlyAscending = (values: ReadonlyArray<number>): boolean =>
  A.every(values, (value, index) => index === 0 || value > (values[index - 1] ?? value));

/**
 * One attribute key: its value type, the signals that may carry it, its
 * cardinality, and the strictest tier allowed to carry it.
 *
 * **Example** (Declare an attribute key)
 *
 * ```ts import.meta.vitest name="Declare an attribute key"
 * import * as O from "effect/Option"
 * import { AttributeKey, AttributeKeyName, PackageName } from "@beep/observability/catalog"
 *
 * const key = AttributeKey.make({
 *   key: AttributeKeyName.make("beep.docket.source"),
 *   type: "string",
 *   signals: ["span", "metric"],
 *   cardinality: "static",
 *   minTier: "shape-only",
 *   values: O.some(["mail", "box"]),
 *   owner: PackageName.make("@beep/practice-docket"),
 *   description: "Intake source of a docket record."
 * })
 * key.cardinality // => "static"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AttributeKey extends S.Opaque<AttributeKey, { readonly brand: unique symbol }>()(
  S.Struct({
    key: AttributeKeyName,
    type: AttributeValueType,
    signals: S.NonEmptyArray(SignalKind).check(S.isUnique()),
    cardinality: CardinalityClass,
    minTier: TelemetryTier,
    values: S.OptionFromOptionalKey(S.NonEmptyArray(Token).check(S.isUnique())).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    owner: PackageName,
    description: Description,
  }).pipe(
    $I.annoteSchema("AttributeKey", {
      description: "Attribute key declaration: value type, allowed signals, cardinality and strictest allowed tier.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export declare namespace AttributeKey {
  /**
   * Encoded attribute key as it appears in a declarations file.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AttributeKey.Encoded;
}

/**
 * **Details**
 *
 * Histogram `boundaries` are allowed only on `histogram` metrics and must be
 * strictly ascending.
 *
 * **Example** (Declare a histogram)
 *
 * ```ts import.meta.vitest name="Declare a histogram"
 * import * as O from "effect/Option"
 * import { MetricInstrument, MetricName, PackageName, UcumUnit } from "@beep/observability/catalog"
 *
 * const metric = MetricInstrument.make({
 *   name: MetricName.make("beep.docket.intake_duration"),
 *   owner: PackageName.make("@beep/practice-docket"),
 *   minTier: "shape-only",
 *   description: "Wall time of one intake run.",
 *   kind: "histogram",
 *   unit: UcumUnit.make("ms"),
 *   boundaries: O.some([10, 100, 1000])
 * })
 * metric._tag // => "MetricInstrument"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MetricInstrument extends S.Opaque<MetricInstrument, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MetricInstrument", {
    name: MetricName,
    owner: PackageName,
    attributes: AttributeKeyNames,
    minTier: TelemetryTier,
    description: Description,
    kind: MetricKind,
    unit: UcumUnit,
    boundaries: S.OptionFromOptionalKey(S.Finite.pipe(S.NonEmptyArray)).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
  })
    .check(
      S.makeFilter(
        ({ kind, boundaries }) => O.isNone(boundaries) || kind === MetricKind.Enum.histogram,
        $I.annote("MetricInstrumentBoundariesKindCheck", {
          title: "Metric Boundaries Kind",
          description: "Histogram boundaries are allowed only on histogram metrics.",
          message: "Expected boundaries only on a histogram metric",
        })
      ),
      S.makeFilter(
        ({ boundaries }) => O.match(boundaries, { onNone: () => true, onSome: isStrictlyAscending }),
        $I.annote("MetricInstrumentBoundariesOrderCheck", {
          title: "Metric Boundaries Order",
          description: "Histogram boundaries are strictly ascending.",
          message: "Expected strictly ascending histogram boundaries",
        })
      )
    )
    .pipe(
      $I.annoteSchema("MetricInstrument", {
        description: "Metric instrument declaration with kind, UCUM unit and optional histogram boundaries.",
      })
    )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export declare namespace MetricInstrument {
  /**
   * Encoded metric declaration as it appears in a declarations file.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof MetricInstrument.Encoded;
}

/**
 * **Details**
 *
 * Declared spans must be `protocol: true` to use a {@link ProtocolSpanName};
 * every other declared span name must match {@link SpanName}. Harvested spans
 * whose literal name predates the `Concept.action` form are kept with
 * `conforms: false`, so no codemod is needed. `conforms` must equal
 * `protocol || SpanName.is(name)`. `family` records the owning package's
 * family so export-time enrichment can stamp it.
 *
 * **Example** (Declare a span)
 *
 * ```ts import.meta.vitest name="Declare a span"
 * import { PackageName, SpanInstrument, SpanName } from "@beep/observability/catalog"
 *
 * const span = SpanInstrument.make({
 *   name: SpanName.make("Parcels.read"),
 *   owner: PackageName.make("@beep/parcels-server"),
 *   family: "slice",
 *   minTier: "shape-only",
 *   description: "Reads one parcel.",
 *   kind: "internal"
 * })
 * span.origin // => "declared"
 * span.conforms // => true
 * span.protocol // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpanInstrument extends S.Opaque<SpanInstrument, { readonly brand: unique symbol }>()(
  S.TaggedStruct("SpanInstrument", {
    name: S.Union([SpanName, ProtocolSpanName]),
    owner: PackageName,
    family: PackageFamily,
    attributes: AttributeKeyNames,
    minTier: TelemetryTier,
    description: Description,
    kind: SpanKind,
    protocol: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(false)),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    origin: InstrumentOrigin.pipe(
      S.withDecodingDefaultKey(Effect.succeed(InstrumentOrigin.Enum.declared)),
      S.withConstructorDefault(Effect.succeed(InstrumentOrigin.Enum.declared))
    ),
    conforms: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(true)),
      S.withConstructorDefault(Effect.succeed(true))
    ),
  })
    .check(
      S.makeFilter(
        ({ name, protocol, conforms }) => conforms === (protocol || S.is(SpanName)(name)),
        $I.annote("SpanInstrumentConformsCheck", {
          title: "Span Name Conformance",
          description:
            "conforms is true exactly when the span is a protocol span or its name is in Concept.action form.",
          message: "Expected conforms to match whether the name is a protocol or Concept(.Sub)*.action span name",
        })
      ),
      S.makeFilter(
        ({ conforms, origin }) => conforms || origin === InstrumentOrigin.Enum.harvested,
        $I.annote("SpanInstrumentProtocolNameCheck", {
          title: "Span Protocol Name",
          description: "Only protocol spans and legacy harvested spans may use a name outside the Concept.action form.",
          message: "Expected a Concept(.Sub)*.action span name, or protocol: true",
        })
      )
    )
    .pipe(
      $I.annoteSchema("SpanInstrument", {
        description: "Span instrument entry, harvested from source or declared by hand.",
      })
    )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export declare namespace SpanInstrument {
  /**
   * Encoded span entry as it appears in a declarations file.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof SpanInstrument.Encoded;
}

/**
 * **Example** (Declare an event)
 *
 * ```ts import.meta.vitest name="Declare an event"
 * import { EventInstrument, EventName, PackageName } from "@beep/observability/catalog"
 *
 * const event = EventInstrument.make({
 *   name: EventName.make("Docket.intake_completed"),
 *   owner: PackageName.make("@beep/practice-docket"),
 *   minTier: "shape-only",
 *   description: "One intake run finished."
 * })
 * event.attributes.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EventInstrument extends S.Opaque<EventInstrument, { readonly brand: unique symbol }>()(
  S.TaggedStruct("EventInstrument", {
    name: EventName,
    owner: PackageName,
    attributes: AttributeKeyNames,
    minTier: TelemetryTier,
    description: Description,
  }).pipe(
    $I.annoteSchema("EventInstrument", {
      description: "Event instrument declaration.",
    })
  )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export declare namespace EventInstrument {
  /**
   * Encoded event declaration as it appears in a declarations file.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof EventInstrument.Encoded;
}

/**
 * **Example** (Branch on an instrument)
 *
 * ```ts import.meta.vitest name="Branch on an instrument"
 * import { EventInstrument, EventName, Instrument, PackageName } from "@beep/observability/catalog"
 *
 * const event = EventInstrument.make({
 *   name: EventName.make("Docket.intake_completed"),
 *   owner: PackageName.make("@beep/practice-docket"),
 *   minTier: "shape-only",
 *   description: "One intake run finished."
 * })
 * Instrument.guards.EventInstrument(event) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Instrument = S.Union([MetricInstrument, SpanInstrument, EventInstrument]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Instrument", {
    description: "Catalog instrument: a metric, span or event declaration.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type Instrument = typeof Instrument.Type;

/**
 * Signal an instrument emits.
 *
 * **Example** (Read an instrument's signal)
 *
 * ```ts import.meta.vitest name="Read an instrument's signal"
 * import { EventInstrument, EventName, PackageName, instrumentSignal } from "@beep/observability/catalog"
 *
 * const event = EventInstrument.make({
 *   name: EventName.make("Docket.intake_completed"),
 *   owner: PackageName.make("@beep/practice-docket"),
 *   minTier: "shape-only",
 *   description: "One intake run finished."
 * })
 * instrumentSignal(event) // => "event"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const instrumentSignal: (instrument: Instrument) => SignalKind = Instrument.match({
  MetricInstrument: () => SignalKind.Enum.metric,
  SpanInstrument: () => SignalKind.Enum.span,
  EventInstrument: () => SignalKind.Enum.event,
});

/**
 * One package's instrument declarations file content.
 *
 * **Example** (Declare an empty file)
 *
 * ```ts import.meta.vitest name="Declare an empty file"
 * import { InstrumentDeclarations } from "@beep/observability/catalog"
 *
 * const declarations = InstrumentDeclarations.make({})
 * declarations.instruments.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstrumentDeclarations extends S.Opaque<InstrumentDeclarations, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: S.Array(AttributeKey).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    instruments: S.Array(Instrument).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
  }).pipe(
    $I.annoteSchema("InstrumentDeclarations", {
      description: "One package's attribute key and instrument declarations.",
    })
  )
) {}

/**
 * **Details**
 *
 * {@link catalogConflicts} inspects this content; {@link InstrumentCatalog}
 * adds the format version and runs those checks at decode time.
 *
 * **Example** (Hold unchecked content)
 *
 * ```ts import.meta.vitest name="Hold unchecked content"
 * import { InstrumentCatalogContent } from "@beep/observability/catalog"
 *
 * const content = InstrumentCatalogContent.make({ attributes: [], instruments: [] })
 * content.instruments.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstrumentCatalogContent extends S.Opaque<InstrumentCatalogContent, { readonly brand: unique symbol }>()(
  S.Struct({
    attributes: S.Array(AttributeKey),
    instruments: S.Array(Instrument),
  }).pipe(
    $I.annoteSchema("InstrumentCatalogContent", {
      description: "Attribute keys and instruments before the catalog conflict checks run.",
    })
  )
) {}

const conflictKey = (instrument: Instrument): string =>
  Instrument.guards.SpanInstrument(instrument) && instrument.protocol
    ? `${instrumentSignal(instrument)} ${instrument.owner} ${instrument.name}`
    : `${instrumentSignal(instrument)} ${instrument.name}`;

const attributeConflicts = (
  instrument: Instrument,
  attributes: HashMap.HashMap<AttributeKeyName, AttributeKey>
): ReadonlyArray<CatalogConflict> => {
  const signal = instrumentSignal(instrument);
  const { name } = instrument;
  return A.flatMap(
    instrument.attributes,
    (key): ReadonlyArray<CatalogConflict> =>
      O.match(HashMap.get(attributes, key), {
        onNone: () => [MissingAttributeKey.make({ signal, instrumentName: name, key })],
        onSome: (attribute) => [
          ...(A.contains(attribute.signals, signal)
            ? []
            : [SignalNotAllowed.make({ signal, instrumentName: name, key })]),
          ...(Instrument.guards.MetricInstrument(instrument) && CardinalityClass.is.unbounded(attribute.cardinality)
            ? [UnboundedMetricLabel.make({ instrumentName: instrument.name, key })]
            : []),
          ...(isStricterTier(instrument.minTier, attribute.minTier)
            ? [
                TierLooserThanAttribute.make({
                  signal,
                  instrumentName: name,
                  key,
                  instrumentTier: instrument.minTier,
                  attributeTier: attribute.minTier,
                }),
              ]
            : []),
        ],
      })
  );
};

/**
 * Every conflict in a set of attribute keys and instruments.
 *
 * **Details**
 *
 * Reports, in order: attribute keys declared more than once, instrument names
 * repeated within one signal (a protocol span's identity also includes its
 * owner, so semconv names such as `GET /health` may repeat across packages), then per instrument each referenced key that is
 * missing, does not allow the instrument's signal, is an unbounded metric
 * label, or requires a looser tier than the instrument admits. An empty result
 * means the content is a valid catalog.
 *
 * **Example** (Find a missing attribute key)
 *
 * ```ts import.meta.vitest name="Find a missing attribute key"
 * import { AttributeKeyName, EventInstrument, EventName, PackageName, catalogConflicts } from "@beep/observability/catalog"
 *
 * const conflicts = catalogConflicts({
 *   attributes: [],
 *   instruments: [
 *     EventInstrument.make({
 *       name: EventName.make("Docket.intake_completed"),
 *       owner: PackageName.make("@beep/practice-docket"),
 *       attributes: [AttributeKeyName.make("beep.missing")],
 *       minTier: "shape-only",
 *       description: "One intake run finished."
 *     })
 *   ]
 * })
 * conflicts[0]?._tag // => "MissingAttributeKey"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const catalogConflicts = ({
  attributes,
  instruments,
}: Pick<InstrumentCatalogContent, "attributes" | "instruments">): ReadonlyArray<CatalogConflict> => {
  const repeated = <T>(groups: Record<string, A.NonEmptyArray<T>>): ReadonlyArray<A.NonEmptyArray<T>> =>
    A.filter(R.values(groups), (group) => group.length > 1);
  const duplicateKeys = A.map(repeated(A.groupBy(attributes, (attribute) => attribute.key)), (group) =>
    DuplicateAttributeKey.make({ key: group[0].key, owners: A.map(group, (attribute) => attribute.owner) })
  );
  const duplicateNames = A.map(repeated(A.groupBy(instruments, conflictKey)), (group) =>
    DuplicateInstrumentName.make({
      signal: instrumentSignal(group[0]),
      instrumentName: group[0].name,
      owners: A.map(group, (instrument) => instrument.owner),
    })
  );
  const index = HashMap.fromIterable(A.map(attributes, (attribute) => [attribute.key, attribute] as const));
  return [
    ...duplicateKeys,
    ...duplicateNames,
    ...A.flatMap(instruments, (instrument) => attributeConflicts(instrument, index)),
  ];
};

/**
 * Merged, checked instrument catalog: every attribute key and instrument in
 * the repository.
 *
 * **Details**
 *
 * Decoding or constructing a catalog runs {@link catalogConflicts}; any
 * conflict fails the decode with one issue line per conflict.
 *
 * **Example** (Construct an empty catalog)
 *
 * ```ts import.meta.vitest name="Construct an empty catalog"
 * import { InstrumentCatalog } from "@beep/observability/catalog"
 *
 * const catalog = InstrumentCatalog.make({ attributes: [], instruments: [] })
 * catalog.version // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class InstrumentCatalog extends S.Opaque<InstrumentCatalog, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag(1),
    ...InstrumentCatalogContent.fields,
  })
    .check(
      S.makeFilter(
        (catalog) => {
          const conflicts = catalogConflicts(catalog);
          return A.isReadonlyArrayNonEmpty(conflicts) ? A.map(conflicts, describeConflict) : undefined;
        },
        $I.annote("InstrumentCatalogConflictCheck", {
          title: "Instrument Catalog Conflicts",
          description:
            "Names are unique per signal, referenced keys exist and allow the signal, metric labels are bounded, and instrument tiers are no looser than their attributes.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("InstrumentCatalog", {
        description: "Merged instrument catalog, checked for name, attribute, cardinality and tier conflicts.",
      })
    )
) {}

/**
 * @category models
 * @since 0.0.0
 */
export declare namespace InstrumentCatalog {
  /**
   * Encoded catalog as written to the generated catalog file.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof InstrumentCatalog.Encoded;
}

/**
 * **Example** (Construct a span owner)
 *
 * ```ts import.meta.vitest name="Construct a span owner"
 * import { PackageName, SpanOwner } from "@beep/observability/catalog"
 *
 * const owner = SpanOwner.make({ package: PackageName.make("@beep/observability"), family: "foundation" })
 * owner.family // => "foundation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpanOwner extends S.Opaque<SpanOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    package: PackageName,
    family: PackageFamily,
  }).pipe(
    $I.annoteSchema("SpanOwner", {
      description: "Package and package family that own a span name.",
    })
  )
) {}

/**
 * **Example** (Describe a workstation)
 *
 * ```ts import.meta.vitest name="Describe a workstation"
 * import { HostName, Workstation } from "@beep/observability/catalog"
 *
 * const context = Workstation.make({ identitySource: "self-claimed", hostName: HostName.make("dankstation") })
 * context._tag // => "Workstation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Workstation extends S.Opaque<Workstation, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Workstation", { identitySource: IdentitySource, hostName: HostName }).pipe(
    $I.annoteSchema("Workstation", { description: "Developer workstation emitter; tier ceiling dev-verbose." })
  )
) {}

/**
 * **Example** (Describe a server)
 *
 * ```ts import.meta.vitest name="Describe a server"
 * import { HostName, Server } from "@beep/observability/catalog"
 *
 * const context = Server.make({ identitySource: "vouched", hostName: HostName.make("api-01") })
 * context._tag // => "Server"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Server extends S.Opaque<Server, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Server", { identitySource: IdentitySource, hostName: HostName }).pipe(
    $I.annoteSchema("Server", { description: "Long-running server emitter; tier ceiling standard." })
  )
) {}

/**
 * **Example** (Describe a strict desktop)
 *
 * ```ts import.meta.vitest name="Describe a strict desktop"
 * import { StrictDesktop } from "@beep/observability/catalog"
 *
 * const context = StrictDesktop.make({ identitySource: "vouched" })
 * context._tag // => "StrictDesktop"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictDesktop extends S.Opaque<StrictDesktop, { readonly brand: unique symbol }>()(
  S.TaggedStruct("StrictDesktop", { identitySource: IdentitySource }).pipe(
    $I.annoteSchema("StrictDesktop", {
      description: "Strict-tier desktop emitter whose host the gateway stamps; tier ceiling shape-only.",
    })
  )
) {}

/**
 * **Example** (Describe a CI runner)
 *
 * ```ts import.meta.vitest name="Describe a CI runner"
 * import { CiRunner, VcsRevision } from "@beep/observability/catalog"
 *
 * const context = CiRunner.make({
 *   identitySource: "vouched",
 *   pipelineRunId: "1234567890",
 *   vcsRevision: VcsRevision.make("4e66575c64")
 * })
 * context._tag // => "CiRunner"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiRunner extends S.Opaque<CiRunner, { readonly brand: unique symbol }>()(
  S.TaggedStruct("CiRunner", { identitySource: IdentitySource, pipelineRunId: Token, vcsRevision: VcsRevision }).pipe(
    $I.annoteSchema("CiRunner", { description: "CI runner emitter; tier ceiling standard." })
  )
) {}

/**
 * **Example** (Describe a cloud VM)
 *
 * ```ts import.meta.vitest name="Describe a cloud VM"
 * import { CloudProviderName, CloudVm } from "@beep/observability/catalog"
 *
 * const context = CloudVm.make({ identitySource: "self-claimed", cloudProvider: CloudProviderName.make("aws") })
 * context._tag // => "CloudVm"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CloudVm extends S.Opaque<CloudVm, { readonly brand: unique symbol }>()(
  S.TaggedStruct("CloudVm", { identitySource: IdentitySource, cloudProvider: CloudProviderName }).pipe(
    $I.annoteSchema("CloudVm", { description: "Cloud virtual machine emitter; tier ceiling standard." })
  )
) {}

/**
 * **Example** (Describe a serverless function)
 *
 * ```ts import.meta.vitest name="Describe a serverless function"
 * import { CloudProviderName, Serverless } from "@beep/observability/catalog"
 *
 * const context = Serverless.make({
 *   identitySource: "vouched",
 *   cloudProvider: CloudProviderName.make("aws"),
 *   faasName: "docket-intake",
 *   deploymentEnvironment: "production"
 * })
 * context._tag // => "Serverless"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Serverless extends S.Opaque<Serverless, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Serverless", {
    identitySource: IdentitySource,
    cloudProvider: CloudProviderName,
    faasName: Token,
    deploymentEnvironment: Token,
  }).pipe($I.annoteSchema("Serverless", { description: "Serverless function emitter; tier ceiling standard." }))
) {}

/**
 * **Example** (Describe a browser)
 *
 * ```ts import.meta.vitest name="Describe a browser"
 * import { Browser } from "@beep/observability/catalog"
 *
 * const context = Browser.make({ identitySource: "self-claimed" })
 * context._tag // => "Browser"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Browser extends S.Opaque<Browser, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Browser", { identitySource: IdentitySource }).pipe(
    $I.annoteSchema("Browser", { description: "Browser emitter; tier ceiling shape-only." })
  )
) {}

/**
 * **Example** (Decode an emitter context)
 *
 * ```ts import.meta.vitest name="Decode an emitter context"
 * import * as S from "effect/Schema"
 * import { EmitterContext } from "@beep/observability/catalog"
 *
 * const decoded = S.decodeUnknownOption(EmitterContext)({ _tag: "Browser", identitySource: "self-claimed" })
 * decoded._tag // => "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EmitterContext = S.Union([
  Workstation,
  Server,
  StrictDesktop,
  CiRunner,
  CloudVm,
  Serverless,
  Browser,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("EmitterContext", {
    description: "Where a telemetry record ran, with its identity source; each variant implies a tier ceiling.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type EmitterContext = typeof EmitterContext.Type;
