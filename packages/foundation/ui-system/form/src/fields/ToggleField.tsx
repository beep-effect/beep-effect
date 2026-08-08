/**
 * Boolean field bound to the `@beep/ui` `Toggle` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Toggle } from "@beep/ui/components/toggle";
import { InlineBooleanField, useBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link ToggleField}.
 *
 * **Example** (Satisfies ToggleFieldProps shape)
 *
 * ```ts
 * import type { ToggleFieldProps } from "@beep/form/fields/ToggleField"
 *
 * const props = {
 *   label: "Bold",
 *   variant: "outline",
 * } satisfies ToggleFieldProps
 *
 * console.log(props.variant) // "outline"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ToggleFieldProps
  extends Omit<React.ComponentProps<typeof Toggle>, "pressed" | "onPressedChange" | "name" | "id"> {
  readonly label?: React.ReactNode | undefined;
}

const toggleContent = (label: React.ReactNode | undefined, children: React.ReactNode | undefined): React.ReactNode =>
  children ?? label;

const toggleExternalLabel = (
  label: React.ReactNode | undefined,
  children: React.ReactNode | undefined
): React.ReactNode | undefined => (children === undefined ? undefined : label);

/**
 * Schema-bound toggle rendered inline with its label.
 *
 * **Example** (Schema-bound bold toggle form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { ToggleField } from "@beep/form/fields/ToggleField"
 * import * as S from "effect/Schema"
 *
 * const FormatSchema = S.Struct({ bold: S.Boolean })
 * const formatOptions = makeFormOptions({
 *   schema: FormatSchema,
 *   defaultValues: { bold: false },
 *   validateOn: "change",
 * })
 *
 * export function FormatForm() {
 *   const form = useAppForm(formatOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="bold">{() => <ToggleField label="Bold" />}</form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(formatOptions.defaultValues.bold) // false
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ToggleField: React.FC<ToggleFieldProps> = ({ label, children, variant = "outline", ...props }) => {
  const { errors, field, hasErrors } = useBoundField<boolean>();
  return (
    <InlineBooleanField
      htmlFor={field.name}
      label={toggleExternalLabel(label, children)}
      errors={errors}
      hasErrors={hasErrors}
    >
      <Toggle
        {...props}
        id={field.name}
        name={field.name}
        pressed={field.state.value}
        onPressedChange={(pressed) => field.handleChange(pressed)}
        onBlur={field.handleBlur}
        aria-invalid={hasErrors || undefined}
        variant={variant}
      >
        {toggleContent(label, children)}
      </Toggle>
    </InlineBooleanField>
  );
};
