/**
 * Evidence plane: immutable content, occurrences, provenance activities, and
 * exact evidence anchors. PROV-O shaped: content and text are `prov:Entity`,
 * runs are `prov:Activity`. Provenance records lineage; it never grades truth.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PartyDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ActivityId, ContentId, Digest, OccurrenceId, PrincipalId } from "../../Ids.ts";

const $I = $PartyDomainId.create("values/Provenance/Provenance.model");

/**
 * Which side of the matter an artifact came from. The admission layer uses
 * this: an adversary's self-description is testimony from an interested
 * source, not neutral record.
 *
 * **Example** (Decode CollectionSide)
 * ```ts
 * import { CollectionSide } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(CollectionSide)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CollectionSide = LiteralKit([
  "client-file",
  "adversary-production",
  "third-party-production",
  "public-record",
  "open-source",
]).pipe($I.annoteSchema("CollectionSide", { description: "Which side of the matter an artifact came from." }));
/**
 * Decoded CollectionSide type.
 * @category models
 * @since 0.0.0
 */
export type CollectionSide = typeof CollectionSide.Type;

/**
 * Where an occurrence sits. Bates ranges are first-class because courts,
 * protective orders, and opposing counsel cite them, not file paths.
 *
 * **Example** (Decode Bates)
 * ```ts
 * import { Bates } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Bates)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Bates extends S.Opaque<Bates, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Bates", {
    production: S.NonEmptyString,
    begin: S.NonEmptyString,
    end: S.NonEmptyString,
  }).pipe($I.annoteSchema("Bates", { description: "Bates data." }))
) {}
/**
 * ContainerChild payload with validated role fields.
 *
 * **Example** (Decode ContainerChild)
 * ```ts
 * import { ContainerChild } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ContainerChild)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContainerChild extends S.Opaque<ContainerChild, { readonly brand: unique symbol }>()(
  S.TaggedStruct("ContainerChild", { parent: OccurrenceId, path: S.NonEmptyString }).pipe(
    $I.annoteSchema("ContainerChild", { description: "ContainerChild data." })
  )
) {}
/**
 * FilePath payload with validated role fields.
 *
 * **Example** (Decode FilePath)
 * ```ts
 * import { FilePath } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(FilePath)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FilePath extends S.Opaque<FilePath, { readonly brand: unique symbol }>()(
  S.TaggedStruct("FilePath", { root: S.NonEmptyString, path: S.NonEmptyString }).pipe(
    $I.annoteSchema("FilePath", { description: "FilePath data." })
  )
) {}
/**
 * Url payload with validated role fields.
 *
 * **Example** (Decode Url)
 * ```ts
 * import { Url } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Url)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Url extends S.Opaque<Url, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Url", { url: S.NonEmptyString }).pipe($I.annoteSchema("Url", { description: "Url data." }))
) {}
/**
 * Locator public schema for the provenance model.
 *
 * **Example** (Decode Locator)
 * ```ts
 * import { Locator } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Locator)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Locator = S.Union([Bates, ContainerChild, FilePath, Url]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Locator", { description: "Where an occurrence sits." })
);
/**
 * Decoded Locator type.
 * @category models
 * @since 0.0.0
 */
export type Locator = typeof Locator.Type;

/**
 * One occurrence of immutable content. Same bytes at two paths: one content,
 * two occurrences. Different bytes at one path over time: two contents.
 *
 * **Example** (Decode ArtifactOccurrence)
 * ```ts
 * import { ArtifactOccurrence } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ArtifactOccurrence)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class ArtifactOccurrence extends S.Opaque<ArtifactOccurrence, { readonly brand: unique symbol }>()(
  S.Struct({
    id: OccurrenceId,
    content: ContentId,
    locator: Locator,
    side: CollectionSide,
    /** Custodian label exactly as the production metadata states it. */
    custodianLabel: S.OptionFromNullOr(S.String),
    acquiredBy: ActivityId,
  }).pipe($I.annoteSchema("ArtifactOccurrence", { description: "One occurrence of immutable content." }))
) {}

