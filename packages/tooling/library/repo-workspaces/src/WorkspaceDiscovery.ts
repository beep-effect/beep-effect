/**
 * Workspace discovery: read the `packages:` patterns, enumerate them, decode a
 * WorkspacePackage per directory.
 *
 * **Details**
 *
 * It also owns file → owning-package resolution (longest-prefix), which is a
 * lookup over discovery output rather than a concern of its own.
 *
 * It is also where `@beep/npm-spec`'s `WorkspaceResolver` contract is
 * implemented: `versionOf` is a lookup over the discovered package list.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GlobSet } from "@beep/glob";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { DependencyResolutionError, WorkspaceResolver } from "@beep/npm-spec/WorkspaceResolver";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { enumerate } from "./internal/enumerate.ts";
import { findLayerRoot } from "./internal/layerRoot.ts";
import { dependencyBlocksOf, manifestVersionOf } from "./internal/manifestFields.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";
import { WorkspacePatterns } from "./WorkspacePatterns.ts";
import { WorkspaceRoot } from "./WorkspaceRoot.ts";
import type { WorkspaceRootNotFoundError } from "./WorkspaceRoot.ts";

const $I = $RepoWorkspacesId.create("WorkspaceDiscovery");

const WorkspaceDiscoveryErrorKind = LiteralKit([
  "read",
  "invalidJson",
  "invalidShape",
  "invalidYaml",
  "missingName",
]).pipe(
  $I.annoteSchema("WorkspaceDiscoveryErrorKind", { description: "The reasons workspace manifest discovery can fail." })
);
const WorkspacePatternErrorKind = LiteralKit([
  "missingBaseDir",
  "uncompilable",
  "depthExceeded",
  "budgetExceeded",
  "unreadableDirectory",
]).pipe(
  $I.annoteSchema("WorkspacePatternErrorKind", {
    description: "The reasons a workspace pattern can fail to enumerate.",
  })
);
const byName = Order.make<WorkspacePackage>((a, b) => {
  const comparison = Str.localeCompare(b.name)(a.name);
  return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
});

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * Each package's `value`, keyed by name.
 *
 * **Details**
 *
 * First-write-wins, matching the `all.find` the indexes built on it replaced:
 * discovery does not reject duplicate names, and a plain
 * `new Map(all.map(...))` would keep the last.
 *
 * @param all - The discovered packages.
 * @param value - What to index for each package.
 * @returns The index, the first package of each name winning.
 */
const firstByName = <V>(
  all: ReadonlyArray<WorkspacePackage>,
  value: (pkg: WorkspacePackage) => V
): MutableHashMap.MutableHashMap<string, V> => {
  const index = MutableHashMap.empty<string, V>();
  for (const pkg of all) {
    if (!MutableHashMap.has(index, pkg.name)) MutableHashMap.set(index, pkg.name, value(pkg));
  }
  return index;
};

/**
 * The distinct packages owning `filePaths`, sorted by name; a path no package owns contributes nothing.
 *
 * @param filePaths - The paths to attribute.
 * @param ownerOf - The owner lookup.
 * @returns The owning packages, sorted by name.
 */
const ownersOf = (
  filePaths: ReadonlyArray<string>,
  ownerOf: (filePath: string) => O.Option<WorkspacePackage>
): ReadonlyArray<WorkspacePackage> => {
  const seen = MutableHashMap.empty<string, WorkspacePackage>();
  for (const owner of A.getSomes(A.map(filePaths, ownerOf))) MutableHashMap.set(seen, owner.name, owner);
  return A.sort(MutableHashMap.values(seen), byName);
};

class WorkspaceDiscoveryCause extends S.TaggedError<WorkspaceDiscoveryCause, { readonly brand: unique symbol }>(
  $I`WorkspaceDiscoveryCause`
)(
  "WorkspaceDiscoveryCause",
  { message: S.String },
  $I.annoteError<WorkspaceDiscoveryCause>("WorkspaceDiscoveryCause", {
    description: "A manifest-shape failure or an unstubbed discovery test-double method.",
  })
) {}

