/**
 * The synchronous escape hatch — over CONSUMER-SUPPLIED operations.
 *
 * **Details**
 *
 * Vitest's config-time project discovery cannot await, and it is the reason
 * this module exists — a Vitest plugin building its project list has nowhere to
 * run an Effect. It imports NOTHING platform-shaped: the caller passes the file and path
 * operations (`node:fs` / `node:path` satisfy them one-liner each), so the kit
 * source never touches `node:*` and never assumes posix. Windows correctness is
 * the consumer passing a win32-appropriate `path` (`node:path` on Windows, or
 * `node:path/win32` explicitly) — the `@beep/repo-tsconfig` `TsconfigLoaderSync` convention.
 *
 * It does not keep a second pattern semantic: it compiles through the same
 * `GlobSet` and walks the same worklist as the Effect enumerator, so
 * `packages/**` means the same thing in both worlds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { GlobSet } from "@beep/glob";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { Yaml } from "@beep/yaml";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MAX_ENUMERATION_DEPTH } from "./internal/limits.ts";
import { manifestVersionOf } from "./internal/manifestFields.ts";
import {
  badMaxDepthMessage,
  excludedBy,
  isPruned,
  isValidMaxDepth,
  joinRelative,
  Traversal,
} from "./internal/traverse.ts";
import { WorkspaceDiscoveryError } from "./WorkspaceDiscovery.ts";
import { PublishConfig, WorkspacePackage } from "./WorkspacePackage.ts";
import { WorkspacePatterns } from "./WorkspacePatterns.ts";
import type { GlobPattern } from "@beep/glob";
import type { TraversalFrame } from "./internal/traverse.ts";

const isDependencyMap = S.is(WorkspacePackage.fields.dependencies);

/**
 * A manifest dependency block, or the empty block when it is not a name-to-range record.
 *
 * @param value - A manifest field that should map names to ranges.
 * @returns The block, or `{}` when it has another shape.
 */
const dependencyMapOf = (value: unknown): Readonly<Record<string, string>> => (isDependencyMap(value) ? value : {});

const $I = $RepoWorkspacesId.create("WorkspacesSync");

const JsonValue = S.fromJsonString(S.Unknown).pipe(
  $I.annoteSchema("JsonValue", { description: "A JSON value parsed before the tolerant manifest shape checks." })
);
const decodeJson = S.decodeResult(JsonValue);

/**
 * A malformed synchronous workspace manifest, preserving its diagnostic message.
 */
class WorkspaceSyncManifestError extends S.TaggedError<WorkspaceSyncManifestError, { readonly brand: unique symbol }>(
  $I`WorkspaceSyncManifestError`
)(
  "WorkspaceSyncManifestError",
  { message: S.String },
  $I.annoteError<WorkspaceSyncManifestError>("WorkspaceSyncManifestError", {
    description: "A malformed synchronous workspace manifest.",
  })
) {}

/**
 * Raised when synchronous workspace enumeration receives an invalid depth bound.
 *
 * **Example** (Inspect an invalid depth diagnostic)
 *
 * ```ts
 * import { WorkspaceEnumerationDepthError } from "@beep/repo-workspaces/WorkspacesSync";
 *
 * const error = WorkspaceEnumerationDepthError.make({
 *   message: "getWorkspacePackagesSync: maxDepth must be a positive integer, got 0",
 * });
 * console.log(error._tag) // WorkspaceEnumerationDepthError
 * console.log(error.message) // getWorkspacePackagesSync: maxDepth must be a positive integer, got 0
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceEnumerationDepthError extends S.TaggedError<
  WorkspaceEnumerationDepthError,
  { readonly brand: unique symbol }
>($I`WorkspaceEnumerationDepthError`)(
  "WorkspaceEnumerationDepthError",
  { message: S.String },
  $I.annoteError<WorkspaceEnumerationDepthError>("WorkspaceEnumerationDepthError", {
    description: "An invalid synchronous workspace enumeration depth bound.",
  })
) {}

/**
 * The synchronous file operations the sync entry points need, supplied by the
 * consumer. Node's built-ins satisfy it directly.
 *
 * **Gotchas**
 *
 * `exists` must return a boolean and not throw (Node's `existsSync` never
 * does). The other three may throw — `statSync` on a missing path, a
 * permission error mid-read — and every throw is absorbed into the documented
 * degraded-skip semantics: a throwing `readFile` reads as an unusable
 * manifest, a throwing `readDirectory` as an unreadable directory, a throwing
 * `isDirectory` as "not a directory". Nothing propagates.
 *
 * **Example** (Supply Node synchronous file operations)
 *
 * ```ts
 * import type { SyncFileSystem } from "@beep/repo-workspaces/WorkspacesSync";
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 *
 * const fileSystem: SyncFileSystem = {
 * 	exists: existsSync,
 * 	readFile: (p) => readFileSync(p, "utf8"),
 * 	readDirectory: (p) => readdirSync(p),
 * 	isDirectory: (p) => statSync(p).isDirectory(),
 * };
 * console.log(fileSystem.exists(import.meta.filename)) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SyncFileSystem {
  /**
   * Whether a file or directory exists at `path`. Must not throw.
   */
  readonly exists: (path: string) => boolean;
  /**
   * Whether `path` is a directory. May throw; a throw reads as `false`.
   */
  readonly isDirectory: (path: string) => boolean;
  /**
   * The entry names inside the directory at `path`. May throw; a throw skips the directory.
   */
  readonly readDirectory: (path: string) => ReadonlyArray<string>;
  /**
   * Optional fast path: the entries inside `path` with their types already
   * known, in ONE call.
   *
   * **Details**
   *
   * Package enumeration otherwise costs a `readDirectory` plus one
   * `isDirectory` per entry — the readdir-then-stat-per-entry shape, which on
   * a large workspace is a syscall per file. Supplying this collapses that to
   * a single `readdirSync(path, { withFileTypes: true })`; `nodeFileSystem`
   * does. Omit it and enumeration falls back to the four required operations
   * with identical results, so this is purely a cost optimization and never a
   * behavior switch.
   *
   * May throw; a throw skips the directory, exactly like `readDirectory`.
   */
  readonly readDirectoryWithTypes?: ((path: string) => ReadonlyArray<SyncDirectoryEntry.Encoded>) | undefined;
  /**
   * Read the file at `path` as text. May throw; a throw degrades to a skip.
   */
  readonly readFile: (path: string) => string;
}

