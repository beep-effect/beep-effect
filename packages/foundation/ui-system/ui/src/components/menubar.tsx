/**
 * Menubar primitive: an application menu bar built on Base UI's menu.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@beep/ui/components/dropdown-menu";
import { CheckIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Menubar component.
 *
 * @example
 * ```tsx
 * import { Menubar } from "@beep/ui/components/menubar"
 *
 * console.log(Menubar)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Menubar({ className, ...props }: MenubarPrimitive.Props) {
  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn("bg-background h-8 gap-0.5 rounded-lg border p-1 flex items-center", className)}
      {...props}
    />
  );
}

/**
 * Menubar menu component.
 *
 * @example
 * ```tsx
 * import { MenubarMenu } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarMenu)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarMenu({ ...props }: React.ComponentProps<typeof DropdownMenu>) {
  return <DropdownMenu data-slot="menubar-menu" {...props} />;
}

/**
 * Menubar group component.
 *
 * @example
 * ```tsx
 * import { MenubarGroup } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarGroup({ ...props }: React.ComponentProps<typeof DropdownMenuGroup>) {
  return <DropdownMenuGroup data-slot="menubar-group" {...props} />;
}

/**
 * Menubar portal component.
 *
 * @example
 * ```tsx
 * import { MenubarPortal } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarPortal)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarPortal({ ...props }: React.ComponentProps<typeof DropdownMenuPortal>) {
  return <DropdownMenuPortal data-slot="menubar-portal" {...props} />;
}

/**
 * Menubar trigger component.
 *
 * @example
 * ```tsx
 * import { MenubarTrigger } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarTrigger({ className, ...props }: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      data-slot="menubar-trigger"
      className={cn(
        "hover:bg-muted aria-expanded:bg-muted rounded-sm px-1.5 py-px text-sm font-medium flex items-center outline-hidden select-none",
        className
      )}
      {...props}
    />
  );
}

/**
 * Menubar content component.
 *
 * @example
 * ```tsx
 * import { MenubarContent } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarContent({
  className,
  align = "start",
  alignOffset = -4,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="menubar-content"
      align={align}
      alignOffset={alignOffset}
      sideOffset={sideOffset}
      className={cn(
        "bg-popover text-popover-foreground data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 min-w-36 rounded-lg p-1 shadow-md ring-1 duration-100",
        className
      )}
      {...props}
    />
  );
}

/**
 * Menubar item component.
 *
 * @example
 * ```tsx
 * import { MenubarItem } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuItem>) {
  return (
    <DropdownMenuItem
      data-slot="menubar-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4 group/menubar-item",
        className
      )}
      {...props}
    />
  );
}

/**
 * Menubar checkbox item component.
 *
 * @example
 * ```tsx
 * import { MenubarCheckboxItem } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarCheckboxItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarCheckboxItem({ className, children, checked, ...props }: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm data-disabled:opacity-50 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      checked={Boolean(checked)}
      {...props}
    >
      <span className="left-1.5 size-4 [&_svg:not([class*='size-'])]:size-4 pointer-events-none absolute flex items-center justify-center">
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

/**
 * Menubar radio group component.
 *
 * @example
 * ```tsx
 * import { MenubarRadioGroup } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarRadioGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarRadioGroup({ ...props }: React.ComponentProps<typeof DropdownMenuRadioGroup>) {
  return <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...props} />;
}

/**
 * Menubar radio item component.
 *
 * @example
 * ```tsx
 * import { MenubarRadioItem } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarRadioItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-1.5 pl-7 text-sm data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span className="left-1.5 size-4 [&_svg:not([class*='size-'])]:size-4 pointer-events-none absolute flex items-center justify-center">
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

/**
 * Menubar label component.
 *
 * @example
 * ```tsx
 * import { MenubarLabel } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarLabel)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarLabel({ className, inset, ...props }: React.ComponentProps<typeof DropdownMenuLabel>) {
  return (
    <DropdownMenuLabel
      data-slot="menubar-label"
      data-inset={inset}
      className={cn("px-1.5 py-1 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

/**
 * Menubar separator component.
 *
 * @example
 * ```tsx
 * import { MenubarSeparator } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarSeparator({ className, ...props }: React.ComponentProps<typeof DropdownMenuSeparator>) {
  return (
    <DropdownMenuSeparator
      data-slot="menubar-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

/**
 * Menubar shortcut component.
 *
 * @example
 * ```tsx
 * import { MenubarShortcut } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarShortcut)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarShortcut({ className, ...props }: React.ComponentProps<typeof DropdownMenuShortcut>) {
  return (
    <DropdownMenuShortcut
      data-slot="menubar-shortcut"
      className={cn(
        "text-muted-foreground group-focus/menubar-item:text-accent-foreground text-xs tracking-widest ml-auto",
        className
      )}
      {...props}
    />
  );
}

/**
 * Menubar sub component.
 *
 * @example
 * ```tsx
 * import { MenubarSub } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarSub)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarSub({ ...props }: React.ComponentProps<typeof DropdownMenuSub>) {
  return <DropdownMenuSub data-slot="menubar-sub" {...props} />;
}

/**
 * Menubar sub trigger component.
 *
 * @example
 * ```tsx
 * import { MenubarSubTrigger } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarSubTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarSubTrigger({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuSubTrigger> & {
  readonly inset?: undefined | boolean;
}) {
  return (
    <DropdownMenuSubTrigger
      data-slot="menubar-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm data-[inset]:pl-8 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Menubar sub content component.
 *
 * @example
 * ```tsx
 * import { MenubarSubContent } from "@beep/ui/components/menubar"
 *
 * console.log(MenubarSubContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MenubarSubContent({ className, ...props }: React.ComponentProps<typeof DropdownMenuSubContent>) {
  return (
    <DropdownMenuSubContent
      data-slot="menubar-sub-content"
      className={cn(
        "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 min-w-32 rounded-lg p-1 shadow-lg ring-1 duration-100",
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
export {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
};
