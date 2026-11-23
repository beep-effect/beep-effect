/**
 * The legal-intake filing model: how each intake concept files and which
 * document classes it admits.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI } from "@beep/identity/Iri";
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import { LiteralKit } from "@beep/schema";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeDomainId.create("values/IntakeTaxonomy/IntakeTaxonomy.model");

const isSafeFilingSegment = (segment: string): boolean =>
  segment !== "." &&
  segment !== ".." &&
  P.not(Str.includes("/"))(segment) &&
  P.not(Str.includes("\\"))(segment) &&
  P.not(Str.includes("\u0000"))(segment);

/**
 * A single safe path component for projected filing paths.
 *
 * **Details**
 *
 * A segment holds no separator, no dot traversal and no NUL byte, so a path
 * joined from segments cannot leave its filing root.
 *
 * **Example** (Reject path traversal)
 *
 * ```ts import.meta.vitest name="Reject path traversal"
 * import { FilingSegment } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownResult(FilingSegment)("../escape")._tag // => "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FilingSegment = S.NonEmptyString.check(
  S.makeFilter(
    isSafeFilingSegment,
    $I.annote("FilingSegmentCheck", {
      title: "Filing Segment",
      description: "A single path component without separators, dot traversal, or NUL bytes.",
      message: "Filing segment must be a single safe path component",
    })
  )
).pipe(
  $I.annoteSchema("FilingSegment", {
    description: "A single safe path component used when projecting filing paths.",
  })
);

/**
 * Runtime type for {@link FilingSegment}.
 *
 * @category models
 * @since 0.0.0
 */
export type FilingSegment = typeof FilingSegment.Type;

/**
 * Derived guard for {@link FilingSegment}.
 *
 * **Example** (Guard a filing segment)
 *
 * ```ts import.meta.vitest name="Guard a filing segment"
 * import { isFilingSegment } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 *
 * isFilingSegment("received") // => true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isFilingSegment = S.is(FilingSegment);

/**
 * The lifecycle and handling classes an intake document can carry.
 *
 * **Example** (Check the privileged class)
 *
 * ```ts import.meta.vitest name="Check the privileged class"
 * import { DocumentClass } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 *
 * DocumentClass.is.privileged("privileged") // => true
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
 * @category models
 * @since 0.0.0
 */
export type DocumentClass = typeof DocumentClass.Type;

/**
 * The kind of storage root a filing path is projected under.
 *
 * **Example** (Check the mirror root kind)
 *
 * ```ts import.meta.vitest name="Check the mirror root kind"
 * import { FilingRootKind } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 *
 * FilingRootKind.is["box-mirror"]("box-mirror") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FilingRootKind = LiteralKit(["local-vault", "box-mirror"]).pipe(
  $I.annoteSchema("FilingRootKind", {
    description: "Kind of filing root a filing path is projected under.",
  })
);

/**
 * Runtime type for {@link FilingRootKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type FilingRootKind = typeof FilingRootKind.Type;

/**
 * The named parts a filing path is built from, in template order.
 *
 * **Example** (Check the concept part)
 *
 * ```ts import.meta.vitest name="Check the concept part"
 * import { PathTemplateSegment } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 *
 * PathTemplateSegment.is["taxonomy-concept"]("taxonomy-concept") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PathTemplateSegment = LiteralKit([
  "root",
  "client",
  "matter",
  "taxonomy-concept",
  "document-class",
  "file-name",
]).pipe(
  $I.annoteSchema("PathTemplateSegment", {
    description: "One named part of the filing path template.",
  })
);

/**
 * Runtime type for {@link PathTemplateSegment}.
 *
 * @category models
 * @since 0.0.0
 */
export type PathTemplateSegment = typeof PathTemplateSegment.Type;

/**
 * One storage root and the segment its paths start with.
 *
 * **Example** (Make a filing root)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { FilingRoot } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 *
 * const root = FilingRoot.make({ iri: IRI.make("https://example.test/root/vault"), kind: "local-vault", rootSegment: "vault" })
 * console.log(root.rootSegment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FilingRoot extends S.Opaque<FilingRoot, { readonly brand: unique symbol }>()(
  S.Struct({ iri: IRI, kind: FilingRootKind, rootSegment: FilingSegment }).pipe(
    $I.annoteSchema("FilingRoot", { description: "A local or mirrored filing root and its leading path segment." })
  )
) {}

/**
 * How one intake concept files: its path segment and the document classes it admits.
 *
 * **Example** (Make a concept filing)
 *
 * ```ts
 * import { IRI } from "@beep/identity/Iri"
 * import { IntakeFiling } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 *
 * const filing = IntakeFiling.make({
 *   concept: IRI.make("https://example.test/concept/email-message"),
 *   documentClasses: ["received"],
 *   filingSegment: "email-messages"
 * })
 * console.log(filing.filingSegment)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeFiling extends S.Opaque<IntakeFiling, { readonly brand: unique symbol }>()(
  S.Struct({ concept: IRI, documentClasses: S.Array(DocumentClass), filingSegment: FilingSegment }).pipe(
    $I.annoteSchema("IntakeFiling", {
      description: "The filing segment and admitted document classes of one intake concept.",
    })
  )
) {}

/**
 * The filing model of one pinned intake concept scheme.
 *
 * **Details**
 *
 * The concepts themselves live in the concept scheme the pin names; this
 * record adds only what filing needs. It is stored as the
 * `intake-taxonomy.json` payload of the legal vocabulary pack.
 *
 * **Example** (Decode an empty taxonomy)
 *
 * ```ts import.meta.vitest name="Decode an empty taxonomy"
 * import { IntakeTaxonomy } from "@beep/law-practice-domain/values/IntakeTaxonomy"
 * import * as S from "effect/Schema"
 *
 * const taxonomy = S.decodeUnknownSync(IntakeTaxonomy)({
 *   scheme: { scheme: "https://example.test/scheme", version: "1" },
 *   filings: [],
 *   filingRoots: [],
 *   pathTemplateSegments: ["root", "file-name"]
 * })
 * taxonomy.pathTemplateSegments.length // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class IntakeTaxonomy extends S.Opaque<IntakeTaxonomy, { readonly brand: unique symbol }>()(
  S.Struct({
    scheme: ConceptSchemePin,
    filings: S.Array(IntakeFiling),
    filingRoots: S.Array(FilingRoot),
    pathTemplateSegments: S.Array(PathTemplateSegment),
  }).pipe(
    $I.annoteSchema("IntakeTaxonomy", {
      description: "Filing segments, document classes, filing roots and the path template of one intake scheme.",
    })
  )
) {}
