/**
 * Upload field bound to the `@beep/ui` `Upload` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Upload } from "@beep/ui/components/upload";
import { bindUploadControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link UploadField}: `Upload` props plus label/description; binding
 * props are owned by the field.
 *
 * **Example** (Satisfies UploadFieldProps shape)
 *
 * ```ts
 * import type { UploadFieldProps } from "@beep/form/fields/UploadField"
 *
 * const props = {
 *   label: "Documents",
 *   accept: { "application/pdf": [".pdf"] },
 *   maxFiles: 3,
 * } satisfies UploadFieldProps
 *
 * console.log(props.accept["application/pdf"]?.[0]) // ".pdf"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface UploadFieldProps
  extends Omit<
    React.ComponentProps<typeof Upload>,
    "inputId" | "inputName" | "onInputBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * TanStack-bound upload field for document-style file arrays.
 *
 * **Details**
 *
 * Use through `useAppForm` as `field.Upload`; the field value remains the
 * canonical `ReadonlyArray<File>` that the underlying `@beep/ui` primitive
 * receives.
 *
 * **Example** (Documents file upload form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const DocumentsSchema = S.Struct({
 *   files: S.Array(S.instanceOf(File)),
 * })
 *
 * const documentsDefaults: { readonly files: ReadonlyArray<File> } = {
 *   files: [],
 * }
 *
 * export function DocumentsForm() {
 *   const form = useAppForm(
 *     makeFormOptions({
 *       schema: DocumentsSchema,
 *       defaultValues: documentsDefaults,
 *       validateOn: "change",
 *     })
 *   )
 *
 *   return (
 *     <form.AppForm>
 *       <Form aria-label="Documents" onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="files">
 *           {(field) => <field.Upload label="Documents" accept={{ "application/pdf": [".pdf"] }} />}
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
export const UploadField: React.FC<UploadFieldProps> = createBoundField<
  ReadonlyArray<File>,
  UploadFieldProps,
  ReturnType<typeof bindUploadControl>
>({ Control: Upload, bindControl: bindUploadControl });
