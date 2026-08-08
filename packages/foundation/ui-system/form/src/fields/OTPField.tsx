/**
 * One-time-code field bound to the `@beep/ui` `InputOTP` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { InputOTP, InputOTPGroup, InputOTPSlot } from "@beep/ui/components/input-otp";
import * as A from "effect/Array";
import { useFieldContext } from "../core/contexts.ts";
import { toFieldErrors } from "../core/Errors.ts";
import { FieldShell } from "../internal/FieldShell.tsx";
import type React from "react";

/**
 * Props for {@link OTPField}: `InputOTP` props plus label/description; binding
 * props (`value`/`onChange`/`onBlur`/`name`/`id`/`render`/`children`) are owned
 * by the field.
 *
 * **Example** (OTP verification props)
 *
 * ```ts
 * import type { OTPFieldProps } from "@beep/form/fields/OTPField"
 *
 * const props = {
 *   label: "Verification code",
 *   maxLength: 6,
 * } satisfies OTPFieldProps
 *
 * console.log(props.maxLength) // 6
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface OTPFieldProps
  extends Omit<
    React.ComponentProps<typeof InputOTP>,
    "value" | "onChange" | "onBlur" | "name" | "id" | "render" | "children" | "maxLength"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly maxLength?: number | undefined;
}

/**
 * Schema-bound one-time-code input rendered as a row of single-character slots.
 *
 * **Example** (OTP verification form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { OTPField } from "@beep/form/fields/OTPField"
 * import * as S from "effect/Schema"
 *
 * const VerificationSchema = S.Struct({ code: S.String })
 * const verificationOptions = makeFormOptions({
 *   schema: VerificationSchema,
 *   defaultValues: { code: "" },
 *   validateOn: "change",
 * })
 *
 * export function VerificationForm() {
 *   const form = useAppForm(verificationOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="code">
 *           {() => <OTPField label="Verification code" maxLength={6} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(verificationOptions.defaultValues.code) // ""
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const OTPField: React.FC<OTPFieldProps> = ({ label, description, maxLength = 6, ...props }) => {
  const field = useFieldContext<string>();
  const errors = toFieldErrors(field.state.meta.errors);
  return (
    <FieldShell htmlFor={field.name} label={label} description={description} errors={errors}>
      <InputOTP
        {...props}
        id={field.name}
        name={field.name}
        maxLength={maxLength}
        value={field.state.value}
        onChange={(value) => field.handleChange(value)}
        onBlur={field.handleBlur}
        aria-invalid={A.isReadonlyArrayNonEmpty(errors) || undefined}
      >
        <InputOTPGroup>
          {A.makeBy(maxLength, (index) => (
            <InputOTPSlot key={index} index={index} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </FieldShell>
  );
};
