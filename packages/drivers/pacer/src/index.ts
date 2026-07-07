/**
 * Offline-safe PACER API driver primitives.
 *
 * The package intentionally exposes the PACER Authentication API service and the
 * PACER Case Locator service separately. Authentication failures are body-code
 * driven (`loginResult`), while PCL failures are HTTP-status driven, so keeping
 * the services split preserves the API semantics and avoids a top-level facade.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * PACER Authentication API request and response schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./CsoAuth.models.ts";
/**
 * Runtime configuration models and config loading.
 *
 * @category configuration
 * @since 0.0.0
 */
export * from "./Pacer.config.ts";
/**
 * Typed PACER driver errors.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Pacer.errors.ts";
/**
 * Layer composition helpers for PACER services.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Pacer.layer.ts";
/**
 * Offline PACER mock transport.
 *
 * @category testing
 * @since 0.0.0
 */
export * from "./Pacer.mock.ts";
/**
 * Schema-derived PACER mock data.
 *
 * @category testing
 * @since 0.0.0
 */
export * from "./Pacer.mock-data.ts";
/**
 * PACER literal domains and branded values.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Pacer.tokens.ts";
/**
 * PACER Authentication service and scoped session.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./PacerAuth.service.ts";
/**
 * Declarative PACER Case Locator HttpApi contract.
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Pcl.api.ts";
/**
 * PACER Case Locator request and response schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./Pcl.models.ts";
/**
 * PACER Case Locator client service.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./PclClient.service.ts";

/**
 * Package version.
 *
 * @example
 * ```ts
 * import { VERSION } from "@beep/pacer"
 *
 * const packageVersion = VERSION
 * console.log(packageVersion)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0";
