import "@testing-library/jest-dom/vitest";
import { ThemeMode } from "@beep/ui/themes";
import { RegistryProvider } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { afterEach, describe, expect } from "vitest";
import { ThemeToggle } from "@/chat/ui/ThemeToggle";
import { WorkbenchThemeProvider } from "@/theme/WorkbenchThemeProvider";

const THEME_KEY = "professional-desktop:theme-mode";
const encodeThemeMode = S.encodeSync(S.fromJsonString(ThemeMode));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("Atom-owned workbench theme", { concurrent: false }, () => {
  it.effect(
    "updates the MUI color scheme without remounting its child subtree",
    Effect.fnUntraced(function* () {
      const { getByLabelText, getByTestId } = render(
        <RegistryProvider>
          <WorkbenchThemeProvider>
            <ThemeToggle />
            <div data-testid="theme-child" />
          </WorkbenchThemeProvider>
        </RegistryProvider>
      );
      const child = getByTestId("theme-child");
      const toggle = getByLabelText("Switch to dark mode");

      fireEvent.click(toggle);
      yield* Effect.promise(() => waitFor(() => expect(toggle).toHaveAttribute("aria-label", "Switch to light mode")));

      expect(getByTestId("theme-child")).toBe(child);
      expect(localStorage.getItem(THEME_KEY)).toBe(encodeThemeMode(ThemeMode.Enum.dark));
    })
  );
});
