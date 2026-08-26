/**
 * Country code schema backed by generated CLDR territory codes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { thunkEmptyStr } from "@beep/utils";
import { flow } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaUtils from "./SchemaUtils/index.ts";
import {
  TerritoryCodeFromName as TerritoryCodeFromNameSchema,
  TerritoryCode as TerritoryCodeSchema,
  TerritoryNameFromCode as TerritoryNameFromCodeSchema,
} from "./TerritoryCode.ts";
import type { TerritoryCode as TerritoryCodeType } from "./TerritoryCode.ts";

const $I = $SchemaId.create("CountryCode");
const missingFlag = thunkEmptyStr;
const regionalIndicatorSymbolLetterA = 0x1f1e6;
const latinCapitalLetterA = 0x41;
const regionalIndicatorOffset = regionalIndicatorSymbolLetterA - latinCapitalLetterA;

const CountryFlagCode = S.String.check(
  S.makeFilterGroup(
    [
      S.isPattern(/^[A-Z]{2}$/u, {
        identifier: $I`CountryFlagCodePatternCheck`,
        title: "Country Flag Code Pattern",
        description: "A two-letter uppercase code that maps to Unicode regional indicator symbols.",
        message: "Country flag codes must contain exactly two uppercase ASCII letters",
      }),
    ],
    {
      identifier: $I`CountryFlagCodeChecks`,
      title: "Country Flag Code",
      description: "Checks for country codes that can be rendered as Unicode emoji flags.",
    }
  )
).pipe(
  $I.annoteSchema("CountryFlagCode", {
    description: "Two-letter uppercase country code that can be rendered as a Unicode emoji flag.",
  })
);
type CountryFlagCode = typeof CountryFlagCode.Type;
type CountryCodeStatics = {
  readonly getFlag: (code: string) => string;
};
type CountryCodeWithStatics = typeof TerritoryCodeSchema & CountryCodeStatics;

const isCountryFlagCode = S.is(CountryFlagCode);
const codePointToString = (codePoint: number): string => globalThis.String.fromCodePoint(codePoint);
const regionalIndicatorFromLetter = flow(
  Str.charCodeAt(0),
  O.map((charCode) => codePointToString(regionalIndicatorOffset + charCode))
);
const countryFlagCodeToEmoji: (code: CountryFlagCode) => string = flow(
  Str.split(""),
  A.map(regionalIndicatorFromLetter),
  O.all,
  O.map(A.join("")),
  O.getOrElse(missingFlag)
);
const countryCodeToEmojiFlag: (code: string) => string = flow(
  O.liftPredicate(isCountryFlagCode),
  O.map(countryFlagCodeToEmoji),
  O.getOrElse(missingFlag)
);
/**
 * Country code schema backed by generated CLDR territory codes.
 *
 * **Example** (Decode country code value)
 *
 * ```ts import.meta.vitest name="Decode country code value"
 * import * as S from "effect/Schema"
 * import { CountryCode } from "@beep/schema/CountryCode"
 *
 * const code = S.decodeUnknownSync(CountryCode)("US")
 * code // => "US"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CountryCode: CountryCodeWithStatics = TerritoryCodeSchema.pipe(
  SchemaUtils.withStatics(() => ({
    getFlag: countryCodeToEmojiFlag,
  })),
  $I.annoteSchema("CountryCode", {
    description: "Country code schema backed by generated CLDR territory codes.",
  })
);

/**
 * {@inheritDoc CountryCode}
 * @category models
 * @since 0.0.0
 */
export type CountryCode = TerritoryCodeType;

/**
 * Reverse codec from country display name to country code.
 *
 * **Example** (Decode code from name)
 *
 * ```ts import.meta.vitest name="Decode code from name"
 * import * as S from "effect/Schema"
 * import { CountryCodeFromName } from "@beep/schema/CountryCode"
 *
 * const code = S.decodeUnknownSync(CountryCodeFromName)("United States")
 * code // => "US"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CountryCodeFromName: typeof TerritoryCodeFromNameSchema = TerritoryCodeFromNameSchema.pipe(
  SchemaUtils.withStatics(() => ({
    getFlag: countryCodeToEmojiFlag,
  })),
  $I.annoteSchema("CountryCodeFromName", {
    description: "Reverse codec from country display name to country code.",
  })
);

/**
 * Reversible country code/name codec.
 *
 * **Example** (Decode name from code)
 *
 * ```ts import.meta.vitest name="Decode name from code"
 * import * as S from "effect/Schema"
 * import { CountryNameFromCode } from "@beep/schema/CountryCode"
 *
 * const name = S.decodeUnknownSync(CountryNameFromCode)("US")
 * name // => "United States"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CountryNameFromCode: typeof TerritoryNameFromCodeSchema = TerritoryNameFromCodeSchema.pipe(
  SchemaUtils.withStatics(() => ({
    getFlag: countryCodeToEmojiFlag,
  })),
  $I.annoteSchema("CountryCodeFromName", {
    description: "Reverse codec from country display name to country code.",
  })
);
