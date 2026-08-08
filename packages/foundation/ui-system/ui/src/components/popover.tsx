/**
 * Popover primitive: an anchored floating panel built on Base UI's popover.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Popover component.
 *
 * **Example** (Import Popover component)
 *
 * ```tsx
 * import { Popover } from "@beep/ui/components/popover"
 *
 * console.log(Popover)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

/**
 * Popover trigger component.
 *
 * **Example** (Import PopoverTrigger component)
 *
 * ```tsx
 * import { PopoverTrigger } from "@beep/ui/components/popover"
 *
 * console.log(PopoverTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

/**
 * Popover content component.
 *
 * **Example** (Import PopoverContent component)
 *
 * ```tsx
 * import { PopoverContent } from "@beep/ui/components/popover"
 *
 * console.log(PopoverContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PopoverContent({
  className,
  align = "center",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  anchor,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "anchor" | "side" | "sideOffset">) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 flex flex-col gap-2.5 rounded-lg p-2.5 text-sm shadow-md ring-1 duration-100 z-50 w-72 origin-(--transform-origin) outline-hidden",
            className
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

/**
 * Popover header component.
 *
 * **Example** (Import PopoverHeader component)
 *
 * ```tsx
 * import { PopoverHeader } from "@beep/ui/components/popover"
 *
 * console.log(PopoverHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-0.5 text-sm", className)} {...props} />;
}

/**
 * Popover title component.
 *
 * **Example** (Import PopoverTitle component)
 *
 * ```tsx
 * import { PopoverTitle } from "@beep/ui/components/popover"
 *
 * console.log(PopoverTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
  return <PopoverPrimitive.Title data-slot="popover-title" className={cn("font-medium", className)} {...props} />;
}

/**
 * Popover description component.
 *
 * **Example** (Import PopoverDescription component)
 *
 * ```tsx
 * import { PopoverDescription } from "@beep/ui/components/popover"
 *
 * console.log(PopoverDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function PopoverDescription({ className, ...props }: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
