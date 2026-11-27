/**
 * The theme provider module.
 *
 * **Example** (Import ResolvedThemeMode value)
 *
 * ```tsx
 * import { ResolvedThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ResolvedThemeMode)
 * ```
 *
 * **Example** (Import ThemeMode value)
 *
 * ```tsx
 * import { ThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ThemeMode)
 * ```
 *
 * **Example** (Import resolveThemeMode function)
 *
 * ```tsx
 * import { resolveThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(resolveThemeMode)
 * ```
 *
 * **Example** (Import AppThemeProvider component)
 *
 * ```tsx
 * import { AppThemeProvider } from "@beep/ui/themes/theme-provider"
 *
 * console.log(AppThemeProvider)
 * ```
 *
 * **Example** (Import useThemeMode hook)
 *
 * ```tsx
 * import { useThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(useThemeMode)
 * ```
 *
 * @packageDocumentation
 * @category themes
 * @since 0.0.0
 */
"use client";

import { $UiId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider as MuiThemeProvider, useColorScheme } from "@mui/material/styles";
import * as Bool from "effect/Boolean";
import { dual } from "effect/Function";
import { theme as defaultTheme } from "./theme.ts";
import type { StorageManager, Theme } from "@mui/material/styles";
import type * as React from "react";

const $I = $UiId.create("themes/theme-provider");
/**
 * **Example** (Import ThemeMode value)
 *
 * ```tsx
 * import { ThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ThemeMode)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ThemeMode = LiteralKit(["light", "dark", "system"]).pipe(
  $I.annoteSchema("ThemeMode", {
    description: "The mode of the theme.",
  })
);

/**
 * **Example** (Assign system ThemeMode)
 *
 * ```ts
 * import type { ThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * const preference: ThemeMode = "system"
 *
 * console.log(preference)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type ThemeMode = typeof ThemeMode.Type;

/**
 * **Example** (Import ResolvedThemeMode value)
 *
 * ```tsx
 * import { ResolvedThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ResolvedThemeMode)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ResolvedThemeMode = ThemeMode.pick(["light", "dark"]).pipe(
  $I.annoteSchema("ResolvedThemeMode", {
    description: "The resolved mode of the theme, excluding 'system'.",
  })
);

/**
 * **Example** (Assign dark ResolvedThemeMode)
 *
 * ```ts
 * import type { ResolvedThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * const resolved: ResolvedThemeMode = "dark"
 *
 * console.log(resolved)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type ResolvedThemeMode = typeof ResolvedThemeMode.Type;

interface AppThemeProviderProps {
  readonly children: React.ReactNode;
  readonly defaultMode?: undefined | ThemeMode;
  readonly storageManager?: StorageManager | null | undefined;
  readonly theme?: undefined | Theme;
}

interface ThemeModeControls {
  readonly mode: ThemeMode;
  readonly resolvedMode: ResolvedThemeMode;
  readonly setMode: (mode: ThemeMode | null) => void;
  readonly toggleMode: () => void;
}

/**
 * Resolve theme mode export.
 *
 * **Example** (Import resolveThemeMode function)
 *
 * ```tsx
 * import { resolveThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(resolveThemeMode)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveThemeMode: {
  (systemMode: ThemeMode | null | undefined): (mode: ThemeMode | null | undefined) => ResolvedThemeMode;
  (mode: ThemeMode | null | undefined, systemMode: ThemeMode | null | undefined): ResolvedThemeMode;
} = dual(2, (mode: ThemeMode | null | undefined, systemMode: ThemeMode | null | undefined): ResolvedThemeMode => {
  const prefersDarkMode = ThemeMode.is.dark(mode) || (!ThemeMode.is.light(mode) && ThemeMode.is.dark(systemMode));

  return Bool.match(prefersDarkMode, {
    onTrue: () => ThemeMode.Enum.dark,
    onFalse: () => ThemeMode.Enum.light,
  });
});

/**
 * App theme provider component.
 *
 * **Details**
 *
 * `storageManager` controls how the active color scheme is persisted and defaults to MUI's
 * `localStorage` manager. Pass `null` to disable persistence entirely, for example in a story
 * host whose toolbar, not `localStorage`, is the source of truth.
 *
 * **Example** (Import AppThemeProvider component)
 *
 * ```tsx
 * import { AppThemeProvider } from "@beep/ui/themes/theme-provider"
 *
 * console.log(AppThemeProvider)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function AppThemeProvider({
  children,
  defaultMode = ThemeMode.Enum.system,
  theme = defaultTheme,
  storageManager,
}: AppThemeProviderProps) {
  return (
    <MuiThemeProvider theme={theme} defaultMode={defaultMode} storageManager={storageManager} disableTransitionOnChange>
      <CssBaseline enableColorScheme />
      {children}
    </MuiThemeProvider>
  );
}

/**
 * Use theme mode hook.
 *
 * **Example** (Import useThemeMode hook)
 *
 * ```tsx
 * import { useThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(useThemeMode)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export function useThemeMode(): ThemeModeControls {
  const { mode, setMode, systemMode } = useColorScheme();
  const resolvedMode = resolveThemeMode(mode, systemMode);

  return {
    mode: mode ?? ThemeMode.Enum.system,
    resolvedMode,
    setMode,
    toggleMode: () => setMode(ThemeMode.is.dark(resolvedMode) ? ThemeMode.Enum.light : ThemeMode.Enum.dark),
  };
}
