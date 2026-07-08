/**
 * Kbd primitive: renders a keyboard-shortcut key or key group.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "../lib/index.ts";
import type React from "react";

/**
 * Kbd component.
 *
 * @example
 * ```tsx
 * import { Kbd } from "@beep/ui/components/kbd"
 *
 * console.log(Kbd)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-muted text-muted-foreground [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10 h-5 w-fit min-w-5 gap-1 rounded-sm px-1 font-sans text-xs font-medium [&_svg:not([class*='size-'])]:size-3 pointer-events-none inline-flex items-center justify-center select-none",
        className
      )}
      {...props}
    />
  );
}

/**
 * Kbd group component.
 *
 * @example
 * ```tsx
 * import { KbdGroup } from "@beep/ui/components/kbd"
 *
 * console.log(KbdGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function KbdGroup({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="kbd-group" className={cn("gap-1 inline-flex items-center", className)} {...props} />;
}

/**
 * @category components
 * @since 0.0.0
 */
export { Kbd, KbdGroup };
