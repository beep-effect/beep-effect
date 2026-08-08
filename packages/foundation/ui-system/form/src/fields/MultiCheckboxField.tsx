/**
 * Multi-select field rendering one `@beep/ui` `Checkbox` per option.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Checkbox } from "@beep/ui/components/checkbox";
import { MultiBooleanOptionField } from "../internal/FieldBinding.tsx";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";

/**
 * Props for {@link MultiCheckboxField}: label/description/options. The bound
 * value is the array of checked option values.
 *
 * **Example** (Options with disabled item)
 *
 * ```ts
 * import type { MultiCheckboxFieldProps } from "@beep/form/fields/MultiCheckboxField"
 *
 * const props = {
 *   label: "Channels",
 *   options: [
 *     { value: "email", label: "Email" },
 *     { value: "sms", label: "SMS", disabled: true },
 *   ],
 * } satisfies MultiCheckboxFieldProps
 *
 * console.log(props.options[1]?.disabled) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface MultiCheckboxFieldProps {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
}

/**
 * Schema-bound checkbox list: the value is the array of checked option values.
 *
 * **Example** (Toppings checkbox list form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { MultiCheckboxField } from "@beep/form/fields/MultiCheckboxField"
 * import * as S from "effect/Schema"
 *
 * const ToppingsSchema = S.Struct({ toppings: S.Array(S.String) })
 * const toppingOptions = [
 *   { value: "mushroom", label: "Mushroom" },
 *   { value: "pepper", label: "Pepper" },
 * ]
 * const toppingsFormOptions = makeFormOptions({
 *   schema: ToppingsSchema,
 *   defaultValues: { toppings: ["mushroom"] },
 *   validateOn: "change",
 * })
 *
 * export function ToppingsForm() {
 *   const form = useAppForm(toppingsFormOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="toppings">
 *           {() => <MultiCheckboxField label="Toppings" options={toppingOptions} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(toppingsFormOptions.defaultValues.toppings.join(", ")) // "mushroom"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const MultiCheckboxField: React.FC<MultiCheckboxFieldProps> = (props) => (
  <MultiBooleanOptionField {...props} Control={Checkbox} />
);
