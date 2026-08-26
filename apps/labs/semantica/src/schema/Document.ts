import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { identity, Option, Tuple } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CorpusPaperId } from "@/corpus/Manifest";
import { F1FixtureId, FixtureDegradedKind, FixtureExpectation } from "@/fixtures/F1";
import { DocumentId, ProvenanceEventId } from "@/schema/Ids";
import { MediaType } from "@/schema/MediaType";

const $I = $SemanticaId.create("schema/Document");

class W1PaperOrigin extends S.Class<W1PaperOrigin>($I`W1PaperOrigin`)(
  {
    kind: S.tag("W1Paper"),
    corpusId: S.NonEmptyString,
    paperId: CorpusPaperId,
    relativePath: S.NonEmptyString,
  },
  $I.annote("W1PaperOrigin", {
    description: "Manifest-backed origin for one W1 academia paper.",
  })
) {}

const FixtureDeclarationFields = S.Struct({
  expectation: FixtureExpectation,
  degradedKind: S.OptionFromNullOr(FixtureDegradedKind),
});

const FixtureDeclarationCheck = S.makeFilter(
  (declaration: typeof FixtureDeclarationFields.Type) =>
    FixtureExpectation.$match(declaration.expectation, {
      parses: () => Option.isNone(declaration.degradedKind),
      degraded: () => Option.isSome(declaration.degradedKind),
    }),
  {
    identifier: $I`FixtureDeclarationCheck`,
    title: "Fixture origin declaration",
    description: "Requires degraded fixture origins to name a degradation and parsing origins to omit one.",
    message: "Fixture origin degradedKind must be Some exactly when expectation is degraded.",
  }
);

/**
 * Parser expectation copied from the selected F1 index row.
 *
 * **Example** (Declare a parsing fixture)
 *
 * ```ts
 * import { FixtureDeclaration } from "@/schema/Document"
 * import * as O from "effect/Option"
 *
 * const declared = FixtureDeclaration.make({ expectation: "parses", degradedKind: O.none() })
 * console.log(declared.expectation) // "parses"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FixtureDeclaration extends S.Class<FixtureDeclaration>($I`FixtureDeclaration`)(
  FixtureDeclarationFields.check(FixtureDeclarationCheck),
  $I.annote("FixtureDeclaration", {
    description: "Fixture parse expectation and optional declared degradation copied into source provenance.",
  })
) {}

class FixtureOrigin extends S.Class<FixtureOrigin>($I`FixtureOrigin`)(
  {
    kind: S.tag("Fixture"),
    fixtureId: F1FixtureId,
    relativePath: S.NonEmptyString,
    declared: FixtureDeclaration,
  },
  $I.annote("FixtureOrigin", {
    description: "Committed synthetic F1 fixture origin.",
  })
) {}

const OriginKind = LiteralKit(["W1Paper", "Fixture"]);

/**
 * Manifest or fixture provenance for a source document.
 *
 * **Example** (Create a fixture origin)
 *
 * ```ts
 * import { Origin } from "@/schema/Document"
 * import { F1FixtureId } from "@/fixtures/F1"
 * import { Option } from "effect"
 *
 * const origin = Origin.cases.Fixture.make({
 *   kind: "Fixture",
 *   fixtureId: F1FixtureId.make("md-structure"),
 *   relativePath: "documents/md-structure.md",
 *   declared: { expectation: "parses", degradedKind: Option.none() }
 * })
 * console.log(origin.kind) // "Fixture"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Origin = OriginKind.mapMembers(Tuple.evolve([() => W1PaperOrigin, () => FixtureOrigin]))
  .annotate(
    $I.annote("Origin", {
      description: "Tagged source origin for a W1 paper or synthetic F1 fixture.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

/**
 * Decoded source-document origin.
 *
 * **Example** (Annotate a fixture origin)
 *
 * ```ts
 * import { Origin } from "@/schema/Document"
 * import { F1FixtureId } from "@/fixtures/F1"
 * import type { Origin as OriginValue } from "@/schema/Document"
 * import { Option } from "effect"
 *
 * const origin: OriginValue = Origin.cases.Fixture.make({
 *   kind: "Fixture",
 *   fixtureId: F1FixtureId.make("md-structure"),
 *   relativePath: "documents/md-structure.md",
 *   declared: { expectation: "parses", degradedKind: Option.none() }
 * })
 * console.log(origin.kind) // "Fixture"
 * ```
 *
 * @see {@link Origin} for variants.
 * @category type-level
 * @since 0.0.0
 */
export type Origin = typeof Origin.Type;

const SourceDocumentFields = S.Struct({
  id: DocumentId,
  mediaType: MediaType,
  origin: Origin,
  bytes: NonNegativeInt,
  sha256: Sha256Hex,
  acquired: ProvenanceEventId,
});

const SourceDocumentIdentityCheck = S.makeFilter(
  (document: typeof SourceDocumentFields.Type) => Str.Equivalence(document.id, document.sha256),
  {
    identifier: $I`SourceDocumentIdentityCheck`,
    title: "Source document identity",
    description: "Requires the document id to equal the full SHA-256 digest of its source bytes.",
    message: "SourceDocument sha256 must equal id.",
  }
);

/**
 * Content-addressed metadata for one exact source document.
 *
 * **Example** (Inspect the identity field)
 *
 * ```ts
 * import { SourceDocument } from "@/schema/Document"
 *
 * console.log(SourceDocument.fields.id !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceDocument extends S.Class<SourceDocument>($I`SourceDocument`)(
  SourceDocumentFields.mapFields(identity).check(SourceDocumentIdentityCheck),
  $I.annote("SourceDocument", {
    description: "Full byte identity, media type, origin, size, and ingest event for one source document.",
  })
) {}
