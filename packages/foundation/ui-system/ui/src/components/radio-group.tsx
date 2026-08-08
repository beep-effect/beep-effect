/**
 * Radio-group primitive: an accessible single-select radio group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { CircleIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";

/**
 * Radio group component.
 *
 * **Example** (Import RadioGroup component)
 *
 * ```tsx
 * import { RadioGroup } from "@beep/ui/components/radio-group"
 *
 * console.log(RadioGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return <RadioGroupPrimitive data-slot="radio-group" className={cn("grid gap-2 w-full", className)} {...props} />;
}

/**
 * Radio group item component.
 *
 * **Example** (Import RadioGroupItem component)
 *
 * ```tsx
 * import { RadioGroupItem } from "@beep/ui/components/radio-group"
 *
 * console.log(RadioGroupItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function RadioGroupItem({ className, ...props }: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "border-input text-primary dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex size-4 rounded-full focus-visible:ring-[3px] aria-invalid:ring-[3px] group/radio-group-item peer relative aspect-square shrink-0 border outline-none after:absolute after:-inset-x-3 after:-inset-y-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="group-aria-invalid/radio-group-item:text-destructive text-primary flex size-4 items-center justify-center"
      >
        <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { RadioGroup, RadioGroupItem };
