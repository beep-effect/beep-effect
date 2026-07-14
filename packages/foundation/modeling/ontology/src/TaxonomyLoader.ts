/**
 * Fail-closed manifest loader for semantic-foundation taxonomy slices.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
import { Context, Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { TaxonomySeed } from "./SemanticFoundation.models.js";
import { SemanticFoundationSeed } from "./SemanticFoundation.seed.js";

const $I = $OntologyId.create("TaxonomyLoader");

/** Repository-relative production manifest contract.
 * @example
 * ```ts
 * import { VendorManifestPath } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorManifestPath.endsWith("manifest.jsonl")) // true
 * ```
 * @category constants
 * @since 0.0.0
 */
export const VendorManifestPath = "explorations/legal-ontology-landscape/assets/manifest.jsonl";

/** Explicit loader-vetting state required in addition to research verification.
 * @example
 * ```ts
 * import { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorLoadStatus.is.VETTED("VETTED")) // true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const VendorLoadStatus = LiteralKit(["VETTED", "UNVETTED"]).pipe(
  $I.annoteSchema("VendorLoadStatus", { description: "Explicit implementation-loading verdict for a vendor slice." })
);

/** Runtime type for {@link VendorLoadStatus}.
 * @example
 * ```ts
 * import type { VendorLoadStatus } from "@beep/ontology/TaxonomyLoader"
 * const status: VendorLoadStatus = "UNVETTED"
 * console.log(status)
 * ```
 * @category models
 * @since 0.0.0
 */
export type VendorLoadStatus = typeof VendorLoadStatus.Type;

/** One manifest row admitted by the package loader.
 * @example
 * ```ts
 * import { VendorManifestEntry } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorManifestEntry.make({ format: "jsonld", id: "fixture", loadStatus: "VETTED", path: "fixture.jsonld" }).id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VendorManifestEntry extends S.Class<VendorManifestEntry>($I`VendorManifestEntry`)(
  { format: S.Literal("jsonld"), id: S.NonEmptyString, loadStatus: VendorLoadStatus, path: S.NonEmptyString },
  $I.annote("VendorManifestEntry", { description: "Manifest row for one explicitly vetted JSON-LD taxonomy slice." })
) {}

/** Raised when the manifest cannot be read.
 * @example
 * ```ts
 * import { TaxonomyManifestReadError } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyManifestReadError.make({ path: "missing.jsonl" })._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyManifestReadError extends TaggedErrorClass<TaxonomyManifestReadError>(
  $I`TaxonomyManifestReadError`
)(
  "TaxonomyManifestReadError",
  { path: S.NonEmptyString },
  $I.annote("TaxonomyManifestReadError", { description: "The vendor manifest is missing or unreadable." })
) {}

/** Raised when a manifest row cannot be parsed.
 * @example
 * ```ts
 * import { TaxonomyManifestParseError } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyManifestParseError.make({ line: 1, path: "manifest.jsonl" }).line)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyManifestParseError extends TaggedErrorClass<TaxonomyManifestParseError>(
  $I`TaxonomyManifestParseError`
)(
  "TaxonomyManifestParseError",
  { line: S.Int, path: S.NonEmptyString },
  $I.annote("TaxonomyManifestParseError", { description: "A vendor manifest JSONL row failed schema decoding." })
) {}

/** Raised when a manifest slice lacks explicit loading approval.
 * @example
 * ```ts
 * import { VendorSliceUnvetted } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceUnvetted.make({ id: "folio" }).id)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceUnvetted extends TaggedErrorClass<VendorSliceUnvetted>($I`VendorSliceUnvetted`)(
  "VendorSliceUnvetted",
  { id: S.NonEmptyString },
  $I.annote("VendorSliceUnvetted", { description: "A vendor slice is not explicitly VETTED for loading." })
) {}

/** Raised when an approved slice cannot be read.
 * @example
 * ```ts
 * import { VendorSliceReadError } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceReadError.make({ id: "fixture", path: "missing.jsonld" })._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceReadError extends TaggedErrorClass<VendorSliceReadError>($I`VendorSliceReadError`)(
  "VendorSliceReadError",
  { id: S.NonEmptyString, path: S.NonEmptyString },
  $I.annote("VendorSliceReadError", { description: "An explicitly vetted vendor slice is unreadable." })
) {}

/** Raised when an approved slice cannot be schema-decoded.
 * @example
 * ```ts
 * import { VendorSliceParseError } from "@beep/ontology/TaxonomyLoader"
 * console.log(VendorSliceParseError.make({ id: "fixture", path: "fixture.jsonld" }).id)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class VendorSliceParseError extends TaggedErrorClass<VendorSliceParseError>($I`VendorSliceParseError`)(
  "VendorSliceParseError",
  { id: S.NonEmptyString, path: S.NonEmptyString },
  $I.annote("VendorSliceParseError", { description: "An explicitly vetted vendor taxonomy slice is unparsable." })
) {}

const decodeManifestEntry = S.decodeUnknownEffect(S.fromJsonString(VendorManifestEntry));
const decodeTaxonomySeed = S.decodeUnknownEffect(S.fromJsonString(TaxonomySeed));

const parseManifest = Effect.fn("TaxonomyLoader.parseManifest")(function* (path: string, content: string) {
  const lines = A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty);
  return yield* Effect.forEach(
    lines,
    (line, index) =>
      decodeManifestEntry(line).pipe(Effect.mapError(() => TaxonomyManifestParseError.make({ line: index + 1, path }))),
    { concurrency: 1 }
  );
});

const readSlice = Effect.fn("TaxonomyLoader.readSlice")(function* (entry: VendorManifestEntry, vendorRoot: string) {
  return yield* VendorLoadStatus.$match(entry.loadStatus, {
    UNVETTED: () => Effect.fail(VendorSliceUnvetted.make({ id: entry.id })),
    VETTED: Effect.fn("TaxonomyLoader.readVettedSlice")(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = A.join([vendorRoot, entry.path], "/");
      const content = yield* fs
        .readFileString(path)
        .pipe(Effect.mapError(() => VendorSliceReadError.make({ id: entry.id, path })));
      return yield* decodeTaxonomySeed(content).pipe(
        Effect.mapError(() => VendorSliceParseError.make({ id: entry.id, path }))
      );
    }),
  });
});

/** Service contract for loading the committed seed plus explicitly vetted slices.
 * @example
 * ```ts
 * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
 * console.log(TaxonomyLoader.key)
 * ```
 * @category services
 * @since 0.0.0
 */
