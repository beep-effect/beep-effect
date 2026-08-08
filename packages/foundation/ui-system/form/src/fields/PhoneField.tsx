/**
 * Phone field bound to the `@beep/ui` `PhoneInput` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { PhoneInput } from "@beep/ui/components/phone-input";
import { bindNamedValueControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link PhoneField}: `PhoneInput` props plus label/description;
 * binding props are owned by the field.
 *
 * **Example** (Phone field props)
 *
 * ```ts
 * import type { PhoneFieldProps } from "@beep/form/fields/PhoneField"
 *
 * const props = {
 *   label: "Mobile phone",
 *   description: "Stores an E.164 phone number string.",
 * } satisfies PhoneFieldProps
 *
 * console.log(props.label) // "Mobile phone"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface PhoneFieldProps
  extends Omit<
    React.ComponentProps<typeof PhoneInput>,
    "defaultValue" | "id" | "name" | "onBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

type PhoneControlProps = {
  readonly "aria-invalid"?: boolean | undefined;
  readonly id: string;
  readonly name: string;
  readonly onBlur: () => void;
  readonly onValueChange: (value: string) => void;
  readonly value: string;
};

/**
 * Schema-bound phone input whose canonical value is an E.164 string.
 *
 * **Example** (E.164 phone form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { PhoneField } from "@beep/form/fields/PhoneField"
 * import * as S from "effect/Schema"
 *
 * const ContactSchema = S.Struct({ phone: S.String })
 * const contactOptions = makeFormOptions({
 *   schema: ContactSchema,
 *   defaultValues: { phone: "+15551234567" },
 *   validateOn: "change",
 * })
 *
 * export function PhoneForm() {
 *   const form = useAppForm(contactOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="phone">{() => <PhoneField label="Phone" defaultCountry="US" />}</form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(contactOptions.defaultValues.phone) // "+15551234567"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const PhoneField: React.FC<PhoneFieldProps> = createBoundField<string, PhoneFieldProps, PhoneControlProps>({
  Control: PhoneInput,
  bindControl: bindNamedValueControl,
});
