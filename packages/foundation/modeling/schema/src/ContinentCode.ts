/**
 * CLDR continent code and name schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Territories as TerritoriesData } from "@beep/data";
import { $SchemaId } from "@beep/identity";
import { Struct } from "@beep/utils";
import { LiteralKit } from "./LiteralKit/index.ts";
import { MappedLiteralKit } from "./MappedLiteralKit/index.ts";

const $I = $SchemaId.create("ContinentCode");

/**
 * CLDR top-level territory containment code schema.
 *
 * **Example** (Decode CLDR continent code)
 *
 * ```ts import.meta.vitest name="Decode CLDR continent code"
 * import * as S from "effect/Schema"
 * import { ContinentCode } from "@beep/schema/ContinentCode"
 *
 * const code = S.decodeUnknownSync(ContinentCode)("019")
 * code // => "019"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContinentCode = LiteralKit(Struct.keysNonEmpty(TerritoriesData.ContinentDataByCode)).pipe(
  $I.annoteSchema("ContinentCode", {
    description: "A CLDR top-level territory containment code.",
  })
);

/**
 * {@inheritDoc ContinentCode}
 * @category models
 * @since 0.0.0
 */
export type ContinentCode = typeof ContinentCode.Type;

const continentNameByCodeEntries = Struct.entriesNonEmpty(TerritoriesData.ContinentDataNameByCode);

/**
 * CLDR top-level territory containment display-name schema.
 *
 * **Example** (Decode continent display name)
 *
 * ```ts import.meta.vitest name="Decode continent display name"
 * import * as S from "effect/Schema"
 * import { ContinentName } from "@beep/schema/ContinentCode"
 *
 * const name = S.decodeUnknownSync(ContinentName)("Americas")
 * name // => "Americas"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContinentName = LiteralKit(
  Struct.keysNonEmpty(Struct.reverse(TerritoriesData.ContinentDataNameByCode))
).pipe(
  $I.annoteSchema("ContinentName", {
    description: "A CLDR top-level territory containment display name.",
  })
);

/**
 * {@inheritDoc ContinentName}
 * @category models
 * @since 0.0.0
 */
export type ContinentName = typeof ContinentName.Type;

/**
 * Reversible CLDR continent code/name codec.
 *
 * **Example** (Map code to continent name)
 *
 * ```ts import.meta.vitest name="Map code to continent name"
 * import * as S from "effect/Schema"
 * import { ContinentNameFromCode } from "@beep/schema/ContinentCode"
 *
 * const name = S.decodeUnknownSync(ContinentNameFromCode)("019")
 * name // => "Americas"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContinentNameFromCode = MappedLiteralKit(continentNameByCodeEntries).pipe(
  $I.annoteSchema("ContinentNameFromCode", {
    description: "A reversible CLDR continent code to English display-name codec.",
  })
);

/**
 * Reverse codec from CLDR continent display name to CLDR code.
 *
 * **Example** (Map name to continent code)
 *
 * ```ts import.meta.vitest name="Map name to continent code"
 * import * as S from "effect/Schema"
 * import { ContinentCodeFromName } from "@beep/schema/ContinentCode"
 *
 * const code = S.decodeUnknownSync(ContinentCodeFromName)("Europe")
 * code // => "150"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContinentCodeFromName = ContinentNameFromCode.To;
