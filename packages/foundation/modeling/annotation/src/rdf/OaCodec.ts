/**
 * The OA and NIF adapter of `@beep/annotation`: an annotation document over
 * the five OA kinds written as a W3C Web Annotation dataset, and third-party
 * OA input read back into one.
 *
 * **Details**
 *
 * The codec supports one declared profile ({@link OaProfileClass},
 * {@link OaProfileProperty}) and writes NIF for `Sentence` and `Word` on
 * export only ({@link NifExportTerm}). Offsets are Unicode code points on the
 * wire and `utf16-code-unit` in the document. Every annotation, occurrence,
 * run and native activity prints as its instance IRI ({@link instanceIri}),
 * so the encoder's output is ground. Every generation is one run entity
 * `<run> prov:specializationOf <annotation>`, with its stated time and its
 * activity on the run.
 *
 * - {@link encodeOa} writes a document and its imported activities.
 * - {@link decodeOa} reads third-party input: it mints every key from the
 *   content it reads, rejects the annotations the profile cannot take into a
 *   residual with their reasons, and attributes unattributed annotations to
 *   the import activity.
 * - {@link normalize} is the profile projection of an input in the encoder's
 *   form, written as rules over quads apart from both, so `L2-6` compares two
 *   implementations: `encode(decode(s))` and `normalize(s)` are one quad set.
 *
 * This subpath is the only module of the package that reaches `@beep/rdf`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI, IRIReference } from "@beep/identity/Iri";
import { $AnnotationId } from "@beep/identity/packages";
import { iri, mint, namespace } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { definePreimage } from "@beep/jsonc/Mint";
import {
  textAnchorToWebAnnotationTarget,
  WebAnnotationSelector,
  WebAnnotationTarget,
  WebAnnotationTextPositionSelector,
  WebAnnotationTextQuoteSelector,
  webAnnotationTargetToTextAnchor,
} from "@beep/rdf/Adapters/WebAnnotation";
import * as Rdf from "@beep/rdf/Rdf";
import { ActivityId, ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { Anchored, mintOccurrenceId } from "@beep/text/Occurrence";
import { convertPosition } from "@beep/text/OffsetUnit";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/text/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { constant, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeDocumentCodec } from "../AnnotationDocument.ts";
import { mintRunEntityId } from "../Generation.ts";
import { mintAnnotationId } from "../Kind.ts";
import { Mention, OaDocument, OaKinds, Paragraph, Sentence, Title, Word } from "../Kinds.ts";
import { merge } from "../Merge.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { WebAnnotationAnchorRefused } from "@beep/rdf/Adapters/WebAnnotation";
import type { OccurrenceId } from "@beep/text/Occurrence";
import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor";
import type * as Digest from "effect/crypto/Digest";
import type { AnnotationId } from "../AnnotationId.ts";
import type { Annotation, KindName } from "../Kind.ts";

const $I = $AnnotationId.create("rdf/OaCodec");

/**
 * The classes of the declared OA profile: nothing else is read into a
 * document.
 *
 * **Example** (Check a profile class)
 *
 * ```ts import.meta.vitest name="Check a profile class"
 * import { OaProfileClass } from "@beep/annotation/rdf/OaCodec"
 * import * as S from "effect/Schema"
 *
 * S.is(OaProfileClass)("oa:TextQuoteSelector") // => true
 * S.is(OaProfileClass)("oa:FragmentSelector") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OaProfileClass = LiteralKit([
  "oa:Annotation",
  "oa:SpecificResource",
  "oa:TextPositionSelector",
  "oa:TextQuoteSelector",
  "prov:Activity",
]).pipe($I.annoteSchema("OaProfileClass", { description: "The classes of the declared OA profile." }));

/**
 * Type for {@link OaProfileClass}.
 *
 * **Example** (Name a profile class)
 *
 * ```ts
 * import type { OaProfileClass } from "@beep/annotation/rdf/OaCodec"
 *
 * const annotation: OaProfileClass = "oa:Annotation"
 * console.log(annotation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OaProfileClass = typeof OaProfileClass.Type;

/**
 * The properties of the declared OA profile.
 *
 * **Example** (Check a profile property)
 *
 * ```ts import.meta.vitest name="Check a profile property"
 * import { OaProfileProperty } from "@beep/annotation/rdf/OaCodec"
 * import * as S from "effect/Schema"
 *
 * S.is(OaProfileProperty)("prov:specializationOf") // => true
 * S.is(OaProfileProperty)("oa:refinedBy") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OaProfileProperty = LiteralKit([
  "oa:hasTarget",
  "oa:hasSource",
  "oa:hasSelector",
  "oa:hasBody",
  "oa:start",
  "oa:end",
  "oa:exact",
  "oa:prefix",
  "oa:suffix",
  "rdf:type",
  "dcterms:creator",
  "dcterms:created",
  "as:generator",
  "prov:wasGeneratedBy",
  "prov:specializationOf",
  "prov:generatedAtTime",
]).pipe($I.annoteSchema("OaProfileProperty", { description: "The properties of the declared OA profile." }));

/**
 * Type for {@link OaProfileProperty}.
 *
 * **Example** (Name a profile property)
 *
 * ```ts
 * import type { OaProfileProperty } from "@beep/annotation/rdf/OaCodec"
 *
 * const target: OaProfileProperty = "oa:hasTarget"
 * console.log(target)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OaProfileProperty = typeof OaProfileProperty.Type;

/**
 * The NIF terms the encoder writes for the `Sentence` and `Word` kinds and
 * their source context. Export only: the decoder sends every `nif:` triple to
 * the residual.
 *
 * **Example** (Check a NIF export term)
 *
 * ```ts import.meta.vitest name="Check a NIF export term"
 * import { NifExportTerm } from "@beep/annotation/rdf/OaCodec"
 * import * as S from "effect/Schema"
 *
 * S.is(NifExportTerm)("nif:Context") // => true
 * S.is(NifExportTerm)("nif:isString") // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NifExportTerm = LiteralKit([
  "nif:Context",
  "nif:Sentence",
  "nif:Word",
  "nif:beginIndex",
  "nif:endIndex",
  "nif:anchorOf",
  "nif:referenceContext",
]).pipe($I.annoteSchema("NifExportTerm", { description: "The export-only NIF vocabulary of the OA codec." }));

/**
 * Type for {@link NifExportTerm}.
 *
 * **Example** (Name a NIF export term)
 *
 * ```ts
 * import type { NifExportTerm } from "@beep/annotation/rdf/OaCodec"
 *
 * const sentence: NifExportTerm = "nif:Sentence"
 * console.log(sentence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NifExportTerm = typeof NifExportTerm.Type;

/**
 * An activity third-party input named: a `prov:wasGeneratedBy` activity IRI,
 * a `dcterms:creator` agent or an `as:generator` agent, kept as the input
 * named it.
 *
 * **Details**
 *
 * Its `ActivityId` is the `imported-activity/v1` hash of the encoded case
 * ({@link mintImportedActivityId}). A time the input stated belongs to the
 * generation, not to the activity.
 *
 * **Example** (Decode an imported creator)
 *
 * ```ts import.meta.vitest name="Decode an imported creator"
 * import { ImportedActivity } from "@beep/annotation/rdf/OaCodec"
 * import * as S from "effect/Schema"
 *
 * const creator = S.decodeUnknownSync(ImportedActivity)({ _tag: "Creator", agent: "https://example.org/agent/1" })
 * creator._tag // => "Creator"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImportedActivity = S.TaggedUnion({
  Activity: { iri: IRI.annotateKey({ description: "The activity IRI as the input wrote it." }) },
  Creator: { agent: IRI.annotateKey({ description: "The dcterms:creator agent as the input wrote it." }) },
  Generator: { agent: IRI.annotateKey({ description: "The as:generator agent as the input wrote it." }) },
}).pipe(
  $I.annoteSchema("ImportedActivity", {
    description: "A third-party activity, creator or generator, kept as the input named it.",
  })
);

/**
 * Type for {@link ImportedActivity}.
 *
 * **Example** (Make an imported activity)
 *
 * ```ts
 * import { ImportedActivity } from "@beep/annotation/rdf/OaCodec"
 * import { IRI } from "@beep/identity/Iri"
 *
 * const activity: ImportedActivity = ImportedActivity.cases.Activity.make({
 *   iri: IRI.make("https://example.org/activity/1"),
 * })
 * console.log(activity._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ImportedActivity = typeof ImportedActivity.Type;

/**
 * The `imported-activity/v1` preimage over one encoded
 * {@link ImportedActivity}, with its committed golden vector.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the imported-activity domain tag"
 * import { ImportedActivityPreimage } from "@beep/annotation/rdf/OaCodec"
 *
 * ImportedActivityPreimage.domainTag // => "imported-activity/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImportedActivityPreimage = definePreimage({
  domainTag: DomainTag.make("imported-activity/v1"),
  schema: S.Tuple([ImportedActivity]),
  golden: {
    preimage: [{ _tag: "Activity", iri: "https://example.org/activity/1" }],
    hash: ContentHash.make("sha256:9924f029d9bb4a3a0788bb5c915176e98210d3b4bbd604efd8b2dfc65b6de8fa"),
  },
});

/**
 * The import itself: the activity a decode attributes unattributed
 * annotations to, over the SHA-256 of the RDF bytes the caller parsed.
 *
 * **Details**
 *
 * Its id is the `import-activity/v1` hash of the source digest alone
 * ({@link mintImportActivityId}); `importedAt` stays outside every id and
 * every quad, so {@link normalize} depends on the input and the digest only.
 *
 * **Example** (Make an import activity)
 *
 * ```ts import.meta.vitest name="Make an import activity"
 * import { ImportActivity } from "@beep/annotation/rdf/OaCodec"
 * import { Sha256PrefixedDigest } from "@beep/schema/Sha256"
 * import * as DateTime from "effect/DateTime"
 *
 * const imported = ImportActivity.make({
 *   sourceDigest: Sha256PrefixedDigest.make(`sha256:${"b".repeat(64)}`),
 *   importedAt: DateTime.makeUnsafe(0),
 * })
 * imported.sourceDigest.length // => 71
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImportActivity extends S.Opaque<ImportActivity, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceDigest: Sha256PrefixedDigest.annotateKey({ description: "The SHA-256 of the RDF bytes the caller parsed." }),
    importedAt: S.DateTimeUtcFromMillis.annotateKey({ description: "When the import ran; outside every id." }),
  }).pipe(
    $I.annoteSchema("ImportActivity", { description: "The import activity of one decode of third-party OA input." })
  )
) {}

/**
 * The `import-activity/v1` preimage over the source digest, with its
 * committed golden vector.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts import.meta.vitest name="Read the import-activity domain tag"
 * import { ImportActivityPreimage } from "@beep/annotation/rdf/OaCodec"
 *
 * ImportActivityPreimage.domainTag // => "import-activity/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImportActivityPreimage = definePreimage({
  domainTag: DomainTag.make("import-activity/v1"),
  schema: S.Tuple([Sha256PrefixedDigest]),
  golden: {
    preimage: ["sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
    hash: ContentHash.make("sha256:f5431a3f22f3b795221229eb7c7b3e424d4f89fec11f5ebf7b536973d91429b1"),
  },
});

/**
 * Mint the id of an imported activity under `imported-activity/v1`.
 *
 * **Example** (Mint the golden imported activity)
 *
 * ```ts
 * import { ImportedActivity, mintImportedActivityId } from "@beep/annotation/rdf/OaCodec"
 * import { IRI } from "@beep/identity/Iri"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const id = mintImportedActivityId(
 *   ImportedActivity.cases.Activity.make({ iri: IRI.make("https://example.org/activity/1") })
 * ).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof id)
 * ```
 *
 * @param activity - The activity as the input named it.
 * @returns Its activity id.
 * @category constructors
 * @since 0.0.0
 */
