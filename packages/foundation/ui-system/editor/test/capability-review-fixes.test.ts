// @vitest-environment jsdom
import { editorCapabilityCatalog } from "@beep/editor/capability/catalog";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { ariaKeyShortcuts } from "@beep/editor/capability/projection";
import { resolveEditorProfile } from "@beep/editor/capability/resolver";
import { chordFromKeyboardEvent } from "@beep/editor/capability/runtime";
import {
  CommandId,
  EditorProfile,
  Keybinding,
  KeybindingOverride,
  KeyChord,
  ProfileId,
} from "@beep/editor/capability/schemas";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";

const ctrlB = KeyChord.make({ modifiers: ["control"], key: "b" });

describe("review fixes", () => {
  it.effect(
    "guards an enabled command's replaced default chord",
    Effect.fnUntraced(function* () {
      const rebound = EditorProfile.make({
        ...referenceProfiles.minimal,
        id: ProfileId.make("beep-editor.test.rebound"),
        keybindingOverrides: [
          KeybindingOverride.make({
            commandId: CommandId.make("format.bold"),
            keybindings: [
              Keybinding.make({
                platform: "windows-linux",
                chord: KeyChord.make({ modifiers: ["control", "shift"], key: "b" }),
              }),
            ],
          }),
        ],
      });
      const resolved = Result.getOrThrow(resolveEditorProfile(editorCapabilityCatalog, rebound));
      const guardsCtrlB = A.some(
        resolved.guardedChords,
        (binding) => Equal.equals(binding.platform, "windows-linux") && Equal.equals(binding.chord, ctrlB)
      );
      expect(guardsCtrlB).toBe(true);
      const activeCtrlB = A.some(resolved.commands, (command) =>
        A.some(command.keybindings, (binding) => Equal.equals(binding.chord, ctrlB))
      );
      expect(activeCtrlB).toBe(false);
      yield* Effect.void;
    })
  );

  it.effect(
    "ignores AltGraph chords and serializes ARIA shortcut tokens",
    Effect.fnUntraced(function* () {
      const altGr = new KeyboardEvent("keydown", {
        key: "@",
        code: "Digit2",
        ctrlKey: true,
        altKey: true,
        modifierAltGraph: true,
      });
      expect(O.isNone(chordFromKeyboardEvent(altGr, "windows-linux"))).toBe(true);
      expect(ariaKeyShortcuts(KeyChord.make({ modifiers: ["control", "alt"], key: "1" }))).toBe("Control+Alt+1");
      expect(ariaKeyShortcuts(KeyChord.make({ modifiers: ["meta", "shift"], key: "z" }))).toBe("Meta+Shift+Z");
      yield* Effect.void;
    })
  );
});
