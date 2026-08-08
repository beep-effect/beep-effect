/**
 * Numeric field bound to the `@beep/ui` `Input` primitive (`type="number"`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Input } from "@beep/ui/components/input";
import * as A from "effect/Array";
import { useFieldContext } from "../core/contexts.ts";
import { toFieldErrors } from "../core/Errors.ts";
import { FieldShell } from "../internal/FieldShell.tsx";
import type React from "react";

/**
 * Props for {@link NumberField}.
 *
 * **Example** (Quantity number field props)
 *
 * ```ts
 * import type { NumberFieldProps } from "@beep/form/fields/NumberField"
 *
 * const props = {
 *   label: "Quantity",
 *   description: "Accepts decimal input.",
 *   min: 1,
 * } satisfies NumberFieldProps
 *
 * console.log(props.min) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface NumberFieldProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur" | "name" | "id" | "type"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound numeric input. The form value stays a `number`; an empty input
 * surfaces as `NaN` for the schema to reject.
 *
 * **Example** (Quantity number form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { NumberField } from "@beep/form/fields/NumberField"
 * import * as S from "effect/Schema"
 *
 * const OrderSchema = S.Struct({ quantity: S.Finite })
 * const orderOptions = makeFormOptions({
 *   schema: OrderSchema,
 *   defaultValues: { quantity: 1 },
 *   validateOn: "change",
 * })
 *
 * export function QuantityForm() {
 *   const form = useAppForm(orderOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="quantity">
 *           {() => <NumberField label="Quantity" min={1} step={1} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(orderOptions.defaultValues.quantity) // 1
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const NumberField: React.FC<NumberFieldProps> = ({ label, description, ...props }) => {
  const field = useFieldContext<number>();
  const errors = toFieldErrors(field.state.meta.errors);
  const value = field.state.value;
  return (
    <FieldShell htmlFor={field.name} label={label} description={description} errors={errors}>
      <Input
        {...props}
        type="number"
        inputMode="decimal"
        id={field.name}
        name={field.name}
        value={Number.isFinite(value) ? value : ""}
        onChange={(event) => field.handleChange(event.target.valueAsNumber)}
        onBlur={field.handleBlur}
        aria-invalid={A.isReadonlyArrayNonEmpty(errors) || undefined}
      />
    </FieldShell>
  );
};