export const mintImportedActivityId = Effect.fn("ImportedActivity.mint")(function* (
  activity: ImportedActivity
): Effect.fn.Return<ActivityId, PreimageMintError, Digest.Digest> {
  const hash = yield* ImportedActivityPreimage.mint([activity]);
  return ActivityId.make(hash);
});

/**
 * Mint the id of an import activity under `import-activity/v1`, from the
 * digest of the RDF bytes it imported.
 *
 * **Example** (Mint an import activity id)
 *
 * ```ts
 * import { mintImportActivityId } from "@beep/annotation/rdf/OaCodec"
 * import { Sha256PrefixedDigest } from "@beep/schema/Sha256"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const id = mintImportActivityId(Sha256PrefixedDigest.make(`sha256:${"b".repeat(64)}`)).pipe(
 *   Effect.provide(Digest.layerWebCrypto)
 * )
 * console.log(typeof id)
 * ```
 *
 * @param sourceDigest - The SHA-256 of the parsed RDF bytes.
 * @returns The import activity's id.
 * @category constructors
 * @since 0.0.0
 */
export const mintImportActivityId = Effect.fn("ImportActivity.mint")(function* (
  sourceDigest: Sha256PrefixedDigest
): Effect.fn.Return<ActivityId, PreimageMintError, Digest.Digest> {
  const hash = yield* ImportActivityPreimage.mint([sourceDigest]);
  return ActivityId.make(hash);
});

