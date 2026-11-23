/**
 * Inputs, outputs and refusals of the librarian loop, which files one intake
 * document under every filing root.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI } from "@beep/identity/Iri";
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { ConceptAlignment, ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import * as S from "effect/Schema";
import { DocumentClass, FilingRootKind, FilingSegment } from "../IntakeTaxonomy/IntakeTaxonomy.model.ts";

const $I = $LawPracticeDomainId.create("values/LibrarianLoop/LibrarianLoop.model");

/**
 * The document metadata one filing decision is projected from.
 *
 * **Example** (Make a librarian input)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { LibrarianInput } from "@beep/law-practice-domain/values/LibrarianLoop"
 *
 * const input = LibrarianInput.make({
 *   client: "acme",
 *   conceptIri: IRI.make("https://example.test/concept/email-message"),
 *   documentClass: "received",
 *   fileName: "mail.eml",
 *   matter: "aurora"
 * })
 * console.log(input.documentClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarianInput extends S.Opaque<LibrarianInput, { readonly brand: unique symbol }>()(
  S.Struct({
    client: FilingSegment,
    conceptIri: IRI,
    documentClass: DocumentClass,
    fileName: FilingSegment,
    matter: FilingSegment,
  }).pipe(
    $I.annoteSchema("LibrarianInput", {
      description: "Document metadata used to project one filing decision.",
    })
  )
) {}

/**
 * One filing path, paired with the kind of root it starts under.
 *
 * **Example** (Make a filing path)
 *
 * ```ts
 * import { FilingPath } from "@beep/law-practice-domain/values/LibrarianLoop"
 *
 * console.log(FilingPath.make({ kind: "local-vault", path: "vault/acme/aurora/mail" }).kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilingPath extends S.Opaque<FilingPath, { readonly brand: unique symbol }>()(
  S.Struct({ kind: FilingRootKind, path: S.NonEmptyString }).pipe(
    $I.annoteSchema("FilingPath", { description: "A projected path paired with its filing-root kind." })
  )
) {}

/**
 * The filing decision for one document: the concept, its alignments and one
 * path per filing root.
 *
 * **Example** (Read the filing paths)
 *
 * ```ts
 * import type { LibrarianOutput } from "@beep/law-practice-domain/values/LibrarianLoop"
 *
 * const paths = (output: LibrarianOutput) => output.filingPaths
 * console.log(paths)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LibrarianOutput extends S.Opaque<LibrarianOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    alignments: S.HashSet(ConceptAlignment),
    conceptIri: IRI,
    documentClass: DocumentClass,
    filingPaths: S.Array(FilingPath),
  }).pipe(
    $I.annoteSchema("LibrarianOutput", {
      description: "A filing decision projected from a concept scheme and its intake taxonomy.",
    })
  )
) {}

/**
 * Raised when the concept is absent from the scheme or has no filing in the taxonomy.
 *
 * **Example** (Make a concept-not-found error)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { TaxonomyConceptNotFound } from "@beep/law-practice-domain/values/LibrarianLoop"
 *
 * console.log(TaxonomyConceptNotFound.make({ conceptIri: IRI.make("https://example.test/missing") })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyConceptNotFound extends S.TaggedError<TaxonomyConceptNotFound, { readonly brand: unique symbol }>(
  $I`TaxonomyConceptNotFound`
)(
  "TaxonomyConceptNotFound",
  { conceptIri: IRI },
  $I.annoteError<TaxonomyConceptNotFound>("TaxonomyConceptNotFound", {
    description: "The requested concept is absent from the scheme or has no filing in the intake taxonomy.",
  })
) {}

/**
 * Raised when a concept does not admit the requested document class.
 *
 * **Example** (Make an unsupported-class error)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { UnsupportedDocumentClass } from "@beep/law-practice-domain/values/LibrarianLoop"
 *
 * const error = UnsupportedDocumentClass.make({ conceptIri: IRI.make("https://example.test/a"), documentClass: "filed" })
 * console.log(error.documentClass)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnsupportedDocumentClass extends S.TaggedError<
  UnsupportedDocumentClass,
  { readonly brand: unique symbol }
>($I`UnsupportedDocumentClass`)(
  "UnsupportedDocumentClass",
  { conceptIri: IRI, documentClass: DocumentClass },
  $I.annoteError<UnsupportedDocumentClass>("UnsupportedDocumentClass", {
    description: "The selected concept does not admit the requested document class.",
  })
) {}

/**
 * Raised when an intake taxonomy is paired with a scheme other than the one it pins.
 *
 * **Example** (Make a scheme-mismatch error)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { ConceptSchemePin } from "@beep/ontology/ConceptScheme"
 * import { IntakeTaxonomySchemeMismatch } from "@beep/law-practice-domain/values/LibrarianLoop"
 *
 * const error = IntakeTaxonomySchemeMismatch.make({
 *   pinned: ConceptSchemePin.make({ scheme: IRI.make("https://example.test/scheme"), version: "1" }),
 *   given: ConceptSchemePin.make({ scheme: IRI.make("https://example.test/scheme"), version: "2" })
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IntakeTaxonomySchemeMismatch extends S.TaggedError<
  IntakeTaxonomySchemeMismatch,
  { readonly brand: unique symbol }
>($I`IntakeTaxonomySchemeMismatch`)(
  "IntakeTaxonomySchemeMismatch",
  { pinned: ConceptSchemePin, given: ConceptSchemePin },
  $I.annoteError<IntakeTaxonomySchemeMismatch>("IntakeTaxonomySchemeMismatch", {
    description: "The intake taxonomy pins a scheme IRI or version other than the scheme it was given.",
  })
) {}
