/**
 * A small theme toggle button for the desktop chat header.
 *
 * Reads {@link resolvedWorkbenchThemeModeAtom} and dispatches
 * {@link toggleWorkbenchThemeAtom}. When the resolved scheme is dark, the
 * control offers a sun (switch to light); when light, a moon (switch to dark).
 * The chosen mode is schema-persisted by the Atom-owned theme store.
 *
 * @packageDocumentation
 * @category components
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import { ThemeMode } from "@beep/ui/themes";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { resolvedWorkbenchThemeModeAtom, toggleWorkbenchThemeAtom } from "@/theme/Theme.atoms";
import type { JSX } from "react";

/**
 * The theme toggle button.
 *
 * @example
 * ```tsx
 * import { ThemeToggle } from "@/chat/ui/ThemeToggle"
 *
 * console.log(ThemeToggle.name) // "ThemeToggle"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ThemeToggle(): JSX.Element {
  const resolvedMode = useAtomValue(resolvedWorkbenchThemeModeAtom);
  const toggleMode = useAtomSet(toggleWorkbenchThemeAtom);
  const isDark = ThemeMode.is.dark(resolvedMode);
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Button variant="ghost" size="icon" onClick={() => toggleMode(void 0)} aria-label={label} title={label}>
      {isDark ? (
        // Incidental cross-app sun glyph: oip-web's ThemeModeToggle draws the same icon.
        // The correct dedup is a shared @beep/ui icon (which would also touch oip-web),
        // out of this packet's scope.
        // fallow-ignore-next-line code-duplication -- sun glyph mirrors oip-web until a shared icon is introduced
        <svg
          className="size-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        <svg
          className="size-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
    </Button>
  );
}