/**
 * What kind of work an activity did.
 *
 * **Example** (Decode ActivityKind)
 * ```ts
 * import { ActivityKind } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ActivityKind)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ActivityKind = LiteralKit([
  "acquisition",
  "container-expansion",
  "header-extraction",
  "metadata-extraction",
  "text-reading",
  "llm-extraction",
  "classifier",
  "resolver",
  "assessor",
  "human-review",
  "admission",
  "projection",
]).pipe($I.annoteSchema("ActivityKind", { description: "What kind of work an activity did." }));
/**
 * Decoded ActivityKind vocabulary.
 * @category models
 * @since 0.0.0
 */
export type ActivityKind = typeof ActivityKind.Type;

/**
 * Terminal status of an activity. Partial and failed runs are data: an
 * incomplete collection must never become a negative fact.
 *
 * **Example** (Decode Completed)
 * ```ts
 * import { Completed } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Completed)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Completed extends S.Opaque<Completed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Completed", {}).pipe($I.annoteSchema("Completed", { description: "Completed data." }))
) {}
/**
 * Partial payload with validated role fields.
 *
 * **Example** (Decode Partial)
 * ```ts
 * import { Partial } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Partial)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Partial extends S.Opaque<Partial, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Partial", { reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("Partial", { description: "Partial data." })
  )
) {}
/**
 * Failed payload with validated role fields.
 *
 * **Example** (Decode Failed)
 * ```ts
 * import { Failed } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Failed)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Failed extends S.Opaque<Failed, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Failed", { reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("Failed", { description: "Failed data." })
  )
) {}
/**
 * ActivityStatus public schema for the provenance model.
 *
 * **Example** (Decode ActivityStatus)
 * ```ts
 * import { ActivityStatus } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(ActivityStatus)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ActivityStatus = S.Union([Completed, Partial, Failed]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ActivityStatus", { description: "Terminal activity status." })
);
/**
 * Decoded ActivityStatus vocabulary.
 * @category models
 * @since 0.0.0
 */
export type ActivityStatus = typeof ActivityStatus.Type;

/**
 * Who did the work: software at a pinned version, or a human principal.
 *
 * **Example** (Decode Software)
 * ```ts
 * import { Software } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Software)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Software extends S.Opaque<Software, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Software", { name: S.NonEmptyString, version: S.NonEmptyString, configDigest: Digest }).pipe(
    $I.annoteSchema("Software", { description: "Software data." })
  )
) {}
/**
 * Model payload with validated role fields.
 *
 * **Example** (Decode Model)
 * ```ts
 * import { Model } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Model)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Model extends S.Opaque<Model, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Model", {
    provider: S.NonEmptyString,
    model: S.NonEmptyString,
    promptDigest: Digest,
  }).pipe($I.annoteSchema("Model", { description: "Model data." }))
) {}
/**
 * Human payload with validated role fields.
 *
 * **Example** (Decode Human)
 * ```ts
 * import { Human } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Human)
 * ```
 * @category models
 * @since 0.0.0
 */
export class Human extends S.Opaque<Human, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Human", { principal: PrincipalId }).pipe($I.annoteSchema("Human", { description: "Human data." }))
) {}
/**
 * Producer public schema for the provenance model.
 *
 * **Example** (Decode Producer)
 * ```ts
 * import { Producer } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Producer)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const Producer = S.Union([Software, Model, Human]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("Producer", { description: "Who did the work." })
);
/**
 * Decoded Producer type.
 * @category models
 * @since 0.0.0
 */
export type Producer = typeof Producer.Type;