/**
 * Why the decoder rejected one third-party annotation.
 *
 * **Details**
 *
 * - `other-source`: a target names another `oa:hasSource`.
 * - `unknown-kind`: its kind type is not one OA kind.
 * - `body-refused`: its body is not the one its kind reads.
 * - `target-refused`: it has no target, or a target whose selectors do not
 *   give one verified anchor.
 * - `time-conflict`: one subject states two times, or one (content, activity)
 *   pair is given two times.
 *
 * **Example** (Check a rejection reason)
 *
 * ```ts import.meta.vitest name="Check a rejection reason"
 * import { OaAnnotationRefusal } from "@beep/annotation/rdf/OaCodec"
 * import * as S from "effect/Schema"
 *
 * S.is(OaAnnotationRefusal)("time-conflict") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OaAnnotationRefusal = LiteralKit([
  "other-source",
  "unknown-kind",
  "body-refused",
  "target-refused",
  "time-conflict",
]).pipe($I.annoteSchema("OaAnnotationRefusal", { description: "Why one third-party annotation was rejected." }));

/**
 * Type for {@link OaAnnotationRefusal}.
 *
 * **Example** (Name a rejection reason)
 *
 * ```ts
 * import type { OaAnnotationRefusal } from "@beep/annotation/rdf/OaCodec"
 *
 * const reason: OaAnnotationRefusal = "unknown-kind"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OaAnnotationRefusal = typeof OaAnnotationRefusal.Type;

/**
 * One rejected third-party annotation: its subject and the reason. Its
 * triples are in the residual.
 *
 * **Example** (Make a rejection)
 *
 * ```ts import.meta.vitest name="Make a rejection"
 * import { OaRejection } from "@beep/annotation/rdf/OaCodec"
 * import * as Rdf from "@beep/rdf/Rdf"
 *
 * const rejection = OaRejection.make({
 *   subject: Rdf.makeNamedNode("https://example.org/annotation/1"),
 *   reason: "unknown-kind",
 * })
 * rejection.reason // => "unknown-kind"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OaRejection extends S.Opaque<OaRejection, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: Rdf.Term.annotateKey({ description: "The rejected annotation's subject in the input." }),
    reason: OaAnnotationRefusal.annotateKey({ description: "Why the annotation was rejected." }),
  }).pipe($I.annoteSchema("OaRejection", { description: "One rejected third-party annotation and its reason." }))
) {}

/**
 * Why the encoder refused a document.
 *
 * **Details**
 *
 * `capture-mismatch` when the given text is not the document's capture, or
 * an anchor's quote is not the text it ranges over; the other three are the
 * code-point conversion refusals of `@beep/text`, which verified anchors
 * never meet.
 *
 * **Example** (Check an encode refusal)
 *
 * ```ts import.meta.vitest name="Check an encode refusal"
 * import { OaEncodeRefusal } from "@beep/annotation/rdf/OaCodec"
 * import * as S from "effect/Schema"
 *
 * S.is(OaEncodeRefusal)("split-boundary") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OaEncodeRefusal = LiteralKit([
  "capture-mismatch",
  "split-boundary",
  "out-of-range",
  "ill-formed-text",
]).pipe($I.annoteSchema("OaEncodeRefusal", { description: "Why the OA encoder refused a document." }));

/**
 * Type for {@link OaEncodeRefusal}.
 *
 * **Example** (Name an encode refusal)
 *
 * ```ts
 * import type { OaEncodeRefusal } from "@beep/annotation/rdf/OaCodec"
 *
 * const reason: OaEncodeRefusal = "capture-mismatch"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OaEncodeRefusal = typeof OaEncodeRefusal.Type;

/**
 * The encoder's refusal.
 *
 * **Example** (Make an encode refusal)
 *
 * ```ts import.meta.vitest name="Make an encode refusal"
 * import { OaEncodeRefused } from "@beep/annotation/rdf/OaCodec"
 *
 * OaEncodeRefused.make({ reason: "capture-mismatch" })._tag // => "OaEncodeRefused"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OaEncodeRefused extends S.TaggedError<OaEncodeRefused, { readonly brand: unique symbol }>(
  $I`OaEncodeRefused`
)(
  "OaEncodeRefused",
  { reason: OaEncodeRefusal },
  $I.annoteError<OaEncodeRefused>("OaEncodeRefused", {
    description: "An annotation document the OA encoder cannot write over the given text.",
  })
) {}

/**
 * What a decode of third-party OA input returns: the document, the imported
 * activities its generations name, the residual dataset and the rejected
 * annotations.
 *
 * **Details**
 *
 * The residual holds every input quad the document does not carry: the
 * triples outside the profile (every `nif:` triple and every quad in a named
 * graph included) and every quad a rejected annotation reaches (its own, its
 * targets' and selectors', its runs' and the typing of its activities), even
 * when an accepted annotation that shares a target or an activity carries it
 * too. Nothing is dropped silently.
 *
 * **Example** (Read an import's parts)
 *
 * ```ts
 * import type { OaImport } from "@beep/annotation/rdf/OaCodec"
 *
 * const counts = (result: OaImport) => [result.residual.quads.length, result.rejected.length]
 * console.log(typeof counts)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OaImport extends S.Opaque<OaImport, { readonly brand: unique symbol }>()(
  S.Struct({
    document: OaDocument,
    importedActivities: S.HashMap(ActivityId, ImportedActivity).annotateKey({
      description: "The imported activities the document's generations name, keyed by imported-activity/v1.",
    }),
    residual: Rdf.Dataset,
    rejected: S.Array(OaRejection).annotateKey({ description: "The rejected annotations, ordered by subject." }),
  }).pipe(
    $I.annoteSchema("OaImport", {
      description: "An OA document read from third-party input, its imported activities, residual and rejections.",
    })
  )
) {}

const node = (value: string): Rdf.NamedNode => Rdf.makeNamedNode(value);

const term = (curie: OaProfileClass | OaProfileProperty | NifExportTerm): Rdf.NamedNode => node(iri(curie));

const V = {
  type: term("rdf:type"),
  Annotation: term("oa:Annotation"),
  SpecificResource: term("oa:SpecificResource"),
  TextPositionSelector: term("oa:TextPositionSelector"),
  TextQuoteSelector: term("oa:TextQuoteSelector"),
  Activity: term("prov:Activity"),
  hasTarget: term("oa:hasTarget"),
  hasSource: term("oa:hasSource"),
  hasSelector: term("oa:hasSelector"),
  hasBody: term("oa:hasBody"),
  start: term("oa:start"),
  end: term("oa:end"),
  exact: term("oa:exact"),
  prefix: term("oa:prefix"),
  suffix: term("oa:suffix"),
  creator: term("dcterms:creator"),
  created: term("dcterms:created"),
  generator: term("as:generator"),
  wasGeneratedBy: term("prov:wasGeneratedBy"),
  specializationOf: term("prov:specializationOf"),
  generatedAtTime: term("prov:generatedAtTime"),
  Context: term("nif:Context"),
  beginIndex: term("nif:beginIndex"),
  endIndex: term("nif:endIndex"),
  anchorOf: term("nif:anchorOf"),
  referenceContext: term("nif:referenceContext"),
};

const nifClasses: Readonly<Record<string, Rdf.NamedNode>> = {
  Sentence: term("nif:Sentence"),
  Word: term("nif:Word"),
};

const xsdInteger = iri("xsd:integer");
const xsdString = iri("xsd:string");
const xsdDateTime = iri("xsd:dateTime");

const instanceBase = namespace("instance").iri;

const instancePrefix = `${instanceBase}sha256-`;

const instanceSegment = (hash: ContentHash): string => Str.replace("sha256:", "sha256-")(hash);

const decodeContentHash = S.decodeUnknownOption(ContentHash);

/**
 * The instance IRI a content id prints as:
 * `https://beep-effect.com/ns/instance/sha256-<hex>`.
 *
 * **Details**
 *
 * Annotation, occurrence, run-entity and activity ids all print this way;
 * their domain tags keep the hashes of different brands apart.
 *
 * **Example** (Print an id)
 *
 * ```ts import.meta.vitest name="Print an id as an instance IRI"
 * import { instanceIri } from "@beep/annotation/rdf/OaCodec"
 * import { ContentHash } from "@beep/schema/ContentHash"
 *
 * instanceIri(ContentHash.make(`sha256:${"a".repeat(64)}`)) === `https://beep-effect.com/ns/instance/sha256-${"a".repeat(64)}` // => true
 * ```
 *
 * @param hash - A content id.
 * @returns Its instance IRI.
 * @category mapping
 * @since 0.0.0
 */
export const instanceIri = (hash: ContentHash): IRI => IRI.make(mint("instance", instanceSegment(hash)));

/**
 * The content id an instance IRI prints, or none for any other IRI.
 *
 * **Example** (Parse an instance IRI)
 *
 * ```ts import.meta.vitest name="Parse an instance IRI"
 * import { instanceHash, instanceIri } from "@beep/annotation/rdf/OaCodec"
 * import { IRI } from "@beep/identity/Iri"
 * import { ContentHash } from "@beep/schema/ContentHash"
 * import * as O from "effect/Option"
 *
 * const hash = ContentHash.make(`sha256:${"a".repeat(64)}`)
 * O.contains(instanceHash(instanceIri(hash)), hash) // => true
 * O.isNone(instanceHash(IRI.make("https://example.org/activity/1"))) // => true
 * ```
 *
 * @param value - An IRI.
 * @returns The content id it prints, when it is an instance IRI.
 * @category mapping
 * @since 0.0.0
 */
export const instanceHash = (value: IRI): O.Option<ContentHash> =>
  O.some(value).pipe(
    O.filter(Str.startsWith(instancePrefix)),
    O.flatMap((instance) => decodeContentHash(`sha256:${Str.slice(instancePrefix.length)(instance)}`))
  );

const instanceNode = (hash: ContentHash): Rdf.NamedNode => node(instanceIri(hash));

const selectorNode = (occurrence: OccurrenceId, selector: "position" | "quote"): Rdf.NamedNode =>
  node(mint("instance", instanceSegment(occurrence), selector));

const integerLiteral = (value: number): Rdf.Literal => Rdf.makeLiteral(`${value}`, xsdInteger);

