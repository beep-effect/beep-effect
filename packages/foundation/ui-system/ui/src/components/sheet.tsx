/**
 * Sheet primitive: an edge-anchored modal panel built on Base UI's dialog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { Button } from "@beep/ui/components/button";
import { XIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Sheet component.
 *
 * **Example** (Importing Sheet component)
 *
 * ```tsx
 * import { Sheet } from "@beep/ui/components/sheet"
 *
 * console.log(Sheet)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

/**
 * Sheet trigger component.
 *
 * **Example** (Importing SheetTrigger component)
 *
 * ```tsx
 * import { SheetTrigger } from "@beep/ui/components/sheet"
 *
 * console.log(SheetTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/**
 * Sheet close component.
 *
 * **Example** (Importing SheetClose component)
 *
 * ```tsx
 * import { SheetClose } from "@beep/ui/components/sheet"
 *
 * console.log(SheetClose)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 duration-100 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * Sheet content component.
 *
 * **Example** (Importing SheetContent component)
 *
 * ```tsx
 * import { SheetContent } from "@beep/ui/components/sheet"
 *
 * console.log(SheetContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  readonly side?: undefined | "top" | "right" | "bottom" | "left";
  readonly showCloseButton?: undefined | boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "bg-background data-open:animate-in data-closed:animate-out data-[side=right]:data-closed:slide-out-to-right-10 data-[side=right]:data-open:slide-in-from-right-10 data-[side=left]:data-closed:slide-out-to-left-10 data-[side=left]:data-open:slide-in-from-left-10 data-[side=top]:data-closed:slide-out-to-top-10 data-[side=top]:data-open:slide-in-from-top-10 data-closed:fade-out-0 data-open:fade-in-0 data-[side=bottom]:data-closed:slide-out-to-bottom-10 data-[side=bottom]:data-open:slide-in-from-bottom-10 fixed z-50 flex flex-col gap-4 bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

/**
 * Sheet header component.
 *
 * **Example** (Importing SheetHeader component)
 *
 * ```tsx
 * import { SheetHeader } from "@beep/ui/components/sheet"
 *
 * console.log(SheetHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("gap-0.5 p-4 flex flex-col", className)} {...props} />;
}

/**
 * Sheet footer component.
 *
 * **Example** (Importing SheetFooter component)
 *
 * ```tsx
 * import { SheetFooter } from "@beep/ui/components/sheet"
 *
 * console.log(SheetFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("gap-2 p-4 mt-auto flex flex-col", className)} {...props} />;
}

/**
 * Sheet title component.
 *
 * **Example** (Importing SheetTitle component)
 *
 * ```tsx
 * import { SheetTitle } from "@beep/ui/components/sheet"
 *
 * console.log(SheetTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground text-base font-medium", className)}
      {...props}
    />
  );
}

/**
 * Sheet description component.
 *
 * **Example** (Importing SheetDescription component)
 *
 * ```tsx
 * import { SheetDescription } from "@beep/ui/components/sheet"
 *
 * console.log(SheetDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger };
