/**
 * Time field bound to the `@beep/ui` Effect DateTime picker primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

// cspell:ignore ampm

import { EffectTimePicker } from "@beep/ui/components/effect-date-time-picker";
import { createDateTimePickerField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link TimeField}: `EffectTimePicker` props plus label/description;
 * binding props are owned by the field.
 *
 * @example
 * ```ts
 * import type { TimeFieldProps } from "@beep/form/fields/TimeField"
 *
 * const props = {
 *   label: "Reminder time",
 *   description: "Stores the selected time using Effect DateTime.",
 *   ampm: true,
 * } satisfies TimeFieldProps
 *
 * console.log(props.label) // "Reminder time"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface TimeFieldProps
  extends Omit<
    React.ComponentProps<typeof EffectTimePicker>,
    "defaultValue" | "label" | "name" | "onBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound time picker whose canonical value is Effect `DateTime`.
 *
 * @example
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { TimeField } from "@beep/form/fields/TimeField"
 * import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid"
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 *
 * const ReminderSchema = S.Struct({
 *   reminderTime: S.NullOr(S.toType(DateTimeUtcFromValid)),
 * })
 * const defaultReminderTime = DateTime.makeUnsafe("2024-02-03T09:30:00.000Z")
 * const reminderOptions = makeFormOptions({
 *   schema: ReminderSchema,
 *   defaultValues: { reminderTime: defaultReminderTime },
 *   validateOn: "change",
 * })
 *
 * export function ReminderForm() {
 *   const form = useAppForm(reminderOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="reminderTime">
 *           {() => <TimeField label="Reminder time" ampm />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * const reminderTime = reminderOptions.defaultValues.reminderTime
 * console.log(reminderTime === null ? "unset" : DateTime.formatIso(reminderTime))
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const TimeField: React.FC<TimeFieldProps> = createDateTimePickerField<TimeFieldProps>(EffectTimePicker);
