/**
 * MUI `SvgIcon` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { ThemeComponents } from "../types.ts";

/**
 * Svg icon theme theme value.
 *
 * **Example** (Import and log svgIconTheme)
 *
 * ```ts
 * import { svgIconTheme } from "@beep/ui/themes/components/svg-icon"
 *
 * console.log(svgIconTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const svgIconTheme: ThemeComponents = {
  MuiSvgIcon: {
    styleOverrides: {
      root: ({ theme }) => ({
        color: `var(--Icon-color, ${(theme.vars || theme).palette.text.icon})`,
      }),
    },
    variants: [
      {
        props: { fontSize: "small" },
        style: {
          fontSize: "var(--Icon-size, 1.125rem)", // 18px
        },
      },
      {
        props: { fontSize: "medium" },
        style: {
          fontSize: "var(--Icon-size, 1.25rem)", // 20px
        },
      },
      {
        props: { fontSize: "large" },
        style: {
          fontSize: "var(--Icon-size, 2rem)", // 32px
        },
      },
      {
        props: { color: "primary" },
        style: ({ theme }) => ({
          "--Icon-color": (theme.vars || theme).palette.primary.main,
        }),
      },
      {
        props: { color: "secondary" },
        style: ({ theme }) => ({
          "--Icon-color": (theme.vars || theme).palette.secondary.main,
        }),
      },
      {
        props: { color: "success" },
        style: ({ theme }) => ({
          "--Icon-color": (theme.vars || theme).palette.success.main,
        }),
      },
      {
        props: { color: "error" },
        style: ({ theme }) => ({
          "--Icon-color": (theme.vars || theme).palette.error.main,
        }),
      },
      {
        props: { color: "warning" },
        style: ({ theme }) => ({
          "--Icon-color": (theme.vars || theme).palette.warning.main,
        }),
      },
      {
        props: { color: "info" },
        style: ({ theme }) => ({
          "--Icon-color": (theme.vars || theme).palette.info.main,
        }),
      },
    ],
  },
};
