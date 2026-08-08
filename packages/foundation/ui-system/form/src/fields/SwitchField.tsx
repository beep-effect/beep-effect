/**
 * Boolean field bound to the `@beep/ui` `Switch` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Switch } from "@beep/ui/components/switch";
import { InlineBooleanField, useBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link SwitchField}.
 *
 * **Example** (Basic switch field props)
 *
 * ```ts
 * import type { SwitchFieldProps } from "@beep/form/fields/SwitchField"
 *
 * const props = {
 *   label: "Enabled",
 *   disabled: false,
 * } satisfies SwitchFieldProps
 *
 * console.log(props.label) // "Enabled"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SwitchFieldProps
  extends Omit<React.ComponentProps<typeof Switch>, "checked" | "onCheckedChange" | "name" | "id"> {
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound switch rendered inline with its label.
 *
 * **Example** (Notifications toggle form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { SwitchField } from "@beep/form/fields/SwitchField"
 * import * as S from "effect/Schema"
 *
 * const PreferencesSchema = S.Struct({ notifications: S.Boolean })
 * const preferencesOptions = makeFormOptions({
 *   schema: PreferencesSchema,
 *   defaultValues: { notifications: true },
 *   validateOn: "change",
 * })
 *
 * export function NotificationsForm() {
 *   const form = useAppForm(preferencesOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="notifications">
 *           {() => <SwitchField label="Enable notifications" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(preferencesOptions.defaultValues.notifications) // true
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const SwitchField: React.FC<SwitchFieldProps> = ({ label, ...props }) => {
  const { errors, field, hasErrors } = useBoundField<boolean>();
  return (
    <InlineBooleanField htmlFor={field.name} label={label} errors={errors} hasErrors={hasErrors}>
      <Switch
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
