/**
 * Input primitive: a styled text input with invalid-state and file-input handling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Class factory for the input's base styling and typeface.
 *
 * **Details**
 *
 * `font: "mono"` sets the compact monospace treatment for paths, identifiers, and other
 * machine text.
 *
 * **Example** (Monospace input classes)
 *
 * ```tsx
 * import { strictEqual } from "node:assert"
 * import { inputVariants } from "@beep/ui/components/input"
 *
 * strictEqual(inputVariants({ font: "mono" }).includes("font-mono"), true)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const inputVariants = cva(
  "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-lg border bg-transparent px-2.5 py-1 text-base transition-colors file:h-6 file:text-sm file:font-medium focus-visible:ring-3 aria-invalid:ring-3 md:text-sm file:text-foreground placeholder:text-muted-foreground w-full min-w-0 outline-none file:inline-flex file:border-0 file:bg-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      font: {
        sans: "",
        mono: "font-mono text-xs",
      },
    },
    defaultVariants: {
      font: "sans",
    },
  }
);

/**
 * Input component.
 *
 * **Example** (Monospace path input)
 *
 * ```tsx
 * import { Input } from "@beep/ui/components/input"
 *
 * export function PathInput() {
 *   return <Input aria-label="Ontology file path" font="mono" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Input({
  className,
  type,
  style,
  font = "sans",
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(inputVariants({ font, className }))}
      {...(style !== undefined ? { style } : {})}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Input, inputVariants };
