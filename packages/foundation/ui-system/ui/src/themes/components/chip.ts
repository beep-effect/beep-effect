/**
 * MUI `Chip` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CONTROL_HEIGHTS, CONTROL_TOUCH_HEIGHTS, TOUCH_MEDIA_QUERY } from "../scales.ts";
import type { ThemeComponents } from "../types.ts";

declare module "@mui/material/Chip" {
  interface ChipPropsSizeOverrides {
    large: true;
  }
}

/**
 * Chip theme theme value.
 *
 * **Example** (Import chip theme)
 *
 * ```ts
 * import { chipTheme } from "@beep/ui/themes/components/chip"
 *
 * console.log(chipTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const chipTheme: ThemeComponents = {
  MuiChip: {
    styleOverrides: {
      root: ({ theme }) => {
        const palette = (theme.vars || theme).palette;
        return {
          height: "initial",
          borderRadius: 6,
          fontWeight: 400,
          fontSize: theme.typography.body2.fontSize,
          "&.Mui-focusVisible": {
            outline: "2px solid",
            outlineColor: palette.text.primary,
            outlineOffset: "2px",
          },
          variants: [
            {
              props: { size: "small" },
              style: {
                lineHeight: 1.4285714286,
                paddingBlock: CONTROL_HEIGHTS.sm / 2 - 14.5,
                ...(CONTROL_HEIGHTS.sm !== CONTROL_TOUCH_HEIGHTS.sm && {
                  [TOUCH_MEDIA_QUERY]: {
                    paddingBlock: CONTROL_TOUCH_HEIGHTS.sm / 2 - 14,
                  },
                }),
              },
            },
            {
              props: { size: "small", variant: "outlined" },
              style: {
                lineHeight: 1.4285714286,
                paddingBlock: CONTROL_HEIGHTS.sm / 2 - 15.5,
                ...(CONTROL_HEIGHTS.sm !== CONTROL_TOUCH_HEIGHTS.sm && {
                  [TOUCH_MEDIA_QUERY]: {
                    paddingBlock: CONTROL_TOUCH_HEIGHTS.sm / 2 - 15,
                  },
                }),
              },
            },
            {
              props: { size: "medium" },
              style: {
                paddingBlock: CONTROL_HEIGHTS.md / 2 - 16,
                ...(CONTROL_HEIGHTS.md !== CONTROL_TOUCH_HEIGHTS.md && {
                  [TOUCH_MEDIA_QUERY]: {
                    paddingBlock: CONTROL_TOUCH_HEIGHTS.md / 2 - 14.5,
                  },
                }),
              },
            },
            {
              props: { size: "medium", variant: "outlined" },
              style: {
                paddingBlock: CONTROL_HEIGHTS.md / 2 - 17,
                ...(CONTROL_HEIGHTS.md !== CONTROL_TOUCH_HEIGHTS.md && {
                  [TOUCH_MEDIA_QUERY]: {
                    paddingBlock: CONTROL_TOUCH_HEIGHTS.md / 2 - 15.5,
                  },
                }),
              },
            },
            {
              props: { size: "large" },
              style: {
                paddingBlock: CONTROL_HEIGHTS.lg / 2 - 17,
                ...(CONTROL_HEIGHTS.lg !== CONTROL_TOUCH_HEIGHTS.lg && {
                  [TOUCH_MEDIA_QUERY]: {
                    paddingBlock: CONTROL_TOUCH_HEIGHTS.lg / 2 - 17.5,
                  },
                }),
              },
            },
            {
              props: { size: "large", variant: "outlined" },
              style: {
                paddingBlock: CONTROL_HEIGHTS.lg / 2 - 18,
                ...(CONTROL_HEIGHTS.lg !== CONTROL_TOUCH_HEIGHTS.lg && {
                  [TOUCH_MEDIA_QUERY]: {
                    paddingBlock: CONTROL_TOUCH_HEIGHTS.lg / 2 - 18.5,
                  },
                }),
              },
            },
            {
              props: { variant: "outlined", color: "primary" },
              style: {
                color: palette.primary.text,
              },
            },
            {
              props: { variant: "outlined", color: "secondary" },
              style: {
                color: palette.secondary.text,
              },
            },
            {
              props: { variant: "outlined", color: "success" },
              style: {
                color: palette.success.text,
              },
            },
            {
              props: { variant: "outlined", color: "error" },
              style: {
                color: palette.error.text,
              },
            },
            {
              props: { variant: "outlined", color: "warning" },
              style: {
                color: palette.warning.text,
              },
            },
            {
              props: { variant: "outlined", color: "info" },
              style: {
                color: palette.info.text,
              },
            },
            // Filled variant for success, error, warning, info
            {
              props: { variant: "filled" },
              style: {
                ...theme.applyStyles("dark", {
                  "--_p": "60%",
                }),
              },
            },
            {
              props: { variant: "filled", color: "success" },
              style: {
                color: `color-mix(in oklch, ${palette.success.text}, ${palette.common.onBackground} 30%)`,
                backgroundColor: `color-mix(in oklch, ${palette.success.main}, ${palette.common.background} var(--_p, 80%))`,
              },
            },
            {
              props: { variant: "filled", color: "error" },
              style: {
                color: `color-mix(in oklch, ${palette.error.text}, ${palette.common.onBackground} 30%)`,
                backgroundColor: `color-mix(in oklch, ${palette.error.main}, ${palette.common.background} var(--_p, 80%))`,
              },
            },
            {
              props: { variant: "filled", color: "warning" },
              style: {
                color: `color-mix(in oklch, ${palette.warning.text}, ${palette.common.onBackground} 30%)`,
                backgroundColor: `color-mix(in oklch, ${palette.warning.main}, ${palette.common.background} var(--_p, 80%))`,
              },
            },
            {
              props: { variant: "filled", color: "info" },
              style: {
                color: `color-mix(in oklch, ${palette.info.text}, ${palette.common.onBackground} 30%)`,
                backgroundColor: `color-mix(in oklch, ${palette.info.main}, ${palette.common.background} var(--_p, 80%))`,
              },
            },
            {
              props: { clickable: true },
              style: {
                "&:active": {
                  transform: "scale(0.98)",
                },
              },
            },
          ],
        };
      },
      label: {
        variants: [
          {
            props: { size: "medium" },
            style: {
              paddingInline: CONTROL_HEIGHTS.md / 2 - 8,
            },
          },
        ],
      },
      icon: {
        fontSize: "1.125rem",
        variants: [
          {
            props: { size: "small" },
            style: {
              fontSize: "1rem",
            },
          },
        ],
      },
      deleteIcon: ({ theme }) => ({
        fontSize: "1lh",
        "&:active": {
          transform: "scale(0.97)",
        },
        variants: [
          {
            props: { color: "default" },
            style: {
              color: (theme.vars || theme).palette.text.icon,
              "&:hover": {
                color: (theme.vars || theme).palette.text.secondary,
              },
            },
          },
        ],
      }),
    },
  },
};
