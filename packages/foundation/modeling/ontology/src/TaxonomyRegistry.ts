/**
 * Pure registry projections for loaded semantic-foundation data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { TaggedErrorClass } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DocumentClass, FilingRootKind, FilingSegment } from "./SemanticFoundation.models.ts";
import type { TaxonomyConcept, TaxonomySeed } from "./SemanticFoundation.models.ts";

const $I = $OntologyId.create("TaxonomyRegistry");
const iriEquivalence = S.toEquivalence(IRIReference);

/** Document metadata supplied to the package-local librarian projection.
 * @example
 * ```ts
 * import { LibrarianInput } from "@beep/ontology/TaxonomyRegistry"
 * import { IRIReference } from "@beep/rdf"
 * const input = LibrarianInput.make({ client: "acme", conceptIri: IRIReference.make("https://ns.beep.sh/example"), documentClass: "received", fileName: "mail.eml", matter: "aurora" })
 * console.log(input.documentClass)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibrarianInput extends S.Class<LibrarianInput>($I`LibrarianInput`)(
  {
    client: FilingSegment,
    conceptIri: IRIReference,
    documentClass: DocumentClass,
    fileName: FilingSegment,
    matter: FilingSegment,
  },
  $I.annote("LibrarianInput", { description: "Document metadata used to project one registry-backed filing decision." })
) {}

/** One filing path projected for a semantic storage root.
 * @example
 * ```ts
 * import { FilingPath } from "@beep/ontology/TaxonomyRegistry"
 * console.log(FilingPath.make({ kind: "local-vault", path: "vault/acme/matter/mail" }).kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FilingPath extends S.Class<FilingPath>($I`FilingPath`)(
  { kind: FilingRootKind, path: S.NonEmptyString },
  $I.annote("FilingPath", { description: "A projected path paired with its semantic filing-root kind." })
) {}

/** Registry-backed classification and filing-path projection.
 * @example
 * ```ts
 * import type { LibrarianOutput } from "@beep/ontology/TaxonomyRegistry"
 * const show = (output: LibrarianOutput) => output.filingPaths
 * console.log(show)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibrarianOutput extends S.Class<LibrarianOutput>($I`LibrarianOutput`)(
  { conceptIri: IRIReference, documentClass: DocumentClass, filingPaths: S.Array(FilingPath) },
  $I.annote("LibrarianOutput", {
    description: "Pure classification output projected from loaded registry vocabulary data.",
  })
) {}

/** Raised when a requested concept is absent from loaded registry data.
 * @example
 * ```ts
 * import { TaxonomyConceptNotFound } from "@beep/ontology/TaxonomyRegistry"
 * import { IRIReference } from "@beep/rdf"
 * console.log(TaxonomyConceptNotFound.make({ conceptIri: IRIReference.make("https://ns.beep.sh/missing") })._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyConceptNotFound extends TaggedErrorClass<TaxonomyConceptNotFound>($I`TaxonomyConceptNotFound`)(
  "TaxonomyConceptNotFound",
  { conceptIri: IRIReference },
  $I.annote("TaxonomyConceptNotFound", {
    description: "The requested concept IRI is absent from the loaded taxonomy registry.",
  })
) {}

/** Raised when a concept does not admit the requested document class.
 * @example
 * ```ts
 * import { UnsupportedDocumentClass } from "@beep/ontology/TaxonomyRegistry"
 * import { IRIReference } from "@beep/rdf"
 * console.log(UnsupportedDocumentClass.make({ conceptIri: IRIReference.make("https://ns.beep.sh/example"), documentClass: "filed" }).documentClass)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class UnsupportedDocumentClass extends TaggedErrorClass<UnsupportedDocumentClass>($I`UnsupportedDocumentClass`)(
  "UnsupportedDocumentClass",
  { conceptIri: IRIReference, documentClass: DocumentClass },
  $I.annote("UnsupportedDocumentClass", {
    description: "The selected taxonomy concept does not admit the requested document class.",
  })
) {}

const pathFor = (input: LibrarianInput, concept: TaxonomyConcept, rootSegment: string): string =>
  A.join([rootSegment, input.client, input.matter, concept.filingSegment, input.documentClass, input.fileName], "/");

/** Project document metadata through loaded registry data without placement I/O.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { IRIReference } from "@beep/rdf"
 * import { SemanticFoundationSeed } from "@beep/ontology/SemanticFoundation.seed"
 * import { LibrarianInput, runLibrarianLoop } from "@beep/ontology/TaxonomyRegistry"
 * const result = runLibrarianLoop(SemanticFoundationSeed, LibrarianInput.make({ client: "acme", conceptIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/correspondence"), documentClass: "received", fileName: "mail.eml", matter: "aurora" }))
 * console.log(Effect.isEffect(result)) // true
 * ```
 * @category workflows
 * @since 0.0.0
 */
export const runLibrarianLoop = Effect.fn("TaxonomyRegistry.runLibrarianLoop")(function* (
  seed: TaxonomySeed,
  input: LibrarianInput
) {
  const concept = yield* A.findFirst(seed.concepts, (candidate) =>
    iriEquivalence(candidate.iri, input.conceptIri)
  ).pipe(
    O.match({
      onNone: () => Effect.fail(TaxonomyConceptNotFound.make({ conceptIri: input.conceptIri })),
      onSome: Effect.succeed,
    })
  );
  yield* Effect.filterOrFail(
    Effect.succeed(concept),
    (candidate) => A.contains(candidate.documentClasses, input.documentClass),
    () => UnsupportedDocumentClass.make({ conceptIri: input.conceptIri, documentClass: input.documentClass })
  );
  return LibrarianOutput.make({
    conceptIri: concept.iri,
    documentClass: input.documentClass,
    filingPaths: A.map(seed.filingRoots, (root) =>
      FilingPath.make({
        kind: root.kind,
        path: pathFor(input, concept, root.rootSegment),
      })
    ),
  });
});
