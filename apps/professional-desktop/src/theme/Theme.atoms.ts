/**
 * Atom-owned desktop theme preference and system-mode resolution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolveThemeMode, ThemeMode } from "@beep/ui/themes";
import { Effect } from "effect";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime, professionalStorageRuntime } from "@/runtime/ProfessionalAtomRuntime";

const THEME_STORAGE_KEY = "professional-desktop:theme-mode";

/**
 * Persisted desktop theme preference.
 *
 * @example
 * ```ts
 * import { workbenchThemeModeAtom } from "@/theme/Theme.atoms"
 *
 * console.log(typeof workbenchThemeModeAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const workbenchThemeModeAtom = Atom.kvs({
  runtime: professionalStorageRuntime,
  key: THEME_STORAGE_KEY,
  schema: ThemeMode,
  defaultValue: ThemeMode.thunk.system,
});

const systemThemeModeAtom = Atom.make((get) => {
  const media = globalThis.matchMedia("(prefers-color-scheme: dark)");
  const readMode = () => (media.matches ? ThemeMode.Enum.dark : ThemeMode.Enum.light);
  const updateMode = (): void => get.setSelf(readMode());
  media.addEventListener("change", updateMode);
  get.addFinalizer(() => media.removeEventListener("change", updateMode));
  return readMode();
});

/**
 * Effective light/dark mode after resolving the persisted system preference.
 *
 * @example
 * ```ts
 * import { resolvedWorkbenchThemeModeAtom } from "@/theme/Theme.atoms"
 *
 * console.log(typeof resolvedWorkbenchThemeModeAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const resolvedWorkbenchThemeModeAtom = Atom.readable((get) =>
  resolveThemeMode(get(workbenchThemeModeAtom), get(systemThemeModeAtom))
);

/**
 * Runtime action that toggles the effective desktop color scheme.
 *
 * @example
 * ```ts
 * import { toggleWorkbenchThemeAtom } from "@/theme/Theme.atoms"
 *
 * console.log(typeof toggleWorkbenchThemeAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const toggleWorkbenchThemeAtom = professionalBrowserRuntime.fn<void>()(
  Effect.fnUntraced(function* (_, ctx) {
    ctx.set(
      workbenchThemeModeAtom,
      ThemeMode.is.dark(ctx(resolvedWorkbenchThemeModeAtom)) ? ThemeMode.Enum.light : ThemeMode.Enum.dark
    );
  })
);
