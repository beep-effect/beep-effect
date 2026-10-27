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
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { DomainError } from "./errors/index.ts";
import { FsUtils, GlobOptions } from "./FsUtils.ts";
import { decodePackageJsonEffect, PackageJson, readPackageJsonFile } from "./schemas/PackageJson.ts";
import type { WorkspacesField } from "@beep/package-json/ManifestFields";
import type * as FileSystem from "effect/FileSystem";
import type { NoSuchFileError } from "./errors/index.ts";
import type { FsUtilsShape } from "./FsUtils.ts";

const $I = $RepoUtilsId.create("Workspaces");

/**
 * Directories to exclude when scanning workspace globs.
 *
 * @category configuration
 * @since 0.0.0
 */
const IGNORED_DIRS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "**/.turbo/**"];
const absoluteWorkspacePattern = /^(?:[A-Za-z]:\/|\/\/|\/)/;

const workspaceManifestPattern = (workspaceGlob: string): string =>
  `${Str.replace(/\/+$/, "")(workspaceGlob)}/package.json`;

const isWorkspacePatternArray = (value: WorkspacesField): value is ReadonlyArray<string> => A.isArray(value);

/**
 * Extract the workspace glob patterns declared in a `package.json` `workspaces`
 * field, normalizing the array and object forms to a flat pattern list.
 *
 * **Details**
 *
 * Returns an empty array when `workspaces` is absent. The object form
 * contributes its `packages` entry (or nothing when it is absent); the array
 * form is returned as-is.
 *
 * **Example** (Extract workspace glob patterns)
 *
 * ```ts
 * import { workspaceGlobsFrom } from "@beep/repo-utils/Workspaces"
 *
 * const globs = workspaceGlobsFrom(["packages/*", "apps/*"])
 * console.log(globs) // ["packages/*", "apps/*"]
 * ```
 *
 * @param workspaces - The decoded `package.json` `workspaces` field, either the
 *   array form, the `{ packages }` object form, or `undefined` when the
 *   manifest declares no workspaces.
 * @returns The flat list of workspace glob patterns, empty when none are declared.
 * @category utilities
 * @since 0.0.0
 */
export const workspaceGlobsFrom = (workspaces: WorkspacesField | undefined): ReadonlyArray<string> => {
  if (P.isUndefined(workspaces)) {
    return [];
  }

  return isWorkspacePatternArray(workspaces) ? workspaces : (workspaces.packages ?? A.empty());
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

// The root manifest's workspace globs, each checked to stay inside the repository root.
const readWorkspaceGlobs = Effect.fnUntraced(function* (fsUtils: FsUtilsShape, rootDir: string) {
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
  const unsafe = A.findFirst(workspaceGlobs, (workspaceGlob) => !isSafeWorkspacePattern(workspaceGlob));
  if (O.isSome(unsafe)) {
    return yield* DomainError.make({
      message: `Unsafe workspace glob "${unsafe.value}" escapes the repository root.`,
    });
  }
  return workspaceGlobs;
});

// One workspace manifest's package name and canonical directory, or None when the manifest vanished.
const readWorkspaceEntry = Effect.fnUntraced(function* (
  fsUtils: FsUtilsShape,
  canonicalRootDir: string,
  manifest: string
) {
  const dir = yield* fsUtils.getParentDirectory(manifest);
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
    return O.none<readonly [string, string]>();
  }
  if (O.isNone(rawChildPkg)) {
    return yield* DomainError.make({
      message: `Failed to parse JSON at "${pkgJsonPath}"`,
    });
  }

  const childPkg = yield* decodePackageJsonEffect(rawChildPkg.value).pipe(
    Effect.mapError(DomainError.newCause(`Failed to decode package.json at "${pkgJsonPath}"`))
  );
  return O.some<readonly [string, string]>([childPkg.name, canonicalDir]);
});

/**
 * Resolve all workspace directories declared in the root `package.json`.
 *
 * **Details**
 *
 * Reads the `workspaces` array from the root `package.json`, expands each
 * glob pattern to the `package.json` manifests beneath it (following
 * symlinked workspace directories), reads each manifest to extract
 * the package name, and returns a `HashMap<PackageName, AbsoluteDirectory>`.
 *
 * **Example** (Resolve root workspace directories)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import { resolveWorkspaceDirs } from "@beep/repo-utils/Workspaces"
 *
 * const program = resolveWorkspaceDirs(".")
 * console.log(program)
 * ```
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @returns A HashMap mapping package names to their absolute directory paths.
 * @category utilities
 * @since 0.0.0
 */
