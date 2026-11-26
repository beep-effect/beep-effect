/**
 * Git-based change detection: changedFiles → changedPackages →
 * affectedPackages, three depths of analysis on one service.
 *
 * **Details**
 *
 * It runs git through `@beep/git`'s `Git` service rather than a raw
 * subprocess seam, so a test provides `Layer.succeed(Git, …)` and needs no
 * repository on disk. `Git` requires core's `ChildProcessSpawner` in `R`, which
 * the consumer's platform layer discharges at the edge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git";
import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DependencyGraph } from "./DependencyGraph.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import type { GitCommandError, NotARepositoryError, UnknownRefError } from "@beep/git";
import type { WorkspaceDiscoveryFailure } from "./WorkspaceDiscovery.ts";
import type { WorkspacePackage } from "./WorkspacePackage.ts";

const $I = $RepoWorkspacesId.create("ChangeDetector");

/**
 * **Example** (Inspect default and branch comparison refs)
 *
 * ```ts
 * import { ChangeDetectionOptions } from "@beep/repo-workspaces/ChangeDetector";
 *
 * const defaults = ChangeDetectionOptions.make({});
 * const branch = ChangeDetectionOptions.make({ base: "origin/main" });
 * console.log(defaults.base) // HEAD~1
 * console.log(defaults.head) // HEAD
 * console.log(branch.base) // origin/main
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ChangeDetectionOptions extends S.Opaque<ChangeDetectionOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The ref to compare against.
     *
     * @defaultValue `"HEAD~1"`
     */
    base: S.String.pipe(
      S.withDecodingDefaultKey(Effect.succeed("HEAD~1")),
      S.withConstructorDefault(Effect.succeed("HEAD~1")),
      $I.annoteKey("ChangeDetectionOptions.base", { description: "The ref to compare against." })
    ),
    /**
     * The ref to compare to.
     *
     * @defaultValue `"HEAD"`
     */
    head: S.String.pipe(
      S.withDecodingDefaultKey(Effect.succeed("HEAD")),
      S.withConstructorDefault(Effect.succeed("HEAD")),
      $I.annoteKey("ChangeDetectionOptions.head", { description: "The ref to compare to." })
    ),
    /**
     * Whether to include staged, unstaged and untracked working-tree changes on
     * top of the committed range.
     *
     * @defaultValue `false`
     */
    includeUncommitted: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(false)),
      S.withConstructorDefault(Effect.succeed(false)),
      $I.annoteKey("ChangeDetectionOptions.includeUncommitted", {
        description:
          "Whether to include staged, unstaged and untracked working-tree changes on top of the committed range.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ChangeDetectionOptions", {
      description: "Which git refs to compare, and whether to fold in the working tree.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChangeDetectionOptions {
  /**
   * The plain, unbranded encoded shape of a {@link ChangeDetectionOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ChangeDetectionOptions.Encoded;
}

/**
 * **Details**
 *
 * A git command that merely *fails* surfaces as one of `@beep/git`'s typed
 * errors ({@link ChangeDetectionFailure} carries `GitCommandError`,
 * `NotARepositoryError` and `UnknownRefError`) rather than being flattened into
 * this wrapper — a caller branches on git's taxonomy directly.
 *
 * **Example** (Render a detection failure)
 *
 * ```ts
 * import { ChangeDetectionError } from "@beep/repo-workspaces/ChangeDetector";
 *
 * const error = ChangeDetectionError.make({ operation: "compare", cause: new Error("unavailable") });
 * console.log(error.message) // Change detection failed during compare
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ChangeDetectionError extends S.TaggedError<ChangeDetectionError, { readonly brand: unique symbol }>(
  $I`ChangeDetectionError`
)(
  "ChangeDetectionError",
  {
    /** The operation that could not run. */
    operation: S.String.pipe(
      $I.annoteKey("ChangeDetectionError.operation", { description: "The operation that could not run." })
    ),
    /** The originating failure. */
    cause: S.Defect({ includeStack: true }).pipe(
      $I.annoteKey("ChangeDetectionError.cause", { description: "The originating failure." })
    ),
  },
  $I.annoteError<ChangeDetectionError>("ChangeDetectionError", {
    description:
      'Raised when change detection cannot proceed for a reason that is not one of git\'s own typed failures — the wrapper for "detection has no ground to stand on".',
  })
) {
  /**
   * Renders the failed operation into a one-line message.
   *
   * **Example** (Read the failed operation message)
   *
   * ```ts
   * import { ChangeDetectionError } from "@beep/repo-workspaces/ChangeDetector";
   *
   * const error = ChangeDetectionError.make({ operation: "compare", cause: new Error("unavailable") });
   * console.log(error.message) // Change detection failed during compare
   * ```
   *
   * @returns The one-line sentence a log or a thrown error shows.
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return `Change detection failed during ${this.operation}`;
  }
}

/**
 * Every failure the change-detection methods can surface.
 *
 * **Details**
 *
 * `@beep/git`'s typed errors surface directly alongside
 * {@link ChangeDetectionError} and the discovery failures — a git command that
 * fails is reported as git classified it (`NotARepositoryError` for a
 * non-repository, `UnknownRefError` for a bad ref, `GitCommandError`
 * otherwise), not re-wrapped.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ChangeDetectionFailure =
  | ChangeDetectionError
  | GitCommandError
  | NotARepositoryError
  | UnknownRefError
  | WorkspaceDiscoveryFailure;

/**
 * The {@link ChangeDetector} service shape.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface ChangeDetectorShape {
  /** Those packages plus every workspace package that transitively depends on one. */
  readonly affectedPackages: (
    options?: ChangeDetectionOptions.Encoded
  ) => Effect.Effect<ReadonlyArray<WorkspacePackage>, ChangeDetectionFailure>;
  /** The file paths (workspace-root-relative, as git reports them) changed in the range. */
  readonly changedFiles: (
    options?: ChangeDetectionOptions.Encoded
  ) => Effect.Effect<ReadonlyArray<string>, ChangeDetectionFailure>;
  /** The workspace packages owning those files. */
  readonly changedPackages: (
    options?: ChangeDetectionOptions.Encoded
  ) => Effect.Effect<ReadonlyArray<WorkspacePackage>, ChangeDetectionFailure>;
}

/**
 * Detects which workspace packages a git range touches.
 *
 * **Details**
 *
 * Three depths on one service, cheapest first — raw file paths, the packages
 * owning them, and the transitive blast radius through the dependency graph.
 *
 * **Example** (Find packages affected since origin/main)
 *
 * ```ts
 * import { ChangeDetectionOptions, ChangeDetector } from "@beep/repo-workspaces/ChangeDetector";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const detector = yield* ChangeDetector;
 *   const affected = yield* detector.affectedPackages(
 *     ChangeDetectionOptions.make({ base: "origin/main" }),
 *   );
 *   return affected.map((pkg) => pkg.name);
 * });
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ChangeDetector extends Context.Service<ChangeDetector, ChangeDetectorShape>()($I`ChangeDetector`) {
  /**
   * Builds the service over `Git` and {@link WorkspaceDiscovery}.
   *
   * **Example** (Construct the change detector service)
   *
   * ```ts
   * import { ChangeDetector } from "@beep/repo-workspaces/ChangeDetector";
   * import * as Effect from "effect/Effect";
   *
   * console.log(Effect.isEffect(ChangeDetector.make)) // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make: Effect.Effect<ChangeDetectorShape, never, Git | WorkspaceDiscovery> = Effect.gen(function* () {
    const git = yield* Git;
    const discovery = yield* WorkspaceDiscovery;

    const filesOf: {
      (
        root: string,
        options: ChangeDetectionOptions
      ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
      (
        options: ChangeDetectionOptions
      ): (
        root: string
      ) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    } = dual(
      2,
      Effect.fnUntraced(function* (
        root: string,
        options: ChangeDetectionOptions
      ): Effect.fn.Return<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError> {
        const committed = yield* git.changedFiles(root, {
          base: options.base,
          head: options.head,
          relative: true,
        });
        if (!options.includeUncommitted) return A.sort(A.fromIterable(committed), Str.Order);

        const working = yield* git.workingChanges(root, { relative: true });
        return A.sort(A.fromIterable(MutableHashSet.fromIterable([...committed, ...working])), Str.Order);
      })
    );

    const rootOf = (): Effect.Effect<string, WorkspaceDiscoveryFailure> =>
      discovery.info.pipe(Effect.map((info) => info.root));

    const packagesOf = Effect.fnUntraced(function* (
      options: ChangeDetectionOptions
    ): Effect.fn.Return<ReadonlyArray<WorkspacePackage>, ChangeDetectionFailure> {
      const root = yield* rootOf();
      const files = yield* filesOf(root, options);
      const absolute = A.map(files, (file) => (Str.startsWith("/")(file) ? file : `${root}/${file}`));
      return yield* discovery.resolveFiles(absolute);
    });

    return {
      changedFiles: Effect.fn("ChangeDetector.changedFiles")(function* (options?: ChangeDetectionOptions.Encoded) {
        const root = yield* rootOf();
        const files = yield* filesOf(root, ChangeDetectionOptions.make(options ?? {}));
        yield* Effect.logDebug("Changed files detected").pipe(
          Effect.annotateLogs("workspace.files.count", files.length)
        );
        return files;
      }),

      changedPackages: Effect.fn("ChangeDetector.changedPackages")(function* (
        options?: ChangeDetectionOptions.Encoded
      ) {
        const packages = yield* packagesOf(ChangeDetectionOptions.make(options ?? {}));
        yield* Effect.logDebug("Changed packages detected").pipe(
          Effect.annotateLogs("workspace.packages.count", packages.length)
        );
        return packages;
      }),

      affectedPackages: Effect.fn("ChangeDetector.affectedPackages")(function* (
        options?: ChangeDetectionOptions.Encoded
      ) {
        const changed = yield* packagesOf(ChangeDetectionOptions.make(options ?? {}));
        const all = yield* discovery.listPackages;
        const graph = DependencyGraph.make({ packages: all });
        const names = yield* graph.affectedBy(A.map(changed, (pkg) => pkg.name));
        const byName = MutableHashMap.fromIterable(A.map(all, (pkg) => [pkg.name, pkg] as const));
        const affected = pipe(
          names,
          A.map((name) => O.getOrUndefined(MutableHashMap.get(byName, name))),
          A.filter((pkg): pkg is WorkspacePackage => pkg !== undefined)
        );
        yield* Effect.logDebug("Affected packages detected").pipe(
          Effect.annotateLogs("workspace.packages.count", affected.length)
        );
        return affected;
      }),
    };
  });

  /**
   * The live layer.
   *
   * **Example** (Inspect the live change detector layer)
   *
   * ```ts
   * import { ChangeDetector } from "@beep/repo-workspaces/ChangeDetector";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(ChangeDetector.layer)) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<ChangeDetector, never, Git | WorkspaceDiscovery> = Layer.effect(
    ChangeDetector,
    ChangeDetector.make
  );
}