/**
 * Raised when a workspace member's `package.json` cannot be read, parsed, or
 * used — it is missing, malformed, or lacks a `name`.
 *
 * **Details**
 *
 * `kind` is the discriminant a caller branches on; `cause` preserves the
 * originating failure rather than flattening it into a sentence.
 *
 * A manifest with no `version` is NOT a failure: pnpm accepts a version-less
 * private package and a private monorepo root without one is the ordinary
 * shape, so the member is discovered with `WorkspacePackage.version` absent.
 * Only ABSENCE is tolerated: a
 * `version` that is present but not a string — or present and `""`, which pnpm
 * never wrote and which would resolve `workspace:^` to a bare `"^"` — is the
 * manifest's shape being wrong and reports `invalidShape`.
 *
 * **Example** (Report an invalid workspace manifest)
 *
 * ```ts
 * import { WorkspaceDiscoveryError } from "@beep/repo-workspaces/WorkspaceDiscovery";
 *
 * const error = WorkspaceDiscoveryError.make({ root: "/repo", path: "/repo/package.json", kind: "missingName", cause: undefined });
 * console.log(error.message) // Workspace discovery failed at /repo/package.json (missingName)
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class WorkspaceDiscoveryError extends S.TaggedError<WorkspaceDiscoveryError, { readonly brand: unique symbol }>(
  $I`WorkspaceDiscoveryError`
)(
  "WorkspaceDiscoveryError",
  {
    /** The workspace root discovery was running against. */
    root: S.String.pipe(
      $I.annoteKey("WorkspaceDiscoveryError.root", { description: "The workspace root discovery was running against." })
    ),
    /** The file that failed. */
    path: S.String.pipe($I.annoteKey("WorkspaceDiscoveryError.path", { description: "The file that failed." })),
    /** What went wrong with it. */
    kind: WorkspaceDiscoveryErrorKind.pipe(
      $I.annoteKey("WorkspaceDiscoveryError.kind", { description: "What went wrong with it." })
    ),
    /** The originating failure, if there was one. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("WorkspaceDiscoveryError.cause", { description: "The originating failure, if there was one." })
    ),
  },
  $I.annoteError<WorkspaceDiscoveryError>("WorkspaceDiscoveryError", {
    description:
      "Raised when a workspace member's `package.json` cannot be read, parsed, or used — it is missing, malformed, or lacks a `name`.",
  })
) {
  /**
   * Renders the failing file and kind into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { WorkspaceDiscoveryError } from "@beep/repo-workspaces/WorkspaceDiscovery";
   *
   * const error = WorkspaceDiscoveryError.make({ root: "/repo", path: "/repo/package.json", kind: "missingName", cause: undefined });
   * console.log(error.message) // Workspace discovery failed at /repo/package.json (missingName)
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `Workspace discovery failed at ${this.path} (${this.kind})`;
  }
}

/**
 * Raised when a `packages:` pattern cannot be enumerated: its base directory is
 * absent (usually a typo), the descent exceeded its depth cap, or the visit
 * budget was exhausted.
 *
 * **Example** (Report a missing pattern base)
 *
 * ```ts
 * import { WorkspacePatternError } from "@beep/repo-workspaces/WorkspaceDiscovery";
 *
 * const error = WorkspacePatternError.make({ root: "/repo", pattern: "packages/*", kind: "missingBaseDir", detail: "packages" });
 * console.log(error.message) // Workspace pattern "packages/*" could not be enumerated (missingBaseDir: packages)
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class WorkspacePatternError extends S.TaggedError<WorkspacePatternError, { readonly brand: unique symbol }>(
  $I`WorkspacePatternError`
)(
  "WorkspacePatternError",
  {
    /** The workspace root the patterns were expanded against. */
    root: S.String.pipe(
      $I.annoteKey("WorkspacePatternError.root", {
        description: "The workspace root the patterns were expanded against.",
      })
    ),
    /** The offending pattern, verbatim. */
    pattern: S.String.pipe(
      $I.annoteKey("WorkspacePatternError.pattern", { description: "The offending pattern, verbatim." })
    ),
    /** Why it could not be enumerated. */
    kind: WorkspacePatternErrorKind.pipe(
      $I.annoteKey("WorkspacePatternError.kind", { description: "Why it could not be enumerated." })
    ),
    /** A short, structured detail — the missing directory, or the bound exceeded. */
    detail: S.String.pipe(
      $I.annoteKey("WorkspacePatternError.detail", {
        description: "A short, structured detail — the missing directory, or the bound exceeded.",
      })
    ),
  },
  $I.annoteError<WorkspacePatternError>("WorkspacePatternError", {
    description:
      "Raised when a `packages:` pattern cannot be enumerated: its base directory is absent (usually a typo), the descent exceeded its depth cap, or the visit budget was exhausted.",
  })
) {
  /**
   * Renders the pattern and failure kind into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { WorkspacePatternError } from "@beep/repo-workspaces/WorkspaceDiscovery";
   *
   * const error = WorkspacePatternError.make({ root: "/repo", pattern: "packages/*", kind: "missingBaseDir", detail: "packages" });
   * console.log(error.message) // Workspace pattern "packages/*" could not be enumerated (missingBaseDir: packages)
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `Workspace pattern "${this.pattern}" could not be enumerated (${this.kind}: ${this.detail})`;
  }
}

/**
 * Raised when a workspace package is requested by a name no member carries.
 *
 * **Details**
 *
 * `available` lists every known member, which is what makes the error
 * actionable — a typo is obvious next to the list it missed.
 *
 * **Example** (Report an unknown package name)
 *
 * ```ts
 * import { PackageNotFoundError } from "@beep/repo-workspaces/WorkspaceDiscovery";
 *
 * const error = PackageNotFoundError.make({ packageName: "@app/missing", available: ["@app/core"] });
 * console.log(error.message) // No workspace package named "@app/missing"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageNotFoundError extends S.TaggedError<PackageNotFoundError, { readonly brand: unique symbol }>(
  $I`PackageNotFoundError`
)(
  "PackageNotFoundError",
  {
    /** The package name that was requested. */
    packageName: S.String.pipe(
      $I.annoteKey("PackageNotFoundError.packageName", { description: "The package name that was requested." })
    ),
    /** Every workspace package name that does exist. */
    available: S.Array(S.String).pipe(
      $I.annoteKey("PackageNotFoundError.available", { description: "Every workspace package name that does exist." })
    ),
  },
  $I.annoteError<PackageNotFoundError>("PackageNotFoundError", {
    description: "Raised when a workspace package is requested by a name no member carries.",
  })
) {
  /**
   * Renders the requested name into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { PackageNotFoundError } from "@beep/repo-workspaces/WorkspaceDiscovery";
   *
   * const error = PackageNotFoundError.make({ packageName: "@app/missing", available: ["@app/core"] });
   * console.log(error.message) // No workspace package named "@app/missing"
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category formatting
   * @since 0.0.0
   */
  override get message(): string {
    return `No workspace package named "${this.packageName}"`;
  }
}

/**
 * Top-level facts about a workspace: where it is, what manages it, and the
 * patterns that define its membership.
 *
 * **Example** (Inspect workspace membership patterns)
 *
 * ```ts
 * import { WorkspaceInfo } from "@beep/repo-workspaces/WorkspaceDiscovery";
 *
 * const info = WorkspaceInfo.make({ root: "/repo", patterns: ["packages/*"] });
 * console.log(info.patterns.join(", ")) // packages/*
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorkspaceInfo extends S.Opaque<WorkspaceInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Absolute path to the workspace root. */
    root: S.String.pipe($I.annoteKey("WorkspaceInfo.root", { description: "Absolute path to the workspace root." })),
    /** The `packages:` patterns, verbatim. */
    patterns: S.Array(S.String).pipe(
      $I.annoteKey("WorkspaceInfo.patterns", { description: "The `packages:` patterns, verbatim." })
    ),
  }).pipe(
    $I.annoteSchema("WorkspaceInfo", {
      description:
        "Top-level facts about a workspace: where it is, what manages it, and the patterns that define its membership.",
    })
  )
) {}

