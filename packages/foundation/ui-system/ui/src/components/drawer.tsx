/**
 * Drawer primitive: an edge-anchored sliding panel built on Vaul.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Drawer component.
 *
 * @example
 * ```tsx
 * import { Drawer } from "@beep/ui/components/drawer"
 *
 * console.log(Drawer)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

/**
 * Drawer trigger component.
 *
 * @example
 * ```tsx
 * import { DrawerTrigger } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

/**
 * Drawer portal component.
 *
 * @example
 * ```tsx
 * import { DrawerPortal } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerPortal)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerPortal({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

/**
 * Drawer close component.
 *
 * @example
 * ```tsx
 * import { DrawerClose } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerClose)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerClose({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

/**
 * Drawer overlay component.
 *
 * @example
 * ```tsx
 * import { DrawerOverlay } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerOverlay)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 bg-black/10 supports-backdrop-filter:backdrop-blur-xs fixed inset-0 z-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * Drawer content component.
 *
 * @example
 * ```tsx
 * import { DrawerContent } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof DrawerPrimitive.Content>) {
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "bg-background flex h-auto flex-col text-sm data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=bottom]:rounded-t-xl data-[vaul-drawer-direction=bottom]:border-t data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=left]:rounded-r-xl data-[vaul-drawer-direction=left]:border-r data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=right]:rounded-l-xl data-[vaul-drawer-direction=right]:border-l data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=top]:rounded-b-xl data-[vaul-drawer-direction=top]:border-b data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm group/drawer-content fixed z-50",
          className
        )}
        {...props}
      >
        <div className="bg-muted mx-auto mt-4 hidden h-1 w-[100px] shrink-0 rounded-full group-data-[vaul-drawer-direction=bottom]/drawer-content:block bg-muted mx-auto hidden shrink-0 group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

/**
 * Drawer header component.
 *
 * @example
 * ```tsx
 * import { DrawerHeader } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "gap-0.5 p-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-center group-data-[vaul-drawer-direction=top]/drawer-content:text-center md:gap-0.5 md:text-left flex flex-col",
        className
      )}
      {...props}
    />
  );
}

/**
 * Drawer footer component.
 *
 * @example
 * ```tsx
 * import { DrawerFooter } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerFooter)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="drawer-footer" className={cn("gap-2 p-4 mt-auto flex flex-col", className)} {...props} />;
}

/**
 * Drawer title component.
 *
 * @example
 * ```tsx
 * import { DrawerTitle } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-foreground text-base font-medium", className)}
      {...props}
    />
  );
}

/**
 * Drawer description component.
 *
 * @example
 * ```tsx
 * import { DrawerDescription } from "@beep/ui/components/drawer"
 *
 * console.log(DrawerDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DrawerDescription({ className, ...props }: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
