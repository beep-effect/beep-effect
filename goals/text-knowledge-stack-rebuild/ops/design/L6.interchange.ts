/**
 * L6 interchange: the three-case RDF literal, the dataset as a set of quads
 * with a canonical digest and isomorphism equality.
 *
 * Owner packages: `Literal`, `Dataset`, `DatasetDigest` and `NamespacePin` in
 * `@beep/rdf` (the pin by decision p0-l0-split-by-dependency); the OA
 * profile and import result have moved to `@beep/annotation/rdf/OaCodec`
 * (decision 2026-11-19-p0-item7-oa-profile).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { SafePnPrefix } from "@beep/identity/PnLocal";
import { $RepoCliId } from "@beep/identity/packages";
import * as Rdf from "@beep/rdf/Rdf";
import { ContentHash } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { SpdxExpression } from "@beep/spdx/SpdxExpression";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import type { JsoncCanonicalizeError } from "@beep/jsonc/JsoncFingerprint";
import type * as Digest from "effect/crypto/Digest";
import type * as Effect from "effect/Effect";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L6.interchange");

/** Where a pinned vocabulary was fetched from and at which revision. */
export class PinnedSource extends S.Opaque<PinnedSource, { readonly brand: unique symbol }>()(
  S.Struct({
    location: IRI.annotateKey({ description: "Retrieval IRI of the vocabulary artifact." }),
    revision: S.NonEmptyString.annotateKey({ description: "Upstream revision, tag or edition the pin names." }),
  }).pipe($I.annoteSchema("PinnedSource", { description: "Retrieval location and revision of a pinned vocabulary." }))
) {}

/** The pin of an external namespace: source, SPDX license, upstream version and artifact digest. */
export class NamespacePin extends S.Opaque<NamespacePin, { readonly brand: unique symbol }>()(
  S.Struct({
    source: PinnedSource,
    license: SpdxExpression.FromString.annotateKey({ description: "License of the vocabulary artifact (@beep/spdx)." }),
    version: S.NonEmptyString.annotateKey({ description: "Vocabulary version as published upstream." }),
    digest: Sha256PrefixedDigest.annotateKey({ description: "Digest of the pinned vocabulary artifact bytes." }),
  }).pipe($I.annoteSchema("NamespacePin", { description: "Pin of one external registry namespace." }))
) {}

/**
 * The namespace pins keyed by registry prefix, beside the vendored
 * vocabularies they describe; the rdf test asserts a license and digest for
 * every external namespace of the identity registry.
 */
export const NamespacePins = S.HashMap(SafePnPrefix, NamespacePin).pipe(
  $I.annoteSchema("NamespacePins", { description: "Namespace pins keyed by registry prefix." })
);

/** Decoded type of {@link NamespacePins}. */
export type NamespacePins = typeof NamespacePins.Type;

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
