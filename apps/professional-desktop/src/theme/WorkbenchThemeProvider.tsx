/**
 * Professional desktop theme provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { AppThemeProvider, createAppTheme } from "@beep/ui/themes";
import { useAtomValue } from "@effect/atom-react";
import { workbenchThemeModeAtom } from "./Theme.atoms.ts";
import type { ThemeMode, ThemeOptions } from "@beep/ui/themes";
import type { ComponentProps, ReactNode } from "react";

// Green-workbench MUI color schemes layered over the shared `@beep/ui` base.
// Dark is the near-black "workbench" surface (trustgraph aesthetic); light is
// green-on-parchment (the oip-web parchment values). App-local overrides — the
// `@beep/ui` defaults are untouched. Internal to this provider (not public API).
const greenWorkbenchThemeOptions = {
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#2d632d",
        },
        secondary: {
          main: "#c9a24b",
        },
        background: {
          default: "#f4ede0",
          paper: "#fffaf0",
        },
        text: {
          primary: "#1a3a1a",
          secondary: "#52525b",
        },
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#5c9a5c",
        },
        secondary: {
          main: "#eab308",
        },
        background: {
          default: "#09090b",
          paper: "#18181b",
        },
        text: {
          primary: "#fafafa",
          secondary: "#a1a1aa",
        },
      },
    },
  },
} satisfies ThemeOptions;

// The green-workbench theme built from the options above. Internal to this
// provider (not public API).
const workbenchTheme = createAppTheme(greenWorkbenchThemeOptions);

type ThemeStorageManager = NonNullable<ComponentProps<typeof AppThemeProvider>["storageManager"]>;

const noop = (): void => undefined;

// MUI owns CSS-variable application, while the Atom store remains the sole
// preference owner. Replacing this adapter when the Atom mode changes causes
// MUI's existing subscription effect to update its internal color-scheme state
// without remounting the provider subtree.
const atomThemeStorageManager =
  (mode: ThemeMode): ThemeStorageManager =>
  ({ key }) => {
    const ownsMode = key === "mui-mode";
    return {
      get: (defaultValue) => (ownsMode ? mode : defaultValue),
      set: noop,
      subscribe: (notify) => {
        if (ownsMode) notify(mode);
        return noop;
      },
    };
  };

/**
 * Provides the green-workbench theme while reusing the shared `@beep/ui` theme
 * base. Defaults to the OS light/dark preference (`system`).
 *
 * **Example** (Create provider element)
 *
 * ```tsx
 * import { WorkbenchThemeProvider } from "@/theme/WorkbenchThemeProvider"
 *
 * const provider = <WorkbenchThemeProvider><main /></WorkbenchThemeProvider>
 * console.log(provider.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function WorkbenchThemeProvider({ children }: { readonly children: ReactNode }) {
  const mode = useAtomValue(workbenchThemeModeAtom);

  return (
    <AppThemeProvider defaultMode={mode} storageManager={atomThemeStorageManager(mode)} theme={workbenchTheme}>
      {children}
    </AppThemeProvider>
  );
}
