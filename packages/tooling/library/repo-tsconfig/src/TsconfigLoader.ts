/**
 * The tsconfig.json IO pipeline: read a config file, decode it through
 * `TsconfigJsonFromString`, then resolve its full `extends` chain
 * against the pure merge engine (`ResolvedTsconfig`) and the target
 * resolver (`resolveExtendsTarget`). Everything the loader touches on
 * disk goes through core `FileSystem`/`Path` in `R`; a `PlatformError` from the
 * underlying IO flows through untranslated.
 *
 * **Details**
 *
 * Phase order per file, exactly per tsc: decode -\> absolutize path options
 * against the config's OWN directory (parse phase) -\> recurse into `extends`
 * depth-first -\> fold each config onto the accumulated base, own config
 * last -\> substitute a leading `${configDir}` once, against the TOP config's
 * directory (final phase). The resolution is a recursive walk over untrusted
 * files, so it carries a cycle guard and a depth guard (MAX_EXTENDS_DEPTH), both
 * failing through the typed `TsconfigExtendsError` channel — never as a defect
 * (hardening-a-parser-port invariant).
 *
 * Extends candidates must be files: directories count as missing, so resolution
 * continues to a `.json` sibling, a later export target or an ancestor package.
 * Sync consumers can supply `SyncFileSystem.isFile` for the same behavior;
 * older adapters fall back to their `exists` operation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoTsconfigId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { ResolvedTsconfig } from "@beep/tsconfig/ResolvedTsconfig";
import { TsconfigJsonFromString, TsconfigParseError } from "@beep/tsconfig/TsconfigJson";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { resolveExtendsTarget } from "./internal/extendsTarget.ts";
import type { CompilerOptions } from "@beep/tsconfig/CompilerOptions";
import type { TsconfigJson } from "@beep/tsconfig/TsconfigJson";
import type * as PlatformError from "effect/PlatformError";

const $I = $RepoTsconfigId.create("TsconfigLoader");

const MAX_EXTENDS_DEPTH = 32;

/**
 * Why an `extends` chain failed to resolve: an unresolvable target
 * (`"not-found"`), a re-entrant chain (`"cycle"`), a chain deeper than the
 * loader's depth guard (`"depth"`), or an empty target string (`"empty"`).
 *
 * **Example** (Describe a failure reason)
 *
 * ```ts
 * import { ExtendsFailureReason } from "@beep/repo-tsconfig/TsconfigLoader";
 *
 * const label = ExtendsFailureReason.match("cycle", {
 *   "not-found": () => "missing",
 *   cycle: () => "re-entrant",
 *   depth: () => "too deep",
 *   empty: () => "blank",
 * });
 * console.log(label) // re-entrant
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ExtendsFailureReason = LiteralKit(["not-found", "cycle", "depth", "empty"]).pipe(
  $I.annoteSchema("ExtendsFailureReason", { description: "Why an extends chain failed to resolve." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ExtendsFailureReason = typeof ExtendsFailureReason.Type;

/**
 * **Details**
 *
 * `path` is the config whose `extends` failed, `target` is what it tried to
 * extend (the offending spec for `"not-found"`/`"empty"`, the re-entered config
 * path for `"cycle"`, the refused config for `"depth"`), and `chain` is the full
 * resolution chain of normalized absolute paths.
 *
 * **Example** (Inspect an unresolved extends target)
 *
 * ```ts
 * import { TsconfigExtendsError } from "@beep/repo-tsconfig/TsconfigLoader";
 *
 * const error = TsconfigExtendsError.make({
 *   path: "/project/tsconfig.json",
 *   target: "./missing.json",
 *   reason: "not-found",
 *   chain: ["/project/tsconfig.json"],
 * });
 * console.log(error.message) // cannot resolve extends target "./missing.json" from "/project/tsconfig.json"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TsconfigExtendsError extends S.TaggedError<TsconfigExtendsError, { readonly brand: unique symbol }>(
  $I`TsconfigExtendsError`
)(
  "TsconfigExtendsError",
  {
    /** The config whose `extends` could not be resolved. */
    path: S.String.pipe(
      $I.annoteKey("TsconfigExtendsError.path", { description: "The config whose `extends` could not be resolved." })
    ),
    /** The target that failed: the spec, the re-entered path, or the refused path. */
    target: S.String.pipe(
      $I.annoteKey("TsconfigExtendsError.target", {
        description: "The target that failed: the spec, the re-entered path, or the refused path.",
      })
    ),
    /** Why resolution failed. */
    reason: ExtendsFailureReason.pipe(
      $I.annoteKey("TsconfigExtendsError.reason", { description: "Why resolution failed." })
    ),
    /** The full resolution chain of normalized absolute config paths. */
    chain: S.Array(S.String).pipe(
      $I.annoteKey("TsconfigExtendsError.chain", {
        description: "The full resolution chain of normalized absolute config paths.",
      })
    ),
  },
  $I.annoteError<TsconfigExtendsError>("TsconfigExtendsError", {
    description:
      'Raised when a config\'s `extends` chain cannot be resolved: an unresolvable target (`"not-found"`), a re-entrant chain (`"cycle"`), a chain deeper than `MAX_EXTENDS_DEPTH` (`"depth"`), or an empty target string (`"empty"`). `path` is the config whose `extends` failed, `target` is what it tried to extend (the offending spec for `"not-found"`/`"empty"`, the re-entered config path for `"cycle"`, the refused config for `"depth"`), and `chain` is the full resolution chain of normalized absolute paths.',
  })
) {
  /**
   * Explains the failed extends target, cycle, depth limit, or empty specifier.
   *
   * **Example** (Describe an empty extends target)
   *
   * ```ts
   * import { TsconfigExtendsError } from "@beep/repo-tsconfig/TsconfigLoader";
   *
   * const error = TsconfigExtendsError.make({
   *   path: "/project/tsconfig.json",
   *   target: "",
   *   reason: "empty",
   *   chain: ["/project/tsconfig.json"],
   * });
   * console.log(error.message) // empty extends target in "/project/tsconfig.json"
   * ```
   *
   * @returns The human-readable failure message.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return ExtendsFailureReason.match(this.reason, {
      "not-found": () => `cannot resolve extends target "${this.target}" from "${this.path}"`,
      cycle: () => `extends cycle re-entering "${this.target}" via ${A.join(this.chain, " -> ")}`,
      depth: () => `extends chain exceeded depth ${MAX_EXTENDS_DEPTH} at "${this.path}"`,
      empty: () => `empty extends target in "${this.path}"`,
    });
  }
}

const normalizeSlashes: (p: string) => string = Str.replace(/\\/g, "/");

const decodeConfig = S.decodeEffect(TsconfigJsonFromString);

const extendsSpecs = (doc: TsconfigJson.Type): ReadonlyArray<string> =>
  O.match(O.fromUndefinedOr(doc.extends), {
    onNone: A.empty<string>,
    onSome: (ext) => (P.isString(ext) ? [ext] : ext),
  });

const loadAbs = Effect.fnUntraced(function* (
  abs: string
): Effect.fn.Return<TsconfigJson.Type, TsconfigParseError | PlatformError.PlatformError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(abs);
  return yield* decodeConfig(text).pipe(Effect.mapError((cause) => TsconfigParseError.make({ path: abs, cause })));
});

const load = Effect.fn("TsconfigLoader.load")(function* (configPath: string) {
  const path = yield* Path.Path;
  return yield* loadAbs(normalizeSlashes(path.resolve(configPath)));
});

interface ConfigLayer {
  readonly doc: TsconfigJson.Type;
  readonly path: string;
}

const resolveSpec = Effect.fnUntraced(function* (
  spec: string,
  abs: string,
  chain: ReadonlyArray<string>
): Effect.fn.Return<string, TsconfigExtendsError | PlatformError.PlatformError, FileSystem.FileSystem | Path.Path> {
  if (Str.isEmpty(spec)) {
    return yield* TsconfigExtendsError.make({ path: abs, target: "", reason: "empty", chain });
  }
  const target = yield* resolveExtendsTarget(spec, abs);
  if (O.isNone(target)) {
    return yield* TsconfigExtendsError.make({ path: abs, target: spec, reason: "not-found", chain });
  }
  const normTarget = normalizeSlashes(target.value);
  if (A.contains(chain, normTarget)) {
    return yield* TsconfigExtendsError.make({
      path: abs,
      target: normTarget,
      reason: "cycle",
      chain: A.append(chain, normTarget),
    });
  }
  return normTarget;
});

const collectLayers = Effect.fnUntraced(function* (
  doc: TsconfigJson.Type,
  abs: string,
  chain: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<ConfigLayer>,
  TsconfigParseError | TsconfigExtendsError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const absolutized = ResolvedTsconfig.absolutize(doc, path.dirname(abs), path.resolve);
  const nested = yield* Effect.forEach(
    extendsSpecs(absolutized),
    (spec) => Effect.flatMap(resolveSpec(spec, abs, chain), (target) => collect(target, chain)),
    { concurrency: 1 }
  );
  return A.append(A.flatten(nested), { doc: absolutized, path: abs });
});

const collect = Effect.fnUntraced(function* (
  configPath: string,
  chain: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<ConfigLayer>,
  TsconfigParseError | TsconfigExtendsError | PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const path = yield* Path.Path;
  const abs = normalizeSlashes(path.resolve(configPath));
  const newChain = A.append(chain, abs);

  if (chain.length >= MAX_EXTENDS_DEPTH) {
    return yield* TsconfigExtendsError.make({ path: abs, target: abs, reason: "depth", chain: newChain });
  }

  const doc = yield* loadAbs(abs);
  return yield* collectLayers(doc, abs, newChain);
});

const resolveFrom = Effect.fnUntraced(function* (doc: TsconfigJson.Type, topAbs: string) {
  const path = yield* Path.Path;
  const layers = yield* collectLayers(doc, topAbs, [topAbs]);

  const seed = ResolvedTsconfig.make({ configPath: topAbs, extendedPaths: [], compilerOptions: {} });
  let acc = seed;
  for (const entry of layers) {
    acc = ResolvedTsconfig.merge(acc, entry.doc, entry.path);
  }

  return ResolvedTsconfig.substituteConfigDir(acc, path.dirname(topAbs));
});

const resolve = Effect.fn("TsconfigLoader.resolve")(function* (configPath: string) {
  const path = yield* Path.Path;
  const topAbs = normalizeSlashes(path.resolve(configPath));
  const doc = yield* loadAbs(topAbs);
  return yield* resolveFrom(doc, topAbs);
});

const resolveDocument = Effect.fn("TsconfigLoader.resolveDocument")(function* (
  document: TsconfigJson.Type,
  configPath: string
) {
  const path = yield* Path.Path;
  return yield* resolveFrom(document, normalizeSlashes(path.resolve(configPath)));
});

const compilerOptions = Effect.fn("TsconfigLoader.compilerOptions")(function* (configPath: string) {
  const resolved = yield* resolve(configPath);
  return resolved.compilerOptions satisfies CompilerOptions.Type;
});

/**
 * The tsconfig.json loader: {@link TsconfigLoader.load} reads and decodes one
 * config file, {@link TsconfigLoader.resolve} runs the full load -\> extends -\>
 * merge -\> `${configDir}` pipeline, and {@link TsconfigLoader.compilerOptions}
 * projects the resolved result down to its merged `compilerOptions`.
 *
 * **Example** (Read the target from a resolved tsconfig)
 *
 * ```ts
 * import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
 * import * as Effect from "effect/Effect";
 *
 * // Requires `FileSystem` and `Path` in `R`; provide them from a platform layer.
 * const program = Effect.gen(function* () {
 * 	const resolved = yield* TsconfigLoader.resolve("./tsconfig.json");
 * 	return resolved.compilerOptions.target;
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export abstract class TsconfigLoader {
  /**
   * Read one config file and decode it through {@link TsconfigJsonFromString}.
   *
   * **Details**
   *
   * A decode failure is wrapped in a {@link TsconfigParseError} carrying the
   * file's absolute path; a `PlatformError` from the read flows through
   * untranslated. No `extends` resolution — {@link TsconfigLoader.resolve}
   * drives that.
   *
   * **Example** (Construct a single-config read)
   *
   * ```ts
   * import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
   * import * as Effect from "effect/Effect";
   *
   * const program = TsconfigLoader.load("./tsconfig.json");
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   *
   */
  static readonly load = load;

  /**
   * Resolve a tsconfig.json and its full `extends` chain into a
   * {@link (ResolvedTsconfig:interface)}: load and decode each config,
   * absolutize its path options, resolve `extends` depth-first with
   * per-branch cycle and depth guards, fold the chain
   * own-config-last, then substitute a leading `${configDir}` once
   * against the top config's directory.
   *
   * **Details**
   *
   * `configPath` +
   * `extendedPaths` come back base-most first, own config last. Every
   * failure is a typed error — `TsconfigParseError` (a malformed file,
   * carrying that file's path), `TsconfigExtendsError` (a broken chain), or
   * a `PlatformError` from IO — never a defect.
   *
   * Paths are normalized to forward slashes, as tsc does, before they are
   * compared. Each branch keeps its own visited stack, so a diamond is legal
   * and only a target already on the branch fails with `reason: "cycle"`. The
   * walk refuses to descend past 32 `extends` levels with `reason: "depth"`: a
   * guard on untrusted config files, not a tsc limit.
   *
   * **Example** (Construct an extends-chain resolution)
   *
   * ```ts
   * import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
   * import * as Effect from "effect/Effect";
   *
   * const program = TsconfigLoader.resolve("./tsconfig.json");
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   *
   */
  static readonly resolve = resolve;

  /**
   * Resolve a tsconfig.json whose own document is already in hand (read and
   * decoded through {@link TsconfigLoader.load}, or built in memory) at
   * `configPath`: the same `extends` pipeline as {@link TsconfigLoader.resolve}
   * without reading the named file again. Only the configs it extends are
   * read from disk.
   *
   * **Details**
   *
   * `document` is taken as the config at `configPath` verbatim, so a caller
   * that validated the own document first (`TsconfigValidator.compilerOptions`)
   * pays one read for the file. Same typed failures as `resolve`.
   *
   * **Example** (Resolve a document the caller already decoded)
   *
   * ```ts
   * import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const document = yield* TsconfigLoader.load("./tsconfig.json");
   *   return yield* TsconfigLoader.resolveDocument(document, "./tsconfig.json");
   * });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   */
  static readonly resolveDocument = resolveDocument;

  /**
   * Resolve a tsconfig.json's full `extends` chain and project out the
   * merged `compilerOptions` — a thin projection of
   * {@link TsconfigLoader.resolve} for the common "just give me the
   * effective options" query. Same pipeline, same typed failures.
   *
   * **Example** (Construct an effective-options query)
   *
   * ```ts
   * import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
   * import * as Effect from "effect/Effect";
   *
   * const program = TsconfigLoader.compilerOptions("./tsconfig.json");
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category parsing
   * @since 0.0.0
   *
   */
  static readonly compilerOptions = compilerOptions;
}
