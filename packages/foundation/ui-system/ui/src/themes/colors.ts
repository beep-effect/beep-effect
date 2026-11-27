/**
 * Shared color palette tokens for the app theme.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { CssVarsThemeOptions } from "@mui/material/styles";

declare module "@mui/material/styles" {
  interface CommonColors {
    readonly background: string;
    readonly onBackground: string;
  }

  interface PaletteColor {
    readonly text: string;
  }

  interface SimplePaletteColorOptions {
    readonly text?: undefined | string;
  }

  interface TypeText {
    readonly icon: string;
    readonly tertiary: string;
  }
}

/**
 * Colors theme value.
 *
 * **Details**
 *
 * The light scheme's `text.tertiary` is the lowest-contrast text that still passes WCAG AAA.
 *
 * **Example** (Import colors theme)
 *
 * ```ts
 * import { colors } from "@beep/ui/themes/colors"
 *
 * console.log(colors)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const colors: CssVarsThemeOptions["colorSchemes"] = {
  light: {
    palette: {
      text: {
        icon: "rgb(0 0 0 / 0.4)",
        tertiary: "rgb(0 0 0 / 0.54)",
      },
      action: {
        activatedOpacity: 0.38,
        selectedOpacity: 0.06,
        disabledOpacity: 0.2,
        focusOpacity: 0.08,
      },
      primary: {
        main: "#000",
        text: "#212121",
      },
      secondary: {
        main: "rgb(229, 229, 234)",
        text: "rgb(108, 108, 112)",
      },
      success: {
        main: "rgb(52, 199, 89)",
        text: "rgb(0, 137, 50)",
      },
      error: {
        main: "rgb(255, 56, 60)",
        text: "rgb(233, 21, 45)",
      },
      warning: {
        main: "rgb(255, 204, 0)",
        text: "rgb(161, 106, 0)",
      },
      info: {
        main: "rgb(0, 136, 255)",
        text: "rgb(30, 110, 244)",
      },
      common: {
        background: "rgb(248, 248, 248)",
        onBackground: "#212121",
      },
      background: {
        default: "rgb(248, 248, 248)",
        paper: "rgb(255, 255, 255)",
      },
    },
  },
  dark: {
    palette: {
      text: {
        icon: "rgb(255 255 255 / 0.54)",
        tertiary: "rgb(255 255 255 / 0.6)",
      },
      action: {
        activatedOpacity: 0.38,
        selectedOpacity: 0.06,
        disabledOpacity: 0.2,
        focusOpacity: 0.08,
      },
      primary: {
        main: "#fff",
        text: "#f5f5f5",
      },
      secondary: {
        main: "rgb(142, 142, 147)",
        text: "rgb(174, 174, 178)",
      },
      success: {
        main: "rgb(48, 209, 88)",
        text: "rgb(71, 217, 104)",
      },
      error: {
        main: "rgb(255, 69, 58)",
        text: "rgb(255, 97, 101)",
      },
      warning: {
        main: "rgb(255, 214, 10)",
        text: "rgb(254, 223, 67)",
      },
      info: {
        main: "rgb(0, 145, 255)",
        text: "rgb(92, 184, 255)",
      },
      common: {
        background: "rgb(0, 0, 0)",
        onBackground: "#f5f5f5",
      },
      background: {
        default: "rgb(0, 0, 0)",
        paper: "rgb(18, 18, 18)",
      },
    },
  },
};
