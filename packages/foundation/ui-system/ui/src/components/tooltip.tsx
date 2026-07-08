/**
 * Tooltip primitive: provider and content wrappers built on Base UI's tooltip.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "../lib/index.ts";

/**
 * Tooltip provider export.
 *
 * @example
 * ```tsx
 * import { TooltipProvider } from "@beep/ui/components/tooltip"
 *
 * console.log(TooltipProvider)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
function TooltipProvider({ ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" {...props} />;
}

/**
 * Tooltip component.
 *
 * @example
 * ```tsx
 * import { Tooltip } from "@beep/ui/components/tooltip"
 *
 * console.log(Tooltip)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

/**
 * Tooltip trigger component.
 *
 * @example
 * ```tsx
 * import { TooltipTrigger } from "@beep/ui/components/tooltip"
 *
 * console.log(TooltipTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TooltipTrigger({ className, ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" className={cn(className)} {...props} />;
}

/**
 * Tooltip content component.
 *
 * @example
 * ```tsx
 * import { TooltipContent } from "@beep/ui/components/tooltip"
 *
 * console.log(TooltipContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function TooltipContent({
  className,
  sideOffset = 4,
  side = "top",
  align = "center",
  children,
  ...props
}: TooltipPrimitive.Popup.Props & {
  readonly sideOffset?: undefined | number;
  readonly side?: undefined | "top" | "bottom" | "left" | "right";
  readonly align?: undefined | "start" | "center" | "end";
}) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} sideOffset={sideOffset} align={align}>
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "bg-primary text-primary-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 origin-(--transform-origin) overflow-hidden rounded-md px-3 py-1.5 text-xs",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
