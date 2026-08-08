/**
 * MUI `Progress` (linear/circular) component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * Progress theme theme value.
 *
 * **Example** (Import and log progressTheme)
 *
 * ```ts
 * import { progressTheme } from "@beep/ui/themes/components/progress"
 *
 * console.log(progressTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const progressTheme: ThemeComponents = {
  MuiCircularProgress: {
    styleOverrides: {
      circle: {
        strokeLinecap: "round",
      },
    },
  },
};
