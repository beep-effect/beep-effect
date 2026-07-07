/**
 * tsconfig-sync command - synchronize workspace tsconfig references and root aliases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  buildRepoDependencyIndex,
  collectTsConfigPaths,
  DomainError,
  decodePackageJsonEffect,
  detectCycles,
  findRepoRoot,
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
import { LiteralKit, normalizePath } from "@beep/schema";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, Str, thunkFalse, thunkUndefined } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, Effect, FileSystem, flow, HashMap, HashSet, Order, Path, pipe, Tuple } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import * as jsonc from "jsonc-parser";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { TsconfigSyncCycleError, TsconfigSyncDriftError, TsconfigSyncFilterError } from "./TsconfigSync.errors.js";
import type { CyclicDependencyError, FsUtils, NoSuchFileError, WorkspaceDeps } from "@beep/repo-utils";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";

export {
  /**
   * Build canonical tsconfig alias targets from a package root export.
   *
   * @category models
   * @since 0.0.0
   */
  buildCanonicalAliasTargets,
  /**
   * Resolve the canonical root export target from a package `exports` field.
   *
   * @category models
   * @since 0.0.0
   */
  resolveRootExportTarget,
} from "@beep/repo-utils/schemas/TsconfigAliasTargets";

/**
 * Formatting options used for jsonc edits.
 *
 * @category configuration
 * @since 0.0.0
 */
const FORMATTING_OPTIONS: jsonc.FormattingOptions = {
  tabSize: 2,
  insertSpaces: true,
};
const DOCGEN_CONFIG_FILENAME = "docgen.json" as const;
const ROOT_TSTYCHE_TSCONFIG = "./tsconfig.dtslint.json" as const;

/**
 * Synthetic root key in repo-utils dependency maps.
 *
 * @category configuration
 * @since 0.0.0
 */
const ROOT_DEP_INDEX_KEY = "@beep/root" as const;
const $I = $RepoCliId.create("commands/TsconfigSync/TsconfigSync.command");
const RootDepIndexKey = S.Literal(ROOT_DEP_INDEX_KEY).pipe(
  $I.annoteSchema("RootDepIndexKey", {
    description: "Synthetic root dependency index key from repo-utils dependency maps.",
  })
);

/**
 * Canonical alias key matcher managed by this command.
 *
 * Matches exactly:
 * - `@beep/<name>`
 * - `@beep/<name>/*`
 * - `@beep/<name>/<subpath>`
 *
 * @category configuration
 * @since 0.0.0
 */
