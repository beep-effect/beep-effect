/**
 * Workspace package discovery and docgen.json resolution for the Docgen group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { DomainError, FsUtils, findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import {
  CanonicalDocgenConfigInput,
  createCanonicalDocgenConfig,
  toCanonicalDocgenConfigJson,
} from "@beep/repo-utils/schemas/DocgenConfig";
import { A, Str, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, HashMap, MutableHashSet, Order, Path } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { byRelativePathAscending, DocgenConfigDocument, DocgenWorkspacePackage } from "../Docgen.schemas.ts";
import type { NoSuchFileError } from "@beep/repo-utils";
import type { DocgenPackageStatus, ResolveDocgenWorkspacePackageOptions } from "../Docgen.schemas.ts";

const DOCGEN_CONFIG_FILENAME = "docgen.json" as const;

const DOCS_MODULES_SEGMENTS = ["docs", "modules"] as const;

const DOCGEN_CONFIG_SCAN_GLOBS = ["apps/**/docgen.json", "packages/**/docgen.json", "infra/docgen.json"] as const;
const DOCGEN_CONFIG_SCAN_IGNORES = [
  "**/.git/**",
  "**/.turbo/**",
  "**/build/**",
  "**/coverage/**",
  "**/dist/**",
  "**/docs/**",
  "**/node_modules/**",
  "**/test/fixtures/**",
] as const;

const isResolveDocgenWorkspacePackageDataFirst = (args: IArguments): boolean =>
  (args.length === 1 && P.isString(args[0])) || args.length === 2;

const parseJsonText = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));

const decodeDocgenConfigDocument = S.decodeUnknownEffect(DocgenConfigDocument);

const normalizeSlashes = Str.replace(/\\/g, "/");

