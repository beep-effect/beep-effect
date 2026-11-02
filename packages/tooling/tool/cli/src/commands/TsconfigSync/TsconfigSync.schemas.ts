/**
 * Schemas and derived ordering helpers for tsconfig-sync.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
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
 * Filename of the package check overlay that mirrors the canonical `tsconfig.json` references.
 *
 * **Example** (Use tsconfig-sync schemas)
 *
 * ```ts
 * import { CHECK_TSCONFIG_FILENAME } from "@beep/repo-cli/commands/TsconfigSync/TsconfigSync.schemas"
 *
 * console.log(CHECK_TSCONFIG_FILENAME) // "tsconfig.check.json"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const CHECK_TSCONFIG_FILENAME = "tsconfig.check.json" as const;

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
export const BeepScopedPackageName = S.String.check(S.isStartingWith("@beep/")).pipe(
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
 * import * as Order from "effect/Order";
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
] as const satisfies ReadonlyArray<SourceOnlyTestKitAlias>;
const mcpKitPackageName = "@beep/mcp-kit" as const;
const mcpKitSourceOnlyTestKitAliases = [
  ["@beep/mcp-kit/test/Conformance", "src/test/Conformance.test-kit.ts"],
] as const satisfies ReadonlyArray<SourceOnlyTestKitAlias>;

const sourceOnlyTestKitAliasesForPackage = (packageName: string): ReadonlyArray<SourceOnlyTestKitAlias> => {
  if (Str.equivalence(packageName, repoCliPackageName)) {
    return repoCliSourceOnlyTestKitAliases;
  }

  if (Str.equivalence(packageName, schemaPackageName)) {
    return schemaSourceOnlyTestKitAliases;
  }

  if (Str.equivalence(packageName, mcpKitPackageName)) {
    return mcpKitSourceOnlyTestKitAliases;
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
export const TsconfigSyncModeMatch = TsconfigSyncModeKit.match;

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

/**
 * Runtime options for sync mode execution.
 *
 * **Example** (Build sync-mode options for one package)
 *
 * ```ts
 * import { TsconfigSyncRunOptionsSync } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const options = TsconfigSyncRunOptionsSync.make({ filter: "@beep/schema", verbose: true })
 *
 * console.log(options.mode) // => "sync"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigSyncRunOptionsSync extends S.Opaque<
  TsconfigSyncRunOptionsSync,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    mode: S.tag("sync"),
    filter: S.String.pipe(S.UndefinedOr, S.optionalKey),
    verbose: S.Boolean,
  }).pipe(
    $I.annoteSchema("TsconfigSyncRunOptionsSync", {
      description: "Runtime options for sync mode execution.",
    })
  )
) {}

/**
 * Runtime options for check mode execution.
 *
 * **Example** (Build check-mode options for the whole repo)
 *
 * ```ts
 * import { TsconfigSyncRunOptionsCheck } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const options = TsconfigSyncRunOptionsCheck.make({ verbose: false })
 *
 * console.log(options.mode) // => "check"
 * console.log(options.filter) // => undefined
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigSyncRunOptionsCheck extends S.Opaque<
  TsconfigSyncRunOptionsCheck,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    mode: S.tag("check"),
    filter: S.String.pipe(S.UndefinedOr, S.optionalKey),
    verbose: S.Boolean,
  }).pipe(
    $I.annoteSchema("TsconfigSyncRunOptionsCheck", {
      description: "Runtime options for check mode execution.",
    })
  )
) {}

/**
 * Runtime options for dry-run mode execution.
 *
 * **Example** (Preview changes for one package without writing)
 *
 * ```ts
 * import { TsconfigSyncRunOptions, TsconfigSyncRunOptionsDryRun } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const options = TsconfigSyncRunOptionsDryRun.make({ filter: "@beep/repo-utils", verbose: true })
 *
 * console.log(options.mode) // => "dry-run"
 * console.log(TsconfigSyncRunOptions.guards["dry-run"](options)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigSyncRunOptionsDryRun extends S.Opaque<
  TsconfigSyncRunOptionsDryRun,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    mode: S.tag("dry-run"),
    filter: S.String.pipe(S.UndefinedOr, S.optionalKey),
    verbose: S.Boolean,
  }).pipe(
    $I.annoteSchema("TsconfigSyncRunOptionsDryRun", {
      description: "Runtime options for dry-run mode execution.",
    })
  )
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
  "package-check-references",
  "package-docgen",
  "root-vitest-aliases",
  "root-fallow-boundaries",
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

/**
 * Planned change entry for root tsconfig references.
 *
 * **Example** (Report drift in the root project references)
 *
 * ```ts
 * import { RootReferencesChange, TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = RootReferencesChange.make({
 *   filePath: "tsconfig.packages.json",
 *   summary: "add reference ./packages/drivers/box"
 * })
 *
 * console.log(change.section) // => "root-references"
 * console.log(TsconfigSyncChange.guards["root-references"](change)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootReferencesChange extends S.Opaque<RootReferencesChange, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-references"),
  }).pipe(
    $I.annoteSchema("RootReferencesChange", {
      description: "Planned change entry for root tsconfig references.",
    })
  )
) {}

/**
 * Planned change entry for root tsconfig aliases.
 *
 * **Example** (Report a missing root path alias)
 *
 * ```ts
 * import { RootAliasesChange, TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = RootAliasesChange.make({
 *   filePath: "tsconfig.base.json",
 *   summary: "add alias @beep/box/*"
 * })
 *
 * console.log(TsconfigSyncChange.isAnyOf(["root-aliases", "root-vitest-aliases"])(change)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootAliasesChange extends S.Opaque<RootAliasesChange, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-aliases"),
  }).pipe(
    $I.annoteSchema("RootAliasesChange", {
      description: "Planned change entry for root tsconfig aliases.",
    })
  )
) {}

/**
 * Planned change entry for root syncpack config.
 *
 * **Example** (Report a syncpack version-group update)
 *
 * ```ts
 * import { RootSyncpackChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = RootSyncpackChange.make({
 *   filePath: "syncpack.config.ts",
 *   summary: "pin @beep/* workspace dependencies to workspace:^"
 * })
 *
 * console.log(`${change.section}: ${change.summary}`) // => "root-syncpack: pin @beep/* workspace dependencies to workspace:^"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootSyncpackChange extends S.Opaque<RootSyncpackChange, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-syncpack"),
  }).pipe(
    $I.annoteSchema("RootSyncpackChange", {
      description: "Planned change entry for root syncpack config.",
    })
  )
) {}

/**
 * Planned change entry for package-level tsconfig references.
 *
 * **Example** (Report a package tsconfig that lost a reference)
 *
 * ```ts
 * import { PackageReferencesChange, TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = PackageReferencesChange.make({
 *   filePath: "packages/drivers/box/tsconfig.json",
 *   summary: "add reference ../../foundation/modeling/schema"
 * })
 *
 * console.log(TsconfigSyncChange.guards["package-references"](change)) // => true
 * console.log(TsconfigSyncChange.guards["package-check-references"](change)) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageReferencesChange extends S.Opaque<PackageReferencesChange, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-references"),
  }).pipe(
    $I.annoteSchema("PackageReferencesChange", {
      description: "Planned change entry for package-level tsconfig references.",
    })
  )
) {}

/**
 * Planned change entry for package tsconfig.check.json overlay references.
 *
 * **Example** (Report drift in a package check tsconfig)
 *
 * ```ts
 * import { CHECK_TSCONFIG_FILENAME, PackageCheckReferencesChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = PackageCheckReferencesChange.make({
 *   filePath: `packages/drivers/box/${CHECK_TSCONFIG_FILENAME}`,
 *   summary: "add reference ../../tooling/test-kit/test-utils"
 * })
 *
 * console.log(change.filePath) // => "packages/drivers/box/tsconfig.check.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageCheckReferencesChange extends S.Opaque<
  PackageCheckReferencesChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-check-references"),
  }).pipe(
    $I.annoteSchema("PackageCheckReferencesChange", {
      description: "Planned change entry for package tsconfig.check.json overlay references.",
    })
  )
) {}

/**
 * Planned change entry for package docgen configs.
 *
 * **Example** (Report docgen compiler paths that drifted)
 *
 * ```ts
 * import { DOCGEN_CONFIG_FILENAME, PackageDocgenChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = PackageDocgenChange.make({
 *   filePath: `packages/drivers/box/${DOCGEN_CONFIG_FILENAME}`,
 *   summary: "update examplesCompilerOptions.paths for @beep/schema"
 * })
 *
 * console.log(change.section) // => "package-docgen"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageDocgenChange extends S.Opaque<PackageDocgenChange, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-docgen"),
  }).pipe(
    $I.annoteSchema("PackageDocgenChange", {
      description: "Planned change entry for package docgen configs.",
    })
  )
) {}

/**
 * Planned change entry for the generated root Vitest alias data.
 *
 * **Example** (Report a missing vitest resolve alias)
 *
 * ```ts
 * import { RootVitestAliasesChange, TsconfigSyncChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = RootVitestAliasesChange.make({
 *   filePath: "vitest.shared.ts",
 *   summary: "add alias @beep/repo-cli/test/Yeet"
 * })
 *
 * const label = TsconfigSyncChange.match(change, {
 *   "root-references": () => "references",
 *   "root-aliases": () => "aliases",
 *   "root-syncpack": () => "syncpack",
 *   "package-references": () => "references",
 *   "package-check-references": () => "references",
 *   "package-docgen": () => "docgen",
 *   "root-vitest-aliases": () => "vitest",
 *   "root-fallow-boundaries": () => "fallow"
 * })
 *
 * console.log(label) // => "vitest"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootVitestAliasesChange extends S.Opaque<RootVitestAliasesChange, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-vitest-aliases"),
  }).pipe(
    $I.annoteSchema("RootVitestAliasesChange", {
      description: "Planned change entry for the generated root Vitest alias data.",
    })
  )
) {}

/**
 * Planned change entry for the generated Fallow boundary config.
 *
 * **Example** (Report a fallow boundary that needs a new zone)
 *
 * ```ts
 * import { RootFallowBoundariesChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const change = RootFallowBoundariesChange.make({
 *   filePath: ".fallowrc.json",
 *   summary: "add boundary zone packages/drivers/box"
 * })
 *
 * console.log(change.section) // => "root-fallow-boundaries"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootFallowBoundariesChange extends S.Opaque<
  RootFallowBoundariesChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-fallow-boundaries"),
  }).pipe(
    $I.annoteSchema("RootFallowBoundariesChange", {
      description: "Planned change entry for the generated Fallow boundary config.",
    })
  )
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
    () => PackageCheckReferencesChange,
    () => PackageDocgenChange,
    () => RootVitestAliasesChange,
    () => RootFallowBoundariesChange,
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

/**
 * Planned file content change for root tsconfig references.
 *
 * **Example** (Order planned writes by file path)
 *
 * ```ts
 * import { byPlannedChangeAscending, RootAliasesPlannedFileChange, RootReferencesPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const references = RootReferencesPlannedFileChange.make({
 *   filePath: "tsconfig.packages.json",
 *   summary: "add reference ./packages/drivers/box",
 *   content: "{ \"references\": [{ \"path\": \"./packages/drivers/box\" }] }\n"
 * })
 * const aliases = RootAliasesPlannedFileChange.make({
 *   filePath: "tsconfig.base.json",
 *   summary: "add alias @beep/box/*",
 *   content: "{ \"compilerOptions\": { \"paths\": {} } }\n"
 * })
 *
 * console.log(byPlannedChangeAscending(aliases, references)) // => -1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootReferencesPlannedFileChange extends S.Opaque<
  RootReferencesPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-references"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("RootReferencesPlannedFileChange", {
      description: "Planned file content change for root tsconfig references.",
    })
  )
) {}

/**
 * Planned file content change for root tsconfig aliases.
 *
 * **Example** (Carry the rewritten base tsconfig)
 *
 * ```ts
 * import { PlannedFileChange, RootAliasesPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const planned = RootAliasesPlannedFileChange.make({
 *   filePath: "tsconfig.base.json",
 *   summary: "add alias @beep/box/*",
 *   content: "{ \"compilerOptions\": { \"paths\": { \"@beep/box/*\": [\"./packages/drivers/box/src/*.ts\"] } } }\n"
 * })
 *
 * console.log(PlannedFileChange.guards["root-aliases"](planned)) // => true
 * console.log(planned.content.includes("@beep/box/*")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootAliasesPlannedFileChange extends S.Opaque<
  RootAliasesPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-aliases"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("RootAliasesPlannedFileChange", {
      description: "Planned file content change for root tsconfig aliases.",
    })
  )
) {}

/**
 * Planned file content change for root syncpack config.
 *
 * **Example** (Carry the rewritten syncpack config)
 *
 * ```ts
 * import { RootSyncpackPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const planned = RootSyncpackPlannedFileChange.make({
 *   filePath: "syncpack.config.ts",
 *   summary: "add @beep/box to the workspace version group",
 *   content: "export default { versionGroups: [] }\n"
 * })
 *
 * console.log(planned.content.startsWith("export default")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootSyncpackPlannedFileChange extends S.Opaque<
  RootSyncpackPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-syncpack"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("RootSyncpackPlannedFileChange", {
      description: "Planned file content change for root syncpack config.",
    })
  )
) {}

/**
 * Planned file content change for package tsconfig references.
 *
 * **Example** (Order two writes to the same file by section)
 *
 * ```ts
 * import { byPlannedChangeSectionAscending, PackageDocgenPlannedFileChange, PackageReferencesPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const references = PackageReferencesPlannedFileChange.make({
 *   filePath: "packages/drivers/box/tsconfig.json",
 *   summary: "add reference ../../foundation/modeling/schema",
 *   content: "{ \"references\": [{ \"path\": \"../../foundation/modeling/schema\" }] }\n"
 * })
 * const docgen = PackageDocgenPlannedFileChange.make({
 *   filePath: "packages/drivers/box/docgen.json",
 *   summary: "update examplesCompilerOptions.paths",
 *   content: "{ \"examplesCompilerOptions\": {} }\n"
 * })
 *
 * console.log(byPlannedChangeSectionAscending(docgen, references)) // => -1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageReferencesPlannedFileChange extends S.Opaque<
  PackageReferencesPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-references"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("PackageReferencesPlannedFileChange", {
      description: "Planned file content change for package tsconfig references.",
    })
  )
) {}

/**
 * Planned file content change for package tsconfig.check.json overlay references.
 *
 * **Example** (Carry the rewritten check tsconfig)
 *
 * ```ts
 * import { PackageCheckReferencesPlannedFileChange, PlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const planned = PackageCheckReferencesPlannedFileChange.make({
 *   filePath: "packages/drivers/box/tsconfig.check.json",
 *   summary: "add reference ../../tooling/test-kit/test-utils",
 *   content: "{ \"extends\": \"./tsconfig.json\", \"references\": [] }\n"
 * })
 *
 * console.log(PlannedFileChange.isAnyOf(["package-references", "package-check-references"])(planned)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageCheckReferencesPlannedFileChange extends S.Opaque<
  PackageCheckReferencesPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-check-references"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("PackageCheckReferencesPlannedFileChange", {
      description: "Planned file content change for package tsconfig.check.json overlay references.",
    })
  )
) {}

/**
 * Planned file content change for package docgen configs.
 *
 * **Example** (Carry the rewritten docgen config)
 *
 * ```ts
 * import { PackageDocgenPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const planned = PackageDocgenPlannedFileChange.make({
 *   filePath: "packages/drivers/box/docgen.json",
 *   summary: "update examplesCompilerOptions.paths for @beep/schema",
 *   content: "{ \"examplesCompilerOptions\": { \"paths\": {} } }\n"
 * })
 *
 * console.log(`${planned.section} -> ${planned.filePath}`) // => "package-docgen -> packages/drivers/box/docgen.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageDocgenPlannedFileChange extends S.Opaque<
  PackageDocgenPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("package-docgen"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("PackageDocgenPlannedFileChange", {
      description: "Planned file content change for package docgen configs.",
    })
  )
) {}

/**
 * Planned file content change for the generated root Vitest alias data.
 *
 * **Example** (Carry the rewritten vitest alias table)
 *
 * ```ts
 * import { RootVitestAliasesPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const planned = RootVitestAliasesPlannedFileChange.make({
 *   filePath: "vitest.shared.ts",
 *   summary: "add alias @beep/repo-cli/test/Yeet",
 *   content: "export const aliases = { \"@beep/repo-cli/test/Yeet\": \"./packages/tooling/tool/cli/src/test/Yeet.test-kit.ts\" }\n"
 * })
 *
 * console.log(planned.content.includes("Yeet.test-kit.ts")) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootVitestAliasesPlannedFileChange extends S.Opaque<
  RootVitestAliasesPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-vitest-aliases"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("RootVitestAliasesPlannedFileChange", {
      description: "Planned file content change for the generated root Vitest alias data.",
    })
  )
) {}

/**
 * Planned file content change for the generated Fallow boundary config.
 *
 * **Example** (Carry the rewritten fallow boundaries)
 *
 * ```ts
 * import { PlannedFileChange, RootFallowBoundariesPlannedFileChange } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const planned = RootFallowBoundariesPlannedFileChange.make({
 *   filePath: ".fallowrc.json",
 *   summary: "add boundary zone packages/drivers/box",
 *   content: "{ \"boundaries\": { \"zones\": [] } }\n"
 * })
 *
 * console.log(PlannedFileChange.guards["root-fallow-boundaries"](planned)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RootFallowBoundariesPlannedFileChange extends S.Opaque<
  RootFallowBoundariesPlannedFileChange,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    filePath: S.String,
    summary: S.String,
    section: S.tag("root-fallow-boundaries"),
    content: S.String,
  }).pipe(
    $I.annoteSchema("RootFallowBoundariesPlannedFileChange", {
      description: "Planned file content change for the generated Fallow boundary config.",
    })
  )
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
    () => PackageCheckReferencesPlannedFileChange,
    () => PackageDocgenPlannedFileChange,
    () => RootVitestAliasesPlannedFileChange,
    () => RootFallowBoundariesPlannedFileChange,
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

/**
 * Sync mode result payload.
 *
 * **Example** (Summarize an applied sync)
 *
 * ```ts
 * import { RootAliasesChange, TsconfigSyncResultSync } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const result = TsconfigSyncResultSync.make({
 *   changedFiles: 1,
 *   changes: [RootAliasesChange.make({ filePath: "tsconfig.base.json", summary: "add alias @beep/box/*" })]
 * })
 *
 * console.log(`${result.mode}: ${result.changedFiles} file(s)`) // => "sync: 1 file(s)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigSyncResultSync extends S.Opaque<TsconfigSyncResultSync, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("sync"),
    changedFiles: S.Finite,
    changes: S.Array(TsconfigSyncChange),
  }).pipe(
    $I.annoteSchema("TsconfigSyncResultSync", {
      description: "Sync mode result payload.",
    })
  )
) {}

/**
 * Check mode result payload.
 *
 * **Example** (Fail a check run that found drift)
 *
 * ```ts
 * import { PackageReferencesChange, TsconfigSyncResult, TsconfigSyncResultCheck } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const result = TsconfigSyncResultCheck.make({
 *   changedFiles: 1,
 *   changes: [PackageReferencesChange.make({ filePath: "packages/drivers/box/tsconfig.json", summary: "add reference ../../foundation/modeling/schema" })]
 * })
 * const exitCode = TsconfigSyncResult.guards.check(result) && result.changedFiles > 0 ? 1 : 0
 *
 * console.log(exitCode) // => 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigSyncResultCheck extends S.Opaque<TsconfigSyncResultCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("check"),
    changedFiles: S.Finite,
    changes: S.Array(TsconfigSyncChange),
  }).pipe(
    $I.annoteSchema("TsconfigSyncResultCheck", {
      description: "Check mode result payload.",
    })
  )
) {}

/**
 * Dry-run mode result payload.
 *
 * **Example** (Report a dry run with no drift)
 *
 * ```ts
 * import { TsconfigSyncResultDryRun } from "@beep/repo-cli/commands/TsconfigSync"
 *
 * const result = TsconfigSyncResultDryRun.make({ changedFiles: 0, changes: [] })
 *
 * console.log(result.mode) // => "dry-run"
 * console.log(result.changes.length) // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TsconfigSyncResultDryRun extends S.Opaque<TsconfigSyncResultDryRun, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("dry-run"),
    changedFiles: S.Finite,
    changes: S.Array(TsconfigSyncChange),
  }).pipe(
    $I.annoteSchema("TsconfigSyncResultDryRun", {
      description: "Dry-run mode result payload.",
    })
  )
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
export class WorkspaceDescriptor extends S.Opaque<WorkspaceDescriptor, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.String,
    absoluteDir: S.String,
    relativeDir: S.String,
    ownerTsconfigPath: S.UndefinedOr(S.String),
    hasProjectTsconfig: S.Boolean,
    hasCheckTsconfig: S.Boolean,
    hasDocgenConfig: S.Boolean,
    rootAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    wildcardAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    subpathAliasTargets: S.Record(S.String, S.String).pipe(S.UndefinedOr, S.optionalKey),
  }).pipe(
    $I.annoteSchema("WorkspaceDescriptor", {
      description: "A workspace package descriptor with metadata for tsconfig synchronization.",
    })
  )
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
 *   hasCheckTsconfig: true,
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
