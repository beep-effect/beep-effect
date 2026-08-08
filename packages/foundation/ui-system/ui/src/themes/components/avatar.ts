/**
 * MUI `Avatar` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * Avatar theme theme value.
 *
 * **Example** (Import avatar theme)
 *
 * ```ts
 * import { avatarTheme } from "@beep/ui/themes/components/avatar"
 *
 * console.log(avatarTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const avatarTheme: ThemeComponents = {
  MuiAvatar: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontWeight: 500,
        fontSize: theme.typography.body2.fontSize,
        backgroundColor: (theme.vars || theme).palette.secondary.light,
        color: (theme.vars || theme).palette.text.secondary,
        ...theme.applyStyles("dark", {
          backgroundColor: (theme.vars || theme).palette.secondary.dark,
        }),
      }),
    },
  },
};
