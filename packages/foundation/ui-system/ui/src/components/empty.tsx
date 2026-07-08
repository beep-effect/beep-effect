/**
 * Empty-state primitive: an icon, title, and description layout for zero-data views.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type React from "react";

/**
 * Empty component.
 *
 * @example
 * ```tsx
 * import { Empty } from "@beep/ui/components/empty"
 *
 * console.log(Empty)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Empty({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-6 text-balance rounded-lg border-dashed p-6 text-center md:p-12",
        className
      )}
      {...props}
    />
  );
}

/**
 * Empty header component.
 *
 * @example
 * ```tsx
 * import { EmptyHeader } from "@beep/ui/components/empty"
 *
 * console.log(EmptyHeader)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-sm flex-col items-center gap-2 text-center", className)}
      {...props}
    />
  );
}

const emptyMediaVariants = cva(
  "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-6",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

/**
 * Empty media component.
 *
 * @example
 * ```tsx
 * import { EmptyMedia } from "@beep/ui/components/empty"
 *
 * console.log(EmptyMedia)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function EmptyMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
  return (
    <div
      data-slot="empty-icon"
      data-variant={variant}
      className={cn(emptyMediaVariants({ variant, className }))}
      {...props}
    />
  );
}

/**
 * Empty title component.
 *
 * @example
 * ```tsx
 * import { EmptyTitle } from "@beep/ui/components/empty"
 *
 * console.log(EmptyTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function EmptyTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="empty-title" className={cn("font-medium text-lg tracking-tight", className)} {...props} />;
}

/**
 * Empty description component.
 *
 * @example
 * ```tsx
 * import { EmptyDescription } from "@beep/ui/components/empty"
 *
 * console.log(EmptyDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <div
      data-slot="empty-description"
      className={cn(
        "text-muted-foreground text-sm/relaxed [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Empty content component.
 *
 * @example
 * ```tsx
 * import { EmptyContent } from "@beep/ui/components/empty"
 *
 * console.log(EmptyContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function EmptyContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("flex w-full min-w-0 max-w-sm flex-col items-center gap-4 text-balance text-sm", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
