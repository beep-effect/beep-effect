/**
 * Numeric field bound to the `@beep/ui` `Slider` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Slider } from "@beep/ui/components/slider";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { BoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link SliderField}: `Slider` props plus label/description; binding
 * props (`value`/`onValueChange`/`onBlur`/`name`) are owned by the field.
 *
 * **Example** (Slider props min max step)
 *
 * ```ts
 * import type { SliderFieldProps } from "@beep/form/fields/SliderField"
 *
 * const props = {
 *   label: "Volume",
 *   description: "Stores one numeric value.",
 *   min: 0,
 *   max: 100,
 *   step: 5,
 * } satisfies SliderFieldProps
 *
 * console.log(props.step) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SliderFieldProps
  extends Omit<React.ComponentProps<typeof Slider>, "value" | "onValueChange" | "onBlur" | "name"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

/**
 * Schema-bound slider. The form value stays a single `number`; the base-ui
 * thumb value array is collapsed to its first element on change.
 *
 * **Example** (Bound volume slider field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const VolumeSchema = S.Struct({ volume: S.Finite })
 * const volumeOptions = makeFormOptions({
 *   schema: VolumeSchema,
 *   defaultValues: { volume: 50 },
 *   validateOn: "change",
 * })
 *
 * export const VolumeForm = () => {
 *   const form = useAppForm(volumeOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="volume">
 *           {(field) => <field.Slider label="Volume" min={0} max={100} step={5} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(volumeOptions.defaultValues.volume) // 50
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const SliderField: React.FC<SliderFieldProps> = ({ label, description, ...props }) => (
  <BoundField<number> label={label} description={description}>
    {({ field, hasErrors }) => (
      <Slider
        {...props}
        name={field.name}
        value={[field.state.value]}
        onValueChange={(value) => field.handleChange(O.getOrElse(A.head(A.ensure(value)), () => field.state.value))}
        onBlur={field.handleBlur}
        aria-invalid={hasErrors || undefined}
      />
    )}
  </BoundField>
);
