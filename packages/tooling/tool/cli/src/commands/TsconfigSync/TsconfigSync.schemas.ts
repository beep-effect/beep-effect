/**
 * Schemas and derived ordering helpers for tsconfig-sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Order, pipe, Tuple } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import type * as Ordering from "effect/Ordering";

const $I = $RepoCliId.create("commands/TsconfigSync/TsconfigSync.schemas");
/**
 * Filename for package-local docgen configuration files.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { DOCGEN_CONFIG_FILENAME } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(typeof DOCGEN_CONFIG_FILENAME !== "undefined") // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const DOCGEN_CONFIG_FILENAME = "docgen.json" as const;

/**
 * Synthetic root key in repo-utils dependency maps.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { ROOT_DEP_INDEX_KEY } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(typeof ROOT_DEP_INDEX_KEY !== "undefined") // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ROOT_DEP_INDEX_KEY = "@beep/root" as const;
/**
 * Schema for the synthetic root dependency-index key.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { RootDepIndexKey } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * const value = "sync"
 * console.log(S.is(RootDepIndexKey)(value)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const RootDepIndexKey = S.Literal(ROOT_DEP_INDEX_KEY).pipe(
  $I.annoteSchema("RootDepIndexKey", {
    description: "Synthetic root dependency index key from repo-utils dependency maps.",
  })
);

/**
 * Synthetic root dependency-index key.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { RootDepIndexKey } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const key: RootDepIndexKey = "@beep/root"
 * console.log(key) // "@beep/root"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type RootDepIndexKey = typeof RootDepIndexKey.Type;

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

/**
 * Schema for canonical `@beep` tsconfig alias keys.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { CanonicalAliasKey } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CanonicalAliasKey)("@beep/repo-cli/commands")) // true
 * console.log(S.is(CanonicalAliasKey)("lodash")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const CanonicalAliasKey = S.String.check(S.isPattern(CANONICAL_ALIAS_KEY_PATTERN)).pipe(
  S.brand("CanonicalAliasKey"),
  $I.annoteSchema("CanonicalAliasKey", {
    description: "Canonical @beep path alias key in root tsconfig paths.",
  })
);

/**
 * Schema for `@beep`-scoped package names.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { BeepScopedPackageName } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BeepScopedPackageName)("@beep/schema")) // true
 * console.log(S.is(BeepScopedPackageName)("effect")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const BeepScopedPackageName = S.String.check(S.isStartsWith("@beep/")).pipe(
  S.brand("BeepScopedPackageName"),
  $I.annoteSchema("BeepScopedPackageName", {
    description: "Package name under the @beep scope.",
  })
);

/**
 * Reusable string-array schema for parsed config fields.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { StringArray } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * const value = "sync"
 * console.log(S.is(StringArray)(value)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const StringArray = S.Array(S.String).pipe(
  $I.annoteSchema("StringArray", {
    description: "Reusable schema for arrays of strings.",
  })
);

/**
 * Reusable string-array type for parsed config fields.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { StringArray } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const values: StringArray = ["docgen.json"]
 * console.log(values.length) // 1
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type StringArray = typeof StringArray.Type;

/**
 * Predicate derived from the canonical alias-key schema.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { isCanonicalAliasKey } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(isCanonicalAliasKey("@beep/repo-cli/*")) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCanonicalAliasKey = S.is(CanonicalAliasKey);
/**
 * Predicate derived from the `@beep` package-name schema.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { isBeepScopedPackageName } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(isBeepScopedPackageName("@beep/repo-cli")) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isBeepScopedPackageName = S.is(BeepScopedPackageName);
/**
 * Predicate for the synthetic root dependency-index key.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { isRootDepIndexKey } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(isRootDepIndexKey("@beep/root")) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isRootDepIndexKey = S.is(RootDepIndexKey);
/**
 * Equivalence relation for arrays of strings.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { stringArrayEquivalence } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(stringArrayEquivalence(["a", "b"], ["a", "b"])) // true
 * console.log(stringArrayEquivalence(["a"], ["a", "b"])) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stringArrayEquivalence: {
  (that: StringArray): (self: StringArray) => boolean;
  (self: StringArray, that: StringArray): boolean;
} = dual(2, S.toEquivalence(StringArray));
/**
 * Ascending string order used for deterministic config output.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { byStringAscending } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import { Order } from "effect"
 *
 * console.log(Order.isLessThan(byStringAscending)("a", "b")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byStringAscending: {
  (that: string): (self: string) => Ordering.Ordering;
  (self: string, that: string): Ordering.Ordering;
} = Str.orderAsc;
type SourceOnlyTestKitAlias = readonly [aliasKey: string, sourcePath: string];
const repoCliPackageName = "@beep/repo-cli" as const;
const repoCliSourceOnlyTestKitAliases = [
  ["@beep/repo-cli/test/CreatePackage", "src/test/CreatePackage.test-kit.ts"],
  ["@beep/repo-cli/test/Docgen", "src/test/Docgen.test-kit.ts"],
  ["@beep/repo-cli/test/Knowledge", "src/test/Knowledge.test-kit.ts"],
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

/**
 * Build source-only test-kit alias targets for a workspace package.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { buildSourceOnlySubpathAliasTargets } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const targets = buildSourceOnlySubpathAliasTargets("@beep/repo-cli", "packages/tooling/tool/cli")
 * console.log(targets["@beep/repo-cli/test/Docgen"]) // "./packages/tooling/tool/cli/src/test/Docgen.test-kit.ts"
 * ```
 *
 * @param packageName - Workspace package whose source-only test-kit aliases are resolved.
 * @param packageRelativePath - Repo-relative package directory used to build target paths.
 * @returns A record mapping each source-only subpath alias key to its relative target file.
 * @category utilities
 * @since 0.0.0
 */
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncMode } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TsconfigSyncMode)("check")) // true
 * console.log(S.is(TsconfigSyncMode)("apply")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncMode = TsconfigSyncModeKit.pipe(
  $I.annoteSchema("TsconfigSyncMode", {
    description: "Command execution mode for tsconfig-sync.",
  })
);
/**
 * Pattern matcher for tsconfig-sync execution modes.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncModeMatch } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const describe = TsconfigSyncModeMatch({
 *   sync: () => "write files",
 *   check: () => "verify only",
 *   "dry-run": () => "preview only"
 * })
 * console.log(describe("check")) // "verify only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncModeMatch = TsconfigSyncModeKit.$match;

/**
 * Runtime type for tsconfig-sync execution modes.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { TsconfigSyncMode } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * type Example = TsconfigSyncMode
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigSyncMode = typeof TsconfigSyncMode.Type;
/**
 * Equivalence relation for tsconfig-sync modes.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { tsconfigSyncModeEquivalence } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(tsconfigSyncModeEquivalence("check", "check")) // true
 * console.log(tsconfigSyncModeEquivalence("check", "sync")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const tsconfigSyncModeEquivalence: {
  (that: TsconfigSyncMode): (self: TsconfigSyncMode) => boolean;
  (self: TsconfigSyncMode, that: TsconfigSyncMode): boolean;
} = dual(2, S.toEquivalence(TsconfigSyncMode));
/**
 * Tuple type for tsconfig-sync mode flags.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { TsconfigSyncModeFlags } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * type Example = TsconfigSyncModeFlags
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TsconfigSyncModeFlags = readonly [check: boolean, dryRun: boolean, write: boolean];

/**
 * Predicate for the --check flag precedence tuple.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { isCheckModeFlags } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * // flags are [check, dryRun, write]
 * console.log(isCheckModeFlags([true, false, false])) // true
 * console.log(isCheckModeFlags([false, true, false])) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCheckModeFlags = P.Tuple([P.isTruthy, P.isBoolean, P.isBoolean]);
/**
 * Predicate for the --dry-run flag precedence tuple.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { isDryRunModeFlags } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * // flags are [check, dryRun, write]
 * console.log(isDryRunModeFlags([false, true, false])) // true
 * console.log(isDryRunModeFlags([true, false, false])) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isDryRunModeFlags = P.Tuple([P.not(P.isTruthy), P.isTruthy, P.isBoolean]);
/**
 * Predicate for the --write flag precedence tuple.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { isWriteModeFlags } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * // flags are [check, dryRun, write]
 * console.log(isWriteModeFlags([false, false, true])) // true
 * console.log(isWriteModeFlags([true, false, false])) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isWriteModeFlags = P.Tuple([P.not(P.isTruthy), P.not(P.isTruthy), P.isTruthy]);

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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncRunOptions } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const value = "root-references"
 * console.log(S.is(TsconfigSyncRunOptions)(value)) // true
 * ```
 *
 * @returns Tagged union schema keyed by `mode`.
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { TsconfigSyncRunOptions } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const example: TsconfigSyncRunOptions | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TsconfigSyncRunOptions = typeof TsconfigSyncRunOptions.Type;

/**
 * Sync change section categories.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncSection } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const value = "root-references"
 * console.log(S.is(TsconfigSyncSection)(value)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncSection = LiteralKit([
  "root-references",
  "root-aliases",
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { TsconfigSyncSection } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const example: TsconfigSyncSection | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const value = "example"
 * console.log(S.is(TsconfigSyncChange)(value)) // true
 * ```
 *
 * @returns Tagged union schema keyed by `section`.
 * @category models
 * @since 0.0.0
 */
export const TsconfigSyncChange = TsconfigSyncSection.mapMembers(
  Tuple.evolve([
    () => RootReferencesChange,
    () => RootAliasesChange,
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const example: TsconfigSyncChange | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const value = "example"
 * console.log(S.is(PlannedFileChange)(value)) // true
 * ```
 *
 * @returns Tagged union schema keyed by `section`.
 * @category models
 * @since 0.0.0
 */
export const PlannedFileChange = TsconfigSyncSection.mapMembers(
  Tuple.evolve([
    () => RootReferencesPlannedFileChange,
    () => RootAliasesPlannedFileChange,
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const example: PlannedFileChange | undefined = undefined
 * console.log(example === undefined) // true
 * ```
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncResult } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const value = "example"
 * console.log(S.is(TsconfigSyncResult)(value)) // true
 * ```
 *
 * @returns Tagged union schema keyed by `mode`.
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { TsconfigSyncResult } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const example: TsconfigSyncResult | undefined = undefined
 * console.log(example === undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TsconfigSyncResult = typeof TsconfigSyncResult.Type;

/**
 * Workspace package descriptor with metadata for tsconfig synchronization.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { WorkspaceDescriptor } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const candidate = { name: "@beep/example", packageDir: "packages/example", tsconfigPath: "packages/example/tsconfig.json" }
 * console.log(S.is(WorkspaceDescriptor)(candidate)) // true
 * ```
 *
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
    hasDocgenConfig: S.Boolean,
    rootAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    wildcardAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    subpathAliasTargets: S.Record(S.String, S.String).pipe(S.UndefinedOr, S.optionalKey),
  },
  $I.annote("WorkspaceDescriptor", {
    description: "A workspace package descriptor with metadata for tsconfig synchronization.",
  })
) {}

/**
 * Generic JSON object schema for parsed config documents.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { JsonObject } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * const value = "example"
 * console.log(S.is(JsonObject)(value)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JsonObject = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("JsonObject", {
    description: "Generic JSON object document used for parsed docgen configs.",
  })
);

/**
 * Generic JSON object document used for parsed docgen configs.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import type { JsonObject } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const value: JsonObject = { compilerOptions: {} }
 * console.log("compilerOptions" in value) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type JsonObject = typeof JsonObject.Type;

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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigWithReferences } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const candidate = { references: [{ path: "./packages/example" }] }
 * console.log(S.is(TsconfigWithReferences)(candidate)) // true
 * ```
 *
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
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigWithPaths } from "@beep/repo-cli/commands/TsconfigSync"
 * import * as S from "effect/Schema"
 *
 * const candidate = { compilerOptions: { paths: { "@beep/example": ["./packages/example/src/index.ts"] } } }
 * console.log(S.is(TsconfigWithPaths)(candidate)) // true
 * ```
 *
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

/**
 * Workspace descriptor order by repo-relative directory.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { byWorkspaceRelativeDirAscending, WorkspaceDescriptor } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * const descriptor = WorkspaceDescriptor.make({
 *   packageName: "@beep/schema",
 *   absoluteDir: "/repo/packages/schema",
 *   relativeDir: "packages/schema",
 *   ownerTsconfigPath: undefined,
 *   hasProjectTsconfig: true,
 *   hasDocgenConfig: true
 * })
 * console.log(byWorkspaceRelativeDirAscending(descriptor, descriptor)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byWorkspaceRelativeDirAscending: {
  (that: WorkspaceDescriptor): (self: WorkspaceDescriptor) => Ordering.Ordering;
  (self: WorkspaceDescriptor, that: WorkspaceDescriptor): Ordering.Ordering;
} = dual(
  2,
  Order.mapInput(Str.orderAsc, (descriptor: WorkspaceDescriptor) => descriptor.relativeDir)
);
const plannedChangeFileOrder: Order.Order<PlannedFileChange> = Order.mapInput(
  Str.orderAsc,
  (change: PlannedFileChange) => change.filePath
);
const plannedChangeSectionOrder: Order.Order<PlannedFileChange> = Order.mapInput(
  Str.orderAsc,
  (change: PlannedFileChange) => change.section
);

/**
 * Planned-change order by file path.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { byPlannedChangeFileAscending, PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * const change = S.decodeUnknownSync(PlannedFileChange)({
 *   section: "root-references",
 *   filePath: "tsconfig.json",
 *   summary: "sync references",
 *   content: "{}"
 * })
 * console.log(byPlannedChangeFileAscending(change, change)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byPlannedChangeFileAscending: {
  (that: PlannedFileChange): (self: PlannedFileChange) => Ordering.Ordering;
  (self: PlannedFileChange, that: PlannedFileChange): Ordering.Ordering;
} = dual(2, plannedChangeFileOrder);
/**
 * Planned-change order by managed section.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { byPlannedChangeSectionAscending, PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * const change = S.decodeUnknownSync(PlannedFileChange)({
 *   section: "root-references",
 *   filePath: "tsconfig.json",
 *   summary: "sync references",
 *   content: "{}"
 * })
 * console.log(byPlannedChangeSectionAscending(change, change)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byPlannedChangeSectionAscending: {
  (that: PlannedFileChange): (self: PlannedFileChange) => Ordering.Ordering;
  (self: PlannedFileChange, that: PlannedFileChange): Ordering.Ordering;
} = dual(2, plannedChangeSectionOrder);
/**
 * Combined planned-change order for deterministic reporting.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { byPlannedChangeAscending, PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 * import * as S from "effect/Schema"
 *
 * const change = S.decodeUnknownSync(PlannedFileChange)({
 *   section: "root-references",
 *   filePath: "tsconfig.json",
 *   summary: "sync references",
 *   content: "{}"
 * })
 * console.log(byPlannedChangeAscending(change, change)) // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const byPlannedChangeAscending: {
  (that: PlannedFileChange): (self: PlannedFileChange) => Ordering.Ordering;
  (self: PlannedFileChange, that: PlannedFileChange): Ordering.Ordering;
} = dual(2, Order.combine(plannedChangeFileOrder, plannedChangeSectionOrder));

/**
 * Internal schema helpers consumed by tsconfig-sync planner modules.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { TsconfigSyncSchemaInternals } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(TsconfigSyncSchemaInternals.buildSourceOnlySubpathAliasTargets("@beep/repo-cli", "packages/tooling/tool/cli"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const TsconfigSyncSchemaInternals = {
  buildSourceOnlySubpathAliasTargets,
} as const;
