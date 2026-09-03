import "@testing-library/jest-dom/vitest";
import { ThemeMode } from "@beep/ui/themes";
import { RegistryProvider } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AtomRegistry } from "effect/unstable/reactivity";
import { afterEach, describe, expect, vi } from "vitest";
import { ThemeToggle } from "@/chat/ui/ThemeToggle";
import { ProfessionalStorageLive } from "@/runtime/ProfessionalAtomRuntime";
import { migrateWorkbenchThemeMode, resolvedWorkbenchThemeModeAtom, workbenchThemeModeAtom } from "@/theme/Theme.atoms";
import { WorkbenchThemeProvider } from "@/theme/WorkbenchThemeProvider";

const NEW_THEME_KEY = "professional-desktop:theme-mode";
const LEGACY_THEME_KEY = "mui-mode";
const ThemeModeJsonString = S.fromJsonString(ThemeMode);
const encodeThemeMode = S.encodeSync(ThemeModeJsonString);

const makeRegistry = Effect.acquireRelease(Effect.sync(AtomRegistry.make), (registry) =>
  Effect.sync(() => registry.dispose())
);

const migrateTheme = migrateWorkbenchThemeMode();

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
  vi.restoreAllMocks();
});

describe("Atom-owned workbench theme", { concurrent: false }, () => {
  it.layer(ProfessionalStorageLive)("theme preference migration", (it) => {
    it.effect(
      "migrates a valid legacy MUI mode into the schema store",
      Effect.fnUntraced(function* () {
        localStorage.setItem(LEGACY_THEME_KEY, ThemeMode.Enum.dark);
        yield* migrateTheme;
        const registry = yield* makeRegistry;
        registry.mount(workbenchThemeModeAtom);

        expect(registry.get(workbenchThemeModeAtom)).toBe(ThemeMode.Enum.dark);
        expect(localStorage.getItem(NEW_THEME_KEY)).toBe(encodeThemeMode(ThemeMode.Enum.dark));
      })
    );

    it.effect(
      "keeps new-format state authoritative over a legacy value",
      Effect.fnUntraced(function* () {
        localStorage.setItem(NEW_THEME_KEY, encodeThemeMode(ThemeMode.Enum.light));
        localStorage.setItem(LEGACY_THEME_KEY, ThemeMode.Enum.dark);
        yield* migrateTheme;
        const registry = yield* makeRegistry;
        registry.mount(workbenchThemeModeAtom);

        expect(registry.get(workbenchThemeModeAtom)).toBe(ThemeMode.Enum.light);
        expect(localStorage.getItem(NEW_THEME_KEY)).toBe(encodeThemeMode(ThemeMode.Enum.light));
      })
    );

    it.effect(
      "ignores an invalid legacy value",
      Effect.fnUntraced(function* () {
        localStorage.setItem(LEGACY_THEME_KEY, "sepia");
        yield* migrateTheme;
        const registry = yield* makeRegistry;
        registry.mount(workbenchThemeModeAtom);

        expect(registry.get(workbenchThemeModeAtom)).toBe(ThemeMode.Enum.system);
        expect(localStorage.getItem(NEW_THEME_KEY)).toBe(encodeThemeMode(ThemeMode.Enum.system));
      })
    );

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
        yield* Effect.promise(() =>
          waitFor(() => expect(toggle).toHaveAttribute("aria-label", "Switch to light mode"))
        );

        expect(getByTestId("theme-child")).toBe(child);
        expect(localStorage.getItem(NEW_THEME_KEY)).toBe(encodeThemeMode(ThemeMode.Enum.dark));
      })
    );

    it.effect(
      "replaces the pre-paint root class when the live mode toggles",
      Effect.fnUntraced(function* () {
        localStorage.setItem(NEW_THEME_KEY, encodeThemeMode(ThemeMode.Enum.dark));
        document.documentElement.classList.add("dark");
        const { getByLabelText } = render(
          <RegistryProvider>
            <WorkbenchThemeProvider>
              <ThemeToggle />
            </WorkbenchThemeProvider>
          </RegistryProvider>
        );
        const toggle = getByLabelText("Switch to light mode");

        fireEvent.click(toggle);
        yield* Effect.promise(() =>
          waitFor(() => {
            expect(toggle).toHaveAttribute("aria-label", "Switch to dark mode");
            expect(document.documentElement).toHaveClass("light");
            expect(document.documentElement).not.toHaveClass("dark");
          })
        );
      })
    );

    it.effect(
      "tracks system color-scheme changes while the preference is system",
      Effect.fnUntraced(function* () {
        let matches = false;
        const listeners: Array<EventListenerOrEventListenerObject> = [];
        vi.spyOn(window, "matchMedia").mockImplementation(
          (query) =>
            ({
              get matches() {
                return matches;
              },
              media: query,
              onchange: null,
              addListener: () => {},
              removeListener: () => {},
              addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
                listeners.push(listener);
              },
              removeEventListener: () => {},
              dispatchEvent: () => false,
            }) as MediaQueryList
        );

        const registry = yield* makeRegistry;
        registry.mount(resolvedWorkbenchThemeModeAtom);
        expect(registry.get(resolvedWorkbenchThemeModeAtom)).toBe(ThemeMode.Enum.light);

        matches = true;
        const event = new Event("change");
        for (const listener of listeners) {
          if (typeof listener === "function") listener(event);
          else listener.handleEvent(event);
        }

        expect(registry.get(resolvedWorkbenchThemeModeAtom)).toBe(ThemeMode.Enum.dark);
      })
    );
  });
});
