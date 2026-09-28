import { it } from "@beep/test-runner";
import { resolveThemeMode, ThemeMode } from "@beep/ui/themes";
import { describe, expect } from "@effect/vitest";

describe("@beep/ui themes", () => {
  describe("resolveThemeMode", () => {
    it("preserves explicit light and dark modes", () => {
      expect(resolveThemeMode(ThemeMode.Enum.dark, ThemeMode.Enum.light)).toBe(ThemeMode.Enum.dark);
      expect(resolveThemeMode(ThemeMode.Enum.light, ThemeMode.Enum.dark)).toBe(ThemeMode.Enum.light);
    });

    it("resolves system mode from the detected system preference", () => {
      expect(resolveThemeMode(ThemeMode.Enum.system, ThemeMode.Enum.dark)).toBe(ThemeMode.Enum.dark);
      expect(resolveThemeMode(ThemeMode.Enum.system, ThemeMode.Enum.light)).toBe(ThemeMode.Enum.light);
    });

    it("treats null and undefined mode as system mode", () => {
      expect(resolveThemeMode(null, ThemeMode.Enum.dark)).toBe(ThemeMode.Enum.dark);
      expect(resolveThemeMode(undefined, ThemeMode.Enum.light)).toBe(ThemeMode.Enum.light);
    });
  });
});
