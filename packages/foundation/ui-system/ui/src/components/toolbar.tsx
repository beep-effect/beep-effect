/**
 * Toolbar primitive: a toolbar root with toggle groups, links, and separators built on Base UI.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Toolbar as ToolbarPrimitive } from "@base-ui/react/toolbar";
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuSeparator } from "@beep/ui/components/dropdown-menu";
import { Separator } from "@beep/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@beep/ui/components/tooltip";
import { useAtomValue } from "@effect/atom-react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import * as P from "effect/Predicate";
import { clientMountedAtom } from "../internal/react-atoms.ts";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps, ElementType, ReactNode } from "react";

/**
 * Toolbar component.
 *
 * @example
 * ```tsx
 * import { Toolbar } from "@beep/ui/components/toolbar"
 *
 * console.log(Toolbar)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Toolbar({ className, ...props }: ToolbarPrimitive.Root.Props) {
  return <ToolbarPrimitive.Root className={cn("relative flex select-none items-center", className)} {...props} />;
}

/**
 * Toolbar toggle group component.
 *
 * @example
 * ```tsx
 * import { ToolbarToggleGroup } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarToggleGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarToggleGroup({
  className,
  type,
  value,
  defaultValue,
  onValueChange,
  disabled,
  ...props
}: {
  readonly className?: undefined | string;
  readonly type?: undefined | "single" | "multiple";
  readonly value?: undefined | string | readonly string[];
  readonly defaultValue?: undefined | string | readonly string[];
  readonly onValueChange?: undefined | ((value: string[]) => void);
  readonly disabled?: undefined | boolean;
  readonly children?: undefined | ReactNode;
}) {
  const multiple = type === "multiple";
  const normalizedValue = P.isString(value) ? [value] : value;
  const normalizedDefaultValue = P.isString(defaultValue) ? [defaultValue] : defaultValue;
  return (
    <ToggleGroup
      className={cn("flex items-center", className)}
      multiple={multiple}
      {...(normalizedValue !== undefined ? { value: normalizedValue } : {})}
      {...(normalizedDefaultValue !== undefined ? { defaultValue: normalizedDefaultValue } : {})}
      {...(onValueChange !== undefined ? { onValueChange } : {})}
      disabled={Boolean(disabled)}
      {...props}
    />
  );
}

/**
 * Toolbar link component.
 *
 * @example
 * ```tsx
 * import { ToolbarLink } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarLink)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarLink({ className, ...props }: ToolbarPrimitive.Link.Props) {
  return <ToolbarPrimitive.Link className={cn("font-medium underline underline-offset-4", className)} {...props} />;
}

/**
 * Toolbar separator component.
 *
 * @example
 * ```tsx
 * import { ToolbarSeparator } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarSeparator({ className, ...props }: ToolbarPrimitive.Separator.Props) {
  return <ToolbarPrimitive.Separator className={cn("mx-2 my-1 w-px shrink-0 bg-border", className)} {...props} />;
}

// From toggleVariants
const toolbarButtonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium text-sm outline-none transition-[color,box-shadow] hover:bg-muted hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[pressed]:bg-accent data-[pressed]:text-accent-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 min-w-9 px-2",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-1.5",
      },
      variant: {
        default: "bg-transparent",
        outline: "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      },
    },
  }
);

const dropdownArrowVariants = cva(
  cn(
    "inline-flex items-center justify-center rounded-r-md font-medium text-foreground text-sm transition-colors disabled:pointer-events-none disabled:opacity-50"
  ),
  {
    defaultVariants: {
      size: "sm",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 w-6",
        lg: "h-10 w-8",
        sm: "h-8 w-4",
      },
      variant: {
        default:
          "bg-transparent hover:bg-muted hover:text-muted-foreground data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
        outline: "border border-input border-l-0 bg-transparent hover:bg-accent hover:text-accent-foreground",
      },
    },
  }
);

type ToolbarButtonBaseProps = {
  readonly isDropdown?: undefined | boolean;
} & VariantProps<typeof toolbarButtonVariants>;

type ToolbarToggleButtonProps = ToolbarButtonBaseProps &
  Omit<Toggle.Props, "pressed" | "value" | "render"> & {
    readonly pressed: boolean;
  };

type ToolbarActionButtonProps = ToolbarButtonBaseProps &
  Omit<ToolbarPrimitive.Button.Props, "render"> & {
    readonly pressed?: undefined;
  };

type ToolbarButtonProps = ToolbarToggleButtonProps | ToolbarActionButtonProps;

/**
 * Toolbar button component.
 *
 * @example
 * ```tsx
 * import { ToolbarButton } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ToolbarButton = withTooltip(function ToolbarButton(props: ToolbarButtonProps) {
  if (props.pressed !== undefined) {
    const { children, className, isDropdown, pressed, size = "sm", variant, ...toggleProps } = props;
    return (
      <ToolbarToggleGroup disabled={Boolean(toggleProps.disabled)} value={pressed ? "single" : ""} type="single">
        <ToolbarToggleItem
          className={cn(
            toolbarButtonVariants({
              size,
              variant,
            }),
            isDropdown && "justify-between gap-1 pr-1",
            className
          )}
          value="single"
          {...toggleProps}
        >
          {isDropdown === true ? (
            <>
              <div className="flex flex-1 items-center gap-2 whitespace-nowrap">{children}</div>
              <div>
                <CaretDownIcon className="size-3.5 text-muted-foreground" data-icon />
              </div>
            </>
          ) : (
            children
          )}
        </ToolbarToggleItem>
      </ToolbarToggleGroup>
    );
  }

  const { children, className, isDropdown, pressed: _pressed, size = "sm", variant, ...buttonProps } = props;

  return (
    <ToolbarPrimitive.Button
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        isDropdown && "pr-1",
        className
      )}
      {...buttonProps}
    >
      {children}
    </ToolbarPrimitive.Button>
  );
});

/**
 * Toolbar split button component.
 *
 * @example
 * ```tsx
 * import { ToolbarSplitButton } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarSplitButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarSplitButton({ className, ...props }: ComponentProps<typeof ToolbarButton>) {
  return <ToolbarButton className={cn("group flex gap-0 px-0 hover:bg-transparent", className)} {...props} />;
}

type ToolbarSplitButtonPrimaryProps = ComponentProps<"span"> & VariantProps<typeof toolbarButtonVariants>;

/**
 * Toolbar split button primary component.
 *
 * @example
 * ```tsx
 * import { ToolbarSplitButtonPrimary } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarSplitButtonPrimary)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarSplitButtonPrimary({
  children,
  className,
  size = "sm",
  variant,
  ...props
}: ToolbarSplitButtonPrimaryProps) {
  return (
    <span
      className={cn(
        toolbarButtonVariants({
          size,
          variant,
        }),
        "rounded-r-none",
        "group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Toolbar split button secondary component.
 *
 * @example
 * ```tsx
 * import { ToolbarSplitButtonSecondary } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarSplitButtonSecondary)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarSplitButtonSecondary({
  className,
  size,
  variant,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof dropdownArrowVariants>) {
  return (
    <span
      className={cn(
        dropdownArrowVariants({
          size,
          variant,
        }),
        "group-data-[pressed=true]:bg-accent group-data-[pressed=true]:text-accent-foreground",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      role="button"
      {...props}
    >
      <CaretDownIcon className="size-3.5 text-muted-foreground" data-icon />
    </span>
  );
}

/**
 * Toolbar toggle item component.
 *
 * @example
 * ```tsx
 * import { ToolbarToggleItem } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarToggleItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarToggleItem({
  className,
  size = "sm",
  variant,
  ...props
}: Toggle.Props & VariantProps<typeof toolbarButtonVariants>) {
  return <Toggle className={cn(toolbarButtonVariants({ size, variant }), className)} {...props} />;
}

/**
 * Toolbar group component.
 *
 * @example
 * ```tsx
 * import { ToolbarGroup } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarGroup({ children, className }: ComponentProps<"div">) {
  return (
    <div className={cn("group/toolbar-group", "relative hidden has-[button]:flex", className)}>
      <div className="flex items-center">{children}</div>

      <div className="group-last/toolbar-group:hidden! mx-1.5 py-0.5">
        <Separator orientation="vertical" />
      </div>
    </div>
  );
}

type TooltipProps<T extends ElementType> = {
  tooltip?: undefined | ReactNode;
  tooltipContentProps?: undefined | Omit<ComponentProps<typeof TooltipContent>, "children">;
  tooltipProps?: undefined | Omit<ComponentProps<typeof Tooltip>, "children">;
  tooltipTriggerProps?: undefined | ComponentProps<typeof TooltipTrigger>;
} & ComponentProps<T>;

function withTooltip<T extends ElementType>(Component: T) {
  return function ExtendComponent({
    tooltip,
    tooltipContentProps,
    tooltipProps,
    tooltipTriggerProps,
    ...props
  }: TooltipProps<T>) {
    const mounted = useAtomValue(clientMountedAtom);
    const hasTooltip = tooltip !== undefined && tooltip !== null && tooltip !== false;

    const component = <Component {...(props as ComponentProps<T>)} />;

    if (hasTooltip && mounted) {
      return (
        <Tooltip {...tooltipProps}>
          <TooltipTrigger {...tooltipTriggerProps}>{component}</TooltipTrigger>

          <TooltipContent {...tooltipContentProps}>{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return component;
  };
}

/**
 * Toolbar menu group component.
 *
 * @example
 * ```tsx
 * import { ToolbarMenuGroup } from "@beep/ui/components/toolbar"
 *
 * console.log(ToolbarMenuGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ToolbarMenuGroup({
  children,
  className,
  label,
  ...props
}: ComponentProps<typeof DropdownMenuRadioGroup> & { readonly label?: undefined | string }) {
  return (
    <>
      <DropdownMenuSeparator
        className={cn(
          "hidden",
          "mb-0 shrink-0 peer-has-[[role=menuitem]]/menu-group:block peer-has-[[role=menuitemradio]]/menu-group:block peer-has-[[role=option]]/menu-group:block"
        )}
      />

      <DropdownMenuRadioGroup
        {...props}
        className={cn(
          "hidden",
          "peer/menu-group group/menu-group my-1.5 has-[[role=menuitem]]:block has-[[role=menuitemradio]]:block has-[[role=option]]:block",
          className
        )}
      >
        {label && (
          <DropdownMenuLabel className="select-none font-semibold text-muted-foreground text-xs">
            {label}
          </DropdownMenuLabel>
        )}
        {children}
      </DropdownMenuRadioGroup>
    </>
  );
}
