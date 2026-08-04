/**
 * Root config file updater for `create-package`.
 *
 * Adds project references to `tsconfig.packages.json` and path aliases
 * to `tsconfig.json` (JSONC-safe via `jsonc-parser`). All operations are
 * idempotent — existing entries are silently skipped.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { DomainError } from "@beep/repo-utils";
import { buildCanonicalAliasTargets } from "@beep/repo-utils/schemas/TsconfigAliasTargets";
import { SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, FileSystem, HashMap, Order, Path } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { applyJsoncModification as applySharedJsoncModification, decodeJsoncTextAs } from "../../internal/cli/Jsonc.ts";

const $I = $RepoCliId.create("commands/CreatePackage/ConfigUpdater");

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Summary of which root configuration files were modified during a config update pass.
 *
 * Each boolean field is `true` when the corresponding file was actually written
 * (or, in the case of {@link checkConfigNeedsUpdate}, would need updating).
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { ConfigUpdateResult } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { path: "tsconfig.json", updated: false }
 * console.log(S.is(ConfigUpdateResult)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigUpdateResult extends S.Class<ConfigUpdateResult>($I`ConfigUpdateResult`)(
  {
    tsconfigPackages: SchemaUtils.BoolKeyDefaultFalse,
    tsconfigPaths: SchemaUtils.BoolKeyDefaultFalse,
  },
  $I.annote("ConfigUpdateResult", {
    description: "Summary of root configuration files modified during a config update pass.",
  })
) {}

/**
 * Config update target for a package that should be registered in root tsconfig files.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { ConfigUpdateTarget } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { packageName: "@beep/example", packagePath: "packages/example" }
 * console.log(S.is(ConfigUpdateTarget)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigUpdateTarget extends S.Class<ConfigUpdateTarget>($I`ConfigUpdateTarget`)(
  {
    packageName: S.String,
    packagePath: S.String,
    rootAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
    wildcardAliasTarget: S.String.pipe(S.UndefinedOr, S.optionalKey),
  },
  $I.annote("ConfigUpdateTarget", {
    description: "Config update target for a package registered in root tsconfig files.",
  })
) {}

/**
 * Per-target config update summary.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { ConfigUpdateTargetResult } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { packageName: "@beep/example", packagePath: "packages/example", updated: false }
 * console.log(S.is(ConfigUpdateTargetResult)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigUpdateTargetResult extends S.Class<ConfigUpdateTargetResult>($I`ConfigUpdateTargetResult`)(
  {
    target: ConfigUpdateTarget,
    result: ConfigUpdateResult,
  },
  $I.annote("ConfigUpdateTargetResult", {
    description: "Per-target config update summary.",
  })
) {}

const DefaultedConfigUpdateTargetResults = S.Array(ConfigUpdateTargetResult).pipe(
  SchemaUtils.withEmptyArrayDefaults<ConfigUpdateTargetResult>()
);

/**
 * Batch config orchestration result for one or more package targets.
 *
 * `tsconfigPackages` and `tsconfigPaths` are aggregate booleans indicating whether
 * at least one target changed (or needs a change, in check mode) for the file.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { ConfigUpdateBatchResult } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { results: [], updated: false }
 * console.log(S.is(ConfigUpdateBatchResult)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigUpdateBatchResult extends S.Class<ConfigUpdateBatchResult>($I`ConfigUpdateBatchResult`)(
  {
    targets: DefaultedConfigUpdateTargetResults,
    tsconfigPackages: SchemaUtils.BoolKeyDefaultFalse,
    tsconfigPaths: SchemaUtils.BoolKeyDefaultFalse,
  },
  $I.annote("ConfigUpdateBatchResult", {
    description: "Batch config orchestration result for one or more package targets.",
  })
) {}

// ── Internal helpers ─────────────────────────────────────────────────────────

const stringArrayEquivalence = S.toEquivalence(S.Array(S.String));
const JsoncUnknownObject = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("JsoncUnknownObject", {
    description: "Generic decoded JSONC object document map.",
  })
);

const parseJsoncObject: {
  (content: string, filePath: string): Effect.Effect<Record<string, unknown>, DomainError>;
  (filePath: string): (content: string) => Effect.Effect<Record<string, unknown>, DomainError>;
} = dual(
  2,
  Effect.fn(function* (content, filePath) {
    return yield* decodeJsoncTextAs(JsoncUnknownObject)(content).pipe(
      Effect.mapError(DomainError.newCauseMessage(`Invalid JSONC in ${filePath}`))
    );
  })
);

const readReferences = (parsed: Record<string, unknown>): ReadonlyArray<unknown> =>
  A.isArray(parsed.references) ? A.fromIterable(parsed.references) : A.empty<unknown>();

const hasReferencePath: {
  (entry: unknown, target: string): boolean;
  (target: string): (entry: unknown) => boolean;
} = dual(
  2,
  (entry: unknown, target: string): boolean =>
    P.isObject(entry) && P.isString(entry.path) && Str.equivalence(entry.path, target)
);

const readPathsRecord = (parsed: Record<string, unknown>): Record<string, unknown> => {
  if (!P.isObject(parsed.compilerOptions)) return R.empty();
  if (!P.isObject(parsed.compilerOptions.paths)) return R.empty();
  return parsed.compilerOptions.paths;
};

const pathValuesEqual: {
  (currentValue: unknown, expectedValue: ReadonlyArray<string>): boolean;
  (expectedValue: ReadonlyArray<string>): (currentValue: unknown) => boolean;
} = dual(2, (currentValue: unknown, expectedValue: ReadonlyArray<string>): boolean => {
  if (!A.isArray(currentValue) || !A.every(currentValue, P.isString)) {
    return false;
  }

  return stringArrayEquivalence(currentValue, expectedValue);
});

const byPackagePathAscending: Order.Order<ConfigUpdateTarget> = Order.mapInput(
  Str.orderAsc,
  (target: ConfigUpdateTarget) => target.packagePath
);

const normalizeTargets = (targets: ReadonlyArray<ConfigUpdateTarget>): ReadonlyArray<ConfigUpdateTarget> => {
  let deduped = HashMap.empty<string, ConfigUpdateTarget>();
  for (const target of targets) {
    deduped = HashMap.set(deduped, target.packagePath, target);
  }

  return A.sort([...HashMap.values(deduped)], byPackagePathAscending);
};

const defaultAliasTargetsForPackage = (packagePath: string) =>
  buildCanonicalAliasTargets(packagePath, "./src/index.ts");

const aliasTargetsForTarget = (target: ConfigUpdateTarget) => ({
  rootAliasTarget: target.rootAliasTarget ?? defaultAliasTargetsForPackage(target.packagePath).rootAliasTarget,
  wildcardAliasTarget:
    target.wildcardAliasTarget ?? defaultAliasTargetsForPackage(target.packagePath).wildcardAliasTarget,
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
 * Read → transform → write-if-changed. Returns `true` when the file was
 * actually modified.
 */
