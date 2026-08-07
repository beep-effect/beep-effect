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
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContinentName } from "@beep/schema/ContinentName"
 *
 * const name = S.decodeUnknownSync(ContinentName)("Americas")
 * console.log(name) // "Americas"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContinentName = ContinentNameSchema;

/**
 * {@inheritDoc ContinentName}
 *
 * **Example** (Type continent name value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContinentName } from "@beep/schema/ContinentName"
 *
 * const name: ContinentName = S.decodeUnknownSync(ContinentName)("Europe")
 * console.log(name) // "Europe"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ContinentName = typeof ContinentName.Type;
