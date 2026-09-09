/**
 * MUI `Button` component theme overrides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import { CONTROL_HEIGHTS, CONTROL_TOUCH_HEIGHTS, TOUCH_MEDIA_QUERY } from "../scales.ts";
import type { Theme } from "@mui/material/styles";
import type { ThemeComponents } from "../types.ts";

type ButtonPalette = Pick<
  Theme["palette"],
  "primary" | "secondary" | "success" | "error" | "warning" | "info" | "common"
>;
type PaddingProperty = "padding" | "paddingBlock";

const responsivePadding = (property: PaddingProperty, height: number, touchHeight: number, offset: number) => ({
  [property]: height / 2 - offset,
  ...(height === touchHeight
    ? {}
    : {
        [TOUCH_MEDIA_QUERY]: {
          [property]: touchHeight / 2 - offset,
        },
      }),
});

const iconOnlyButtonStyles = {
  "--Icon-color": "currentColor",
  "&.MuiButton-sizeSmall": {
    ...responsivePadding("padding", CONTROL_HEIGHTS.sm, CONTROL_TOUCH_HEIGHTS.sm, 10),
    minWidth: "28px",
  },
  "&.MuiButton-sizeMedium": {
    ...responsivePadding("padding", CONTROL_HEIGHTS.md, CONTROL_TOUCH_HEIGHTS.md, 10),
    minWidth: "36px",
  },
  "&.MuiButton-sizeLarge": {
    ...responsivePadding("padding", CONTROL_HEIGHTS.lg, CONTROL_TOUCH_HEIGHTS.lg, 12),
    minWidth: "48px",
  },
  "&.MuiButton-outlined": {
    "&.MuiButton-sizeSmall": responsivePadding("padding", CONTROL_HEIGHTS.sm, CONTROL_TOUCH_HEIGHTS.sm, 11),
    "&.MuiButton-sizeMedium": responsivePadding("padding", CONTROL_HEIGHTS.md, CONTROL_TOUCH_HEIGHTS.md, 11),
    "&.MuiButton-sizeLarge": responsivePadding("padding", CONTROL_HEIGHTS.lg, CONTROL_TOUCH_HEIGHTS.lg, 13),
  },
};

const buttonSizeVariants = [
  {
    props: { size: "small" },
    style: {
      ...responsivePadding("paddingBlock", CONTROL_HEIGHTS.sm, CONTROL_TOUCH_HEIGHTS.sm, 10),
      paddingInline: 12,
      lineHeight: "20px",
    },
  },
  {
    props: { size: "medium" },
    style: {
      ...responsivePadding("paddingBlock", CONTROL_HEIGHTS.md, CONTROL_TOUCH_HEIGHTS.md, 10),
      paddingInline: 16,
      lineHeight: "20px",
    },
  },
  {
    props: { size: "large" },
    style: {
      ...responsivePadding("paddingBlock", CONTROL_HEIGHTS.lg, CONTROL_TOUCH_HEIGHTS.lg, 12),
      paddingInline: 24,
      lineHeight: "24px",
      fontSize: "1rem",
    },
  },
] as const;

const outlinedSizeVariant = {
  props: { variant: "outlined" },
  style: {
    "&.MuiButton-sizeSmall": {
      ...responsivePadding("paddingBlock", CONTROL_HEIGHTS.sm, CONTROL_TOUCH_HEIGHTS.sm, 11),
      paddingInline: 12,
    },
    "&.MuiButton-sizeMedium": {
      ...responsivePadding("paddingBlock", CONTROL_HEIGHTS.md, CONTROL_TOUCH_HEIGHTS.md, 11),
      paddingInline: 16,
    },
    "&.MuiButton-sizeLarge": {
      ...responsivePadding("paddingBlock", CONTROL_HEIGHTS.lg, CONTROL_TOUCH_HEIGHTS.lg, 13),
      paddingInline: 24,
    },
    "& .MuiTouchRipple-root": {
      inset: "-1px",
    },
  },
} as const;

const textColorVariant = (palette: ButtonPalette) => ({
  props: { variant: "text" } as const,
  style: {
    "&.MuiButton-colorSecondary": { "--variant-textColor": palette.secondary.text },
    "&.MuiButton-colorSuccess": { "--variant-textColor": palette.success.text },
    "&.MuiButton-colorError": { "--variant-textColor": palette.error.text },
    "&.MuiButton-colorWarning": { "--variant-textColor": palette.warning.text },
    "&.MuiButton-colorInfo": { "--variant-textColor": palette.info.text },
    color: "var(--variant-textColor)",
  },
});

const outlinedColorVariant = (palette: ButtonPalette) => ({
  props: { variant: "outlined" } as const,
  style: {
    "&.MuiButton-colorPrimary": {
      "--variant-outlinedBorder": `color-mix(in srgb, ${palette.primary.main} 12%, transparent)`,
    },
    "&.MuiButton-colorSecondary": {
      "--variant-outlinedColor": palette.secondary.text,
      "--variant-outlinedBorder": `color-mix(in srgb, ${palette.secondary.text} 28%, transparent)`,
    },
    "&.MuiButton-colorSuccess": {
      "--variant-outlinedColor": palette.success.text,
      "--variant-outlinedBorder": `color-mix(in srgb, ${palette.success.text} 28%, transparent)`,
    },
    "&.MuiButton-colorError": {
      "--variant-outlinedColor": palette.error.text,
      "--variant-outlinedBorder": `color-mix(in srgb, ${palette.error.text} 28%, transparent)`,
    },
    "&.MuiButton-colorWarning": {
      "--variant-outlinedColor": palette.warning.text,
      "--variant-outlinedBorder": `color-mix(in srgb, ${palette.warning.text} 28%, transparent)`,
    },
    "&.MuiButton-colorInfo": {
      "--variant-outlinedColor": palette.info.text,
      "--variant-outlinedBorder": `color-mix(in srgb, ${palette.info.text} 28%, transparent)`,
    },
    color: "var(--variant-outlinedColor)",
    borderColor: "var(--variant-outlinedBorder)",
  },
});

const containedColorVariants = (palette: ButtonPalette) =>
  A.map(
    [
      { color: "secondary", text: palette.secondary.text, main: palette.secondary.main, mix: 50 },
      { color: "success", text: palette.success.text, main: palette.success.main, mix: 60 },
      { color: "error", text: palette.error.text, main: palette.error.main, mix: 60 },
      { color: "warning", text: palette.warning.text, main: palette.warning.main, mix: 60 },
      { color: "info", text: palette.info.text, main: palette.info.main, mix: 60 },
    ] as const,
    ({ color, text, main, mix }) => ({
      props: { variant: "contained" as const, color },
      style: {
        color: `color-mix(in oklch, ${text}, ${palette.common.onBackground} 30%)`,
        backgroundColor: `color-mix(in oklch, ${main}, ${palette.common.background} ${mix}%)`,
      },
    })
  );

/**
 * Button theme theme value.
 *
 * **Example** (Import button theme)
 *
 * ```ts
 * import { buttonTheme } from "@beep/ui/themes/components/button"
 *
 * console.log(buttonTheme)
 * ```
 *
 * @category themes
 * @since 0.0.0
 */
