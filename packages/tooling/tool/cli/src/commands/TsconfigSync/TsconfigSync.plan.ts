/**
 * Planning logic for tsconfig-sync managed file changes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  collectTsConfigPaths,
  DomainError,
  decodePackageJsonEffect,
  resolveWorkspaceDirs,
  topologicalSort,
} from "@beep/repo-utils";
import { renderBiomeJson } from "@beep/repo-utils/schemas/BiomeJson";
import {
  CanonicalDocgenConfigInput,
  createCanonicalDocgenConfig,
  mergeManagedDocgenConfig,
} from "@beep/repo-utils/schemas/DocgenConfig";
import {
  buildCanonicalAliasTargets,
  deriveWildcardAliasTargetFromExport,
  isFileStemWildcardExportTarget,
  resolveRootExportTarget,
  resolveSubpathExportTarget,
  resolveWildcardExportTarget,
} from "@beep/repo-utils/schemas/TsconfigAliasTargets";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse, thunkUndefined } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect, FileSystem, flow, HashMap, HashSet, Path, pipe } from "effect";
import { constTrue } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { applyJsoncModification as applySharedJsoncModification, decodeJsoncTextAs } from "../../internal/cli/Jsonc.ts";
import { TsconfigSyncFilterError } from "./TsconfigSync.errors.ts";
import {
  byPlannedChangeAscending,
  byStringAscending,
  byWorkspaceRelativeDirAscending,
  DOCGEN_CONFIG_FILENAME,
  isBeepScopedPackageName,
  isCanonicalAliasKey,
  isRootDepIndexKey,
  JsonObject,
  PlannedFileChange,
  stringArrayEquivalence,
  TsconfigSyncChange,
  TsconfigSyncSchemaInternals,
  TsconfigWithPaths,
  TsconfigWithReferences,
  WorkspaceDescriptor,
} from "./TsconfigSync.schemas.ts";
import type { WorkspaceDeps } from "@beep/repo-utils";

const toPosixPath = normalizePath;

const uniqueSorted: (values: ReadonlyArray<string>) => ReadonlyArray<string> = flow(
  HashSet.fromIterable,
  A.fromIterable,
  A.sort(byStringAscending)
);

const arraysEqual = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  stringArrayEquivalence(left, right);

const referenceEntries = (paths: ReadonlyArray<string>): ReadonlyArray<{ readonly path: string }> =>
  A.map(paths, (entry) => ({ path: entry }));

const dependencyNamesFromWorkspaceDeps = (workspaceDeps: WorkspaceDeps): ReadonlyArray<string> =>
  uniqueSorted([
    ...R.keys(workspaceDeps.workspace.dependencies),
    ...R.keys(workspaceDeps.workspace.devDependencies),
    ...R.keys(workspaceDeps.workspace.peerDependencies),
    ...R.keys(workspaceDeps.workspace.optionalDependencies),
  ]);

const parseJsonc = Effect.fn(function* <Schema extends S.Top>(content: string, filePath: string, schema: Schema) {
  return yield* decodeJsoncTextAs(schema)(content).pipe(
    Effect.mapError(DomainError.newCauseMessage(`Failed to parse JSONC in "${filePath}"`))
  );
});

const parseJsonObject = Effect.fn(function* (content: string, filePath: string) {
  return yield* S.decodeEffect(S.fromJsonString(JsonObject))(content).pipe(
    Effect.mapError(DomainError.newCause(`Failed to parse JSON in "${filePath}"`))
  );
});

const renderDocgenJson = Effect.fn(function* (filePath: string, value: unknown) {
  return yield* renderBiomeJson(filePath, value);
});

const readRootPackageJson = Effect.fn(function* (rootDir: string) {
  const path = yield* Path.Path;
  const filePath = path.join(rootDir, "package.json");
  const content = yield* readFileString(filePath);
  const parsed = yield* parseJsonObject(content, filePath);
  const packageJson = yield* decodePackageJsonEffect(parsed).pipe(
    Effect.mapError(DomainError.newCause(`Failed to decode package.json at "${filePath}"`))
  );

  return {
    filePath,
    content,
    packageJson,
  } as const;
});

const readFileString = Effect.fn(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read file "${filePath}"`)));
});

/**
 * Write a generated config file with DomainError context.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { writeFileString } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect } from "effect"
 *
 * // Writes file content; provide FileSystem to run the effect.
 * const program = writeFileString("/repo/tsconfig.json", "{}\n")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
// fallow-ignore-next-line code-duplication -- config-updater helper twins converged after the tstyche removal + JSDoc grammar migration; consolidation onto @beep/repo-utils is a recorded quality-speedup follow-up
const writeFileString = Effect.fn(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(filePath, content)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to write file "${filePath}"`)));
});

const applyJsoncModification = (
  content: string,
  path: ReadonlyArray<string | number>,
  value: unknown,
  options?: { readonly isArrayInsertion?: boolean }
): string =>
  applySharedJsoncModification({
    content,
    path,
    value,
    ...(options?.isArrayInsertion === true ? { isArrayInsertion: true } : {}),
  });

/**
 * Render a file path relative to the repository root.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { relativeFromRoot } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   return relativeFromRoot("/repo", "/repo/packages/schema/tsconfig.json", path)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param rootDir - Absolute repository root the path is made relative to.
 * @param filePath - Absolute file path to render relative to the root.
 * @param path - Effect `Path` service used to compute the relative path.
 * @returns The POSIX-normalized path of `filePath` relative to `rootDir`.
 * @category utilities
 * @since 0.0.0
 */
