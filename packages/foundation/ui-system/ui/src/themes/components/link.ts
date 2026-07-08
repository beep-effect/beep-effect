/**
 * MUI `Link` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * Link theme theme value.
 *
 * @example
 * ```ts
 * import { linkTheme } from "@beep/ui/themes/components/link"
 *
 * console.log(linkTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const linkTheme: ThemeComponents = {
  MuiLink: {
    styleOverrides: {
      root: {
        verticalAlign: "var(--va)", // for button inside Typography to align properly with text
        "&:focus-visible": {
          outlineOffset: "4px",
          outlineColor: "var(--Link-underlineColor)",
        },
      },
    },
  },
};
