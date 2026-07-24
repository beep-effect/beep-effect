/**
 * Effect-based monorepo utilities for repository analysis and workspace management.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */
// cspell:ignore codegraph tsmorph
// biome-ignore-all assist/source/organizeImports: docgen requires individually documented re-export declarations.

/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  extractWorkspaceDependencies,
} from "./Dependencies.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  buildRepoDependencyIndex,
} from "./DependencyIndex.ts";
/**
 * @category errors
 * @since 0.0.0
 */
export {
  /**
   * @category errors
   * @since 0.0.0
   */
  CyclicDependencyError,
  /**
   * @category errors
   * @since 0.0.0
   */
  DomainError,
  /**
   * @category errors
   * @since 0.0.0
   */
  NoSuchFileError,
} from "./errors/index.ts";
/**
 * Filesystem utility service tag.
 *
 * @example
 * ```ts
 * import { FsUtils } from "@beep/repo-utils"
 * console.log(FsUtils)
 * ```
 * @category models
 * @since 0.0.0
 */
export { FsUtils } from "./FsUtils.ts";
/**
 * Live layer for the filesystem utility service.
 *
 * @example
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * console.log(FsUtilsLive)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export { FsUtilsLive } from "./FsUtils.ts";
/**
 * Service shape implemented by `FsUtils` providers.
 *
 * @example
 * ```ts
 * import type { FsUtilsShape } from "@beep/repo-utils"
 * const key = "readJson" satisfies keyof FsUtilsShape
 * console.log(key)
 * ```
 * @category models
 * @since 0.0.0
 */
export type { FsUtilsShape } from "./FsUtils.ts";
/**
 * Options accepted by filesystem glob helpers.
 *
 * @example
 * ```ts
 * import { GlobOptions } from "@beep/repo-utils"
 * const options = GlobOptions.make({ cwd: "src" })
 * console.log(options.cwd)
 * ```
 * @category models
 * @since 0.0.0
 */
export { GlobOptions } from "./FsUtils.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category predicates
   * @since 0.0.0
   */
  exists,
  /**
   * @category utilities
   * @since 0.0.0
   */
  findNearestPackageDir,
  /**
   * @category utilities
   * @since 0.0.0
   */
  walkFiles,
} from "./FsUtils.ts";
/**
 * @category models
 * @since 0.0.0
 */
export type {
  /**
   * @category models
   * @since 0.0.0
   */
  WalkFilesOptions,
  /**
   * @category models
   * @since 0.0.0
   */
  WalkFilesSymlinkGuard,
} from "./FsUtils.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  computeTransitiveClosure,
  /**
   * @category utilities
   * @since 0.0.0
   */
  detectCycles,
  /**
   * @category utilities
   * @since 0.0.0
   */
  topologicalSort,
} from "./Graph.ts";
/**
 * @category serialization
 * @since 0.0.0
 */
export {
  /**
   * @category serialization
   * @since 0.0.0
   */
  jsonParse,
  /**
   * @category serialization
   * @since 0.0.0
   */
  jsonStringifyCompact,
  /**
   * @category serialization
   * @since 0.0.0
   */
  jsonStringifyPretty,
} from "./JsonUtils.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  findRepoRoot,
} from "./Root.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category constants
   * @since 0.0.0
   */
  END_OF_OPTIONS,
  /**
   * @category guards
   * @since 0.0.0
   */
  guardLiteralArg,
  /**
   * @category guards
   * @since 0.0.0
   */
  guardLiteralArgs,
  /**
   * @category combinators
   * @since 0.0.0
   */
  insertEndOfOptions,
  /**
   * @category predicates
   * @since 0.0.0
   */
  isOptionLike,
  /**
   * @category schemas
   * @since 0.0.0
   */
  LiteralArg,
  /**
   * @category combinators
   * @since 0.0.0
   */
  toLiteralArgs,
} from "./ProcessArgs.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export {
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodePackageJson,
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodePackageJsonEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodePackageJsonExit,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodePackageJsonEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodePackageJsonPrettyEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodePackageJsonToJsonEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  NpmPackageJson,
  /**
   * @category schemas
   * @since 0.0.0
   */
  PackageJson,
  /**
   * @category parsing
   * @since 0.0.0
   */
  readPackageJsonFile,
} from "./schemas/PackageJson.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export {
  /**
   * @category schemas
   * @since 0.0.0
   */
  applyPackageJsonPatchEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  diffPackageJsonEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodePackageJsonCanonicalPrettyEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  getPackageJsonSchemaIssues,
  /**
   * @category schemas
   * @since 0.0.0
   */
  normalizePackageJsonEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  npmPackageJsonJsonSchema,
  /**
   * @category schemas
   * @since 0.0.0
   */
  PackageJsonValidationIssue,
  /**
   * @category schemas
   * @since 0.0.0
   */
  packageJsonJsonSchema,
} from "./schemas/PackageJsonTools.ts";
/**
 * @category schemas
 * @since 0.0.0
 */
export {
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodeTSConfig,
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodeTSConfigEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodeTSConfigExit,
  /**
   * @category schemas
   * @since 0.0.0
   */
  decodeTSConfigFromJsoncTextEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodeTSConfigEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodeTSConfigPrettyEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  encodeTSConfigToJsonEffect,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSConfig,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSConfigBuildOptions,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSConfigCompilerOptions,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSConfigReference,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSConfigTypeAcquisition,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSConfigWatchOptions,
  /**
   * @category schemas
   * @since 0.0.0
   */
  TSNodeConfig,
} from "./schemas/TSConfig.ts";
/**
 * @category models
 * @since 0.0.0
 */
export {
  /**
   * @category models
   * @since 0.0.0
   */
  type DependencyRecord,
  /**
   * @category models
   * @since 0.0.0
   */
  emptyWorkspaceDeps,
  /**
   * @category models
   * @since 0.0.0
   */
  WorkspaceDeps,
} from "./schemas/WorkspaceDeps.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export * from "./TSMorph/index.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  collectTsConfigPaths,
} from "./TsConfig.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export * from "./TypeScript/index.ts";
/**
 * Collect unique NPM dependency names from the workspace graph.
 *
 * @example
 * ```ts
 * import { collectUniqueNpmDependencies } from "@beep/repo-utils"
 * console.log(collectUniqueNpmDependencies)
 * ```
 * @category utilities
 * @since 0.0.0
 */
export { collectUniqueNpmDependencies } from "./UniqueDeps.ts";
/**
 * Result model for unique NPM dependency aggregation.
 *
 * @example
 * ```ts
 * import { UniqueNpmDeps } from "@beep/repo-utils"
 * const deps = UniqueNpmDeps.make({
 *   dependencies: ["effect"],
 *   devDependencies: ["vitest"]
 * })
 * console.log(deps)
 * ```
 * @category models
 * @since 0.0.0
 */
export { UniqueNpmDeps } from "./UniqueDeps.ts";
/**
 * @category utilities
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  getWorkspaceDir,
  /**
   * @category utilities
   * @since 0.0.0
   */
  resolveWorkspaceDirs,
  /**
   * @category utilities
   * @since 0.0.0
   */
  resolveWorkspacePackages,
  /**
   * @category models
   * @since 0.0.0
   */
  WorkspacePackage,
  /**
   * @category utilities
   * @since 0.0.0
   */
  workspaceGlobsFrom,
} from "./Workspaces.ts";
