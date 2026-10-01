/**
 * Textarea primitive: a styled multi-line text input.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Class factory for textarea chrome and typeface.
 *
 * **Details**
 *
 * `variant: "ghost"` drops the border, radius, shadow, and focus ring so the textarea can
 * fill a pane edge to edge (a source viewer inside a bordered panel). `font: "mono"` sets
 * the compact monospace treatment for code and query text.
 *
 * **Example** (Monospace ghost textarea classes)
 *
 * ```tsx
 * import { strictEqual } from "node:assert"
 * import { textareaVariants } from "@beep/ui/components/textarea"
 *
 * const classes = textareaVariants({ variant: "ghost", font: "mono" })
 * strictEqual(classes.includes("font-mono"), true)
 * strictEqual(classes.includes("border-0"), true)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
const textareaVariants = cva(
  "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors focus-visible:ring-3 aria-invalid:ring-3 md:text-sm placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        ghost: "rounded-none border-0 shadow-none focus-visible:ring-0",
      },
      font: {
        sans: "",
        mono: "font-mono text-xs leading-5",
      },
    },
    defaultVariants: {
      variant: "default",
      font: "sans",
    },
  }
);

/**
 * Textarea component.
 *
 * **Example** (Monospace query editor)
 *
 * ```tsx
 * import { Textarea } from "@beep/ui/components/textarea"
 *
 * export function QueryEditor() {
 *   return <Textarea aria-label="SPARQL query" font="mono" className="h-40 resize-none" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Textarea({
  className,
  variant = "default",
  font = "sans",
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
  return <textarea data-slot="textarea" className={cn(textareaVariants({ variant, font, className }))} {...props} />;
}

/**
 * @category components
 * @since 0.0.0
 */
export { Textarea, textareaVariants };
