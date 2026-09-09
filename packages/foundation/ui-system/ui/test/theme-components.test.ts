import { chipTheme } from "@beep/ui/themes/components/chip";
import { controlsTheme } from "@beep/ui/themes/components/controls";
import { describe, expect, it } from "vitest";

const paletteColor = { main: "#246", text: "#fff" };
const theme = {
  applyStyles: () => ({}),
  palette: {
    common: { background: "#000", onBackground: "#fff", white: "#fff" },
    error: paletteColor,
    grey: { 300: "#ccc", 700: "#555", 900: "#111" },
    info: paletteColor,
    primary: paletteColor,
    secondary: paletteColor,
    success: paletteColor,
    text: { icon: "#777", primary: "#111" },
    warning: paletteColor,
  },
  spacing: (value: number) => `${value * 8}px`,
  typography: { body2: { fontSize: "0.875rem" } },
};

describe("@beep/ui component themes", () => {
  it("renders chip root overrides from the active theme", () => {
    expect(chipTheme).toBeDefined();
    if (chipTheme === undefined) return;

    const root = chipTheme.MuiChip?.styleOverrides?.root;
    expect(root).toBeTypeOf("function");
    if (typeof root === "function") {
      expect(root({ theme } as never)).toMatchObject({
        borderRadius: 6,
        fontSize: "0.875rem",
      });
    }
  });

  it("renders switch and form-control-label root overrides", () => {
    expect(controlsTheme).toBeDefined();
    if (controlsTheme === undefined) return;

    const switchRoot = controlsTheme.MuiSwitch?.styleOverrides?.root;
    const labelRoot = controlsTheme.MuiFormControlLabel?.styleOverrides?.root;
    expect(switchRoot).toBeTypeOf("function");
    expect(labelRoot).toBeTypeOf("function");

    if (typeof switchRoot === "function") {
      expect(switchRoot({ theme } as never)).toMatchObject({
        height: "var(--_h)",
        width: "var(--_w)",
      });
    }
    if (typeof labelRoot === "function") {
      expect(labelRoot({ theme } as never)).toMatchObject({
        gap: "var(--_gap)",
        marginLeft: -4,
      });
    }
  });
});
