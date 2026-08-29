/**
 * Label primitive: an accessible form label built on Base UI's field label.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { cn } from "../lib/index.ts";
import type * as React from "react";

/**
 * Label component.
 *
 * **Example** (Import Label component)
 *
 * ```tsx
 * import { Label } from "@beep/ui/components/label"
 *
 * console.log(Label)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: generic component
    <label
      data-slot="label"
      className={cn(
        "gap-2 text-sm leading-none font-medium group-data-[disabled=true]:opacity-50 peer-disabled:opacity-50 flex items-center select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
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
export { Label };
