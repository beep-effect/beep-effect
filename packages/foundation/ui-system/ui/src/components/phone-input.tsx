/**
 * Phone input primitive backed by `libphonenumber-js/min`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { $UiId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@beep/ui/components/combobox";
import {
  CountryOptionContent,
  countryOptions,
  findCountryOption,
  isCountryCode,
} from "@beep/ui/components/country-select";
import { InputGroup, InputGroupInput } from "@beep/ui/components/input-group";
import { make as makeScopedAtom, useAtom } from "@effect/atom-react";
import { pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import {
  AsYouType,
  getCountries,
  isSupportedCountry,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
} from "libphonenumber-js/min";
import type { CountryCode as PhoneCountryCode } from "libphonenumber-js/min";
import type React from "react";

const defaultPhoneCountry = "US" satisfies PhoneCountryCode;
const $I = $UiId.create("components/phone-input");

const phoneNumberE164Pattern = /^\+[1-9]\d{1,14}$/u;

/**
 * Supported phone country codes from the pinned phone metadata.
 *
 * **Example** (Check country code support)
 *
 * ```tsx
 * import { phoneCountryCodes } from "@beep/ui/components/phone-input"
 *
 * console.log(phoneCountryCodes.includes("US"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const phoneCountryCodes: ReadonlyArray<PhoneCountryCode> = getCountries();

/**
 * Country options filtered to the phone metadata's supported countries.
 *
 * **Example** (Log country options length)
 *
 * ```tsx
 * import { phoneCountryOptions } from "@beep/ui/components/phone-input"
 *
 * console.log(phoneCountryOptions.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const phoneCountryOptions = A.filter(countryOptions, (option) => isSupportedCountry(option.code));

/**
 * E.164 phone number value schema used by {@link PhoneInput}.
 *
 * **Example** (Parse unknown to E.164)
 *
 * ```ts
 * import { PhoneNumberE164 } from "@beep/ui/components/phone-input"
 *
 * const supportLine = PhoneNumberE164.decodeUnknownSync("+14155552671")
 *
 * console.log(supportLine.startsWith("+"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PhoneNumberE164 = S.String.check(
  S.makeFilterGroup(
    [
      S.isPattern(phoneNumberE164Pattern, {
        identifier: $I`PhoneNumberE164Pattern`,
        title: "E.164 Phone Number Pattern",
        description: "Phone numbers must use E.164 plus-prefixed international format.",
        message: "Phone number must use E.164 format.",
      }),
      S.makeFilter((value: string) => isValidPhoneNumber(value), {
        identifier: $I`PhoneNumberE164MetadataCheck`,
        title: "Valid E.164 Phone Number",
        description: "Phone number must be valid according to the pinned libphonenumber metadata.",
        message: "Phone number must be valid according to libphonenumber metadata.",
      }),
    ],
    {
      identifier: $I`PhoneNumberE164Checks`,
      title: "E.164 Phone Number",
      description: "Checks for valid E.164 phone numbers accepted by the phone input.",
    }
  )
).pipe(
  $I.annoteSchema("PhoneNumberE164", {
    description: "Valid E.164 phone number accepted by PhoneInput.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync", "is"])
);

/**
 * Runtime type for {@link PhoneNumberE164}.
 *
 * **Example** (Annotate E.164 string type)
 *
 * ```ts
 * import type { PhoneNumberE164 } from "@beep/ui/components/phone-input"
 *
 * const supportLine: PhoneNumberE164 = "+14155552671"
 *
 * console.log(supportLine.startsWith("+"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PhoneNumberE164 = typeof PhoneNumberE164.Type;

/**
 * Formats draft phone input for a selected country.
 *
 * **Example** (Format US draft number)
 *
 * ```tsx
 * import { formatPhoneDraft } from "@beep/ui/components/phone-input"
 *
 * console.log(formatPhoneDraft("4155552671", "US"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formatPhoneDraft: {
  (country: PhoneCountryCode): (value: string) => string;
  (value: string, country: PhoneCountryCode): string;
} = dual(2, (value: string, country: PhoneCountryCode): string => new AsYouType(country).input(value));

/**
 * Parses a draft phone input into E.164 when possible.
 *
 * **Example** (Parse draft as E.164)
 *
 * ```tsx
 * import * as O from "effect/Option"
 * import { parsePhoneDraft } from "@beep/ui/components/phone-input"
 *
 * console.log(O.getOrUndefined(parsePhoneDraft("4155552671", "US")))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parsePhoneDraft: {
  (country: PhoneCountryCode): (value: string) => O.Option<PhoneNumberE164>;
  (value: string, country: PhoneCountryCode): O.Option<PhoneNumberE164>;
} = dual(2, (value: string, country: PhoneCountryCode): O.Option<PhoneNumberE164> => {
  if (value.length === 0) {
    return O.none();
  }

  const formatter = new AsYouType(country);
  formatter.input(value);
  return pipe(
    formatter.getNumberValue() ?? parsePhoneNumberFromString(value, country)?.number,
    O.fromNullishOr,
    O.filter(PhoneNumberE164.is)
  );
});

/**
 * Validates an E.164 phone number using the pinned `libphonenumber-js/min`
 * metadata.
 *
 * **Example** (Validate E.164 phone number)
 *
 * ```tsx
 * import { isValidPhoneNumberE164 } from "@beep/ui/components/phone-input"
 *
 * console.log(isValidPhoneNumberE164("+14155552671"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isValidPhoneNumberE164 = (value: string): boolean => PhoneNumberE164.is(value);

/**
 * Props for a country-aware phone input that emits E.164 values.
 *
 * **Example** (Satisfy PhoneInputProps object)
 *
 * ```ts
 * import type { PhoneInputProps } from "@beep/ui/components/phone-input"
 *
 * const props = {
 *   defaultCountry: "US",
 *   value: "+14155552671",
 *   onValueChange: (value) => value.startsWith("+"),
 * } satisfies PhoneInputProps
 *
 * console.log(props.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PhoneInputProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  readonly defaultCountry?: PhoneCountryCode | undefined;
  readonly defaultValue?: PhoneNumberE164 | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] | undefined;
  readonly name?: string | undefined;
  readonly onBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onCountryChange?: ((country: PhoneCountryCode) => void) | undefined;
  readonly onValueChange?: ((value: PhoneNumberE164) => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly value?: PhoneNumberE164 | undefined;
}

interface PhoneInputState {
  readonly country: PhoneCountryCode;
  readonly displayValue: string;
}

interface PhoneInputScopeInput {
  readonly defaultCountry: PhoneCountryCode;
  readonly defaultValue: PhoneNumberE164;
}

const formatInitialPhoneValue = (value: PhoneNumberE164 | undefined, country: PhoneCountryCode): string => {
  if (!P.isString(value) || value.length === 0) {
    return "";
  }

  return formatPhoneDraft(value, country);
};

const PhoneInputScope = makeScopedAtom((input: PhoneInputScopeInput) =>
  Atom.make<PhoneInputState>({
    country: input.defaultCountry,
    displayValue: formatInitialPhoneValue(input.defaultValue, input.defaultCountry),
  })
);

/**
 * Country-aware phone input that emits E.164 strings.
 *
 * **Details**
 *
 * `value` controls the emitted E.164 number, while the selected country lives
 * in scoped component state unless `onCountryChange` mirrors it elsewhere.
 *
 * **Example** (Render basic PhoneInput field)
 *
 * ```tsx
 * import { PhoneInput } from "@beep/ui/components/phone-input"
 *
 * export function ContactPhoneField() {
 *   return <PhoneInput name="phone" defaultCountry="US" placeholder="(555) 123-4567" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const PhoneInput: React.FC<PhoneInputProps> = (props) => (
  <PhoneInputScope.Provider
    value={{
      defaultCountry: props.defaultCountry ?? defaultPhoneCountry,
      defaultValue: props.defaultValue ?? props.value ?? "",
    }}
  >
    <PhoneInputInner {...props} />
  </PhoneInputScope.Provider>
);

const PhoneInputInner: React.FC<PhoneInputProps> = ({
  className,
  defaultCountry = defaultPhoneCountry,
  disabled = false,
  id,
  inputMode = "tel",
  name,
  onBlur,
  onCountryChange,
  onValueChange,
  placeholder = "(555) 123-4567",
  value,
  ...props
}) => {
  const [state, setState] = useAtom(PhoneInputScope.use());
  const selectedCountry = state.country;
  const selectedOption = findCountryOption(selectedCountry);
  const selectedCountryPlaceholder = pipe(
    selectedOption,
    O.map((option) => option.code),
    O.getOrElse(() => defaultCountry)
  );
  const displayedValue =
    P.isString(value) && value.length > 0 ? formatInitialPhoneValue(value, selectedCountry) : state.displayValue;

  return (
    <div className={className} {...props}>
      <InputGroup className="h-auto min-h-8">
        <Combobox
          items={[...phoneCountryCodes]}
          value={selectedCountry}
          onValueChange={(nextValue) => {
            const candidate: unknown = nextValue;
            if (P.isString(candidate) && isCountryCode(candidate) && isSupportedCountry(candidate)) {
              setState((current) => ({ ...current, country: candidate }));
              onCountryChange?.(candidate);
            }
          }}
        >
          <ComboboxInput
            aria-label="Phone country"
            className="w-36 rounded-r-none border-0 border-r bg-transparent focus-visible:ring-0"
            disabled={disabled}
            placeholder={selectedCountryPlaceholder}
            showClear={false}
          />
          <ComboboxContent>
            <ComboboxEmpty>No countries found.</ComboboxEmpty>
            <ComboboxList>
              {phoneCountryOptions.map((option) => (
                <ComboboxItem key={option.code} value={option.code}>
                  <CountryOptionContent option={option} />
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        <InputGroupInput
          id={id}
          name={name}
          type="tel"
          inputMode={inputMode}
          disabled={disabled}
          placeholder={placeholder}
          value={displayedValue}
          onBlur={onBlur}
          onChange={(event) => {
            const draft = event.target.value;
            const formatted = formatPhoneDraft(draft, selectedCountry);
            const e164 = pipe(
              parsePhoneDraft(draft, selectedCountry),
              O.getOrElse(() => "")
            );
            setState((current) => ({ ...current, displayValue: formatted }));
            onValueChange?.(e164);
          }}
        />
      </InputGroup>
    </div>
  );
};
