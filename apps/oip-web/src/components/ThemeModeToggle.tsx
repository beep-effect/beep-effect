/**
 * OIP light and dark mode toggle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Static OIP light/dark theme toggle. The root layout attaches the tiny
 * behavior script (see `oipThemeToggleScript`) that flips `data-theme-mode`
 * on the button, so the page swaps icons through CSS without React hydration.
 *
 * **Details**
 *
 * Renders as a quiet editorial ghost button: a hairline-bordered square that
 * holds a gold sun (light) and moon (dark) glyph. The active glyph rotates and
 * cross-fades into view while the other rotates out, driven entirely by the
 * `group-data-[theme-mode=…]` state the behavior script toggles.
 *
 * **Example** (Basic component instantiation)
 *
 * ```tsx
 * import { ThemeModeToggle } from "@beep/oip-web/components/ThemeModeToggle"
 *
 * const toggle = <ThemeModeToggle />
 * console.log(toggle.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ThemeModeToggle() {
  return (
    <button
      aria-label="Switch to dark mode"
      aria-pressed="false"
      className="group/theme inline-flex size-9 items-center justify-center rounded-md border border-[color-mix(in_oklab,var(--oip-on-soil)_22%,transparent)] bg-transparent text-[var(--oip-gold)] transition-colors hover:border-[color-mix(in_oklab,var(--oip-on-soil)_42%,transparent)] hover:bg-[color-mix(in_oklab,var(--oip-on-soil)_10%,transparent)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--oip-gold)]"
      data-oip-theme-toggle=""
      data-theme-mode="light"
      suppressHydrationWarning
      type="button"
    >
      <span aria-hidden className="relative block size-[1.05rem]" suppressHydrationWarning>
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full rotate-0 scale-100 opacity-100 transition-all duration-300 ease-out group-data-[theme-mode=dark]/theme:-rotate-90 group-data-[theme-mode=dark]/theme:scale-0 group-data-[theme-mode=dark]/theme:opacity-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
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
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full rotate-90 scale-0 opacity-0 transition-all duration-300 ease-out group-data-[theme-mode=dark]/theme:rotate-0 group-data-[theme-mode=dark]/theme:scale-100 group-data-[theme-mode=dark]/theme:opacity-100"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </span>
    </button>
  );
}
