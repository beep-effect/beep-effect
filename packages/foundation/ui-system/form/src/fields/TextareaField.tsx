/**
 * Multi-line text field bound to the `@beep/ui` `Textarea` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Textarea } from "@beep/ui/components/textarea";
import { bindStringChangeControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link TextareaField}.
 *
 * **Example** (Textarea props with rows)
 *
 * ```ts
 * import type { TextareaFieldProps } from "@beep/form/fields/TextareaField"
 *
 * const props = {
 *   label: "Notes",
 *   placeholder: "Add internal notes",
 *   rows: 4,
 * } satisfies TextareaFieldProps
 *
 * console.log(props.rows) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface TextareaFieldProps
  extends Omit<React.ComponentProps<typeof Textarea>, "value" | "onChange" | "onBlur" | "name" | "id"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound multi-line text input.
 *
 * **Example** (Profile bio textarea field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { TextareaField } from "@beep/form/fields/TextareaField"
 * import * as S from "effect/Schema"
 *
 * const ProfileSchema = S.Struct({ bio: S.String })
 * const profileOptions = makeFormOptions({
 *   schema: ProfileSchema,
 *   defaultValues: { bio: "" },
 *   validateOn: "change",
 * })
 *
 * export function BioForm() {
 *   const form = useAppForm(profileOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="bio">
 *           {() => <TextareaField label="Bio" rows={4} placeholder="Short profile" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(profileOptions.defaultValues.bio) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const TextareaField: React.FC<TextareaFieldProps> = createBoundField<
  string,
  TextareaFieldProps,
  ReturnType<typeof bindStringChangeControl>
>({ Control: Textarea, bindControl: bindStringChangeControl });