/**
 * One directory entry with its type resolved, as the optional
 * {@link SyncFileSystem.readDirectoryWithTypes} fast path reports it. Node's
 * `Dirent` satisfies it after mapping its predicate methods to booleans.
 *
 * **Gotchas**
 *
 * `isSymbolicLink` is not decoration. A `Dirent` describes the entry ITSELF, so
 * a symbolic link pointing at a directory reports `isDirectory: false` — while
 * the `stat`-based slow path, which resolves the link, calls the same entry a
 * directory. Enumeration therefore re-resolves links through `isDirectory`
 * rather than trusting `isDirectory` on a link, which is what keeps the fast
 * and slow paths in agreement on a workspace whose packages are symlinked.
 *
 * Which behavior is *correct* is domain-dependent, so the flag is reported
 * rather than resolved away. Enumeration follows links because a symlinked
 * package is still a package. A test-file discovery walk usually must NOT: in a
 * pnpm workspace `node_modules` is a farm of links into the content-addressed
 * store, and following them walks the whole store or hits a cycle. A consumer
 * building its own walker on this shape wants `isDirectory` verbatim — there,
 * not following is the requirement, not the hazard.
 *
 * **Example** (Recognize a typed filesystem entry)
 *
 * ```ts
 * import { SyncDirectoryEntry } from "@beep/repo-workspaces/WorkspacesSync";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(SyncDirectoryEntry)({ name: "core", isDirectory: true, isSymbolicLink: false })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SyncDirectoryEntry extends S.Opaque<SyncDirectoryEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The entry's own name, not a path. */
    name: S.String.pipe($I.annoteKey("SyncDirectoryEntry.name", { description: "The entry's own name, not a path." })),
    /** Whether the entry itself is a directory, without following links. */
    isDirectory: S.Boolean.pipe(
      $I.annoteKey("SyncDirectoryEntry.isDirectory", {
        description: "Whether the entry itself is a directory, false for symbolic links.",
      })
    ),
    /** Whether the entry itself is a symbolic link. */
    isSymbolicLink: S.Boolean.pipe(
      $I.annoteKey("SyncDirectoryEntry.isSymbolicLink", { description: "Whether the entry itself is a symbolic link." })
    ),
  }).pipe(
    $I.annoteSchema("SyncDirectoryEntry", {
      description: "A plain typed directory entry supplied by synchronous filesystem operations.",
    })
  )
) {}
/**
 * Companion types for {@link SyncDirectoryEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyncDirectoryEntry {
  /**
   * The plain, unbranded encoded shape of a {@link SyncDirectoryEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SyncDirectoryEntry.Encoded;
}

/**
 * The synchronous path operations the sync entry points need, supplied by the
 * consumer. Deliberately a structural subset of `node:path`, so the built-in
 * module (and its `win32` / `posix` variants, or a Bun / Deno equivalent)
 * satisfies it verbatim.
 *
 * **Details**
 *
 * These operations shape only the ABSOLUTE paths handed back to the consumer
 * (and to its own `fileSystem`); workspace-relative pattern matching is POSIX
 * by the `packages:` contract and never routes through here. Windows
 * correctness comes from supplying a win32-appropriate implementation, not
 * from anything in this module.
 *
 * **Example** (Supply Node file and path operations)
 *
 * ```ts
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import type { WorkspacesSyncOptions } from "@beep/repo-workspaces/WorkspacesSync";
 *
 * const options: WorkspacesSyncOptions = {
 * 	fileSystem: { exists: existsSync, readFile: (p) => readFileSync(p, "utf8"), readDirectory: (p) => readdirSync(p), isDirectory: (p) => statSync(p).isDirectory() },
 * 	path, // node:path IS a SyncPath
 * };
 * console.log(options.path.join("workspace", "package.json") === path.join("workspace", "package.json")) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SyncPath {
  /**
   * The directory portion of `p` (like `path.dirname`).
   */
  readonly dirname: (p: string) => string;
  /**
   * Join segments with the implementation's separator (like `path.join`).
   */
  readonly join: (...segments: ReadonlyArray<string>) => string;
  /**
   * Resolve segments to an absolute path (rightmost-wins, like `path.resolve`).
   */
  readonly resolve: (...segments: ReadonlyArray<string>) => string;
}

/**
 * The consumer-supplied operations backing one sync call: the file operations
 * and the path implementation. Both are required — this package never imports
 * `node:*` and never assumes posix, so the platform binding is entirely the
 * caller's.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface WorkspacesSyncOptions {
  /**
   * The synchronous file operations (Node: `existsSync` / `readFileSync` / `readdirSync` / `statSync`).
   */
  readonly fileSystem: SyncFileSystem;
  /**
   * The synchronous path implementation (Node: the `node:path` module itself).
   */
  readonly path: SyncPath;
}

