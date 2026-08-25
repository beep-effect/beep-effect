/**
 * Internal package version metadata for the docgen CLI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import packageJson from "../../package.json" with { type: "json" };

/**
 * Runtime package version shown in the CLI banner.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { moduleVersion } from "../../src/internal/version.ts"
 *
 * console.log(moduleVersion)
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const moduleVersion = packageJson.version;
