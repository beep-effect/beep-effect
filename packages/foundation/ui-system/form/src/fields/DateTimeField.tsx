/**
 * Date-time field bound to the `@beep/ui` Effect DateTime picker primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

// cspell:ignore ampm

import { EffectDateTimePicker } from "@beep/ui/components/effect-date-time-picker";
import { createDateTimePickerField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link DateTimeField}: `EffectDateTimePicker` props plus
 * label/description; binding props are owned by the field.
 *
 * **Example** (Props with ampm flag)
 *
 * ```ts
 * import type { DateTimeFieldProps } from "@beep/form/fields/DateTimeField"
 *
 * const props = {
 *   label: "Starts at",
 *   description: "Date and time in one control.",
 *   ampm: true,
 * } satisfies DateTimeFieldProps
 *
 * console.log(props.ampm) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface DateTimeFieldProps
  extends Omit<
    React.ComponentProps<typeof EffectDateTimePicker>,
    "defaultValue" | "label" | "name" | "onBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound date-time picker whose canonical value is Effect `DateTime`.
 *
 * **Example** (Event form date-time field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { DateTimeField } from "@beep/form/fields/DateTimeField"
 * import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid"
 * import * as DateTime from "effect/DateTime"
 * import * as S from "effect/Schema"
 *
 * const EventSchema = S.Struct({
 *   startsAt: S.NullOr(S.toType(DateTimeUtcFromValid)),
 * })
 * const defaultStart = DateTime.makeUnsafe("2024-02-03T15:30:00.000Z")
 * const eventOptions = makeFormOptions({
 *   schema: EventSchema,
 *   defaultValues: { startsAt: defaultStart },
 *   validateOn: "change",
 * })
 *
 * export function EventForm() {
 *   const form = useAppForm(eventOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="startsAt">
 *           {() => <DateTimeField label="Starts at" ampm />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * const startsAt = eventOptions.defaultValues.startsAt
 * console.log(startsAt === null ? "unset" : DateTime.formatIso(startsAt))
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const DateTimeField: React.FC<DateTimeFieldProps> =
  createDateTimePickerField<DateTimeFieldProps>(EffectDateTimePicker);
