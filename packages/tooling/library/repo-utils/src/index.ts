/**
 * Effect-based monorepo utilities for repository analysis and workspace management.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */
// biome-ignore-all assist/source/organizeImports: docgen requires individually documented re-export declarations. Owner: @beep/repo-utils. Exit: docgen accepts sorted re-export declarations.

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
 * **Example** (Import FsUtils service tag)
 *
 * ```ts
 * import { FsUtils } from "@beep/repo-utils"
 * console.log(FsUtils)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export { FsUtils } from "./FsUtils.ts";
/**
 * Live layer for the filesystem utility service.
 *
 * **Example** (Import FsUtilsLive layer)
 *
 * ```ts
 * import { FsUtilsLive } from "@beep/repo-utils"
 * console.log(FsUtilsLive)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export { FsUtilsLive } from "./FsUtils.ts";
/**
 * Service shape implemented by `FsUtils` providers.
 *
 * **Example** (Type-check FsUtilsShape keys)
 *
 * ```ts
 * import type { FsUtilsShape } from "@beep/repo-utils"
 * const key = "readJson" satisfies keyof FsUtilsShape
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type { FsUtilsShape } from "./FsUtils.ts";
/**
 * Options accepted by filesystem glob helpers.
 *
 * **Example** (Create GlobOptions with cwd)
 *
 * ```ts
 * import { GlobOptions } from "@beep/repo-utils"
 * const options = GlobOptions.make({ cwd: "src" })
 * console.log(options.cwd)
 * ```
 *
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
  PackageJson,
  /**
   * @category parsing
   * @since 0.0.0
   */
  readPackageJsonFile,
  /**
   * @category utilities
   * @since 0.0.0
   */
  toSortedRecord,
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
  PackageJsonValidationIssue,
  /**
   * @category schemas
   * @since 0.0.0
   */
  packageJsonJsonSchema,
} from "./schemas/PackageJsonTools.ts";
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
 * Scoped TypeScript 7 programmatic access.
 *
 * **Example** (Import TsNativeApi)
 *
 * ```ts
 * import { TsNativeApi } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeApi)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./TsNativeApi.ts";
