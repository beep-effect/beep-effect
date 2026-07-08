/**
 * MUI X `TreeView` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type {} from "@mui/x-tree-view/themeAugmentation";
import type { ThemeComponents } from "../types.ts";

/**
 * Tree view theme theme value.
 *
 * @example
 * ```ts
 * import { treeViewTheme } from "@beep/ui/themes/components/tree-view"
 *
 * console.log(treeViewTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const treeViewTheme: ThemeComponents = {
  MuiTreeItem: {
    styleOverrides: {
      content: ({ theme }) => ({
        "&[data-selected]": {
          "--Icon-color": "currentColor",
          backgroundColor: "transparent",
          "&[data-focused]": {
            backgroundColor: (theme.vars || theme).palette.action.hover,
          },
          "& .MuiTreeItem-label": {
            fontWeight: "bold",
          },
        },
      }),
    },
  },
};
