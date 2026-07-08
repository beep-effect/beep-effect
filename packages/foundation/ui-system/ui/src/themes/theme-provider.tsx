/**
 * The theme provider module.
 *
 * @packageDocumentation
 * @example
 * ```tsx
 * import { ResolvedThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ResolvedThemeMode)
 * ```
 *
 * @example
 * ```tsx
 * import { ThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ThemeMode)
 * ```
 *
 * @example
 * ```tsx
 * import { resolveThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(resolveThemeMode)
 * ```
 *
 * @example
 * ```tsx
 * import { AppThemeProvider } from "@beep/ui/themes/theme-provider"
 *
 * console.log(AppThemeProvider)
 * ```
 *
 * @example
 * ```tsx
 * import { useThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(useThemeMode)
 * ```
 *
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
 * Theme mode export.
 *
 * @example
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
 * Type of {@link ThemeMode}.
 *
 * @example
 * ```ts
 * import type { ThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * const preference: ThemeMode = "system"
 *
 * console.log(preference)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export type ThemeMode = typeof ThemeMode.Type;

/**
 * Resolved theme mode export.
 *
 * @example
 * ```tsx
 * import { ResolvedThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * console.log(ResolvedThemeMode)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ResolvedThemeMode = LiteralKit(ThemeMode.omitOptions(["system"])).pipe(
  $I.annoteSchema("ResolvedThemeMode", {
    description: "The resolved mode of the theme, excluding 'system'.",
  })
);

/**
 * Type of {@link ResolvedThemeMode}.
 *
 * @example
 * ```ts
 * import type { ResolvedThemeMode } from "@beep/ui/themes/theme-provider"
 *
 * const resolved: ResolvedThemeMode = "dark"
 *
 * console.log(resolved)
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export type ResolvedThemeMode = typeof ResolvedThemeMode.Type;

interface AppThemeProviderProps {
  readonly children: React.ReactNode;
  readonly defaultMode?: undefined | ThemeMode;
  /**
   * Controls how the active color scheme is persisted. Defaults to MUI's
   * `localStorage` manager. Pass `null` to disable persistence entirely — e.g.
   * in Storybook, where the toolbar (not `localStorage`) is the source of truth
   * and per-story isolation is preferred over a persisted preference.
   */
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
 * @example
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
 * @example
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
 * @example
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
