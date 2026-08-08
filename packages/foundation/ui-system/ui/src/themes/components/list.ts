/**
 * MUI `List` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * List theme theme value.
 *
 * **Example** (Import list theme)
 *
 * ```ts
 * import { listTheme } from "@beep/ui/themes/components/list"
 *
 * console.log(listTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const listTheme: ThemeComponents = {
  MuiListItemAvatar: {
    styleOverrides: {
      root: {
        minWidth: "unset",
      },
    },
  },
};
