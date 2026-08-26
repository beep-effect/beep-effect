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
 * **Example** (Decode USD currency code)
 *
 * ```ts import.meta.vitest name="Decode USD currency code"
 * import * as S from "effect/Schema"
 * import { CurrencyCode } from "@beep/schema/CurrencyCode"
 *
 * const code = S.decodeUnknownSync(CurrencyCode)("USD")
 * code // => "USD"
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
 * @category models
 * @since 0.0.0
 */
export type CurrencyCode = typeof CurrencyCode.Type;

/**
 * Schema for active ISO 4217 currency display-name literals.
 *
 * **Example** (Decode US Dollar name)
 *
 * ```ts import.meta.vitest name="Decode US Dollar name"
 * import * as S from "effect/Schema"
 * import { CurrencyName } from "@beep/schema/CurrencyCode"
 *
 * const name = S.decodeUnknownSync(CurrencyName)("US Dollar")
 * name // => "US Dollar"
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
 * @category models
 * @since 0.0.0
 */
export type CurrencyName = typeof CurrencyName.Type;

/**
 * Type guard for {@link CurrencyCode}.
 *
 * **Example** (Validate currency code guard)
 *
 * ```ts import.meta.vitest name="Validate currency code guard"
 * import { isCurrencyCode } from "@beep/schema/CurrencyCode"
 *
 * isCurrencyCode("USD") // => true
 * isCurrencyCode("ZZZ") // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const isCurrencyCode = (value: string): value is CurrencyCode => HashSet.has(currencyCodeSet, value);

/**
 * ISO 4217 constant for United States Dollar.
 *
 * **Example** (Compare USD constant)
 *
 * ```ts import.meta.vitest name="Compare USD constant"
 * import { USD } from "@beep/schema/CurrencyCode"
 *
 * USD === "USD" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const USD: CurrencyCode = CurrencyCode.make("USD");
/**
 * ISO 4217 constant for Euro.
 *
 * **Example** (Compare EUR constant)
 *
 * ```ts import.meta.vitest name="Compare EUR constant"
 * import { EUR } from "@beep/schema/CurrencyCode"
 *
 * EUR === "EUR" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EUR: CurrencyCode = CurrencyCode.make("EUR");
/**
 * ISO 4217 constant for British Pound Sterling.
 *
 * **Example** (Compare GBP constant)
 *
 * ```ts import.meta.vitest name="Compare GBP constant"
 * import { GBP } from "@beep/schema/CurrencyCode"
 *
 * GBP === "GBP" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GBP: CurrencyCode = CurrencyCode.make("GBP");
/**
 * ISO 4217 constant for Japanese Yen.
 *
 * **Example** (Compare JPY constant)
 *
 * ```ts import.meta.vitest name="Compare JPY constant"
 * import { JPY } from "@beep/schema/CurrencyCode"
 *
 * JPY === "JPY" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const JPY: CurrencyCode = CurrencyCode.make("JPY");
/**
 * ISO 4217 constant for Swiss Franc.
 *
 * **Example** (Compare CHF constant)
 *
 * ```ts import.meta.vitest name="Compare CHF constant"
 * import { CHF } from "@beep/schema/CurrencyCode"
 *
 * CHF === "CHF" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CHF: CurrencyCode = CurrencyCode.make("CHF");
/**
 * ISO 4217 constant for Canadian Dollar.
 *
 * **Example** (Compare CAD constant)
 *
 * ```ts import.meta.vitest name="Compare CAD constant"
 * import { CAD } from "@beep/schema/CurrencyCode"
 *
 * CAD === "CAD" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CAD: CurrencyCode = CurrencyCode.make("CAD");
/**
 * ISO 4217 constant for Australian Dollar.
 *
 * **Example** (Compare AUD constant)
 *
 * ```ts import.meta.vitest name="Compare AUD constant"
 * import { AUD } from "@beep/schema/CurrencyCode"
 *
 * AUD === "AUD" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AUD: CurrencyCode = CurrencyCode.make("AUD");
/**
 * ISO 4217 constant for Chinese Yuan.
 *
 * **Example** (Compare CNY constant)
 *
 * ```ts import.meta.vitest name="Compare CNY constant"
 * import { CNY } from "@beep/schema/CurrencyCode"
 *
 * CNY === "CNY" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CNY: CurrencyCode = CurrencyCode.make("CNY");
/**
 * ISO 4217 constant for Hong Kong Dollar.
 *
 * **Example** (Compare HKD constant)
 *
 * ```ts import.meta.vitest name="Compare HKD constant"
 * import { HKD } from "@beep/schema/CurrencyCode"
 *
 * HKD === "HKD" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HKD: CurrencyCode = CurrencyCode.make("HKD");
/**
 * ISO 4217 constant for Singapore Dollar.
 *
 * **Example** (Compare SGD constant)
 *
 * ```ts import.meta.vitest name="Compare SGD constant"
 * import { SGD } from "@beep/schema/CurrencyCode"
 *
 * SGD === "SGD" // => true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SGD: CurrencyCode = CurrencyCode.make("SGD");
