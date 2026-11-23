/**
 * Typed OA document annotation profile composing SPAR types and PROV attribution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRIReference } from "@beep/identity/Iri";
import { $I as $BeepId, $RdfId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PoPattern } from "@beep/schema/PatternOntology";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CITO_NAMESPACE, CITO_TERMS } from "../Vocab/Cito.ts";
import { DEO_NAMESPACE, DEO_TERMS } from "../Vocab/Deo.ts";
import { DOCO_NAMESPACE, DOCO_TERMS } from "../Vocab/Doco.ts";
import { FABIO_NAMESPACE, FABIO_TERMS } from "../Vocab/Fabio.ts";
import { PROV_NAMESPACE } from "../Vocab/Prov.ts";
import { RDF_NAMESPACE } from "../Vocab/Rdf.ts";
import { MdNodeId } from "./MdSections.ts";
import { WebAnnotationFragmentSelector, WebAnnotationTarget } from "./WebAnnotation.ts";

const documentPatternIri = $BeepId.create("document/pattern").iri;
const documentCitationIri = $BeepId.create("document/citation").iri;

/**
 * JSON-LD context for the OA/SPAR/PROV document profile.
 *
 * **Example** (Read the profile context)
 *
 * ```ts
 * import { DOCUMENT_ANNOTATION_CONTEXT } from "@beep/rdf/Adapters/DocumentAnnotation"
 * console.log(DOCUMENT_ANNOTATION_CONTEXT[0])
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCUMENT_ANNOTATION_CONTEXT = [
  "http://www.w3.org/ns/anno.jsonld",
  {
    rdf: RDF_NAMESPACE,
    prov: PROV_NAMESPACE,
    discourseType: { "@id": "rdf:type", "@type": "@id" },
    pattern: documentPatternIri,
    citation: documentCitationIri,
    subject: { "@id": "rdf:subject", "@type": "@id" },
    predicate: { "@id": "rdf:predicate", "@type": "@id" },
    object: { "@id": "rdf:object", "@type": "@id" },
    wasAttributedTo: { "@id": "prov:wasAttributedTo", "@type": "@id" },
    wasGeneratedBy: { "@id": "prov:wasGeneratedBy", "@type": "@id" },
  },
] as const;

const $I = $RdfId.create("Adapters/DocumentAnnotation");
const DocoTerm = LiteralKit(DOCO_TERMS);
const DeoTerm = LiteralKit(DEO_TERMS);
const FabioTerm = LiteralKit(FABIO_TERMS);
const CitoTerm = LiteralKit(CITO_TERMS);
const DeoType = S.TemplateLiteral([DEO_NAMESPACE, DeoTerm]).pipe(
  $I.annoteSchema("DeoType", { description: "Curated DEO discourse class IRI." })
);
const StructuralType = S.Union([S.TemplateLiteral([DOCO_NAMESPACE, DocoTerm]), DeoType]).pipe(
  $I.annoteSchema("StructuralType", { description: "Curated DOCO or DEO type of the annotated node." })
);
const DocumentType = S.TemplateLiteral([FABIO_NAMESPACE, FabioTerm]).pipe(
  $I.annoteSchema("DocumentType", { description: "Curated FaBiO type of the containing document." })
);
const CitationPredicate = S.TemplateLiteral([CITO_NAMESPACE, CitoTerm]).pipe(
  $I.annoteSchema("CitationPredicate", { description: "Curated CiTO predicate carried by a citation statement." })
);
const optionalIri = S.OptionFromOptionalKey(IRIReference).pipe(S.withConstructorDefault(Effect.succeedNone));

/**
 * A reified CiTO intent linking a cited resource to its citing resource.
 *
 * **Example** (Decode a citation statement)
 *
 * ```ts
 * import { DocumentCitation } from "@beep/rdf/Adapters/DocumentAnnotation"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(DocumentCitation)({ type: "rdf:Statement", subject: "https://example.org/revision", predicate: "http://purl.org/spar/cito/citesAsEvidence", object: "https://example.org/source" }))
 * console.log(decoded.predicate)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentCitation extends S.Opaque<DocumentCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("rdf:Statement"),
    subject: IRIReference,
    predicate: CitationPredicate,
    object: IRIReference,
  }).pipe(
    $I.annoteSchema("DocumentCitation", {
      description: "RDF statement carrying an optional citation intent without inference.",
    })
  )
) {}

/**
 * Structural and document types with optional per-instance PO refinement and PROV.
 *
 * **Details**
 * The first type is DOCO or DEO; the second is FaBiO. A pattern refinement
 * belongs to this annotation instance and does not modify syntax constructor
 * annotations. PROV attribution and generation refer to external resources.
 *
 * **Example** (Decode a multi-pattern title)
 *
 * ```ts
 * import { DocumentAnnotationBody } from "@beep/rdf/Adapters/DocumentAnnotation"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(DocumentAnnotationBody)({ type: ["http://purl.org/spar/doco/Title", "http://purl.org/spar/fabio/Report"], pattern: "block" }))
 * console.log(decoded.type)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentAnnotationBody extends S.Opaque<DocumentAnnotationBody, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.Tuple([StructuralType, DocumentType]),
    discourseType: S.OptionFromOptionalKey(DeoType).pipe(S.withConstructorDefault(Effect.succeedNone)),
    pattern: S.OptionFromOptionalKey(PoPattern).pipe(S.withConstructorDefault(Effect.succeedNone)),
    citation: S.OptionFromOptionalKey(DocumentCitation).pipe(S.withConstructorDefault(Effect.succeedNone)),
    wasAttributedTo: optionalIri,
    wasGeneratedBy: optionalIri,
  }).pipe(
    $I.annoteSchema("DocumentAnnotationBody", {
      description: "SPAR structural/document typing with per-instance refinement and PROV.",
    })
  )
) {}

const NodeSelector = S.Struct({ ...WebAnnotationFragmentSelector.fields, value: MdNodeId });
const NodeTarget = S.Struct({ ...WebAnnotationTarget.fields, type: S.tag("SpecificResource"), selector: NodeSelector });

/**
 * OA JSON-LD profile selecting a stable source-node id within an immutable revision.
 *
 * **Details**
 * Use the revision resource IRI as target source and the fold's node id as
 * FragmentSelector value. The context pins the OA context and defines SPAR,
 * RDF statement and PROV properties explicitly. The encoded type is derived
 * from this class; codecs preserve the whole annotation in one channel.
 *
 * **Example** (Decode a revision annotation)
 *
 * ```ts
 * import { DocumentAnnotation } from "@beep/rdf/Adapters/DocumentAnnotation"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * const decoded = await Effect.runPromise(S.decodeUnknownEffect(DocumentAnnotation)({
 *   id: "https://example.org/annotation/1", type: "Annotation",
 *   target: { type: "SpecificResource", source: "https://example.org/revision/1", selector: { type: "FragmentSelector", value: "md-v1/b/2" } },
 *   body: { type: ["http://purl.org/spar/doco/Title", "http://purl.org/spar/fabio/Report"] }
 * }))
 * console.log(decoded.target.selector.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentAnnotation extends S.Opaque<DocumentAnnotation, { readonly brand: unique symbol }>()(
  S.Struct({
    "@context": S.Tuple([
      S.Literal("http://www.w3.org/ns/anno.jsonld"),
      S.Struct({
        rdf: S.tag("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
        prov: S.tag("http://www.w3.org/ns/prov#"),
        discourseType: S.Struct({ "@id": S.tag("rdf:type"), "@type": S.tag("@id") }),
        pattern: S.tag(documentPatternIri),
        citation: S.tag(documentCitationIri),
        subject: S.Struct({ "@id": S.tag("rdf:subject"), "@type": S.tag("@id") }),
        predicate: S.Struct({ "@id": S.tag("rdf:predicate"), "@type": S.tag("@id") }),
        object: S.Struct({ "@id": S.tag("rdf:object"), "@type": S.tag("@id") }),
        wasAttributedTo: S.Struct({ "@id": S.tag("prov:wasAttributedTo"), "@type": S.tag("@id") }),
        wasGeneratedBy: S.Struct({ "@id": S.tag("prov:wasGeneratedBy"), "@type": S.tag("@id") }),
      }),
    ]).pipe(
      S.withConstructorDefault(Effect.succeed(DOCUMENT_ANNOTATION_CONTEXT)),
      S.withDecodingDefaultKey(Effect.succeed(DOCUMENT_ANNOTATION_CONTEXT))
    ),
    id: IRIReference,
    type: S.tag("Annotation"),
    target: NodeTarget,
    body: DocumentAnnotationBody,
  }).pipe(
    $I.annoteSchema("DocumentAnnotation", {
      description: "OA document annotation with stable node selector and SPAR/PROV body.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DocumentAnnotation {
  /**
   * Plain OA JSON-LD representation accepted and emitted by the annotation codec.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DocumentAnnotation.Encoded;
}
