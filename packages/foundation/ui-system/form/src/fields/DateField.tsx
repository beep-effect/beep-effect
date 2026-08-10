/**
 * Date field bound to the `@beep/ui` Effect DateTime picker primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { EffectDatePicker } from "@beep/ui/components/effect-date-time-picker";
import { createDateTimePickerField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link DateField}: `EffectDatePicker` props plus
 * label/description; binding props are owned by the field.
 *
 * **Example** (Props with disablePast)
 *
 * ```ts
 * import type { DateFieldProps } from "@beep/form/fields/DateField"
 *
 * const props = {
 *   label: "Due date",
 *   description: "Date-only calendar selection.",
 *   disablePast: true,
 * } satisfies DateFieldProps
 *
 * console.log(props.disablePast) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface DateFieldProps
  extends Omit<
    React.ComponentProps<typeof EffectDatePicker>,
    "defaultValue" | "label" | "name" | "onBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound date picker whose canonical value is Effect `DateTime`.
 *
 * **Example** (Schedule form date field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { DateField } from "@beep/form/fields/DateField"
 * import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid"
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 *
 * const ScheduleSchema = S.Struct({
 *   startDate: S.NullOr(S.toType(DateTimeUtcFromValid)),
 * })
 * const defaultStartDate = DateTime.makeUnsafe("2024-02-03T00:00:00.000Z")
 * const scheduleOptions = makeFormOptions({
 *   schema: ScheduleSchema,
 *   defaultValues: { startDate: defaultStartDate },
 *   validateOn: "change",
 * })
 *
 * export function ScheduleForm() {
 *   const form = useAppForm(scheduleOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="startDate">{() => <DateField label="Start date" />}</form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * const startDate = scheduleOptions.defaultValues.startDate
 * console.log(startDate === null ? "unset" : DateTime.formatIso(startDate))
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const DateField: React.FC<DateFieldProps> = createDateTimePickerField<DateFieldProps>(EffectDatePicker);
