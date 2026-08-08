/**
 * Separator primitive: a horizontal or vertical divider line.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "../lib/index.ts";

/**
 * Separator component.
 *
 * **Example** (Import and log Separator)
 *
 * ```tsx
 * import { Separator } from "@beep/ui/components/separator"
 *
 * console.log(Separator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Separator({ className, orientation = "horizontal", ...props }: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-stretch",
        className
      )}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Separator };