const CANONICAL_ALIAS_KEY_PATTERN = /^@beep\/[^/*]+(?:\/(?!\*)[^*]+)*(?:\/\*)?$/;

const CanonicalAliasKey = S.String.check(S.isPattern(CANONICAL_ALIAS_KEY_PATTERN)).pipe(
  S.brand("CanonicalAliasKey"),
  $I.annoteSchema("CanonicalAliasKey", {
    description: "Canonical @beep path alias key in root tsconfig paths.",
  })
);

const BeepScopedPackageName = S.String.check(S.isStartsWith("@beep/")).pipe(
  S.brand("BeepScopedPackageName"),
  $I.annoteSchema("BeepScopedPackageName", {
    description: "Package name under the @beep scope.",
  })
);

const StringArray = S.Array(S.String).pipe(
  $I.annoteSchema("StringArray", {
    description: "Reusable schema for arrays of strings.",
  })
);

const isCanonicalAliasKey = S.is(CanonicalAliasKey);
const isBeepScopedPackageName = S.is(BeepScopedPackageName);
const isRootDepIndexKey = S.is(RootDepIndexKey);
const stringArrayEquivalence = S.toEquivalence(StringArray);
const byStringAscending: Order.Order<string> = Str.orderAsc;
type SourceOnlyTestKitAlias = readonly [aliasKey: string, sourcePath: string];
const repoCliPackageName = "@beep/repo-cli" as const;
const repoCliSourceOnlyTestKitAliases = [
  ["@beep/repo-cli/test/CreatePackage", "src/test/CreatePackage.test-kit.ts"],
  ["@beep/repo-cli/test/Docgen", "src/test/Docgen.test-kit.ts"],
  ["@beep/repo-cli/test/Graphiti", "src/test/Graphiti.test-kit.ts"],
  ["@beep/repo-cli/test/Laws", "src/test/Laws.test-kit.ts"],
  ["@beep/repo-cli/test/Quality", "src/test/Quality.test-kit.ts"],
  ["@beep/repo-cli/test/SyncDataToTs", "src/test/SyncDataToTs.test-kit.ts"],
  ["@beep/repo-cli/test/VersionSync", "src/test/VersionSync.test-kit.ts"],
  ["@beep/repo-cli/test/Yeet", "src/test/Yeet.test-kit.ts"],
] as const satisfies ReadonlyArray<SourceOnlyTestKitAlias>;
const schemaPackageName = "@beep/schema" as const;
const schemaSourceOnlyTestKitAliases = [
  ["@beep/schema/test/Markdown", "src/internal/test/Markdown.test-kit.ts"],
  ["@beep/schema/test/Yaml", "src/internal/test/Yaml.test-kit.ts"],
] as const satisfies ReadonlyArray<SourceOnlyTestKitAlias>;

const sourceOnlyTestKitAliasesForPackage = (packageName: string): ReadonlyArray<SourceOnlyTestKitAlias> => {
  if (Str.equivalence(packageName, repoCliPackageName)) {
    return repoCliSourceOnlyTestKitAliases;
  }

  if (Str.equivalence(packageName, schemaPackageName)) {
    return schemaSourceOnlyTestKitAliases;
  }

  return A.empty();
};

const buildSourceOnlySubpathAliasTargets = (
  packageName: string,
  packageRelativePath: string
): Readonly<Record<string, string>> =>
  pipe(
    sourceOnlyTestKitAliasesForPackage(packageName),
    A.map(([aliasKey, sourcePath]) => [aliasKey, `./${packageRelativePath}/${sourcePath}`] as const),
    R.fromEntries
  );

/**
 * Command execution mode.
 *
 * @category models
 * @since 0.0.0
 */
const TsconfigSyncModeKit = LiteralKit(["sync", "check", "dry-run"]);
/**
 * Command execution mode.
 *
 * @example
 * ```ts
 * import { TsconfigSyncMode } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigSyncMode)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncMode = TsconfigSyncModeKit.pipe(
  $I.annoteSchema("TsconfigSyncMode", {
    description: "Command execution mode for tsconfig-sync.",
  })
);
const TsconfigSyncModeMatch = TsconfigSyncModeKit.$match;

type TsconfigSyncMode = typeof TsconfigSyncMode.Type;
const tsconfigSyncModeEquivalence = S.toEquivalence(TsconfigSyncMode);
type TsconfigSyncModeFlags = readonly [check: boolean, dryRun: boolean, write: boolean];

const isCheckModeFlags = P.Tuple([P.isTruthy, P.isBoolean, P.isBoolean]);
const isDryRunModeFlags = P.Tuple([P.not(P.isTruthy), P.isTruthy, P.isBoolean]);
const isWriteModeFlags = P.Tuple([P.not(P.isTruthy), P.not(P.isTruthy), P.isTruthy]);

class TsconfigSyncRunOptionsSync extends S.Class<TsconfigSyncRunOptionsSync>($I`TsconfigSyncRunOptionsSync`)(
  {
    mode: S.tag("sync"),
    filter: S.String.pipe(S.UndefinedOr, S.optionalKey),
    verbose: S.Boolean,
  },
  $I.annote("TsconfigSyncRunOptionsSync", {
    description: "Runtime options for sync mode execution.",
  })
) {}

class TsconfigSyncRunOptionsCheck extends S.Class<TsconfigSyncRunOptionsCheck>($I`TsconfigSyncRunOptionsCheck`)(
  {
    mode: S.tag("check"),
    filter: S.String.pipe(S.UndefinedOr, S.optionalKey),
    verbose: S.Boolean,
  },
  $I.annote("TsconfigSyncRunOptionsCheck", {
    description: "Runtime options for check mode execution.",
  })
) {}

class TsconfigSyncRunOptionsDryRun extends S.Class<TsconfigSyncRunOptionsDryRun>($I`TsconfigSyncRunOptionsDryRun`)(
  {
    mode: S.tag("dry-run"),
    filter: S.String.pipe(S.UndefinedOr, S.optionalKey),
    verbose: S.Boolean,
  },
  $I.annote("TsconfigSyncRunOptionsDryRun", {
    description: "Runtime options for dry-run mode execution.",
  })
) {}

/**
 * Runtime options for executing tsconfig sync at a repo root.
 *
 * @returns Tagged union schema keyed by `mode`.
 * @example
 * ```ts
 * import { TsconfigSyncRunOptions } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigSyncRunOptions)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncRunOptions = TsconfigSyncMode.mapMembers(
  Tuple.evolve([
    () => TsconfigSyncRunOptionsSync,
    () => TsconfigSyncRunOptionsCheck,
    () => TsconfigSyncRunOptionsDryRun,
  ])
).pipe(
  $I.annoteSchema("TsconfigSyncRunOptions", {
    description: "Runtime options for executing tsconfig sync at a repo root.",
  }),
  S.toTaggedUnion("mode")
);
/**
 * Runtime options for executing tsconfig sync at a repo root.
 *
 * @category models
 * @since 0.0.0
 */
export type TsconfigSyncRunOptions = typeof TsconfigSyncRunOptions.Type;

/**
 * Sync change section categories.
 *
 * @example
 * ```ts
 * import { TsconfigSyncSection } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigSyncSection)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncSection = LiteralKit([
  "root-references",
  "root-aliases",
  "root-tstyche",
  "root-syncpack",
  "package-references",
  "package-docgen",
]).pipe(
  $I.annoteSchema("TsconfigSyncSection", {
    description: "Sync change section categories for tsconfig-sync.",
  })
);

/**
 * Sync change section categories.
 *
 * @category models
 * @since 0.0.0
 */
export type TsconfigSyncSection = typeof TsconfigSyncSection.Type;

class RootReferencesChange extends S.Class<RootReferencesChange>($I`RootReferencesChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-references"),
  },
  $I.annote("RootReferencesChange", {
    description: "Planned change entry for root tsconfig references.",
  })
) {}

class RootAliasesChange extends S.Class<RootAliasesChange>($I`RootAliasesChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-aliases"),
  },
  $I.annote("RootAliasesChange", {
    description: "Planned change entry for root tsconfig aliases.",
  })
) {}

