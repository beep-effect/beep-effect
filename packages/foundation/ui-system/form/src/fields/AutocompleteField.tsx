/**
 * Free-text field with suggestions bound to the `@beep/ui` `Combobox` primitive.
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
 * Props for {@link AutocompleteField}: `Combobox` props plus
 * label/description/options/placeholder; binding props
 * (`items`/`inputValue`/`onInputValueChange`/`onValueChange`/`name`) are owned
 * by the field.
 *
 * **Example** (Satisfy autocomplete field props)
 *
 * ```ts
 * import type { AutocompleteFieldProps } from "@beep/form/fields/AutocompleteField"
 *
 * const props = {
 *   label: "Assignee",
 *   options: [
 *     { value: "ada", label: "Ada Lovelace" },
 *     { value: "grace", label: "Grace Hopper" },
 *   ],
 *   placeholder: "Search people",
 * } satisfies AutocompleteFieldProps
 *
 * console.log(props.options[0]?.value) // "ada"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AutocompleteFieldProps
  extends Omit<
    React.ComponentProps<typeof Combobox>,
    "items" | "inputValue" | "onInputValueChange" | "onValueChange" | "value" | "name"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
  readonly placeholder?: string | undefined;
}

/**
 * Schema-bound free-text autocomplete: the value is whatever the user types,
 * with the options offered as filtered suggestions.
 *
 * **Example** (Search form with suggestions)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { AutocompleteField } from "@beep/form/fields/AutocompleteField"
 * import * as S from "effect/Schema"
 *
 * const SearchSchema = S.Struct({ query: S.String })
 * const suggestions = [
 *   { value: "apple", label: "Apple" },
 *   { value: "banana", label: "Banana" },
 * ]
 * const searchOptions = makeFormOptions({
 *   schema: SearchSchema,
 *   defaultValues: { query: "" },
 *   validateOn: "change",
 * })
 *
 * export function SearchForm() {
 *   const form = useAppForm(searchOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="query">
 *           {() => <AutocompleteField label="Search" options={suggestions} placeholder="Start typing" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(searchOptions.defaultValues.query) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const AutocompleteField: React.FC<AutocompleteFieldProps> = ({
  label,
  description,
  options,
  placeholder,
  ...props
}) => (
  <StringComboboxField
    comboboxProps={props}
    description={description}
    emptyLabel="No suggestions."
    label={label}
    mode="autocomplete"
    options={options}
    placeholder={placeholder}
  />
);
