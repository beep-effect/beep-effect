/**
 * Textarea primitive: a styled multi-line text input.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Textarea component.
 *
 * **Example** (Import Textarea component)
 *
 * ```tsx
 * import { Textarea } from "@beep/ui/components/textarea"
 *
 * console.log(Textarea)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
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
export { Textarea };