class RootTstycheChange extends S.Class<RootTstycheChange>($I`RootTstycheChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-tstyche"),
  },
  $I.annote("RootTstycheChange", {
    description: "Planned change entry for root tstyche config.",
  })
) {}

class RootSyncpackChange extends S.Class<RootSyncpackChange>($I`RootSyncpackChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-syncpack"),
  },
  $I.annote("RootSyncpackChange", {
    description: "Planned change entry for root syncpack config.",
  })
) {}

class PackageReferencesChange extends S.Class<PackageReferencesChange>($I`PackageReferencesChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-references"),
  },
  $I.annote("PackageReferencesChange", {
    description: "Planned change entry for package-level tsconfig references.",
  })
) {}

class PackageDocgenChange extends S.Class<PackageDocgenChange>($I`PackageDocgenChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-docgen"),
  },
  $I.annote("PackageDocgenChange", {
    description: "Planned change entry for package docgen configs.",
  })
) {}

/**
 * A single planned file change.
 *
 * @returns Tagged union schema keyed by `section`.
 * @example
 * ```ts
 * import { TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigSyncChange)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncChange = TsconfigSyncSection.mapMembers(
  Tuple.evolve([
    () => RootReferencesChange,
    () => RootAliasesChange,
    () => RootTstycheChange,
    () => RootSyncpackChange,
    () => PackageReferencesChange,
    () => PackageDocgenChange,
  ])
).pipe(
  $I.annoteSchema("TsconfigSyncChange", {
    description: "A single planned file change for tsconfig-sync.",
  }),
  S.toTaggedUnion("section")
);

/**
 * A single planned file change.
 *
 * @category models
 * @since 0.0.0
 */
export type TsconfigSyncChange = typeof TsconfigSyncChange.Type;

class RootReferencesPlannedFileChange extends S.Class<RootReferencesPlannedFileChange>(
  $I`RootReferencesPlannedFileChange`
)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-references"),
    content: S.String,
  },
  $I.annote("RootReferencesPlannedFileChange", {
    description: "Planned file content change for root tsconfig references.",
  })
) {}

