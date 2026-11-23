/**
 * The librarian loop: project one intake document through a concept scheme
 * and its intake taxonomy into a filing decision, without placement IO.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI } from "@beep/identity/Iri";
import { ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { PathTemplateSegment } from "../IntakeTaxonomy/IntakeTaxonomy.model.ts";
import {
  FilingPath,
  IntakeTaxonomySchemeMismatch,
  LibrarianOutput,
  TaxonomyConceptNotFound,
  UnsupportedDocumentClass,
} from "./LibrarianLoop.model.ts";
import type { ConceptScheme } from "@beep/ontology/ConceptScheme";
import type { FilingRoot, IntakeFiling, IntakeTaxonomy } from "../IntakeTaxonomy/IntakeTaxonomy.model.ts";
import type { LibrarianInput } from "./LibrarianLoop.model.ts";

const iriEquivalence = S.toEquivalence(IRI);

const pathFor = (taxonomy: IntakeTaxonomy, input: LibrarianInput, filing: IntakeFiling, root: FilingRoot): string =>
  A.join(
    A.map(
      taxonomy.pathTemplateSegments,
      PathTemplateSegment.match({
        root: () => root.rootSegment,
        client: () => input.client,
        matter: () => input.matter,
        "taxonomy-concept": () => filing.filingSegment,
        "document-class": () => input.documentClass,
        "file-name": () => input.fileName,
      })
    ),
    "/"
  );

/**
 * Project document metadata through a concept scheme and its intake taxonomy.
 *
 * **Details**
 *
 * The taxonomy must pin the given scheme's IRI and version. The concept must
 * be in the scheme and have a filing in the taxonomy, and its filing must
 * admit the document class. The output carries one path per filing root,
 * built from the taxonomy's path template.
 *
 * **Example** (Run the loop)
 *
 * ```ts
 * import { runLibrarianLoop } from "@beep/law-practice-domain/values/LibrarianLoop"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runLibrarianLoop))
 * ```
 *
 * @category domain-logic
 * @since 0.0.0
 */
export const runLibrarianLoop = Effect.fn("LibrarianLoop.runLibrarianLoop")(function* (
  scheme: ConceptScheme,
  taxonomy: IntakeTaxonomy,
  input: LibrarianInput
) {
  const given = ConceptSchemePin.make({ scheme: scheme.iri, version: scheme.version });
  yield* Effect.filterOrFail(Effect.succeed(taxonomy.scheme), Equal.equals(given), (pinned) =>
    IntakeTaxonomySchemeMismatch.make({ pinned, given })
  );
  const notFound = () => TaxonomyConceptNotFound.make({ conceptIri: input.conceptIri });
  const concept = yield* Effect.fromOption(
    A.findFirst(A.fromIterable(scheme.concepts), (entry) => iriEquivalence(entry.iri, input.conceptIri)),
    notFound
  );
  const filing = yield* Effect.fromOption(
    A.findFirst(taxonomy.filings, (entry) => iriEquivalence(entry.concept, input.conceptIri)),
    notFound
  );
  yield* Effect.filterOrFail(
    Effect.succeed(filing),
    (entry) => A.contains(entry.documentClasses, input.documentClass),
    () => UnsupportedDocumentClass.make({ conceptIri: input.conceptIri, documentClass: input.documentClass })
  );
  return LibrarianOutput.make({
    alignments: concept.alignments,
    conceptIri: concept.iri,
    documentClass: input.documentClass,
    filingPaths: A.map(taxonomy.filingRoots, (root) =>
      FilingPath.make({ kind: root.kind, path: pathFor(taxonomy, input, filing, root) })
    ),
  });
});
