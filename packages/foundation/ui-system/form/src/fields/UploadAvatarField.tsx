/**
 * Upload avatar field bound to the `@beep/ui` `UploadAvatar` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { UploadAvatar } from "@beep/ui/components/upload";
import { bindUploadControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link UploadAvatarField}: `UploadAvatar` props plus
 * label/description; binding props are owned by the field.
 *
 * **Example** (Satisfies UploadAvatarFieldProps shape)
 *
 * ```ts
 * import type { UploadAvatarFieldProps } from "@beep/form/fields/UploadAvatarField"
 *
 * const props = {
 *   label: "Avatar",
 *   accept: { "image/*": [".png", ".jpg", ".webp"] },
 *   maxFiles: 1,
 * } satisfies UploadAvatarFieldProps
 *
 * console.log(props.maxFiles) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface UploadAvatarFieldProps
  extends Omit<
    React.ComponentProps<typeof UploadAvatar>,
    "inputId" | "inputName" | "onInputBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * TanStack-bound avatar upload field backed by a single-file array value.
 *
 * **Details**
 *
 * Use through `useAppForm` as `field.UploadAvatar`; the avatar preview is
 * rendered by the underlying `@beep/ui` primitive while the form value stays a
 * `ReadonlyArray<File>`.
 *
 * **Example** (Profile avatar upload form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const ProfileSchema = S.Struct({
 *   avatar: S.Array(S.instanceOf(File)),
 * })
 *
 * const profileDefaults: { readonly avatar: ReadonlyArray<File> } = {
 *   avatar: [],
 * }
 *
 * export function ProfileAvatarForm() {
 *   const form = useAppForm(
 *     makeFormOptions({
 *       schema: ProfileSchema,
 *       defaultValues: profileDefaults,
 *       validateOn: "change",
 *     })
 *   )
 *
 *   return (
 *     <form.AppForm>
 *       <Form aria-label="Profile avatar" onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="avatar">
 *           {(field) => (
 *             <field.UploadAvatar label="Avatar" accept={{ "image/*": [".png", ".jpg", ".webp"] }} maxFiles={1} />
 *           )}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const UploadAvatarField: React.FC<UploadAvatarFieldProps> = createBoundField<
  ReadonlyArray<File>,
  UploadAvatarFieldProps,
  ReturnType<typeof bindUploadControl>
>({ Control: UploadAvatar, bindControl: bindUploadControl });