class RootAliasesPlannedFileChange extends S.Class<RootAliasesPlannedFileChange>($I`RootAliasesPlannedFileChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-aliases"),
    content: S.String,
  },
  $I.annote("RootAliasesPlannedFileChange", {
    description: "Planned file content change for root tsconfig aliases.",
  })
) {}

class RootTstychePlannedFileChange extends S.Class<RootTstychePlannedFileChange>($I`RootTstychePlannedFileChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-tstyche"),
    content: S.String,
  },
  $I.annote("RootTstychePlannedFileChange", {
    description: "Planned file content change for root tstyche config.",
  })
) {}

class RootSyncpackPlannedFileChange extends S.Class<RootSyncpackPlannedFileChange>($I`RootSyncpackPlannedFileChange`)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-syncpack"),
    content: S.String,
  },
  $I.annote("RootSyncpackPlannedFileChange", {
    description: "Planned file content change for root syncpack config.",
  })
) {}

class PackageReferencesPlannedFileChange extends S.Class<PackageReferencesPlannedFileChange>(
  $I`PackageReferencesPlannedFileChange`
)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-references"),
    content: S.String,
  },
  $I.annote("PackageReferencesPlannedFileChange", {
    description: "Planned file content change for package tsconfig references.",
  })
) {}

class PackageDocgenPlannedFileChange extends S.Class<PackageDocgenPlannedFileChange>(
  $I`PackageDocgenPlannedFileChange`
)(
  {
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-docgen"),
    content: S.String,
  },
  $I.annote("PackageDocgenPlannedFileChange", {
    description: "Planned file content change for package docgen configs.",
  })
) {}

/**
 * A planned file change with transformed file content.
 *
 * @returns Tagged union schema keyed by `section`.
 * @example
 * ```ts
 * import { PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(PlannedFileChange)
 * ```
 * @category models
 * @since 0.0.0
 */
export const PlannedFileChange = TsconfigSyncSection.mapMembers(
  Tuple.evolve([
    () => RootReferencesPlannedFileChange,
    () => RootAliasesPlannedFileChange,
    () => RootTstychePlannedFileChange,
    () => RootSyncpackPlannedFileChange,
    () => PackageReferencesPlannedFileChange,
    () => PackageDocgenPlannedFileChange,
  ])
).pipe(
  $I.annoteSchema("TsconfigSyncChange", {
    description: "A single planned file change for tsconfig-sync.",
  }),
  S.toTaggedUnion("section")
);

/**
 * A planned file change with transformed file content.
 *
 * @category models
 * @since 0.0.0
 */
export type PlannedFileChange = typeof PlannedFileChange.Type;

class TsconfigSyncResultSync extends S.Class<TsconfigSyncResultSync>($I`TsconfigSyncResultSync`)(
  {
    mode: S.tag("sync"),
    changedFiles: S.Finite,
    changes: S.Array(TsconfigSyncChange),
  },
  $I.annote("TsconfigSyncResultSync", {
    description: "Sync mode result payload.",
  })
) {}

class TsconfigSyncResultCheck extends S.Class<TsconfigSyncResultCheck>($I`TsconfigSyncResultCheck`)(
  {
    mode: S.tag("check"),
    changedFiles: S.Finite,
    changes: S.Array(TsconfigSyncChange),
  },
  $I.annote("TsconfigSyncResultCheck", {
    description: "Check mode result payload.",
  })
) {}

class TsconfigSyncResultDryRun extends S.Class<TsconfigSyncResultDryRun>($I`TsconfigSyncResultDryRun`)(
  {
    mode: S.tag("dry-run"),
    changedFiles: S.Finite,
    changes: S.Array(TsconfigSyncChange),
  },
  $I.annote("TsconfigSyncResultDryRun", {
    description: "Dry-run mode result payload.",
  })
) {}

/**
 * Result emitted after a sync run.
 *
 * @returns Tagged union schema keyed by `mode`.
 * @example
 * ```ts
 * import { TsconfigSyncResult } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigSyncResult)
 * ```
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncResult = TsconfigSyncMode.mapMembers(
  Tuple.evolve([() => TsconfigSyncResultSync, () => TsconfigSyncResultCheck, () => TsconfigSyncResultDryRun])
).pipe(
  $I.annoteSchema("TsconfigSyncResult", {
    description: "Result emitted after a sync run.",
  }),
  S.toTaggedUnion("mode")
);

/**
 * Result emitted after a sync run.
 *
 * @category models
 * @since 0.0.0
 */
export type TsconfigSyncResult = typeof TsconfigSyncResult.Type;

