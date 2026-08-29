/**
 * ISO 4217 currency code data.
 *
 * Provides a typed constant array of all active ISO 4217 currency entries
 * including their three-letter code, numeric code, decimal digit count,
 * currency name, and the countries where each currency is used.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as internal from "./generated/iso4217.ts";

// -------------------------------------------------------------------------------------
// types
// -------------------------------------------------------------------------------------

/**
 * A single ISO 4217 currency entry containing the three-letter code,
 * numeric code, decimal digits, human-readable currency name, and an
 * array of countries where the currency is used.
 *
 * **Example** (USD currency entry lookup)
 *
 * ```ts import.meta.vitest name="USD currency entry lookup"
 * import { CurrencyCodeDataByCode, type CurrencyCodeData } from "@beep/data/CurrencyCodes"
 *
 * const usd: CurrencyCodeData = CurrencyCodeDataByCode.USD
 * console.assert(usd.currency === "US Dollar")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurrencyCodeData = (typeof internal.CurrencyCodeDataValues)[number];

/**
 * Union of all ISO 4217 three-letter currency code strings.
 *
 * **Example** (Assign USD and EUR codes)
 *
 * ```ts import.meta.vitest name="Assign USD and EUR codes"
 * import type { CurrencyCode } from "@beep/data/CurrencyCodes"
 *
 * const usd: CurrencyCode = "USD"
 * const eur: CurrencyCode = "EUR"
 * console.assert(usd === "USD" && eur === "EUR")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurrencyCode = CurrencyCodeData["code"];

/**
 * Stable source metadata for the generated ISO 4217 dataset.
 *
 * **Example** (Access dataset source metadata)
 *
 * ```ts import.meta.vitest name="Access dataset source metadata"
 * import { CurrencyCodeDataMetadata } from "@beep/data/CurrencyCodes"
 * import type { CurrencyCodeDataMetadata as CurrencyCodeDataMetadataShape } from "@beep/data/CurrencyCodes"
 *
 * const metadata: CurrencyCodeDataMetadataShape = CurrencyCodeDataMetadata
 * console.assert(metadata.sourceUrl.startsWith("https://"))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CurrencyCodeDataMetadata = typeof internal.CurrencyCodeDataMetadata;

// -------------------------------------------------------------------------------------
// constants
// -------------------------------------------------------------------------------------

/**
 * Complete array of all active ISO 4217 currency entries.
 *
 * **Details**
 *
 * Each entry contains a `code` (three-letter), `number` (three-digit),
 * `digits` (decimal places), `currency` (human name), and `countries`
 * (array of country names where the currency is used).
 *
 * Sourced from the official ISO 4217 published list.
 *
 * **Example** (Find USD in currency array)
 *
 * ```ts import.meta.vitest name="Find USD in currency array"
 * import { CurrencyCodeDataValues } from "@beep/data/CurrencyCodes"
 *
 * const usd = CurrencyCodeDataValues.find((entry) => entry.code === "USD")
 * console.assert(usd?.currency === "US Dollar")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataValues: typeof internal.CurrencyCodeDataValues = internal.CurrencyCodeDataValues;

/**
 * Stable source metadata for the generated ISO 4217 dataset.
 *
 * **Example** (Check published date value)
 *
 * ```ts import.meta.vitest name="Check published date value"
 * import { CurrencyCodeDataMetadata } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataMetadata.published === "2026-01-01")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataMetadata: typeof internal.CurrencyCodeDataMetadata = internal.CurrencyCodeDataMetadata;

/**
 * Published date reported by the official ISO 4217 List One feed.
 *
 * **Example** (Assert published date string)
 *
 * ```ts import.meta.vitest name="Assert published date string"
 * import { CurrencyCodeDataPublished } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataPublished === "2026-01-01")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataPublished: typeof internal.CurrencyCodeDataPublished = internal.CurrencyCodeDataPublished;

/**
 * Official source URL for the ISO 4217 List One feed.
 *
 * **Example** (Verify source URL path)
 *
 * ```ts import.meta.vitest name="Verify source URL path"
 * import { CurrencyCodeDataSourceUrl } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataSourceUrl.includes("list-one.xml"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataSourceUrl: typeof internal.CurrencyCodeDataSourceUrl = internal.CurrencyCodeDataSourceUrl;

/**
 * SHA-256 digest of the official source payload used for the generated dataset.
 *
 * **Example** (Check SHA-256 digest length)
 *
 * ```ts import.meta.vitest name="Check SHA-256 digest length"
 * import { CurrencyCodeDataSourceSha256 } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataSourceSha256.length === 64)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataSourceSha256: typeof internal.CurrencyCodeDataSourceSha256 =
  internal.CurrencyCodeDataSourceSha256;

/**
 * ISO 4217 currency entries keyed by alphabetic code.
 *
 * **Example** (Lookup EUR decimal digits)
 *
 * ```ts import.meta.vitest name="Lookup EUR decimal digits"
 * import { CurrencyCodeDataByCode } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataByCode.EUR.digits === 2)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataByCode: typeof internal.CurrencyCodeDataByCode = internal.CurrencyCodeDataByCode;

/**
 * ISO 4217 alphabetic code literals.
 *
 * **Example** (Check USD code is included)
 *
 * ```ts import.meta.vitest name="Check USD code is included"
 * import { CurrencyCodeDataCodeValues } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataCodeValues.includes("USD"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataCodeValues: typeof internal.CurrencyCodeDataCodeValues =
  internal.CurrencyCodeDataCodeValues;

/**
 * ISO 4217 currency names keyed by alphabetic code.
 *
 * **Example** (Lookup USD currency name)
 *
 * ```ts import.meta.vitest name="Lookup USD currency name"
 * import { CurrencyCodeDataNameByCode } from "@beep/data/CurrencyCodes"
 *
 * console.assert(CurrencyCodeDataNameByCode.USD === "US Dollar")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataNameByCode: typeof internal.CurrencyCodeDataNameByCode =
  internal.CurrencyCodeDataNameByCode;

/**
 * ISO 4217 alphabetic code to currency-name literal pairs.
 *
 * **Example** (Find USD code-name pair)
 *
 * ```ts import.meta.vitest name="Find USD code-name pair"
 * import { CurrencyCodeDataCodeNamePairs } from "@beep/data/CurrencyCodes"
 *
 * const usd = CurrencyCodeDataCodeNamePairs.find(([code]) => code === "USD")
 * console.assert(usd?.[1] === "US Dollar")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CurrencyCodeDataCodeNamePairs: typeof internal.CurrencyCodeDataCodeNamePairs =
  internal.CurrencyCodeDataCodeNamePairs;
