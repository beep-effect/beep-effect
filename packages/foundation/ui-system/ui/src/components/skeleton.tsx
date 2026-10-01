/**
 * Skeleton primitive: a pulsing placeholder block for loading states.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type React from "react";

const skeletonVariants = cva("bg-muted animate-pulse", {
  variants: {
    shape: {
      default: "rounded-md",
      circle: "rounded-full",
    },
  },
  defaultVariants: {
    shape: "default",
  },
});

/**
 * Skeleton component.
 *
 * **Details**
 *
 * `shape: "circle"` stands in for an avatar or other round media; size it with layout
 * classes (`size-12`).
 *
 * **Example** (Avatar row placeholder)
 *
 * ```tsx
 * import { Skeleton } from "@beep/ui/components/skeleton"
 *
 * export function AvatarRowSkeleton() {
 *   return (
 *     <div className="flex items-center gap-4">
 *       <Skeleton shape="circle" className="size-12" />
 *       <Skeleton className="h-4 w-40" />
 *     </div>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Skeleton({ className, shape, ...props }: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return <div data-slot="skeleton" className={cn(skeletonVariants({ shape, className }))} {...props} />;
}

/**
 * @category components
 * @since 0.0.0
 */
export { Skeleton };
