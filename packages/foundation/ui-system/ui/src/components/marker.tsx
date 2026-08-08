/**
 * Marker primitive: class-variance generator for map/graph marker variants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@beep/ui/lib/utils";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Marker variant class generator.
 *
 * **Example** (Importing markerVariants)
 *
 * ```tsx
 * import { markerVariants } from "@beep/ui/components/marker"
 *
 * console.log(markerVariants)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const markerVariants = cva(
  "group/marker relative flex min-h-4 w-full items-center gap-2 text-left text-sm text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3 [a]:hover:text-foreground",
  {
    variants: {
      variant: {
        default: "",
        separator:
          "before:mr-1 before:h-px before:min-w-0 before:flex-1 before:bg-border after:ml-1 after:h-px after:min-w-0 after:flex-1 after:bg-border",
        border: "border-b border-border pb-2",
      },
    },
  }
);

/**
 * Marker component.
 *
 * **Example** (Importing Marker)
 *
 * ```tsx
 * import { Marker } from "@beep/ui/components/marker"
 *
 * console.log(Marker)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Marker({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant, className })),
      },
      props
    ),
    render,
    state: {
      slot: "marker",
      variant,
    },
  });
}

/**
 * Marker icon component.
 *
 * **Example** (Importing MarkerIcon)
 *
 * ```tsx
 * import { MarkerIcon } from "@beep/ui/components/marker"
 *
 * console.log(MarkerIcon)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-icon"
      aria-hidden="true"
      className={cn("size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    />
  );
}

/**
 * Marker content component.
 *
 * **Example** (Importing MarkerContent)
 *
 * ```tsx
 * import { MarkerContent } from "@beep/ui/components/marker"
 *
 * console.log(MarkerContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="marker-content"
      className={cn(
        "min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
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
export { Marker, MarkerContent, MarkerIcon, markerVariants };