export class TaxonomyLoader extends Context.Service<
  TaxonomyLoader,
  {
    readonly load: (
      manifestPath: string,
      vendorRoot: string
    ) => Effect.Effect<
      TaxonomySeed,
      | TaxonomyManifestReadError
      | TaxonomyManifestParseError
      | VendorSliceUnvetted
      | VendorSliceReadError
      | VendorSliceParseError,
      FileSystem.FileSystem
    >;
  }
>()($I`TaxonomyLoader`) {
  /** Live loader implementation requiring only the portable FileSystem service.
   * @example
   * ```ts
   * import { TaxonomyLoader } from "@beep/ontology/TaxonomyLoader"
   * console.log(TaxonomyLoader.layer)
   * ```
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.succeed(this, {
    load: Effect.fn("TaxonomyLoader.load")(function* (manifestPath: string, vendorRoot: string) {
      const fs = yield* FileSystem.FileSystem;
      const content = yield* fs
        .readFileString(manifestPath)
        .pipe(Effect.mapError(() => TaxonomyManifestReadError.make({ path: manifestPath })));
      const entries = yield* parseManifest(manifestPath, content);
      const slices = yield* Effect.forEach(entries, (entry) => readSlice(entry, vendorRoot), { concurrency: 1 });
      return TaxonomySeed.make({
        concepts: A.appendAll(
          SemanticFoundationSeed.concepts,
          A.flatMap(slices, (slice) => slice.concepts)
        ),
        filingRoots: A.appendAll(
          SemanticFoundationSeed.filingRoots,
          A.flatMap(slices, (slice) => slice.filingRoots)
        ),
        pathTemplateSegments: SemanticFoundationSeed.pathTemplateSegments,
        schemeIri: SemanticFoundationSeed.schemeIri,
        title: SemanticFoundationSeed.title,
      });
    }),
  });
}
