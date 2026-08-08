/**
 * Multiple-selection field with chips bound to the `@beep/ui` `Combobox`
 * primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxValue,
  useComboboxAnchor,
} from "@beep/ui/components/combobox";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { ComboboxOptionsContent, optionValues } from "../internal/ComboboxFieldParts.tsx";
import { BoundField } from "../internal/FieldBinding.tsx";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";

/**
 * Props for {@link MultiSelectField}: `Combobox` props plus
 * label/description/options/placeholder; binding props
 * (`items`/`value`/`onValueChange`/`name`/`multiple`) are owned by the field.
 *
 * **Example** (Tags multi-select props)
 *
 * ```ts
 * import type { MultiSelectFieldProps } from "@beep/form/fields/MultiSelectField"
 *
 * const props = {
 *   label: "Tags",
 *   options: [
 *     { value: "docs", label: "Docs" },
 *     { value: "release", label: "Release" },
 *   ],
 *   placeholder: "Choose tags",
 * } satisfies MultiSelectFieldProps
 *
 * console.log(props.options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface MultiSelectFieldProps
  extends Omit<
    React.ComponentProps<typeof Combobox>,
    "items" | "value" | "defaultValue" | "onValueChange" | "name" | "multiple"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
  readonly placeholder?: string | undefined;
}

const optionLabel = (options: ReadonlyArray<FieldOption>, value: string): React.ReactNode =>
  O.match(
    A.findFirst(options, (option) => option.value === value),
    {
      onNone: () => value,
      onSome: (option) => option.label,
    }
  );

const optionAccessibleLabel = (options: ReadonlyArray<FieldOption>, value: string): string =>
  O.match(
    A.findFirst(options, (option) => option.value === value),
    {
      onNone: () => value,
      onSome: (option) => (P.isString(option.label) || P.isNumber(option.label) ? String(option.label) : value),
    }
  );

/**
 * Schema-bound multi-select combobox: the value is the array of selected option
 * values, rendered as removable chips.
 *
 * **Example** (Filter form multi-select)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const FilterSchema = S.Struct({ tags: S.Array(S.String) })
 * const tagOptions = [
 *   { value: "docs", label: "Docs" },
 *   { value: "release", label: "Release" },
 * ]
 * const filterOptions = makeFormOptions({
 *   schema: FilterSchema,
 *   defaultValues: { tags: ["docs"] },
 *   validateOn: "change",
 * })
 *
 * export const FilterForm = () => {
 *   const form = useAppForm(filterOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="tags">
 *           {(field) => <field.MultiSelect label="Tags" options={tagOptions} placeholder="Choose tags" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(filterOptions.defaultValues.tags.join(", ")) // "docs"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  label,
  description,
  options,
  placeholder,
  ...props
}) => {
  const anchor = useComboboxAnchor();
  return (
    <BoundField<ReadonlyArray<string>> label={label} description={description}>
      {({ field, hasErrors }) => (
        <Combobox
          {...props}
          multiple
          items={optionValues(options)}
          name={field.name}
          value={[...field.state.value]}
          onValueChange={(value) => field.handleChange(A.map(value, String))}
        >
          <ComboboxChips ref={anchor}>
            <ComboboxValue>
              {(value: ReadonlyArray<string>) =>
                A.map(value, (selected) => (
                  <ComboboxChip key={selected} aria-label={optionAccessibleLabel(options, selected)}>
                    {optionLabel(options, selected)}
                  </ComboboxChip>
                ))
              }
            </ComboboxValue>
            <ComboboxChipsInput
              id={field.name}
              placeholder={placeholder}
              onBlur={field.handleBlur}
              aria-invalid={hasErrors || undefined}
            />
          </ComboboxChips>
          <ComboboxOptionsContent anchor={anchor} emptyLabel="No results found." options={options} />
        </Combobox>
      )}
    </BoundField>
  );
};