const stringLiteral = (value: string): Rdf.Literal => Rdf.makeLiteral(value, xsdString);

// decision: oa-xsd-datetime-years
const ExpandedIsoYear = /^\+?(-?)0*(\d{4,}-)/;

const timeLiteral = (at: DateTime.Utc): Rdf.Literal =>
  Rdf.makeLiteral(at.pipe(DateTime.formatIso, Str.replace(ExpandedIsoYear, "$1$2")), xsdDateTime);

const quad = (subject: Rdf.Subject, predicate: Rdf.NamedNode, object: Rdf.ObjectTerm): Rdf.Quad =>
  Rdf.makeQuad(subject, predicate, object);

const toDataset = (quads: ReadonlyArray<Rdf.Quad>): Rdf.Dataset =>
  pipe(
    A.map(quads, (q) => [Rdf.serializeQuad(q), q] as const),
    HashMap.fromIterable,
    HashMap.values,
    A.fromIterable,
    Rdf.makeDataset,
    Rdf.sortDatasetQuads,
    Rdf.makeDataset
  );

const sameCapture = S.toEquivalence(SourceTextIdentity);

type OaAnnotation = Annotation<typeof OaKinds>;

type OaKindName = KindName<typeof OaKinds>;

type CodecOptions = { readonly source: IRI; readonly text: VerifiedSourceText };

type DecodeOptions = CodecOptions & { readonly importActivity: ImportActivity };

type EncodeInput = {
  readonly document: OaDocument;
  readonly importedActivities: HashMap.HashMap<ActivityId, ImportedActivity>;
};

const generatedBy = (run: Rdf.NamedNode, activity: Rdf.NamedNode): ReadonlyArray<Rdf.Quad> => [
  quad(run, V.wasGeneratedBy, activity),
  quad(activity, V.type, V.Activity),
];

const importedQuads = (run: Rdf.NamedNode): ((activity: ImportedActivity) => ReadonlyArray<Rdf.Quad>) =>
  ImportedActivity.match({
    Activity: ({ iri: activity }) => generatedBy(run, node(activity)),
    Creator: ({ agent }) => [quad(run, V.creator, node(agent))],
    Generator: ({ agent }) => [quad(run, V.generator, node(agent))],
  });

const targetSelectorQuads = (
  id: OccurrenceId,
  source: Rdf.NamedNode,
  start: number,
  end: number,
  exact: string
): ReadonlyArray<Rdf.Quad> => {
  const occurrence = instanceNode(id);
  const position = selectorNode(id, "position");
  const quote = selectorNode(id, "quote");
  return [
    quad(occurrence, V.type, V.SpecificResource),
    quad(occurrence, V.hasSource, source),
    quad(occurrence, V.hasSelector, position),
    quad(occurrence, V.hasSelector, quote),
    quad(position, V.type, V.TextPositionSelector),
    quad(position, V.start, integerLiteral(start)),
    quad(position, V.end, integerLiteral(end)),
    quad(quote, V.type, V.TextQuoteSelector),
    quad(quote, V.exact, stringLiteral(exact)),
  ];
};

const annotationTypeQuads = (
  kinds: typeof OaKinds,
  subject: Rdf.NamedNode,
  annotation: OaAnnotation
): ReadonlyArray<Rdf.Quad> => [
  quad(subject, V.type, V.Annotation),
  quad(subject, V.type, node(kinds[annotation._tag].iri)),
  ...(annotation._tag === "Mention" ? [quad(subject, V.hasBody, node(annotation.body.class))] : []),
];

const encodeRefused = (reason: OaEncodeRefusal): OaEncodeRefused => OaEncodeRefused.make({ reason });

const isEncodeRefusal = S.is(OaEncodeRefusal);

const fromAnchorRefused = (refused: WebAnnotationAnchorRefused): OaEncodeRefused =>
  encodeRefused(isEncodeRefusal(refused.reason) ? refused.reason : "capture-mismatch");

const isPosition = WebAnnotationSelector.guards.TextPositionSelector;

const isQuote = WebAnnotationSelector.guards.TextQuoteSelector;

/**
 * Write an annotation document over the OA kinds, with its imported
 * activities, as a ground Web Annotation dataset over `options.source`.
 *
 * **Details**
 *
 * Per annotation: `rdf:type oa:Annotation` and its kind IRI, `oa:hasBody`
 * the class of a `Mention`, and `oa:hasTarget` each target occurrence. Each
 * occurrence is an `oa:SpecificResource` on the source with a code-point
 * `oa:TextPositionSelector` and an `oa:TextQuoteSelector`, and for a
 * `Sentence` or `Word` the NIF triples on the source as `nif:Context`. Each
 * generation is a run entity with its stated time; a generation whose
 * activity is in `importedActivities` writes that activity, creator or
 * generator as the input named it, and any other writes the instance IRI of
 * its `ActivityId`, the import activity included.
 *
 * **Gotchas**
 *
 * A target whose quote is not the slice it ranges over is refused as
 * `capture-mismatch`: its receipts are not over this text.
 *
 * An anchors row no annotation targets is not written, so
 * `decode(encode(d)) = d` holds for documents whose every row is a target,
 * as `restrictToOa` leaves them. An imported activity IRI in the instance
 * form reads back as the native id it prints.
 *
 * **Example** (Encode an empty document)
 *
 * ```ts
 * import { encodeOa } from "@beep/annotation/rdf/OaCodec"
 * import { OaKinds } from "@beep/annotation/Kinds"
 * import type { OaDocument } from "@beep/annotation/Kinds"
 * import type { IRI } from "@beep/identity/Iri"
 * import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor"
 * import * as HashMap from "effect/HashMap"
 *
 * const write = (document: OaDocument, source: IRI, text: VerifiedSourceText) =>
 *   encodeOa(OaKinds)({ document, importedActivities: HashMap.empty() }, { source, text })
 * console.log(typeof write)
 * ```
 *
 * @param kinds - The OA kind registry.
 * @returns The encoder of a document and its imported activities over one source IRI and verified text.
 * @category mapping
 * @since 0.0.0
 */
export const encodeOa =
  (kinds: typeof OaKinds) =>
  (input: EncodeInput, options: CodecOptions): Result.Result<Rdf.Dataset, OaEncodeRefused> => {
    const { document, importedActivities } = input;
    if (!sameCapture(options.text.source, document.text)) {
      return Result.fail(encodeRefused("capture-mismatch"));
    }
    const source = node(options.source);
    const wireSource = IRIReference.make(options.source);
    const sourceText = options.text.sourceText;
    const annotations = HashMap.toEntries(document.annotations);
    const used = HashSet.fromIterable(A.flatMap(annotations, ([, annotation]) => A.fromIterable(annotation.targets)));
    const rows = A.filter(HashMap.toEntries(document.anchors), ([id]) => HashSet.has(used, id));
    return Result.all(
      A.map(rows, ([id, row]) =>
        textAnchorToWebAnnotationTarget(row.receipt.anchor, { source: wireSource, sourceText }).pipe(
          Result.map((target) => [id, target] as const),
          Result.mapError(fromAnchorRefused)
        )
      )
    ).pipe(
      Result.map((targets) => {
        const wireOf = HashMap.fromIterable(
          A.map(
            targets,
            ([id, target]) =>
              [
                id,
                A.map(
                  A.zip(A.filter(target.selector, isPosition), A.filter(target.selector, isQuote)),
                  ([position, quote]) => ({
                    start: position.start,
                    end: position.end,
                    quote: quote.exact,
                  })
                ),
              ] as const
          )
        );
        const targetQuads = A.flatMap(HashMap.toEntries(wireOf), ([id, wire]) =>
          A.flatMap(wire, ({ start, end, quote }) => targetSelectorQuads(id, source, start, end, quote))
        );
        const annotationQuads = A.flatMap(annotations, ([id, annotation]) => {
          const subject = instanceNode(id);
          const targetIds = A.fromIterable(annotation.targets);
          return [
            ...annotationTypeQuads(kinds, subject, annotation),
            ...A.map(targetIds, (target) => quad(subject, V.hasTarget, instanceNode(target))),
            ...A.flatMap(A.fromOption(R.get(nifClasses, annotation._tag)), (nifClass) =>
              A.flatMap(targetIds, (target) => {
                const occurrence = instanceNode(target);
                return HashMap.get(wireOf, target).pipe(
                  O.getOrElse(A.empty),
                  A.flatMap(({ start, end, quote }) => [
                    quad(occurrence, V.type, nifClass),
                    quad(occurrence, V.beginIndex, integerLiteral(start)),
                    quad(occurrence, V.endIndex, integerLiteral(end)),
                    quad(occurrence, V.anchorOf, stringLiteral(quote)),
                    quad(occurrence, V.referenceContext, source),
                    quad(source, V.type, V.Context),
                  ])
                );
              })
            ),
          ];
        });
        const attributionQuads = A.flatMap(HashMap.toEntries(document.attribution), ([id, generations]) =>
          A.flatMap(A.fromIterable(generations), (generation) => {
            const run = instanceNode(generation.run);
            return [
              quad(run, V.specializationOf, instanceNode(id)),
              ...A.map(A.fromOption(generation.at), (at) => quad(run, V.generatedAtTime, timeLiteral(at))),
              ...O.match(HashMap.get(importedActivities, generation.activity), {
                onNone: () => generatedBy(run, instanceNode(generation.activity)),
                onSome: importedQuads(run),
              }),
            ];
          })
        );
        return toDataset([...targetQuads, ...annotationQuads, ...attributionQuads]);
      })
    );
  };

