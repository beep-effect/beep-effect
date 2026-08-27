/**
 * Fail-closed manifest loader for semantic-foundation taxonomy slices.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, FileSystem, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ConceptAlignment,
  isFilingSegment,
  SkosMappingKind,
  TaxonomyConcept,
  TaxonomySeed,
} from "./SemanticFoundation.models.ts";
import { SemanticFoundationSeed } from "./SemanticFoundation.seed.ts";

const $I = $OntologyId.create("TaxonomyLoader");

/**
 * Relative path to one vendor slice, contained within the vendor root: one
 * or more {@link FilingSegment}-safe components joined by `/`, so `..`
 * traversal, absolute paths, and separator tricks are rejected at decode
 * time and the loader cannot read outside its configured directory.
 *
 * **Example** (Reject path traversal)
 *
 * ```ts import.meta.vitest name="Reject path traversal"
 * import { VendorSlicePath } from "@beep/ontology/TaxonomyLoader"
 * import * as S from "effect/Schema"
 *
 * S.decodeUnknownResult(VendorSlicePath)("../secrets.jsonld")._tag // => "Failure"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VendorSlicePath = S.NonEmptyString.check(
  S.makeFilter((path: string) => A.every(Str.split(path, "/"), isFilingSegment), {
    identifier: $I`VendorSlicePathCheck`,
    title: "Vendor Slice Path",
    description: "A vendor-root-relative path whose every component is a safe filing segment.",
    message: "Vendor slice path must stay inside the vendor root",
  })
).pipe(
  $I.annoteSchema("VendorSlicePath", {
    description: "Vendor-root-relative slice path that cannot escape the configured directory.",
  })
);

/**
 *  Explicit loader-vetting state required in addition to research verification.
 *
 * **Example** (Check VETTED predicate)
 *
 * ```ts import.meta.vitest name="Check VETTED predicate"
 * import { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
 * VendorLoadStatus.is.VETTED("VETTED") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const VendorLoadStatus = LiteralKit(["VETTED", "UNVETTED"]).pipe(
  $I.annoteSchema("VendorLoadStatus", { description: "Explicit implementation-loading verdict for a vendor slice." })
);

/**
 *  Runtime type for {@link VendorLoadStatus}.
 *
 * **Example** (Assign UNVETTED status)
 *
 * ```ts
 * import type { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
 * const status: VendorLoadStatus = "UNVETTED"
 * console.log(status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type VendorLoadStatus = typeof VendorLoadStatus.Type;

/**
 * Legacy load directive for one complete `TaxonomySeed` JSON-LD slice.
 *
 * **Example** (Make manifest entry)
 *
 * ```ts
 * import { VendorManifestEntry } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorManifestEntry.make({ format: "jsonld", id: "fixture", loadStatus: "VETTED", path: "fixture.jsonld" }).id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendorManifestEntry extends S.Class<VendorManifestEntry>($I`VendorManifestEntry`)(
  {
    _tag: S.tagDefaultOmit("VendorTaxonomySeedSlice"),
    format: S.Literal("jsonld"),
    id: S.NonEmptyString,
    loadStatus: VendorLoadStatus,
    path: VendorSlicePath,
  },
  $I.annote("VendorManifestEntry", { description: "Manifest row for one explicitly vetted JSON-LD taxonomy slice." })
) {
  static readonly decodeUnknownJsonStringEffect = S.decodeUnknownEffect(S.fromJsonString(VendorManifestEntry));
}

/**
 * Manifest load directive for one vetted FOLIO class exposed as JSON-LD.
 *
 * **Details**
 *
 * The directive binds an exact external concept IRI to one repo-owned concept.
 * The loader verifies the downloaded JSON-LD identifier before admitting the
 * mapping, so labels alone can never create concept identity.
 *
 * **Example** (Describe a FOLIO alignment slice)
 *
 * ```ts
 * import { VendorAlignmentManifestEntry } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/rdf"
 *
 * const entry = VendorAlignmentManifestEntry.make({
 *   conceptIri: IRIReference.make("https://folio.openlegalstandard.org/example"),
 *   fetchUrl: IRIReference.make("https://folio.openlegalstandard.org/example/jsonld"),
 *   format: "jsonld",
 *   id: "folio-example",
 *   loadStatus: "VETTED",
 *   localConceptIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/example"),
 *   mappingKind: "closeMatch",
 *   path: "folio-example.jsonld",
 *   verified: true
 * })
 * console.log(entry.loadKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class VendorAlignmentManifestEntry extends S.Class<VendorAlignmentManifestEntry>(
  $I`VendorAlignmentManifestEntry`
)(
  {
    _tag: S.tagDefaultOmit("VendorFolioAlignmentSlice"),
    conceptIri: IRIReference,
    fetchUrl: IRIReference,
    format: S.Literal("jsonld"),
    id: S.NonEmptyString,
    loadKind: S.tag("folio-alignment"),
    loadStatus: VendorLoadStatus,
    localConceptIri: IRIReference,
    mappingKind: SkosMappingKind,
    path: VendorSlicePath,
    verified: S.Literal(true),
  },
  $I.annote("VendorAlignmentManifestEntry", {
    description: "Asset-pack manifest directive for one vetted FOLIO alignment slice.",
  })
) {}

/**
 * Boundary shape decoded from an individual FOLIO JSON-LD class response.
 *
 * **Example** (Construct a FOLIO concept slice)
 *
 * ```ts
 * import { FolioConceptSlice } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/rdf"
 *
 * const slice = FolioConceptSlice.make({
 *   "@id": IRIReference.make("https://folio.openlegalstandard.org/example"),
 *   "@type": "owl:Class",
 *   "rdfs:label": "Example concept",
 *   "skos:definition": "A fixture FOLIO concept."
 * })
 * console.log(slice["rdfs:label"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FolioConceptSlice extends S.Class<FolioConceptSlice>($I`FolioConceptSlice`)(
  {
    "@id": IRIReference,
    "@type": S.Literal("owl:Class"),
    "rdfs:label": S.NonEmptyString,
    "skos:definition": S.NonEmptyString,
  },
  $I.annote("FolioConceptSlice", {
    description: "Minimal FOLIO JSON-LD class fields required to verify a manifested alignment.",
  })
) {}

/**
 *  Raised when the manifest cannot be read.
 *
 * **Example** (Make read error)
 *
 * ```ts
 * import { TaxonomyManifestReadError } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyManifestReadError.make({ path: "missing.jsonl" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyManifestReadError extends S.TaggedError<TaxonomyManifestReadError>($I`TaxonomyManifestReadError`)(
  "TaxonomyManifestReadError",
  { path: S.NonEmptyString },
  $I.annoteError<TaxonomyManifestReadError>("TaxonomyManifestReadError", {
    description: "The vendor manifest is missing or unreadable.",
  })
) {}

/**
 *  Raised when a manifest row cannot be parsed.
 *
 * **Example** (Make parse error)
 *
 * ```ts
 * import { TaxonomyManifestParseError } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyManifestParseError.make({ line: 1, path: "manifest.jsonl" }).line)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyManifestParseError extends S.TaggedError<TaxonomyManifestParseError>(
  $I`TaxonomyManifestParseError`
)(
  "TaxonomyManifestParseError",
  { line: S.Int, path: S.NonEmptyString },
  $I.annoteError<TaxonomyManifestParseError>("TaxonomyManifestParseError", {
    description: "A vendor manifest JSONL row failed schema decoding.",
  })
) {}

/**
 *  Raised when a manifest slice lacks explicit loading approval.
 *
 * **Example** (Make unvetted error)
 *
 * ```ts
 * import { VendorSliceUnvetted } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceUnvetted.make({ id: "folio" }).id)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceUnvetted extends S.TaggedError<VendorSliceUnvetted>($I`VendorSliceUnvetted`)(
  "VendorSliceUnvetted",
  { id: S.NonEmptyString },
  $I.annoteError<VendorSliceUnvetted>("VendorSliceUnvetted", {
    description: "A vendor slice is not explicitly VETTED for loading.",
  })
) {}

/**
 *  Raised when an approved slice cannot be read.
 *
 * **Example** (Make slice read error)
 *
 * ```ts
 * import { VendorSliceReadError } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceReadError.make({ id: "fixture", path: "missing.jsonld" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceReadError extends S.TaggedError<VendorSliceReadError>($I`VendorSliceReadError`)(
  "VendorSliceReadError",
  { id: S.NonEmptyString, path: S.NonEmptyString },
  $I.annoteError<VendorSliceReadError>("VendorSliceReadError", {
    description: "An explicitly vetted vendor slice is unreadable.",
  })
) {}

/**
 *  Raised when an approved slice cannot be schema-decoded.
 *
 * **Example** (Make slice parse error)
 *
 * ```ts
 * import { VendorSliceParseError } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceParseError.make({ id: "fixture", path: "fixture.jsonld" }).id)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceParseError extends S.TaggedError<VendorSliceParseError>($I`VendorSliceParseError`)(
  "VendorSliceParseError",
  { id: S.NonEmptyString, path: S.NonEmptyString },
  $I.annoteError<VendorSliceParseError>("VendorSliceParseError", {
    description: "An explicitly vetted vendor taxonomy slice is unparsable.",
  })
) {}

/**
 * Raised when a vetted vendor slice resolves outside its canonical vendor root.
 *
 * **Example** (Make path escape error)
 *
 * ```ts
 * import { VendorSlicePathEscape } from "@beep/ontology/TaxonomyLoader"
 *
 * const error = VendorSlicePathEscape.make({
 *   id: "fixture",
 *   path: "/outside/fixture.jsonld",
 *   vendorRoot: "/vendor"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSlicePathEscape extends S.TaggedError<VendorSlicePathEscape>($I`VendorSlicePathEscape`)(
  "VendorSlicePathEscape",
  {
    id: S.NonEmptyString,
    path: S.NonEmptyString,
    vendorRoot: S.NonEmptyString,
  },
  $I.annoteError<VendorSlicePathEscape>("VendorSlicePathEscape", {
    description: "A vetted vendor taxonomy slice resolved outside its canonical vendor root.",
  })
) {}

/**
 * Raised when a FOLIO slice identifier differs from its manifested concept IRI.
 *
 * **Example** (Make a concept mismatch error)
 *
 * ```ts
 * import { VendorSliceConceptMismatch } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/rdf"
 *
 * const error = VendorSliceConceptMismatch.make({
 *   actualConceptIri: IRIReference.make("https://folio.openlegalstandard.org/actual"),
 *   expectedConceptIri: IRIReference.make("https://folio.openlegalstandard.org/expected"),
 *   id: "folio-example",
 *   path: "folio-example.jsonld"
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceConceptMismatch extends S.TaggedError<VendorSliceConceptMismatch>(
  $I`VendorSliceConceptMismatch`
)(
  "VendorSliceConceptMismatch",
  {
    actualConceptIri: IRIReference,
    expectedConceptIri: IRIReference,
    id: S.NonEmptyString,
    path: S.NonEmptyString,
  },
  $I.annoteError<VendorSliceConceptMismatch>("VendorSliceConceptMismatch", {
    description: "A FOLIO JSON-LD slice did not carry the exact concept IRI named by its manifest row.",
  })
) {}

/**
 * Raised when a manifested external mapping targets no loaded repo concept.
 *
 * **Example** (Make an alignment-target error)
 *
 * ```ts
 * import { VendorAlignmentTargetNotFound } from "@beep/ontology/TaxonomyLoader"
 * import { IRIReference } from "@beep/rdf"
 *
 * const error = VendorAlignmentTargetNotFound.make({
 *   id: "folio-example",
 *   localConceptIri: IRIReference.make("https://ns.beep.sh/ontology/semantic-foundation/concept/missing")
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class VendorAlignmentTargetNotFound extends S.TaggedError<VendorAlignmentTargetNotFound>(
  $I`VendorAlignmentTargetNotFound`
)(
  "VendorAlignmentTargetNotFound",
  {
    id: S.NonEmptyString,
    localConceptIri: IRIReference,
  },
  $I.annoteError<VendorAlignmentTargetNotFound>("VendorAlignmentTargetNotFound", {
    description: "A vetted vendor alignment names a repo concept absent from the loaded taxonomy seed.",
  })
) {}

class VendorAssetManifestRow extends S.Class<VendorAssetManifestRow>($I`VendorAssetManifestRow`)(
  {
    format: S.NonEmptyString,
    id: S.NonEmptyString,
    loadKind: S.OptionFromOptionalKey(S.Literal("folio-alignment")),
    loadStatus: S.OptionFromOptionalKey(VendorLoadStatus),
  },
  $I.annote("VendorAssetManifestRow", {
    description: "Asset-pack row fields used to distinguish references from explicit loader directives.",
  })
) {}

class LoadedTaxonomySeedSlice extends S.Class<LoadedTaxonomySeedSlice>($I`LoadedTaxonomySeedSlice`)(
  {
    _tag: S.tag("LoadedTaxonomySeedSlice"),
    seed: TaxonomySeed,
  },
  $I.annote("LoadedTaxonomySeedSlice", {
    description: "A schema-decoded vendor taxonomy seed awaiting registry merge.",
  })
) {}

class LoadedFolioAlignmentSlice extends S.Class<LoadedFolioAlignmentSlice>($I`LoadedFolioAlignmentSlice`)(
  {
    _tag: S.tag("LoadedFolioAlignmentSlice"),
    alignment: ConceptAlignment,
    id: S.NonEmptyString,
    localConceptIri: IRIReference,
  },
  $I.annote("LoadedFolioAlignmentSlice", {
    description: "A verified FOLIO alignment awaiting merge into its repo-owned concept.",
  })
) {}

type VendorLoadManifestEntry = VendorAlignmentManifestEntry | VendorManifestEntry;
type LoadedVendorSlice = LoadedFolioAlignmentSlice | LoadedTaxonomySeedSlice;

const decodeAssetManifestRow = S.decodeUnknownEffect(S.fromJsonString(VendorAssetManifestRow));
const decodeManifestEntry = S.decodeUnknownEffect(S.fromJsonString(VendorManifestEntry));
const decodeAlignmentManifestEntry = S.decodeUnknownEffect(S.fromJsonString(VendorAlignmentManifestEntry));
const decodeFolioConceptSlice = S.decodeUnknownEffect(S.fromJsonString(FolioConceptSlice));
const alignmentEquivalence = S.toEquivalence(ConceptAlignment);

const manifestParseError = (path: string, line: number) => TaxonomyManifestParseError.make({ line, path });

const decodeLoadManifestEntry = Effect.fn("TaxonomyLoader.decodeLoadManifestEntry")(function* (
  path: string,
  line: string,
  index: number
): Effect.fn.Return<O.Option<VendorLoadManifestEntry>, TaxonomyManifestParseError> {
  const row = yield* decodeAssetManifestRow(line).pipe(Effect.mapError(() => manifestParseError(path, index + 1)));
  return yield* Match.value({ hasLoadKind: O.isSome(row.loadKind), hasLoadStatus: O.isSome(row.loadStatus) }).pipe(
    Match.when({ hasLoadKind: true }, () =>
      decodeAlignmentManifestEntry(line).pipe(
        Effect.map(O.some),
        Effect.mapError(() => manifestParseError(path, index + 1))
      )
    ),
    Match.when({ hasLoadStatus: true }, () =>
      decodeManifestEntry(line).pipe(
        Effect.map(O.some),
        Effect.mapError(() => manifestParseError(path, index + 1))
      )
    ),
    Match.orElse(() => Effect.succeed(O.none()))
  );
});

const parseManifest = Effect.fn("TaxonomyLoader.parseManifest")(function* (path: string, content: string) {
  const lines = A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty);
  const entries = yield* Effect.forEach(lines, (line, index) => decodeLoadManifestEntry(path, line, index), {
    concurrency: 1,
  });
  return A.getSomes(entries);
});

const readVendorContent = Effect.fn("TaxonomyLoader.readVendorContent")(function* (
  id: string,
  relativePath: string,
  vendorRoot: string
): Effect.fn.Return<string, VendorSlicePathEscape | VendorSliceReadError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const canonicalVendorRoot = yield* fs.realPath(vendorRoot).pipe(
    Effect.mapError(() =>
      VendorSliceReadError.make({
        id,
        path: vendorRoot,
      })
    )
  );
  const candidatePath = A.join([canonicalVendorRoot, relativePath], "/");
  const path = yield* fs.realPath(candidatePath).pipe(
    Effect.mapError(() =>
      VendorSliceReadError.make({
        id,
        path: candidatePath,
      })
    )
  );
  const separator = Bool.match(
    Bool.and(Str.includes("\\")(canonicalVendorRoot), Bool.not(Str.includes("/")(canonicalVendorRoot))),
    {
      onFalse: () => "/",
      onTrue: () => "\\",
    }
  );
  const rootedPrefix = Bool.match(Str.endsWith(separator)(canonicalVendorRoot), {
    onFalse: () => `${canonicalVendorRoot}${separator}`,
    onTrue: () => canonicalVendorRoot,
  });
  const containedPath = yield* Effect.filterOrFail(Effect.succeed(path), Str.startsWith(rootedPrefix), () =>
    VendorSlicePathEscape.make({ id, path, vendorRoot: canonicalVendorRoot })
  );
  return yield* fs.readFileString(containedPath).pipe(
    Effect.mapError(() =>
      VendorSliceReadError.make({
        id,
        path: containedPath,
      })
    )
  );
});

const readTaxonomySeedSlice = Effect.fn("TaxonomyLoader.readTaxonomySeedSlice")(function* (
  entry: VendorManifestEntry,
  vendorRoot: string
) {
  const content = yield* readVendorContent(entry.id, entry.path, vendorRoot);
  const seed = yield* TaxonomySeed.fromUnknownJsonStringEffect(content).pipe(
    Effect.mapError(() => VendorSliceParseError.make({ id: entry.id, path: entry.path }))
  );
  return LoadedTaxonomySeedSlice.make({ seed });
});

const readFolioAlignmentSlice = Effect.fn("TaxonomyLoader.readFolioAlignmentSlice")(function* (
  entry: VendorAlignmentManifestEntry,
  vendorRoot: string
) {
  const content = yield* readVendorContent(entry.id, entry.path, vendorRoot);
  const slice = yield* decodeFolioConceptSlice(content).pipe(
    Effect.mapError(() => VendorSliceParseError.make({ id: entry.id, path: entry.path }))
  );
  yield* Effect.filterOrFail(
    Effect.succeed(slice),
    P.Struct({ "@id": IRIReference.equivalence(entry.conceptIri) }),
    () =>
      VendorSliceConceptMismatch.make({
        actualConceptIri: slice["@id"],
        expectedConceptIri: entry.conceptIri,
        id: entry.id,
        path: entry.path,
      })
  );
  return LoadedFolioAlignmentSlice.make({
    alignment: ConceptAlignment.make({
      conceptIri: slice["@id"],
      kind: entry.mappingKind,
      sourceIri: entry.fetchUrl,
    }),
    id: entry.id,
    localConceptIri: entry.localConceptIri,
  });
});

const readVettedSlice = Effect.fn("TaxonomyLoader.readVettedSlice")(function* (
  entry: VendorLoadManifestEntry,
  vendorRoot: string
) {
  return yield* Match.type<VendorLoadManifestEntry>().pipe(
    Match.tagsExhaustive({
      VendorFolioAlignmentSlice: (entry) => readFolioAlignmentSlice(entry, vendorRoot),
      VendorTaxonomySeedSlice: (entry) => readTaxonomySeedSlice(entry, vendorRoot),
    })
  )(entry);
});

const readSlice: {
  (
    entry: VendorLoadManifestEntry,
    vendorRoot: string
  ): Effect.Effect<
    LoadedVendorSlice,
    | VendorSliceConceptMismatch
    | VendorSliceParseError
    | VendorSlicePathEscape
    | VendorSliceReadError
    | VendorSliceUnvetted,
    FileSystem.FileSystem
  >;
  (
    vendorRoot: string
  ): (
    entry: VendorLoadManifestEntry
  ) => Effect.Effect<
    LoadedVendorSlice,
    | VendorSliceConceptMismatch
    | VendorSliceParseError
    | VendorSlicePathEscape
    | VendorSliceReadError
    | VendorSliceUnvetted,
    FileSystem.FileSystem
  >;
} = dual(
  2,
  Effect.fn("TaxonomyLoader.readSlice")(function* (entry: VendorLoadManifestEntry, vendorRoot: string) {
    return yield* VendorLoadStatus.$match(entry.loadStatus, {
      UNVETTED: () => Effect.fail(VendorSliceUnvetted.make({ id: entry.id })),
      VETTED: () => readVettedSlice(entry, vendorRoot),
    });
  })
);

const toTaxonomySeed = Match.type<LoadedVendorSlice>().pipe(
  Match.tagsExhaustive({
    LoadedFolioAlignmentSlice: () => O.none(),
    LoadedTaxonomySeedSlice: ({ seed }) => O.some(seed),
  })
);

const toFolioAlignment = Match.type<LoadedVendorSlice>().pipe(
  Match.tagsExhaustive({
    LoadedFolioAlignmentSlice: (slice) => O.some(slice),
    LoadedTaxonomySeedSlice: () => O.none(),
  })
);

const appendAlignment = (concept: TaxonomyConcept, loaded: LoadedFolioAlignmentSlice): TaxonomyConcept =>
  Bool.match(
    Bool.and(
      IRIReference.equivalence(loaded.localConceptIri)(concept.iri),
      Bool.not(A.containsWith(alignmentEquivalence)(concept.alignments, loaded.alignment))
    ),
    {
      onFalse: () => concept,
      onTrue: () =>
        TaxonomyConcept.make({
          alignments: A.append(concept.alignments, loaded.alignment),
          broader: concept.broader,
          definition: concept.definition,
          documentClasses: concept.documentClasses,
          filingSegment: concept.filingSegment,
          iri: concept.iri,
          prefLabel: concept.prefLabel,
        }),
    }
  );

const mergeAlignment = Effect.fn("TaxonomyLoader.mergeAlignment")(function* (
  seed: TaxonomySeed,
  loaded: LoadedFolioAlignmentSlice
) {
  yield* Effect.filterOrFail(
    Effect.succeed(seed),
    (seed) => A.some(seed.concepts, P.Struct({ iri: IRIReference.equivalence(loaded.localConceptIri) })),
    () => VendorAlignmentTargetNotFound.make({ id: loaded.id, localConceptIri: loaded.localConceptIri })
  );
  return TaxonomySeed.make({
    concepts: A.map(seed.concepts, (concept) => appendAlignment(concept, loaded)),
    filingRoots: seed.filingRoots,
    pathTemplateSegments: seed.pathTemplateSegments,
    schemeIri: seed.schemeIri,
    title: seed.title,
  });
});

const mergeSlices = Effect.fn("TaxonomyLoader.mergeSlices")(function* (slices: ReadonlyArray<LoadedVendorSlice>) {
  const seeds = A.getSomes(A.map(slices, toTaxonomySeed));
  const alignments = A.getSomes(A.map(slices, toFolioAlignment));
  const seed = TaxonomySeed.make({
    concepts: A.appendAll(
      SemanticFoundationSeed.concepts,
      A.flatMap(seeds, (seed) => seed.concepts)
    ),
    filingRoots: A.appendAll(
      SemanticFoundationSeed.filingRoots,
      A.flatMap(seeds, (seed) => seed.filingRoots)
    ),
    pathTemplateSegments: SemanticFoundationSeed.pathTemplateSegments,
    schemeIri: SemanticFoundationSeed.schemeIri,
    title: SemanticFoundationSeed.title,
  });
  return yield* Effect.reduce(alignments, () => seed, mergeAlignment);
});

/**
 *  Service contract for loading the committed seed plus explicitly vetted slices.
 *
 * **Example** (Access service key)
 *
 * ```ts
 * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyLoader.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TaxonomyLoader extends Context.Service<
  TaxonomyLoader,
  {
    readonly load: {
      (
        manifestPath: string,
        vendorRoot: string
      ): Effect.Effect<
        TaxonomySeed,
        | TaxonomyManifestReadError
        | TaxonomyManifestParseError
        | VendorAlignmentTargetNotFound
        | VendorSliceConceptMismatch
        | VendorSliceUnvetted
        | VendorSliceReadError
        | VendorSliceParseError
        | VendorSlicePathEscape,
        FileSystem.FileSystem
      >;
      (
        vendorRoot: string
      ): (
        manifestPath: string
      ) => Effect.Effect<
        TaxonomySeed,
        | TaxonomyManifestReadError
        | TaxonomyManifestParseError
        | VendorAlignmentTargetNotFound
        | VendorSliceConceptMismatch
        | VendorSliceUnvetted
        | VendorSliceReadError
        | VendorSliceParseError
        | VendorSlicePathEscape,
        FileSystem.FileSystem
      >;
    };
  }
>()($I`TaxonomyLoader`) {
  /**
   *  Live loader implementation requiring only the portable FileSystem service.
   *
   * **Example** (Access live layer)
   *
   * ```ts
   * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
   * console.log(TaxonomyLoader.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.succeed(this, {
    load: dual(
      2,
      Effect.fn("TaxonomyLoader.load")(function* (manifestPath: string, vendorRoot: string) {
        const fs = yield* FileSystem.FileSystem;
        const content = yield* fs
          .readFileString(manifestPath)
          .pipe(Effect.mapError(() => TaxonomyManifestReadError.make({ path: manifestPath })));
        const entries = yield* parseManifest(manifestPath, content);
        const slices = yield* Effect.forEach(entries, (entry) => readSlice(entry, vendorRoot), { concurrency: 1 });
        return yield* mergeSlices(slices);
      })
    ),
  });
}