/**
 * Why {@link getWorkspacePackagesSync} left a manifest out of its result — the
 * `WorkspaceDiscoveryError.kind` values a single manifest read can produce.
 *
 * **Details**
 *
 * The same vocabulary the Effect surface fails with, deliberately: a member the
 * async `listPackages()` rejects as `missingName` is the member the sync facade
 * reports as `missingName`. `invalidYaml` is excluded because it describes the
 * `pnpm-workspace.yaml` read, not a manifest. A version-less manifest is a
 * member on both surfaces.
 *
 * The vocabulary is shared; the CHECKS are shared only as far as this list.
 * Both surfaces perform the same five: the file read (`read`), JSON decoding
 * (`invalidJson`), the parsed value being a non-null non-array object
 * (`invalidShape`), a non-empty string `name` (`missingName`), and a `version`
 * that is either absent or a non-empty string (`invalidShape`). Beyond them
 * they diverge, and one divergence is deliberate: a malformed `publishConfig`
 * FAILS the async surface, because it reaches the decode, while the sync facade
 * drops the field and keeps the member. A consumer that must reject such a
 * manifest has to use the Effect surface.
 *
 * **Example** (Recognize a manifest-only skip kind)
 *
 * ```ts
 * import { WorkspaceDiscoverySkipKind } from "@beep/repo-workspaces/WorkspacesSync";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(WorkspaceDiscoverySkipKind)("missingName")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WorkspaceDiscoverySkipKind = WorkspaceDiscoveryError.fields.kind
  .pick(["read", "invalidJson", "invalidShape", "missingName"])
  .pipe(
    $I.annoteSchema("WorkspaceDiscoverySkipKind", {
      description: "The existing manifest discovery failure kinds, excluding workspace YAML reads.",
    })
  );
/**
 * The manifest-only failure kinds described by {@link WorkspaceDiscoverySkipKind}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkspaceDiscoverySkipKind = typeof WorkspaceDiscoverySkipKind.Type;

/**
 * Builds one existing plain failure case without a constructor default.
 *
 * @param kind - The skip kind the case carries.
 * @returns The skip schema for that kind.
 */
const workspaceDiscoverySkipCase = <const Kind extends WorkspaceDiscoverySkipKind>(kind: S.Literal<Kind>) => {
  const identifier: string = `WorkspaceDiscoverySkip.${kind.literal}`;
  return S.Struct({
    kind: kind.pipe(
      $I.annoteKey("WorkspaceDiscoverySkip.kind", { description: "The existing caller-visible failure reason." })
    ),
    root: S.String.pipe(
      $I.annoteKey("WorkspaceDiscoverySkip.root", { description: "The workspace root being enumerated." })
    ),
    path: S.String.pipe(
      $I.annoteKey("WorkspaceDiscoverySkip.path", { description: "The absolute path of the skipped package manifest." })
    ),
    cause: S.Unknown.pipe(
      $I.annoteKey("WorkspaceDiscoverySkip.cause", {
        description: "The original arbitrary failure value, undefined for a missing name.",
      })
    ),
  }).pipe($I.annoteSchema(identifier, { description: `The existing ${kind.literal} failure record.` }));
};

/**
 * One manifest {@link getWorkspacePackagesSync} skipped, reported through
 * {@link GetWorkspacePackagesSyncOptions.onSkip}.
 *
 * **Details**
 *
 * The sync facade is total, so it cannot fail the way `WorkspaceDiscovery`
 * does — but a skipped member must still be observable. Without a report, a
 * hand-written fixture with one unusable manifest would enumerate as a
 * plausible empty array indistinguishable from "no workspaces configured". The
 * fields mirror
 * `WorkspaceDiscoveryError`: `root`, `path`, `kind`, and on `cause` either the
 * caught throwable (`read`), a `SchemaError` (`invalidJson`), or an `Error` carrying the same
 * sentence the Effect surface fails with (`invalidShape`). Only `missingName`
 * has `cause: undefined` — the field is simply absent, and nothing threw.
 *
 * **Example** (Recognize a synchronous manifest skip)
 *
 * ```ts
 * import { WorkspaceDiscoverySkip } from "@beep/repo-workspaces/WorkspacesSync";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(WorkspaceDiscoverySkip)({ root: "/repo", path: "/repo/package.json", kind: "missingName", cause: undefined })); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const WorkspaceDiscoverySkip = WorkspaceDiscoverySkipKind.mapMembers(
  ([read, invalidJson, invalidShape, missingName]) => [
    workspaceDiscoverySkipCase(read),
    workspaceDiscoverySkipCase(invalidJson),
    workspaceDiscoverySkipCase(invalidShape),
    workspaceDiscoverySkipCase(missingName),
  ]
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("WorkspaceDiscoverySkip", {
    description: "A plain synchronous manifest skip report with its original cause.",
  })
);
/**
 * The readonly skip report described by {@link WorkspaceDiscoverySkip}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorkspaceDiscoverySkip = typeof WorkspaceDiscoverySkip.Type;

/**
 * A manifest read that either yields the parsed record or names why it cannot.
 */
