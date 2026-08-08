/**
 * Curated keyboard shortcut constants for common app and desktop commands.
 *
 * The canonical shortcut value follows WAI-ARIA `aria-keyshortcuts` and W3C
 * UI Events key names. Platform display labels and Tauri accelerator strings
 * are carried as separate fields because UI text and runtime registration have
 * different compatibility constraints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as internal from "./internal/data/keyboard-shortcuts.ts";

// -------------------------------------------------------------------------------------
// types
// -------------------------------------------------------------------------------------

/**
 * Supported shortcut platform identifiers.
 *
 * **Example** (Assign macos platform value)
 *
 * ```typescript
 * import type { KeyboardShortcutPlatform } from "@beep/data/KeyboardShortcuts"
 *
 * const platform: KeyboardShortcutPlatform = "macos"
 * console.assert(platform === "macos")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutPlatform = (typeof internal.KeyboardShortcutPlatformValues)[number];

/**
 * Shortcut scope identifiers.
 *
 * **Example** (Assign app scope value)
 *
 * ```typescript
 * import type { KeyboardShortcutScope } from "@beep/data/KeyboardShortcuts"
 *
 * const scope: KeyboardShortcutScope = "app"
 * console.assert(scope === "app")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutScope = (typeof internal.KeyboardShortcutScopeValues)[number];

/**
 * Runtime registration support status for a shortcut chord.
 *
 * **Example** (Assign supported status value)
 *
 * ```typescript
 * import type { KeyboardShortcutRuntimeSupport } from "@beep/data/KeyboardShortcuts"
 *
 * const support: KeyboardShortcutRuntimeSupport = "supported"
 * console.assert(support === "supported")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutRuntimeSupport = (typeof internal.KeyboardShortcutRuntimeSupportValues)[number];

/**
 * Shortcut category identifiers used for grouping command rows.
 *
 * **Example** (Assign clipboard category value)
 *
 * ```typescript
 * import type { KeyboardShortcutCategory } from "@beep/data/KeyboardShortcuts"
 *
 * const category: KeyboardShortcutCategory = "clipboard"
 * console.assert(category === "clipboard")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutCategory = (typeof internal.KeyboardShortcutCategoryValues)[number];

/**
 * Source metadata entry for a curated shortcut reference.
 *
 * **Example** (Read first source publisher)
 *
 * ```typescript
 * import { KeyboardShortcutSourceValues, type KeyboardShortcutSource } from "@beep/data/KeyboardShortcuts"
 *
 * const source = KeyboardShortcutSourceValues[0] satisfies KeyboardShortcutSource
 * console.assert(source.publisher === "Apple Support")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutSource = (typeof internal.KeyboardShortcutSourceValues)[number];

/**
 * Source identifier used by shortcut data rows.
 *
 * **Example** (Assign Apple source id)
 *
 * ```typescript
 * import type { KeyboardShortcutSourceId } from "@beep/data/KeyboardShortcuts"
 *
 * const sourceId: KeyboardShortcutSourceId = "appleMacKeyboardShortcuts"
 * console.assert(sourceId === "appleMacKeyboardShortcuts")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutSourceId = KeyboardShortcutSource["id"];

/**
 * Lower-camel command name used as the stable shortcut command id.
 *
 * **Example** (Assign copy command name)
 *
 * ```typescript
 * import type { KeyboardShortcutCommandName } from "@beep/data/KeyboardShortcuts"
 *
 * const name: KeyboardShortcutCommandName = "copy"
 * console.assert(name === "copy")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutCommandName = (typeof internal.KeyboardShortcutCommandNameValues)[number];

/**
 * PascalCase command label derived from a shortcut command name.
 *
 * **Example** (Assign Copy command label)
 *
 * ```typescript
 * import type { KeyboardShortcutCommandLabel } from "@beep/data/KeyboardShortcuts"
 *
 * const label: KeyboardShortcutCommandLabel = "Copy"
 * console.assert(label === "Copy")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutCommandLabel = (typeof internal.KeyboardShortcutCommandLabelValues)[number];

/**
 * A platform-specific shortcut chord for one command.
 *
 * **Example** (Find copy chord values)
 *
 * ```typescript
 * import { KeyboardShortcutDataValues, type KeyboardShortcutChordData } from "@beep/data/KeyboardShortcuts"
 *
 * const copy = KeyboardShortcutDataValues.find((shortcut) => shortcut.name === "copy")
 * const hasCopyChord = copy?.shortcuts.some(
 *   (chord: KeyboardShortcutChordData) => chord.value === "Meta+C" || chord.value === "Control+C"
 * )
 *
 * console.assert(hasCopyChord)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutChordData = (typeof internal.KeyboardShortcutDataValues)[number]["shortcuts"][number];

/**
 * Canonical WAI-ARIA/UI Events shortcut literal.
 *
 * **Example** (Assign Meta+C shortcut value)
 *
 * ```typescript
 * import type { KeyboardShortcutValue } from "@beep/data/KeyboardShortcuts"
 *
 * const shortcut: KeyboardShortcutValue = "Meta+C"
 * console.assert(shortcut === "Meta+C")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutValue = KeyboardShortcutChordData["value"];

/**
 * Platform display literal for rendering a shortcut hint.
 *
 * **Example** (Assign ⌘C display literal)
 *
 * ```typescript
 * import type { KeyboardShortcutDisplay } from "@beep/data/KeyboardShortcuts"
 *
 * const display: KeyboardShortcutDisplay = "⌘C"
 * console.assert(display === "⌘C")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutDisplay = KeyboardShortcutChordData["display"];

/**
 * Tauri/muda accelerator literal for chords that can be represented at runtime.
 *
 * **Example** (Assign Cmd+C accelerator)
 *
 * ```typescript
 * import type { KeyboardShortcutTauriAccelerator } from "@beep/data/KeyboardShortcuts"
 *
 * const accelerator: KeyboardShortcutTauriAccelerator = "Cmd+C"
 * console.assert(accelerator === "Cmd+C")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutTauriAccelerator = Extract<
  KeyboardShortcutChordData,
  { readonly tauriAccelerator: string }
>["tauriAccelerator"];

/**
 * A curated shortcut command row for a single platform and command name.
 *
 * **Example** (Type copy shortcut entry)
 *
 * ```typescript
 * import { KeyboardShortcutDataValues, type KeyboardShortcutData } from "@beep/data/KeyboardShortcuts"
 *
 * const copy = KeyboardShortcutDataValues.find((shortcut) => shortcut.name === "copy")
 * if (!copy) {
 *   throw new Error("Expected a copy shortcut")
 * }
 *
 * const entry: KeyboardShortcutData = copy
 * console.assert(entry.label === "Copy")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KeyboardShortcutData = (typeof internal.KeyboardShortcutDataValues)[number];

// -------------------------------------------------------------------------------------
// constants
// -------------------------------------------------------------------------------------

/**
 * Supported shortcut platform identifiers.
 *
 * **Example** (Check macos platform included)
 *
 * ```typescript
 * import { KeyboardShortcutPlatformValues } from "@beep/data/KeyboardShortcuts"
 *
 * console.assert(KeyboardShortcutPlatformValues.includes("macos"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutPlatformValues: typeof internal.KeyboardShortcutPlatformValues =
  internal.KeyboardShortcutPlatformValues;

/**
 * Shortcut scope identifiers.
 *
 * **Example** (Check app scope included)
 *
 * ```typescript
 * import { KeyboardShortcutScopeValues } from "@beep/data/KeyboardShortcuts"
 *
 * console.assert(KeyboardShortcutScopeValues.includes("app"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutScopeValues: typeof internal.KeyboardShortcutScopeValues =
  internal.KeyboardShortcutScopeValues;

/**
 * Runtime registration support statuses.
 *
 * **Example** (Check supported status included)
 *
 * ```typescript
 * import { KeyboardShortcutRuntimeSupportValues } from "@beep/data/KeyboardShortcuts"
 *
 * console.assert(KeyboardShortcutRuntimeSupportValues.includes("supported"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutRuntimeSupportValues: typeof internal.KeyboardShortcutRuntimeSupportValues =
  internal.KeyboardShortcutRuntimeSupportValues;

/**
 * Shortcut category identifiers.
 *
 * **Example** (Check clipboard category included)
 *
 * ```typescript
 * import { KeyboardShortcutCategoryValues } from "@beep/data/KeyboardShortcuts"
 *
 * console.assert(KeyboardShortcutCategoryValues.includes("clipboard"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutCategoryValues: typeof internal.KeyboardShortcutCategoryValues =
  internal.KeyboardShortcutCategoryValues;

/**
 * Source metadata for curated shortcut references.
 *
 * **Example** (Find Apple Support source)
 *
 * ```typescript
 * import { KeyboardShortcutSourceValues } from "@beep/data/KeyboardShortcuts"
 *
 * const appleSupport = KeyboardShortcutSourceValues.find((source) => source.publisher === "Apple Support")
 * console.assert(appleSupport?.id === "appleMacKeyboardShortcuts")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutSourceValues: typeof internal.KeyboardShortcutSourceValues =
  internal.KeyboardShortcutSourceValues;

/**
 * Stable shortcut command names.
 *
 * **Example** (Check copy name included)
 *
 * ```typescript
 * import { KeyboardShortcutCommandNameValues } from "@beep/data/KeyboardShortcuts"
 *
 * console.assert(KeyboardShortcutCommandNameValues.includes("copy"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutCommandNameValues: typeof internal.KeyboardShortcutCommandNameValues =
  internal.KeyboardShortcutCommandNameValues;

/**
 * PascalCase shortcut command labels.
 *
 * **Example** (Check Copy label included)
 *
 * ```typescript
 * import { KeyboardShortcutCommandLabelValues } from "@beep/data/KeyboardShortcuts"
 *
 * console.assert(KeyboardShortcutCommandLabelValues.includes("Copy"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutCommandLabelValues: typeof internal.KeyboardShortcutCommandLabelValues =
  internal.KeyboardShortcutCommandLabelValues;

/**
 * macOS shortcut command data.
 *
 * **Example** (Find macOS copy shortcut)
 *
 * ```typescript
 * import { MacOSKeyboardShortcutDataValues } from "@beep/data/KeyboardShortcuts"
 *
 * const copy = MacOSKeyboardShortcutDataValues.find((shortcut) => shortcut.name === "copy")
 * console.assert(copy?.platform === "macos")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MacOSKeyboardShortcutDataValues: typeof internal.MacOSKeyboardShortcutDataValues =
  internal.MacOSKeyboardShortcutDataValues;

/**
 * Windows shortcut command data.
 *
 * **Example** (Find Windows copy shortcut)
 *
 * ```typescript
 * import { WindowsKeyboardShortcutDataValues } from "@beep/data/KeyboardShortcuts"
 *
 * const copy = WindowsKeyboardShortcutDataValues.find((shortcut) => shortcut.name === "copy")
 * console.assert(copy?.platform === "windows")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const WindowsKeyboardShortcutDataValues: typeof internal.WindowsKeyboardShortcutDataValues =
  internal.WindowsKeyboardShortcutDataValues;

/**
 * Portable Linux app shortcut defaults where GNOME and KDE broadly agree.
 *
 * **Example** (Find Linux copy shortcut)
 *
 * ```typescript
 * import { LinuxKeyboardShortcutDataValues } from "@beep/data/KeyboardShortcuts"
 *
 * const copy = LinuxKeyboardShortcutDataValues.find((shortcut) => shortcut.name === "copy")
 * console.assert(copy?.platform === "linux")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LinuxKeyboardShortcutDataValues: typeof internal.LinuxKeyboardShortcutDataValues =
  internal.LinuxKeyboardShortcutDataValues;

/**
 * GNOME-specific app and shell shortcut defaults.
 *
 * **Example** (Find GNOME activities shortcut)
 *
 * ```typescript
 * import { LinuxGnomeKeyboardShortcutDataValues } from "@beep/data/KeyboardShortcuts"
 *
 * const activities = LinuxGnomeKeyboardShortcutDataValues.find((shortcut) => shortcut.name === "activitiesOverview")
 * console.assert(activities?.platform === "linuxGnome")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LinuxGnomeKeyboardShortcutDataValues: typeof internal.LinuxGnomeKeyboardShortcutDataValues =
  internal.LinuxGnomeKeyboardShortcutDataValues;

/**
 * KDE Plasma and KStandardShortcut defaults.
 *
 * **Example** (Find KDE showDesktop shortcut)
 *
 * ```typescript
 * import { LinuxKdePlasmaKeyboardShortcutDataValues } from "@beep/data/KeyboardShortcuts"
 *
 * const showDesktop = LinuxKdePlasmaKeyboardShortcutDataValues.find((shortcut) => shortcut.name === "showDesktop")
 * console.assert(showDesktop?.platform === "linuxKdePlasma")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LinuxKdePlasmaKeyboardShortcutDataValues: typeof internal.LinuxKdePlasmaKeyboardShortcutDataValues =
  internal.LinuxKdePlasmaKeyboardShortcutDataValues;

/**
 * Combined shortcut command data across all supported platform datasets.
 *
 * **Example** (Find macOS copy display)
 *
 * ```typescript
 * import { KeyboardShortcutDataValues } from "@beep/data/KeyboardShortcuts"
 *
 * const copy = KeyboardShortcutDataValues.find((shortcut) => shortcut.name === "copy" && shortcut.platform === "macos")
 * console.assert(copy?.shortcuts[0]?.display === "⌘C")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KeyboardShortcutDataValues: typeof internal.KeyboardShortcutDataValues =
  internal.KeyboardShortcutDataValues;
