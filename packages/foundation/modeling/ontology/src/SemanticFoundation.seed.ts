/**
 * Repo-owned M1 legal-intake taxonomy seed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticFoundationId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { FilingRoot, TaxonomyConcept, TaxonomySeed } from "./SemanticFoundation.models.ts";

const scheme = $SemanticFoundationId.create("taxonomy/legal-intake");
const concepts = $SemanticFoundationId.create("concept");
const documentClasses = $SemanticFoundationId.create("document-class");
const filingRoots = $SemanticFoundationId.create("filing-root");
const iri = (value: string) => IRIReference.make(value);
const legalDocumentIri = iri(concepts.create("legal-document").iri);
const correspondenceIri = iri(concepts.create("correspondence").iri);

/**
 * Canonical IRI of the M1 legal-intake concept scheme.
 *
 * **Example** (Log the scheme IRI)
 *
 * ```ts
 * import { SemanticFoundationSchemeIri } from "@beep/ontology/SemanticFoundation.seed"
 * console.log(SemanticFoundationSchemeIri)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SemanticFoundationSchemeIri = iri(scheme.iri);

/**
 * Repo-owned semantic seed loaded by the M1 registry.
 *
 * **Details**
 *
 * FOLIO mappings remain empty until a report verifies a term-level semantic
 * match; the research verifies the namespace and source, but not a matching
 * concept identifier for these M1 terms.
 *
 * **Example** (Log the seed title)
 *
 * ```ts import.meta.vitest name="Log the seed title"
 * import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed"
 * SemanticFoundationSeed.title // => "Legal intake taxonomy"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SemanticFoundationSeed = TaxonomySeed.make({
  concepts: [
    TaxonomyConcept.make({
      alignments: [],
      broader: [],
      definition: "Documents received, created, or maintained while delivering legal services.",
      documentClasses: ["draft", "redline", "filed", "received", "privileged", "extracted-child"],
      filingSegment: "legal-documents",
      iri: legalDocumentIri,
      prefLabel: "Legal document",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "Letters, electronic mail, and other messages preserved as matter records.",
      documentClasses: ["draft", "received", "privileged", "extracted-child"],
      filingSegment: "correspondence",
      iri: correspondenceIri,
      prefLabel: "Correspondence",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [correspondenceIri],
      definition: "Electronic-mail messages and their preserved renderings or extracted children.",
      documentClasses: ["received", "privileged", "extracted-child"],
      filingSegment: "email-messages",
      iri: iri(concepts.create("email-message").iri),
      prefLabel: "Email message",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "A document classifying an intake artifact as a draft.",
      documentClasses: ["draft"],
      filingSegment: "draft",
      iri: iri(documentClasses.create("draft").iri),
      prefLabel: "Draft",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "A document showing revisions against another version.",
      documentClasses: ["redline"],
      filingSegment: "redline",
      iri: iri(documentClasses.create("redline").iri),
      prefLabel: "Redline",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "A document submitted to a court, agency, or legal authority.",
      documentClasses: ["filed"],
      filingSegment: "filed",
      iri: iri(documentClasses.create("filed").iri),
      prefLabel: "Filed",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "A document received from an external party or source.",
      documentClasses: ["received"],
      filingSegment: "received",
      iri: iri(documentClasses.create("received").iri),
      prefLabel: "Received",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "A document carrying privileged or protected legal communications.",
      documentClasses: ["privileged"],
      filingSegment: "privileged",
      iri: iri(documentClasses.create("privileged").iri),
      prefLabel: "Privileged",
    }),
    TaxonomyConcept.make({
      alignments: [],
      broader: [legalDocumentIri],
      definition: "A child artifact extracted from a parent intake document.",
      documentClasses: ["extracted-child"],
      filingSegment: "extracted-child",
      iri: iri(documentClasses.create("extracted-child").iri),
      prefLabel: "Extracted child",
    }),
  ],
  filingRoots: [
    FilingRoot.make({ iri: iri(filingRoots.create("local-vault").iri), kind: "local-vault", rootSegment: "vault" }),
    FilingRoot.make({ iri: iri(filingRoots.create("box-mirror").iri), kind: "box-mirror", rootSegment: "box-mirror" }),
  ],
  pathTemplateSegments: ["root", "client", "matter", "taxonomy-concept", "document-class", "file-name"],
  schemeIri: SemanticFoundationSchemeIri,
  title: "Legal intake taxonomy",
});