type TsconfigSyncError =
  | DomainError
  | NoSuchFileError
  | CyclicDependencyError
  | TsconfigSyncCycleError
  | TsconfigSyncDriftError
  | TsconfigSyncFilterError;

/**
 * Workspace package descriptor with metadata for tsconfig synchronization.
 *
 * @example
 * ```ts
 * import { WorkspaceDescriptor } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(WorkspaceDescriptor)
 * ```
 * @category models
 * @since 0.0.0
 */
export class WorkspaceDescriptor extends S.Class<WorkspaceDescriptor>($I`WorkspaceDescriptor`)(
  {
    packageName: S.String,
    absoluteDir: S.String,
    relativeDir: S.String,
    ownerTsconfigPath: S.UndefinedOr(S.String),
    hasProjectTsconfig: S.Boolean,
    hasDtslintDirectory: S.Boolean,
    hasDocgenConfig: S.Boolean,
    directWorkspaceDependencies: S.Array(S.String),
    rootAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    wildcardAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    subpathAliasTargets: S.Record(S.String, S.String).pipe(S.UndefinedOr, S.optionalKey),
    docgenRootAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    docgenWildcardAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    docgenSubpathAliasTargets: S.Record(S.String, S.String).pipe(S.UndefinedOr, S.optionalKey),
  },
  $I.annote("WorkspaceDescriptor", {
    description: "A workspace package descriptor with metadata for tsconfig synchronization.",
  })
) {}

const JsonObject = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("JsonObject", {
    description: "Generic JSON object document used for parsed docgen configs.",
  })
);

class TsconfigReferenceEntry extends S.Class<TsconfigReferenceEntry>($I`TsconfigReferenceEntry`)(
  {
    path: S.optionalKey(S.Unknown),
  },
  $I.annote("TsconfigReferenceEntry", {
    description: "Single tsconfig references entry with optional path field.",
  })
) {}

class TsconfigCompilerOptionsPaths extends S.Class<TsconfigCompilerOptionsPaths>($I`TsconfigCompilerOptionsPaths`)(
  {
    paths: S.optionalKey(S.Record(S.String, S.Unknown)),
  },
  $I.annote("TsconfigCompilerOptionsPaths", {
    description: "Subset of tsconfig compilerOptions containing optional paths map.",
  })
) {}

