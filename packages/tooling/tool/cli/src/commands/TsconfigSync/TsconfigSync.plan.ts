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
  buildDocgenAliasSource,
  CanonicalDocgenConfigInput,
  collectDocgenWorkspaceDependencyNames,
  createCanonicalDocgenConfig,
  DocgenAliasSource,
  mergeManagedDocgenConfig,
} from "@beep/repo-utils/schemas/DocgenConfig";
import {
  buildCanonicalAliasTargets,
  resolveRootExportTarget,
  resolveSubpathExportTarget,
  resolveWildcardExportTarget,
} from "@beep/repo-utils/schemas/TsconfigAliasTargets";
import { normalizePath } from "@beep/schema";
import { A, Str, thunkFalse, thunkUndefined } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect, FileSystem, flow, HashMap, HashSet, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  applyJsoncModification as applySharedJsoncModification,
  decodeJsoncTextAs,
  jsonText,
} from "../../internal/cli/Jsonc.js";
import { TsconfigSyncFilterError } from "./TsconfigSync.errors.js";
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
  ROOT_TSTYCHE_TSCONFIG,
  stringArrayEquivalence,
  TsconfigSyncChange,
  TsconfigSyncSchemaInternals,
  TsconfigWithPaths,
  TsconfigWithReferences,
  WorkspaceDescriptor,
} from "./TsconfigSync.schemas.js";
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
  return yield* S.decodeUnknownEffect(S.fromJsonString(JsonObject))(content).pipe(
    Effect.mapError(DomainError.newCause(`Failed to parse JSON in "${filePath}"`))
  );
});

