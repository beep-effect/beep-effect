/**
 * Rating primitive composed from base-ui radio controls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { StarIcon } from "@phosphor-icons/react";
import * as A from "effect/Array";
import { cn } from "../lib/index.ts";
import type React from "react";

/**
 * Props for a numeric star rating backed by radio-group semantics.
 *
 * **Example** (Satisfy RatingProps shape)
 *
 * ```ts
 * import type { RatingProps } from "@beep/ui/components/rating"
 *
 * const props = {
 *   max: 10,
 *   value: 8,
 *   onValueChange: (value) => value > 0,
 * } satisfies RatingProps
 *
 * console.log(props.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface RatingProps
  extends Omit<RadioGroupPrimitive.Props, "value" | "defaultValue" | "onValueChange" | "children"> {
  readonly max?: number | undefined;
  readonly onValueChange?: ((value: number) => void) | undefined;
  readonly value?: number | undefined;
}

/**
 * Accessible star rating control.
 *
 * **Example** (Render satisfaction rating)
 *
 * ```tsx
 * import { Rating } from "@beep/ui/components/rating"
 *
 * export function SatisfactionRating() {
 *   return <Rating aria-label="Customer satisfaction" max={5} value={4} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const Rating: React.FC<RatingProps> = ({ className, max = 5, onValueChange, value = 0, ...props }) => (
  <RadioGroupPrimitive
    {...props}
    data-slot="rating"
    className={cn("flex items-center gap-1", className)}
    value={String(value)}
    onValueChange={(nextValue) => onValueChange?.(Number(nextValue))}
  >
    {A.makeBy(max, (index) => {
      const optionValue = index + 1;
      const filled = optionValue <= value;
      return (
        <RadioPrimitive.Root
          key={optionValue}
          value={String(optionValue)}
          aria-label={`${optionValue} of ${max}`}
          data-filled={filled || undefined}
          className="text-muted-foreground/60 hover:text-amber-300 data-[checked]:text-amber-400 data-[filled=true]:text-amber-400 focus-visible:ring-ring/50 rounded-sm outline-none transition-colors focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50"
        >
          <RadioPrimitive.Indicator className="sr-only" />
          <StarIcon weight={filled ? "fill" : "regular"} className="size-5" />
        </RadioPrimitive.Root>
      );
    })}
  </RadioGroupPrimitive>
);
