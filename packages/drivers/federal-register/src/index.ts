/**
 * Federal Register driver package boundary.
 *
 * **Details**
 *
 * The current public surface exposes package metadata only. Federal Register
 * API schemas, endpoint clients, and service layers should be documented on
 * their owning modules before they are re-exported here.
 *
 * **Example** (Log package version label)
 *
 * ```ts
 * import { VERSION } from "@beep/federal-register"
 *
 * const packageLabel = `@beep/federal-register@${VERSION}`
 * console.log(packageLabel) // "@beep/federal-register@0.0.0"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version for the Federal Register driver package.
 *
 * **Gotchas**
 *
 * This is the package release marker, not a Federal Register API version,
 * publication date, document number, or edition identifier. Model upstream
 * Federal Register versioning separately when endpoint modules are added.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/federal-register"
 *
 * const isInitialPackageVersion = VERSION === "0.0.0"
 * console.log(isInitialPackageVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
