/** * CLDR continent display-name schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ContinentName as ContinentNameSchema } from "./ContinentCode.ts";

/**
 * CLDR top-level territory containment display-name schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContinentName } from "@beep/schema/ContinentName"
 *
 * const name = S.decodeUnknownSync(ContinentName)("Americas")
 * console.log(name) // "Americas"
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const ContinentName = ContinentNameSchema;

/**
 * {@inheritDoc ContinentName}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { ContinentName } from "@beep/schema/ContinentName"
 *
 * const name: ContinentName = S.decodeUnknownSync(ContinentName)("Europe")
 * console.log(name) // "Europe"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ContinentName = typeof ContinentName.Type;
