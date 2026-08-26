/**
 * Unicode CLDR territory and continent data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as internal from "./generated/cldr-territories.ts";

/**
 * A single generated CLDR territory entry.
 *
 * **Example** (Lookup US territory entry)
 *
 * ```ts import.meta.vitest name="Lookup US territory entry"
 * import { TerritoryDataByCode, type TerritoryData } from "@beep/data/Territories"
 *
 * const unitedStates: TerritoryData = TerritoryDataByCode.US
 * console.assert(unitedStates.name === "United States")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TerritoryData = (typeof internal.TerritoryDataValues)[number];

/**
 * Union of generated CLDR territory code strings.
 *
 * **Example** (Assign US territory code)
 *
 * ```ts import.meta.vitest name="Assign US territory code"
 * import type { TerritoryCode } from "@beep/data/Territories"
 *
 * const code: TerritoryCode = "US"
 * console.assert(code === "US")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TerritoryCode = TerritoryData["code"];

/**
 * Union of generated CLDR territory display names.
 *
 * **Example** (Assign United States name)
 *
 * ```ts import.meta.vitest name="Assign United States name"
 * import type { TerritoryName } from "@beep/data/Territories"
 *
 * const name: TerritoryName = "United States"
 * console.assert(name === "United States")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TerritoryName = TerritoryData["name"];

/**
 * A single generated CLDR continent entry.
 *
 * **Example** (Lookup Americas continent entry)
 *
 * ```ts import.meta.vitest name="Lookup Americas continent entry"
 * import { ContinentDataByCode, type ContinentData } from "@beep/data/Territories"
 *
 * const americas: ContinentData = ContinentDataByCode["019"]
 * console.assert(americas.name === "Americas")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContinentData = (typeof internal.ContinentDataValues)[number];

/**
 * Union of generated CLDR continent code strings.
 *
 * **Example** (Assign Americas continent code)
 *
 * ```ts import.meta.vitest name="Assign Americas continent code"
 * import type { ContinentCode } from "@beep/data/Territories"
 *
 * const code: ContinentCode = "019"
 * console.assert(code === "019")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContinentCode = ContinentData["code"];

/**
 * Union of generated CLDR continent display names.
 *
 * **Example** (Assign Americas continent name)
 *
 * ```ts import.meta.vitest name="Assign Americas continent name"
 * import type { ContinentName } from "@beep/data/Territories"
 *
 * const name: ContinentName = "Americas"
 * console.assert(name === "Americas")
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ContinentName = ContinentData["name"];

/**
 * Stable source metadata for the generated CLDR territory dataset.
 *
 * **Example** (Check territory release tag)
 *
 * ```ts import.meta.vitest name="Check territory release tag"
 * import { TerritoryDataMetadata } from "@beep/data/Territories"
 *
 * console.assert(TerritoryDataMetadata.releaseTag === "48.2.0")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataMetadata: typeof internal.TerritoryDataMetadata = internal.TerritoryDataMetadata;

/**
 * CLDR JSON release tag used for the generated territory dataset.
 *
 * **Example** (Assert CLDR release tag)
 *
 * ```ts import.meta.vitest name="Assert CLDR release tag"
 * import { TerritoryDataReleaseTag } from "@beep/data/Territories"
 *
 * console.assert(TerritoryDataReleaseTag === "48.2.0")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataReleaseTag: typeof internal.TerritoryDataReleaseTag = internal.TerritoryDataReleaseTag;

/**
 * Generated CLDR territory entries.
 *
 * **Example** (Find US in territory list)
 *
 * ```ts import.meta.vitest name="Find US in territory list"
 * import { TerritoryDataValues } from "@beep/data/Territories"
 *
 * const unitedStates = TerritoryDataValues.find((entry) => entry.code === "US")
 * console.assert(unitedStates?.name === "United States")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataValues: typeof internal.TerritoryDataValues = internal.TerritoryDataValues;

/**
 * Generated CLDR territory entries keyed by territory code.
 *
 * **Example** (Access US by territory code)
 *
 * ```ts import.meta.vitest name="Access US by territory code"
 * import { TerritoryDataByCode } from "@beep/data/Territories"
 *
 * console.assert(TerritoryDataByCode.US.name === "United States")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataByCode: typeof internal.TerritoryDataByCode = internal.TerritoryDataByCode;

/**
 * Generated CLDR territory code literals.
 *
 * **Example** (Check US code is included)
 *
 * ```ts import.meta.vitest name="Check US code is included"
 * import { TerritoryCodeValues } from "@beep/data/Territories"
 *
 * console.assert(TerritoryCodeValues.includes("US"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryCodeValues: typeof internal.TerritoryCodeValues = internal.TerritoryCodeValues;

/**
 * Generated CLDR territory names keyed by territory code.
 *
 * **Example** (Map US code to name)
 *
 * ```ts import.meta.vitest name="Map US code to name"
 * import { TerritoryDataNameByCode } from "@beep/data/Territories"
 *
 * console.assert(TerritoryDataNameByCode.US === "United States")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataNameByCode: typeof internal.TerritoryDataNameByCode = internal.TerritoryDataNameByCode;

/**
 * Generated CLDR territory code to English display-name literal pairs.
 *
 * **Example** (Find US code-name pair)
 *
 * ```ts import.meta.vitest name="Find US code-name pair"
 * import { TerritoryDataCodeNamePairs } from "@beep/data/Territories"
 *
 * const unitedStates = TerritoryDataCodeNamePairs.find(([code]) => code === "US")
 * console.assert(unitedStates?.[1] === "United States")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const TerritoryDataCodeNamePairs: typeof internal.TerritoryDataCodeNamePairs =
  internal.TerritoryDataCodeNamePairs;

/**
 * Generated CLDR continent entries.
 *
 * **Example** (Find Americas in continent list)
 *
 * ```ts import.meta.vitest name="Find Americas in continent list"
 * import { ContinentDataValues } from "@beep/data/Territories"
 *
 * const americas = ContinentDataValues.find((entry) => entry.code === "019")
 * console.assert(americas?.name === "Americas")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataValues: typeof internal.ContinentDataValues = internal.ContinentDataValues;

/**
 * Generated CLDR continent entries keyed by CLDR region code.
 *
 * **Example** (Access Americas by region code)
 *
 * ```ts import.meta.vitest name="Access Americas by region code"
 * import { ContinentDataByCode } from "@beep/data/Territories"
 *
 * console.assert(ContinentDataByCode["019"].name === "Americas")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataByCode: typeof internal.ContinentDataByCode = internal.ContinentDataByCode;

/**
 * Generated CLDR continent code literals.
 *
 * **Example** (Check 019 code is included)
 *
 * ```ts import.meta.vitest name="Check 019 code is included"
 * import { ContinentCodeValues } from "@beep/data/Territories"
 *
 * console.assert(ContinentCodeValues.includes("019"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentCodeValues: typeof internal.ContinentCodeValues = internal.ContinentCodeValues;

/**
 * Generated CLDR continent names keyed by CLDR region code.
 *
 * **Example** (Map 019 code to name)
 *
 * ```ts import.meta.vitest name="Map 019 code to name"
 * import { ContinentDataNameByCode } from "@beep/data/Territories"
 *
 * console.assert(ContinentDataNameByCode["019"] === "Americas")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataNameByCode: typeof internal.ContinentDataNameByCode = internal.ContinentDataNameByCode;

/**
 * Generated CLDR continent code to English display-name literal pairs.
 *
 * **Example** (Find Americas code-name pair)
 *
 * ```ts import.meta.vitest name="Find Americas code-name pair"
 * import { ContinentDataCodeNamePairs } from "@beep/data/Territories"
 *
 * const americas = ContinentDataCodeNamePairs.find(([code]) => code === "019")
 * console.assert(americas?.[1] === "Americas")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ContinentDataCodeNamePairs: typeof internal.ContinentDataCodeNamePairs =
  internal.ContinentDataCodeNamePairs;
