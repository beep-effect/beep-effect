/**
 * Country code schema backed by generated CLDR territory codes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  TerritoryCodeFromName as TerritoryCodeFromNameSchema,
  TerritoryCode as TerritoryCodeSchema,
  TerritoryNameFromCode as TerritoryNameFromCodeSchema,
} from "./TerritoryCode.ts";
import type { TerritoryCode as TerritoryCodeType } from "./TerritoryCode.ts";

/**
 * Country code schema backed by generated CLDR territory codes.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CountryCode } from "@beep/schema/CountryCode"
 *
 * const code = S.decodeUnknownSync(CountryCode)("US")
 * console.log(code) // "US"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const CountryCode: typeof TerritoryCodeSchema = TerritoryCodeSchema;

/**
 * {@inheritDoc CountryCode}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CountryCode } from "@beep/schema/CountryCode"
 *
 * const code: CountryCode = S.decodeUnknownSync(CountryCode)("US")
 * console.log(code) // "US"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type CountryCode = TerritoryCodeType;

/**
 * Reverse codec from country display name to country code.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CountryCodeFromName } from "@beep/schema/CountryCode"
 *
 * const code = S.decodeUnknownSync(CountryCodeFromName)("United States")
 * console.log(code) // "US"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const CountryCodeFromName: typeof TerritoryCodeFromNameSchema = TerritoryCodeFromNameSchema;

/**
 * Reversible country code/name codec.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CountryNameFromCode } from "@beep/schema/CountryCode"
 *
 * const name = S.decodeUnknownSync(CountryNameFromCode)("US")
 * console.log(name) // "United States"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const CountryNameFromCode: typeof TerritoryNameFromCodeSchema = TerritoryNameFromCodeSchema;
