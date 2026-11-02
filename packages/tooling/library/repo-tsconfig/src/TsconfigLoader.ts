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

/**
 * The maximum number of `extends` levels the loader will descend before failing
 * with {@link TsconfigExtendsError} `reason: "depth"`. A guard on the recursive
 * walk over untrusted config files, not a tsc limit.
 */
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
 * The schema-derived `extends` failure reason.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ExtendsFailureReason = typeof ExtendsFailureReason.Type;

/**
 * Raised when a config's `extends` chain cannot be resolved: an unresolvable
 * target (`"not-found"`), a re-entrant chain (`"cycle"`), a chain deeper than
 * `MAX_EXTENDS_DEPTH` (`"depth"`), or an empty target string (`"empty"`).
 *
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

/**
 * tsc normalizes to forward slashes throughout; the merge engine and the cycle keys assume that convention.
 *
 * @param p - The path to normalize.
 * @returns The path with forward slashes.
 */
const normalizeSlashes: (p: string) => string = Str.replace(/\\/g, "/");

/** The shared JSONC decode entrypoint (`TsconfigJsonFromString` is already the shared codec instance). */
const decodeConfig = S.decodeEffect(TsconfigJsonFromString);

/**
 * Normalize a config's `extends` field (absent / string / array) to an ordered spec list.
 *
 * @param doc - The decoded config.
 * @returns The `extends` specifiers in order.
 */
const extendsSpecs = (doc: TsconfigJson.Type): ReadonlyArray<string> =>
  O.match(O.fromUndefinedOr(doc.extends), {
    onNone: A.empty<string>,
    onSome: (ext) => (P.isString(ext) ? [ext] : ext),
  });

/** Read + decode one config at an already-absolute, normalized path; wrap decode failures with that path. */
const loadAbs = Effect.fnUntraced(function* (
  abs: string
): Effect.fn.Return<TsconfigJson.Type, TsconfigParseError | PlatformError.PlatformError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(abs);
  return yield* decodeConfig(text).pipe(Effect.mapError((cause) => TsconfigParseError.make({ path: abs, cause })));
});

// Implementation of TsconfigLoader.load; the public contract lives on the static.
const load = Effect.fn("TsconfigLoader.load")(function* (configPath: string) {
  const path = yield* Path.Path;
  return yield* loadAbs(normalizeSlashes(path.resolve(configPath)));
});

/** One absolutized config document paired with its normalized absolute path, in fold order. */
interface ConfigLayer {
  readonly doc: TsconfigJson.Type;
  readonly path: string;
}

/**
 * Resolve one `extends` specifier of the config at `abs` to the normalized absolute path to descend into,
 * failing typed on an empty spec, an unresolvable target, or a target already on this branch's stack.
 *
 * @param spec - The `extends` specifier.
 * @param abs - The normalized absolute path of the extending config.
 * @param chain - The visited stack on this branch, `abs` included.
 * @returns The normalized absolute target path.
 */
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
  // Cycle guard: the target already sits on this branch's stack.
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

/**
 * Flatten an already-decoded config document at `abs` and its full `extends`
 * chain into base-most-first layers. `chain` is the visited stack on THIS
 * branch, `abs` included (copied per branch, so a diamond is legal).
 *
 * @param doc - The decoded, not yet absolutized document at `abs`.
 * @param abs - The normalized absolute path of `doc`.
 * @param chain - The visited stack on this branch, `abs` included.
 * @returns The config layers in fold order, own config last.
 */
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
  // Parse phase: absolutize this config's path options against its own dir.
  const absolutized = ResolvedTsconfig.absolutize(doc, path.dirname(abs), path.resolve);
  // Depth-first and sequential: fully flatten each entry's nested chain before the sibling.
  const nested = yield* Effect.forEach(extendsSpecs(absolutized), (spec) =>
    Effect.flatMap(resolveSpec(spec, abs, chain), (target) => collect(target, chain))
  );
  // Own config last: it wins over everything it extends.
  return A.append(A.flatten(nested), { doc: absolutized, path: abs });
});

/**
 * Collect the flattened, base-most-first list of absolutized config documents
 * for `configPath` and its full `extends` chain. `chain` is the stack of
 * already-visited normalized absolute paths on THIS branch (copied per branch,
 * so a diamond is legal); it excludes `configPath` itself until it is admitted.
 *
 * @param configPath - The config to collect.
 * @param chain - The visited stack on this branch.
 * @returns The config layers in fold order, own config last.
 */
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

  // Depth guard (hardening): refuse to descend past MAX_EXTENDS_DEPTH levels.
  if (chain.length >= MAX_EXTENDS_DEPTH) {
    return yield* TsconfigExtendsError.make({ path: abs, target: abs, reason: "depth", chain: newChain });
  }

  const doc = yield* loadAbs(abs);
  return yield* collectLayers(doc, abs, newChain);
});

/**
 * Fold the layers of an already-decoded top document at `topAbs` into one
 * `ResolvedTsconfig`: base-most first onto an empty seed, then the single
 * `${configDir}` substitution against the TOP config's directory.
 *
 * @param doc - The decoded top document.
 * @param topAbs - Its normalized absolute path.
 * @returns The resolved record.
 */
const resolveFrom = Effect.fnUntraced(function* (doc: TsconfigJson.Type, topAbs: string) {
  const path = yield* Path.Path;
  const layers = yield* collectLayers(doc, topAbs, [topAbs]);

  // Fold base-most first onto an empty seed; each merge sets the accumulated
  // configPath to the derived config, so the seed's is immediately overwritten.
  const seed = ResolvedTsconfig.make({ configPath: topAbs, extendedPaths: [], compilerOptions: {} });
  let acc = seed;
  for (const entry of layers) {
    acc = ResolvedTsconfig.merge(acc, entry.doc, entry.path);
  }

  // Final phase: ${configDir} resolves against the TOP config's directory.
  return ResolvedTsconfig.substituteConfigDir(acc, path.dirname(topAbs));
});

// Implementation of TsconfigLoader.resolve; the public contract lives on the static.
const resolve = Effect.fn("TsconfigLoader.resolve")(function* (configPath: string) {
  const path = yield* Path.Path;
  const topAbs = normalizeSlashes(path.resolve(configPath));
  const doc = yield* loadAbs(topAbs);
  return yield* resolveFrom(doc, topAbs);
});

// Implementation of TsconfigLoader.resolveDocument; the public contract lives on the static.
const resolveDocument = Effect.fn("TsconfigLoader.resolveDocument")(function* (
  document: TsconfigJson.Type,
  configPath: string
) {
  const path = yield* Path.Path;
  return yield* resolveFrom(document, normalizeSlashes(path.resolve(configPath)));
});

// Implementation of TsconfigLoader.compilerOptions; the public contract lives on the static.
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