type Index = {
  readonly bySubject: Readonly<Record<string, ReadonlyArray<Rdf.Quad>>>;
  readonly runsOf: Readonly<Record<string, ReadonlyArray<Rdf.Quad>>>;
  readonly annotations: ReadonlyArray<Rdf.Subject>;
};

const keyOf = Rdf.serializeTerm;

const isDefaultGraph = (q: Rdf.Quad): boolean => q.graph.termType === "DefaultGraph";

const isNode =
  (expected: Rdf.NamedNode) =>
  (term: Rdf.Term): boolean =>
    Rdf.NamedNode.is(term) && term.value === expected.value;

const bySubjectKey = Order.mapInput(Order.String, keyOf);

const indexOf = (dataset: Rdf.Dataset): Index => {
  const quads = pipe(
    A.map(A.filter(dataset.quads, isDefaultGraph), (q) => [Rdf.serializeQuad(q), q] as const),
    HashMap.fromIterable,
    HashMap.values,
    A.fromIterable
  );
  const typed = A.filter(quads, (q) => isNode(V.type)(q.predicate) && isNode(V.Annotation)(q.object));
  return {
    bySubject: A.groupBy(quads, (q) => keyOf(q.subject)),
    runsOf: A.groupBy(
      A.filter(quads, (q) => isNode(V.specializationOf)(q.predicate)),
      (q) => keyOf(q.object)
    ),
    annotations: pipe(
      A.map(typed, (q) => [keyOf(q.subject), q.subject] as const),
      HashMap.fromIterable,
      HashMap.values,
      A.fromIterable,
      A.sort(bySubjectKey)
    ),
  };
};

const statementsAbout = (index: Index, subject: string, predicate: Rdf.NamedNode): ReadonlyArray<Rdf.Quad> =>
  A.filter(O.getOrElse(R.get(index.bySubject, subject), A.empty<Rdf.Quad>), (q) => isNode(predicate)(q.predicate));

const single = <Value>(values: ReadonlyArray<Value>): O.Option<Value> =>
  values.length === 1 ? A.head(values) : O.none();

const atMostOne = <Value>(values: ReadonlyArray<Value>): Result.Result<O.Option<Value>, void> =>
  values.length <= 1 ? Result.succeed(A.head(values)) : Result.failVoid;

const literalValue = (q: Rdf.Quad): O.Option<string> =>
  O.some(q.object).pipe(
    O.filter(Rdf.Literal.is),
    O.map((literal) => literal.value)
  );

const NaturalLexical = /^(?:0|[1-9]\d*)$/;

const decodeNatural = S.decodeUnknownOption(S.Natural);

const naturalOf = (q: Rdf.Quad): O.Option<number> =>
  literalValue(q).pipe(
    O.filter((value) => NaturalLexical.test(value)),
    O.flatMap((value) => decodeNatural(Number(value)))
  );

const decodeNonEmpty = S.decodeUnknownOption(S.NonEmptyString);

// decision: oa-xsd-datetime-years
const DateTimeLexical = /^(-?)([1-9]\d{3,}|0\d{3})(-\d{2}-\d{2})(T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})?$/;

const ecmaYear = (year: number): string =>
  year >= 0 && year <= 9999
    ? Str.padStart(4, "0")(`${year}`)
    : `${year < 0 ? "-" : "+"}${Str.padStart(6, "0")(`${Math.abs(year)}`)}`;

const instantOf = (lexical: string): O.Option<DateTime.Utc> =>
  O.flatMap(
    Str.match(DateTimeLexical)(lexical),
    ([, sign = "", digits = "", date = "", clock = "", fraction = "", zone = "Z"]) => {
      const day = `${ecmaYear(Number(`${sign}${digits}`))}${date}`;
      return O.filter(DateTime.make(`${day}${clock}.${Str.padEnd(3, "0")(Str.slice(0, 3)(fraction))}${zone}`), () =>
        O.exists(DateTime.make(`${day}T00:00:00Z`), (midnight) => DateTime.formatIsoDateUtc(midnight) === day)
      );
    }
  );

const timeOf = (q: Rdf.Quad): O.Option<DateTime.Utc> =>
  O.some(q.object).pipe(
    O.filter(Rdf.Literal.is),
    O.filter((literal) => literal.datatype.value === xsdDateTime),
    O.flatMap((literal) => instantOf(literal.value))
  );

type StatedTime = {
  readonly conflict: boolean;
  readonly at: O.Option<DateTime.Utc>;
  readonly quads: ReadonlyArray<Rdf.Quad>;
};

const statedTime = (index: Index, subject: string): StatedTime => {
  const read = (predicate: Rdf.NamedNode) =>
    A.flatMap(statementsAbout(index, subject, predicate), (q) =>
      A.map(A.fromOption(timeOf(q)), (at) => [q, at] as const)
    );
  const generated = read(V.generatedAtTime);
  const created = read(V.created);
  const times = A.dedupeWith(
    A.map(A.isReadonlyArrayNonEmpty(generated) ? generated : created, ([, at]) => at),
    DateTime.Equivalence
  );
  return {
    conflict: times.length > 1,
    at: A.head(times),
    quads: A.map(A.appendAll(generated, created), ([q]) => q),
  };
};

type ReadGeneration = {
  readonly activity: ActivityId;
  readonly imported: O.Option<ImportedActivity>;
  readonly at: O.Option<DateTime.Utc>;
};

type Statement = {
  readonly generation: ReadGeneration;
  readonly quads: ReadonlyArray<Rdf.Quad>;
};

const namedObjects = (
  index: Index,
  subject: string,
  predicate: Rdf.NamedNode
): ReadonlyArray<readonly [Rdf.Quad, Rdf.NamedNode]> =>
  A.flatMap(statementsAbout(index, subject, predicate), (q) =>
    A.map(A.filter([q.object], Rdf.NamedNode.is), (object) => [q, object] as const)
  );

const importedStatement = (activity: ImportedActivity, at: O.Option<DateTime.Utc>, quads: ReadonlyArray<Rdf.Quad>) =>
  Effect.map(
    mintImportedActivityId(activity),
    (id): Statement => ({ generation: { activity: id, imported: O.some(activity), at }, quads })
  );

