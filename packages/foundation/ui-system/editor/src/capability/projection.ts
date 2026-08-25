/**
 * Pure UI projections derived from one resolved command registry.
 *
 * @packageDocumentation \@beep/editor/capability/projection
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { A, dual, O, Str } from "@beep/utils";
import { Equal } from "effect";
import * as S from "effect/Schema";
import { SlashItem } from "../chat/config.ts";
import { CommandId, KeyChord, Modifier, Platform as PlatformSchema } from "./schemas.ts";
import type { EditorEffect, SlashItems } from "../chat/config.ts";
import type { ActivationSurface, Platform, ResolvedCommand, ResolvedEditorProfile } from "./schemas.ts";

const $I = $EditorId.create("capability/projection");

/**
 * Shortcut-help row generated for every resolved command.
 *
 * **Example** (Create an unbound help row)
 *
 * ```ts
 * import { ShortcutHelpEntry } from "@beep/editor/capability/projection"
 * import { CommandId } from "@beep/editor/capability/schemas"
 * import { Option } from "effect"
 *
 * const entry = ShortcutHelpEntry.make({
 *   commandId: CommandId.make("format.bold"), label: "Bold", helpText: "Toggle bold.",
 *   chord: Option.none()
 * })
 * console.log(Option.isNone(entry.chord)) // true
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export class ShortcutHelpEntry extends S.Class<ShortcutHelpEntry>($I`ShortcutHelpEntry`)(
  {
    commandId: CommandId.annotateKey({ description: "Resolved command identifier." }),
    label: S.NonEmptyString.annotateKey({ description: "Visible command label." }),
    helpText: S.NonEmptyString.annotateKey({ description: "Generated command help text." }),
    chord: S.Option(KeyChord).annotateKey({ description: "Platform binding when the command has one." }),
  },
  $I.annote("ShortcutHelpEntry", {
    title: "Shortcut help entry",
    description: "Generated command help row with an optional platform-specific chord.",
  })
) {}

/**
 * Projects resolved commands that opt into one visible activation surface.
 *
 * **Example** (Project an empty toolbar)
 *
 * ```ts
 * import { projectCommands } from "@beep/editor/capability/projection"
 * import { CapabilityRegistrations, ProfileId, ResolvedEditorProfile } from "@beep/editor/capability/schemas"
 *
 * const resolved = ResolvedEditorProfile.make({
 *   profileId: ProfileId.make("editor.empty"), kind: "production", capabilities: [],
 *   registrations: CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] }),
 *   commands: [], guardedChords: []
 * })
 * console.log(projectCommands(resolved, "toolbar")) // []
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectCommands: {
  (surface: ActivationSurface): (resolved: ResolvedEditorProfile) => ReadonlyArray<ResolvedCommand>;
  (resolved: ResolvedEditorProfile, surface: ActivationSurface): ReadonlyArray<ResolvedCommand>;
} = dual(
  2,
  (resolved: ResolvedEditorProfile, surface: ActivationSurface): ReadonlyArray<ResolvedCommand> =>
    A.filter(resolved.commands, (command) => A.contains(command.surfaces, surface))
);

/**
 * Projects one shortcut-help row per resolved command for a platform.
 *
 * **Details**
 *
 * Commands without a platform binding remain present with `O.none()`, keeping
 * generated help exactly aligned with the resolved command set.
 *
 * **Example** (Project empty shortcut help)
 *
 * ```ts
 * import { projectShortcutHelp } from "@beep/editor/capability/projection"
 * import { CapabilityRegistrations, ProfileId, ResolvedEditorProfile } from "@beep/editor/capability/schemas"
 *
 * const resolved = ResolvedEditorProfile.make({
 *   profileId: ProfileId.make("editor.empty"), kind: "production", capabilities: [],
 *   registrations: CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] }),
 *   commands: [], guardedChords: []
 * })
 * console.log(projectShortcutHelp(resolved, "apple")) // []
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectShortcutHelp: {
  (platform: Platform): (resolved: ResolvedEditorProfile) => ReadonlyArray<ShortcutHelpEntry>;
  (resolved: ResolvedEditorProfile, platform: Platform): ReadonlyArray<ShortcutHelpEntry>;
} = dual(
  2,
  (resolved: ResolvedEditorProfile, platform: Platform): ReadonlyArray<ShortcutHelpEntry> =>
    A.map(resolved.commands, (command) =>
      ShortcutHelpEntry.make({
        commandId: command.id,
        label: command.label,
        helpText: command.helpText,
        chord: A.findFirst(command.keybindings, (binding) => Equal.equals(binding.platform, platform)).pipe(
          O.map((binding) => binding.chord)
        ),
      })
    )
);

const windowsLinuxModifier = Modifier.$match({
  control: () => "Ctrl",
  meta: () => "Win",
  alt: () => "Alt",
  shift: () => "Shift",
});

const appleModifier = Modifier.$match({
  control: () => "Control",
  meta: () => "Cmd",
  alt: () => "Option",
  shift: () => "Shift",
});

const formatModifier = (platform: Platform, modifier: Modifier): string =>
  PlatformSchema.$match({
    "windows-linux": () => windowsLinuxModifier(modifier),
    apple: () => appleModifier(modifier),
  })(platform);

/**
 * Formats a canonical chord using platform-native modifier labels.
 *
 * **Example** (Format an Apple chord)
 *
 * ```ts
 * import { formatChord } from "@beep/editor/capability/projection"
 * import { KeyChord } from "@beep/editor/capability/schemas"
 *
 * const chord = KeyChord.make({ modifiers: ["meta", "shift"], key: "x" })
 * console.log(formatChord("apple", chord)) // "Cmd+Shift+X"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatChord: {
  (chord: KeyChord): (platform: Platform) => string;
  (platform: Platform, chord: KeyChord): string;
} = dual(2, (platform: Platform, chord: KeyChord): string => {
  const key = Str.length(chord.key) === 1 ? Str.toUpperCase(chord.key) : chord.key;
  return A.join(
    A.append(
      A.map(chord.modifiers, (modifier) => formatModifier(platform, modifier)),
      key
    ),
    "+"
  );
});

/**
 * Projects slash-menu commands into the existing chat typeahead item model.
 *
 * **Example** (Project no slash commands)
 *
 * ```ts
 * import { projectSlashItems } from "@beep/editor/capability/projection"
 * import { CapabilityRegistrations, ProfileId, ResolvedEditorProfile } from "@beep/editor/capability/schemas"
 *
 * const resolved = ResolvedEditorProfile.make({
 *   profileId: ProfileId.make("editor.empty"), kind: "production", capabilities: [],
 *   registrations: CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] }),
 *   commands: [], guardedChords: []
 * })
 * console.log(projectSlashItems(resolved, () => () => {})) // []
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectSlashItems: {
  (run: (commandId: CommandId) => EditorEffect): (resolved: ResolvedEditorProfile) => SlashItems;
  (resolved: ResolvedEditorProfile, run: (commandId: CommandId) => EditorEffect): SlashItems;
} = dual(
  2,
  (resolved: ResolvedEditorProfile, run: (commandId: CommandId) => EditorEffect): SlashItems =>
    A.map(projectCommands(resolved, "slash-menu"), (command) =>
      SlashItem.make({
        key: command.id,
        label: command.label,
        // `hint` is the typeahead's short right-aligned slot; the sentence-long
        // help text belongs in search keywords, not next to the label.
        keywords: A.filter(Str.split(command.helpText, " "), Str.isNonEmpty),
        onSelect: run(command.id),
      })
    )
);

const ariaModifier = Modifier.$match({
  control: () => "Control",
  meta: () => "Meta",
  alt: () => "Alt",
  shift: () => "Shift",
});

/**
 * Serializes a chord in the `aria-keyshortcuts` vocabulary (`Control`,
 * `Meta`, `Alt`, `Shift` plus the key), independent of the platform-facing
 * labels {@link formatChord} renders for people.
 *
 * **Example** (Serialize a chord for assistive technology)
 *
 * ```ts
 * import { ariaKeyShortcuts } from "@beep/editor/capability/projection"
 * import { KeyChord } from "@beep/editor/capability/schemas"
 *
 * const chord = KeyChord.make({ modifiers: ["control", "alt"], key: "1" })
 * console.log(ariaKeyShortcuts(chord)) // "Control+Alt+1"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const ariaKeyShortcuts = (chord: KeyChord): string =>
  A.join(
    A.append(
      A.map(chord.modifiers, ariaModifier),
      Str.length(chord.key) === 1 ? Str.toUpperCase(chord.key) : chord.key
    ),
    "+"
  );