/**
 * Companion types for {@link WorkspaceInfo}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkspaceInfo {
  /**
   * The plain, unbranded encoded shape of a {@link WorkspaceInfo}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorkspaceInfo.Encoded;
}

/**
 * Every failure `WorkspaceDiscovery.getPackage` can surface: the discovery
 * failures plus a name that matches no member.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WorkspaceLookupFailure =
  | WorkspaceRootNotFoundError
  | WorkspaceDiscoveryError
  | WorkspacePatternError
  | PackageNotFoundError;

/**
 * The error channel of the discovery methods that do not look a package up by
 * name — everything except `getPackage`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type WorkspaceDiscoveryFailure = Exclude<WorkspaceLookupFailure, PackageNotFoundError>;

const DiscoveryDepth = S.declare(P.isNumber).pipe(
  $I.annoteSchema("DiscoveryDepth", { description: "The existing numeric descent cap, without additional refinement." })
);

/**
 * Options for the {@link WorkspaceDiscovery} layer.
 *
 * **Example** (Validate an optional discovery root)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { WorkspaceDiscoveryOptions } from "@beep/repo-workspaces/WorkspaceDiscovery";
 *
 * console.log(S.is(WorkspaceDiscoveryOptions)({ cwd: "/repo" })) // true
 * console.log(S.is(WorkspaceDiscoveryOptions)(null)) // false
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export class WorkspaceDiscoveryOptions extends S.Opaque<WorkspaceDiscoveryOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The directory the workspace root is resolved from.
     *
     * @defaultValue `process.cwd()`, read lazily on first use — so a
     *   `process.chdir` between providing the layer and the first call is
     *   honoured.
     */
    cwd: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorkspaceDiscoveryOptions.cwd", { description: "Optional working directory, resolved lazily." })
    ),
    /**
     * A ceiling for the layer-bound root ascent from `cwd`, passed straight
     * through to the `stopAt` of {@link WorkspaceRoot}'s `find`.
     *
     * **Details**
     *
     * Inclusive: the ceiling itself is probed, so a `cwd` that is its own
     * workspace root still resolves with `stopAt: cwd`. A relative ceiling is
     * resolved against the process working directory, exactly as `cwd` is. When
     * no root is found at or below the ceiling, the methods fail with
     * {@link WorkspaceRootNotFoundError} carrying the resolved `stopAt`, rather
     * than adopting an enclosing directory's workspace — pass `stopAt: cwd` for
     * a checkout nested inside someone else's monorepo.
     *
     * Applies ONLY to the layer-bound methods (`info`, `listPackages`,
     * `importerMap`, `getPackage`, `resolveFile`, `resolveFiles`). The per-call
     * `infoIn`, `listPackagesIn` and `refreshIn` resolve from an arbitrary
     * directory the caller names, which a single layer-level ceiling cannot
     * sensibly bound, so they ascend unbounded.
     *
     * `LockfileReader`, `WorkspaceCatalogs` and `WorkspaceSnapshots` each
     * take the same option; give them the same value when wiring by hand, or let a `Workspaces.*` composite forward one
     * `stopAt` to all of them, so no service adopts a root another refused.
     *
     * @defaultValue no ceiling — the ascent runs to the filesystem root.
     */
    stopAt: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorkspaceDiscoveryOptions.stopAt", {
        description: "Inclusive ceiling for layer-bound root discovery.",
      })
    ),
    /** Descent cap for segment-crossing patterns. Defaults to 32. */
    maxDepth: S.optionalKey(DiscoveryDepth).pipe(
      $I.annoteKey("WorkspaceDiscoveryOptions.maxDepth", {
        description: "Optional pattern descent cap, defaulted on use.",
      })
    ),
    /**
     * Keep enumeration inside the workspace root's real path.
     *
     * **Details**
     *
     * Off by default: discovery follows links as the package managers do. On,
     * a member directory, a wildcard base or a `**` descent whose real path
     * (symlinks resolved) leaves the root's real path is skipped before its
     * `package.json` is read and before the traversal descends into it, so a
     * link to a directory outside the checkout can neither fail discovery with
     * a manifest it holds nor walk a tree outside the root. A directory whose
     * real path cannot be resolved is skipped the same way. A member reached
     * through a link that stays inside the root is still discovered, at its
     * link path.
     *
     * @defaultValue `false`.
     */
    containWithinRoot: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("WorkspaceDiscoveryOptions.containWithinRoot", {
        description: "Skip member directories whose real path leaves the workspace root, before reading them.",
      })
    ),
    /**
     * Let a wildcard pattern whose base directory is absent select nothing.
     *
     * **Details**
     *
     * Off by default: a pattern such as `apps/*` whose `apps` directory does
     * not exist fails discovery with a `missingBaseDir`
     * {@link WorkspacePatternError}, which is what catches a typo in
     * `packages:`. On, that pattern selects no member and the others are
     * enumerated as usual, as a filesystem glob behaves. Git keeps no empty
     * directory, so a checkout whose last member under a base was deleted has
     * no such base at all; a caller that must keep working there opts in. The
     * depth and visit bounds still fail typed.
     *
     * @defaultValue `false`.
     */
    skipMissingBaseDirs: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("WorkspaceDiscoveryOptions.skipMissingBaseDirs", {
        description: "Let a wildcard whose base directory is absent select nothing instead of failing.",
      })
    ),
  }).pipe(
    $I.annoteSchema("WorkspaceDiscoveryOptions", {
      description: "Root resolution and pattern descent options, with defaults resolved lazily.",
    })
  )
) {}

