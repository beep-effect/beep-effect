/**
 * CurrencyCode - ISO 4217 currency code value object.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { CurrencyCodes as CurrencyCodesData } from "@beep/data";
import { $SchemaId } from "@beep/identity";
import { A, Struct } from "@beep/utils";
import { cast } from "@beep/utils/Function";
import { HashSet, pipe } from "effect";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("CurrencyCode");

const currencyNameOptions = pipe(
  Struct.entriesNonEmpty(CurrencyCodesData.CurrencyCodeDataNameByCode),
  A.map(([, name]) => name),
  A.dedupe
);
const currencyNameOptionsNonEmpty = cast<
  ReadonlyArray<CurrencyCodesData.CurrencyCodeData["currency"]>,
  A.NonEmptyReadonlyArray<CurrencyCodesData.CurrencyCodeData["currency"]>
>(currencyNameOptions);

/**
 * Schema for active ISO 4217 currency code literals.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CurrencyCode } from "@beep/schema/CurrencyCode"
 *
 * const code = S.decodeUnknownSync(CurrencyCode)("USD")
 * console.log(code) // "USD"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CurrencyCode = LiteralKit(Struct.keysNonEmpty(CurrencyCodesData.CurrencyCodeDataByCode)).pipe(
  $I.annoteSchema("CurrencyCode", {
    description: "An active ISO 4217 currency code.",
  })
);

const currencyCodeSet = HashSet.fromIterable(CurrencyCode.Options);

/**
 * {@inheritDoc CurrencyCode}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CurrencyCode } from "@beep/schema/CurrencyCode"
 *
 * const code: CurrencyCode = S.decodeUnknownSync(CurrencyCode)("USD")
 * console.log(code) // "USD"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CurrencyCode = typeof CurrencyCode.Type;

/**
 * Schema for active ISO 4217 currency display-name literals.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CurrencyName } from "@beep/schema/CurrencyCode"
 *
 * const name = S.decodeUnknownSync(CurrencyName)("US Dollar")
 * console.log(name) // "US Dollar"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CurrencyName = LiteralKit(currencyNameOptionsNonEmpty).pipe(
  $I.annoteSchema("CurrencyName", {
    description: "An active ISO 4217 currency display name.",
  })
);

/**
 * {@inheritDoc CurrencyName}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CurrencyName } from "@beep/schema/CurrencyCode"
 *
 * const name: CurrencyName = S.decodeUnknownSync(CurrencyName)("Euro")
 * console.log(name) // "Euro"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CurrencyName = typeof CurrencyName.Type;

/**
 * Type guard for {@link CurrencyCode}.
 *
 * @example
 * ```ts
 * import { isCurrencyCode } from "@beep/schema/CurrencyCode"
 *
 * console.log(isCurrencyCode("USD")) // true
 * console.log(isCurrencyCode("ZZZ")) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isCurrencyCode = (value: string): value is CurrencyCode => HashSet.has(currencyCodeSet, value);

/**
 * ISO 4217 constant for United States Dollar.
 *
 * @example
 * ```ts
 * import { USD } from "@beep/schema/CurrencyCode"
 *
 * console.log(USD === "USD") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const USD: CurrencyCode = CurrencyCode.make("USD");
/**
 * ISO 4217 constant for Euro.
 *
 * @example
 * ```ts
 * import { EUR } from "@beep/schema/CurrencyCode"
 *
 * console.log(EUR === "EUR") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EUR: CurrencyCode = CurrencyCode.make("EUR");
/**
 * ISO 4217 constant for British Pound Sterling.
 *
 * @example
 * ```ts
 * import { GBP } from "@beep/schema/CurrencyCode"
 *
 * console.log(GBP === "GBP") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GBP: CurrencyCode = CurrencyCode.make("GBP");
/**
 * ISO 4217 constant for Japanese Yen.
 *
 * @example
 * ```ts
 * import { JPY } from "@beep/schema/CurrencyCode"
 *
 * console.log(JPY === "JPY") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JPY: CurrencyCode = CurrencyCode.make("JPY");
/**
 * ISO 4217 constant for Swiss Franc.
 *
 * @example
 * ```ts
 * import { CHF } from "@beep/schema/CurrencyCode"
 *
 * console.log(CHF === "CHF") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CHF: CurrencyCode = CurrencyCode.make("CHF");
/**
 * ISO 4217 constant for Canadian Dollar.
 *
 * @example
 * ```ts
 * import { CAD } from "@beep/schema/CurrencyCode"
 *
 * console.log(CAD === "CAD") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CAD: CurrencyCode = CurrencyCode.make("CAD");
/**
 * ISO 4217 constant for Australian Dollar.
 *
 * @example
 * ```ts
 * import { AUD } from "@beep/schema/CurrencyCode"
 *
 * console.log(AUD === "AUD") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AUD: CurrencyCode = CurrencyCode.make("AUD");
/**
 * ISO 4217 constant for Chinese Yuan.
 *
 * @example
 * ```ts
 * import { CNY } from "@beep/schema/CurrencyCode"
 *
 * console.log(CNY === "CNY") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CNY: CurrencyCode = CurrencyCode.make("CNY");
/**
 * ISO 4217 constant for Hong Kong Dollar.
 *
 * @example
 * ```ts
 * import { HKD } from "@beep/schema/CurrencyCode"
 *
 * console.log(HKD === "HKD") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HKD: CurrencyCode = CurrencyCode.make("HKD");
/**
 * ISO 4217 constant for Singapore Dollar.
 *
 * @example
 * ```ts
 * import { SGD } from "@beep/schema/CurrencyCode"
 *
 * console.log(SGD === "SGD") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SGD: CurrencyCode = CurrencyCode.make("SGD");