/**
 * Minimal tsconfig shape containing optional `references`.
 *
 * @example
 * ```ts
 * import { TsconfigWithReferences } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigWithReferences)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TsconfigWithReferences extends S.Class<TsconfigWithReferences>($I`TsconfigWithReferences`)(
  {
    references: TsconfigReferenceEntry.pipe(S.Array, S.optionalKey),
  },
  $I.annote("TsconfigWithReferences", {
    description: "A class representing a tsconfig.json file with references property.",
  })
) {}

/**
 * Minimal tsconfig shape containing optional `compilerOptions.paths`.
 *
 * @example
 * ```ts
 * import { TsconfigWithPaths } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(TsconfigWithPaths)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TsconfigWithPaths extends S.Class<TsconfigWithPaths>($I`TsconfigWithPaths`)(
  {
    compilerOptions: S.optionalKey(TsconfigCompilerOptionsPaths),
  },
  $I.annote("TsconfigWithPaths", {
    description: "A class representing a tsconfig.json file with compilerOptions.paths property.",
  })
) {}

const byWorkspaceRelativeDirAscending: Order.Order<WorkspaceDescriptor> = Order.mapInput(
  Str.orderAsc,
  (descriptor: WorkspaceDescriptor) => descriptor.relativeDir
);
const byPlannedChangeFileAscending: Order.Order<PlannedFileChange> = Order.mapInput(
  Str.orderAsc,
  (change: PlannedFileChange) => change.filePath
);
const byPlannedChangeSectionAscending: Order.Order<PlannedFileChange> = Order.mapInput(
  Str.orderAsc,
  (change: PlannedFileChange) => change.section
);
const byPlannedChangeAscending = Order.combine(byPlannedChangeFileAscending, byPlannedChangeSectionAscending);

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
  const edits = jsonc.format(encoded, undefined, FORMATTING_OPTIONS);
  return `${jsonc.applyEdits(encoded, edits)}\n`;
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

const writeFileString = Effect.fn(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(filePath, content)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to write file "${filePath}"`)));
});

const applyJsoncModification = (
  content: string,
  path: jsonc.JSONPath,
  value: unknown,
  options?: jsonc.ModificationOptions
): string => {
  const edits = jsonc.modify(content, path, value, {
    formattingOptions: FORMATTING_OPTIONS,
    ...options,
  });
  return jsonc.applyEdits(content, edits);
};

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
    const sourceOnlySubpathAliasTargets = buildSourceOnlySubpathAliasTargets(packageName, relativeDir);
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
    const nextContent = yield* renderBiomeJson(filePath, nextDocument);

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

const sortChanges = (changes: ReadonlyArray<PlannedFileChange>): ReadonlyArray<PlannedFileChange> =>
  A.sort(changes, byPlannedChangeAscending);

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

const renderChanges = Effect.fn(function* (
  rootDir: string,
  mode: TsconfigSyncMode,
  changes: ReadonlyArray<TsconfigSyncChange>
) {
  const path = yield* Path.Path;

  if (A.isReadonlyArrayEmpty(changes)) {
    yield* TsconfigSyncModeMatch(mode, {
      check: () => Console.log("tsconfig-sync: no drift detected"),
      "dry-run": () => Console.log("tsconfig-sync: dry-run found no changes"),
      sync: () => Console.log("tsconfig-sync: all files already in sync"),
    });
    return;
  }

  const prefix = TsconfigSyncModeMatch(mode, {
    check: () => "tsconfig-sync: drift detected",
    "dry-run": () => "tsconfig-sync: dry-run planned changes",
    sync: () => "tsconfig-sync: applied changes",
  });

  yield* Console.log(`${prefix} (${changes.length} file change(s))`);

  for (const change of changes) {
    const relativePath = relativeFromRoot(rootDir, change.filePath, path);
    yield* Console.log(`  - ${relativePath} [${change.section}] ${change.summary}`);
  }
});

/**
 * Synchronize tsconfig references and root aliases under a specific repository root.
 *
 * @param rootDir - Absolute repository root directory.
 * @param options - Mode and logging options.
 * @returns Summary of planned/applied changes.
 * @example
 * ```ts
 * import { syncTsconfigAtRoot } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(syncTsconfigAtRoot)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const syncTsconfigAtRoot: {
  (
    rootDir: string,
    options: TsconfigSyncRunOptions
  ): Effect.Effect<
    TsconfigSyncResult,
    TsconfigSyncError,
    FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner
  >;
  (
    options: TsconfigSyncRunOptions
  ): (
    rootDir: string
  ) => Effect.Effect<
    TsconfigSyncResult,
    TsconfigSyncError,
    FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner
  >;
} = dual(
  2,
  Effect.fn(function* (rootDir: string, options: TsconfigSyncRunOptions) {
    const workspaces = yield* buildWorkspaceDescriptors(rootDir);
    const depIndex = yield* buildRepoDependencyIndex(rootDir);

    const adjacency = buildAdjacency(depIndex);
    const cycles = yield* detectCycles(adjacency);

    if (!A.isReadonlyArrayEmpty(cycles)) {
      return yield* TsconfigSyncCycleError.new(
        A.map(cycles, (cycle) => [...cycle]),
        `Detected ${cycles.length} workspace dependency cycle(s)`
      );
    }

    const plannedChanges = A.empty<PlannedFileChange>();

    const rootReferenceChange = yield* planRootReferenceSync(rootDir, workspaces);
    const rootAliasChange = yield* planRootAliasSync(rootDir, workspaces);
    const rootTstycheChange = yield* planRootTstycheSync(rootDir, workspaces);
    const rootSyncpackChange = yield* planRootSyncpackSync(rootDir);
    A.appendAllInPlace(
      plannedChanges,
      A.getSomes([rootReferenceChange, rootAliasChange, rootTstycheChange, rootSyncpackChange])
    );

    const packageChanges = yield* planPackageReferenceSync(
      rootDir,
      workspaces,
      depIndex,
      adjacency,
      options.filter,
      options.verbose
    );
    A.appendAllInPlace(plannedChanges, packageChanges);

    const docgenChanges = yield* planPackageDocgenSync(rootDir, workspaces, options.filter);
    A.appendAllInPlace(plannedChanges, docgenChanges);

    const sortedPlannedChanges = sortChanges(plannedChanges);

    if (tsconfigSyncModeEquivalence(options.mode, "sync")) {
      yield* Effect.forEach(sortedPlannedChanges, (change) => writeFileString(change.filePath, change.content), {
        discard: true,
      });
    }

    const reportedChanges = A.map(sortedPlannedChanges, toReportedChange);
    yield* renderChanges(rootDir, options.mode, reportedChanges);

    if (tsconfigSyncModeEquivalence(options.mode, "check") && !A.isArrayEmpty(reportedChanges)) {
      return yield* TsconfigSyncDriftError.new(
        reportedChanges.length,
        `Run "beep tsconfig-sync" to apply ${reportedChanges.length} change(s).`
      );
    }

    const result: TsconfigSyncResult = TsconfigSyncModeMatch(options.mode, {
      sync: () =>
        TsconfigSyncResult.cases.sync.make({
          mode: "sync",
          changedFiles: A.length(reportedChanges),
          changes: reportedChanges,
        }),
      check: () =>
        TsconfigSyncResult.cases.check.make({
          mode: "check",
          changedFiles: A.length(reportedChanges),
          changes: reportedChanges,
        }),
      "dry-run": () =>
        TsconfigSyncResult.cases["dry-run"].make({
          mode: "dry-run",
          changedFiles: A.length(reportedChanges),
          changes: reportedChanges,
        }),
    });
    return result;
  })
);

const resolveMode = (check: boolean, dryRun: boolean, write: boolean): TsconfigSyncMode => {
  const flags = [check, dryRun, write] satisfies TsconfigSyncModeFlags;

  return pipe(
    [
      pipe(flags, O.liftPredicate(isCheckModeFlags), O.as("check" as const)),
      pipe(flags, O.liftPredicate(isDryRunModeFlags), O.as("dry-run" as const)),
      pipe(flags, O.liftPredicate(isWriteModeFlags), O.as("sync" as const)),
    ] satisfies ReadonlyArray<O.Option<TsconfigSyncMode>>,
    O.firstSomeOf,
    O.getOrElse((): TsconfigSyncMode => "sync")
  );
};

/**
 * CLI command for synchronizing root and workspace tsconfig state.
 *
 * @example
 * ```ts
 * import { tsconfigSyncCommand } from "@beep/repo-cli/commands/TsconfigSync"
 * console.log(tsconfigSyncCommand)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const tsconfigSyncCommand = Command.make(
  "tsconfig-sync",
  {
    check: Flag.boolean("check").pipe(
      Flag.withDescription("Validate drift without writing files (non-zero exit on drift)")
    ),
    dryRun: Flag.boolean("dry-run").pipe(Flag.withDescription("Preview file changes without writing files")),
    write: Flag.boolean("write").pipe(Flag.withDescription("Apply file changes (default behavior)")),
    filter: Flag.string("filter").pipe(
      Flag.withDescription("Limit package reference sync to a workspace package name or workspace-relative path"),
      Flag.optional
    ),
    verbose: Flag.boolean("verbose").pipe(
      Flag.withAlias("v"),
      Flag.withDescription("Include per-package detail output")
    ),
  },
  Effect.fn(function* ({ check, dryRun, filter, verbose, write }) {
    const rootDir = yield* findRepoRoot();
    const mode = resolveMode(check, dryRun, write);
    const syncOptions = {
      mode,
      verbose,
      ...O.getSomesStruct({ filter }),
    };

    yield* syncTsconfigAtRoot(rootDir, syncOptions).pipe(
      Effect.catchTags({
        TsconfigSyncDriftError: Effect.fn(function* (error) {
          yield* Console.error(`tsconfig-sync: ${error.summary}`);
          return yield* failWithReportedExit(`tsconfig-sync: ${error.summary}`);
        }),
        TsconfigSyncFilterError: Effect.fn(function* (error) {
          yield* Console.error(`tsconfig-sync: ${error.message}`);
          return yield* failWithReportedExit(`tsconfig-sync: ${error.message}`);
        }),
        TsconfigSyncCycleError: Effect.fn(function* (error) {
          yield* Console.error(`tsconfig-sync: ${error.message}`);
          for (const cycle of error.cycles) {
            yield* Console.error(`  cycle: ${A.join(cycle, " -> ")}`);
          }
          return yield* failWithReportedExit(`tsconfig-sync: ${error.message}`);
        }),
      })
    );
  })
).pipe(
  Command.withDescription(
    "Synchronize repo-managed config files including root tsconfig references, aliases, tstyche, syncpack, and package docgen"
  )
);
