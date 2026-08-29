/** * CLDR continent display-name schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContinentName as ContinentNameSchema } from "./ContinentCode.ts";

/**
 * CLDR top-level territory containment display-name schema.
 *
 * **Example** (Decode continent display name)
 *
 * ```ts import.meta.vitest name="Decode continent display name"
 * import * as S from "effect/Schema"
 * import { ContinentName } from "@beep/schema/ContinentName"
 *
 * const name = S.decodeUnknownSync(ContinentName)("Americas")
 * name // => "Americas"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContinentName = ContinentNameSchema;

/**
 * {@inheritDoc ContinentName}
 * @category models
 * @since 0.0.0
 */
export type ContinentName = typeof ContinentName.Type;