const readUnknownJsonFile = Effect.fn("DocgenOperations.readUnknownJsonFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${filePath}"`)));
  const parsed = yield* parseJsonText(content).pipe(
    Effect.mapError(DomainError.newCause(`Invalid JSON in "${filePath}"`))
  );
  return parsed;
});

const formatOrphanDocgenConfigMessage = (paths: ReadonlyArray<string>): string =>
  `Found docgen.json file(s) outside current workspaces: ${A.join(paths, ", ")}. Remove stale package dirs or add them back to root workspaces before running docgen.`;

/**
 * Discover package-local docgen configs that do not belong to a current workspace.
 *
 * @param rootDir - Optional repo root override.
 * @returns Repo-relative orphaned `docgen.json` paths sorted for stable diagnostics.
 * **Example** (List orphaned docgen configs)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { discoverOrphanDocgenConfigPaths } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 *
 * const program = discoverOrphanDocgenConfigPaths().pipe(
 *   Effect.map((paths) => paths.length)
 * )
 *
 * console.log(program) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const discoverOrphanDocgenConfigPaths: (
  rootDir?: string
) => Effect.Effect<ReadonlyArray<string>, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils> =
  Effect.fn("DocgenOperations.discoverOrphanDocgenConfigPaths")(function* (rootDir?: string) {
    const fs = yield* FileSystem.FileSystem;
    const fsUtils = yield* FsUtils;
    const path = yield* Path.Path;
    const repoRoot = rootDir ?? (yield* findRepoRoot());
    const workspaceDirs = yield* resolveWorkspaceDirs(repoRoot);
    const canonicalWorkspaceDirs = MutableHashSet.empty<string>();

    for (const [, absolutePath] of workspaceDirs) {
      MutableHashSet.add(canonicalWorkspaceDirs, normalizeSlashes(absolutePath));
    }

    const configPaths = yield* fsUtils.globFiles(DOCGEN_CONFIG_SCAN_GLOBS, {
      cwd: repoRoot,
      absolute: true,
      ignore: DOCGEN_CONFIG_SCAN_IGNORES,
    });
    const orphanedPaths = A.empty<string>();

    for (const configPath of configPaths) {
      const configDir = path.dirname(configPath);
      const canonicalConfigDir = yield* fs
        .realPath(configDir)
        .pipe(Effect.mapError(DomainError.newCause(`Failed to resolve docgen config directory "${configDir}"`)));

      if (MutableHashSet.has(canonicalWorkspaceDirs, normalizeSlashes(canonicalConfigDir))) {
        continue;
      }

      A.appendInPlace(orphanedPaths, normalizeSlashes(path.relative(repoRoot, configPath)));
    }

    return A.sort(orphanedPaths, Order.String);
  });

/**
 * Fail when stale package-local docgen configs exist outside current workspaces.
 *
 * @param rootDir - Optional repo root override.
 * @returns Void when every discovered `docgen.json` belongs to a current workspace.
 * **Example** (Assert there are no orphaned configs)
 *
 * ```ts
 * import { assertNoOrphanDocgenConfigPaths } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 *
 * const program = assertNoOrphanDocgenConfigPaths()
 *
 * console.log(program) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const assertNoOrphanDocgenConfigPaths: (
  rootDir?: string
) => Effect.Effect<void, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils> = Effect.fn(
  "DocgenOperations.assertNoOrphanDocgenConfigPaths"
)(function* (rootDir?: string) {
  const orphanedPaths = yield* discoverOrphanDocgenConfigPaths(rootDir);

  if (A.isReadonlyArrayNonEmpty(orphanedPaths)) {
    return yield* DomainError.make({
      message: formatOrphanDocgenConfigMessage(orphanedPaths),
    });
  }
});

const packageHasDocgenConfig = Effect.fn("DocgenOperations.packageHasDocgenConfig")(function* (
  absolutePackagePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .exists(path.join(absolutePackagePath, DOCGEN_CONFIG_FILENAME))
    .pipe(Effect.orElseSucceed(thunkFalse));
});

const packageHasGeneratedDocs = Effect.fn("DocgenOperations.packageHasGeneratedDocs")(function* (
  absolutePackagePath: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs
    .exists(path.join(absolutePackagePath, ...DOCS_MODULES_SEGMENTS))
    .pipe(Effect.orElseSucceed(thunkFalse));
});

const computePackageStatus = (hasDocgenConfig: boolean, hasGeneratedDocs: boolean): DocgenPackageStatus => {
  if (hasDocgenConfig && hasGeneratedDocs) {
    return "configured-and-generated";
  }
  if (hasDocgenConfig) {
    return "configured-not-generated";
  }
  return "not-configured";
};

/**
 * Convert a workspace package path into its aggregate docs output path.
 *
 * @param relativePath - Workspace-relative package path.
 * @returns Slash-normalized aggregate docs output path without package-root prefixes.
 * **Example** (Normalize a docs output path)
 *
 * ```ts
 * import { normalizeDocsOutputPath } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 *
 * console.log(normalizeDocsOutputPath("packages/tooling/tool/cli"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const normalizeDocsOutputPath = (relativePath: string): string =>
  Str.replace(/^(packages|tooling|apps)\//, "")(normalizeSlashes(relativePath));

/**
 * Load a package-local `docgen.json` document.
 *
 * @param absolutePackagePath - Absolute package path containing the `docgen.json` file to decode.
 * @returns Parsed current-schema docgen configuration.
 * **Example** (Load a docgen config)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { loadDocgenConfigDocument } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 * const program = loadDocgenConfigDocument("/repo/packages/tooling/tool/cli")
 * console.log(Effect.isEffect(program))
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const loadDocgenConfigDocument: (
  absolutePackagePath: string
) => Effect.Effect<DocgenConfigDocument, DomainError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "DocgenOperations.loadDocgenConfigDocument"
)(function* (absolutePackagePath) {
  const path = yield* Path.Path;
  const configPath = path.join(absolutePackagePath, DOCGEN_CONFIG_FILENAME);
  const parsed = yield* readUnknownJsonFile(configPath);
  return yield* decodeDocgenConfigDocument(parsed).pipe(
    Effect.mapError(DomainError.newCauseMessage(`Invalid JSON shape in "${configPath}"`))
  );
});

/**
 * Build the repo-standard `docgen.json` document for a package.
 *
 * @param targetPackage - Target workspace package.
 * @param rootDir - Absolute repo root.
 * @returns Bootstrapped docgen config using current repo defaults plus dependency-aware paths.
 * **Example** (Create a docgen config)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { createDocgenConfigDocument } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 * import { DocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/Docgen.schemas"
 * const target = DocgenWorkspacePackage.make({
 *   name: "@beep/repo-cli",
 *   relativePath: "packages/tooling/tool/cli",
 *   absolutePath: "/repo/packages/tooling/tool/cli",
 *   docsOutputPath: "tooling/tool/cli",
 *   hasDocgenConfig: true,
 *   hasGeneratedDocs: true,
 *   status: "configured-and-generated"
 * })
 * const program = createDocgenConfigDocument(target, "/repo")
 * console.log(Effect.isEffect(program))
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const createDocgenConfigDocument: {
  (
    targetPackage: DocgenWorkspacePackage,
    rootDir: string
  ): Effect.Effect<DocgenConfigDocument, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils>;
  (
    rootDir: string
  ): (
    targetPackage: DocgenWorkspacePackage
  ) => Effect.Effect<DocgenConfigDocument, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils>;
} = dual(
  2,
  Effect.fn("DocgenOperations.createDocgenConfigDocument")(function* (targetPackage, rootDir) {
    const canonicalConfig = yield* createCanonicalDocgenConfig(
      CanonicalDocgenConfigInput.make({
        rootDir,
        packageAbsolutePath: targetPackage.absolutePath,
        packageRelativePath: targetPackage.relativePath,
        packageName: targetPackage.name,
      })
    );
    const canonicalConfigJson = toCanonicalDocgenConfigJson(canonicalConfig);

    return DocgenConfigDocument.make({
      srcDir: "src",
      outDir: "docs",
      ...canonicalConfigJson,
    });
  })
);

/**
 * Discover all workspace packages relevant to docgen.
 *
 * @param rootDir - Optional repo root override.
 * @returns Sorted workspace package descriptors with current docgen status.
 * **Example** (Discover docgen workspaces)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { discoverDocgenWorkspacePackages } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 * const program = discoverDocgenWorkspacePackages().pipe(
 *   Effect.map((packages) => packages.map((pkg) => pkg.relativePath))
 * )
 * console.log(Effect.isEffect(program))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const discoverDocgenWorkspacePackages: (
  rootDir?: string
) => Effect.Effect<
  ReadonlyArray<DocgenWorkspacePackage>,
  DomainError | NoSuchFileError,
  FileSystem.FileSystem | Path.Path | FsUtils
> = Effect.fn("DocgenOperations.discoverDocgenWorkspacePackages")(function* (rootDir?: string) {
  const path = yield* Path.Path;
  const repoRoot = rootDir ?? (yield* findRepoRoot());
  const workspaceDirs = yield* resolveWorkspaceDirs(repoRoot);
  const packages = yield* Effect.forEach(
    HashMap.toEntries(workspaceDirs),
    Effect.fnUntraced(function* ([name, absolutePath]) {
      const relativePath = normalizeSlashes(path.relative(repoRoot, absolutePath));
      const hasDocgenConfig = yield* packageHasDocgenConfig(absolutePath);
      const hasGeneratedDocs = yield* packageHasGeneratedDocs(absolutePath);

      return DocgenWorkspacePackage.make({
        name,
        relativePath,
        absolutePath,
        docsOutputPath: normalizeDocsOutputPath(relativePath),
        hasDocgenConfig,
        hasGeneratedDocs,
        status: computePackageStatus(hasDocgenConfig, hasGeneratedDocs),
      });
    }),
    { concurrency: "unbounded" }
  );

  return A.sort(packages, byRelativePathAscending);
});

/**
 * Resolve a workspace package by package name, repo-relative path, absolute path, or current docs output path.
 *
 * @param selector - Package selector supplied by the CLI.
 * @param options - Optional repo root override.
 * @returns Resolved workspace package descriptor.
 * **Example** (Resolve a workspace package)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { resolveDocgenWorkspacePackage } from "@beep/repo-cli/commands/Docgen/internal/Workspace"
 * const program = resolveDocgenWorkspacePackage("@beep/repo-cli").pipe(
 *   Effect.map((pkg) => pkg.docsOutputPath)
 * )
 * console.log(Effect.isEffect(program))
 * ```
 * @category queries
 * @since 0.0.0
 */
export const resolveDocgenWorkspacePackage: {
  (
    options?: ResolveDocgenWorkspacePackageOptions
  ): (
    selector: string
  ) => Effect.Effect<
    DocgenWorkspacePackage,
    DomainError | NoSuchFileError,
    FileSystem.FileSystem | Path.Path | FsUtils
  >;
  (
    selector: string,
    options?: ResolveDocgenWorkspacePackageOptions
  ): Effect.Effect<DocgenWorkspacePackage, DomainError | NoSuchFileError, FileSystem.FileSystem | Path.Path | FsUtils>;
} = dual(
  isResolveDocgenWorkspacePackageDataFirst,
  Effect.fn("DocgenOperations.resolveDocgenWorkspacePackage")(function* (
    selector: string,
    options?: ResolveDocgenWorkspacePackageOptions
  ) {
    const path = yield* Path.Path;
    const repoRoot = options?.rootDir ?? (yield* findRepoRoot());
    const normalizedSelector = normalizeSlashes(selector);
    const absoluteSelector = path.isAbsolute(selector) ? path.normalize(selector) : path.resolve(repoRoot, selector);
    const packages = yield* discoverDocgenWorkspacePackages(repoRoot);
    const match = A.findFirst(
      packages,
      (pkg) =>
        pkg.name === normalizedSelector ||
        pkg.relativePath === normalizedSelector ||
        pkg.docsOutputPath === normalizedSelector ||
        path.normalize(pkg.absolutePath) === absoluteSelector
    );

    return yield* O.match(match, {
      onNone: () =>
        DomainError.make({
          message: `Could not resolve workspace package "${selector}". Use a package name like "@beep/schema" or a repo-relative path like "packages/foundation/modeling/schema".`,
        }),
      onSome: Effect.succeed,
    });
  })
);
