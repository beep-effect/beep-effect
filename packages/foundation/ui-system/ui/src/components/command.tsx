/**
 * Command primitive: a filterable command-palette list built on cmdk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@beep/ui/components/dialog";
import { InputGroup, InputGroupAddon } from "@beep/ui/components/input-group";
import { CheckIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { Command as CommandPrimitive } from "cmdk";
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Command component.
 *
 * @example
 * ```tsx
 * import { Command } from "@beep/ui/components/command"
 *
 * console.log(Command)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "bg-popover text-popover-foreground rounded-xl! p-1 flex size-full flex-col overflow-hidden",
        className
      )}
      {...props}
    />
  );
}

/**
 * Command dialog component.
 *
 * @example
 * ```tsx
 * import { CommandDialog } from "@beep/ui/components/command"
 *
 * console.log(CommandDialog)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  className,
  showCloseButton = false,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  readonly title?: undefined | string;
  readonly description?: undefined | string;
  readonly className?: undefined | string;
  readonly showCloseButton?: undefined | boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className={cn("rounded-xl! overflow-hidden p-0", className)} showCloseButton={showCloseButton}>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Command input component.
 *
 * @example
 * ```tsx
 * import { CommandInput } from "@beep/ui/components/command"
 *
 * console.log(CommandInput)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div data-slot="command-input-wrapper" className="p-1 pb-0">
      <InputGroup className="bg-input/30 border-input/30 h-8! rounded-lg! shadow-none! *:data-[slot=input-group-addon]:pl-2!">
        <CommandPrimitive.Input
          data-slot="command-input"
          className={cn("w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50", className)}
          {...props}
        />
        <InputGroupAddon>
          <MagnifyingGlassIcon className="size-4 shrink-0 opacity-50" />
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}

/**
 * Command list component.
 *
 * @example
 * ```tsx
 * import { CommandList } from "@beep/ui/components/command"
 *
 * console.log(CommandList)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn("no-scrollbar max-h-72 scroll-py-1 outline-none overflow-x-hidden overflow-y-auto", className)}
      {...props}
    />
  );
}

/**
 * Command empty component.
 *
 * @example
 * ```tsx
 * import { CommandEmpty } from "@beep/ui/components/command"
 *
 * console.log(CommandEmpty)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm", className)}
      {...props}
    />
  );
}

/**
 * Command group component.
 *
 * @example
 * ```tsx
 * import { CommandGroup } from "@beep/ui/components/command"
 *
 * console.log(CommandGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
        className
      )}
      {...props}
    />
  );
}

/**
 * Command separator component.
 *
 * @example
 * ```tsx
 * import { CommandSeparator } from "@beep/ui/components/command"
 *
 * console.log(CommandSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("bg-border -mx-1 h-px", className)}
      {...props}
    />
  );
}

/**
 * Command item component.
 *
 * @example
 * ```tsx
 * import { CommandItem } from "@beep/ui/components/command"
 *
 * console.log(CommandItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandItem({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "data-selected:bg-muted data-selected:text-foreground data-selected:*:[svg]:text-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none [&_svg:not([class*='size-'])]:size-4 [[data-slot=dialog-content]_&]:rounded-lg! group/command-item data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    >
      {children}
      <CheckIcon className="ml-auto opacity-0 group-has-[[data-slot=command-shortcut]]/command-item:hidden group-data-[checked=true]/command-item:opacity-100" />
    </CommandPrimitive.Item>
  );
}

/**
 * Command shortcut component.
 *
 * @example
 * ```tsx
 * import { CommandShortcut } from "@beep/ui/components/command"
 *
 * console.log(CommandShortcut)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn(
        "text-muted-foreground group-data-selected/command-item:text-foreground ml-auto text-xs tracking-widest",
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
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
