/**
 * Fail-closed manifest loader for semantic-foundation taxonomy slices.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { isFilingSegment, TaxonomySeed } from "./SemanticFoundation.models.ts";
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
 *  One manifest row admitted by the package loader.
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

const decodeManifestEntry = S.decodeUnknownEffect(S.fromJsonString(VendorManifestEntry));

const parseManifest = Effect.fn("TaxonomyLoader.parseManifest")(function* (path: string, content: string) {
  const lines = A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty);
  return yield* Effect.forEach(
    lines,
    (line, index) =>
      decodeManifestEntry(line).pipe(
        Effect.mapError(() =>
          TaxonomyManifestParseError.make({
            line: index + 1,
            path,
          })
        )
      ),
    { concurrency: 1 }
  );
});

const readSlice: {
  (
    entry: VendorManifestEntry,
    vendorRoot: string
  ): Effect.Effect<
    TaxonomySeed,
    VendorSliceParseError | VendorSlicePathEscape | VendorSliceReadError | VendorSliceUnvetted,
    FileSystem.FileSystem
  >;
  (
    vendorRoot: string
  ): (
    entry: VendorManifestEntry
  ) => Effect.Effect<
    TaxonomySeed,
    VendorSliceParseError | VendorSlicePathEscape | VendorSliceReadError | VendorSliceUnvetted,
    FileSystem.FileSystem
  >;
} = dual(
  2,
  Effect.fn("TaxonomyLoader.readSlice")(function* (
    entry: VendorManifestEntry,
    vendorRoot: string
  ): Effect.fn.Return<
    TaxonomySeed,
    VendorSliceParseError | VendorSlicePathEscape | VendorSliceReadError | VendorSliceUnvetted,
    FileSystem.FileSystem
  > {
    return yield* VendorLoadStatus.$match(entry.loadStatus, {
      UNVETTED: () => Effect.fail(VendorSliceUnvetted.make({ id: entry.id })),
      VETTED: Effect.fn("TaxonomyLoader.readVettedSlice")(function* () {
        const fs = yield* FileSystem.FileSystem;
        const canonicalVendorRoot = yield* fs.realPath(vendorRoot).pipe(
          Effect.mapError(() =>
            VendorSliceReadError.make({
              id: entry.id,
              path: vendorRoot,
            })
          )
        );
        const candidatePath = A.join([canonicalVendorRoot, entry.path], "/");
        const path = yield* fs.realPath(candidatePath).pipe(
          Effect.mapError(() =>
            VendorSliceReadError.make({
              id: entry.id,
              path: candidatePath,
            })
          )
        );
        const separator =
          Str.includes("\\")(canonicalVendorRoot) && !Str.includes("/")(canonicalVendorRoot) ? "\\" : "/";
        const rootedPrefix = Str.endsWith(separator)(canonicalVendorRoot)
          ? canonicalVendorRoot
          : `${canonicalVendorRoot}${separator}`;
        if (!Str.startsWith(rootedPrefix)(path)) {
          return yield* VendorSlicePathEscape.make({
            id: entry.id,
            path,
            vendorRoot: canonicalVendorRoot,
          });
        }
        const content = yield* fs.readFileString(path).pipe(
          Effect.mapError(() =>
            VendorSliceReadError.make({
              id: entry.id,
              path,
            })
          )
        );
        return yield* TaxonomySeed.fromUnknownJsonStringEffect(content).pipe(
          Effect.mapError(() => VendorSliceParseError.make({ id: entry.id, path }))
        );
      }),
    });
  })
);

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
      })
    ),
  });
}
