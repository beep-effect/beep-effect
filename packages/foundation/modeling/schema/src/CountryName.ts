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
 * ```ts import.meta.vitest name="Decode country display name"
 * import * as S from "effect/Schema"
 * import { CountryName } from "@beep/schema/CountryName"
 *
 * const name = S.decodeUnknownSync(CountryName)("United States")
 * name // => "United States"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CountryName = TerritoryNameSchema;

/**
 * {@inheritDoc CountryName}
 * @category models
 * @since 0.0.0
 */
export type CountryName = typeof CountryName.Type;