const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const renderJson: (value: unknown) => Effect.Effect<string, DomainError> = Effect.fn(function* (value) {
  const encoded = yield* encodeJson(value).pipe(
    Effect.mapError(DomainError.newCause("Failed to encode tsconfig-sync JSON output."))
  );
  return `${jsonText(encoded)}\n`;
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
 * @example
 * ```ts
 * import { writeFileString } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(writeFileString)
 * ```
 * @category utilities
 * @since 0.0.0
 */
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
 * @example
 * ```ts
 * import { relativeFromRoot } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(relativeFromRoot)
 * ```
 * @category utilities
 * @since 0.0.0
 */
const relativeFromRoot = (rootDir: string, filePath: string, path: Path.Path): string =>
  toPosixPath(path.relative(rootDir, filePath));

const normalizeRelativeRef = (sourceDir: string, targetPath: string, path: Path.Path): string =>
  toPosixPath(path.relative(sourceDir, targetPath));

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

const pathSegments: (value: string) => ReadonlyArray<string> = flow(
  toPosixPath,
  Str.split("/"),
  A.filter(Str.isNonEmpty)
);

const readStringArray = (value: unknown): ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString) ? value : A.empty<string>();

const readTstycheTestFileMatch = (parsed: Record<string, unknown>): ReadonlyArray<string> =>
  readStringArray(parsed.testFileMatch);

const readTstycheTsconfig = (parsed: Record<string, unknown>): string | undefined =>
  P.isString(parsed.tsconfig) ? parsed.tsconfig : undefined;

const isManagedTstycheWorkspace = (relativeDir: string): boolean =>
  Str.startsWith("packages/")(relativeDir) || Str.startsWith("apps/")(relativeDir);

const workspacePatternCoversPath: {
  (workspacePattern: string, relativeDir: string): boolean;
  (relativeDir: string): (workspacePattern: string) => boolean;
} = dual(2, (workspacePattern: string, relativeDir: string): boolean => {
  const patternSegments = pathSegments(workspacePattern);
  const pathParts = pathSegments(relativeDir);

  if (A.length(patternSegments) !== A.length(pathParts)) {
    return false;
  }

  for (const [index, segment] of A.entries(patternSegments)) {
    if (segment !== "*" && !Str.equivalence(segment, pathParts[index] ?? "")) {
      return false;
    }
  }

  return true;
});

const buildCanonicalTstycheTestFileMatch = (
  workspaces: ReadonlyArray<WorkspaceDescriptor>,
  workspacePatterns: ReadonlyArray<string>
): ReadonlyArray<string> => {
  const managedWorkspaces = pipe(
    workspaces,
    A.filter((workspace) => isManagedTstycheWorkspace(workspace.relativeDir))
  );
  const managedWorkspacePatterns = pipe(
    workspacePatterns,
    A.filter(isManagedTstycheWorkspace),
    A.filter((pattern) => {
      const coveredWorkspaces = A.filter(managedWorkspaces, (workspace) =>
        workspacePatternCoversPath(pattern, workspace.relativeDir)
      );
      return (
        !A.isArrayEmpty(coveredWorkspaces) && A.every(coveredWorkspaces, (workspace) => workspace.hasDtslintDirectory)
      );
    })
  );
  const workspacePatternEntries = pipe(
    managedWorkspacePatterns,
    A.map((pattern) => `${pattern}/dtslint/**/*.tst.*`)
  );
  const explicitWorkspacePatterns = pipe(
    managedWorkspaces,
    A.filter((workspace) => workspace.hasDtslintDirectory),
    A.map((workspace) => workspace.relativeDir),
    A.filter((relativeDir) => !A.some(managedWorkspacePatterns, workspacePatternCoversPath(relativeDir))),
    A.map((relativeDir) => `${relativeDir}/dtslint/**/*.tst.*`),
    A.sort(byStringAscending)
  );

  return A.dedupe([...workspacePatternEntries, ...explicitWorkspacePatterns]);
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
 * @example
 * ```ts
 * import { buildWorkspaceDescriptors } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(buildWorkspaceDescriptors)
 * ```
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
    const packageJson = yield* S.decodeUnknownEffect(S.fromJsonString(S.Unknown))(packageJsonContent).pipe(
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
    const hasDtslintDirectory = yield* fs
      .exists(path.join(absoluteDir, "dtslint"))
      .pipe(Effect.orElseSucceed(thunkFalse));
    const directWorkspaceDependencies = collectDocgenWorkspaceDependencyNames(packageJson);
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
    const sourceOnlySubpathAliasTargets = TsconfigSyncSchemaInternals.buildSourceOnlySubpathAliasTargets(
      packageName,
      relativeDir
    );
    const subpathAliasTargets = {
      ...packageSubpathAliasTargets,
      ...sourceOnlySubpathAliasTargets,
    };
    const rootAliasTargets = O.getOrUndefined(aliasTargets);
    const aliasTargetFields = {
      ...(P.isNotUndefined(rootAliasTargets)
        ? {
            rootAliasTarget: rootAliasTargets.rootAliasTarget,
            ...(O.isSome(wildcardExportTarget) ? { wildcardAliasTarget: rootAliasTargets.wildcardAliasTarget } : {}),
          }
        : {}),
      ...(!R.isEmptyReadonlyRecord(subpathAliasTargets) ? { subpathAliasTargets } : {}),
    };
    const docgenAliasSource = buildDocgenAliasSource(packageName, relativeDir, packageJson);

    A.appendInPlace(
      descriptors,
      WorkspaceDescriptor.make({
        packageName,
        absoluteDir,
        relativeDir,
        ownerTsconfigPath,
        hasProjectTsconfig,
        hasDtslintDirectory,
        hasDocgenConfig,
        directWorkspaceDependencies: [...directWorkspaceDependencies],
        ...aliasTargetFields,
        docgenRootAliasTarget: docgenAliasSource.rootAliasTarget,
        docgenWildcardAliasTarget: docgenAliasSource.wildcardAliasTarget,
        docgenSubpathAliasTargets: docgenAliasSource.subpathAliasTargets,
      })
    );
  }

  return A.sort(descriptors, byWorkspaceRelativeDirAscending);
});

/**
 * Build the workspace dependency adjacency map.
 *
 * @example
 * ```ts
 * import { buildAdjacency } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(buildAdjacency)
 * ```
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
 * @example
 * ```ts
 * import { planRootReferenceSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(planRootReferenceSync)
 * ```
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

const buildPackageSubpathAliasTargets = (
  packageName: string,
  packageRelativePath: string,
  exportsField: unknown
): Readonly<Record<string, string>> => {
  if (!isReadonlyUnknownRecord(exportsField)) {
    return R.empty();
  }

  return pipe(
    exportsField,
    R.keys,
    A.filter(isConcretePackageSubpathExport),
    A.flatMap((exportKey) =>
      O.match(resolveSubpathExportTarget(exportsField, exportKey), {
        onNone: () => [],
        onSome: (exportTarget) => [
          [packageSubpathAlias(packageName, exportKey), sourceAliasTarget(packageRelativePath, exportTarget)] as const,
        ],
      })
    ),
    R.fromEntries
  );
};

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
 * @example
 * ```ts
 * import { planRootAliasSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(planRootAliasSync)
 * ```
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
 * Plan root tstyche test-file-match edits.
 *
 * @example
 * ```ts
 * import { planRootTstycheSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(planRootTstycheSync)
 * ```
 * @category utilities
 * @since 0.0.0
 */
