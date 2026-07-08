/**
 * Workspace discovery for monorepo projects.
 *
 * Expands glob patterns from the root `package.json` `workspaces` field
 * into a mapping of package names to their absolute directory paths.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkEffectSucceedNull } from "@beep/utils";
import { Effect, HashMap, pipe } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { DomainError } from "./errors/index.js";
import { FsUtils } from "./FsUtils.js";
import { decodePackageJsonEffect, PackageJson, readPackageJsonFile } from "./schemas/PackageJson.js";
import type { FileSystem } from "effect";
import type { NoSuchFileError } from "./errors/index.js";
import type { Workspaces as PackageJsonWorkspaces } from "./schemas/PackageJson.js";

const $I = $RepoUtilsId.create("Workspaces");

/**
 * Directories to exclude when scanning workspace globs.
 *
 * @category configuration
 * @since 0.0.0
 */
const IGNORED_DIRS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.turbo/**"];
const absoluteWorkspacePattern = /^(?:[A-Za-z]:\/|\/\/|\/)/;

const isWorkspacePatternArray = (value: PackageJsonWorkspaces): value is ReadonlyArray<string> => A.isArray(value);

/**
 * Extract the workspace glob patterns declared in a `package.json` `workspaces`
 * field, normalizing the array and Yarn-object forms to a flat pattern list.
 *
 * @param workspaces - The decoded `package.json` `workspaces` field, either the
 *   array form, the Yarn `{ packages }` object form, or `undefined`/`None` when
 *   the manifest declares no workspaces.
 * @returns The flat list of workspace glob patterns, empty when none are declared.
 * @remarks
 * Returns an empty array when `workspaces` is absent or `None`. The Yarn-style
 * object form contributes its `packages` entry (or nothing when it is absent);
 * the array form is returned as-is.
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { workspaceGlobsFrom } from "@beep/repo-utils/Workspaces"
 *
 * const globs = workspaceGlobsFrom(O.some(["packages/*", "apps/*"]))
 * console.log(globs) // ["packages/*", "apps/*"]
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const workspaceGlobsFrom = (workspaces: PackageJson["workspaces"]): ReadonlyArray<string> => {
  if (P.isUndefined(workspaces) || O.isNone(workspaces)) {
    return [];
  }

  const presentWorkspaces = workspaces.value;
  return isWorkspacePatternArray(presentWorkspaces) ? presentWorkspaces : (presentWorkspaces.packages ?? A.empty());
};

const isSafeWorkspacePattern = (pattern: string): boolean => {
  const normalized = normalizePath(pattern);
  const segments = pipe(normalized, Str.split("/"), A.filter(Str.isNonEmpty));

  return Str.isNonEmpty(normalized) && !absoluteWorkspacePattern.test(normalized) && !A.some(segments, Eq.equals(".."));
};

const isContainedCanonicalPath: {
  (rootDir: string, candidateDir: string): boolean;
  (candidateDir: string): (rootDir: string) => boolean;
} = dual(2, (rootDir: string, candidateDir: string): boolean => {
  const normalizedRootDir = normalizePath(rootDir);
  const normalizedCandidateDir = normalizePath(candidateDir);
  return (
    normalizedCandidateDir === normalizedRootDir ||
    pipe(normalizedRootDir, Str.endsWith("/"), (hasSuffix) =>
      Str.startsWith(hasSuffix ? normalizedRootDir : `${normalizedRootDir}/`)(normalizedCandidateDir)
    )
  );
});

/**
 * Resolve all workspace directories declared in the root `package.json`.
 *
 * Reads the `workspaces` array from the root `package.json`, expands each
 * glob pattern, reads each matching directory's `package.json` to extract
 * the package name, and returns a `HashMap<PackageName, AbsoluteDirectory>`.
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @returns A HashMap mapping package names to their absolute directory paths.
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces"
 *
 * const program = resolveWorkspaceDirs(".")
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const resolveWorkspaceDirs: (
  rootDir: string
) => Effect.Effect<HashMap.HashMap<string, string>, NoSuchFileError | DomainError, FsUtils> = Effect.fn(
  function* (rootDir) {
    const fsUtils = yield* FsUtils;

    // Read and decode root package.json
    const rootPkgPath = `${rootDir}/package.json`;
    const rawPkg = yield* fsUtils.readJson(rootPkgPath);
    if (O.isNone(rawPkg)) {
      return yield* DomainError.make({
        message: `Failed to parse JSON at "${rootPkgPath}"`,
      });
    }
    const rootPkg = yield* decodePackageJsonEffect(rawPkg.value).pipe(
      Effect.mapError((error) =>
        DomainError.make({ cause: error, message: `Failed to decode root package.json at "${rootPkgPath}"` })
      )
    );

    const workspaceGlobs = workspaceGlobsFrom(rootPkg.workspaces);
    if (A.isReadonlyArrayEmpty(workspaceGlobs)) {
      return HashMap.empty<string, string>();
    }

    for (const workspaceGlob of workspaceGlobs) {
      if (!isSafeWorkspacePattern(workspaceGlob)) {
        return yield* DomainError.make({
          message: `Unsafe workspace glob "${workspaceGlob}" escapes the repository root.`,
        });
      }
    }

    const canonicalRootDir = yield* fsUtils
      .realPath(rootDir)
      .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve repository root "${rootDir}"`)));

    // Expand all workspace globs
    const dirs = yield* fsUtils.glob(workspaceGlobs, {
      cwd: rootDir,
      absolute: true,
      ignore: IGNORED_DIRS,
    });

    // For each directory, read package.json and extract name
    let result = HashMap.empty<string, string>();

    for (const dir of dirs) {
      const canonicalDir = yield* fsUtils
        .realPath(dir)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve workspace path "${dir}"`)));

      if (!isContainedCanonicalPath(canonicalRootDir, canonicalDir)) {
        return yield* DomainError.make({
          message: `Workspace path escapes repository root: "${dir}" -> "${canonicalDir}"`,
        });
      }

      const pkgJsonPath = `${dir}/package.json`;
      const rawChildPkg = yield* fsUtils
        .readJson(pkgJsonPath)
        .pipe(Effect.catchTag("NoSuchFileError", thunkEffectSucceedNull));
      if (P.isNull(rawChildPkg)) {
        continue;
      }
      if (O.isNone(rawChildPkg)) {
        return yield* DomainError.make({
          message: `Failed to parse JSON at "${pkgJsonPath}"`,
        });
      }

      const childPkg = yield* decodePackageJsonEffect(rawChildPkg.value).pipe(
        Effect.mapError(DomainError.newCause(`Failed to decode package.json at "${pkgJsonPath}"`))
      );

      result = HashMap.set(result, childPkg.name, canonicalDir);
    }

    return result;
  }
);

/**
 * Look up the absolute directory for a single workspace by package name.
 *
 * Resolves all workspaces and returns the path for the given name,
 * or `None` if the workspace is not found.
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @param name - The package name to look up.
 * @returns An Option containing the absolute directory path, or None.
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { getWorkspaceDir } from "@beep/repo-utils/Workspaces"
 *
 * const program = getWorkspaceDir(".", "@beep/repo-utils")
 * console.log(program)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const getWorkspaceDir: {
  (rootDir: string, name: string): Effect.Effect<O.Option<string>, NoSuchFileError | DomainError, FsUtils>;
  (name: string): (rootDir: string) => Effect.Effect<O.Option<string>, NoSuchFileError | DomainError, FsUtils>;
} = dual(
  2,
  Effect.fn(function* (rootDir, name) {
    const workspaces = yield* resolveWorkspaceDirs(rootDir);
    return HashMap.get(workspaces, name);
  })
);

/**
 * A resolved workspace package: its absolute directory, decoded manifest, and a
 * flattened scripts record.
 *
 * @remarks
 * `scripts` is the manifest's `scripts` field unwrapped to a plain record (empty
 * when the manifest declares no scripts), provided as a convenience so callers
 * need not re-open the `Option` on `manifest.scripts`.
 * @example
 * ```ts
 * import * as R from "effect/Record"
 * import type { WorkspacePackage } from "@beep/repo-utils/Workspaces"
 *
 * const hasCheckScript = (workspace: WorkspacePackage): boolean =>
 *   R.has(workspace.scripts, "check")
 * console.log(hasCheckScript)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorkspacePackage extends S.Class<WorkspacePackage>($I`WorkspacePackage`)(
  {
    dir: S.String.annotateKey({ description: "Absolute, canonical directory of the workspace package." }),
    manifest: S.instanceOf(PackageJson).annotateKey({ description: "The package's strictly decoded manifest." }),
    scripts: S.Record(S.String, S.String).annotateKey({
      description: "The manifest's scripts field flattened to a plain record.",
    }),
  },
  $I.annote("WorkspacePackage", {
    description:
      "A resolved workspace package: its absolute directory, strictly decoded manifest, and flattened scripts record.",
  })
) {}

/**
 * Resolve every workspace package declared by the root `package.json` into a map
 * from package name to its directory, decoded manifest, and scripts.
 *
 * @remarks
 * A superset of {@link resolveWorkspaceDirs} that additionally reads and decodes
 * each package's manifest via {@link readPackageJsonFile}. Directories without a
 * `package.json` are already excluded by {@link resolveWorkspaceDirs}, so every
 * entry carries a valid manifest. Fails with {@link DomainError} for unsafe or
 * escaping workspace globs, and with `S.SchemaError` when a manifest is malformed.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as HashMap from "effect/HashMap"
 * import { resolveWorkspacePackages } from "@beep/repo-utils/Workspaces"
 *
 * const program = resolveWorkspacePackages(".")
 * const count = Effect.map(program, HashMap.size)
 * console.log(count)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const resolveWorkspacePackages: (
  rootDir: string
) => Effect.Effect<
  HashMap.HashMap<string, WorkspacePackage>,
  NoSuchFileError | DomainError | S.SchemaError,
  FsUtils | FileSystem.FileSystem
> = Effect.fn(function* (rootDir) {
  const dirs = yield* resolveWorkspaceDirs(rootDir);
  let result = HashMap.empty<string, WorkspacePackage>();

  for (const [name, dir] of dirs) {
    const manifest = yield* readPackageJsonFile(`${dir}/package.json`);
    const scripts = O.getOrElse(manifest.scripts, (): Record<string, string> => ({}));
    result = HashMap.set(result, name, WorkspacePackage.make({ dir, manifest, scripts }));
  }

  return result;
});
