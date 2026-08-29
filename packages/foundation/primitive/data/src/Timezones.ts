/**
 * IANA timezone name data.
 *
 * Provides a typed constant array of all commonly used IANA timezone
 * identifiers (e.g. `"America/New_York"`, `"Europe/London"`, `"UTC"`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as internal from "./generated/iana-timezones.ts";

// -------------------------------------------------------------------------------------
// types
// -------------------------------------------------------------------------------------

/**
 * Union of all IANA timezone identifier strings.
 *
 * Each member is a full IANA timezone name such as `"America/New_York"`
 * or `"Europe/London"`.
 *
 * **Example** (Type a timezone identifier)
 *
 * ```ts import.meta.vitest name="Type a timezone identifier"
 * import type { TimezoneName } from "@beep/data/Timezones"
 *
 * const tz: TimezoneName = "America/New_York"
 * console.assert(tz === "America/New_York")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TimezoneName = (typeof internal.TimezoneNameValues)[number];

/**
 * A single generated IANA timezone entry.
 *
 * **Example** (Reference a generated timezone entry)
 *
 * ```ts import.meta.vitest name="Reference a generated timezone entry"
 * import { TimezoneDataByName, type TimezoneData } from "@beep/data/Timezones"
 *
 * const utc: TimezoneData = TimezoneDataByName.UTC
 * console.assert(utc.name === "UTC")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TimezoneData = (typeof internal.TimezoneDataValues)[number];

// -------------------------------------------------------------------------------------
// constants
// -------------------------------------------------------------------------------------

/**
 * Complete array of all commonly used IANA timezone identifiers.
 *
 * Covers Africa, America, Antarctica, Arctic, Asia, Atlantic,
 * Australia, Etc, Europe, Indian, and Pacific regions plus `"UTC"`.
 *
 * **Example** (Check a known identifier is present)
 *
 * ```ts import.meta.vitest name="Check a known identifier is present"
 * import { TimezoneNameValues } from "@beep/data/Timezones"
 *
 * console.assert(TimezoneNameValues.includes("UTC"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneNameValues: typeof internal.TimezoneNameValues = internal.TimezoneNameValues;

/**
 * Stable source metadata for the generated IANA tzdb dataset.
 *
 * **Example** (Read the tzdb metadata)
 *
 * ```ts import.meta.vitest name="Read the tzdb metadata"
 * import { TimezoneDataMetadata } from "@beep/data/Timezones"
 *
 * console.assert(TimezoneDataMetadata.version === "2026c")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataMetadata: typeof internal.TimezoneDataMetadata = internal.TimezoneDataMetadata;

/**
 * IANA tzdb version used for the generated dataset.
 *
 * **Example** (Read the tzdb version)
 *
 * ```ts import.meta.vitest name="Read the tzdb version"
 * import { TimezoneDataVersion } from "@beep/data/Timezones"
 *
 * console.assert(TimezoneDataVersion === "2026c")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataVersion: typeof internal.TimezoneDataVersion = internal.TimezoneDataVersion;

/**
 * IANA tzdb data-only source URL.
 *
 * **Example** (Inspect the source URL)
 *
 * ```ts import.meta.vitest name="Inspect the source URL"
 * import { TimezoneDataSourceUrl } from "@beep/data/Timezones"
 *
 * console.assert(TimezoneDataSourceUrl.endsWith("tzdata-latest.tar.gz"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataSourceUrl: typeof internal.TimezoneDataSourceUrl = internal.TimezoneDataSourceUrl;

/**
 * SHA-256 digest of the official source payload used for the generated dataset.
 *
 * **Example** (Inspect the source digest)
 *
 * ```ts import.meta.vitest name="Inspect the source digest"
 * import { TimezoneDataSourceSha256 } from "@beep/data/Timezones"
 *
 * console.assert(TimezoneDataSourceSha256.length === 64)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataSourceSha256: typeof internal.TimezoneDataSourceSha256 = internal.TimezoneDataSourceSha256;

/**
 * Generated IANA timezone entries.
 *
 * **Example** (Find the UTC entry)
 *
 * ```ts import.meta.vitest name="Find the UTC entry"
 * import { TimezoneDataValues } from "@beep/data/Timezones"
 *
 * const utc = TimezoneDataValues.find((entry) => entry.name === "UTC")
 * console.assert(utc?.name === "UTC")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataValues: typeof internal.TimezoneDataValues = internal.TimezoneDataValues;

/**
 * Generated IANA timezone entries keyed by timezone identifier.
 *
 * **Example** (Look up a timezone by name)
 *
 * ```ts import.meta.vitest name="Look up a timezone by name"
 * import { TimezoneDataByName } from "@beep/data/Timezones"
 *
 * console.assert(TimezoneDataByName["America/New_York"].name === "America/New_York")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TimezoneDataByName: typeof internal.TimezoneDataByName = internal.TimezoneDataByName;
