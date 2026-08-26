/**
 * Schema-first models for the intake-serving semantic foundation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { LiteralKit } from "@beep/schema";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $OntologyId.create("SemanticFoundation.models");

const isSafeFilingSegment = (segment: string): boolean =>
  segment !== "." &&
  segment !== ".." &&
  P.not(Str.includes("/"))(segment) &&
  P.not(Str.includes("\\"))(segment) &&
  P.not(Str.includes("\u0000"))(segment);

/**
 * A single safe path component for projected filing paths: no separators,
 * no dot traversal, no NUL bytes. Every value that is later joined into a
 * vault or Box mirror path must pass this check, so path traversal is
 * rejected at decode time instead of reaching a storage adapter.
 *
 * **Example** (Reject path traversal decode)
 *
 * ```ts import.meta.vitest name="Reject path traversal decode"
 * import { FilingSegment } from "@beep/ontology/SemanticFoundation.models"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownResult(FilingSegment)("../escape")._tag // => "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FilingSegment = S.NonEmptyString.check(
  S.makeFilter(isSafeFilingSegment, {
    identifier: $I`FilingSegmentCheck`,
    title: "Filing Segment",
    description: "A single path component without separators, dot traversal, or NUL bytes.",
    message: "Filing segment must be a single safe path component",
  })
).pipe(
  $I.annoteSchema("FilingSegment", {
    description: "A single safe path component used when projecting filing paths.",
  })
);

/**
 * Runtime type for {@link FilingSegment}.
 *
 * **Example** (Type a filing segment)
 *
 * ```ts
 * import type { FilingSegment } from "@beep/ontology/SemanticFoundation.models"
 *
 * const segment: FilingSegment = "email-messages"
 * console.log(segment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FilingSegment = typeof FilingSegment.Type;

/**
 * Derived guard for {@link FilingSegment}.
 *
 * **Example** (Guard valid filing segment)
 *
 * ```ts import.meta.vitest name="Guard valid filing segment"
 * import { isFilingSegment } from "@beep/ontology/SemanticFoundation.models"
 *
 * isFilingSegment("received") // => true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isFilingSegment = S.is(FilingSegment);

/**
 * Exact document-class vocabulary locked by the M1 specification.
 *
 * **Example** (Check received document class)
 *
 * ```ts import.meta.vitest name="Check received document class"
 * import { DocumentClass } from "@beep/ontology/SemanticFoundation.models"
 *
 * DocumentClass.is.received("received") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentClass = LiteralKit([
  "draft",
  "redline",
  "filed",
  "received",
  "privileged",
  "extracted-child",
]).pipe(
  $I.annoteSchema("DocumentClass", {
    description: "Lifecycle and handling class assigned to an intake document.",
  })
);

/**
 * Runtime type for {@link DocumentClass}.
 *
 * **Example** (Type a document class)
 *
 * ```ts
 * import type { DocumentClass } from "@beep/ontology/SemanticFoundation.models"
 *
 * const documentClass: DocumentClass = "received"
 * console.log(documentClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentClass = typeof DocumentClass.Type;

/**
 * Supported SKOS mapping relationship for a vetted external alignment.
 *
 * **Example** (Check closeMatch mapping)
 *
 * ```ts import.meta.vitest name="Check closeMatch mapping"
 * import { SkosMappingKind } from "@beep/ontology/SemanticFoundation.models"
 *
 * SkosMappingKind.is.closeMatch("closeMatch") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SkosMappingKind = LiteralKit(["exactMatch", "closeMatch"]).pipe(
  $I.annoteSchema("SkosMappingKind", {
    description: "SKOS mapping predicate used for an externally vetted concept alignment.",
  })
);

/**
 * Runtime type for {@link SkosMappingKind}.
 *
 * **Example** (Type a mapping kind)
 *
 * ```ts
 * import type { SkosMappingKind } from "@beep/ontology/SemanticFoundation.models"
 *
 * const kind: SkosMappingKind = "closeMatch"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SkosMappingKind = typeof SkosMappingKind.Type;

/**
 * Vetted external mapping attached to a repo-owned SKOS concept.
 *
 * **Example** (Make concept alignment)
 *
 * ```ts
 * import { ConceptAlignment } from "@beep/ontology/SemanticFoundation.models"
 * import { IRIReference } from "@beep/rdf"
 *
 * const alignment = ConceptAlignment.make({
 *   conceptIri: IRIReference.make("https://folio.openlegalstandard.org/example"),
 *   kind: "closeMatch",
 *   sourceIri: IRIReference.make("https://openlegalstandard.org/resources/folio-python-library/taxonomy")
 * })
 * console.log(alignment.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConceptAlignment extends S.Class<ConceptAlignment>($I`ConceptAlignment`)(
  {
    conceptIri: IRIReference,
    kind: SkosMappingKind,
    sourceIri: IRIReference,
  },
  $I.annote("ConceptAlignment", {
    description: "Vetted external SKOS mapping metadata for a repo-owned concept.",
  })
) {}

/**
 * One repo-owned concept in an intake taxonomy scheme.
 *
 * **Example** (Make taxonomy concept)
 *
 * ```ts
 * import { TaxonomyConcept } from "@beep/ontology/SemanticFoundation.models"
 * import { IRIReference } from "@beep/rdf"
 *
 * const concept = TaxonomyConcept.make({
 *   alignments: [], broader: [], definition: "A legal document.", documentClasses: ["received"],
 *   filingSegment: "legal-documents", iri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/legal-document"),
 *   prefLabel: "Legal document"
 * })
 * console.log(concept.prefLabel)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaxonomyConcept extends S.Class<TaxonomyConcept>($I`TaxonomyConcept`)(
  {
    alignments: S.Array(ConceptAlignment),
    broader: S.Array(IRIReference),
    definition: S.NonEmptyString,
    documentClasses: S.Array(DocumentClass),
    filingSegment: FilingSegment,
    iri: IRIReference,
    prefLabel: S.NonEmptyString,
  },
  $I.annote("TaxonomyConcept", {
    description: "One repository-owned SKOS concept with filing and document-class metadata.",
  })
) {}

/**
 * Storage root kind exposed as filing vocabulary data.
 *
 * **Example** (Check box-mirror root kind)
 *
 * ```ts import.meta.vitest name="Check box-mirror root kind"
 * import { FilingRootKind } from "@beep/ontology/SemanticFoundation.models"
 *
 * FilingRootKind.is["box-mirror"]("box-mirror") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FilingRootKind = LiteralKit(["local-vault", "box-mirror"]).pipe(
  $I.annoteSchema("FilingRootKind", {
    description: "Kind of filing root described by the semantic registry.",
  })
);

/**
 *  Runtime type for {@link FilingRootKind}.
 *
 * **Example** (Type a filing root kind)
 *
 * ```ts
 * import type { FilingRootKind } from "@beep/ontology/SemanticFoundation.models"
 * const kind: FilingRootKind = "local-vault"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FilingRootKind = typeof FilingRootKind.Type;

/**
 * Filing root and path-template metadata exposed to downstream consumers.
 *
 * **Example** (Make filing root)
 *
 * ```ts
 * import { FilingRoot } from "@beep/ontology/SemanticFoundation.models"
 * import { IRIReference } from "@beep/rdf"
 *
 * const root = FilingRoot.make({ iri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/filing-root/local-vault"), kind: "local-vault", rootSegment: "vault" })
 * console.log(root.rootSegment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilingRoot extends S.Class<FilingRoot>($I`FilingRoot`)(
  { iri: IRIReference, kind: FilingRootKind, rootSegment: FilingSegment },
  $I.annote("FilingRoot", { description: "Vocabulary data for a local or mirrored filing root." })
) {}

/**
 * Complete schema-first taxonomy registry seed.
 *
 * **Example** (Count seed concepts)
 *
 * ```ts
 * import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed"
 * console.log(SemanticFoundationSeed.concepts.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaxonomySeed extends S.Class<TaxonomySeed>($I`TaxonomySeed`)(
  {
    concepts: S.Array(TaxonomyConcept),
    filingRoots: S.Array(FilingRoot),
    pathTemplateSegments: S.Array(FilingSegment),
    schemeIri: IRIReference,
    title: S.NonEmptyString,
  },
  $I.annote("TaxonomySeed", { description: "A loadable SKOS taxonomy seed and its filing vocabulary metadata." })
) {
  static readonly fromUnknownJsonStringEffect = S.decodeUnknownEffect(S.fromJsonString(TaxonomySeed));
}
