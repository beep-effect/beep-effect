/**
 * Spinner primitive: an indeterminate loading indicator.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SpinnerGapIcon } from "@phosphor-icons/react";
import { cn } from "../lib/index.ts";
import type { IconProps } from "@phosphor-icons/react";

/**
 * Spinner component.
 *
 * **Example** (Import Spinner component)
 *
 * ```tsx
 * import { Spinner } from "@beep/ui/components/spinner"
 *
 * console.log(Spinner)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Spinner({ className, ...props }: IconProps) {
  return (
    <SpinnerGapIcon role="status" aria-label="Loading" className={cn("size-4 animate-spin", className)} {...props} />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Spinner };