export const buttonTheme: ThemeComponents = {
  MuiButtonBase: {
    styleOverrides: {
      root: ({ theme }) => ({
        "&& .MuiTouchRipple-child": {
          background: "color-mix(in oklch, currentColor, transparent 60%)",
        },
        "--Icon-color": "color-mix(in oklch, currentColor, transparent 12%)",
        "--Icon-size": "1lh",
        ...theme.applyStyles("dark", {
          "--Icon-color": "color-mix(in oklch, currentColor, transparent 30%)",
        }),
        "&:hover": {
          "--Icon-color": "currentColor",
        },
      }),
    },
  },
  MuiIconButton: {
    styleOverrides: {
      root: ({ theme }) => ({
        fontSize: "inherit",
        lineHeight: "inherit",
        "&.Mui-focusVisible": {
          outline: "2px solid",
          outlineColor: (theme.vars || theme).palette.text.primary,
          outlineOffset: "2px",
        },
        "&:active": {
          transform: "scale(0.98)",
        },
        variants: [
          {
            props: { color: "default" },
            style: {
              "&:hover, &:focus-visible": {
                color: (theme.vars || theme).palette.text.primary,
              },
            },
          },
        ],
      }),
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: ({ theme }) => {
        const palette = (theme.vars || theme).palette;
        return {
          "--_g": "initial",
          gap: "var(--_g)",
          minWidth: "unset",
          textTransform: "capitalize",
          "&.Mui-focusVisible": {
            outline: "2px solid",
            outlineColor: palette.text.primary,
            outlineOffset: "2px",
          },
          "&:active": {
            transform: "scale(0.98)",
          },
          "&:not(:has(.MuiButton-icon))": {
            "--_g": `calc(${theme.spacing(1)} - 1px)`,
          },
          "@media (hover: hover)": {
            "&:disabled": {
              pointerEvents: "auto",
              cursor: "not-allowed",
            },
          },
          // When button contains only an icon (with or without TouchRipple)
          "&:has(> svg:only-child, > svg + .MuiTouchRipple-root)": iconOnlyButtonStyles,
          variants: [
            ...buttonSizeVariants,
            outlinedSizeVariant,
            textColorVariant(palette),
            outlinedColorVariant(palette),
            ...containedColorVariants(palette),
          ],
        };
      },
    },
  },
  MuiFab: {
    styleOverrides: {
      root: ({ theme }) => ({
        "&.Mui-focusVisible": {
          outline: "2px solid",
          outlineColor: (theme.vars || theme).palette.text.primary,
          outlineOffset: "2px",
        },
        "&:active": {
          transform: "scale(0.98)",
        },
      }),
    },
  },
  MuiToggleButton: {
    styleOverrides: {
      root: {
        variants: [
          {
            props: { size: "small" },
            style: {
              padding: CONTROL_HEIGHTS.sm / 2 - 11,
              ...(CONTROL_HEIGHTS.sm !== CONTROL_TOUCH_HEIGHTS.sm && {
                [TOUCH_MEDIA_QUERY]: {
                  padding: CONTROL_TOUCH_HEIGHTS.sm / 2 - 11,
                },
              }),
            },
          },
          {
            props: { size: "medium" },
            style: {
              padding: CONTROL_HEIGHTS.md / 2 - 11,
              ...(CONTROL_HEIGHTS.md !== CONTROL_TOUCH_HEIGHTS.md && {
                [TOUCH_MEDIA_QUERY]: {
                  padding: CONTROL_TOUCH_HEIGHTS.md / 2 - 11,
                },
              }),
            },
          },
          {
            props: { size: "large" },
            style: {
              padding: CONTROL_HEIGHTS.lg / 2 - 11,
              ...(CONTROL_HEIGHTS.lg !== CONTROL_TOUCH_HEIGHTS.lg && {
                [TOUCH_MEDIA_QUERY]: {
                  padding: CONTROL_TOUCH_HEIGHTS.lg / 2 - 11,
                },
              }),
            },
          },
        ],
      },
    },
  },
};
