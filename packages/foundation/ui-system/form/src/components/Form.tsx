/**
 * Thin `<form>` wrapper that stops native submission and delegates.
 *
 * Pair with TanStack's `form.handleSubmit`:
 * `<Form onSubmit={() => form.handleSubmit()}>`. It calls `preventDefault` /
 * `stopPropagation` before invoking the supplied `onSubmit`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import type React from "react";

/**
 * Props for {@link Form}: every native `<form>` prop.
 *
 * **Example** (Native form props)
 *
 * ```tsx
 * import type { FormProps } from "@beep/form/components/Form"
 *
 * const props = {
 *   "aria-label": "Profile",
 *   className: "grid gap-4",
 * } satisfies FormProps
 *
 * console.log(props["aria-label"]) // "Profile"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FormProps extends React.ComponentProps<"form"> {}

/**
 * Native `<form>` element that prevents default submission and delegates to the
 * supplied `onSubmit` handler.
 *
 * **Details**
 *
 * `Form` always calls `preventDefault()` and `stopPropagation()` before the
 * caller's handler. Pair it with `form.handleSubmit()` so TanStack owns submit
 * validation and state transitions instead of the browser's native navigation.
 *
 * **Example** (Profile form submit)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const ProfileSchema = S.Struct({ name: S.String })
 * const profileOptions = makeFormOptions({
 *   schema: ProfileSchema,
 *   defaultValues: { name: "" },
 *   validateOn: "change",
 * })
 *
 * export function ProfileForm() {
 *   const form = useAppForm(profileOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form aria-label="Profile" onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="name">
 *           {(field) => <field.Text label="Name" placeholder="Ada Lovelace" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(profileOptions.defaultValues.name) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const Form: React.FC<FormProps> = ({ onSubmit, children, ...props }) => (
  <form
    {...props}
    onSubmit={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onSubmit?.(event);
    }}
  >
    {children}
  </form>
);
