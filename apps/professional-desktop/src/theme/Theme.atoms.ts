/**
 * Atom-owned desktop theme preference and system-mode resolution.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { resolveThemeMode, ThemeMode } from "@beep/ui/themes";
import * as P from "@beep/utils/Predicate";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { KeyValueStore } from "effect/unstable/persistence";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime, professionalStorageRuntime } from "@/runtime/ProfessionalAtomRuntime";

const THEME_STORAGE_KEY = "professional-desktop:theme-mode";
const LEGACY_MUI_THEME_STORAGE_KEY = "mui-mode";
const isThemeMode = S.is(ThemeMode);

/**
 * Persisted desktop theme preference.
 *
 * **Example** (Confirm atom object type)
 *
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

/**
 * One-time migration from MUI's legacy raw-string theme preference.
 *
 * **Details**
 *
 * The new Atom store owns a schema-encoded key. Existing new-format state wins;
 * a missing new key accepts only a valid legacy theme literal and persists it
 * through the schema store before the live preference atom mounts.
 *
 * **Example** (Verify Effect return)
 *
 * ```ts
 * import { migrateWorkbenchThemeMode } from "@/theme/Theme.atoms"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(migrateWorkbenchThemeMode())) // true
 * ```
 *
 * @effects Reads legacy browser storage and may persist the migrated theme preference.
 * @category workflows
 * @since 0.0.0
 */
export const migrateWorkbenchThemeMode = Effect.fn("professional_desktop.theme.migrate_preference")(function* () {
  const store = yield* KeyValueStore.KeyValueStore;
  const current = yield* store.get(THEME_STORAGE_KEY);
  if (P.isNotUndefined(current)) return;
  const legacy = yield* store.get(LEGACY_MUI_THEME_STORAGE_KEY);
  if (P.isUndefined(legacy) || !isThemeMode(legacy)) return;
  yield* KeyValueStore.toSchemaStore(store, ThemeMode).set(THEME_STORAGE_KEY, legacy);
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
 * **Example** (Confirm atom object type)
 *
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
 * **Example** (Confirm atom object type)
 *
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
