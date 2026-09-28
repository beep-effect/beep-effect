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
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";

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
      expect(toolbar.length).toBeGreaterThan(0);
      expect(slash.length).toBeGreaterThan(0);
      expect(help.length).toBeGreaterThan(0);
      expect(A.map(toolbar, (command) => command.id)).toEqual(
        A.map(
          A.filter(resolved.commands, (command) => A.contains(command.surfaces, "toolbar")),
          (command) => command.id
        )
      );
      expect(A.map(slash, (item) => item.key)).toEqual(
        A.map(
          A.filter(resolved.commands, (command) => A.contains(command.surfaces, "slash-menu")),
          (command) => command.id
        )
      );
      expect(A.map(help, (entry) => entry.commandId)).toEqual(commandIds);
      pipe(
        A.every(toolbar, (command) => A.contains(commandIds, command.id)),
        assertTrue
      );
      pipe(
        A.every(slash, (item) => A.contains(commandIds, item.key)),
        assertTrue
      );
      pipe(
        A.every(help, (entry) => A.contains(commandIds, entry.commandId)),
        assertTrue
      );
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
