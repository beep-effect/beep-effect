/**
 * CLDR territory display-name schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TerritoryName as TerritoryNameSchema } from "./TerritoryCode.ts";

/**
 * CLDR territory display-name schema.
 *
 * **Example** (Decode territory display name)
 *
 * ```ts import.meta.vitest name="Decode territory display name"
 * import * as S from "effect/Schema"
 * import { TerritoryName } from "@beep/schema/TerritoryName"
 *
 * const name = S.decodeUnknownSync(TerritoryName)("United States")
 * name // => "United States"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TerritoryName = TerritoryNameSchema;

/**
 * {@inheritDoc TerritoryName}
 * @category models
 * @since 0.0.0
 */
export type TerritoryName = typeof TerritoryName.Type;
