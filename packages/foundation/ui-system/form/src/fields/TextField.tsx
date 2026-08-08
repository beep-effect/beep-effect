/**
 * Text field bound to the `@beep/ui` `Input` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Input } from "@beep/ui/components/input";
import { bindStringChangeControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link TextField}: `Input` props plus label/description; binding
 * props (`value`/`onChange`/`onBlur`/`name`/`id`) are owned by the field.
 *
 * **Example** (Text field props example)
 *
 * ```ts
 * import type { TextFieldProps } from "@beep/form/fields/TextField"
 *
 * const props = {
 *   label: "Name",
 *   description: "Shown above the text input.",
 *   placeholder: "Ada Lovelace",
 * } satisfies TextFieldProps
 *
 * console.log(props.placeholder) // "Ada Lovelace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface TextFieldProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "onBlur" | "name" | "id"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound single-line text input.
 *
 * **Example** (Username login form field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { TextField } from "@beep/form/fields/TextField"
 * import * as S from "effect/Schema"
 *
 * const LoginSchema = S.Struct({ username: S.String })
 * const loginOptions = makeFormOptions({
 *   schema: LoginSchema,
 *   defaultValues: { username: "" },
 *   validateOn: "change",
 * })
 *
 * export function LoginForm() {
 *   const form = useAppForm(loginOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="username">
 *           {() => <TextField label="Username" placeholder="ada" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(loginOptions.defaultValues.username) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const TextField: React.FC<TextFieldProps> = createBoundField<
  string,
  TextFieldProps,
  ReturnType<typeof bindStringChangeControl>
>({ Control: Input, bindControl: bindStringChangeControl });
