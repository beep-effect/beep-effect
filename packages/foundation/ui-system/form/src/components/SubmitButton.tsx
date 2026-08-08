/**
 * Form submit button bound to the active form's submission state.
 *
 * Subscribes to `canSubmit` / `isSubmitting` via `form.Subscribe` (a narrowing
 * selector to minimize re-renders) and maps them onto a `@beep/ui` `Button`.
 * Registered as a form component on {@link useAppForm}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import { useFormContext } from "../core/contexts.ts";
import type React from "react";

/**
 * Props for {@link SubmitButton}: every `@beep/ui` `Button` prop.
 *
 * **Example** (Button props shape)
 *
 * ```tsx
 * import type { SubmitButtonProps } from "@beep/form/components/SubmitButton"
 *
 * const props = {
 *   children: "Save",
 *   variant: "default",
 * } satisfies SubmitButtonProps
 *
 * console.log(props.children) // "Save"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
  readonly children?: React.ReactNode | undefined;
}

/**
 * Submit button that disables itself while the form cannot submit or is
 * submitting.
 *
 * **Gotchas**
 *
 * `SubmitButton` reads the active form from provider context. Render it inside
 * `<form.AppForm>` (or use the registered `<form.Submit>` component) so it can
 * subscribe to `canSubmit` and `isSubmitting`.
 *
 * **Example** (Submit button in form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { SubmitButton } from "@beep/form/components/SubmitButton"
 * import * as S from "effect/Schema"
 *
 * const ContactSchema = S.Struct({ email: S.String })
 * const contactOptions = makeFormOptions({
 *   schema: ContactSchema,
 *   defaultValues: { email: "" },
 *   validateOn: "change",
 * })
 *
 * export function ContactForm() {
 *   const form = useAppForm(contactOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="email">{(field) => <field.Text label="Email" />}</form.AppField>
 *         <SubmitButton>Save</SubmitButton>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(contactOptions.defaultValues.email) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({ children, ...props }) => {
  const form = useFormContext();
  return (
    <form.Subscribe selector={(state) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
      {({ canSubmit, isSubmitting }) => (
        <Button {...props} type="submit" disabled={!canSubmit || isSubmitting}>
          {children ?? "Submit"}
        </Button>
      )}
    </form.Subscribe>
  );
};