const readStatements = Effect.fnUntraced(function* (index: Index, subject: string, at: O.Option<DateTime.Utc>) {
  const activities = yield* Effect.forEach(
    namedObjects(index, subject, V.wasGeneratedBy),
    ([q, activity]) => {
      const typing = A.filter(statementsAbout(index, keyOf(activity), V.type), (t) => isNode(V.Activity)(t.object));
      return O.match(instanceHash(activity.value), {
        onNone: () =>
          importedStatement(ImportedActivity.cases.Activity.make({ iri: activity.value }), at, [q, ...typing]),
        onSome: (hash) =>
          Effect.succeed<Statement>({
            generation: { activity: ActivityId.make(hash), imported: O.none(), at },
            quads: [q, ...typing],
          }),
      });
    },
    { concurrency: 1 }
  );
  const creators = yield* Effect.forEach(
    namedObjects(index, subject, V.creator),
    ([q, agent]) => importedStatement(ImportedActivity.cases.Creator.make({ agent: agent.value }), at, [q]),
    { concurrency: 1 }
  );
  const generators = yield* Effect.forEach(
    namedObjects(index, subject, V.generator),
    ([q, agent]) => importedStatement(ImportedActivity.cases.Generator.make({ agent: agent.value }), at, [q]),
    { concurrency: 1 }
  );
  return [...activities, ...creators, ...generators];
});

class Rejected extends S.TaggedError<Rejected, { readonly brand: unique symbol }>($I`Rejected`)(
  "Rejected",
  { reason: OaAnnotationRefusal },
  $I.annoteError<Rejected>("Rejected", { description: "One third-party annotation the shared rule rejects." })
) {}

const reject = (reason: OaAnnotationRefusal): Rejected => Rejected.make({ reason });

const refuseTarget = (): Rejected => reject("target-refused");

type ReadTarget = {
  readonly id: OccurrenceId;
  readonly row: Anchored;
  readonly quads: ReadonlyArray<Rdf.Quad>;
};

type ReadSelector = {
  readonly selector: WebAnnotationSelector;
  readonly quads: ReadonlyArray<Rdf.Quad>;
};

type Build = (targets: HashSet.HashSet<OccurrenceId>) => OaAnnotation;

type Candidate = {
  readonly subject: Rdf.Subject;
  readonly content: AnnotationId;
  readonly annotation: OaAnnotation;
  readonly targets: ReadonlyArray<ReadTarget>;
  readonly generations: ReadonlyArray<ReadGeneration>;
  readonly consumed: ReadonlyArray<Rdf.Quad>;
};

const decodeTermIri = S.decodeUnknownOption(TermIri);

const emptyBody =
  (build: Build) =>
  (bodies: ReadonlyArray<Rdf.Quad>): O.Option<Build> =>
    A.isReadonlyArrayEmpty(bodies) ? O.some(build) : O.none();

const bodyReaders = (
  kinds: typeof OaKinds
): { readonly [K in OaKindName]: (bodies: ReadonlyArray<Rdf.Quad>) => O.Option<Build> } => ({
  Mention: (bodies) =>
    single(bodies).pipe(
      O.map((q) => q.object),
      O.filter(Rdf.NamedNode.is),
      O.flatMap((body) => decodeTermIri(body.value)),
      O.map(
        (klass): Build =>
          (targets) =>
            kinds.Mention.case.make({ targets, body: Mention.make({ class: klass }) })
      )
    ),
  Title: emptyBody((targets) => kinds.Title.case.make({ targets, body: Title.make({}) })),
  Paragraph: emptyBody((targets) => kinds.Paragraph.case.make({ targets, body: Paragraph.make({}) })),
  Sentence: emptyBody((targets) => kinds.Sentence.case.make({ targets, body: Sentence.make({}) })),
  Word: emptyBody((targets) => kinds.Word.case.make({ targets, body: Word.make({}) })),
});

const readSelector = (index: Index, link: Rdf.Quad): Result.Result<O.Option<ReadSelector>, Rejected> => {
  const subject = keyOf(link.object);
  const types = statementsAbout(index, subject, V.type);
  const positionTypes = A.filter(types, (q) => isNode(V.TextPositionSelector)(q.object));
  const quoteTypes = A.filter(types, (q) => isNode(V.TextQuoteSelector)(q.object));
  const about = (predicate: Rdf.NamedNode) => statementsAbout(index, subject, predicate);
  if (A.isReadonlyArrayNonEmpty(positionTypes) && A.isReadonlyArrayNonEmpty(quoteTypes)) {
    return Result.fail(refuseTarget());
  }
  if (A.isReadonlyArrayNonEmpty(positionTypes)) {
    const starts = about(V.start);
    const ends = about(V.end);
    return O.all([O.flatMap(single(starts), naturalOf), O.flatMap(single(ends), naturalOf)]).pipe(
      O.map(([start, end]) =>
        O.some({
          selector: WebAnnotationTextPositionSelector.make({ type: "TextPositionSelector", start, end }),
          quads: [link, ...positionTypes, ...starts, ...ends],
        })
      ),
      Result.fromOption(refuseTarget)
    );
  }
  if (A.isReadonlyArrayNonEmpty(quoteTypes)) {
    const exacts = about(V.exact);
    const prefixes = about(V.prefix);
    const suffixes = about(V.suffix);
    const literalOf = (quads: ReadonlyArray<Rdf.Quad>) =>
      Result.flatMap(atMostOne(quads), (only) =>
        O.match(only, {
          onNone: () => Result.succeedNone,
          onSome: (q) => Result.map(Result.fromOption(literalValue(q), refuseTarget), O.some),
        })
      );
    return Result.all({
      exact: Result.fromOption(O.flatMap(O.flatMap(single(exacts), literalValue), decodeNonEmpty), refuseTarget),
      prefix: literalOf(prefixes),
      suffix: literalOf(suffixes),
    }).pipe(
      Result.mapError(refuseTarget),
      Result.map(({ exact, prefix, suffix }) =>
        O.some({
          selector: WebAnnotationTextQuoteSelector.make({ type: "TextQuoteSelector", exact, prefix, suffix }),
          quads: [link, ...quoteTypes, ...exacts, ...prefixes, ...suffixes],
        })
      )
    );
  }
  return Result.succeedNone;
};

const pairKey = (content: AnnotationId, activity: ActivityId): string => `${content} ${activity}`;

const timeKey = (at: O.Option<DateTime.Utc>): string =>
  O.match(at, { onNone: () => "none", onSome: (instant) => `${DateTime.toEpochMillis(instant)}` });

const generationKey = (generation: ReadGeneration): string => `${generation.activity} ${timeKey(generation.at)}`;

const conflictingPairs = (candidates: ReadonlyArray<Candidate>): HashSet.HashSet<string> => {
  const pairs = A.flatMap(candidates, (candidate) =>
    A.map(
      candidate.generations,
      (generation) => [pairKey(candidate.content, generation.activity), timeKey(generation.at)] as const
    )
  );
  return HashSet.fromIterable(
    A.flatMap(R.values(A.groupBy(pairs, ([pair]) => pair)), (group) =>
      A.dedupe(A.map(group, ([, time]) => time)).length > 1 ? [A.headNonEmpty(group)[0]] : []
    )
  );
};

type Profile = {
  readonly accepted: ReadonlyArray<Candidate>;
  readonly rejected: ReadonlyArray<OaRejection>;
  readonly retained: ReadonlyArray<Rdf.Quad>;
};

