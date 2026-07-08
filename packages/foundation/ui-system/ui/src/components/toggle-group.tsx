/**
 * Toggle-group primitive: a grouped set of pressed/unpressed toggle buttons.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { toggleVariants } from "@beep/ui/components/toggle";
import * as React from "react";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    readonly spacing?: undefined | number;
    readonly orientation?: undefined | "horizontal" | "vertical";
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
  orientation: "horizontal",
});

/**
 * Toggle group component.
 *
 * @example
 * ```tsx
 * import { ToggleGroup } from "@beep/ui/components/toggle-group"
 *
 * console.log(ToggleGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    readonly spacing?: undefined | number;
    readonly orientation?: undefined | "horizontal" | "vertical";
  }) {
  return (
    <ToggleGroupPrimitive
      orientation={orientation}
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, spacing, orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

/**
 * Toggle group item component.
 *
 * @example
 * ```tsx
 * import { ToggleGroupItem } from "@beep/ui/components/toggle-group"
 *
 * console.log(ToggleGroupItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        "group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg shrink-0 focus:z-10 focus-visible:z-10 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { ToggleGroup, ToggleGroupItem };
