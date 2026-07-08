/**
 * Skeleton primitive: a pulsing placeholder block for loading states.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "../lib/index.ts";
import type React from "react";

/**
 * Skeleton component.
 *
 * @example
 * ```tsx
 * import { Skeleton } from "@beep/ui/components/skeleton"
 *
 * console.log(Skeleton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("bg-muted rounded-md animate-pulse", className)} {...props} />;
}

/**
 * @category components
 * @since 0.0.0
 */
export { Skeleton };
