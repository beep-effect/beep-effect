/**
 * Timezone Schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Timezones as TimezonesData } from "@beep/data";
import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("Timezone");

/**
 * IANA timezone identifier schema derived from generated tzdb data.
 *
 * **Example** (Decode IANA timezone)
 *
 * ```ts import.meta.vitest name="Decode IANA timezone"
 * import * as S from "effect/Schema"
 * import { Timezone } from "@beep/schema/Timezone"
 *
 * const tz = S.decodeUnknownSync(Timezone)("America/New_York")
 * tz // => "America/New_York"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Timezone = LiteralKit(TimezonesData.TimezoneNameValues).pipe(
  $I.annoteSchema("Timezone", {
    description: "IANA timezone identifier literal type.",
  })
);

/**
 * Runtime type for {@link Timezone}.
 *
 * **Example** (Type annotated timezone)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Timezone } from "@beep/schema/Timezone"
 *
 * const tz: Timezone = S.decodeUnknownSync(Timezone)("America/New_York")
 * console.log(tz)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Timezone = typeof Timezone.Type;
