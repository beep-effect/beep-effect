/**
 * Slider primitive: a range input built on Base UI's slider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Slider as SliderPrimitive } from "@base-ui/react/slider";
import { A } from "@beep/utils";
import * as P from "effect/Predicate";
import { cn } from "../lib/index.ts";

const sliderValues = (
  value: SliderPrimitive.Root.Props["value"],
  defaultValue: SliderPrimitive.Root.Props["defaultValue"],
  min: number
) => {
  if (A.isArray(value)) {
    return value;
  }

  if (P.isNumber(value)) {
    return A.make(value);
  }

  if (A.isArray(defaultValue)) {
    return defaultValue;
  }

  if (P.isNumber(defaultValue)) {
    return A.make(defaultValue);
  }

  return A.make(min);
};

/**
 * Slider component.
 *
 * **Example** (Import Slider component)
 *
 * ```tsx
 * import { Slider } from "@beep/ui/components/slider"
 *
 * console.log(Slider)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Slider({ className, defaultValue, value, min = 0, max = 100, ref, ...props }: SliderPrimitive.Root.Props) {
  const _values = sliderValues(value, defaultValue, min);

  return (
    <SliderPrimitive.Root
      className="data-horizontal:w-full data-vertical:h-full"
      data-slot="slider"
      {...(defaultValue !== undefined ? { defaultValue } : {})}
      {...(value !== undefined ? { value } : {})}
      {...(ref !== undefined && ref !== null ? { ref } : {})}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control
        className={cn(
          "data-vertical:min-h-40 relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col",
          className
        )}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted rounded-full data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1 relative overflow-hidden select-none"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {A.makeBy(_values.length, (index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="border-ring ring-ring/50 relative size-3 rounded-full border bg-white transition-[color,box-shadow] after:absolute after:-inset-2 hover:ring-[3px] focus-visible:ring-[3px] focus-visible:outline-hidden active:ring-[3px] block shrink-0 select-none disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Slider };
