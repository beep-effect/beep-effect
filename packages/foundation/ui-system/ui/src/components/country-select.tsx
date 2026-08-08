/**
 * Country combobox primitive backed by `countries-list` and SVG flags.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { $FormId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@beep/ui/components/combobox";
import { getCountryDataList } from "countries-list";
import * as FlagIcons from "country-flag-icons/react/3x2";
import { Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { cn } from "../lib/index.ts";
import type React from "react";

const $I = $FormId.create("components/country-select");

/**
 * ISO 3166-1 alpha-2 country code schema accepted by the country primitives.
 *
 * **Example** (Validate country code schema)
 *
 * ```ts
 * import { CountryCode } from "@beep/ui/components/country-select"
 * import * as S from "effect/Schema"
 *
 * const isCountryCode = S.is(CountryCode)
 *
 * console.log(isCountryCode("US"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const CountryCodeBase = LiteralKit([
  "AC",
  "AD",
  "AE",
  "AF",
  "AG",
  "AI",
  "AL",
  "AM",
  "AO",
  "AQ",
  "AR",
  "AS",
  "AT",
  "AU",
  "AW",
  "AX",
  "AZ",
  "BA",
  "BB",
  "BD",
  "BE",
  "BF",
  "BG",
  "BH",
  "BI",
  "BJ",
  "BL",
  "BM",
  "BN",
  "BO",
  "BQ",
  "BR",
  "BS",
  "BT",
  "BV",
  "BW",
  "BY",
  "BZ",
  "CA",
  "CC",
  "CD",
  "CF",
  "CG",
  "CH",
  "CI",
  "CK",
  "CL",
  "CM",
  "CN",
  "CO",
  "CR",
  "CU",
  "CV",
  "CW",
  "CX",
  "CY",
  "CZ",
  "DE",
  "DJ",
  "DK",
  "DM",
  "DO",
  "DZ",
  "EC",
  "EE",
  "EG",
  "EH",
  "ER",
  "ES",
  "ET",
  "FI",
  "FJ",
  "FK",
  "FM",
  "FO",
  "FR",
  "GA",
  "GB",
  "GD",
  "GE",
  "GF",
  "GG",
  "GH",
  "GI",
  "GL",
  "GM",
  "GN",
  "GP",
  "GQ",
  "GR",
  "GS",
  "GT",
  "GU",
  "GW",
  "GY",
  "HK",
  "HM",
  "HN",
  "HR",
  "HT",
  "HU",
  "ID",
  "IE",
  "IL",
  "IM",
  "IN",
  "IO",
  "IQ",
  "IR",
  "IS",
  "IT",
  "JE",
  "JM",
  "JO",
  "JP",
  "KE",
  "KG",
  "KH",
  "KI",
  "KM",
  "KN",
  "KP",
  "KR",
  "KW",
  "KY",
  "KZ",
  "LA",
  "LB",
  "LC",
  "LI",
  "LK",
  "LR",
  "LS",
  "LT",
  "LU",
  "LV",
  "LY",
  "MA",
  "MC",
  "MD",
  "ME",
  "MF",
  "MG",
  "MH",
  "MK",
  "ML",
  "MM",
  "MN",
  "MO",
  "MP",
  "MQ",
  "MR",
  "MS",
  "MT",
  "MU",
  "MV",
  "MW",
  "MX",
  "MY",
  "MZ",
  "NA",
  "NC",
  "NE",
  "NF",
  "NG",
  "NI",
  "NL",
  "NO",
  "NP",
  "NR",
  "NU",
  "NZ",
  "OM",
  "PA",
  "PE",
  "PF",
  "PG",
  "PH",
  "PK",
  "PL",
  "PM",
  "PN",
  "PR",
  "PS",
  "PT",
  "PW",
  "PY",
  "QA",
  "RE",
  "RO",
  "RS",
  "RU",
  "RW",
  "SA",
  "SB",
  "SC",
  "SD",
  "SE",
  "SG",
  "SH",
  "SI",
  "SJ",
  "SK",
  "SL",
  "SM",
  "SN",
  "SO",
  "SR",
  "SS",
  "ST",
  "SV",
  "SX",
  "SY",
  "SZ",
  "TA",
  "TC",
  "TD",
  "TF",
  "TG",
  "TH",
  "TJ",
  "TK",
  "TL",
  "TM",
  "TN",
  "TO",
  "TR",
  "TT",
  "TV",
  "TW",
  "TZ",
  "UA",
  "UG",
  "UM",
  "US",
  "UY",
  "UZ",
  "VA",
  "VC",
  "VE",
  "VG",
  "VI",
  "VN",
  "VU",
  "WF",
  "WS",
  "XK",
  "YE",
  "YT",
  "ZA",
  "ZM",
  "ZW",
]);
/**
 * ISO 3166-1 alpha-2 country code schema accepted by country UI primitives.
 *
 * **Example** (Check country code validity)
 *
 * ```ts
 * import { CountryCode } from "@beep/ui/components/country-select"
 * import * as S from "effect/Schema"
 *
 * const isCountryCode = S.is(CountryCode)
 *
 * console.log(isCountryCode("US"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CountryCode = CountryCodeBase.pipe(
  $I.annoteSchema("CountryCode", {
    description: "ISO 3166-1 alpha-2 country code accepted by country UI primitives.",
  }),
  SchemaUtils.withLiteralKitStatics(CountryCodeBase)
);
/**
 * ISO 3166-1 alpha-2 country code used by the country primitives.
 *
 * **Example** (Type a country code)
 *
 * ```ts
 * import type { CountryCode } from "@beep/ui/components/country-select"
 *
 * const shippingCountry: CountryCode = "US"
 *
 * console.log(shippingCountry)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CountryCode = typeof CountryCode.Type;

/**
 * A country option rendered by {@link CountrySelect}.
 *
 * @category models
 * @since 0.0.0
 */