/**
 * Companion types for {@link WorkspaceDiscoveryOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkspaceDiscoveryOptions {
  /**
   * The plain, unbranded encoded shape of a {@link WorkspaceDiscoveryOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorkspaceDiscoveryOptions.Encoded;
}

/**
 * The {@link WorkspaceDiscovery} service shape.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface WorkspaceDiscoveryShape {
  /** A single package by name. */
  readonly getPackage: (name: string) => Effect.Effect<WorkspacePackage, WorkspaceLookupFailure>;
  /**
   * The discovered packages keyed by their root-relative importer path.
   * Use `listPackages` as the explicit root-first sequence for ordered importer
   * iteration; HashMap iteration does not preserve insertion order.
   */
  readonly importerMap: Effect.Effect<HashMap.HashMap<string, WorkspacePackage>, WorkspaceDiscoveryFailure>;
  /** Facts about the resolved workspace. */
  readonly info: Effect.Effect<WorkspaceInfo, WorkspaceDiscoveryFailure>;
  /**
   * Facts about the workspace containing `directory`, discovered against THAT
   * root rather than the layer-bound one.
   */
  readonly infoIn: (directory: string) => Effect.Effect<WorkspaceInfo, WorkspaceDiscoveryFailure>;
  /** Every workspace package, root first, then the rest sorted by relative path. */
  readonly listPackages: Effect.Effect<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryFailure>;
  /**
   * Every package of the workspace containing `directory`, discovered against
   * THAT root rather than the layer-bound one.
   *
   * **Details**
   *
   * For a **long-lived host serving many roots** — an MCP server or a language
   * server that resolves one workspace at startup and then answers calls
   * scoped to a git worktree, a nested repository, or another project
   * entirely. The layer-bound {@link WorkspaceDiscoveryShape.listPackages}
   * answers about the root discovered from `options.cwd`, which such a host
   * has no way to vary per call without building a fresh layer.
   *
   * **This re-reads; it does not re-root.** The tempting cheap fix — take the
   * layer's package list and rewrite each `path` onto the caller's directory —
   * produces correct-looking paths over the ORIGINAL root's manifests, so a
   * worktree whose branch adds, removes or renames a package reports the other
   * branch's membership with no error. Patterns, member manifests, names and
   * versions all come from beneath `directory`'s own root here.
   *
   * `directory` may be the workspace root or anything inside it: the root is
   * resolved by the same upward walk the layer-bound path uses, and results are
   * memoized per RESOLVED root, so many directories in one workspace share one
   * discovery. The memo holds one entry per distinct root for the layer's
   * lifetime; {@link WorkspaceDiscoveryShape.refresh} drops all of them.
   *
   * @param directory - Absolute path to the workspace root, or to any
   *   directory inside it.
   */
  readonly listPackagesIn: (
    directory: string
  ) => Effect.Effect<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryFailure>;
  /**
   * Drop every memoized discovery — the layer-bound one and each per-root memo
   * — so the next call re-reads the filesystem.
   */
  readonly refresh: Effect.Effect<void>;
  /**
   * Drop only the memo for the workspace containing `directory`, leaving the
   * layer-bound memo and every other root's untouched.
   *
   * **Details**
   *
   * The precise counterpart to {@link WorkspaceDiscoveryShape.refresh} for a
   * host serving several roots: refreshing one worktree because it changed
   * should not discard sibling worktrees that did not, which is all `refresh`
   * can do.
   *
   * **Fails typed on a directory in no workspace**, exactly as
   * {@link WorkspaceDiscoveryShape.listPackagesIn} does for the same input —
   * the three per-root methods answer a bad path the same way, and a caller
   * that would rather treat it as a no-op writes `Effect.ignore`. Refreshing a
   * root that HAS no memo is an ordinary no-op and not an error.
   *
   * @param directory - Absolute path to the workspace root, or to any
   *   directory inside it.
   */
  readonly refreshIn: (directory: string) => Effect.Effect<void, WorkspaceRootNotFoundError>;
  /** The package owning an absolute file path, by longest-prefix match. */
  readonly resolveFile: (filePath: string) => Effect.Effect<O.Option<WorkspacePackage>, WorkspaceDiscoveryFailure>;
  /** The distinct packages owning any of `filePaths`. */
  readonly resolveFiles: (
    filePaths: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<WorkspacePackage>, WorkspaceDiscoveryFailure>;
}

