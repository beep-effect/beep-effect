"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { CaretRightIcon, CheckIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import { Kbd } from "./kbd";
import type * as React from "react";

/**
 * Dropdown menu component.
 *
 * @example
 * ```tsx
 * import { DropdownMenu } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenu)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />;
}

/**
 * Dropdown menu portal component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuPortal } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuPortal)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />;
}

/**
 * Dropdown menu trigger component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuTrigger } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuTrigger({ ...props }: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger data-slot="dropdown-menu-trigger" {...props} />;
}

/**
 * Dropdown menu content component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuContent } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuContent({
  align = "start",
  alignOffset = 0,
  side = "bottom",
  sideOffset = 4,
  className,
  ...props
}: MenuPrimitive.Popup.Props & Pick<MenuPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <MenuPrimitive.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-32 rounded-lg p-1 shadow-md ring-1 duration-100 z-50 max-h-(--available-height) w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto outline-none data-closed:overflow-hidden",
            className
          )}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

/**
 * Dropdown menu group component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuGroup } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />;
}

/**
 * Dropdown menu label component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuLabel } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuLabel)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: MenuPrimitive.GroupLabel.Props & {
  readonly inset?: undefined | boolean;
}) {
  return (
    <MenuPrimitive.GroupLabel
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("text-muted-foreground px-1.5 py-1 text-xs font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  );
}

/**
 * Dropdown menu item component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuItem } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: MenuPrimitive.Item.Props & {
  readonly inset?: undefined | boolean;
  readonly variant?: undefined | "default" | "destructive";
}) {
  return (
    <MenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:text-destructive not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 group/dropdown-menu-item relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  );
}

/**
 * Dropdown menu sub component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuSub } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuSub)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />;
}

/**
 * Dropdown menu sub trigger component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuSubTrigger } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuSubTrigger)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  readonly inset?: undefined | boolean;
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground gap-1.5 rounded-md px-1.5 py-1 text-sm [&_svg:not([class*='size-'])]:size-4 flex cursor-default items-center outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <CaretRightIcon className="ml-auto" />
    </MenuPrimitive.SubmenuTrigger>
  );
}

/**
 * Dropdown menu sub content component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuSubContent } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuSubContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuSubContent({
  align = "start",
  alignOffset = -3,
  side = "right",
  sideOffset = 0,
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 bg-popover text-popover-foreground min-w-[96px] rounded-md p-1 shadow-lg ring-1 duration-100 w-auto",
        className
      )}
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

/**
 * Dropdown menu checkbox item component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuCheckboxItem } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuCheckboxItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuCheckboxItem({ className, children, ...props }: MenuPrimitive.CheckboxItem.Props) {
  return (
    <MenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center pointer-events-none"
        data-slot="dropdown-menu-checkbox-item-indicator"
      >
        <MenuPrimitive.CheckboxItemIndicator>
          <CheckIcon />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

/**
 * Dropdown menu radio group component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuRadioGroup } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuRadioGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup data-slot="dropdown-menu-radio-group" {...props} />;
}

/**
 * Dropdown menu radio item component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuRadioItem } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuRadioItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuRadioItem({ className, children, ...props }: MenuPrimitive.RadioItem.Props) {
  return (
    <MenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      <span
        className="pointer-events-none absolute right-2 flex items-center justify-center pointer-events-none"
        data-slot="dropdown-menu-radio-item-indicator"
      >
        <MenuPrimitive.RadioItemIndicator>
          <CheckIcon />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  );
}

/**
 * Dropdown menu separator component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuSeparator } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuSeparator({ className, ...props }: MenuPrimitive.Separator.Props) {
  return (
    <MenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...props}
    />
  );
}

/**
 * Dropdown menu shortcut component.
 *
 * @example
 * ```tsx
 * import { DropdownMenuShortcut } from "@beep/ui/components/dropdown-menu"
 *
 * console.log(DropdownMenuShortcut)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <Kbd
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "group-focus/dropdown-menu-item:bg-accent-foreground/20 group-focus/dropdown-menu-item:text-accent-foreground ml-auto tracking-widest",
        className
      )}
      {...props}
    />
  );
}

/**
 * Dropdown menu component, composed with its part components via
 * `DropdownMenu.Trigger`, `DropdownMenu.Content`, `DropdownMenu.Item`,
 * `DropdownMenu.CheckboxItem`, `DropdownMenu.RadioGroup`,
 * `DropdownMenu.RadioItem`, `DropdownMenu.Label`, `DropdownMenu.Separator`,
 * `DropdownMenu.Shortcut`, `DropdownMenu.Group`, `DropdownMenu.Sub`,
 * `DropdownMenu.SubTrigger`, `DropdownMenu.SubContent`, and
 * `DropdownMenu.MenuPortal`.
 *
 * @example
 * ```tsx
 * import { DropdownMenu } from "@beep/ui/components/dropdown-menu"
 *
 * export function AccountMenu() {
 *   return (
 *     <DropdownMenu>
 *       <DropdownMenu.Trigger>Account</DropdownMenu.Trigger>
 *       <DropdownMenu.Content>
 *         <DropdownMenu.Label>My account</DropdownMenu.Label>
 *         <DropdownMenu.Item>Profile</DropdownMenu.Item>
 *         <DropdownMenu.Separator />
 *         <DropdownMenu.Item>Sign out</DropdownMenu.Item>
 *       </DropdownMenu.Content>
 *     </DropdownMenu>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const DropdownMenuWithParts = Object.assign(DropdownMenu, {
  CheckboxItem: DropdownMenuCheckboxItem,
  Content: DropdownMenuContent,
  Group: DropdownMenuGroup,
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  MenuPortal: DropdownMenuPortal,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubContent: DropdownMenuSubContent,
  SubTrigger: DropdownMenuSubTrigger,
  Trigger: DropdownMenuTrigger,
});

export {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuWithParts as DropdownMenu,
};