class CountryOption extends S.Class<CountryOption>($I`CountryOption`)(
  {
    callingCode: S.String,
    code: CountryCode,
    label: S.String,
    nativeLabel: S.String,
    searchText: S.String,
  },
  $I.annote("CountryOption", {
    description: "A country option rendered by CountrySelect.",
  })
) {}

const countryOptionOrder = Order.mapInput(Order.String, (option: CountryOption) => option.label);

/**
 * Stable, label-sorted country options derived from `countries-list`.
 *
 * **Example** (Log country options length)
 *
 * ```tsx
 * import { countryOptions } from "@beep/ui/components/country-select"
 *
 * console.log(countryOptions.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const countryOptions: ReadonlyArray<CountryOption> = pipe(
  getCountryDataList(),
  A.map((country) => {
    const callingCode = pipe(
      country.phone,
      A.head,
      O.map((code) => `+${code}`),
      O.getOrElse(() => "")
    );

    return {
      callingCode,
      code: country.iso2,
      label: country.name,
      nativeLabel: country.native,
      searchText: `${country.name} ${country.native} ${country.iso2} ${country.iso3} ${callingCode}`,
    };
  }),
  A.sort(countryOptionOrder)
);

/**
 * Country codes aligned with {@link countryOptions}.
 *
 * **Example** (Check code in list)
 *
 * ```tsx
 * import { countryCodes } from "@beep/ui/components/country-select"
 *
 * console.log(countryCodes.includes("US"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const countryCodes: ReadonlyArray<CountryCode> = A.map(countryOptions, (option) => option.code);

/**
 * Checks whether a string is one of the supported country codes.
 *
 * **Example** (Guard supported country codes)
 *
 * ```tsx
 * import { isCountryCode } from "@beep/ui/components/country-select"
 *
 * console.log(isCountryCode("US"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isCountryCode: (value: string) => value is CountryCode = S.is(CountryCode);

/**
 * Finds the display option for a country code.
 *
 * **Example** (Lookup option by code)
 *
 * ```tsx
 * import { findCountryOption } from "@beep/ui/components/country-select"
 *
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(findCountryOption("US"))?.label)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findCountryOption = (value: string | undefined): O.Option<CountryOption> =>
  P.isString(value)
    ? pipe(
        countryOptions,
        A.findFirst((option) => option.code === value)
      )
    : O.none();

const countryCodeLabel = (value: unknown): string =>
  P.isString(value) && isCountryCode(value)
    ? pipe(
        findCountryOption(value),
        O.map((option) => option.label),
        O.getOrElse(() => value)
      )
    : "";

const countryCodeValue = (value: unknown): string => (P.isString(value) && isCountryCode(value) ? value : "");

/**
 * Props for {@link CountryFlag}.
 *
 * **Example** (Satisfy flag props type)
 *
 * ```ts
 * import type { CountryFlagProps } from "@beep/ui/components/country-select"
 *
 * const props = {
 *   code: "CA",
 *   title: "Canada",
 * } satisfies CountryFlagProps
 *
 * console.log(props.code)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CountryFlagProps = React.ComponentPropsWithoutRef<"span"> & {
  readonly className?: string | undefined;
  readonly code: CountryCode;
};

/**
 * Renders a 3x2 SVG country flag.
 *
 * **Example** (Render Canada flag)
 *
 * ```tsx
 * import { CountryFlag } from "@beep/ui/components/country-select"
 *
 * export function CanadaFlag() {
 *   return <CountryFlag code="CA" title="Canada" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const CountryFlag: React.FC<CountryFlagProps> = ({ code, className, ...props }) => {
  // biome-ignore lint/performance/noDynamicNamespaceImportAccess: Country options are data-driven from ISO codes.
  const Flag = FlagIcons[code];
  return <Flag aria-hidden className={cn("h-3 w-5 shrink-0 rounded-[2px] object-cover", className)} {...props} />;
};

/**
 * Props for {@link CountryOptionContent}.
 *
 * **Example** (Type option content props)
 *
 * ```ts
 * import type { CountryOptionContentProps } from "@beep/ui/components/country-select"
 *
 * const describe = (props: CountryOptionContentProps): string => props.option.label
 *
 * console.log(typeof describe)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface CountryOptionContentProps extends React.ComponentProps<"span"> {
  readonly option: CountryOption;
  readonly showCallingCode?: boolean | undefined;
}

/**
 * Shared visual content for country options.
 *
 * **Example** (Render US option content)
 *
 * ```tsx
 * import { CountryOptionContent, countryOptions } from "@beep/ui/components/country-select"
 *
 * const option = countryOptions.find((country) => country.code === "US")
 *
 * export function UnitedStatesOption() {
 *   return option ? <CountryOptionContent option={option} /> : null
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const CountryOptionContent: React.FC<CountryOptionContentProps> = ({
  option,
  showCallingCode = true,
  className,
  ...props
}) => (
  <span className={cn("flex min-w-0 items-center gap-2", className)} {...props}>
    <CountryFlag code={option.code} />
    <span className="min-w-0 flex-1 truncate">{option.label}</span>
    {showCallingCode && option.callingCode.length > 0 ? (
      <span className="text-muted-foreground shrink-0 text-xs">{option.callingCode}</span>
    ) : null}
  </span>
);

/**
 * Props for a controlled country combobox.
 *
 * **Example** (Satisfy select props type)
 *
 * ```tsx
 * import type { CountrySelectProps } from "@beep/ui/components/country-select"
 *
 * const props = {
 *   name: "shippingCountry",
 *   value: "US",
 *   onValueChange: (country) => country,
 * } satisfies CountrySelectProps
 *
 * console.log(props.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface CountrySelectProps
  extends Omit<React.ComponentProps<typeof Combobox>, "items" | "value" | "onValueChange" | "name"> {
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly onBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onValueChange?: ((value: CountryCode | "") => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly value?: CountryCode | "" | undefined;
}

/**
 * Filterable country combobox with SVG flags.
 *
 * **Example** (Shipping country combobox)
 *
 * ```tsx
 * import { CountrySelect } from "@beep/ui/components/country-select"
 *
 * export function ShippingCountryField() {
 *   return <CountrySelect name="shippingCountry" value="US" placeholder="Ship to" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const CountrySelect: React.FC<CountrySelectProps> = ({
  disabled = false,
  id,
  name,
  onBlur,
  onValueChange,
  placeholder = "Select country",
  value = "",
  ...props
}) => (
  <Combobox
    {...props}
    items={[...countryCodes]}
    itemToStringLabel={countryCodeLabel}
    itemToStringValue={countryCodeValue}
    name={name}
    value={value}
    onValueChange={(nextValue) => {
      if (P.isString(nextValue) && isCountryCode(nextValue)) {
        onValueChange?.(nextValue);
        return;
      }
      onValueChange?.("");
    }}
  >
    <ComboboxInput id={id} placeholder={placeholder} disabled={disabled} onBlur={onBlur} showClear />
    <ComboboxContent>
      <ComboboxEmpty>No countries found.</ComboboxEmpty>
      <ComboboxList>
        {A.map(countryOptions, (option) => (
          <ComboboxItem key={option.code} value={option.code}>
            <CountryOptionContent option={option} />
          </ComboboxItem>
        ))}
      </ComboboxList>
    </ComboboxContent>
  </Combobox>
);
