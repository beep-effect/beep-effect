/**
 * App-wide MUI theme composition: options, component overrides, and the constructed theme.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";
import { createTheme } from "@mui/material/styles";
import { colors } from "./colors.ts";
import { alertTheme } from "./components/alert.ts";
import { autocompleteTheme } from "./components/autocomplete.ts";
import { avatarTheme } from "./components/avatar.ts";
import { buttonTheme } from "./components/button.ts";
import { cardTheme } from "./components/card.ts";
import { chipTheme } from "./components/chip.ts";
import { controlsTheme } from "./components/controls.ts";
import { dataGridTheme } from "./components/data-grid.ts";
import { datePickerTheme } from "./components/date-picker.ts";
import { dialogTheme } from "./components/dialog.ts";
import { layoutTheme } from "./components/layout.ts";
import { linkTheme } from "./components/link.ts";
import { listTheme } from "./components/list.ts";
import { menuTheme } from "./components/menu.ts";
import { selectTheme } from "./components/select.ts";
import { svgIconTheme } from "./components/svg-icon.ts";
import { tableTheme } from "./components/table.ts";
import { textFieldTheme } from "./components/text-field.ts";
import { treeViewTheme } from "./components/tree-view.ts";
import { shadows } from "./shadows.ts";
import { typography, typographyTheme } from "./typography.ts";
import type { Theme } from "@mui/material/styles";
import type {} from "@mui/material/themeCssVarsAugmentation";
import type { ThemeOptions } from "./types.ts";

/**
 * Theme options theme value.
 *
 * **Example** (Import and log themeOptions)
 *
 * ```ts
 * import { themeOptions } from "@beep/ui/themes/theme"
 *
 * console.log(themeOptions)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const themeOptions: ThemeOptions = {
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: colors,
  shape: {
    borderRadius: 8,
  },
  components: {
    ...buttonTheme,
    ...textFieldTheme,
    ...selectTheme,
    ...menuTheme,
    ...autocompleteTheme,
    ...chipTheme,
    ...avatarTheme,
    ...tableTheme,
    ...cardTheme,
    ...dialogTheme,
    ...datePickerTheme,
    ...svgIconTheme,
    ...dataGridTheme,
    ...alertTheme,
    ...treeViewTheme,
    ...layoutTheme,
    ...linkTheme,
    ...controlsTheme,
    ...listTheme,
    ...typographyTheme,
  },
  typography,
  shadows,
};

/**
 * Create app theme export.
 *
 * **Example** (Import and log createAppTheme)
 *
 * ```ts
 * import { createAppTheme } from "@beep/ui/themes/theme"
 *
 * console.log(createAppTheme)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const createAppTheme = (overrides: ThemeOptions = {}): Theme => createTheme(themeOptions, overrides);

/**
 * Theme theme value.
 *
 * **Example** (Import and log theme)
 *
 * ```ts
 * import { theme } from "@beep/ui/themes/theme"
 *
 * console.log(theme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const theme = createAppTheme();
