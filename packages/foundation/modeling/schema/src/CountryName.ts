/**
 * Country display-name schema backed by generated CLDR territory names.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TerritoryName as TerritoryNameSchema } from "./TerritoryCode.ts";

/**
 * Country display-name schema backed by generated CLDR territory names.
 *
 * **Example** (Decode country display name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CountryName } from "@beep/schema/CountryName"
 *
 * const name = S.decodeUnknownSync(CountryName)("United States")
 * console.log(name) // "United States"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CountryName = TerritoryNameSchema;

/**
 * {@inheritDoc CountryName}
 *
 * **Example** (Type country name value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CountryName } from "@beep/schema/CountryName"
 *
 * const name: CountryName = S.decodeUnknownSync(CountryName)("United States")
 * console.log(name) // "United States"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CountryName = typeof CountryName.Type;