const modifyFileString: {
  (
    filePath: string,
    transform: (content: string) => Effect.Effect<string, DomainError>
  ): Effect.Effect<boolean, DomainError, FileSystem.FileSystem>;
  (
    transform: (content: string) => Effect.Effect<string, DomainError>
  ): (filePath: string) => Effect.Effect<boolean, DomainError, FileSystem.FileSystem>;
} = dual(
  2,
  Effect.fn(function* (filePath, transform) {
    const fs = yield* FileSystem.FileSystem;
    const original = yield* fs
      .readFileString(filePath)
      .pipe(Effect.mapError(DomainError.newCauseMessage(`Failed to read ${filePath}`)));
    const transformed = yield* transform(original);
    if (Str.equivalence(transformed, original)) return false;
    yield* fs
      .writeFileString(filePath, transformed)
      .pipe(Effect.mapError(DomainError.newCauseMessage(`Failed to write ${filePath}`)));
    return true;
  })
);

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a project reference to `tsconfig.packages.json`.
 *
 * Idempotent: if the reference already exists, the file is left untouched.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { updateTsconfigPackages } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(updateTsconfigPackages("/repo", "packages/schema"))) // true
 * ```
 *
 * @param repoRoot - Absolute path to the repository root directory.
 * @param packagePath - Relative path from the repo root to the new package (e.g. `"packages/tooling/library/my-utils"`).
 * @returns `true` when the file was modified, `false` when the entry already existed.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
export const updateTsconfigPackages: {
  (repoRoot: string, packagePath: string): Effect.Effect<boolean, DomainError, FileSystem.FileSystem | Path.Path>;
  (packagePath: string): (repoRoot: string) => Effect.Effect<boolean, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, packagePath) {
    const path = yield* Path.Path;
    const filePath = path.join(repoRoot, "tsconfig.packages.json");

    return yield* modifyFileString(
      filePath,
      Effect.fn(function* (content: string) {
        const parsed = yield* parseJsoncObject(content, filePath);
        const references = readReferences(parsed);

        // Idempotency: skip if reference already present
        if (A.some(references, hasReferencePath(packagePath))) {
          return content;
        }

        return applyJsoncModification(content, ["references"], A.append(references, { path: packagePath }));
      })
    );
  })
);

/**
 * Add path aliases to `tsconfig.json` (JSONC-safe, preserves comments).
 *
 * Creates both a root alias (`@beep/<name>`) and a wildcard alias
 * (`@beep/<name>/*`) pointing at the package's `src/` directory.
 * Idempotent: if the alias already exists, the file is left untouched.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { updateTsconfigPaths, ConfigUpdateTarget } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const target = ConfigUpdateTarget.make({ packageName: "@beep/schema", packagePath: "packages/schema" })
 * console.log(Effect.isEffect(updateTsconfigPaths("/repo", target))) // true
 * ```
 *
 * @param repoRoot - Absolute path to the repository root directory.
 * @param packageName - Unscoped package name (e.g. `"my-utils"`).
 * @param packagePath - Relative path from the repo root to the new package (e.g. `"packages/tooling/library/my-utils"`).
 * @returns `true` when the file was modified, `false` when the aliases already existed.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
export const updateTsconfigPaths: {
  (
    repoRoot: string,
    target: ConfigUpdateTarget
  ): Effect.Effect<boolean, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    target: ConfigUpdateTarget
  ): (repoRoot: string) => Effect.Effect<boolean, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, target) {
    const path = yield* Path.Path;
    const filePath = path.join(repoRoot, "tsconfig.json");
    const alias = `@beep/${target.packageName}`;
    const { rootAliasTarget, wildcardAliasTarget } = aliasTargetsForTarget(target);

    return yield* modifyFileString(
      filePath,
      Effect.fn(function* (content: string) {
        const parsed = yield* parseJsoncObject(content, filePath);
        const paths = readPathsRecord(parsed);
        const hasBaseAlias = pathValuesEqual(paths[alias], [rootAliasTarget]);
        const hasWildcardAlias = pathValuesEqual(paths[`${alias}/*`], [wildcardAliasTarget]);

        // Idempotency: skip if both aliases already present
        if (hasBaseAlias && hasWildcardAlias) {
          return content;
        }

        const withBaseAlias = hasBaseAlias
          ? content
          : applyJsoncModification(content, ["compilerOptions", "paths", alias], [rootAliasTarget]);

        return hasWildcardAlias
          ? withBaseAlias
          : applyJsoncModification(withBaseAlias, ["compilerOptions", "paths", `${alias}/*`], [wildcardAliasTarget]);
      })
    );
  })
);

const updateRootConfigsForTarget: {
  (
    repoRoot: string,
    target: ConfigUpdateTarget
  ): Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    target: ConfigUpdateTarget
  ): (repoRoot: string) => Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, target) {
    const tsconfigPackages = yield* updateTsconfigPackages(repoRoot, target.packagePath);
    const tsconfigPaths = yield* updateTsconfigPaths(repoRoot, target);
    return ConfigUpdateResult.make({
      tsconfigPackages,
      tsconfigPaths,
    });
  })
);

const checkConfigNeedsUpdateForTarget: {
  (
    repoRoot: string,
    target: ConfigUpdateTarget
  ): Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    target: ConfigUpdateTarget
  ): (repoRoot: string) => Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, target) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const pkgsContent = yield* fs
      .readFileString(path.join(repoRoot, "tsconfig.packages.json"))
      .pipe(Effect.mapError(DomainError.newCauseMessage("Failed to read tsconfig.packages.json")));
    const pkgsParsed = yield* parseJsoncObject(pkgsContent, "tsconfig.packages.json");
    const references = readReferences(pkgsParsed);
    const tsconfigPackages = !A.some(references, hasReferencePath(target.packagePath));

    const rootContent = yield* fs
      .readFileString(path.join(repoRoot, "tsconfig.json"))
      .pipe(Effect.mapError(DomainError.newCauseMessage("Failed to read tsconfig.json")));
    const rootParsed = yield* parseJsoncObject(rootContent, "tsconfig.json");
    const paths = readPathsRecord(rootParsed);
    const alias = `@beep/${target.packageName}`;
    const { rootAliasTarget, wildcardAliasTarget } = aliasTargetsForTarget(target);
    const tsconfigPaths = !(
      pathValuesEqual(paths[alias], [rootAliasTarget]) && pathValuesEqual(paths[`${alias}/*`], [wildcardAliasTarget])
    );

    return ConfigUpdateResult.make({
      tsconfigPackages,
      tsconfigPaths,
    });
  })
);

/**
 * Batch root config updater for slice flows creating multiple packages.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { updateRootConfigsForTargets, ConfigUpdateTarget } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const target = ConfigUpdateTarget.make({ packageName: "@beep/schema", packagePath: "packages/schema" })
 * console.log(Effect.isEffect(updateRootConfigsForTargets("/repo", [target]))) // true
 * ```
 *
 * @param repoRoot - Absolute path to repository root.
 * @param targets - Package targets to register in root tsconfig files.
 * @returns Per-target results and aggregate booleans indicating whether each file changed for at least one target.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
export const updateRootConfigsForTargets: {
  (
    repoRoot: string,
    targets: ReadonlyArray<ConfigUpdateTarget>
  ): Effect.Effect<ConfigUpdateBatchResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    targets: ReadonlyArray<ConfigUpdateTarget>
  ): (repoRoot: string) => Effect.Effect<ConfigUpdateBatchResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, targets) {
    const normalizedTargets = normalizeTargets(targets);
    const targetResults = yield* Effect.forEach(normalizedTargets, (target) =>
      Effect.map(updateRootConfigsForTarget(repoRoot, target), (result) =>
        ConfigUpdateTargetResult.make({
          target,
          result,
        })
      )
    );

    return ConfigUpdateBatchResult.make({
      targets: targetResults,
      tsconfigPackages: A.some(targetResults, ({ result }) => result.tsconfigPackages),
      tsconfigPaths: A.some(targetResults, ({ result }) => result.tsconfigPaths),
    });
  })
);

/**
 * Batch read-only drift checker for root config updates.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { checkConfigNeedsUpdateForTargets, ConfigUpdateTarget } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const target = ConfigUpdateTarget.make({ packageName: "@beep/schema", packagePath: "packages/schema" })
 * console.log(Effect.isEffect(checkConfigNeedsUpdateForTargets("/repo", [target]))) // true
 * ```
 *
 * @param repoRoot - Absolute path to repository root.
 * @param targets - Package targets to check in root tsconfig files.
 * @returns Per-target results and aggregate booleans indicating whether each file needs updates for at least one target.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
export const checkConfigNeedsUpdateForTargets: {
  (
    repoRoot: string,
    targets: ReadonlyArray<ConfigUpdateTarget>
  ): Effect.Effect<ConfigUpdateBatchResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    targets: ReadonlyArray<ConfigUpdateTarget>
  ): (repoRoot: string) => Effect.Effect<ConfigUpdateBatchResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, targets) {
    const normalizedTargets = normalizeTargets(targets);
    const targetResults = yield* Effect.forEach(normalizedTargets, (target) =>
      Effect.map(checkConfigNeedsUpdateForTarget(repoRoot, target), (result) =>
        ConfigUpdateTargetResult.make({
          target,
          result,
        })
      )
    );

    return ConfigUpdateBatchResult.make({
      targets: targetResults,
      tsconfigPackages: A.some(targetResults, ({ result }) => result.tsconfigPackages),
      tsconfigPaths: A.some(targetResults, ({ result }) => result.tsconfigPaths),
    });
  })
);

/**
 * Orchestrate all root config updates for a newly created package.
 *
 * Single-target wrapper around {@link updateRootConfigsForTargets}.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { updateRootConfigs, ConfigUpdateTarget } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const target = ConfigUpdateTarget.make({ packageName: "@beep/schema", packagePath: "packages/schema" })
 * console.log(Effect.isEffect(updateRootConfigs("/repo", target))) // true
 * ```
 *
 * @param repoRoot - Absolute path to the repository root directory.
 * @param target - Package target to register in root config files.
 * @returns A {@link ConfigUpdateResult} indicating which config files were modified.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
export const updateRootConfigs: {
  (
    repoRoot: string,
    target: ConfigUpdateTarget
  ): Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    target: ConfigUpdateTarget
  ): (repoRoot: string) => Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, target) {
    const batchResult = yield* updateRootConfigsForTargets(repoRoot, [target]);
    return batchResult.targets[0]?.result ?? ConfigUpdateResult.make({});
  })
);

/**
 * Check whether config entries already exist (for dry-run output).
 *
 * Single-target wrapper around {@link checkConfigNeedsUpdateForTargets}.
 *
 * **Example** (Update package configuration)
 *
 * ```ts
 * import { checkConfigNeedsUpdate, ConfigUpdateTarget } from "@beep/repo-cli/commands/CreatePackage"
 * import { Effect } from "effect"
 *
 * const target = ConfigUpdateTarget.make({ packageName: "@beep/schema", packagePath: "packages/schema" })
 * console.log(Effect.isEffect(checkConfigNeedsUpdate("/repo", target))) // true
 * ```
 *
 * @param repoRoot - Absolute path to the repository root directory.
 * @param target - Package target to check in root config files.
 * @returns A {@link ConfigUpdateResult} where `true` means the file still needs updating.
 * @depends FileSystem, Path
 * @category utilities
 * @since 0.0.0
 */
export const checkConfigNeedsUpdate: {
  (
    repoRoot: string,
    target: ConfigUpdateTarget
  ): Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
  (
    target: ConfigUpdateTarget
  ): (repoRoot: string) => Effect.Effect<ConfigUpdateResult, DomainError, FileSystem.FileSystem | Path.Path>;
} = dual(
  2,
  Effect.fn(function* (repoRoot, target) {
    const batchResult = yield* checkConfigNeedsUpdateForTargets(repoRoot, [target]);
    return batchResult.targets[0]?.result ?? ConfigUpdateResult.make({});
  })
);
