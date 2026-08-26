import { editorCapabilityCatalog } from "@beep/editor/capability/catalog";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import {
  formatChord,
  projectCommands,
  projectShortcutHelp,
  projectSlashItems,
} from "@beep/editor/capability/projection";
import { resolveEditorProfile } from "@beep/editor/capability/resolver";
import { KeyChord } from "@beep/editor/capability/schemas";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

describe("capability projections", () => {
  it.effect(
    "derives toolbar, slash, and help rows from one resolved command set",
    Effect.fnUntraced(function* () {
      const resolved = yield* Effect.fromResult(
        resolveEditorProfile(editorCapabilityCatalog, referenceProfiles.documentProof)
      );
      const commandIds = A.map(resolved.commands, (command) => command.id);
      const toolbar = projectCommands(resolved, "toolbar");
      const slash = projectSlashItems(resolved, () => () => {});
      const help = projectShortcutHelp(resolved, "windows-linux");

      expect(A.length(help)).toBe(A.length(resolved.commands));
      expect(A.every(toolbar, (command) => A.contains(commandIds, command.id))).toBe(true);
      expect(A.every(slash, (item) => A.contains(commandIds, item.key))).toBe(true);
      expect(A.every(help, (entry) => A.contains(commandIds, entry.commandId))).toBe(true);
    })
  );

  it.effect(
    "formats canonical chords with platform-native modifier labels",
    Effect.fnUntraced(function* () {
      const chord = KeyChord.make({ modifiers: ["control", "meta", "alt", "shift"], key: "x" });
      expect(formatChord("windows-linux", chord)).toBe("Ctrl+Win+Alt+Shift+X");
      expect(formatChord("apple", chord)).toBe("Control+Cmd+Option+Shift+X");

      yield* Effect.void;
    })
  );
});
