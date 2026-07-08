/**
 * MUI `Alert` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * Alert theme theme value.
 *
 * @example
 * ```ts
 * import { alertTheme } from "@beep/ui/themes/components/alert"
 *
 * console.log(alertTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const alertTheme: ThemeComponents = {
  MuiAlert: {
    styleOverrides: {
      root: {
        "--Icon-color": "currentColor",
      },
    },
  },
};
