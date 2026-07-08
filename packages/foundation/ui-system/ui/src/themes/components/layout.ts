/**
 * MUI layout primitive (`Container`, `Paper`, ...) component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * Layout theme theme value.
 *
 * @example
 * ```ts
 * import { layoutTheme } from "@beep/ui/themes/components/layout"
 *
 * console.log(layoutTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const layoutTheme: ThemeComponents = {
  MuiStack: {
    defaultProps: {
      useFlexGap: true,
    },
  },
};