const relativeFromRoot = (rootDir: string, filePath: string, path: Path.Path): string =>
  toPosixPath(path.relative(rootDir, filePath));

const normalizeRelativeRef = (sourceDir: string, targetPath: string, path: Path.Path): string =>
  toPosixPath(path.relative(sourceDir, targetPath));

// fallow-ignore-next-line code-duplication -- converged with CreatePackage's twin after the tstyche removal; consolidation onto @beep/repo-utils workspaceGlobsFrom/readPackageJsonFile is a recorded quality-speedup follow-up
const workspacePatternsFromPackageJson = (
  workspaces: O.Option<ReadonlyArray<string> | { readonly packages?: ReadonlyArray<string> }>
): ReadonlyArray<string> => {
  if (O.isNone(workspaces)) {
    return A.empty();
  }

  const value: unknown = workspaces.value;
  if (A.isArray(value) && A.every(value, P.isString)) {
    return value;
  }

  if (
    P.isObject(value) &&
    P.hasProperty(value, "packages") &&
    A.isArray(value.packages) &&
    A.every(value.packages, P.isString)
  ) {
    return value.packages;
  }

  return A.empty();
};

const SYNCPACK_SOURCE_ARRAY_PATTERN = /source:\s*\[(?<body>[\s\S]*?)\],/m;
const SYNC_SOURCE_ENTRY_PATTERN = /"([^"]+)"/g;

const readSyncpackSources = (content: string): Effect.Effect<ReadonlyArray<string>, DomainError> => {
  const match = SYNCPACK_SOURCE_ARRAY_PATTERN.exec(content);
  if (match === null) {
    return Effect.fail(DomainError.make({ message: "Failed to read syncpack source array: source array not found" }));
  }

  return Effect.succeed(
    pipe(
      [...Str.matchAll(SYNC_SOURCE_ENTRY_PATTERN)(match.groups?.body ?? "")],
      A.map((entry) => entry[1] ?? "")
    )
  );
};

const renderSyncpackSourcesBlock = (sources: ReadonlyArray<string>): string =>
  `source: [\n${pipe(
    sources,
    A.map((source) => `    "${source}",`),
    A.join("\n")
  )}\n  ],`;

const replaceSyncpackSources = (content: string, sources: ReadonlyArray<string>): Effect.Effect<string, DomainError> =>
  SYNCPACK_SOURCE_ARRAY_PATTERN.test(content)
    ? Effect.succeed(Str.replace(SYNCPACK_SOURCE_ARRAY_PATTERN, renderSyncpackSourcesBlock(sources))(content))
    : Effect.fail(DomainError.make({ message: "Failed to replace syncpack source array: source array not found" }));

