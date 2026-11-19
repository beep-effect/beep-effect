/**
 * L6 interchange: the three-case RDF literal, the dataset as a set of quads
 * with a canonical digest and isomorphism equality, and the declared OA
 * profile with the result type of decoding third-party OA input.
 *
 * Target homes: `Literal`, `Dataset`, `DatasetDigest` in `@beep/rdf`; the OA
 * profile and import result in the `@beep/annotation/rdf` adapter subpath
 * (decision 2026-11-19-p0-item7-oa-profile).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { IRI } from "@beep/rdf/Iri";
import * as Rdf from "@beep/rdf/Rdf";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { ActivityId, ContentHash, DomainTag, Instant, mintContentHash } from "./L0.identity.ts";
import { AnnotationDocumentChecks, AnnotationDocumentView } from "./L2.annotation.ts";
import type { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import type * as Digest from "effect/crypto/Digest";
import type * as Result from "effect/Result";
import type { KindRegistry } from "./L2.annotation.ts";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L6.interchange");

/** A simple literal: a string with neither datatype nor language (it is the xsd:string literal). */
export class SimpleLiteral extends S.Opaque<SimpleLiteral, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Simple", { value: S.String }).pipe(
    $I.annoteSchema("SimpleLiteral", { description: "An RDF literal of datatype xsd:string." })
  )
) {}

const ReservedDatatypes = HashSet.make(
  "http://www.w3.org/2001/XMLSchema#string",
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString"
);

/** A datatyped literal; xsd:string is Simple and rdf:langString is LangTagged, so neither is allowed here. */
export class TypedLiteral extends S.Opaque<TypedLiteral, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Typed", { value: S.String, datatype: Rdf.NamedNode })
    .check(
      S.makeFilter(
        (literal: { readonly datatype: Rdf.NamedNode }) => !HashSet.has(ReservedDatatypes, literal.datatype.value),
        $I.annote("TypedLiteralDatatypeCheck", {
          title: "Typed Literal Datatype",
          description: "A Typed literal never uses xsd:string or rdf:langString, so each literal has one encoding.",
          message: "Expected a datatype other than xsd:string and rdf:langString.",
        })
      )
    )
    .pipe(
      $I.annoteSchema("TypedLiteral", { description: "An RDF literal with a datatype other than the two reserved." })
    )
) {}

/** A language-tagged literal (datatype rdf:langString). */
export class LangTaggedLiteral extends S.Opaque<LangTaggedLiteral, { readonly brand: unique symbol }>()(
  S.TaggedStruct("LangTagged", { value: S.String, language: Rdf.LanguageTag }).pipe(
    $I.annoteSchema("LangTaggedLiteral", { description: "An RDF literal with a language tag." })
  )
) {}

/** An RDF literal: Simple, Typed or LangTagged, with exactly one encoding per RDF literal term. */
export const Literal = S.Union([SimpleLiteral, TypedLiteral, LangTaggedLiteral]).pipe(
  $I.annoteSchema("Literal", { description: "RDF literal as Simple | Typed | LangTagged." }),
  S.toTaggedUnion("_tag")
);

/** Decoded type of {@link Literal}. */
export type Literal = typeof Literal.Type;

/** An RDF object term over the three-case literal. */
export const ObjectTerm = S.Union([Rdf.NamedNode, Rdf.BlankNode, Literal]).pipe(
  $I.annoteSchema("ObjectTerm", { description: "Named node, blank node or literal in object position." })
);

/** Decoded type of {@link ObjectTerm}. */
export type ObjectTerm = typeof ObjectTerm.Type;

/** One quad over the three-case literal. */
export class Quad extends S.Opaque<Quad, { readonly brand: unique symbol }>()(
  S.Struct({
    subject: Rdf.Subject,
    predicate: Rdf.NamedNode,
    object: ObjectTerm,
    graph: Rdf.GraphTerm,
  }).pipe($I.annoteSchema("Quad", { description: "An RDF quad." }))
) {}

/** An RDF dataset: a set of quads, with equality up to blank-node isomorphism (L6-1). */
export class Dataset extends S.Opaque<Dataset, { readonly brand: unique symbol }>()(
  S.Struct({
    quads: S.HashSet(Quad),
  }).pipe($I.annoteSchema("Dataset", { description: "A set of quads; equality is the isomorphism quotient." }))
) {}

/** Digest of a dataset's canonical form; equal for isomorphic datasets. */
export const DatasetDigest = ContentHash.pipe(
  S.brand("DatasetDigest"),
  $I.annoteSchema("DatasetDigest", { description: "Content hash of the canonical form of a dataset." })
);

/** Decoded type of {@link DatasetDigest}. */
export type DatasetDigest = typeof DatasetDigest.Type;

/** Digest a dataset on its canonical form (blank nodes canonically relabelled). */
export declare const canonicalDigest: (
  dataset: Dataset
) => Effect.Effect<DatasetDigest, JsoncCanonicalizeError, Digest.Digest>;

/** Equality of datasets up to blank-node isomorphism. */
export declare const isIsomorphic: {
  (that: Dataset): (self: Dataset) => boolean;
  (self: Dataset, that: Dataset): boolean;
};

/** Classes the OA codec supports (decision item 7); nothing else is decoded into a document. */
export const OaProfileClass = LiteralKit([
  "oa:Annotation",
  "oa:SpecificResource",
  "oa:TextPositionSelector",
  "oa:TextQuoteSelector",
  "prov:Activity",
]).pipe($I.annoteSchema("OaProfileClass", { description: "Classes of the declared OA profile." }));

/** Decoded type of {@link OaProfileClass}. */
export type OaProfileClass = typeof OaProfileClass.Type;