const planRootTstycheSync = Effect.fn(function* (rootDir: string, workspaces: ReadonlyArray<WorkspaceDescriptor>) {
  const path = yield* Path.Path;
  const filePath = path.join(rootDir, "tstyche.json");

  const { packageJson } = yield* readRootPackageJson(rootDir);
  const workspacePatterns = workspacePatternsFromPackageJson(packageJson.workspaces);
  const original = yield* readFileString(filePath);
  const parsed = yield* parseJsonObject(original, filePath);
  const current = readTstycheTestFileMatch(parsed);
  const currentTsconfig = readTstycheTsconfig(parsed);
  const expected = buildCanonicalTstycheTestFileMatch(workspaces, workspacePatterns);

  if (arraysEqual(current, expected) && currentTsconfig === ROOT_TSTYCHE_TSCONFIG) {
    return O.none<PlannedFileChange>();
  }

  const nextContent = yield* renderJson({
    ...parsed,
    testFileMatch: expected,
    tsconfig: ROOT_TSTYCHE_TSCONFIG,
  });

  return O.some(
    PlannedFileChange.cases["root-tstyche"].make({
      filePath,
      summary: summaryCounts(current, expected, "testFileMatch"),
      content: nextContent,
    })
  );
});

/**
 * Plan root syncpack source-array edits.
 *
 * @example
 * ```ts
 * import { planRootSyncpackSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(planRootSyncpackSync)
 * ```
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
 * @example
 * ```ts
 * import { planPackageReferenceSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(planPackageReferenceSync)
 * ```
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
    const finalTargets = [...computedResolvedTargets, ...extraTargets];

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
      const preservedCount = extraTargets.length;
      yield* Console.log(
        `[verbose] ${sourcePath}: computed ${computedCount} ref(s), preserved ${preservedCount} existing ref(s)`
      );
    }
  }

  return plannedChanges;
});

/**
 * Plan package docgen config edits.
 *
 * @example
 * ```ts
 * import { planPackageDocgenSync } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(planPackageDocgenSync)
 * ```
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
  const workspaceAliasSources = A.map(workspaces, (workspace) =>
    DocgenAliasSource.make({
      packageName: workspace.packageName,
      rootAliasTarget: workspace.docgenRootAliasTarget ?? "",
      wildcardAliasTarget: workspace.docgenWildcardAliasTarget ?? "",
      subpathAliasTargets: workspace.docgenSubpathAliasTargets ?? R.empty(),
    })
  );
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
        directWorkspaceDependencies: [...workspace.directWorkspaceDependencies],
        workspaceAliasSources,
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
 * @example
 * ```ts
 * import { sortChanges } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(sortChanges)
 * ```
 * @category utilities
 * @since 0.0.0
 */
const sortChanges = (changes: ReadonlyArray<PlannedFileChange>): ReadonlyArray<PlannedFileChange> =>
  A.sort(changes, byPlannedChangeAscending);

/**
 * Convert an internal planned file change into the public report shape.
 *
 * @example
 * ```ts
 * import { toReportedChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(toReportedChange)
 * ```
 * @category utilities
 * @since 0.0.0
 */
const toReportedChange = (change: PlannedFileChange): TsconfigSyncChange =>
  PlannedFileChange.match(change, {
    "root-references": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["root-references"].make({ filePath, summary }),
    "root-aliases": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["root-aliases"].make({ filePath, summary }),
    "root-tstyche": ({ filePath, summary }): TsconfigSyncChange =>
      TsconfigSyncChange.cases["root-tstyche"].make({ filePath, summary }),
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
 * @example
 * ```ts
 * import { TsconfigSyncPlan } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.plan"
 *
 * console.log(TsconfigSyncPlan.sortChanges)
 * ```
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
  planRootTstycheSync,
  relativeFromRoot,
  sortChanges,
  toReportedChange,
  writeFileString,
} as const;
