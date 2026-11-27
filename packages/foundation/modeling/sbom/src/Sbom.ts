/**
 * The emitter facade.
 *
 * **Details**
 *
 * `generate` and `toJson` are plain total functions: the model is owned, so
 * there is no third-party serializer whose failure they would need to surface.
 * Only `write` has an error channel, and it is the filesystem's.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SbomId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, identity } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { admission } from "./internal/admission.ts";
import { BOM_FORMAT, Component, documentJson, SbomDocument, SbomMetadata, SPEC_VERSION } from "./SbomDocument.ts";

const $I = $SbomId.create("Sbom");

/**
 * Defines the root, dependencies and metadata used to assemble an SBOM with {@link Sbom.generate}.
 *
 * **Gotchas**
 *
 * `root` is a suspended `Component`. Annotating `Component` directly would
 * rebuild it to its underlying struct and drop the opaque `Component` type;
 * the suspend keeps the decoded root an admitted `Component`, which
 * `Sbom.generate` relies on.
 *
 * **Example** (Decode the root and dependency input)
 *
 * ```ts
 * import { SbomInput } from "@beep/sbom/Sbom"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(SbomInput)({
 *   root: { type: "application", name: "app" },
 *   components: []
 * })
 * console.log(input.root.name) // app
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SbomInput extends S.Opaque<SbomInput, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The component the BOM is about. */
    root: S.suspend((): typeof Component => Component).pipe(
      $I.annoteKey("SbomInput.root", { description: "The component the BOM is about." })
    ),
    /** Its dependencies, in any order — the document sorts them. */
    components: S.Array(Component).pipe(
      $I.annoteKey("SbomInput.components", { description: "Its dependencies, in any order — the document sorts them." })
    ),
    /** Document metadata. `root` is threaded onto it automatically. */
    metadata: S.optionalKey(SbomMetadata).pipe(
      $I.annoteKey("SbomInput.metadata", {
        description: "Document metadata. `root` is threaded onto it automatically.",
      })
    ),
  }).pipe($I.annoteSchema("SbomInput", { description: "Input to Sbom.generate." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SbomInput {
  /**
   * The plain object a {@link SbomInput} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SbomInput.Encoded;

  /**
   * The admitted field values {@link Sbom.generate} takes: a root and
   * components already built by `Component.make` (or decoded), and optional
   * `SbomMetadata`. Unlike {@link SbomInput.Encoded}, nothing here can fail
   * validation again.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Admitted = S.Struct.Type<typeof SbomInput.fields>;
}

/**
 * Controls the JSON indentation used by {@link Sbom.toJson}.
 *
 * **Example** (Choose compact JSON indentation)
 *
 * ```ts
 * import { SbomJsonOptions } from "@beep/sbom/Sbom"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownSync(SbomJsonOptions)({ space: 0 })
 * console.log(options.space) // 0
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SbomJsonOptions extends S.Opaque<SbomJsonOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** `JSON.stringify` indentation. Defaults to `2`; `0` emits one line. */
    space: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("SbomJsonOptions.space", {
        description: "JSON.stringify indentation. Defaults to 2; 0 emits one line.",
      })
    ),
  }).pipe($I.annoteSchema("SbomJsonOptions", { description: "Options for Sbom.toJson." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SbomJsonOptions {
  /**
   * The plain object a {@link SbomJsonOptions} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SbomJsonOptions.Encoded;
}

/**
 * **Details**
 *
 * The package's **only** error, and it is the filesystem's rather than the
 * emitter's — assembling and serializing a document cannot fail.
 *
 * **Example** (Identify a failed output path)
 *
 * ```ts
 * import { SbomWriteError } from "@beep/sbom/Sbom"
 *
 * const error = SbomWriteError.make({ path: "bom.json", cause: new Error("Read-only filesystem") })
 * console.log(error.message) // Failed to write the SBOM to bom.json
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SbomWriteError extends S.TaggedError<SbomWriteError, { readonly brand: unique symbol }>(
  $I`SbomWriteError`
)(
  "SbomWriteError",
  {
    /** The path that could not be written. */
    path: S.String.pipe($I.annoteKey("SbomWriteError.path", { description: "The path that could not be written." })),
    /** The underlying failure, preserved structurally. */
    cause: S.Defect().pipe(
      $I.annoteKey("SbomWriteError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<SbomWriteError>("SbomWriteError", { description: "Raised when a BOM cannot be written to disk." })
) {
  /**
   * Describes the output path whose write failed.
   *
   * **Example** (Read the filesystem failure message)
   *
   * ```ts
   * import { SbomWriteError } from "@beep/sbom/Sbom"
   *
   * const error = SbomWriteError.make({ path: "output/bom.json", cause: new Error("Missing directory") })
   * console.log(error.message) // Failed to write the SBOM to output/bom.json
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to write the SBOM to ${this.path}`;
  }
}

const generate = (input: SbomInput.Admitted): SbomDocument =>
  admission.admit(SbomDocument, {
    bomFormat: BOM_FORMAT,
    specVersion: SPEC_VERSION,
    version: 1,
    metadata: metadataWithRoot(input),
    components: A.sort(input.components, byName),
  });

const byName: Order.Order<Component.Encoded> = Order.mapInput(
  Str.Order,
  (component: Component.Encoded) => component.name
);

const metadataWithRoot = (input: SbomInput.Admitted): SbomMetadata.Encoded => ({
  component: input.root,
  ...(input.metadata?.timestamp !== undefined && { timestamp: input.metadata.timestamp }),
  ...(input.metadata?.authors !== undefined && { authors: input.metadata.authors }),
  ...(input.metadata?.supplier !== undefined && { supplier: input.metadata.supplier }),
});

// decision: dual-dispatch-by-subject-key
const isDocumentFirst = (args: IArguments): boolean => P.hasProperty(args[0], "bomFormat");

const toJson: {
  (document: SbomDocument, options?: SbomJsonOptions.Encoded): string;
  (options?: SbomJsonOptions.Encoded): (document: SbomDocument) => string;
} = dual(isDocumentFirst, (document: SbomDocument, options?: SbomJsonOptions.Encoded): string =>
  Result.getOrThrowWith(
    S.encodeResult(S.fromJsonString(S.Unknown, { space: options?.space ?? 2 }))(documentJson(document)),
    identity
  )
);

const write: {
  (
    document: SbomDocument,
    path: string,
    options?: SbomJsonOptions.Encoded
  ): Effect.Effect<void, SbomWriteError, FileSystem.FileSystem>;
  (
    path: string,
    options?: SbomJsonOptions.Encoded
  ): (document: SbomDocument) => Effect.Effect<void, SbomWriteError, FileSystem.FileSystem>;
} = dual(
  isDocumentFirst,
  Effect.fn("Sbom.write")(function* (document: SbomDocument, path: string, options?: SbomJsonOptions.Encoded) {
    const fs = yield* FileSystem.FileSystem;
    yield* fs
      .writeFileString(path, toJson(document, options))
      .pipe(Effect.mapError((cause) => SbomWriteError.make({ path, cause })));
  })
);

/**
 * The SBOM emitter: assemble, serialize, write.
 *
 * **Example** (Generate and serialize a CycloneDX SBOM)
 *
 * ```ts
 * import { Component } from "@beep/sbom/SbomDocument"
 * import { Sbom } from "@beep/sbom/Sbom"
 *
 * const root = Component.make({ type: "application", name: "app", version: "1.0.0" })
 * const document = Sbom.generate({ root, components: [] })
 * const json = Sbom.toJson(document) // CycloneDX 1.6 JSON text
 * console.log(json.includes('"specVersion": "1.6"')) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class Sbom {
  private constructor() {}

  /**
   * Assemble a CycloneDX 1.6 document.
   *
   * **Details**
   *
   * **Total** — no error channel, because there is nothing here that can fail:
   * the root and components are admitted values (`Component.make` or a
   * decode), so every invariant the document checks already holds. Plain
   * records do not type-check; admit them first. The document is admitted by
   * one `SbomDocument.make`, which copies the nested values, so a returned
   * component is never the caller's object.
   * Components are sorted by name, in code-unit order rather than a locale
   * collation, so two runs over the same inputs produce the same bytes on any host: an SBOM's digest becomes an attestation subject, and a document
   * that reordered itself between runs would change that digest for no reason.
   * A locale collation would vary with the runtime's locale and ICU data;
   * CycloneDX requires no order.
   *
   * **Example** (Generate a document with sorted dependencies)
   *
   * ```ts
   * import { Component } from "@beep/sbom/SbomDocument"
   * import { Sbom } from "@beep/sbom/Sbom"
   *
   * const root = Component.make({ type: "application", name: "app" })
   * const document = Sbom.generate({
   *   root,
   *   components: [
   *     Component.make({ type: "library", name: "zlib" }),
   *     Component.make({ type: "library", name: "alpha" })
   *   ]
   * })
   * console.log(document.components.map((component) => component.name).join(", ")) // alpha, zlib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly generate = generate;

  /**
   * Serialize a document to canonical CycloneDX 1.6 JSON.
   *
   * **Details**
   *
   * **Total.** Absent optional fields are omitted rather than emitted as `null`,
   * and `bomRef` becomes the specification's hyphenated `bom-ref`.
   *
   * **Example** (Serialize a renamed component reference)
   *
   * ```ts
   * import { Component } from "@beep/sbom/SbomDocument"
   * import { Sbom } from "@beep/sbom/Sbom"
   *
   * const root = Component.make({ type: "library", name: "lib", bomRef: "pkg:npm/lib@1.0.0" })
   * const document = Sbom.generate({ root, components: [] })
   * const json = Sbom.toJson(document, { space: 0 })
   * console.log(json.includes('"bom-ref":"pkg:npm/lib@1.0.0"')) // true
   * ```
   *
   * @category serialization
   * @since 0.0.0
   */
  static readonly toJson = toJson;

  /**
   * Write a document to `path` as canonical JSON.
   *
   * **Details**
   *
   * The one fallible member; it fails with {@link SbomWriteError} and requires
   * `FileSystem` in `R`. It does not create parent directories — a caller
   * that wants one creates it, so the failure mode stays "the path you gave me
   * is not writable" rather than "something was created somewhere".
   *
   * **Example** (Construct a filesystem-dependent SBOM write)
   *
   * ```ts
   * import { Component } from "@beep/sbom/SbomDocument"
   * import { Sbom } from "@beep/sbom/Sbom"
   * import * as Effect from "effect/Effect"
   *
   * const root = Component.make({ type: "application", name: "app" })
   * const document = Sbom.generate({ root, components: [] })
   * const program = Sbom.write(document, "bom.json")
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  static readonly write = write;
}