/** Properties the OA codec supports (decision item 7). */
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
]).pipe($I.annoteSchema("OaProfileProperty", { description: "Properties of the declared OA profile." }));

/** Decoded type of {@link OaProfileProperty}. */
export type OaProfileProperty = typeof OaProfileProperty.Type;

/** NIF terms the codec emits for the Sentence and Word kinds; export only, never decoded. */
export const NifExportTerm = LiteralKit([
  "nif:Sentence",
  "nif:Word",
  "nif:beginIndex",
  "nif:endIndex",
  "nif:anchorOf",
  "nif:referenceContext",
]).pipe($I.annoteSchema("NifExportTerm", { description: "Export-only NIF vocabulary." }));

/** Decoded type of {@link NifExportTerm}. */
export type NifExportTerm = typeof NifExportTerm.Type;

/** Domain tag of an imported activity id. */
export const ImportedActivityDomainTag = DomainTag.make("imported-activity/v1");

/** An activity the input named by IRI; it keeps that IRI and the stated time when one is given. */
export class ImportedActivity extends S.Opaque<ImportedActivity, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: IRI.annotateKey({ description: "Activity IRI as it appeared in the input." }),
    statedAt: S.OptionFromOptionalKey(Instant).annotateKey({ description: "Time the input stated, when given." }),
  }).pipe($I.annoteSchema("ImportedActivity", { description: "A third-party prov:Activity kept with its IRI." }))
) {}

/** Domain tag of the import activity id (round-one ruling 4). */
export const ImportActivityDomainTag = DomainTag.make("import-activity/v1");

/**
 * The import itself: a prov:Activity over the source document digest, timed
 * at import. Its id is minted from the digest alone ({@link mintImportActivityId}),
 * with the time outside the id, so `normalize(s)` is a function of the input.
 */
export class ImportActivity extends S.Opaque<ImportActivity, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceDigest: Sha256PrefixedDigest.annotateKey({ description: "Digest of the imported RDF document." }),
    importedAt: Instant,
  }).pipe($I.annoteSchema("ImportActivity", { description: "Attribution for unattributed imported annotations." }))
) {}

/** Mint the import activity id: hash of (import-activity/v1, source document digest). */
export const mintImportActivityId = Effect.fn("ImportActivity.mint")(function* (
  sourceDigest: Sha256PrefixedDigest
): Effect.fn.Return<ActivityId, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(ImportActivityDomainTag, [sourceDigest]);
  return ActivityId.make(hash);
});

/** Mint the id of an activity the input named by IRI: hash of (imported-activity/v1, IRI). */
export const mintImportedActivityId = Effect.fn("ImportedActivity.mint")(function* (
  iri: IRI
): Effect.fn.Return<ActivityId, JsoncCanonicalizeError, Digest.Digest> {
  const hash = yield* mintContentHash(ImportedActivityDomainTag, [iri]);
  return ActivityId.make(hash);
});

/**
 * The result of decoding third-party OA input over a caller's document
 * schema: the document, the imported activities, the import activity, and
 * the residual dataset holding every triple outside the profile.
 */
export const makeOaImport = <Document extends S.Top>(document: Document) =>
  S.Struct({
    document,
    importedActivities: S.HashMap(ActivityId, ImportedActivity),
    importActivity: ImportActivity,
    residual: Dataset,
  });

/** The import result over the kind-independent document view. */
export class OaImport extends S.Opaque<OaImport, { readonly brand: unique symbol }>()(
  makeOaImport(AnnotationDocumentView.check(AnnotationDocumentChecks)).pipe(
    $I.annoteSchema("OaImport", { description: "Document, imported activities, import activity and residual dataset." })
  )
) {}

/** Why OA input could not be decoded into a document over the profile. */
export const OaDecodeRefusal = LiteralKit([
  "unresolvable-target",
  "unknown-kind",
  "capture-mismatch",
  "split-boundary",
]).pipe($I.annoteSchema("OaDecodeRefusal", { description: "Reason OA input was refused." }));

/** Decoded type of {@link OaDecodeRefusal}. */
export type OaDecodeRefusal = typeof OaDecodeRefusal.Type;

/** Typed refusal of OA input, following L1's UnitConversionRefused. */
export class OaDecodeRefused extends S.TaggedError<OaDecodeRefused, { readonly brand: unique symbol }>(
  $I`OaDecodeRefused`
)(
  "OaDecodeRefused",
  { reason: OaDecodeRefusal },
  $I.annoteError<OaDecodeRefused>("OaDecodeRefused", { description: "OA input outside what the codec admits." })
) {}

/**
 * Encode a document to the profile's dataset (L2-6: decode(encode(d)) = d).
 * `oa:start` and `oa:end` are Unicode code points on the wire; the codec
 * converts from the stored utf16-code-unit through `convertPosition`
 * (round-one ruling 3).
 */
export declare const encodeOa: (kinds: KindRegistry) => (document: AnnotationDocumentView) => Dataset;

/**
 * Decode third-party input; unattributed annotations get the import activity
 * (L2-6: encode(decode(s)) = normalize(s)). Code-point offsets convert to
 * utf16-code-unit and a split surrogate refuses with `split-boundary`. The
 * returned document satisfies the document checks, `referencesResolve(kinds)`
 * holds on it, and `verifyDocument(kinds)` has run on it.
 */
export declare const decodeOa: (
  kinds: KindRegistry
) => (input: Dataset) => Effect.Effect<OaImport, OaDecodeRefused | JsoncCanonicalizeError, Digest.Digest>;

/** Project to the profile, add the import attribution to unattributed annotations, take the canonical form. */
export declare const normalize: (
  importActivity: ImportActivity
) => (input: Dataset) => Result.Result<Dataset, OaDecodeRefused>;
