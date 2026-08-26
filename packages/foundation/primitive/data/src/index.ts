/**
 * Core data values and utilities for the beep platform.
 *
 * Provides vendored, edge-compatible MIME type lookup utilities, calendar
 * constants, ISO 4217 currency codes, IANA timezone identifiers, and other
 * shared data constants used across packages.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Blockchain network metadata namespace.
 *
 * **Example** (Ethereum network ticker)
 *
 * ```ts import.meta.vitest name="Ethereum network ticker"
 * import { Blockchain } from "@beep/data"
 *
 * console.assert(Blockchain.Networks.Ethereum.ticker === "ETH")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as Blockchain from "./Blockchain.ts";
/**
 * Calendar constants namespace.
 *
 * **Example** (ISO month value lookup)
 *
 * ```ts import.meta.vitest name="ISO month value lookup"
 * import { Calendar } from "@beep/data"
 *
 * console.assert(Calendar.MonthISOValues[0] === "01")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as Calendar from "./Calendar.ts";
/**
 * ISO 4217 currency constants namespace.
 *
 * **Example** (USD currency name lookup)
 *
 * ```ts import.meta.vitest name="USD currency name lookup"
 * import { CurrencyCodes } from "@beep/data"
 *
 * console.assert(CurrencyCodes.CurrencyCodeDataByCode.USD.currency === "US Dollar")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as CurrencyCodes from "./CurrencyCodes.ts";
/**
 * Keyboard shortcut constants namespace.
 *
 * **Example** (Find copy keyboard shortcut)
 *
 * ```ts import.meta.vitest name="Find copy keyboard shortcut"
 * import { KeyboardShortcuts } from "@beep/data"
 *
 * const hasCopyShortcut = KeyboardShortcuts.KeyboardShortcutDataValues.some(
 *   (shortcut) => shortcut.name === "copy"
 * )
 *
 * console.assert(hasCopyShortcut)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as KeyboardShortcuts from "./KeyboardShortcuts.ts";
/**
 * MIME type lookup utilities namespace.
 *
 * **Example** (Lookup JSON MIME type)
 *
 * ```ts import.meta.vitest name="Lookup JSON MIME type"
 * import { MimeTypesData } from "@beep/data"
 *
 * console.assert(MimeTypesData.lookup("asset.json") === "application/json")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as MimeTypesData from "./MimeTypes.ts";
/**
 * Unicode CLDR territory and continent constants namespace.
 *
 * **Example** (US territory name lookup)
 *
 * ```ts import.meta.vitest name="US territory name lookup"
 * import { Territories } from "@beep/data"
 *
 * console.assert(Territories.TerritoryDataByCode.US.name === "United States")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as Territories from "./Territories.ts";
/**
 * IANA timezone constants namespace.
 *
 * **Example** (UTC timezone name lookup)
 *
 * ```ts import.meta.vitest name="UTC timezone name lookup"
 * import { Timezones } from "@beep/data"
 *
 * console.assert(Timezones.TimezoneDataByName.UTC.name === "UTC")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as Timezones from "./Timezones.ts";
