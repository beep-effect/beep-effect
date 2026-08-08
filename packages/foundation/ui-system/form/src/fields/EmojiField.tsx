/**
 * Emoji field bound to the `@beep/ui` `EmojiPicker` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { EmojiPicker } from "@beep/ui/components/emoji-picker";
import { createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";
import type { BoundFieldState } from "../internal/FieldBinding.tsx";

/**
 * Props for {@link EmojiField}: `EmojiPicker` props plus label/description;
 * binding props are owned by the field.
 *
 * **Example** (Props with placeholder)
 *
 * ```ts
 * import type { EmojiFieldProps } from "@beep/form/fields/EmojiField"
 *
 * const props = {
 *   label: "Mood",
 *   description: "Stores the selected emoji string.",
 *   placeholder: "Select mood",
 * } satisfies EmojiFieldProps
 *
 * console.log(props.placeholder) // "Select mood"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EmojiFieldProps extends Omit<React.ComponentProps<typeof EmojiPicker>, "onValueChange" | "value"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

interface EmojiControlProps {
  readonly "aria-invalid"?: boolean | undefined;
  readonly onValueChange: (value: string) => void;
  readonly value: string;
}

const bindEmojiControl = ({ field, hasErrors }: BoundFieldState<string>): EmojiControlProps => ({
  value: field.state.value,
  onValueChange: (value) => field.handleChange(value),
  "aria-invalid": hasErrors || undefined,
});

/**
 * Schema-bound emoji picker whose value is the selected emoji string in form
 * state.
 *
 * **Example** (Mood form emoji field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const MoodSchema = S.Struct({ emoji: S.String })
 * const moodOptions = makeFormOptions({
 *   schema: MoodSchema,
 *   defaultValues: { emoji: "" },
 *   validateOn: "change",
 * })
 *
 * export const MoodForm = () => {
 *   const form = useAppForm(moodOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="emoji">
 *           {(field) => <field.Emoji label="Mood" />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(moodOptions.defaultValues.emoji) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const EmojiField: React.FC<EmojiFieldProps> = createBoundField<string, EmojiFieldProps, EmojiControlProps>({
  Control: EmojiPicker,
  bindControl: bindEmojiControl,
});
