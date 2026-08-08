/**
 * Country field bound to the `@beep/ui` `CountrySelect` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { CountrySelect, isCountryCode } from "@beep/ui/components/country-select";
import * as A from "effect/Array";
import { useFieldContext } from "../core/contexts.ts";
import { toFieldErrors } from "../core/Errors.ts";
import { FieldShell } from "../internal/FieldShell.tsx";
import type React from "react";

/**
 * Props for {@link CountryField}: `CountrySelect` props plus
 * label/description; binding props are owned by the field.
 *
 * **Example** (Label and description props)
 *
 * ```ts
 * import type { CountryFieldProps } from "@beep/form/fields/CountryField"
 *
 * const props = {
 *   label: "Country",
 *   description: "Stores an ISO alpha-2 country code.",
 * } satisfies CountryFieldProps
 *
 * console.log(props.description) // "Stores an ISO alpha-2 country code."
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface CountryFieldProps
  extends Omit<React.ComponentProps<typeof CountrySelect>, "id" | "name" | "onBlur" | "onValueChange" | "value"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound country combobox whose value is an ISO alpha-2 code.
 *
 * **Example** (Locale form country field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { CountryField } from "@beep/form/fields/CountryField"
 * import * as S from "effect/Schema"
 *
 * const LocaleSchema = S.Struct({ country: S.String })
 * const localeOptions = makeFormOptions({
 *   schema: LocaleSchema,
 *   defaultValues: { country: "US" },
 *   validateOn: "change",
 * })
 *
 * export function LocaleForm() {
 *   const form = useAppForm(localeOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="country">{() => <CountryField label="Country" />}</form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(localeOptions.defaultValues.country) // "US"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const CountryField: React.FC<CountryFieldProps> = ({ label, description, ...props }) => {
  const field = useFieldContext<string>();
  const errors = toFieldErrors(field.state.meta.errors);
  const value = isCountryCode(field.state.value) ? field.state.value : "";
  return (
    <FieldShell htmlFor={field.name} label={label} description={description} errors={errors}>
      <CountrySelect
        {...props}
        id={field.name}
        name={field.name}
        value={value}
        onValueChange={(value) => field.handleChange(value)}
        onBlur={field.handleBlur}
        aria-invalid={A.isReadonlyArrayNonEmpty(errors) || undefined}
      />
    </FieldShell>
  );
};
