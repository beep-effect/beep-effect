// decision: preview-only-component-grabbing
// decision: browser-process-shim
const globalWithProcess = globalThis as unknown as {
  process?: unknown;
};

globalWithProcess.process ??= { env: { NODE_ENV: "development" }, platform: "browser", arch: "browser" };

// biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite injects DEV and MODE on import.meta.env. Owner: @beep/storybook. Exit: Biome recognizes Vite's built-in import.meta.env keys (#1855).
if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
  void import("bippy")
    .then((bippy) => {
      bippy.installRDTHook();
      return import("react-grab");
    })
    .catch((error: unknown) => {
      Effect.runFork(
        Effect.logWarning("react-grab failed to load; component grabbing is unavailable in this session.", error)
      );
    });
}

import { AppThemeProvider, ThemeMode, useThemeMode } from "@beep/ui/themes";
import { DecoratorHelpers } from "@storybook/addon-themes";
import * as Effect from "effect/Effect";
import * as React from "react";
import { themes } from "storybook/theming";
import type { ResolvedThemeMode } from "@beep/ui/themes";
import type { Preview, ReactRenderer } from "@storybook/react-vite";
import type { DecoratorFunction } from "storybook/internal/types";
import "./preview.css";

DecoratorHelpers.initializeThemeState([ThemeMode.Enum.light, ThemeMode.Enum.dark], ThemeMode.Enum.dark);

// decision: toolbar-theme-ownership
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

// decision: toolbar-theme-ownership
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