const ManifestRead = S.Union([
  S.Struct({
    raw: S.Record(S.String, S.mutableKey(S.Unknown)).pipe(
      $I.annoteKey("ManifestRead.raw", {
        description: "The parsed mutable manifest record, without additional validation.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ManifestReadSuccess", {
      description: "A successful manifest read retaining the plain mutable record.",
    })
  ),
  S.Struct({
    kind: WorkspaceDiscoverySkipKind.pick(["read", "invalidJson", "invalidShape"]).pipe(
      $I.annoteKey("ManifestRead.kind", {
        description: "The existing read, JSON syntax, or manifest shape failure kind.",
      })
    ),
    cause: S.Unknown.pipe(
      $I.annoteKey("ManifestRead.cause", { description: "The arbitrary caught or shape failure value." })
    ),
  }).pipe(
    $I.annoteSchema("ManifestReadFailure", { description: "A failed manifest read with its original arbitrary cause." })
  ),
]).pipe(
  $I.annoteSchema("ManifestRead", {
    description: "The existing untagged success or failure of a synchronous manifest read.",
  })
);
/** The existing plain-record manifest read result. */
type ManifestRead = typeof ManifestRead.Type;

/**
 * Read one `package.json` into a plain record, or say why not. Never throws.
 *
 * **Details**
 *
 * The three failures are kept apart — a throwing consumer `readFile`, a JSON
 * syntax error, and valid JSON that is not an object — because the skip report
 * carries the distinction; the two other callers of {@link readJson} do not
 * need it and keep the collapsed form.
 */
const readManifest: {
  (fileSystem: SyncFileSystem, file: string): ManifestRead;
  (file: string): (fileSystem: SyncFileSystem) => ManifestRead;
} = dual(2, (fileSystem: SyncFileSystem, file: string): ManifestRead => {
  const text = Result.try(() => fileSystem.readFile(file));
  if (Result.isFailure(text)) return { kind: "read", cause: text.failure };
  const decoded = decodeJson(text.success);
  if (Result.isFailure(decoded)) return { kind: "invalidJson", cause: decoded.failure };
  const parsed = decoded.success;
  // JSON decoding returns `null` / a number / a string for VALID input; only a
  // non-null, non-array object is a manifest.
  return P.isObject(parsed)
    ? { raw: parsed }
    : {
        kind: "invalidShape",
        cause: WorkspaceSyncManifestError.make({ message: "package.json is not a JSON object" }),
      };
});

/**
 * Read and JSON-parse a file into a plain object, or `undefined`. Never throws.
 *
 * **Details**
 *
 * The non-object check is load-bearing, not defensive noise. `JSON.parse`
 * returns `undefined` for *nothing* — a `package.json` whose entire content is
 * `null`, `42` or `"x"` parses successfully to that value, so a caller guarding
 * only on `undefined` sails straight into `raw.name` and throws a `TypeError`.
 * These functions are documented as total and are reached from a Vitest config,
 * which has nowhere to put a crash: malformed input must be *skipped*, never a
 * defect. A throwing consumer `readFile` and a JSON codec failure both collapse
 * to an unusable manifest.
 */
const readJson: {
  (fileSystem: SyncFileSystem, file: string): Record<string, unknown> | undefined;
  (file: string): (fileSystem: SyncFileSystem) => Record<string, unknown> | undefined;
} = dual(2, (fileSystem: SyncFileSystem, file: string): Record<string, unknown> | undefined => {
  const manifest = readManifest(fileSystem, file);
  return P.hasProperty(manifest, "raw") ? manifest.raw : undefined;
});

/**
 * Whether `dir` is a directory. Never throws — a throwing consumer op reads as `false`.
 */
const isDirectory: {
  (fileSystem: SyncFileSystem, dir: string): boolean;
  (dir: string): (fileSystem: SyncFileSystem) => boolean;
} = dual(2, (fileSystem: SyncFileSystem, dir: string): boolean =>
  Result.getOrElse(
    Result.try(() => fileSystem.isDirectory(dir)),
    () => false
  )
);

/**
 * One enumerated child, with directory-ness resolved under `stat` semantics.
 */
const ResolvedEntry = S.Struct({
  name: S.String.pipe($I.annoteKey("ResolvedEntry.name", { description: "The enumerated child entry's own name." })),
  directory: S.Boolean.pipe(
    $I.annoteKey("ResolvedEntry.directory", {
      description: "Whether the child is a directory after resolving symbolic links.",
    })
  ),
}).pipe(
  $I.annoteSchema("ResolvedEntry", {
    description: "A plain child entry with directory-ness resolved under stat semantics.",
  })
);
/** The readonly resolved child entry. */
type ResolvedEntry = typeof ResolvedEntry.Type;

/**
 * The entries of `absoluteDir`, each carrying whether it is a directory, or
 * `undefined` when the directory could not be read at all (the degraded-skip
 * case). Uses {@link SyncFileSystem.readDirectoryWithTypes} when the consumer
 * supplied it and the four-operation fallback otherwise — the two agree by
 * construction, including on symbolic links, which are always re-resolved
 * through `isDirectory` because a `Dirent` describes the link and not its
 * target.
 */
const readResolvedEntries: {
  (options: WorkspacesSyncOptions, absoluteDir: string): ReadonlyArray<ResolvedEntry> | undefined;
  (absoluteDir: string): (options: WorkspacesSyncOptions) => ReadonlyArray<ResolvedEntry> | undefined;
} = dual(2, (options: WorkspacesSyncOptions, absoluteDir: string): ReadonlyArray<ResolvedEntry> | undefined => {
  const { fileSystem, path } = options;
  const withTypes = fileSystem.readDirectoryWithTypes;
  if (withTypes !== undefined) {
    return Result.getOrElse(
      Result.try(() =>
        A.map(withTypes(absoluteDir), (entry) => ({
          name: entry.name,
          directory: entry.isSymbolicLink
            ? isDirectory(fileSystem, path.join(absoluteDir, entry.name))
            : entry.isDirectory,
        }))
      ),
      () => undefined
    );
  }
  const names = Result.try(() => fileSystem.readDirectory(absoluteDir));
  if (Result.isFailure(names)) return undefined;
  return A.map(names.success, (name) => ({
    name,
    directory: isDirectory(fileSystem, path.join(absoluteDir, name)),
  }));
});

/**
 * Whether `dir` holds a `package.json`.
 */
const isPackage: {
  (options: WorkspacesSyncOptions, dir: string): boolean;
  (dir: string): (options: WorkspacesSyncOptions) => boolean;
} = dual(2, (options: WorkspacesSyncOptions, dir: string): boolean =>
  options.fileSystem.exists(options.path.join(dir, "package.json"))
);

/**
 * The ascent ceiling {@link findWorkspaceRootSync} accepts beside the
 * consumer-supplied operations.
 *
 * **Details**
 *
 * `stopAt` is a ceiling directory, with the semantics of
 * `FindWorkspaceRootOptions.stopAt` on the Effect surface. The ascent stops
 * after probing it, so an unmarked `stopAt` returns `null` rather than
 * silently adopting an enclosing repository's workspace. Inclusive: a ceiling
 * that is itself a workspace root is returned. The ceiling is resolved through
 * the supplied {@link SyncPath.resolve} at lookup time, so a relative one is
 * taken against the process working directory when the call runs (with
 * `node:path`). A ceiling that names no ancestor of `cwd` never matches, and
 * the ascent runs to the filesystem root. Omit it for the unbounded ascent.
 *
 * Pass `stopAt: cwd` for a checkout nested inside someone else's workspace (a
 * self-hosted runner, `actions/checkout` with `path:`): a checkout that is
 * itself a root still resolves, and one that is not returns `null`.
 *
 * **Example** (Bound the ascent at the checkout)
 *
 * ```ts
 * import { SyncRootCeiling } from "@beep/repo-workspaces/WorkspacesSync";
 *
 * console.log(SyncRootCeiling.make({ stopAt: "/repo" }).stopAt); // /repo
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SyncRootCeiling extends S.Opaque<SyncRootCeiling, { readonly brand: unique symbol }>()(
  S.Struct({
    stopAt: S.optionalKey(S.String).pipe(
      $I.annoteKey("SyncRootCeiling.stopAt", {
        description: "An inclusive ceiling for the synchronous root ascent; absent means no ceiling.",
      })
    ),
  }).pipe($I.annoteSchema("SyncRootCeiling", { description: "The synchronous workspace-root ascent ceiling." }))
) {}

/**
 * Companion types for {@link SyncRootCeiling}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyncRootCeiling {
  /**
   * The plain, unbranded encoded shape of a {@link SyncRootCeiling}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SyncRootCeiling.Encoded;
}

/**
 * Options for {@link findWorkspaceRootSync}: the consumer-supplied operations
 * plus the ascent's {@link SyncRootCeiling}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type FindWorkspaceRootSyncOptions = WorkspacesSyncOptions & SyncRootCeiling.Encoded;

/**
 * The nearest workspace root at or above `cwd`, or `null`.
 *
 * **Details**
 *
 * **Synchronous.** The Effect surface is `WorkspaceRoot`; reach for this one
 * only where you genuinely cannot run an Effect — a Vitest config being the
 * motivating case. The file and path operations are the caller's
 * ({@link WorkspacesSyncOptions}); this module imports no `node:*` and
 * assumes no posix.
 *
 * The signature is path-first, options second — the same shape as
 * {@link getWorkspacePackagesSync} and the rest of the kit's sync facades
 * (`TsconfigLoaderSync.load(configPath, options)`). `cwd` is required and
 * positional, so the function reads no ambient `process.cwd()`.
 *
 * Markers match the async service exactly: a `pnpm-workspace.yaml`, or a
 * `package.json` carrying a `workspaces` field.
 *
 * The ascent is unbounded unless `options.stopAt` names a ceiling
 * ({@link FindWorkspaceRootSyncOptions.stopAt}), with the Effect surface's
 * semantics: inclusive, resolved at lookup time. Where `WorkspaceRoot.find`
 * fails `WorkspaceRootNotFoundError` carrying the resolved ceiling, this
 * returns `null` — the facade is total and has no error channel, and the
 * caller already holds the ceiling it passed.
 *
 * **Example** (Find the workspace root with Node filesystem operations)
 *
 * ```ts
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import { findWorkspaceRootSync } from "@beep/repo-workspaces/WorkspacesSync";
 *
 * const root = findWorkspaceRootSync(process.cwd(), {
 * 	fileSystem: {
 * 		exists: existsSync,
 * 		readFile: (p) => readFileSync(p, "utf8"),
 * 		readDirectory: (p) => readdirSync(p),
 * 		isDirectory: (p) => statSync(p).isDirectory(),
 * 	},
 * 	path,
 * });
 * console.log(root === null || path.isAbsolute(root)) // true
 * ```
 *
 * @param cwd - Where to start the ascent (typically `process.cwd()`),
 *   matching the Effect layers' `{ cwd }` option.
 * @param options - The consumer-supplied file and path operations, plus an
 *   optional `stopAt` ceiling.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const findWorkspaceRootSync: {
  (options: FindWorkspaceRootSyncOptions): (cwd: string) => string | null;
  (cwd: string, options: FindWorkspaceRootSyncOptions): string | null;
} = dual(2, (cwd: string, options: FindWorkspaceRootSyncOptions): string | null => {
  const { fileSystem, path } = options;
  let current = path.resolve(cwd);
  // Resolved at lookup time, exactly as `WorkspaceRoot.find` resolves it: the
  // comparison below is string equality, so an unresolved ceiling would never
  // match and would silently degrade to the unbounded ascent it exists to stop.
  const ceiling = options.stopAt === undefined ? undefined : path.resolve(options.stopAt);
  // Bounded twice over: `dirname` is a fixpoint at the filesystem root, and the
  // depth cap guards a pathological path implementation that never reaches one.
  for (let depth = 0; depth < MAX_ENUMERATION_DEPTH * 8; depth++) {
    if (declaresWorkspace(fileSystem, path, current)) return current;
    const parent = ascentFrom(path, current, ceiling);
    if (parent === undefined) return null;
    current = parent;
  }
  return null;
});

/**
 * Whether `directory` declares a workspace: a `pnpm-workspace.yaml`, or a
 * `package.json` with a `workspaces` field.
 *
 * @param fileSystem - The consumer's file operations.
 * @param path - The consumer's path operations.
 * @param directory - The directory to probe.
 * @returns `true` when the directory declares a workspace.
 */
const declaresWorkspace = (fileSystem: SyncFileSystem, path: SyncPath, directory: string): boolean => {
  if (fileSystem.exists(path.join(directory, "pnpm-workspace.yaml"))) return true;
  const manifest = readJson(fileSystem, path.join(directory, "package.json"));
  return manifest?.workspaces !== undefined && manifest.workspaces !== null;
};

/**
 * The next directory the ascent probes, or `undefined` where it stops.
 *
 * **Details**
 *
 * Inclusive: the ceiling itself was just probed. A ceiling naming no ancestor
 * never matches and the ascent runs to the filesystem root — walker's rule,
 * which the Effect surface inherits.
 *
 * @param path - The consumer's path operations.
 * @param current - The directory just probed.
 * @param ceiling - The resolved `stopAt` ceiling, when one was given.
 * @returns The parent directory, or `undefined` at the ceiling or the filesystem root.
 */
const ascentFrom = (path: SyncPath, current: string, ceiling: string | undefined): string | undefined => {
  if (current === ceiling) return undefined;
  const parent = path.dirname(current);
  return parent === current ? undefined : parent;
};

/**
 * The workspace `packages:` patterns for `root`, matching `WorkspacePatterns.read`'s precedence.
 */
const readPatternsSync: {
  (options: WorkspacesSyncOptions, root: string): ReadonlyArray<string>;
  (root: string): (options: WorkspacesSyncOptions) => ReadonlyArray<string>;
} = dual(2, (options: WorkspacesSyncOptions, root: string): ReadonlyArray<string> => {
  const { fileSystem, path } = options;
  const workspaceYaml = path.join(root, "pnpm-workspace.yaml");
  if (fileSystem.exists(workspaceYaml)) {
    const text = Result.getOrElse(
      Result.try(() => fileSystem.readFile(workspaceYaml)),
      () => ""
    );
    // `Yaml.parse` is an Effect and this function is not; the parse is pure and
    // synchronous underneath, so running it to an Exit here is the one honest
    // bridge. A parse failure is an empty pattern list, not a throw.
    const exit = Effect.runSyncExit(Yaml.parse(text));
    if (Exit.isSuccess(exit)) {
      const patterns = WorkspacePatterns.fromPnpmWorkspace(exit.value);
      if (patterns.length > 0) return patterns;
    }
  }
  return WorkspacePatterns.fromManifest(readJson(fileSystem, path.join(root, "package.json")) ?? {});
});

/**
 * Build a `WorkspacePackage` from a directory, or a {@link WorkspaceDiscoverySkip}
 * saying why its manifest is unusable — never `null`, so a skip cannot go
 * unreported.
 */
const readPackageSync: {
  (
    options: WorkspacesSyncOptions,
    root: string,
    directory: string,
    relativePath: string
  ): WorkspacePackage | WorkspaceDiscoverySkip;
  (
    root: string,
    directory: string,
    relativePath: string
  ): (options: WorkspacesSyncOptions) => WorkspacePackage | WorkspaceDiscoverySkip;
} = dual(
  4,
  (
    options: WorkspacesSyncOptions,
    root: string,
    directory: string,
    relativePath: string
  ): WorkspacePackage | WorkspaceDiscoverySkip => {
    const packageJsonPath = options.path.join(directory, "package.json");
    const read = readManifest(options.fileSystem, packageJsonPath);
    if (!("raw" in read)) return { root, path: packageJsonPath, kind: read.kind, cause: read.cause };
    const raw = read.raw;

    const name = raw.name;
    if (!P.isString(name) || name.length === 0) {
      return { root, path: packageJsonPath, kind: "missingName", cause: undefined };
    }
    const version = manifestVersionOf(raw.version);
    if (Result.isFailure(version)) {
      return {
        root,
        path: packageJsonPath,
        kind: "invalidShape",
        cause: WorkspaceSyncManifestError.make({ message: version.failure }),
      };
    }
    const publishConfig = raw.publishConfig;
    const config = Effect.runSyncExit(S.decodeUnknownEffect(PublishConfig)(publishConfig));

    return WorkspacePackage.make({
      name,
      ...O.getSomesStruct({ version: O.fromUndefinedOr(version.success) }),
      path: directory,
      packageJsonPath,
      relativePath,
      // Carried exactly as the Effect enumerator carries it — the two entry
      // points must not disagree about what a discovered package knows.
      workspaceRoot: root,
      private: raw.private === true,
      dependencies: dependencyMapOf(raw.dependencies),
      devDependencies: dependencyMapOf(raw.devDependencies),
      peerDependencies: dependencyMapOf(raw.peerDependencies),
      optionalDependencies: dependencyMapOf(raw.optionalDependencies),
      // The as-read record rides along, exactly as the Effect enumerator's
      // projection does — one read, tolerant access to the rest of the manifest.
      manifestRecord: raw,
      ...(Exit.isSuccess(config) ? { publishConfig: config.value } : {}),
    });
  }
);

/**
 * The traversal bound {@link getWorkspacePackagesSync} accepts beside the
 * consumer-supplied operations.
 *
 * **Details**
 *
 * `maxDepth` caps the descent below a wildcard's enumeration prefix, mirroring
 * `WorkspaceDiscovery.layer({ maxDepth })`, and defaults to 32. A bad bound
 * throws {@link WorkspaceEnumerationDepthError}.
 *
 * **Example** (Cap the enumeration depth)
 *
 * ```ts
 * import { SyncEnumerationBound } from "@beep/repo-workspaces/WorkspacesSync";
 *
 * console.log(SyncEnumerationBound.make({ maxDepth: 4 }).maxDepth); // 4
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SyncEnumerationBound extends S.Opaque<SyncEnumerationBound, { readonly brand: unique symbol }>()(
  S.Struct({
    maxDepth: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("SyncEnumerationBound.maxDepth", {
        description: "The descent cap below a wildcard's enumeration prefix; defaults to 32.",
      })
    ),
  }).pipe($I.annoteSchema("SyncEnumerationBound", { description: "The synchronous workspace enumeration bound." }))
) {}

/**
 * Companion types for {@link SyncEnumerationBound}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyncEnumerationBound {
  /**
   * The plain, unbranded encoded shape of a {@link SyncEnumerationBound}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SyncEnumerationBound.Encoded;
}

/**
 * The skip observer {@link getWorkspacePackagesSync} accepts.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SyncEnumerationObserver {
  /**
   * Called once for every manifest the enumeration found and could not use,
   * with the file and the reason — so a skipped member is observable even
   * though this function is total and has no error channel to raise it on.
   *
   * **Gotchas**
   *
   * Omit it and skips are simply not reported; nothing is logged in its
   * place. The callback is invoked synchronously, before the result is
   * returned, in enumeration order — members first, then the root, which is
   * read last even though it is returned first. Its result is discarded, and a
   * throw from it propagates: the facade is total over *data*, not over caller
   * mistakes, exactly as a bad `maxDepth` is.
   */
  readonly onSkip?: ((skip: WorkspaceDiscoverySkip) => void) | undefined;
}

/**
 * Options for {@link getWorkspacePackagesSync}: the required consumer-supplied
 * operations, the {@link SyncEnumerationBound} and the
 * {@link SyncEnumerationObserver}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type GetWorkspacePackagesSyncOptions = WorkspacesSyncOptions &
  SyncEnumerationBound.Encoded &
  SyncEnumerationObserver;

/**
 * Every workspace package under `root`, root package first.
 *
 * **Details**
 *
 * **Synchronous.** The Effect surface is `WorkspaceDiscovery`. The file and
 * path operations are the caller's ({@link GetWorkspacePackagesSyncOptions}
 * extends {@link WorkspacesSyncOptions}); this module imports no `node:*` and
 * assumes no posix.
 *
 * Pattern semantics are not merely "shared" with the Effect enumerator — both
 * drive the **same traversal state machine** (`internal/traverse.ts`), so the
 * dequeue order, the depth rule, the visit budget and the prune list cannot
 * drift apart. A `packages/**` finds exactly the same packages here as there,
 * including at the depth boundary.
 *
 * The one deliberate difference is what happens at a bound: the Effect surface
 * fails typed (`depthExceeded` / `budgetExceeded`), while this one is **total**
 * and truncates. An unenumerable pattern or an unreadable manifest is skipped,
 * not raised — a function with no error channel should not pretend to have one,
 * and a Vitest config has nowhere to put a failure. Totality covers *data*, not
 * caller mistakes: a `maxDepth` that is not a positive integer throws, matching
 * the enumerator's defect.
 *
 * **A skip is never silent.** Every manifest left out is reported through
 * `onSkip` with its path and the same `kind` the Effect surface would have
 * failed with (a `WorkspaceDiscoverySkip`), so "no packages" and "packages
 * rejected" stay distinguishable. A manifest with no `version` is NOT skipped:
 * pnpm accepts a version-less private package, so it is a member with
 * `version` absent — on both surfaces.
 *
 * **Example** (Enumerate workspace packages with Node filesystem operations)
 *
 * ```ts
 * import * as A from "effect/Array";
 * import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
 * import * as path from "node:path";
 * import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@beep/repo-workspaces/WorkspacesSync";
 *
 * const ops = {
 * 	fileSystem: {
 * 		exists: existsSync,
 * 		readFile: (p: string) => readFileSync(p, "utf8"),
 * 		readDirectory: (p: string) => readdirSync(p),
 * 		isDirectory: (p: string) => statSync(p).isDirectory(),
 * 	},
 * 	path,
 * };
 * const root = findWorkspaceRootSync(process.cwd(), ops);
 * const packages = root === null ? [] : getWorkspacePackagesSync(root, ops);
 * console.log(A.every(packages, (pkg) => path.isAbsolute(pkg.path))) // true
 * ```
 *
 * @param root - The workspace root, from {@link findWorkspaceRootSync}.
 * @param options - The consumer-supplied operations and traversal bounds; see
 *   {@link GetWorkspacePackagesSyncOptions}.
 * @public
 * @category utilities
 * @since 0.0.0
 */
export const getWorkspacePackagesSync: {
  (options: GetWorkspacePackagesSyncOptions): (root: string) => ReadonlyArray<WorkspacePackage>;
  (root: string, options: GetWorkspacePackagesSyncOptions): ReadonlyArray<WorkspacePackage>;
} = dual(2, (root: string, options: GetWorkspacePackagesSyncOptions): ReadonlyArray<WorkspacePackage> => {
  const maxDepth = options.maxDepth ?? MAX_ENUMERATION_DEPTH;
  // A bad bound is a PROGRAMMER error, not a data condition. This function is
  // total over *data*, not over caller mistakes — so it throws here, mirroring
  // the enumerator's `Effect.die`. Same predicate, same message, one rule.
  if (!isValidMaxDepth(maxDepth)) {
    throw WorkspaceEnumerationDepthError.make({ message: `getWorkspacePackagesSync: ${badMaxDepthMessage(maxDepth)}` });
  }

  // The same GlobSet the async enumerator compiles. An uncompilable set yields
  // no members rather than throwing — see the totality note above.
  const compiled = Effect.runSyncExit(GlobSet.compile(WorkspacePatterns.forMatching(readPatternsSync(options, root))));
  if (Exit.isFailure(compiled)) return [];
  const globs = compiled.value;
  const scope: SyncScope = {
    options,
    root,
    maxDepth,
    included: MutableHashMap.empty<string, string>(),
    isExcluded: excludedBy(globs.excludes),
  };
  for (const literal of globs.literals) includeLiteralSync(scope, literal);
  for (const wildcard of globs.wildcards) enumerateWildcardSync(scope, wildcard);

  const sorted = A.sort(
    scope.included,
    Order.mapInput(Str.Order, ([relativePath]: [string, string]) => relativePath)
  );
  const members = admitted(
    options,
    A.map(
      A.filter(sorted, ([relativePath, absolute]) => relativePath !== "." && absolute !== root),
      ([relativePath, absolute]) => readPackageSync(options, root, absolute, relativePath)
    )
  );
  return [...admitted(options, [readPackageSync(options, root, root, ".")]), ...members];
});

/**
 * What one sync enumeration shares across its literal and wildcard passes.
 */
interface SyncScope {
  readonly included: MutableHashMap.MutableHashMap<string, string>;
  readonly isExcluded: (relative: string) => boolean;
  readonly maxDepth: number;
  readonly options: WorkspacesSyncOptions;
  readonly root: string;
}

/**
 * The packages among `reads`, reporting every skip to `onSkip` in order.
 *
 * @param options - The caller's options, for `onSkip`.
 * @param reads - The manifest reads, in order.
 * @returns The packages, in order.
 */
const admitted = (
  options: GetWorkspacePackagesSyncOptions,
  reads: ReadonlyArray<WorkspacePackage | WorkspaceDiscoverySkip>
): ReadonlyArray<WorkspacePackage> => {
  const members: Array<WorkspacePackage> = [];
  for (const read of reads) {
    if (S.is(WorkspacePackage)(read)) members.push(read);
    else options.onSkip?.(read);
  }
  return members;
};

/**
 * A literal include: an exact lookup, no directory read at all.
 *
 * @param scope - The enumeration's shared state.
 * @param literal - A `packages:` entry with no wildcard, relative to the root.
 */
const includeLiteralSync = (scope: SyncScope, literal: string): void => {
  if (scope.isExcluded(literal)) return;
  const absolute = scope.options.path.join(scope.root, literal);
  if (isPackage(scope.options, absolute)) MutableHashMap.set(scope.included, literal, absolute);
};

/**
 * One wildcard include, walked with THE shared traversal — the same state
 * machine `internal/enumerate.ts` drives.
 *
 * **Details**
 *
 * The ONLY difference between the two entry points is what happens to a
 * `TraversalStop`: the Effect path fails typed, this one truncates, because a
 * Vitest config has nowhere to put an error. Depth, budget, prune and dequeue
 * are not re-decided here.
 *
 * @param scope - The enumeration's shared state.
 * @param wildcard - A compiled `packages:` pattern with a wildcard.
 */
const enumerateWildcardSync = (scope: SyncScope, wildcard: GlobPattern): void => {
  const base = Str.replace(/\/$/, "")(wildcard.enumerationPrefix);
  const absoluteBase = scope.options.path.join(scope.root, base);
  if (!isDirectory(scope.options.fileSystem, absoluteBase)) return;
  const traversal = new Traversal(base, absoluteBase, scope.maxDepth);
  for (let current = traversal.next(); current !== undefined; current = traversal.next()) {
    if (traversal.charge() !== undefined) return;
    const frame = current;
    const entries = readResolvedEntries(scope.options, frame.absolute) ?? [];
    if (!A.every(entries, (entry) => visitEntrySync(scope, wildcard, traversal, frame, entry))) return;
  }
};

/**
 * One listed entry, returning `false` when the depth cap stops the walk.
 *
 * **Details**
 *
 * Depth BEFORE acceptance, exactly as the Effect enumerator does it. Gating
 * only the descent is what made this function return a package one level
 * beyond the cap that the Effect API rejected on the same tree — the drift
 * that motivated the shared traversal.
 *
 * @param scope - The enumeration's shared state.
 * @param wildcard - The wildcard being walked.
 * @param traversal - The shared traversal.
 * @param frame - The directory the entry was listed in.
 * @param entry - The listed entry.
 * @returns `false` when the depth cap stops the walk, `true` otherwise.
 */
const visitEntrySync = (
  scope: SyncScope,
  wildcard: GlobPattern,
  traversal: Traversal,
  frame: TraversalFrame,
  entry: ResolvedEntry
): boolean => {
  if (isPruned(entry.name) || !entry.directory) return true;
  if (wildcard.crossesSegments && !traversal.admits(frame)) return false;
  const relative = joinRelative(frame.relative, entry.name);
  const absolute = scope.options.path.join(frame.absolute, entry.name);
  if (wildcard.matches(relative) && !scope.isExcluded(relative) && isPackage(scope.options, absolute)) {
    MutableHashMap.set(scope.included, relative, absolute);
  }
  if (wildcard.crossesSegments) traversal.push(frame, relative, absolute);
  return true;
};
