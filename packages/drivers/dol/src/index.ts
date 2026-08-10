/**
 * Department of Labor driver package boundary.
 *
 * **Details**
 *
 * The current public surface exposes package metadata only. DOL API schemas,
 * endpoint clients, and services should be documented on their owning modules
 * before they are re-exported here.
 *
 * **Example** (Log package version label)
 *
 * ```ts
 * import { VERSION } from "@beep/dol"
 *
 * const packageLabel = `@beep/dol@${VERSION}`
 * console.log(packageLabel) // "@beep/dol@0.0.0"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Package version for the Department of Labor driver package.
 *
 * **Gotchas**
 *
 * This is the package release marker, not a Department of Labor API version.
 * Model upstream API versions separately when endpoint modules are added.
 *
 * **Example** (Check initial package version)
 *
 * ```ts
 * import { VERSION } from "@beep/dol"
 *
 * const isInitialPackageVersion = VERSION === "0.0.0"
 * console.log(isInitialPackageVersion) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