/**
 * Discovers the packages of a workspace.
 *
 * **Details**
 *
 * Layer construction is O(1): the root walk, pattern read, enumeration and
 * per-package decode all happen on the first method call and are memoized for
 * the lifetime of the layer. A Vitest reporter that builds the layer per call
 * site and never queries it pays nothing.
 *
 * The memo is **success-only**: a failure or interrupt is not cached, so an
 * init interrupted by an unrelated timeout cannot brick the layer, and the next
 * call retries.
 *
 * **Example** (List workspace package names)
 *
 * ```ts
 * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* WorkspaceDiscovery;
 *   const packages = yield* discovery.listPackages;
 *   return packages.map((p) => p.name);
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class WorkspaceDiscovery extends Context.Service<WorkspaceDiscovery, WorkspaceDiscoveryShape>()(
  $I`WorkspaceDiscovery`
) {
  /**
   * Builds the service. Root resolution is one explicit concern: `cwd` is an
   * option here, never an ambient `process.cwd()` read inside a method.
   *
   * **Example** (Construct discovery with an explicit root)
   *
   * ```ts
   * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
   * import * as Effect from "effect/Effect";
   *
   * const program = WorkspaceDiscovery.make({ cwd: "/repo" });
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = Effect.fn("WorkspaceDiscovery.make")(function* (
    options?: WorkspaceDiscoveryOptions.Encoded
  ): Effect.fn.Return<WorkspaceDiscoveryShape, never, WorkspaceRoot | FileSystem.FileSystem | Path.Path> {
    const roots = yield* WorkspaceRoot;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    /** Read one `package.json` into the tolerant discovery projection. */
    const readPackage: {
      (root: string, directory: string, relativePath: string): Effect.Effect<WorkspacePackage, WorkspaceDiscoveryError>;
      (
        directory: string,
        relativePath: string
      ): (root: string) => Effect.Effect<WorkspacePackage, WorkspaceDiscoveryError>;
    } = dual(
      3,
      Effect.fnUntraced(function* (
        root: string,
        directory: string,
        relativePath: string
      ): Effect.fn.Return<WorkspacePackage, WorkspaceDiscoveryError> {
        const packageJsonPath = path.join(directory, "package.json");
        const content = yield* fs
          .readFileString(packageJsonPath)
          .pipe(
            Effect.mapError((cause) =>
              WorkspaceDiscoveryError.make({ root, path: packageJsonPath, kind: "read", cause })
            )
          );
        const parsed = yield* S.decodeEffect(JsonValue)(content).pipe(
          Effect.mapError((cause) =>
            WorkspaceDiscoveryError.make({ root, path: packageJsonPath, kind: "invalidJson", cause })
          )
        );

        // `JSON.parse` never returns `undefined`, so a guard on `undefined`
        // alone does not cover a manifest whose entire content is `null`, `42`
        // or `"x"` — all of which parse fine. Reading `.name` off `null` would
        // throw a TypeError, i.e. malformed input escaping as a DEFECT.
        //
        // This is `invalidShape`, NOT `invalidJson`: the text is perfectly valid
        // JSON. What is wrong is that it does not denote an object.
        if (!P.isObject(parsed)) {
          return yield* WorkspaceDiscoveryError.make({
            root,
            path: packageJsonPath,
            kind: "invalidShape",
            cause: WorkspaceDiscoveryCause.make({ message: "package.json is not a JSON object" }),
          });
        }
        const raw = parsed;

        const name = raw.name;
        if (!P.isString(name) || name.length === 0) {
          return yield* WorkspaceDiscoveryError.make({
            root,
            path: packageJsonPath,
            kind: "missingName",
            cause: undefined,
          });
        }
        const version = manifestVersionOf(raw.version);
        if (Result.isFailure(version)) {
          return yield* WorkspaceDiscoveryError.make({
            root,
            path: packageJsonPath,
            kind: "invalidShape",
            cause: WorkspaceDiscoveryCause.make({ message: version.failure }),
          });
        }
        // The tolerant projection: decoded through the schema, so a malformed
        // field fails typed rather than corrupting the model — but never
        // through package-json's strict semver `Package`, which would fail
        // discovery for the whole repo over one odd version string. `version`
        // rides through as the manifest has it: absent stays absent (pnpm
        // accepts a version-less private package; a private root without one
        // is the ordinary shape), a non-empty string verbatim.
        return yield* S.decodeEffect(WorkspacePackage)({
          name,
          ...O.getSomesStruct({ version: O.fromUndefinedOr(version.success) }),
          path: directory,
          packageJsonPath,
          relativePath,
          // The root the ascent already resolved, carried rather than dropped
          // for consumers to reconstruct by segment arithmetic.
          workspaceRoot: root,
          // The as-read record rides along so consumers reach fields outside
          // the discovery slice without a second file read.
          manifestRecord: raw,
          ...tolerantFieldsOf(raw),
        }).pipe(
          Effect.catchTag(
            "SchemaError",
            // A well-formed JSON document whose SHAPE the schema rejects — not a
            // syntax error. A consumer branching on `kind` must be able to tell
            // "this file is not JSON" from "this file is JSON I cannot use".
            (cause) => WorkspaceDiscoveryError.make({ root, path: packageJsonPath, kind: "invalidShape", cause })
          )
        );
      })
    );

    /**
     * Discovery for ONE already-resolved root — the whole read, with the root
     * as a parameter rather than a closed-over constant.
     *
     * **Details**
     *
     * Everything derived here (patterns, member manifests, names, versions) is
     * read beneath `root`, which is what makes the per-call-root methods
     * honest: re-rooting an already-discovered package list onto a different
     * directory rewrites paths but keeps the ORIGINAL root's manifests, so a
     * branch that adds or removes a package stays invisible. This re-reads.
     *
     * @param root - The resolved workspace root.
     * @returns The root's discovery state.
     */
    const discoverAt = Effect.fnUntraced(
      function* (root: string) {
        const patterns = yield* WorkspacePatterns.read(root).pipe(
          Effect.mapError((failure) =>
            WorkspaceDiscoveryError.make({
              root,
              path: failure.path,
              kind: failure.kind,
              cause: failure.cause,
            })
          )
        );

        const globs = yield* GlobSet.compile(patterns).pipe(
          Effect.mapError((error) =>
            WorkspacePatternError.make({
              root,
              pattern: error.pattern,
              kind: "uncompilable",
              detail: error.message,
            })
          )
        );

        const directories = yield* enumerate(root, globs, {
          maxDepth: options?.maxDepth ?? 32,
          ...O.getSomesStruct({
            containWithinRoot: O.fromUndefinedOr(options?.containWithinRoot),
            skipMissingBaseDirs: O.fromUndefinedOr(options?.skipMissingBaseDirs),
          }),
        }).pipe(
          Effect.mapError((failure) =>
            WorkspacePatternError.make({
              root,
              pattern: failure.pattern,
              kind: failure.kind,
              detail: failure.detail,
            })
          )
        );

        const members = yield* Effect.forEach(
          A.filter(directories, (entry) => entry.relativePath !== "." && entry.path !== root),
          (entry) => readPackage(root, entry.path, entry.relativePath),
          { concurrency: 10 }
        );

        const rootPackage = yield* readPackage(root, root, ".");
        const packages = [rootPackage, ...members];

        yield* Effect.logDebug("Workspace packages discovered").pipe(
          Effect.annotateLogs({ "workspace.root": root, "workspace.packages.count": packages.length })
        );

        return { info: WorkspaceInfo.make({ root, patterns }), packages };
      },
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path)
    );

    const discover: Effect.Effect<
      { readonly info: WorkspaceInfo; readonly packages: ReadonlyArray<WorkspacePackage> },
      WorkspaceDiscoveryFailure
    > = Effect.gen(function* () {
      // The ambient cwd is read at first use, not at layer construction
      // (`findLayerRoot` suspends).
      const root = yield* findLayerRoot(roots, options);
      return yield* discoverAt(root);
    });

    // Success-only memoization. See the class remarks: a bare `Effect.cached`
    // would memoize an interrupt and permanently brick the layer.
    const [resolveOnce, invalidate] = yield* Effect.cachedInvalidateWithTTL(discover, Duration.infinity);
    const memo = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidate));

    /**
     * Per-resolved-root memos for the `…In` methods, each success-only on the
     * same discipline as the layer-bound one above.
     *
     * **Details**
     *
     * Deliberately SEPARATE from that memo rather than replacing it: the
     * layer-bound path resolves its root once, at first use, and folding it
     * into this map would make every call re-run the root ascent. A caller
     * that asks for the layer's own root through `listPackagesIn` pays one
     * extra discovery — the honest price for not changing what the existing
     * methods do.
     *
     * The map grows one entry per distinct root, which is the point for a
     * long-lived host serving many worktrees, and is why `refresh()` clears
     * it wholesale rather than invalidating one cell.
     */
    const rootMemos = MutableHashMap.empty<
      string,
      {
        readonly memo: Effect.Effect<
          { readonly info: WorkspaceInfo; readonly packages: ReadonlyArray<WorkspacePackage> },
          WorkspaceDiscoveryFailure
        >;
        readonly invalidate: Effect.Effect<void>;
      }
    >();

    /** The memoized discovery for the workspace root containing `directory`. */
    const memoIn = Effect.fn("WorkspaceDiscovery.memoIn")(function* (directory: string) {
      // Resolved FIRST, so two directories inside one workspace share a
      // single memo — keying on the caller's path would discover the same
      // workspace once per subdirectory it happens to ask from.
      const root = yield* roots.find(directory);
      const existing = O.getOrUndefined(MutableHashMap.get(rootMemos, root));
      if (existing !== undefined) return yield* existing.memo;
      const [resolveOnce, invalidateOne] = yield* Effect.cachedInvalidateWithTTL(discoverAt(root), Duration.infinity);
      const built = Effect.onExit(resolveOnce, (exit) => (Exit.isSuccess(exit) ? Effect.void : invalidateOne));
      // Re-check under the benign concurrent-miss race: keep whichever cell
      // landed first so callers dedupe onto one.
      const raced = O.getOrUndefined(MutableHashMap.get(rootMemos, root));
      if (raced !== undefined) return yield* raced.memo;
      MutableHashMap.set(rootMemos, root, { memo: built, invalidate: invalidateOne });
      return yield* built;
    });

    const packages = memo.pipe(Effect.map((state) => state.packages));

    // Each service owns only its latest snapshot's indexes. Reference equality
    // detects refresh without changing equality on caller-owned arrays.
    const indexOwner: {
      ownerIndex:
        | {
            readonly snapshot: ReadonlyArray<WorkspacePackage>;
            readonly entries: ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }>;
          }
        | undefined;
      packageIndex:
        | {
            readonly snapshot: ReadonlyArray<WorkspacePackage>;
            readonly entries: MutableHashMap.MutableHashMap<string, WorkspacePackage>;
          }
        | undefined;
    } = { ownerIndex: undefined, packageIndex: undefined };

    const owners = (
      all: ReadonlyArray<WorkspacePackage>
    ): ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }> => {
      const cached = indexOwner.ownerIndex;
      if (cached !== undefined && cached.snapshot === all) return cached.entries;
      const index = A.sort(
        A.map(all, (pkg) => ({
          prefix: Str.endsWith(path.sep)(pkg.path) ? pkg.path : pkg.path + path.sep,
          package: pkg,
        })),
        Order.mapInput(Order.Number, (entry: { readonly prefix: string }) => -entry.prefix.length)
      );
      indexOwner.ownerIndex = { snapshot: all, entries: index };
      return index;
    };

    const ownerOf: {
      (
        filePath: string,
        index: ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }>
      ): O.Option<WorkspacePackage>;
      (
        index: ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }>
      ): (filePath: string) => O.Option<WorkspacePackage>;
    } = dual(
      2,
      (
        filePath: string,
        index: ReadonlyArray<{ readonly prefix: string; readonly package: WorkspacePackage }>
      ): O.Option<WorkspacePackage> => {
        for (const entry of index) {
          if (Str.startsWith(entry.prefix)(filePath)) return O.some(entry.package);
        }
        return O.none();
      }
    );

    const packagesByName = (
      all: ReadonlyArray<WorkspacePackage>
    ): MutableHashMap.MutableHashMap<string, WorkspacePackage> => {
      const cached = indexOwner.packageIndex;
      if (cached !== undefined && cached.snapshot === all) return cached.entries;
      const index = firstByName(all, (pkg) => pkg);
      indexOwner.packageIndex = { snapshot: all, entries: index };
      return index;
    };

    return {
      info: Effect.suspend(
        Effect.fn("WorkspaceDiscovery.info")(function* () {
          const state = yield* memo;
          return state.info;
        })
      ),

      listPackages: Effect.suspend(
        Effect.fn("WorkspaceDiscovery.listPackages")(function* () {
          return yield* packages;
        })
      ),

      importerMap: Effect.suspend(
        Effect.fn("WorkspaceDiscovery.importerMap")(function* () {
          const all = yield* packages;
          return HashMap.fromIterable(A.map(all, (pkg) => [pkg.relativePath, pkg] as const));
        })
      ),

      getPackage: Effect.fn("WorkspaceDiscovery.getPackage")(function* (name: string) {
        const all = yield* packages;
        const found = O.getOrUndefined(MutableHashMap.get(packagesByName(all), name));
        if (found !== undefined) return found;
        return yield* PackageNotFoundError.make({ packageName: name, available: A.map(all, (pkg) => pkg.name) });
      }),

      resolveFile: Effect.fn("WorkspaceDiscovery.resolveFile")(function* (filePath: string) {
        const all = yield* packages;
        return ownerOf(filePath, owners(all));
      }),

      infoIn: Effect.fn("WorkspaceDiscovery.infoIn")(function* (directory: string) {
        const state = yield* memoIn(directory);
        return state.info;
      }),

      listPackagesIn: Effect.fn("WorkspaceDiscovery.listPackagesIn")(function* (directory: string) {
        const state = yield* memoIn(directory);
        return state.packages;
      }),

      resolveFiles: Effect.fn("WorkspaceDiscovery.resolveFiles")(function* (filePaths: ReadonlyArray<string>) {
        const index = owners(yield* packages);
        return ownersOf(filePaths, (filePath) => ownerOf(filePath, index));
      }),

      refreshIn: Effect.fn("WorkspaceDiscovery.refreshIn")(function* (directory: string) {
        const root = yield* roots.find(directory);
        const cell = O.getOrUndefined(MutableHashMap.get(rootMemos, root));
        if (cell === undefined) return;
        // Invalidate the cell BEFORE dropping the reference: a fiber already
        // holding this memo keeps its own reference, and leaving the cached
        // value live would let that fiber replay a discovery this call was
        // asked to discard.
        yield* cell.invalidate;
        MutableHashMap.remove(rootMemos, root);
      }),

      refresh: Effect.suspend(() =>
        Effect.flatMap(
          Effect.forEach([...MutableHashMap.values(rootMemos)], (cell) => cell.invalidate, { discard: true }),
          () => {
            MutableHashMap.clear(rootMemos);
            return Effect.tap(invalidate, () =>
              Effect.sync(() => {
                indexOwner.ownerIndex = undefined;
                indexOwner.packageIndex = undefined;
              })
            );
          }
        )
      ),
    };
  });

  /**
   * The live layer, discovering the workspace from `options.cwd`.
   *
   * **Gotchas**
   *
   * A parameterized layer factory mints a **fresh reference per call**, and
   * layers memoize by reference — bind the result to a `const` and reuse it
   * rather than calling `layer(...)` at each composition site.
   *
   * **Example** (Build a reusable discovery layer)
   *
   * ```ts
   * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
   * import * as Layer from "effect/Layer";
   *
   * const LiveDiscovery = WorkspaceDiscovery.layer({ cwd: "/repo" });
   * console.log(Layer.isLayer(LiveDiscovery)) // true
   * ```
   *
   * @param options - Root resolution and enumeration bounds.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    options?: WorkspaceDiscoveryOptions.Encoded
  ): Layer.Layer<WorkspaceDiscovery, never, WorkspaceRoot | FileSystem.FileSystem | Path.Path> =>
    Layer.effect(WorkspaceDiscovery, WorkspaceDiscovery.make(options));

  /**
   * An in-memory test double of the service shape, with every method
   * defaulted so a test stubs only what it exercises.
   *
   * **Details**
   *
   * The defaults model an **empty workspace**, and the derived methods run
   * over the *effective* `listPackages` — the override when one is supplied —
   * so stubbing only `listPackages` yields a consistent double:
   *
   * - `listPackages` — succeeds with `[]`.
   * - `importerMap` — derived: the packages keyed by `relativePath`.
   * - `getPackage` — derived: a name lookup that fails with the service's own
   *   typed {@link PackageNotFoundError} on a miss, exactly as the live
   *   implementation does.
   * - `resolveFile` / `resolveFiles` — derived: longest-prefix ownership over
   *   `pkg.path`, POSIX-terminated (`"/"`); supply a win32 double explicitly
   *   if your fixture paths are win32.
   * - `refresh` — a no-op (`Effect.void`); there is nothing memoized to drop.
   * - `info` — **dies** with an explanatory defect. No honest default exists
   *   (a fabricated root path would leak into consumer path logic), so an
   *   unstubbed `info()` call is a test-wiring mistake and fails loudly as a
   *   defect rather than succeeding with a lie or failing with a dishonest
   *   typed error. A defect is not absorbed by `Effect.catch` or any
   *   typed-error handler — deliberately, so code under test with a
   *   best-effort `catch` cannot make the mandatory stub look optional; the
   *   unstubbed call still fails the test.
   *
   * **Example** (Stub discovery with a workspace package)
   *
   * ```ts
   * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
   * import { WorkspacePackage } from "@beep/repo-workspaces/WorkspacePackage";
   * import * as Effect from "effect/Effect";
   *
   * const double = WorkspaceDiscovery.makeTest({
   *   listPackages: Effect.succeed([
   *     WorkspacePackage.make({
   *       name: "@my-org/utils",
   *       version: "1.0.0",
   *       path: "/repo/packages/utils",
   *       packageJsonPath: "/repo/packages/utils/package.json",
   *       relativePath: "packages/utils",
   *       workspaceRoot: "/repo",
   *     }),
   *   ]),
   * });
   * // `getPackage`, `importerMap`, `resolveFile(s)` now answer consistently.
   * console.log(Effect.runSync(double.getPackage("@my-org/utils")).name) // @my-org/utils
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<WorkspaceDiscoveryShape> = {}): WorkspaceDiscoveryShape => {
    const listPackages = overrides.listPackages ?? Effect.succeed([]);

    // POSIX-terminated longest-prefix ownership, mirroring the live
    // `resolveFile` semantics minus the platform `Path` service.
    const ownerOf: {
      (filePath: string, all: ReadonlyArray<WorkspacePackage>): O.Option<WorkspacePackage>;
      (all: ReadonlyArray<WorkspacePackage>): (filePath: string) => O.Option<WorkspacePackage>;
    } = dual(2, (filePath: string, all: ReadonlyArray<WorkspacePackage>): O.Option<WorkspacePackage> => {
      let best: WorkspacePackage | undefined;
      let bestLength = 0;
      for (const pkg of all) {
        const prefix = Str.endsWith("/")(pkg.path) ? pkg.path : `${pkg.path}/`;
        if (Str.startsWith(prefix)(filePath) && prefix.length > bestLength) {
          best = pkg;
          bestLength = prefix.length;
        }
      }
      return O.fromUndefinedOr(best);
    });

    return {
      listPackages,
      info: Effect.suspend(() =>
        Effect.die(
          WorkspaceDiscoveryCause.make({
            message:
              "WorkspaceDiscovery.makeTest: info() was called but not stubbed — no honest default WorkspaceInfo exists for a test double; pass an `info` override.",
          })
        )
      ),
      importerMap: Effect.suspend(() =>
        Effect.map(listPackages, (all) => HashMap.fromIterable(A.map(all, (pkg) => [pkg.relativePath, pkg] as const)))
      ),
      getPackage: (name: string) =>
        Effect.flatMap(listPackages, (all) =>
          Effect.fromOption(
            A.findFirst(all, (pkg) => pkg.name === name),
            () => PackageNotFoundError.make({ packageName: name, available: A.map(all, (pkg) => pkg.name) })
          )
        ),
      resolveFile: (filePath: string) => Effect.map(listPackages, (all) => ownerOf(filePath, all)),
      resolveFiles: (filePaths: ReadonlyArray<string>) =>
        Effect.map(listPackages, (all) => ownersOf(filePaths, (filePath) => ownerOf(filePath, all))),
      // Both per-root methods DIE unstubbed rather than deriving from
      // `listPackages`. Deriving would model a world in which every root holds
      // the same members — which is exactly the confusion these methods exist to
      // remove, so a double that fabricated it could not discriminate a consumer
      // calling the wrong one. There is no honest default for "what does that
      // OTHER workspace contain".
      infoIn: () =>
        Effect.die(
          WorkspaceDiscoveryCause.make({
            message:
              "WorkspaceDiscovery.makeTest: infoIn() was called but not stubbed — a double cannot know what another root's workspace looks like; pass an `infoIn` override.",
          })
        ),
      listPackagesIn: () =>
        Effect.die(
          WorkspaceDiscoveryCause.make({
            message:
              "WorkspaceDiscovery.makeTest: listPackagesIn() was called but not stubbed — deriving it from `listPackages` would model every root as identical, which is the bug this method exists to prevent; pass a `listPackagesIn` override.",
          })
        ),
      refresh: Effect.suspend(() => Effect.void),
      // Nothing is memoized in a double, so dropping one root's memo is honestly
      // a no-op — unlike the two reads above, which have no honest default.
      refreshIn: () => Effect.void,
      ...overrides,
    };
  };

  /**
   * The test layer: {@link WorkspaceDiscovery.makeTest} behind
   * `Layer.succeed`, so a suite provides only the methods it exercises.
   *
   * **Gotchas**
   *
   * A parameterized layer factory mints a **fresh reference per call**, and
   * layers memoize by reference — bind the result to a `const` and reuse it
   * rather than calling `layerTest(...)` at each composition site.
   *
   * **Example** (Provide an empty workspace discovery test layer)
   *
   * ```ts
   * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
   * import * as Effect from "effect/Effect";
   *
   * const TestDiscovery = WorkspaceDiscovery.layerTest({
   *   listPackages: Effect.succeed([]),
   * });
   * const program = Effect.flatMap(WorkspaceDiscovery, (discovery) => discovery.listPackages)
   *   .pipe(Effect.provide(TestDiscovery));
   * console.log(Effect.runSync(program).length) // 0
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<WorkspaceDiscoveryShape> = {}): Layer.Layer<WorkspaceDiscovery> =>
    Layer.succeed(WorkspaceDiscovery, WorkspaceDiscovery.makeTest(overrides));

  /**
   * The real implementation of `@beep/npm-spec`'s `WorkspaceResolver` contract
   * — the one `@beep/npm-spec` declares and `@beep/package-json`'s `Package.resolve` consumes.
   *
   * **Details**
   *
   * `versionOf` returns `Option.none()` for a name that is not a workspace
   * member, per the contract's convention; the `DependencyResolutionError`
   * channel is reserved for a failure of the resolution *mechanism* (an
   * unfindable root, an unreadable manifest), never an ordinary miss.
   *
   * A member that declares **no `version`** is neither: it is a known member
   * with nothing for `workspace:` to resolve to. Answering `none` would read
   * as "not a member" downstream, so it fails typed instead, naming the
   * specifier — the same channel a consumer already handles for an
   * unresolvable workspace.
   *
   * **Example** (Provide a resolver for workspace dependencies)
   *
   * ```ts
   * import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
   * import * as Layer from "effect/Layer";
   *
   * const resolvers = WorkspaceDiscovery.workspaceResolver.pipe(
   *   Layer.provide(WorkspaceDiscovery.layer()),
   * );
   * // `Package.resolve` now resolves `workspace:*` for real.
   * console.log(Layer.isLayer(resolvers)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly workspaceResolver: Layer.Layer<WorkspaceResolver, never, WorkspaceDiscovery> = Layer.effect(
    WorkspaceResolver,
    Effect.gen(function* () {
      const discovery = yield* WorkspaceDiscovery;
      // Name → version, where a version-less member is present with `undefined`:
      // membership and version are two different questions here, and `has` is
      // what tells them apart.
      const resolverOwner: {
        versionIndex:
          | {
              readonly snapshot: ReadonlyArray<WorkspacePackage>;
              readonly entries: MutableHashMap.MutableHashMap<string, string | undefined>;
            }
          | undefined;
      } = { versionIndex: undefined };
      const versionsByName = (
        all: ReadonlyArray<WorkspacePackage>
      ): MutableHashMap.MutableHashMap<string, string | undefined> => {
        const cached = resolverOwner.versionIndex;
        if (cached !== undefined && cached.snapshot === all) return cached.entries;
        const index = firstByName(all, (pkg): string | undefined => pkg.version);
        resolverOwner.versionIndex = { snapshot: all, entries: index };
        return index;
      };
      return {
        versionOf: Effect.fn("WorkspaceDiscovery.workspaceVersionOf")((packageName: string) => {
          const specifier = `workspace:${packageName}`;
          return discovery.listPackages.pipe(
            Effect.mapError((cause) => DependencyResolutionError.make({ specifier, cause })),
            Effect.flatMap((all) => {
              const index = versionsByName(all);
              if (!MutableHashMap.has(index, packageName)) return Effect.succeed(O.none<string>());
              const version = O.getOrUndefined(MutableHashMap.get(index, packageName));
              return version === undefined
                ? Effect.fail(
                    // A domain condition read from structured data, not a foreign
                    // failure: typed by `reason`, with nothing to carry as `cause`.
                    DependencyResolutionError.make({ specifier, reason: "no-version", cause: undefined })
                  )
                : Effect.succeedSome(version);
            })
          );
        }),
      };
    })
  );
}

/**
 * The manifest fields discovery carries only when they have the expected
 * shape: `private` as a boolean, each dependency block as a name-to-range
 * record, and `publishConfig` when present at all.
 *
 * @param raw - The parsed manifest.
 * @returns The usable optional fields.
 */
const tolerantFieldsOf = (raw: { readonly [key: string]: unknown }) => ({
  ...(P.isBoolean(raw.private) ? { private: raw.private } : {}),
  ...dependencyBlocksOf(raw),
  ...(P.isNotNullish(raw.publishConfig) ? { publishConfig: raw.publishConfig } : {}),
});
