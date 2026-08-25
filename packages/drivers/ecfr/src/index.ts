/**
 * Package entry point for `@beep/ecfr` — the keyless eCFR versioner API driver.
 *
 * @since 0.0.0
 */

/**
 * Generated eCFR response models and HttpApi contract.
 *
 * @since 0.0.0
 * @category models
 */
export * from "./_generated/Ecfr.gen.ts";
/**
 * Runtime configuration models and constants.
 *
 * @since 0.0.0
 * @category configuration
 */
export * from "./Ecfr.config.ts";
/**
 * Typed eCFR driver errors.
 *
 * @since 0.0.0
 * @category errors
 */
export * from "./Ecfr.errors.ts";
/**
 * eCFR REST API service.
 *
 * @since 0.0.0
 * @category services
 */
export {
  Ecfr,
  EcfrCorrectionsParams,
  EcfrDatedTitleParams,
  EcfrSearchParams,
  EcfrTitleParams,
  EcfrVersionerParams,
  EcfrVersionsParams,
} from "./Ecfr.service.ts";
/**
 * Type-level contracts exposed by the eCFR service.
 *
 * @category type-level
 * @since 0.0.0
 */
export type { EcfrShape, SearchResult } from "./Ecfr.service.ts";

/**
 * Package version.
 *
 * **Example** (Import and log VERSION)
 *
 * ```ts
 * import { VERSION } from "@beep/ecfr"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
