/**
 * Upload box field bound to the `@beep/ui` `UploadBox` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { UploadBox } from "@beep/ui/components/upload";
import { bindUploadControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link UploadBoxField}: `UploadBox` props plus label/description;
 * binding props are owned by the field.
 *
 * **Example** (Satisfies UploadBoxFieldProps shape)
 *
 * ```ts
 * import type { UploadBoxFieldProps } from "@beep/form/fields/UploadBoxField"
 *
 * const props = {
 *   label: "Gallery",
 *   accept: { "image/*": [".png", ".jpg", ".webp"] },
 *   maxFiles: 6,
 * } satisfies UploadBoxFieldProps
 *
 * console.log(props.label) // "Gallery"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface UploadBoxFieldProps
  extends Omit<
    React.ComponentProps<typeof UploadBox>,
    "inputId" | "inputName" | "onInputBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * TanStack-bound dropzone upload field for multi-file arrays.
 *
 * **Details**
 *
 * Use through `useAppForm` as `field.UploadBox`; selected image files can be
 * previewed by the underlying `@beep/ui` primitive while TanStack stores the
 * canonical `ReadonlyArray<File>` value.
 *
 * **Example** (Gallery multi-file upload form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const GallerySchema = S.Struct({
 *   attachments: S.Array(S.instanceOf(File)),
 * })
 *
 * const galleryDefaults: { readonly attachments: ReadonlyArray<File> } = {
 *   attachments: [],
 * }
 *
 * export function GalleryUploadForm() {
 *   const form = useAppForm(
 *     makeFormOptions({
 *       schema: GallerySchema,
 *       defaultValues: galleryDefaults,
 *       validateOn: "change",
 *     })
 *   )
 *
 *   return (
 *     <form.AppForm>
 *       <Form aria-label="Gallery" onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="attachments">
 *           {(field) => (
 *             <field.UploadBox label="Gallery" accept={{ "image/*": [".png", ".jpg", ".webp"] }} maxFiles={6} />
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
export const UploadBoxField: React.FC<UploadBoxFieldProps> = createBoundField<
  ReadonlyArray<File>,
  UploadBoxFieldProps,
  ReturnType<typeof bindUploadControl>
>({ Control: UploadBox, bindControl: bindUploadControl });