const reachedQuads = (index: Index, subject: Rdf.Term): ReadonlyArray<Rdf.Quad> => {
  const about = (node: string) => O.getOrElse(R.get(index.bySubject, node), A.empty<Rdf.Quad>);
  const objects = (nodes: ReadonlyArray<string>, predicate: Rdf.NamedNode) =>
    A.flatMap(nodes, (node) => A.map(statementsAbout(index, node, predicate), (q) => keyOf(q.object)));
  const annotation = keyOf(subject);
  const targets = objects([annotation], V.hasTarget);
  const runs = A.map(O.getOrElse(R.get(index.runsOf, annotation), A.empty<Rdf.Quad>), (q) => keyOf(q.subject));
  return [
    ...A.flatMap([annotation, ...targets, ...objects(targets, V.hasSelector), ...runs], about),
    ...A.flatMap(objects([annotation, ...runs], V.wasGeneratedBy), (activity) =>
      A.filter(statementsAbout(index, activity, V.type), (q) => isNode(V.Activity)(q.object))
    ),
  ];
};

const readProfile = (kinds: typeof OaKinds) => {
  const readers = bodyReaders(kinds);
  const kindEntries = R.toEntries(kinds);
  const mintAnnotation = mintAnnotationId(kinds);
  return Effect.fnUntraced(function* (
    input: Rdf.Dataset,
    options: DecodeOptions
  ): Effect.fn.Return<Profile, PreimageMintError, Digest.Digest> {
    const index = indexOf(input);
    const importActivity = yield* mintImportActivityId(options.importActivity.sourceDigest);
    const isSource = (object: Rdf.Term): boolean => Rdf.NamedNode.is(object) && object.value === options.source;
    const wireSource = IRIReference.make(options.source);

    const readTarget = Effect.fnUntraced(function* (link: Rdf.Quad) {
      const subject = keyOf(link.object);
      const sources = statementsAbout(index, subject, V.hasSource);
      if (A.isReadonlyArrayEmpty(sources)) {
        return yield* refuseTarget();
      }
      const resourceTypes = A.filter(statementsAbout(index, subject, V.type), (q) =>
        isNode(V.SpecificResource)(q.object)
      );
      const selectors = yield* Effect.fromResult(
        Result.all(A.map(statementsAbout(index, subject, V.hasSelector), (q) => readSelector(index, q)))
      );
      const profileSelectors = A.flatMap(selectors, A.fromOption);
      if (A.isReadonlyArrayEmpty(profileSelectors)) {
        return yield* refuseTarget();
      }
      const anchor = yield* Effect.fromResult(
        webAnnotationTargetToTextAnchor(
          WebAnnotationTarget.make({ source: wireSource, selector: A.map(profileSelectors, (s) => s.selector) }),
          options.text.sourceText
        )
      ).pipe(Effect.mapError(refuseTarget));
      // decision: oa-decode-invariant-defects
      const verified = yield* Effect.orDie(
        verifyTextAnchorAgainstVerifiedSource(
          VerifyTextAnchorAgainstVerifiedSourceInput.make({ anchor, verifiedSource: options.text })
        )
      );
      const row = Anchored.make({ receipt: toTextAnchorVerificationReceipt(verified) });
      const id = yield* mintOccurrenceId(row);
      return {
        id,
        row,
        quads: [link, ...sources, ...resourceTypes, ...A.flatMap(profileSelectors, (s) => s.quads)],
      } satisfies ReadTarget;
    });

    const readAttribution = Effect.fnUntraced(function* (key: string) {
      const own = statedTime(index, key);
      const runLinks = O.getOrElse(R.get(index.runsOf, key), A.empty<Rdf.Quad>);
      const runs = yield* Effect.forEach(
        runLinks,
        (link) => {
          const run = keyOf(link.subject);
          const time = statedTime(index, run);
          return Effect.map(readStatements(index, run, time.at), (statements) => ({ link, time, statements }));
        },
        { concurrency: 1 }
      );
      if (own.conflict || A.some(runs, (run) => run.time.conflict)) {
        return yield* reject("time-conflict");
      }
      const ownStatements = yield* readStatements(index, key, own.at);
      const attributedRuns = A.filter(runs, (run) => A.isReadonlyArrayNonEmpty(run.statements));
      const stated = [...ownStatements, ...A.flatMap(attributedRuns, (run) => run.statements)];
      const unattributed = A.isReadonlyArrayEmpty(stated);
      const generations = unattributed
        ? [{ activity: importActivity, imported: O.none(), at: own.at }]
        : A.map(stated, (statement) => statement.generation);
      return {
        generations,
        consumed: [
          ...A.flatMap(stated, (statement) => statement.quads),
          ...A.flatMap(attributedRuns, (run) => [run.link, ...run.time.quads]),
          ...(A.isReadonlyArrayNonEmpty(ownStatements) || unattributed ? own.quads : []),
        ],
      };
    });

    const readAnnotation = Effect.fnUntraced(function* (subject: Rdf.Subject) {
      const key = keyOf(subject);
      const about = (predicate: Rdf.NamedNode) => statementsAbout(index, key, predicate);
      const targetLinks = about(V.hasTarget);
      const sourceQuads = A.flatMap(targetLinks, (link) => statementsAbout(index, keyOf(link.object), V.hasSource));
      if (!A.every(sourceQuads, (q) => isSource(q.object))) {
        return yield* reject("other-source");
      }
      const typeQuads = about(V.type);
      const kind = single(A.filter(typeQuads, (q) => !isNode(V.Annotation)(q.object))).pipe(
        O.flatMap((q) => A.findFirst(kindEntries, ([, entry]) => isNode(node(entry.iri))(q.object)))
      );
      if (O.isNone(kind)) {
        return yield* reject("unknown-kind");
      }
      const [name] = kind.value;
      const bodyQuads = about(V.hasBody);
      const build = readers[name](bodyQuads);
      if (O.isNone(build)) {
        return yield* reject("body-refused");
      }
      if (A.isReadonlyArrayEmpty(targetLinks)) {
        return yield* refuseTarget();
      }
      const targets = yield* Effect.forEach(targetLinks, readTarget, { concurrency: 1 });

      const attribution = yield* readAttribution(key);
      const annotation = build.value(HashSet.fromIterable(A.map(targets, (target) => target.id)));
      const content = yield* mintAnnotation(annotation);
      return {
        subject,
        content,
        annotation,
        targets,
        generations: attribution.generations,
        consumed: [
          ...typeQuads,
          ...bodyQuads,
          ...A.flatMap(targets, (target) => target.quads),
          ...attribution.consumed,
        ],
      } satisfies Candidate;
    });

    const read = yield* Effect.forEach(
      index.annotations,
      (subject) =>
        readAnnotation(subject).pipe(
          Effect.map(Result.succeed),
          Effect.catchTag("Rejected", (rejected) =>
            Effect.succeed(Result.fail(OaRejection.make({ subject, reason: rejected.reason })))
          )
        ),
      { concurrency: 1 }
    );
    const candidates = A.getSuccesses(read);
    const conflicting = conflictingPairs(candidates);
    const isConflicting = (candidate: Candidate): boolean =>
      A.some(candidate.generations, (generation) =>
        HashSet.has(conflicting, pairKey(candidate.content, generation.activity))
      );
    const rejected = A.sort(
      [
        ...A.getFailures(read),
        ...A.map(A.filter(candidates, isConflicting), (candidate) =>
          OaRejection.make({ subject: candidate.subject, reason: "time-conflict" })
        ),
      ],
      Order.mapInput(bySubjectKey, (rejection: OaRejection) => rejection.subject)
    );
    return {
      accepted: A.filter(candidates, (candidate) => !isConflicting(candidate)),
      rejected,
      retained: A.flatMap(rejected, (rejection) => reachedQuads(index, rejection.subject)),
    };
  });
};