const buildCanonicalSyncpackSources = (workspacePatterns: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.dedupe(["package.json", ...A.map(workspacePatterns, (pattern) => `${pattern}/package.json`)]);

const chooseOwnerTsconfig = (paths: ReadonlyArray<string>): string | undefined => {
  const normalized = A.map(paths, toPosixPath);
  const buildPath = A.findFirst(normalized, Str.endsWith("/tsconfig.build.json"));
  if (O.isSome(buildPath)) {
    return buildPath.value;
  }

  const packageTsconfigPath = A.findFirst(normalized, Str.endsWith("/tsconfig.json"));
  if (O.isSome(packageTsconfigPath)) {
    return packageTsconfigPath.value;
  }

  return undefined;
};

const workspaceContainsPath = (workspace: WorkspaceDescriptor, targetPath: string): boolean => {
  const workspaceDir = toPosixPath(workspace.absoluteDir);
  const normalizedTarget = toPosixPath(targetPath);
  return Str.equivalence(normalizedTarget, workspaceDir) || Str.startsWith(`${workspaceDir}/`)(normalizedTarget);
};

/**
 * Discover workspace descriptors used by tsconfig-sync planners.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { buildWorkspaceDescriptors } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect } from "effect"
 *
 * // Scans the repo for workspace descriptors; provide FileSystem/Path to run it.
 * const program = buildWorkspaceDescriptors("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const buildWorkspaceDescriptors = Effect.fn(function* (rootDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const workspaceDirs = yield* resolveWorkspaceDirs(rootDir);
  const tsconfigPathsByPackage = yield* collectTsConfigPaths(rootDir);

  const descriptors = A.empty<WorkspaceDescriptor>();

  for (const [packageName, absoluteDir] of workspaceDirs) {
    const tsconfigPaths = O.getOrElse(HashMap.get(tsconfigPathsByPackage, packageName), A.empty<string>);

    const ownerTsconfigPath = chooseOwnerTsconfig(tsconfigPaths);
    const hasProjectTsconfig = A.some(tsconfigPaths, (entry) => Str.endsWith("/tsconfig.json")(toPosixPath(entry)));
    const relativeDir = toPosixPath(path.relative(rootDir, absoluteDir));
    const packageJsonPath = path.join(absoluteDir, "package.json");
    const packageJsonContent = yield* readFileString(packageJsonPath);
    const packageJson = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(packageJsonContent).pipe(
      Effect.mapError(DomainError.newCause(`Failed to parse JSON in "${packageJsonPath}"`)),
      Effect.flatMap(
        Effect.fnUntraced(function* (parsed) {
          return yield* decodePackageJsonEffect(parsed).pipe(
            Effect.mapError(DomainError.newCause(`Failed to decode package.json at "${packageJsonPath}"`))
          );
        })
      )
    );
    const hasDocgenConfig = yield* fs
      .exists(path.join(absoluteDir, DOCGEN_CONFIG_FILENAME))
      .pipe(Effect.orElseSucceed(thunkFalse));
    const aliasTargets = pipe(
      packageJson.exports,
      O.flatMap(resolveRootExportTarget),
      O.map((rootExportTarget) => buildCanonicalAliasTargets(relativeDir, rootExportTarget))
    );
    const wildcardExportTarget = pipe(packageJson.exports, O.flatMap(resolveWildcardExportTarget));
    const packageSubpathAliasTargets = buildPackageSubpathAliasTargets(
      packageName,
      relativeDir,
      O.getOrUndefined(packageJson.exports)
    );
    const scopedWildcardAliasTargets = buildScopedWildcardAliasTargets(
      packageName,
      relativeDir,
      O.getOrUndefined(packageJson.exports)
    );
    const sourceOnlySubpathAliasTargets = TsconfigSyncSchemaInternals.buildSourceOnlySubpathAliasTargets(
      packageName,
      relativeDir
    );
    const subpathAliasTargets = {
      ...packageSubpathAliasTargets,
      ...scopedWildcardAliasTargets,
      ...sourceOnlySubpathAliasTargets,
    };
    const rootAliasTargets = O.getOrUndefined(aliasTargets);
    const aliasTargetFields = {
      ...(P.isNotUndefined(rootAliasTargets)
        ? {
            rootAliasTarget: rootAliasTargets.rootAliasTarget,
            ...pipe(
              wildcardExportTarget,
              O.map((exportTarget) => ({
                wildcardAliasTarget: deriveWildcardAliasTargetFromExport(relativeDir, exportTarget),
              })),
              O.getOrElse(() => ({}))
            ),
          }
        : {}),
      ...(!R.isEmptyReadonlyRecord(subpathAliasTargets) ? { subpathAliasTargets } : {}),
    };

    A.appendInPlace(
      descriptors,
      WorkspaceDescriptor.make({
        packageName,
        absoluteDir,
        relativeDir,
        ownerTsconfigPath,
        hasProjectTsconfig,
        hasDocgenConfig,
        ...aliasTargetFields,
      })
    );
  }

  return A.sort(descriptors, byWorkspaceRelativeDirAscending);
});

/**
 * Build the workspace dependency adjacency map.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { buildAdjacency } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { HashMap } from "effect"
 *
 * // An empty dependency index yields an empty adjacency map.
 * console.log(HashMap.size(buildAdjacency(HashMap.empty()))) // 0
 * ```
 *
 * @param depIndex - Dependency index mapping each package to its workspace dependencies.
 * @returns An adjacency map from each package name to the set of packages it depends on.
 * @category utilities
 * @since 0.0.0
 */
const buildAdjacency = (
  depIndex: HashMap.HashMap<string, WorkspaceDeps>
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  let adjacency = HashMap.empty<string, HashSet.HashSet<string>>();

  for (const [packageName, deps] of depIndex) {
    if (isRootDepIndexKey(packageName)) {
      continue;
    }

    let depSet = HashSet.empty<string>();
    for (const depName of dependencyNamesFromWorkspaceDeps(deps)) {
      depSet = HashSet.add(depSet, depName);
    }

    adjacency = HashMap.set(adjacency, packageName, depSet);
  }

  return adjacency;
};

const summaryCounts = (
  currentItems: ReadonlyArray<string>,
  expectedItems: ReadonlyArray<string>,
  noun: string
): string => {
  const currentSet = HashSet.fromIterable(currentItems);
  const expectedSet = HashSet.fromIterable(expectedItems);

  const added = HashSet.size(HashSet.difference(expectedSet, currentSet));
  const removed = HashSet.size(HashSet.difference(currentSet, expectedSet));

  const reordered = added === 0 && removed === 0 && !arraysEqual(currentItems, expectedItems);

  return `${noun}: ${currentItems.length} -> ${expectedItems.length} (add ${added}, remove ${removed}${reordered ? ", reorder" : ""})`;
};

const compareReferencePathsInOrder = (parsed: TsconfigWithReferences): ReadonlyArray<string> =>
  pipe(
    parsed.references ?? A.empty(),
    A.flatMap((entry) => (P.isString(entry.path) ? A.make(entry.path) : A.empty<string>()))
  );

/**
 * Plan root tsconfig package-reference edits.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { planRootReferenceSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect } from "effect"
 *
 * const program = planRootReferenceSync("/repo", [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const planRootReferenceSync = Effect.fn(function* (rootDir: string, workspaces: ReadonlyArray<WorkspaceDescriptor>) {
  const path = yield* Path.Path;
  const filePath = path.join(rootDir, "tsconfig.packages.json");

  const original = yield* readFileString(filePath);
  const parsed = yield* parseJsonc(original, filePath, TsconfigWithReferences);

  const expected = uniqueSorted(
    pipe(
      workspaces,
      A.flatMap((workspace) => (workspace.hasProjectTsconfig ? A.make(workspace.relativeDir) : A.empty<string>()))
    )
  );

  const current = compareReferencePathsInOrder(parsed);
  if (arraysEqual(current, expected)) {
    return O.none<PlannedFileChange>();
  }

  const nextContent = applyJsoncModification(original, ["references"], referenceEntries(expected));

  return O.some(
    PlannedFileChange.cases["root-references"].make({
      filePath,
      summary: summaryCounts(current, expected, "references"),
      content: nextContent,
    })
  );
});

const isReadonlyUnknownRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) && !A.isArray(value);

const isConcretePackageSubpathExport = (exportKey: string): boolean =>
  Str.startsWith("./")(exportKey) && exportKey !== "./package.json" && !Str.includes("*")(exportKey);

const packageSubpathAlias = (packageName: string, exportKey: string): string =>
  `${packageName}/${Str.replace(/^\.\//, Str.empty)(exportKey)}`;

const sourceAliasTarget = (packageRelativePath: string, exportTarget: string): string =>
  `./${packageRelativePath}/${Str.replace(/^\.\//, Str.empty)(exportTarget)}`;

const buildAliasTargetsFromExports = (
  packageName: string,
  packageRelativePath: string,
  exportsField: unknown,
  includesExportKey: (exportKey: string) => boolean,
  includesExportTarget: (exportTarget: string) => boolean,
  deriveAliasTarget: (packageRelativePath: string, exportTarget: string) => string
): Readonly<Record<string, string>> => {
  if (!isReadonlyUnknownRecord(exportsField)) {
    return R.empty();
  }

  return pipe(
    exportsField,
    R.keys,
    A.filter(includesExportKey),
    A.flatMap((exportKey) =>
      O.match(pipe(resolveSubpathExportTarget(exportsField, exportKey), O.filter(includesExportTarget)), {
        onNone: () => [],
        onSome: (exportTarget) => [
          [packageSubpathAlias(packageName, exportKey), deriveAliasTarget(packageRelativePath, exportTarget)] as const,
        ],
      })
    ),
    R.fromEntries
  );
};

const buildPackageSubpathAliasTargets = (
  packageName: string,
  packageRelativePath: string,
  exportsField: unknown
): Readonly<Record<string, string>> =>
  buildAliasTargetsFromExports(
    packageName,
    packageRelativePath,
    exportsField,
    isConcretePackageSubpathExport,
    constTrue,
    sourceAliasTarget
  );

// Scoped wildcard export keys (`./<scope>/*`, single trailing star) with
// file-stem targets need their own aliases: the package-level `@beep/<pkg>/*`
// alias rewrites unconditionally in vitest, so without a longer scoped alias a
// flat-file scope like `./SchemaUtils/*` would rewrite through the package
// wildcard target and miss. Directory-shaped scoped targets are excluded —
// their alias would shadow sibling mid-star export keys (`./aggregates/*` +
// `/server`) that only package-exports resolution can serve.
const isScopedWildcardExportKey = (exportKey: string): boolean =>
  Str.startsWith("./")(exportKey) &&
  exportKey !== "./*" &&
  Str.endsWith("/*")(exportKey) &&
  !Str.includes("*")(Str.slice(0, Str.length(exportKey) - 2)(exportKey));

const buildScopedWildcardAliasTargets = (
  packageName: string,
  packageRelativePath: string,
  exportsField: unknown
): Readonly<Record<string, string>> =>
  buildAliasTargetsFromExports(
    packageName,
    packageRelativePath,
    exportsField,
    isScopedWildcardExportKey,
    isFileStemWildcardExportTarget,
    deriveWildcardAliasTargetFromExport
  );

const canonicalAliasEntriesForWorkspace = (
  workspace: WorkspaceDescriptor
): ReadonlyArray<readonly [string, ReadonlyArray<string>]> => {
  if (!isBeepScopedPackageName(workspace.packageName) || workspace.rootAliasTarget === undefined) {
    return A.empty();
  }

  return [
    [workspace.packageName, [workspace.rootAliasTarget]],
    ...(workspace.wildcardAliasTarget === undefined
      ? A.empty<readonly [string, ReadonlyArray<string>]>()
      : ([[`${workspace.packageName}/*`, [workspace.wildcardAliasTarget]]] as const)),
    ...pipe(
      workspace.subpathAliasTargets ?? R.empty(),
      R.toEntries,
      A.map(([aliasKey, aliasTarget]) => [aliasKey, [aliasTarget]] as const)
    ),
  ] as const;
};

const pathValuesEqual = (currentValue: unknown, expectedValue: ReadonlyArray<string>): boolean => {
  if (!A.isArray(currentValue)) {
    return false;
  }

  if (!A.every(currentValue, P.isString)) {
    return false;
  }

  return arraysEqual(currentValue, expectedValue);
};

/**
 * Plan root tsconfig path-alias edits.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { planRootAliasSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect } from "effect"
 *
 * const program = planRootAliasSync("/repo", [])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const planRootAliasSync = Effect.fn(function* (rootDir: string, workspaces: ReadonlyArray<WorkspaceDescriptor>) {
  const path = yield* Path.Path;
  const filePath = path.join(rootDir, "tsconfig.json");

  const original = yield* readFileString(filePath);
  const parsed = yield* parseJsonc(original, filePath, TsconfigWithPaths);

  const currentPaths = parsed.compilerOptions?.paths ?? {};

  let expectedAliases = HashMap.empty<string, ReadonlyArray<string>>();
  for (const workspace of workspaces) {
    for (const [aliasKey, aliasValue] of canonicalAliasEntriesForWorkspace(workspace)) {
      expectedAliases = HashMap.set(expectedAliases, aliasKey, aliasValue);
    }
  }

  const currentCanonicalKeys = uniqueSorted(A.filter(R.keys(currentPaths), isCanonicalAliasKey));
  const expectedCanonicalKeys = uniqueSorted([...HashMap.keys(expectedAliases)]);

  const keysToRemove = A.filter(currentCanonicalKeys, (key) => O.isNone(HashMap.get(expectedAliases, key)));
  const keysToSet = A.filter(expectedCanonicalKeys, (key) => {
    const expectedValue = HashMap.get(expectedAliases, key);
    if (O.isNone(expectedValue)) {
      return false;
    }
    return !pathValuesEqual(currentPaths[key], expectedValue.value);
  });

  if (A.isArrayEmpty(keysToRemove) && A.isArrayEmpty(keysToSet)) {
    return O.none<PlannedFileChange>();
  }

  let nextContent = original;
  for (const key of keysToRemove) {
    nextContent = applyJsoncModification(nextContent, ["compilerOptions", "paths", key], undefined);
  }
  for (const key of keysToSet) {
    const expectedValue = HashMap.get(expectedAliases, key);
    if (O.isNone(expectedValue)) {
      continue;
    }
    nextContent = applyJsoncModification(nextContent, ["compilerOptions", "paths", key], expectedValue.value);
  }

  const additions = A.length(
    A.filter(keysToSet, (key) => !A.some(currentCanonicalKeys, (current) => Str.equivalence(current, key)))
  );
  const updates = A.length(keysToSet) - additions;

  return O.some(
    PlannedFileChange.cases["root-aliases"].make({
      filePath,
      summary: `aliases: add ${additions}, update ${updates}, remove ${keysToRemove.length}`,
      content: nextContent,
    })
  );
});

/**
 * Plan root syncpack source-array edits.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { planRootSyncpackSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect } from "effect"
 *
 * const program = planRootSyncpackSync("/repo")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const planRootSyncpackSync = Effect.fn(function* (rootDir: string) {
  const path = yield* Path.Path;
  const { packageJson } = yield* readRootPackageJson(rootDir);
  const syncpackFilePath = path.join(rootDir, "syncpack.config.ts");
  const original = yield* readFileString(syncpackFilePath);
  const current = yield* readSyncpackSources(original);
  const workspacePatterns = workspacePatternsFromPackageJson(packageJson.workspaces);
  const expected = buildCanonicalSyncpackSources(workspacePatterns);

  if (arraysEqual(current, expected)) {
    return O.none<PlannedFileChange>();
  }

  const nextContent = yield* replaceSyncpackSources(original, expected);
  return O.some(
    PlannedFileChange.cases["root-syncpack"].make({
      filePath: syncpackFilePath,
      summary: summaryCounts(current, expected, "sources"),
      content: nextContent,
    })
  );
});

const buildSubsetAdjacency = (
  packageNames: ReadonlyArray<string>,
  adjacency: HashMap.HashMap<string, HashSet.HashSet<string>>
): HashMap.HashMap<string, HashSet.HashSet<string>> => {
  const packageSet = HashSet.fromIterable(packageNames);
  let subset = HashMap.empty<string, HashSet.HashSet<string>>();

  for (const packageName of packageNames) {
    const depsOption = HashMap.get(adjacency, packageName);

    const filteredDeps = O.match(depsOption, {
      onNone: () => HashSet.empty<string>(),
      onSome: (deps) => HashSet.intersection(packageSet, deps),
    });

    subset = HashMap.set(subset, packageName, filteredDeps);
  }

  return subset;
};

const resolveTargetWorkspacesForPackageSync = (
  workspaces: ReadonlyArray<WorkspaceDescriptor>,
  filter: string | undefined
): Effect.Effect<ReadonlyArray<WorkspaceDescriptor>, TsconfigSyncFilterError> => {
  const normalizedFilter = filter === undefined ? undefined : Str.replace(/^\.\//, "")(toPosixPath(filter));

  const targetWorkspaces = A.filter(workspaces, (workspace) => {
    if (workspace.ownerTsconfigPath === undefined) {
      return false;
    }

    if (normalizedFilter === undefined) {
      return true;
    }

    const packageNameMatchesFilter = O.match(O.fromUndefinedOr(filter), {
      onNone: thunkFalse,
      onSome: (filterValue) => Str.equivalence(workspace.packageName, filterValue),
    });

    return packageNameMatchesFilter || Str.equivalence(workspace.relativeDir, normalizedFilter);
  });

  if (filter !== undefined && A.isArrayEmpty(targetWorkspaces)) {
    return Effect.fail(TsconfigSyncFilterError.new(filter, `No workspace matched filter "${filter}"`));
  }

  return Effect.succeed(targetWorkspaces);
};

const canonicalizeExistingRefTarget = Effect.fn(function* (
  sourceWorkspace: WorkspaceDescriptor,
  sourceOwnerTsconfigPath: string,
  refPath: string,
  workspaces: ReadonlyArray<WorkspaceDescriptor>
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;

  const sourceDir = path.dirname(sourceOwnerTsconfigPath);
  const resolvedTarget = path.resolve(sourceDir, refPath);

  const exists = yield* fs.exists(resolvedTarget).pipe(Effect.orElseSucceed(thunkFalse));
  if (!exists) {
    return O.none<string>();
  }

  const ownerWorkspace = A.findFirst(workspaces, (workspace) =>
    Str.equivalence(workspace.packageName, sourceWorkspace.packageName)
  );

  const targetWorkspace = A.findFirst(workspaces, (workspace) => workspaceContainsPath(workspace, resolvedTarget));
  if (
    O.isSome(targetWorkspace) &&
    O.isSome(ownerWorkspace) &&
    !Str.equivalence(targetWorkspace.value.packageName, ownerWorkspace.value.packageName)
  ) {
    if (targetWorkspace.value.ownerTsconfigPath !== undefined) {
      return O.some(targetWorkspace.value.ownerTsconfigPath);
    }
  }

  const stat = yield* fs.stat(resolvedTarget).pipe(Effect.orElseSucceed(thunkUndefined));
  if (stat !== undefined && Str.equivalence(stat.type, "Directory")) {
    const nestedTsconfigPath = path.join(resolvedTarget, "tsconfig.json");
    const nestedTsconfigExists = yield* fs.exists(nestedTsconfigPath).pipe(Effect.orElseSucceed(thunkFalse));
    if (nestedTsconfigExists) {
      return O.some(nestedTsconfigPath);
    }
  }

  return O.some(resolvedTarget);
});

/**
 * Plan per-package tsconfig reference edits.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { planPackageReferenceSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect, HashMap } from "effect"
 *
 * const program = planPackageReferenceSync("/repo", [], HashMap.empty(), HashMap.empty())
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const planPackageReferenceSync = Effect.fn(function* (
  rootDir: string,
  workspaces: ReadonlyArray<WorkspaceDescriptor>,
  depIndex: HashMap.HashMap<string, WorkspaceDeps>,
  adjacency: HashMap.HashMap<string, HashSet.HashSet<string>>,
  filter: string | undefined,
  verbose: boolean
) {
  const path = yield* Path.Path;

  const workspaceByName = HashMap.fromIterable(
    A.map(workspaces, (workspace) => [workspace.packageName, workspace] as const)
  );
  const targetWorkspaces = yield* resolveTargetWorkspacesForPackageSync(workspaces, filter);

  const plannedChanges = A.empty<PlannedFileChange>();

  for (const workspace of targetWorkspaces) {
    if (workspace.ownerTsconfigPath === undefined) {
      continue;
    }

    const sourceOwnerTsconfigPath = workspace.ownerTsconfigPath;
    const sourceDir = path.dirname(sourceOwnerTsconfigPath);

    const workspaceDepsOption = HashMap.get(depIndex, workspace.packageName);
    if (O.isNone(workspaceDepsOption)) {
      continue;
    }

    const directDeps = A.filter(dependencyNamesFromWorkspaceDeps(workspaceDepsOption.value), (depName) => {
      const descriptor = HashMap.get(workspaceByName, depName);
      return O.isSome(descriptor) && descriptor.value.ownerTsconfigPath !== undefined;
    });

    const subsetAdjacency = buildSubsetAdjacency(directDeps, adjacency);
    const sortedDeps = yield* A.match(directDeps, {
      onEmpty: () => Effect.succeed(A.empty<string>()),
      onNonEmpty: () => topologicalSort(subsetAdjacency),
    });

    const computedTargets = pipe(
      sortedDeps,
      A.flatMap((depName) => {
        const descriptor = HashMap.get(workspaceByName, depName);
        return O.isNone(descriptor) || descriptor.value.ownerTsconfigPath === undefined
          ? A.empty<string>()
          : A.of(descriptor.value.ownerTsconfigPath);
      })
    );

    const original = yield* readFileString(sourceOwnerTsconfigPath);
    const parsed = yield* parseJsonc(original, sourceOwnerTsconfigPath, TsconfigWithReferences);

    const existingRefs = compareReferencePathsInOrder(parsed);
    const existingResolvedTargets = A.empty<string>();

    for (const refPath of existingRefs) {
      const canonicalTarget = yield* canonicalizeExistingRefTarget(
        workspace,
        sourceOwnerTsconfigPath,
        refPath,
        workspaces
      );
      if (O.isSome(canonicalTarget)) {
        const normalizedTarget = toPosixPath(canonicalTarget.value);
        if (!A.some(existingResolvedTargets, (existingTarget) => Str.equivalence(existingTarget, normalizedTarget))) {
          A.appendInPlace(existingResolvedTargets, normalizedTarget);
        }
      }
    }

    const computedResolvedTargets = uniqueSorted(A.map(computedTargets, toPosixPath));
    const computedResolvedTargetSet = HashSet.fromIterable(computedResolvedTargets);

    const extraTargets = A.filter(existingResolvedTargets, (target) => !HashSet.has(computedResolvedTargetSet, target));
    // References are derived from the declared dependency closure and nothing
    // else. An existing reference with no backing dependency lets `tsc -b`
    // build (write) a package Turbo never ordered — the torn-dist TS2306 race
    // class — so undeclared references are pruned, never preserved. Declare
    // the dependency or drop the reference.
    const finalTargets = computedResolvedTargets;

    if (!A.isArrayEmpty(extraTargets)) {
      const sourcePath = toPosixPath(path.relative(rootDir, sourceOwnerTsconfigPath));
      const prunedList = A.join(
        A.map(extraTargets, (targetPath) => toPosixPath(path.relative(rootDir, targetPath))),
        ", "
      );
      yield* Console.log(
        `[tsconfig-sync] ${sourcePath}: pruning ${extraTargets.length} reference(s) with no declared dependency: ${prunedList}`
      );
    }

    const finalRefPaths = A.map(finalTargets, (targetPath) => normalizeRelativeRef(sourceDir, targetPath, path));
    const currentResolvedRefPaths = A.map(existingResolvedTargets, (targetPath) =>
      normalizeRelativeRef(sourceDir, targetPath, path)
    );

    const existingHasReferences = parsed.references !== undefined;
    if (A.isArrayEmpty(finalRefPaths) && !existingHasReferences) {
      continue;
    }

    const nextContent = applyJsoncModification(original, ["references"], referenceEntries(finalRefPaths));
    if (Str.equivalence(nextContent, original)) {
      continue;
    }

    const summary = summaryCounts(currentResolvedRefPaths, finalRefPaths, "references");
    A.appendInPlace(
      plannedChanges,
      PlannedFileChange.cases["package-references"].make({
        filePath: sourceOwnerTsconfigPath,
        summary,
        content: nextContent,
      })
    );

    if (verbose) {
      const sourcePath = toPosixPath(path.relative(rootDir, sourceOwnerTsconfigPath));
      const computedCount = computedResolvedTargets.length;
      const prunedCount = extraTargets.length;
      yield* Console.log(
        `[verbose] ${sourcePath}: computed ${computedCount} ref(s), pruned ${prunedCount} existing ref(s)`
      );
    }
  }

  return plannedChanges;
});

/**
 * Plan package docgen config edits.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { planPackageDocgenSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 * import { Effect } from "effect"
 *
 * const program = planPackageDocgenSync("/repo", [], undefined)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const planPackageDocgenSync = Effect.fn(function* (
  rootDir: string,
  workspaces: ReadonlyArray<WorkspaceDescriptor>,
  filter: string | undefined
) {
  const path = yield* Path.Path;
  const targetWorkspaces = yield* resolveTargetWorkspacesForPackageSync(workspaces, filter);
  const plannedChanges = A.empty<PlannedFileChange>();

  for (const workspace of targetWorkspaces) {
    if (!workspace.hasDocgenConfig) {
      continue;
    }

    const filePath = path.join(workspace.absoluteDir, DOCGEN_CONFIG_FILENAME);
    const original = yield* readFileString(filePath);
    const parsed = yield* parseJsonObject(original, filePath);
    const canonicalConfig = yield* createCanonicalDocgenConfig(
      CanonicalDocgenConfigInput.make({
        rootDir,
        packageAbsolutePath: workspace.absoluteDir,
        packageRelativePath: workspace.relativeDir,
        packageName: workspace.packageName,
      })
    );
    const nextDocument = mergeManagedDocgenConfig(parsed, canonicalConfig);
    const nextContent = yield* renderDocgenJson(filePath, nextDocument);

    if (Str.equivalence(nextContent, original)) {
      continue;
    }

    A.appendInPlace(
      plannedChanges,
      PlannedFileChange.cases["package-docgen"].make({
        filePath,
        summary: "managed docgen fields synchronized",
        content: nextContent,
      })
    );
  }

  return plannedChanges;
});

/**
 * Sort planned file changes in deterministic report order.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { sortChanges } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * const result = sortChanges([{ file: "tsconfig.json", section: "references", status: "changed" }])
 * console.log(result) // rendered command output
 * ```
 *
 * @param changes - Planned file changes to order for reporting.
 * @returns The planned changes sorted into deterministic report order.
 * @category utilities
 * @since 0.0.0
 */
const sortChanges = (changes: ReadonlyArray<PlannedFileChange>): ReadonlyArray<PlannedFileChange> =>
  A.sort(changes, byPlannedChangeAscending);

/**
 * Convert an internal planned file change into the public report shape.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { toReportedChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * const result = toReportedChange({ file: "tsconfig.json", section: "references", status: "changed" })
 * console.log(result) // rendered command output
 * ```
 *
 * @param change - Internal planned file change to convert.
 * @returns The public report shape describing the same file change.
 * @category utilities
 * @since 0.0.0
 */
const toReportedChange = (change: PlannedFileChange): TsconfigSyncChange =>
  PlannedFileChange.match(change, {
    "root-references": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["root-references"].make({ filePath, summary }),
    "root-aliases": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["root-aliases"].make({ filePath, summary }),
    "root-syncpack": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["root-syncpack"].make({ filePath, summary }),
    "package-references": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["package-references"].make({ filePath, summary }),
    "package-docgen": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["package-docgen"].make({ filePath, summary }),
  });

/**
 * Internal planner surface used by the tsconfig-sync service and renderer.
 *
 * **Example** (Plan tsconfig synchronization)
 *
 * ```ts
 * import { TsconfigSyncPlan } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(TsconfigSyncPlan.sortChanges)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const TsconfigSyncPlan = {
  buildAdjacency,
  buildWorkspaceDescriptors,
  planPackageDocgenSync,
  planPackageReferenceSync,
  planRootAliasSync,
  planRootReferenceSync,
  planRootSyncpackSync,
  relativeFromRoot,
  sortChanges,
  toReportedChange,
  writeFileString,
} as const;
