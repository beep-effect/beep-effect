// Polyfill the `process` global for the Storybook dev server. Stories that import
// `next/link` reference the bare `process` global at eval time, which Vite's browser
// runtime does not define (the vitest test runner does, so test:storybook passes
// while the dev server throws `ReferenceError: process is not defined`). This preview
// config module body evaluates before any story module is loaded, so the shim is in
// place in time. (The ES imports below are hoisted and run before this line, which is
// fine: none of them reference `process` at eval time. `??=` never clobbers a real one.)
const globalWithProcess = globalThis as unknown as {
  process?: unknown;
};

globalWithProcess.process ??= { env: { NODE_ENV: "development" } };

import { AppThemeProvider, ThemeMode, useThemeMode } from "@beep/ui/themes";
import { DecoratorHelpers } from "@storybook/addon-themes";
import * as React from "react";
import { themes } from "storybook/theming";
import type { ResolvedThemeMode } from "@beep/ui/themes";
import type { Preview, ReactRenderer } from "@storybook/react-vite";
import type { DecoratorFunction } from "storybook/internal/types";
import "./preview.css";

/**
 * Register the addon-themes light/dark toolbar dropdown WITHOUT
 * `withThemeByClassName`. We deliberately avoid the class-toggling decorator so
 * that MUI's `CssVarsProvider` is the *single* writer of the `<html>`
 * `.light`/`.dark` class (it does this on `setMode`). Two writers race on the
 * same node and strip each other's class.
 */
DecoratorHelpers.initializeThemeState([ThemeMode.Enum.light, ThemeMode.Enum.dark], ThemeMode.Enum.dark);

/**
 * Drives MUI's color scheme from the addon-themes toolbar selection.
 *
 * MUST render inside {@link AppThemeProvider}: `useColorScheme().setMode` (via
 * `useThemeMode`) silently no-ops outside the provider. Re-asserting the mode on
 * every render keeps the toolbar authoritative over MUI's persisted
 * `localStorage('mui-mode')` value (`setMode` early-returns when unchanged).
 */
function ThemeSync({
  mode,
  children,
}: {
  readonly mode: ResolvedThemeMode;
  readonly children: React.ReactNode;
}): React.ReactNode {
  const { setMode } = useThemeMode();
  React.useEffect(() => {
    setMode(mode);
  }, [mode, setMode]);
  return children;
}

/**
 * Wraps each story in the same provider stack the apps use
 * (`AppThemeProvider` -> `MuiThemeProvider` + `CssBaseline`), so MUI and
 * Tailwind/shadcn tokens flip together from one signal. `defaultMode` is always
 * an explicit `light`/`dark` (never `system`, which resolves via `matchMedia`
 * and fights the toolbar).
 *
 * Imports only `@beep/ui/themes` canonical exports. `AppThemeProvider` must stay
 * free of Config/Layer dependencies; if it ever gains one, revisit this mount
 * (see `standards/architecture/08-testing.md`).
 *
 * `storageManager={null}` disables MUI's `localStorage` persistence: the toolbar
 * is the source of truth here, so the active scheme is never read from or written
 * to storage, which removes cross-story theme bleed.
 */
const withAppTheme: DecoratorFunction<ReactRenderer> = (Story, context) => {
  const selected = DecoratorHelpers.pluckThemeFromContext(context);
  const mode = selected === ThemeMode.Enum.light ? ThemeMode.Enum.light : ThemeMode.Enum.dark;
  return (
    <AppThemeProvider defaultMode={mode} storageManager={null}>
      <ThemeSync mode={mode}>
        <Story />
      </ThemeSync>
    </AppThemeProvider>
  );
};

/**
 * Wraps each story in a container that inherits the theme's background and text
 * colors via Tailwind tokens, which key off the `<html>` class MUI writes.
 */
const withThemeBackground: DecoratorFunction<ReactRenderer> = (Story) => (
  <div className="bg-background text-foreground min-h-screen p-6">
    <Story />
  </div>
);

const preview: Preview = {
  decorators: [withThemeBackground, withAppTheme],
  parameters: {
    layout: "fullscreen",
    docs: {
      theme: themes.dark,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
