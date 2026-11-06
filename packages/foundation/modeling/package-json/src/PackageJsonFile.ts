/**
 * The `PackageJsonFile` service — the only IO module. It reads and writes
 * package.json over core `FileSystem` / `Path`, so the layer requires those
 * services and the consumer provides a platform implementation
 * (`@effect/platform-node`) at the edge. Resolution is not fused into `write`
 * (compose `Package.resolve` explicitly).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import { JsoncPath } from "@beep/jsonc/JsoncNode";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Package } from "./Package.ts";
import { PackageJsonFormat } from "./PackageJsonFormat.ts";
import { PackageManifest } from "./PackageManifest.ts";
import type { JsoncStringifyError } from "@beep/jsonc";
import type { PackageDecodeError, PackageFormatOptions } from "./Package.ts";
import type { PackageJsonModifyError } from "./PackageJsonFormat.ts";

const $I = $PackageJsonId.create("PackageJsonFile");

const Json = S.fromJsonString(S.Unknown);

// ── Errors ────────────────────────────────────────────────────────────────────

/**
 * Indicates that a package.json file could not be read from the filesystem
 * (a filesystem error other than not-found).
 *
 * **Example** (Inspect PackageJsonReadError details)
 *
 * ```ts
 * import { PackageJsonReadError } from "@beep/package-json/PackageJsonFile";
 *
 * const error = PackageJsonReadError.make({ path: "package.json", cause: new Error("permission denied") });
 * console.log(error.message) // Failed to read package.json from "package.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageJsonReadError extends S.TaggedError<PackageJsonReadError, { readonly brand: unique symbol }>(
  $I`PackageJsonReadError`
)(
  "PackageJsonReadError",
  {
    /**
     * The path that could not be read.
     *
     * @since 0.0.0
     */
    path: S.String.pipe($I.annoteKey("PackageJsonReadError.path", { description: "The path that could not be read." })),
    /**
     * The underlying failure, preserved structurally.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("PackageJsonReadError.cause", { description: "The underlying failure, preserved structurally." })
    ),
  },
  $I.annoteError<PackageJsonReadError>("PackageJsonReadError", {
    description:
      "Indicates that a package.json file could not be read from the filesystem (a filesystem error other than not-found).",
  })
) {
  /**
   * Formats a diagnostic message identifying the failed file path.
   *
   * **Example** (Inspect PackageJsonReadError details)
   *
   * ```ts
   * import { PackageJsonReadError } from "@beep/package-json/PackageJsonFile";
   *
   * const error = PackageJsonReadError.make({ path: "package.json", cause: new Error("permission denied") });
   * console.log(error.message) // Failed to read package.json from "package.json"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to read package.json from "${this.path}"`;
  }
}

/**
 * Indicates that no package.json file exists at the expected path. Carries its
 * own tag for `catchTag` routing.
 *
 * **Example** (Inspect PackageJsonNotFoundError details)
 *
 * ```ts
 * import { PackageJsonNotFoundError } from "@beep/package-json/PackageJsonFile";
 *
 * const error = PackageJsonNotFoundError.make({ path: "package.json" });
 * console.log(error.message) // package.json not found at "package.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageJsonNotFoundError extends S.TaggedError<
  PackageJsonNotFoundError,
  { readonly brand: unique symbol }
>($I`PackageJsonNotFoundError`)(
  "PackageJsonNotFoundError",
  {
    /**
     * The path where package.json was expected.
     *
     * @since 0.0.0
     */
    path: S.String.pipe(
      $I.annoteKey("PackageJsonNotFoundError.path", { description: "The path where package.json was expected." })
    ),
  },
  $I.annoteError<PackageJsonNotFoundError>("PackageJsonNotFoundError", {
    description:
      "Indicates that no package.json file exists at the expected path. Carries its own tag for `catchTag` routing.",
  })
) {
  /**
   * Formats a diagnostic message identifying the failed file path.
   *
   * **Example** (Inspect PackageJsonNotFoundError details)
   *
   * ```ts
   * import { PackageJsonNotFoundError } from "@beep/package-json/PackageJsonFile";
   *
   * const error = PackageJsonNotFoundError.make({ path: "package.json" });
   * console.log(error.message) // package.json not found at "package.json"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `package.json not found at "${this.path}"`;
  }
}

/**
 * Indicates that a package.json file's contents are not valid JSON.
 *
 * **Example** (Inspect PackageJsonParseError details)
 *
 * ```ts
 * import { PackageJsonParseError } from "@beep/package-json/PackageJsonFile";
 *
 * const error = PackageJsonParseError.make({ path: "package.json", cause: new Error("invalid JSON") });
 * console.log(error.message) // Failed to parse package.json at "package.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageJsonParseError extends S.TaggedError<PackageJsonParseError, { readonly brand: unique symbol }>(
  $I`PackageJsonParseError`
)(
  "PackageJsonParseError",
  {
    /**
     * The path whose contents failed to parse as JSON.
     *
     * @since 0.0.0
     */
    path: S.String.pipe(
      $I.annoteKey("PackageJsonParseError.path", { description: "The path whose contents failed to parse as JSON." })
    ),
    /**
     * The schema decoding error, preserved structurally.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("PackageJsonParseError.cause", { description: "The schema decoding error, preserved structurally." })
    ),
  },
  $I.annoteError<PackageJsonParseError>("PackageJsonParseError", {
    description: "Indicates that a package.json file's contents are not valid JSON.",
  })
) {
  /**
   * Formats a diagnostic message identifying the failed file path.
   *
   * **Example** (Inspect PackageJsonParseError details)
   *
   * ```ts
   * import { PackageJsonParseError } from "@beep/package-json/PackageJsonFile";
   *
   * const error = PackageJsonParseError.make({ path: "package.json", cause: new Error("invalid JSON") });
   * console.log(error.message) // Failed to parse package.json at "package.json"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to parse package.json at "${this.path}"`;
  }
}

/**
 * Indicates that a package.json file could not be written to the filesystem.
 * Narrowed to the filesystem-write failure only — never a resolution or encode
 * error.
 *
 * **Example** (Inspect PackageJsonWriteError details)
 *
 * ```ts
 * import { PackageJsonWriteError } from "@beep/package-json/PackageJsonFile";
 *
 * const error = PackageJsonWriteError.make({ path: "package.json", cause: new Error("read-only filesystem") });
 * console.log(error.message) // Failed to write package.json to "package.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageJsonWriteError extends S.TaggedError<PackageJsonWriteError, { readonly brand: unique symbol }>(
  $I`PackageJsonWriteError`
)(
  "PackageJsonWriteError",
  {
    /**
     * The path that could not be written.
     *
     * @since 0.0.0
     */
    path: S.String.pipe(
      $I.annoteKey("PackageJsonWriteError.path", { description: "The path that could not be written." })
    ),
    /**
     * The underlying filesystem failure, preserved structurally. Narrowed to the write failure only.
     *
     * @since 0.0.0
     */
    cause: S.Defect().pipe(
      $I.annoteKey("PackageJsonWriteError.cause", {
        description: "The underlying filesystem failure, preserved structurally. Narrowed to the write failure only.",
      })
    ),
  },
  $I.annoteError<PackageJsonWriteError>("PackageJsonWriteError", {
    description:
      "Indicates that a package.json file could not be written to the filesystem. Narrowed to the filesystem-write failure only — never a resolution or encode error.",
  })
) {
  /**
   * Formats a diagnostic message identifying the failed file path.
   *
   * **Example** (Inspect PackageJsonWriteError details)
   *
   * ```ts
   * import { PackageJsonWriteError } from "@beep/package-json/PackageJsonFile";
   *
   * const error = PackageJsonWriteError.make({ path: "package.json", cause: new Error("read-only filesystem") });
   * console.log(error.message) // Failed to write package.json to "package.json"
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to write package.json to "${this.path}"`;
  }
}

/**
 * One surgical field edit for {@link PackageJsonFile}'s `modify`: set `value`
 * at `path`, or delete the key there when `value` is `undefined` (the
 * `@beep/jsonc` / `@beep/yaml` modify convention — deletion is spelled
 * with an explicit `value: undefined`, so it is always deliberate).
 *
 * **Example** (Construct a field edit)
 *
 * ```ts
 * import { PackageFieldEdit } from "@beep/package-json/PackageJsonFile";
 *
 * const edit = PackageFieldEdit.make({ path: ["packageManager"], value: "pnpm@11.3.0" });
 * console.log(edit.path) // [ 'packageManager' ]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PackageFieldEdit extends S.Opaque<PackageFieldEdit, { readonly brand: unique symbol }>()(
  S.Struct({
    path: JsoncPath.pipe(
      $I.annoteKey("PackageFieldEdit.path", {
        description: 'The field path, e.g. `["packageManager"]` or `["devEngines", "runtime", "version"]`.',
      })
    ),
    value: S.Unknown.pipe(
      $I.annoteKey("PackageFieldEdit.value", {
        description: "The plain JSON value to write, or `undefined` to delete the target key.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PackageFieldEdit", {
      description: "One surgical package.json field edit: set `value` at `path`, or delete the key when undefined.",
    })
  )
) {}

/**
 * Companion types for {@link PackageFieldEdit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PackageFieldEdit {
  /**
   * The plain edit object `modify` accepts: a constructed
   * {@link PackageFieldEdit} or an object literal with the same fields.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PackageFieldEdit.Encoded;
}

/**
 * The shape of the {@link PackageJsonFile} service — the value produced by
 * {@link PackageJsonFile.make} and carried by its layer.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface PackageJsonFileShape {
  /**
   * Apply surgical field edits to a package.json file **without decoding
   * it**: one read, each {@link PackageFieldEdit} applied in order through
   * `PackageJsonFormat.modifyToString`, one write — skipped when the result
   * is byte-identical to what was read. Every byte outside the edited spans
   * is preserved (key order, indentation, line endings, trailing newline),
   * which is what keeps a one-field change reviewable in someone else's
   * repository. Succeeds with the file's final text.
   *
   * **Details**
   *
   * Invalid JSON at `path` fails as `PackageJsonParseError` — the same tag
   * `read` uses for it — and an unnavigable edit path as
   * `PackageJsonModifyError`.
   *
   * @since 0.0.0
   */
  readonly modify: {
    (path: string, edits: ReadonlyArray<PackageFieldEdit.Encoded>): Effect.Effect<string, PackageJsonModifyFailure>;
    (edits: ReadonlyArray<PackageFieldEdit.Encoded>): (path: string) => Effect.Effect<string, PackageJsonModifyFailure>;
  };
  /**
   * Read and decode a package.json file. Fails with `PackageJsonNotFoundError`
   * (ENOENT), `PackageJsonReadError` (other fs errors), `PackageJsonParseError`
   * (invalid JSON) or `PackageDecodeError` (schema decode).
   *
   * @since 0.0.0
   */
  readonly read: (
    path: string
  ) => Effect.Effect<
    Package,
    PackageJsonReadError | PackageJsonNotFoundError | PackageJsonParseError | PackageDecodeError
  >;
  /**
   * Read and decode a package.json file through the presence-lenient
   * {@link PackageManifest} — the read that accepts the private
   * workspace-root shape (`{ "private": true, "packageManager": ... }`)
   * `read` rejects. Same error channel as `read`; a present field that does
   * not satisfy its codec still fails as `PackageDecodeError`.
   *
   * @since 0.0.0
   */
  readonly readManifest: (
    path: string
  ) => Effect.Effect<
    PackageManifest,
    PackageJsonReadError | PackageJsonNotFoundError | PackageJsonParseError | PackageDecodeError
  >;
  /**
   * Serialize and write a package.json file. Fails with
   * `PackageJsonWriteError`. With `indent: "preserve"` and no explicit
   * `sourceText`, the existing file at `path` (when readable) supplies the
   * source text whose indentation is preserved.
   *
   * @since 0.0.0
   */
  readonly write: {
    (path: string, pkg: Package, options?: PackageFormatOptions.Encoded): Effect.Effect<void, PackageJsonWriteError>;
    (
      pkg: Package,
      options?: PackageFormatOptions.Encoded
    ): (path: string) => Effect.Effect<void, PackageJsonWriteError>;
  };
  /**
   * Serialize and write a {@link PackageManifest}. Fails with
   * `PackageJsonWriteError`. Shares `write`'s `indent: "preserve"` behavior:
   * with no explicit `sourceText`, the existing file at `path` (when
   * readable) supplies the source text whose indentation is preserved.
   *
   * @since 0.0.0
   */
  readonly writeManifest: {
    (
      path: string,
      manifest: PackageManifest,
      options?: PackageFormatOptions.Encoded
    ): Effect.Effect<void, PackageJsonWriteError>;
    (
      manifest: PackageManifest,
      options?: PackageFormatOptions.Encoded
    ): (path: string) => Effect.Effect<void, PackageJsonWriteError>;
  };
}

