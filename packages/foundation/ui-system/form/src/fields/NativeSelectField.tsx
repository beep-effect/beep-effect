/**
 * Single-select field bound to the `@beep/ui` `NativeSelect` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { BoundField } from "../internal/FieldBinding.tsx";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";

/**
 * Props for {@link NativeSelectField}: `NativeSelect` props plus
 * label/description/options; binding props (`value`/`onChange`/`onBlur`/`name`/
 * `id`) are owned by the field.
 *
 * **Example** (Priority select props)
 *
 * ```ts
 * import type { NativeSelectFieldProps } from "@beep/form/fields/NativeSelectField"
 *
 * const props = {
 *   label: "Priority",
 *   options: [
 *     { value: "low", label: "Low" },
 *     { value: "high", label: "High" },
 *   ],
 * } satisfies NativeSelectFieldProps
 *
 * console.log(props.options[0]?.label) // "Low"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface NativeSelectFieldProps
  extends Omit<React.ComponentProps<typeof NativeSelect>, "value" | "onChange" | "onBlur" | "name" | "id"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
}

/**
 * Schema-bound native `<select>` dropdown.
 *
 * **Example** (Priority select form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { NativeSelectField } from "@beep/form/fields/NativeSelectField"
 * import * as S from "effect/Schema"
 *
 * const PrioritySchema = S.Struct({ priority: S.String })
 * const priorityOptions = [
 *   { value: "low", label: "Low" },
 *   { value: "high", label: "High" },
 * ]
 * const priorityFormOptions = makeFormOptions({
 *   schema: PrioritySchema,
 *   defaultValues: { priority: "low" },
 *   validateOn: "change",
 * })
 *
 * export function PriorityForm() {
 *   const form = useAppForm(priorityFormOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="priority">
 *           {() => <NativeSelectField label="Priority" options={priorityOptions} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(priorityFormOptions.defaultValues.priority) // "low"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const NativeSelectField: React.FC<NativeSelectFieldProps> = ({ label, description, options, ...props }) => (
  <BoundField<string> label={label} description={description}>
    {({ field, hasErrors }) => (
      <NativeSelect
        {...props}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value)}
        onBlur={field.handleBlur}
        aria-invalid={hasErrors || undefined}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    )}
  </BoundField>
);