export const resolveWorkspaceDirs: (
  rootDir: string
) => Effect.Effect<HashMap.HashMap<string, string>, NoSuchFileError | DomainError, FsUtils> = Effect.fn(
  function* (rootDir) {
    const fsUtils = yield* FsUtils;
    const workspaceGlobs = yield* readWorkspaceGlobs(fsUtils, rootDir);
    if (A.isReadonlyArrayEmpty(workspaceGlobs)) {
      return HashMap.empty<string, string>();
    }

    const canonicalRootDir = yield* fsUtils
      .realPath(rootDir)
      .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve repository root "${rootDir}"`)));

    // Expand each workspace glob to the manifests beneath it. Symlinked workspace
    // directories are followed, and a directory without a manifest never matches.
    const manifests = yield* fsUtils.globFiles(
      A.map(workspaceGlobs, workspaceManifestPattern),
      GlobOptions.make({
        cwd: rootDir,
        absolute: true,
        followSymlinks: true,
        ignore: IGNORED_DIRS,
      })
    );

    const entries = yield* Effect.forEach(manifests, (manifest) =>
      readWorkspaceEntry(fsUtils, canonicalRootDir, manifest)
    );
    return HashMap.fromIterable(A.getSomes(entries));
  }
);

/**
 * Look up the absolute directory for a single workspace by package name.
 *
 * **Details**
 *
 * Resolves all workspaces and returns the path for the given name,
 * or `None` if the workspace is not found.
 *
 * **Example** (Look up package directory)
 *
 * ```typescript
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option"
 * import { getWorkspaceDir } from "@beep/repo-utils/Workspaces"
 *
 * const program = getWorkspaceDir(".", "@beep/repo-utils")
 * console.log(program)
 * ```
 *
 * @param rootDir - Absolute path to the monorepo root directory.
 * @param name - The package name to look up.
 * @returns An Option containing the absolute directory path, or None.
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
 * A resolved workspace package: its absolute directory and decoded manifest.
 *
 * **Details**
 *
 * The manifest's `scripts` field is already a `HashMap` that defaults to
 * empty, so callers read `manifest.scripts` directly.
 *
 * **Example** (Check workspace has script)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import type { WorkspacePackage } from "@beep/repo-utils/Workspaces"
 *
 * const hasCheckScript = (workspace: WorkspacePackage): boolean =>
 *   HashMap.has(workspace.manifest.scripts, "check")
 * console.log(hasCheckScript)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkspacePackage extends S.Opaque<WorkspacePackage, { readonly brand: unique symbol }>()(
  S.Struct({
    dir: S.String.annotateKey({ description: "Absolute, canonical directory of the workspace package." }),
    manifest: S.instanceOf(PackageJson).annotateKey({ description: "The package's strictly decoded manifest." }),
  }).pipe(
    $I.annoteSchema("WorkspacePackage", {
      description: "A resolved workspace package: its absolute directory and strictly decoded manifest.",
    })
  )
) {}

/**
 * Resolve every workspace package declared by the root `package.json` into a map
 * from package name to its directory and decoded manifest.
 *
 * **Details**
 *
 * A superset of {@link resolveWorkspaceDirs} that additionally reads and decodes
 * each package's manifest via {@link readPackageJsonFile}. Directories without a
 * `package.json` are already excluded by {@link resolveWorkspaceDirs}, so every
 * entry carries a valid manifest. Fails with {@link DomainError} for unsafe or
 * escaping workspace globs, and with `S.SchemaError` when a manifest is malformed.
 *
 * **Example** (Count resolved workspace packages)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as HashMap from "effect/HashMap"
 * import { resolveWorkspacePackages } from "@beep/repo-utils/Workspaces"
 *
 * const program = resolveWorkspacePackages(".")
 * const count = Effect.map(program, HashMap.size)
 * console.log(count)
 * ```
 *
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
    result = HashMap.set(result, name, WorkspacePackage.make({ dir, manifest }));
  }

  return result;
});
