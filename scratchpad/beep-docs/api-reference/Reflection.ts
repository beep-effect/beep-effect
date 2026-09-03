/**
 * Loads and verifies one TypeDoc reflection JSON file referenced by an
 * {@link ApiReferenceEntry}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema/Sha256";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Crypto, Effect, FileSystem, Path } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  ApiReferenceEntry,
  type TypeDocProjectReflection,
  TypeDocProjectReflectionFromBytes,
} from "../domain/ApiReference.ts";
import { PathEscapesDataset, resolveWithinDataset } from "./DatasetPath.ts";

const $I = $ScratchpadId.create("beep-docs/api-reference/Reflection");

/**
 * Default dataset directory relative to the working directory.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { defaultBaseDirectory } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * console.log(defaultBaseDirectory) // ".data/api-reference"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const defaultBaseDirectory = ".data/api-reference";

/**
 * Options for {@link loadReflection}.
 *
 * **Example** (Use the default base directory)
 *
 * ```ts
 * import { ReflectionOptions } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * console.log(ReflectionOptions.make({}).baseDirectory) // ".data/api-reference"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReflectionOptions extends S.Class<ReflectionOptions>($I`ReflectionOptions`)(
  {
    baseDirectory: S.String.pipe(SchemaUtils.withConstantDefault<string>(defaultBaseDirectory)),
  },
  $I.annote("ReflectionOptions", {
    description: "Where reflection JSON files are read from; defaults to `.data/api-reference`.",
  })
) {}

/**
 * Raised when the reflection file cannot be read or hashed.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { ReflectionReadFailed } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * console.log(ReflectionReadFailed.make({ path: "v4/effect/Option.json", cause: "ENOENT" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReflectionReadFailed extends S.TaggedError<ReflectionReadFailed>($I`ReflectionReadFailed`)(
  "ReflectionReadFailed",
  {
    path: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("ReflectionReadFailed", {
    description: "The reflection JSON file could not be read or hashed.",
  })
) {}

/**
 * Raised when the reflection file's SHA-256 digest does not match the digest
 * recorded in the dataset entry.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReflectionDigestMismatch } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * const error = S.decodeSync(ReflectionDigestMismatch)({
 *   _tag: "ReflectionDigestMismatch",
 *   entryId: "v4/effect/Option",
 *   expected: "a".repeat(64),
 *   received: "b".repeat(64),
 * })
 * console.log(error.entryId)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReflectionDigestMismatch extends S.TaggedError<ReflectionDigestMismatch>(
  $I`ReflectionDigestMismatch`
)(
  "ReflectionDigestMismatch",
  {
    entryId: S.String,
    expected: Sha256Hex,
    received: Sha256Hex,
  },
  $I.annote("ReflectionDigestMismatch", {
    description: "The reflection JSON file's digest differs from the digest recorded in its dataset entry.",
  })
) {}

/**
 * Raised when the reflection file is not valid TypeDoc project JSON.
 *
 * **Example** (Construct the error)
 *
 * ```ts
 * import { ReflectionDecodeFailed } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * console.log(ReflectionDecodeFailed.make({ path: "v4/effect/Option.json", cause: "not json" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReflectionDecodeFailed extends S.TaggedError<ReflectionDecodeFailed>($I`ReflectionDecodeFailed`)(
  "ReflectionDecodeFailed",
  {
    path: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("ReflectionDecodeFailed", {
    description: "The reflection JSON file did not decode as a TypeDoc project reflection.",
  })
) {}

/**
 * Every failure {@link loadReflection} can raise.
 *
 * **Example** (Branch on the failure)
 *
 * ```ts
 * import { LoadReflectionError, ReflectionReadFailed } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * const error = ReflectionReadFailed.make({ path: "v4/effect/Option.json", cause: "ENOENT" })
 * const describe = LoadReflectionError.match({
 *   PathEscapesDataset: (escaped) => `escapes: ${escaped.path}`,
 *   ReflectionReadFailed: (failed) => `read: ${failed.path}`,
 *   ReflectionDigestMismatch: (mismatch) => `digest: ${mismatch.entryId}`,
 *   ReflectionDecodeFailed: (failed) => `decode: ${failed.path}`,
 * })
 * console.log(describe(error)) // "read: v4/effect/Option.json"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const LoadReflectionError = S.Union([
  PathEscapesDataset,
  ReflectionReadFailed,
  ReflectionDigestMismatch,
  ReflectionDecodeFailed,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("LoadReflectionError", {
    description: "Typed failures raised while loading a reflection JSON file.",
  })
);

/**
 * Decoded type of {@link LoadReflectionError}.
 *
 * @category errors
 * @since 0.0.0
 */
