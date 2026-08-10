/**
 * Single, filterable select field bound to the `@beep/ui` `Combobox` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { StringComboboxField } from "../internal/ComboboxFieldParts.tsx";
import type { Combobox } from "@beep/ui/components/combobox";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";

/**
 * Props for {@link ComboboxField}: `Combobox` props plus
 * label/description/options/placeholder; binding props
 * (`items`/`value`/`onValueChange`/`name`) are owned by the field.
 *
 * **Example** (Satisfy combobox field props)
 *
 * ```ts
 * import type { ComboboxFieldProps } from "@beep/form/fields/ComboboxField"
 *
 * const props = {
 *   label: "Country",
 *   options: [
 *     { value: "us", label: "United States" },
 *     { value: "ca", label: "Canada" },
 *   ],
 *   placeholder: "Choose country",
 * } satisfies ComboboxFieldProps
 *
 * console.log(props.options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ComboboxFieldProps
  extends Omit<React.ComponentProps<typeof Combobox>, "items" | "value" | "onValueChange" | "name"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
  readonly placeholder?: string | undefined;
}

/**
 * Schema-bound single-select combobox with base-ui's built-in filtering over a
 * fixed option set.
 *
 * **Example** (Country select combobox form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { ComboboxField } from "@beep/form/fields/ComboboxField"
 * import * as S from "effect/Schema"
 *
 * const CountrySchema = S.Struct({ country: S.String })
 * const countryOptions = [
 *   { value: "us", label: "United States" },
 *   { value: "ca", label: "Canada" },
 * ]
 * const countryFormOptions = makeFormOptions({
 *   schema: CountrySchema,
 *   defaultValues: { country: "us" },
 *   validateOn: "change",
 * })
 *
 * export function CountryComboboxForm() {
 *   const form = useAppForm(countryFormOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="country">
 *           {() => <ComboboxField label="Country" options={countryOptions} placeholder="Choose country" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(countryFormOptions.defaultValues.country) // "us"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ComboboxField: React.FC<ComboboxFieldProps> = ({ label, description, options, placeholder, ...props }) => (
  <StringComboboxField
    comboboxProps={props}
    description={description}
    emptyLabel="No results found."
    label={label}
    mode="selected"
    options={options}
    placeholder={placeholder}
  />
);
