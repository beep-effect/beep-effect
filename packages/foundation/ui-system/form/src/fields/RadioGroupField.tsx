/**
 * Single-select field bound to the `@beep/ui` `RadioGroup` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Field, FieldLabel } from "@beep/ui/components/field";
import { RadioGroup, RadioGroupItem } from "@beep/ui/components/radio-group";
import * as A from "effect/Array";
import { useFieldContext } from "../core/contexts.ts";
import { toFieldErrors } from "../core/Errors.ts";
import { FieldShell } from "../internal/FieldShell.tsx";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";

/**
 * Props for {@link RadioGroupField}: `RadioGroup` props plus
 * label/description/options; binding props (`value`/`onValueChange`/`name`) are
 * owned by the field.
 *
 * **Example** (Plan radio group props)
 *
 * ```ts
 * import type { RadioGroupFieldProps } from "@beep/form/fields/RadioGroupField"
 *
 * const props = {
 *   label: "Plan",
 *   options: [
 *     { value: "free", label: "Free" },
 *     { value: "pro", label: "Pro" },
 *   ],
 * } satisfies RadioGroupFieldProps
 *
 * console.log(props.options[1]?.value) // "pro"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface RadioGroupFieldProps
  extends Omit<React.ComponentProps<typeof RadioGroup>, "value" | "onValueChange" | "name"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
}

/**
 * Schema-bound radio group: one selectable value among the options.
 *
 * **Example** (Plan radio group form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { RadioGroupField } from "@beep/form/fields/RadioGroupField"
 * import * as S from "effect/Schema"
 *
 * const PlanSchema = S.Struct({ plan: S.String })
 * const planOptions = [
 *   { value: "free", label: "Free" },
 *   { value: "pro", label: "Pro" },
 * ]
 * const planFormOptions = makeFormOptions({
 *   schema: PlanSchema,
 *   defaultValues: { plan: "free" },
 *   validateOn: "change",
 * })
 *
 * export function PlanForm() {
 *   const form = useAppForm(planFormOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="plan">
 *           {() => <RadioGroupField label="Plan" options={planOptions} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(planFormOptions.defaultValues.plan) // "free"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const RadioGroupField: React.FC<RadioGroupFieldProps> = ({ label, description, options, ...props }) => {
  const field = useFieldContext<string>();
  const errors = toFieldErrors(field.state.meta.errors);
  const hasErrors = A.isReadonlyArrayNonEmpty(errors);
  return (
    <FieldShell htmlFor={field.name} label={label} description={description} errors={errors}>
      <RadioGroup
        {...props}
        name={field.name}
        value={field.state.value}
        onValueChange={(value) => field.handleChange(String(value))}
        onBlur={field.handleBlur}
        aria-invalid={hasErrors || undefined}
      >
        {options.map((option) => (
          <Field key={option.value} orientation="horizontal">
            <RadioGroupItem value={option.value} disabled={option.disabled} id={`${field.name}-${option.value}`} />
            <FieldLabel htmlFor={`${field.name}-${option.value}`}>{option.label}</FieldLabel>
          </Field>
        ))}
      </RadioGroup>
    </FieldShell>
  );
};