/**
 * A provenance activity (`prov:Activity`). Replay-identifiable: producer,
 * input basis digest, and status.
 *
 * **Example** (Decode Activity)
 * ```ts
 * import { Activity } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(Activity)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export class Activity extends S.Opaque<Activity, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ActivityId,
    kind: ActivityKind,
    producer: Producer,
    inputBasis: Digest,
    startedAt: S.DateTimeUtcFromMillis,
    status: ActivityStatus,
  }).pipe($I.annoteSchema("Activity", { description: "Replay-identifiable provenance activity." }))
) {}

/**
 * Header namespaces. MAPI and RFC 5322 disagree often enough (sender vs
 * sent-representing) that the namespace is part of the evidence.
 *
 * **Example** (Decode HeaderNamespace)
 * ```ts
 * import { HeaderNamespace } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(HeaderNamespace)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const HeaderNamespace = LiteralKit(["rfc5322", "mapi", "x-header", "load-file"]).pipe(
  $I.annoteSchema("HeaderNamespace", { description: "Header namespace an evidence field came from." })
);

/**
 * The exact place evidence comes from. A claim with no anchor cannot exist.
 *
 * **Example** (Decode HeaderField)
 * ```ts
 * import { HeaderField } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(HeaderField)
 * ```
 * @category models
 * @since 0.0.0
 */
export class HeaderField extends S.Opaque<HeaderField, { readonly brand: unique symbol }>()(
  S.TaggedStruct("HeaderField", {
    occurrence: OccurrenceId,
    namespace: HeaderNamespace,
    field: S.NonEmptyString,
  }).pipe($I.annoteSchema("HeaderField", { description: "HeaderField evidence location." }))
) {}
/**
 * TextSpan evidence location.
 *
 * **Example** (Decode TextSpan)
 * ```ts
 * import { TextSpan } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(TextSpan)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TextSpan extends S.Opaque<TextSpan, { readonly brand: unique symbol }>()(
  S.TaggedStruct("TextSpan", {
    occurrence: OccurrenceId,
    textDigest: Digest,
    start: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    end: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    quote: S.NonEmptyString,
  }).pipe($I.annoteSchema("TextSpan", { description: "TextSpan evidence location." }))
) {}
/**
 * MetadataTag evidence location.
 *
 * **Example** (Decode MetadataTag)
 * ```ts
 * import { MetadataTag } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(MetadataTag)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MetadataTag extends S.Opaque<MetadataTag, { readonly brand: unique symbol }>()(
  S.TaggedStruct("MetadataTag", {
    occurrence: OccurrenceId,
    namespace: S.NonEmptyString,
    tag: S.NonEmptyString,
  }).pipe($I.annoteSchema("MetadataTag", { description: "MetadataTag evidence location." }))
) {}
/**
 * RecordRow evidence location.
 *
 * **Example** (Decode RecordRow)
 * ```ts
 * import { RecordRow } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(RecordRow)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RecordRow extends S.Opaque<RecordRow, { readonly brand: unique symbol }>()(
  S.TaggedStruct("RecordRow", { occurrence: OccurrenceId, rowKey: S.NonEmptyString }).pipe(
    $I.annoteSchema("RecordRow", { description: "RecordRow evidence location." })
  )
) {}
/**
 * EvidenceAnchor public schema for the provenance model.
 *
 * **Example** (Decode EvidenceAnchor)
 * ```ts
 * import { EvidenceAnchor } from "@beep/party-domain/Provenance"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(EvidenceAnchor)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const EvidenceAnchor = S.Union([
  HeaderField,
  TextSpan.check(
    S.makeFilter(
      ({ start, end }) => start < end,
      $I.annote("TextSpanOrderCheck", { message: "Expected span start before end." })
    )
  ),
  MetadataTag,
  RecordRow,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("EvidenceAnchor", { description: "Exact evidence location." }));
/**
 * Decoded EvidenceAnchor type.
 * @category models
 * @since 0.0.0
 */
export type EvidenceAnchor = typeof EvidenceAnchor.Type;

/**
 * Decoded header namespace.
 * @category models
 * @since 0.0.0
 */
export type HeaderNamespace = typeof HeaderNamespace.Type;
