/**
 * Shared combobox field rendering parts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@beep/ui/components/combobox";
import * as A from "effect/Array";
import { BoundField } from "./FieldBinding.tsx";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";
import type { BoundFieldState } from "./FieldBinding.tsx";

/**
 * Extracts primitive option values for Base UI combobox item matching.
 *
 * **Example** (Extract option values)
 *
 * ```ts
 * import { optionValues } from "../../src/internal/ComboboxFieldParts.tsx"
 * import type { FieldOption } from "../../src/core/Options.ts"
 *
 * const countries: ReadonlyArray<FieldOption> = [
 *   { value: "us", label: "United States" },
 *   { value: "ca", label: "Canada", disabled: true },
 * ]
 *
 * export const countryValues = optionValues(countries)
 * console.log(countryValues.join(",")) // "us,ca"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const optionValues = (options: ReadonlyArray<FieldOption>): ReadonlyArray<string> =>
  A.map(options, (option) => option.value);

type ComboboxOptionsContentProps = {
  readonly anchor?: React.ComponentProps<typeof ComboboxContent>["anchor"] | undefined;
  readonly emptyLabel: string;
  readonly options: ReadonlyArray<FieldOption>;
};

/**
 * Renders a shared combobox popup with empty-state text and option rows.
 *
 * **Example** (Render options content)
 *
 * ```tsx
 * import { ComboboxOptionsContent } from "../../src/internal/ComboboxFieldParts.tsx"
 *
 * const countryOptions = [
 *   { value: "us", label: "United States" },
 *   { value: "ca", label: "Canada" },
 * ]
 *
 * export const countryOptionsContent = (
 *   <ComboboxOptionsContent
 *     emptyLabel="No countries found."
 *     options={countryOptions}
 *   />
 * )
 *
 * console.log(countryOptions.length) // 2
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ComboboxOptionsContent: React.FC<ComboboxOptionsContentProps> = ({ anchor, emptyLabel, options }) => (
  <ComboboxContent anchor={anchor}>
    <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
    <ComboboxList>
      {options.map((option) => (
        <ComboboxItem key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </ComboboxItem>
      ))}
    </ComboboxList>
  </ComboboxContent>
);

type StringComboboxMode = "autocomplete" | "selected";

type StringComboboxFieldProps = {
  readonly comboboxProps: Omit<
    React.ComponentProps<typeof Combobox>,
    "inputValue" | "items" | "name" | "onInputValueChange" | "onValueChange" | "value"
  >;
  readonly description?: React.ReactNode | undefined;
  readonly emptyLabel: string;
  readonly label?: React.ReactNode | undefined;
  readonly mode: StringComboboxMode;
  readonly options: ReadonlyArray<FieldOption>;
  readonly placeholder?: string | undefined;
};

const comboboxValueBinding = (mode: StringComboboxMode, field: BoundFieldState<string>["field"]) =>
  mode === "autocomplete"
    ? {
        inputValue: field.state.value,
        onInputValueChange: (inputValue: string) => field.handleChange(inputValue),
      }
    : {
        value: field.state.value,
      };

/**
 * Renders the shared single-value combobox/autocomplete field body.
 *
 * **Details**
 *
 * In `selected` mode the TanStack value is passed as the combobox `value`; in
 * `autocomplete` mode the same TanStack value is passed as `inputValue` and
 * updated on input changes. Popup filtering and highlighted-item state stay
 * inside the combobox primitive.
 *
 * **Example** (Selected mode combobox body)
 *
 * ```tsx
 * import { StringComboboxField } from "../../src/internal/ComboboxFieldParts.tsx"
 *
 * const countryOptions = [
 *   { value: "us", label: "United States" },
 *   { value: "ca", label: "Canada" },
 * ]
 *
 * export const CountryComboboxBody = (
 *   <StringComboboxField
 *     comboboxProps={{}}
 *     emptyLabel="No countries found."
 *     label="Country"
 *     mode="selected"
 *     options={countryOptions}
 *     placeholder="Choose a country"
 *   />
 * )
 *
 * console.log(countryOptions.map((option) => option.value).join(",")) // "us,ca"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const StringComboboxField: React.FC<StringComboboxFieldProps> = ({
  comboboxProps,
  description,
  emptyLabel,
  label,
  mode,
  options,
  placeholder,
}) => (
  <BoundField<string> label={label} description={description}>
    {({ field, hasErrors }) => (
      <Combobox
        {...comboboxProps}
        {...comboboxValueBinding(mode, field)}
        items={optionValues(options)}
        name={field.name}
        onValueChange={(value) => field.handleChange(value === null ? "" : String(value))}
      >
        <ComboboxInput
          id={field.name}
          placeholder={placeholder}
          onBlur={field.handleBlur}
          aria-invalid={hasErrors || undefined}
        />
        <ComboboxOptionsContent emptyLabel={emptyLabel} options={options} />
      </Combobox>
    )}
  </BoundField>
);