/**
 * Read third-party OA input over one source and verified text into an
 * {@link OaDocument}, its imported activities, the residual and the
 * rejections.
 *
 * **Details**
 *
 * Every `oa:Annotation` in the default graph is read: its kind from its one
 * other `rdf:type`, its body from `oa:hasBody`, its targets through the
 * position and quote selectors, each verified against `options.text`. Every
 * key is minted from content; no annotation, occurrence or run IRI is read
 * as an id. Each `prov:wasGeneratedBy`, `dcterms:creator` and
 * `as:generator` statement with an IRI object, on the annotation or on a run
 * that specializes it, gives one generation at its subject's stated time
 * (`prov:generatedAtTime`, else `dcterms:created`); an instance-form
 * activity IRI is the native id it prints, any other is an
 * {@link ImportedActivity}. An annotation with no statement gets one
 * generation of the import activity. The document is the merge of one
 * `assemble` per distinct (activity, time).
 *
 * **Gotchas**
 *
 * What the document carries leaves the residual, except what a rejected
 * annotation reaches: the quads about it, its targets, their selectors and
 * the runs that specialize it, and the typing of each activity it or one of
 * its runs names. An accepted annotation that shares a target or an activity
 * carries some of those quads too; they stay in the residual.
 *
 * **Example** (Decode input)
 *
 * ```ts
 * import { decodeOa } from "@beep/annotation/rdf/OaCodec"
 * import type { ImportActivity } from "@beep/annotation/rdf/OaCodec"
 * import { OaKinds } from "@beep/annotation/Kinds"
 * import type { IRI } from "@beep/identity/Iri"
 * import type * as Rdf from "@beep/rdf/Rdf"
 * import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor"
 *
 * const read = (dataset: Rdf.Dataset, source: IRI, text: VerifiedSourceText, importActivity: ImportActivity) =>
 *   decodeOa(OaKinds)(dataset, { source, text, importActivity })
 * console.log(typeof read)
 * ```
 *
 * @param kinds - The OA kind registry.
 * @returns The decoder of one dataset over a source IRI, its verified text and the import activity.
 * @category mapping
 * @since 0.0.0
 */
export const decodeOa = (kinds: typeof OaKinds) => {
  const read = readProfile(kinds);
  const codec = makeDocumentCodec({ schema: OaDocument, kinds });
  return Effect.fn("OaCodec.decode")(function* (
    input: Rdf.Dataset,
    options: DecodeOptions
  ): Effect.fn.Return<OaImport, PreimageMintError, Digest.Digest> {
    const { accepted, rejected, retained } = yield* read(input, options);
    const consumed = HashSet.difference(
      HashSet.fromIterable(A.flatMap(accepted, (candidate) => A.map(candidate.consumed, Rdf.serializeQuad))),
      HashSet.fromIterable(A.map(retained, Rdf.serializeQuad))
    );
    const groups = A.groupBy(
      A.flatMap(accepted, (candidate) =>
        A.map(
          A.dedupeWith(candidate.generations, (l, r) => generationKey(l) === generationKey(r)),
          (generation) => ({
            generation,
            candidate,
          })
        )
      ),
      ({ generation }) => generationKey(generation)
    );
    // decision: oa-decode-invariant-defects
    const parts = yield* Effect.forEach(
      R.values(groups),
      (members) =>
        codec
          .assemble({
            text: options.text.source,
            generation: A.headNonEmpty(members).generation,
            anchors: A.flatMap(members, ({ candidate }) => A.map(candidate.targets, (target) => target.row)),
            annotations: A.map(members, ({ candidate }) => candidate.annotation),
          })
          .pipe(Effect.orDie),
      { concurrency: 1 }
    );
    const empty = OaDocument.make({
      text: options.text.source,
      anchors: HashMap.empty(),
      annotations: HashMap.empty(),
      attribution: HashMap.empty(),
    });
    const document = yield* Effect.orDie(
      Effect.reduce(parts, constant(empty), (merged, part) => Effect.fromResult(merge(merged, part)))
    );
    return OaImport.make({
      document,
      importedActivities: HashMap.fromIterable(
        A.flatMap(accepted, (candidate) =>
          A.flatMap(candidate.generations, (generation) =>
            A.map(A.fromOption(generation.imported), (imported) => [generation.activity, imported] as const)
          )
        )
      ),
      residual: Rdf.makeDataset(A.filter(input.quads, (q) => !HashSet.has(consumed, Rdf.serializeQuad(q)))),
      rejected,
    });
  });
};

const normalizedQuads = (kinds: typeof OaKinds, source: Rdf.NamedNode, sourceText: string) =>
  Effect.fnUntraced(function* (candidate: Candidate) {
    const subject = instanceNode(candidate.content);
    const annotation = candidate.annotation;
    const nifClass = A.fromOption(R.get(nifClasses, annotation._tag));
    const targetQuads = A.flatMap(candidate.targets, ({ id, row }) => {
      const occurrence = instanceNode(id);
      const points = Result.getOrThrow(convertPosition(Anchored.range(row), "unicode-code-point", sourceText));
      return [
        quad(subject, V.hasTarget, occurrence),
        ...targetSelectorQuads(id, source, points.start, points.end, Anchored.quote(row)),
        ...A.flatMap(nifClass, (klass) => [
          quad(occurrence, V.type, klass),
          quad(occurrence, V.beginIndex, integerLiteral(points.start)),
          quad(occurrence, V.endIndex, integerLiteral(points.end)),
          quad(occurrence, V.anchorOf, stringLiteral(Anchored.quote(row))),
          quad(occurrence, V.referenceContext, source),
          quad(source, V.type, V.Context),
        ]),
      ];
    });
    const runQuads = yield* Effect.forEach(
      candidate.generations,
      (generation) =>
        Effect.map(mintRunEntityId(candidate.content, generation.activity), (id) => {
          const run = instanceNode(id);
          return [
            quad(run, V.specializationOf, subject),
            ...A.map(A.fromOption(generation.at), (at) => quad(run, V.generatedAtTime, timeLiteral(at))),
            ...O.match(generation.imported, {
              onNone: () => generatedBy(run, instanceNode(generation.activity)),
              onSome: importedQuads(run),
            }),
          ];
        }),
      { concurrency: 1 }
    );
    return [...annotationTypeQuads(kinds, subject, annotation), ...targetQuads, ...A.flatten(runQuads)];
  });

/**
 * The profile projection of third-party OA input in the encoder's form:
 * `encode(decode(s))` equals `normalize(s)` as quad sets (`L2-6`).
 *
 * **Details**
 *
 * It projects the input to the profile over `options.source`, leaving out
 * what the shared rule rejects; renames every annotation to the instance IRI
 * of its re-minted id and every target and selector to its occurrence form;
 * completes both selectors and drops `oa:prefix` and `oa:suffix`; writes each
 * generation as the encoder's run entity, `dcterms:created` as its
 * `prov:generatedAtTime` and an unattributed annotation's as the import run;
 * and adds the NIF triples of `Sentence` and `Word`. It shares the reading
 * rule with {@link decodeOa} and builds no document.
 *
 * **Example** (Normalize input)
 *
 * ```ts
 * import { normalize } from "@beep/annotation/rdf/OaCodec"
 * import type { ImportActivity } from "@beep/annotation/rdf/OaCodec"
 * import type { IRI } from "@beep/identity/Iri"
 * import type * as Rdf from "@beep/rdf/Rdf"
 * import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor"
 *
 * const project = (dataset: Rdf.Dataset, source: IRI, text: VerifiedSourceText, importActivity: ImportActivity) =>
 *   normalize(dataset, { source, text, importActivity })
 * console.log(typeof project)
 * ```
 *
 * @param input - Third-party OA input.
 * @param options - The source IRI, its verified text and the import activity.
 * @returns The normalized dataset.
 * @category mapping
 * @since 0.0.0
 */
export const normalize = Effect.fnUntraced(function* (
  input: Rdf.Dataset,
  options: DecodeOptions
): Effect.fn.Return<Rdf.Dataset, PreimageMintError, Digest.Digest> {
  const { accepted } = yield* readProfile(OaKinds)(input, options);
  const quads = yield* Effect.forEach(
    accepted,
    normalizedQuads(OaKinds, node(options.source), options.text.sourceText),
    {
      concurrency: 1,
    }
  );
  return toDataset(A.flatten(quads));
});
