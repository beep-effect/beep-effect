/**
 * Boolean field bound to the `@beep/ui` `Checkbox` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Checkbox } from "@beep/ui/components/checkbox";
import { InlineBooleanField, useBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link CheckboxField}.
 *
 * **Example** (Satisfy checkbox field props)
 *
 * ```ts
 * import type { CheckboxFieldProps } from "@beep/form/fields/CheckboxField"
 *
 * const props = {
 *   label: "Accept terms",
 *   disabled: false,
 * } satisfies CheckboxFieldProps
 *
 * console.log(props.label) // "Accept terms"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface CheckboxFieldProps
  extends Omit<React.ComponentProps<typeof Checkbox>, "checked" | "onCheckedChange" | "name" | "id"> {
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound checkbox rendered inline with its label.
 *
 * **Example** (Consent form with checkbox)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { CheckboxField } from "@beep/form/fields/CheckboxField"
 * import * as S from "effect/Schema"
 *
 * const ConsentSchema = S.Struct({ accept: S.Boolean })
 * const consentOptions = makeFormOptions({
 *   schema: ConsentSchema,
 *   defaultValues: { accept: false },
 *   validateOn: "change",
 * })
 *
 * export function ConsentForm() {
 *   const form = useAppForm(consentOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="accept">
 *           {() => <CheckboxField label="Accept the terms" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(consentOptions.defaultValues.accept) // false
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const CheckboxField: React.FC<CheckboxFieldProps> = ({ label, ...props }) => {
  const { errors, field, hasErrors } = useBoundField<boolean>();
  return (
    <InlineBooleanField htmlFor={field.name} label={label} errors={errors} hasErrors={hasErrors}>
      <Checkbox
        {...props}
        id={field.name}
        name={field.name}
        checked={field.state.value}
        onCheckedChange={(checked) => field.handleChange(checked)}
        onBlur={field.handleBlur}
        aria-invalid={hasErrors || undefined}
      />
    </InlineBooleanField>
  );
};