export type LoadReflectionError = typeof LoadReflectionError.Type;

const sha256Equivalence = S.toEquivalence(Sha256Hex);

const entryId = (entry: ApiReferenceEntry): string => `${entry.version}/${entry.packageSlug}/${entry.modulePath}`;

/**
 * Reads the reflection JSON for `entry`, verifies it stays inside the dataset
 * and matches the recorded SHA-256 digest, then decodes it.
 *
 * **Details**
 *
 * The file is read once as bytes; the digest and the parsed document both
 * come from those bytes, so the checksum always covers exactly what was
 * decoded.
 *
 * **Example** (Load a reflection with Bun services)
 *
 * ```ts
 * import { BunServices } from "@effect/platform-bun"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { ApiReferenceEntry } from "@beep/scratchpad/beep-docs/domain/ApiReference"
 * import { loadReflection, ReflectionOptions } from "@beep/scratchpad/beep-docs/api-reference/Reflection"
 *
 * const entry = S.decodeUnknownSync(ApiReferenceEntry)({
 *   version: "v4",
 *   revision: "abc123",
 *   packageName: "effect",
 *   packageSlug: "effect",
 *   packageVersion: "4.0.0",
 *   packageDescription: "The core Effect library.",
 *   packageModuleCount: 1,
 *   packageNpmUrl: "https://www.npmjs.com/package/effect",
 *   packageSourceUrl: "https://github.com/Effect-TS/effect",
 *   modulePath: "Option",
 *   exportPath: "./Option",
 *   sourcePath: "src/Option.ts",
 *   reflectionPath: "v4/effect/Option.json",
 *   reflectionDigest: "a".repeat(64),
 *   typedocSchemaVersion: "2.0",
 * })
 *
 * const program = loadReflection(entry, ReflectionOptions.make({ baseDirectory: ".data/api-reference" })).pipe(
 *   Effect.match({
 *     onFailure: (error) => error._tag,
 *     onSuccess: (reflection) => reflection.name,
 *   }),
 *   Effect.provide(BunServices.layer)
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
type LoadReflectionEffect = Effect.Effect<
  TypeDocProjectReflection,
  LoadReflectionError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path
>;

const isApiReferenceEntry = S.is(ApiReferenceEntry);

export const loadReflection: {
  (options?: ReflectionOptions): (entry: ApiReferenceEntry) => LoadReflectionEffect;
  (entry: ApiReferenceEntry, options?: ReflectionOptions): LoadReflectionEffect;
} = dual(
  (args) => args.length > 0 && isApiReferenceEntry(args[0]),
  Effect.fn("Reflection.loadReflection")(function* (
    entry: ApiReferenceEntry,
    options: ReflectionOptions = ReflectionOptions.make({})
  ) {
  const fs = yield* FileSystem.FileSystem;
  const reflectionPath = yield* resolveWithinDataset(options.baseDirectory, entry.reflectionPath);
  const bytes = yield* fs
    .readFile(reflectionPath)
    .pipe(Effect.mapError((cause) => ReflectionReadFailed.make({ path: reflectionPath, cause })));
  yield* Sha256HexFromBytes.decodeEffect(bytes).pipe(
    Effect.mapError((cause) => ReflectionReadFailed.make({ path: reflectionPath, cause })),
    Effect.filterOrFail(
      (digest) => sha256Equivalence(digest, entry.reflectionDigest),
      (digest) =>
        ReflectionDigestMismatch.make({
          entryId: entryId(entry),
          expected: entry.reflectionDigest,
          received: digest,
        })
    )
  );
  return yield* TypeDocProjectReflectionFromBytes.decodeEffect(bytes).pipe(
    Effect.mapError((cause) => ReflectionDecodeFailed.make({ path: reflectionPath, cause }))
  );
  })
);
