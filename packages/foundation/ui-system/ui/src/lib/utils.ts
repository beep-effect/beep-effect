/**
 * Utility functions for the UI component library.
 *
 * **Example** (Import cn utility)
 *
 * ```ts
 * import { cn } from "@beep/ui/lib/utils"
 *
 * console.log(cn)
 * ```
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

// The theme scales the design system adds on top of Tailwind's defaults
// (`packages/foundation/ui-system/ui/src/styles/globals.css` and the app themes that import
// it). tailwind-merge only knows the stock scale names: an unknown `text-<name>` reads as a
// text color, so `cn("text-xs-plus", "text-muted-foreground")` would drop the font size, and
// unknown radius, shadow and leading names never conflict with their stock siblings. Every
// `--text-*`, `--radius-*`, `--shadow-*`, `--leading-*`, `--tracking-*`, `--font-*`, `--ease-*`
// and `--animate-*` token declared in a theme stylesheet must be listed here.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["3xs", "2xs", "xs-plus", "sm-plus", "oip-hero"],
      radius: ["checkbox", "control", "control-sm", "ellipse", "nested", "nested-sm"],
      shadow: ["sidebar-outline", "sidebar-outline-hover"],
      leading: ["code", "oip-hero"],
      tracking: ["oip-wide", "oip-wider", "oip-widest"],
      font: ["body", "display", "geist-mono", "oip-body", "oip-display", "oip-mono"],
      ease: ["in-expo", "out-quint", "out-strong"],
      animate: ["progress-indeterminate"],
    },
    classGroups: {
      w: [{ w: ["full-minus-2px", "sidebar-icon-floating", "sync-panel"] }],
      h: [{ h: ["full-minus-2px", "full-minus-px", "story-canvas", "switch"] }],
      "max-w": [{ "max-w": ["full-gutter", "measure"] }],
      "max-h": [{ "max-h": ["combobox-list", "drawer", "viewport-inset"] }],
      "min-h": [{ "min-h": ["sidebar-inset"] }],
      "min-w": [{ "min-w": ["combobox-popup"] }],
      "grid-cols": [
        {
          "grid-cols": [
            "auto-fr",
            "emoji",
            "fr-auto",
            "key-value",
            "oip-contact",
            "oip-hero",
            "triage",
            "workbench-lg",
            "workbench-xl",
          ],
        },
      ],
      "grid-rows": [{ "grid-rows": ["auto-auto", "auto-auto-fr", "auto-fr"] }],
      "list-style-type": [{ list: ["lower-alpha", "lower-roman", "upper-alpha", "upper-roman"] }],
      transition: [
        {
          transition: [
            "color-shadow",
            "inset",
            "inset-x-width",
            "margin-opacity",
            "opacity-transform-width",
            "size-padding",
            "translate-scale-opacity",
            "width",
          ],
        },
      ],
      "translate-x": [{ "translate-x": ["switch-thumb"] }],
      "translate-y": [{ "translate-y": ["tooltip-arrow"] }],
    },
  },
});

/**
 * Merge class names with the design system's theme scales registered in tailwind-merge.
 *
 * **Details**
 *
 * Later classes win within one Tailwind group, including the custom font sizes, radii,
 * shadows, line heights and sizes the theme declares, so a consumer's `text-sm` replaces a
 * component's `text-xs-plus` and a component's `text-xs-plus` survives a color class.
 *
 * **Example** (Custom font size survives a color class)
 *
 * ```ts
 * import { cn } from "@beep/ui/lib/utils"
 *
 * console.log(cn("text-xs-plus", "text-muted-foreground")) // "text-xs-plus text-muted-foreground"
 * console.log(cn("text-xs-plus", "text-sm")) // "text-sm"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