/** Every failure {@link PackageJsonFileShape.modify} can raise. */
type PackageJsonModifyFailure =
  | PackageJsonReadError
  | PackageJsonNotFoundError
  | PackageJsonParseError
  | PackageJsonModifyError
  | JsoncStringifyError
  | PackageJsonWriteError;

/** Data-first dispatch for the path-first members: the subject is the file path. */
const isPathFirst = (args: IArguments): boolean => P.isString(args[0]);

/**
 * Reads, writes and surgically edits package.json files over core `FileSystem`
 * / `Path`. The layer requires those services; provide
 * `@effect/platform-node`'s `NodeFileSystem` / `NodePath` (or a bun equivalent)
 * at the application boundary.
 *
 * **Example** (Read a package file with Node filesystem services)
 *
 * ```ts
 * import { PackageJsonFile } from "@beep/package-json/PackageJsonFile";
 * import { NodeFileSystem, NodePath } from "@effect/platform-node";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const files = yield* PackageJsonFile;
 *   return yield* files.read("./package.json");
 * }).pipe(Effect.provide(PackageJsonFile.layer), Effect.provide(NodeFileSystem.layer), Effect.provide(NodePath.layer));
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class PackageJsonFile extends Context.Service<PackageJsonFile, PackageJsonFileShape>()($I`PackageJsonFile`) {
  /**
   * Build the service implementation from `FileSystem` / `Path` in context; use {@link PackageJsonFile.layer} to provide it.
   *
   * **Example** (Construct the filesystem-backed service effect)
   *
   * ```ts
   * import { PackageJsonFile } from "@beep/package-json/PackageJsonFile";
   * import * as Effect from "effect/Effect";
   *
   * console.log(Effect.isEffect(PackageJsonFile.make)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make: Effect.Effect<PackageJsonFileShape, never, FileSystem.FileSystem | Path.Path> = Effect.gen(
    function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      // Read the file's text directly — no `exists` pre-check (that TOCTOU
      // race reports a file deleted between the two calls as
      // PackageJsonReadError). The core FileSystem fails with a
      // PlatformError whose `reason._tag` is "NotFound" for a missing file;
      // route only that to NotFound.
      const readText = (target: string) =>
        fs
          .readFileString(target)
          .pipe(
            Effect.mapError((cause) =>
              cause.reason._tag === "NotFound"
                ? PackageJsonNotFoundError.make({ path: target })
                : PackageJsonReadError.make({ path: target, cause })
            )
          );

      const readJson = Effect.fn("PackageJsonFile.readJson")(function* (target: string) {
        const content = yield* readText(target);
        return yield* S.decodeEffect(Json)(content).pipe(
          Effect.mapError((cause) => PackageJsonParseError.make({ path: target, cause }))
        );
      });

      // `indent: "preserve"` with no source text in hand: detect the
      // indentation from the file being overwritten. Any read failure (most
      // commonly a fresh file) falls back to the default indent.
      const withPreservedSource: {
        (
          target: string,
          options?: PackageFormatOptions.Encoded
        ): Effect.Effect<PackageFormatOptions.Encoded | undefined>;
        (
          options?: PackageFormatOptions.Encoded
        ): (target: string) => Effect.Effect<PackageFormatOptions.Encoded | undefined>;
      } = dual(
        isPathFirst,
        Effect.fn("PackageJsonFile.withPreservedSource")(function* (
          target: string,
          options?: PackageFormatOptions.Encoded
        ) {
          if (options?.indent !== "preserve" || options.sourceText !== undefined) {
            return options;
          }
          const existing = yield* fs
            .readFileString(target)
            .pipe(Effect.orElseSucceed((): string | undefined => undefined));
          return existing === undefined ? options : { ...options, sourceText: existing };
        })
      );

      const writeText: {
        (target: string, json: string): Effect.Effect<void, PackageJsonWriteError>;
        (json: string): (target: string) => Effect.Effect<void, PackageJsonWriteError>;
      } = dual(
        2,
        Effect.fn("PackageJsonFile.writeText")(
          function* (target: string, json: string) {
            const directory = path.dirname(target);
            yield* fs.makeDirectory(directory, { recursive: true });
            yield* fs.writeFileString(target, json);
          },
          (effect, target) =>
            effect.pipe(Effect.mapError((cause) => PackageJsonWriteError.make({ path: target, cause })))
        )
      );

      const read = Effect.fn("PackageJsonFile.read")(function* (target: string) {
        const readJson1 = yield* readJson(target);
        return yield* Package.decode(readJson1);
      });

      const write: PackageJsonFileShape["write"] = dual(
        isPathFirst,
        Effect.fn("PackageJsonFile.write")(function* (
          target: string,
          pkg: Package,
          options?: PackageFormatOptions.Encoded
        ) {
          const effective = yield* withPreservedSource(target, options);
          yield* writeText(target, pkg.toJsonString(effective));
        })
      );

      const readManifest = Effect.fn("PackageJsonFile.readManifest")(function* (target: string) {
        const readJson2 = yield* readJson(target);
        return yield* PackageManifest.decode(readJson2);
      });

      const writeManifest: PackageJsonFileShape["writeManifest"] = dual(
        isPathFirst,
        Effect.fn("PackageJsonFile.writeManifest")(function* (
          target: string,
          manifest: PackageManifest,
          options?: PackageFormatOptions.Encoded
        ) {
          const effective = yield* withPreservedSource(target, options);
          yield* writeText(target, manifest.toJsonString(effective));
        })
      );

      const modify: PackageJsonFileShape["modify"] = dual(
        2,
        Effect.fn("PackageJsonFile.modify")(function* (target: string, edits: ReadonlyArray<PackageFieldEdit.Encoded>) {
          const source = yield* readText(target);
          let text = source;
          for (const edit of edits) {
            // Each edit re-navigates the current text, so a later edit may
            // target a key an earlier one inserted; overlap cannot arise.
            text = yield* PackageJsonFormat.modifyToString(text, edit.path, edit.value).pipe(
              // The service's invalid-JSON tag is PackageJsonParseError,
              // whichever entry point met it — normalize the text-level
              // syntax error at this boundary.
              Effect.catchTag("PackageJsonSyntaxError", (cause) => PackageJsonParseError.make({ path: target, cause }))
            );
          }
          // A no-op edit set leaves the bytes alone entirely — no write, no
          // mtime churn.
          if (text !== source) {
            yield* writeText(target, text);
          }
          return text;
        })
      );

      return { read, write, readManifest, writeManifest, modify };
    }
  );

  /**
   * The live layer. Requires core `FileSystem` / `Path`, provided by the
   * consumer's platform implementation at the edge.
   *
   * **Example** (Provide the package file service layer)
   *
   * ```ts
   * import { PackageJsonFile } from "@beep/package-json/PackageJsonFile";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const files = yield* PackageJsonFile;
   *   return yield* files.read("package.json");
   * }).pipe(Effect.provide(PackageJsonFile.layer));
   *
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<PackageJsonFile, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
    PackageJsonFile,
    PackageJsonFile.make
  );
}
