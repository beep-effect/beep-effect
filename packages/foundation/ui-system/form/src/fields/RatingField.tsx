/**
 * Rating field bound to the `@beep/ui` `Rating` primitive.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Rating } from "@beep/ui/components/rating";
import { createBoundField } from "../internal/FieldBinding.tsx";
import type React from "react";
import type { BoundFieldState } from "../internal/FieldBinding.tsx";

/**
 * Props for {@link RatingField}: `Rating` props plus label/description; binding
 * props are owned by the field.
 *
 * **Example** (Satisfying rating field props)
 *
 * ```ts
 * import type { RatingFieldProps } from "@beep/form/fields/RatingField"
 *
 * const props = {
 *   label: "Satisfaction",
 *   description: "Collects a one-to-five score.",
 *   max: 5,
 * } satisfies RatingFieldProps
 *
 * console.log(props.max) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface RatingFieldProps
  extends Omit<React.ComponentProps<typeof Rating>, "name" | "onBlur" | "onValueChange" | "value"> {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
}

interface RatingControlProps {
  readonly "aria-invalid"?: boolean | undefined;
  readonly name: string;
  readonly onBlur: () => void;
  readonly onValueChange: (value: number) => void;
  readonly value: number;
}

const bindRatingControl = ({ field, hasErrors }: BoundFieldState<number>): RatingControlProps => ({
  name: field.name,
  value: field.state.value,
  onValueChange: (value) => field.handleChange(value),
  onBlur: field.handleBlur,
  "aria-invalid": hasErrors || undefined,
});

/**
 * Schema-bound numeric rating field backed by the registered `Rating`
 * AppField component.
 *
 * **Example** (Review form rating field)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const ReviewSchema = S.Struct({ rating: S.Finite })
 * const reviewOptions = makeFormOptions({
 *   schema: ReviewSchema,
 *   defaultValues: { rating: 3 },
 *   validateOn: "change",
 * })
 *
 * export const ReviewForm = () => {
 *   const form = useAppForm(reviewOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="rating">
 *           {(field) => <field.Rating label="Rating" max={5} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(reviewOptions.defaultValues.rating) // 3
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const RatingField: React.FC<RatingFieldProps> = createBoundField<number, RatingFieldProps, RatingControlProps>({
  Control: Rating,
  bindControl: bindRatingControl,
});
