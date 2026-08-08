/**
 * Color field bound to the `@beep/ui` `ColorPicker` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { ColorPicker } from "@beep/ui/components/color-picker";
import { bindNamedValueControl, createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";

/**
 * Props for {@link ColorField}: `ColorPicker` props plus label/description;
 * binding props are owned by the field.
 *
 * **Example** (Satisfy color field props)
 *
 * ```ts
 * import type { ColorFieldProps } from "@beep/form/fields/ColorField"
 *
 * const props = {
 *   label: "Brand color",
 *   description: "Stored as a hex string.",
 * } satisfies ColorFieldProps
 *
 * console.log(props.label) // "Brand color"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ColorFieldProps
  extends Omit<
    React.ComponentProps<typeof ColorPicker>,
    "defaultValue" | "id" | "name" | "onBlur" | "onValueChange" | "value"
  > {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

type ColorControlProps = {
  readonly "aria-invalid"?: boolean | undefined;
  readonly id: string;
  readonly name: string;
  readonly onBlur: () => void;
  readonly onValueChange: (value: string) => void;
  readonly value: string;
};

/**
 * Schema-bound color picker whose value is a canonical hex color string.
 *
 * **Example** (Theme form color picker)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { ColorField } from "@beep/form/fields/ColorField"
 * import * as S from "effect/Schema"
 *
 * const ThemeSchema = S.Struct({ accent: S.String })
 * const themeOptions = makeFormOptions({
 *   schema: ThemeSchema,
 *   defaultValues: { accent: "#3366ff" },
 *   validateOn: "change",
 * })
 *
 * export function ThemeForm() {
 *   const form = useAppForm(themeOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="accent">{() => <ColorField label="Accent color" />}</form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(themeOptions.defaultValues.accent) // "#3366ff"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ColorField: React.FC<ColorFieldProps> = createBoundField<string, ColorFieldProps, ColorControlProps>({
  Control: ColorPicker,
  bindControl: bindNamedValueControl,
});
