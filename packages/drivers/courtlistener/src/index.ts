/**
 * CourtListener driver package boundary.
 *
 * **Details**
 *
 * The current public surface exposes package metadata only. CourtListener API
 * schemas and services should be documented on their owning modules before
 * they are re-exported here.
 *
 * **Example** (Build package version label)
 *
 * ```ts
 * import { VERSION } from "@beep/courtlistener"
 *
 * const packageLabel = `@beep/courtlistener@${VERSION}`
 * console.log(packageLabel) // "@beep/courtlistener@0.0.0"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version for the CourtListener driver package.
 *
 * **Gotchas**
 *
 * This is the package release marker, not a CourtListener REST API version.
 * Model upstream API versions separately when endpoint modules are added.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/courtlistener"
 *
 * const isInitialPackageVersion = VERSION === "0.0.0"
 * console.log(isInitialPackageVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
