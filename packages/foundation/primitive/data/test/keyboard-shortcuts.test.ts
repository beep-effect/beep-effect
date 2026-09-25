import {
  KeyboardShortcutCategoryValues,
  KeyboardShortcutCommandLabelValues,
  KeyboardShortcutCommandNameValues,
  KeyboardShortcutDataValues,
  KeyboardShortcutPlatformValues,
  KeyboardShortcutRuntimeSupportValues,
  KeyboardShortcutScopeValues,
  KeyboardShortcutSourceValues,
  LinuxGnomeKeyboardShortcutDataValues,
  LinuxKdePlasmaKeyboardShortcutDataValues,
  LinuxKeyboardShortcutDataValues,
  MacOSKeyboardShortcutDataValues,
  WindowsKeyboardShortcutDataValues,
} from "@beep/data/KeyboardShortcuts";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as Str from "effect/String";

const valueSet = <A extends string>(values: ReadonlyArray<A>): ReadonlySet<A> => new Set(values);

describe("KeyboardShortcuts", () => {
  const platformIds = valueSet(KeyboardShortcutPlatformValues);
  const scopeIds = valueSet(KeyboardShortcutScopeValues);
  const categoryIds = valueSet(KeyboardShortcutCategoryValues);
  const runtimeSupportIds = valueSet(KeyboardShortcutRuntimeSupportValues);
  const sourceIds = valueSet(
    pipe(
      KeyboardShortcutSourceValues,
      A.map((source) => source.id)
    )
  );
  const commandNames = valueSet(KeyboardShortcutCommandNameValues);
  const commandLabels = valueSet(KeyboardShortcutCommandLabelValues);

  it("combines every platform dataset into the public data array", () => {
    const platformLengths =
      A.length(MacOSKeyboardShortcutDataValues) +
      A.length(WindowsKeyboardShortcutDataValues) +
      A.length(LinuxKeyboardShortcutDataValues) +
      A.length(LinuxGnomeKeyboardShortcutDataValues) +
      A.length(LinuxKdePlasmaKeyboardShortcutDataValues);

    expect(A.length(KeyboardShortcutDataValues)).toBe(platformLengths);
    expect(A.length(KeyboardShortcutDataValues)).toBeGreaterThan(100);
  });

  it("keeps each row inside the exported literal domains", () => {
    for (const entry of KeyboardShortcutDataValues) {
      expect(commandNames.has(entry.name)).toBe(true);
      expect(commandLabels.has(entry.label)).toBe(true);
      expect(platformIds.has(entry.platform)).toBe(true);
      expect(scopeIds.has(entry.scope)).toBe(true);
      expect(categoryIds.has(entry.category)).toBe(true);
      expect(entry.label).toBe(Str.capitalize(entry.name));

      for (const sourceId of entry.sourceIds) {
        expect(sourceIds.has(sourceId)).toBe(true);
      }

      for (const shortcut of entry.shortcuts) {
        expect(runtimeSupportIds.has(shortcut.runtimeSupport)).toBe(true);
      }
    }
  });

  it("keeps source metadata reviewable", () => {
    for (const source of KeyboardShortcutSourceValues) {
      expect(source.url).toMatch(/^https:\/\//u);
      expect(source.title).not.toBe("");
      expect(source.publisher).not.toBe("");
    }
  });

  it("keeps supported runtime chords backed by Tauri accelerators", () => {
    for (const entry of KeyboardShortcutDataValues) {
      for (const shortcut of entry.shortcuts) {
        if (shortcut.runtimeSupport === "supported") {
          expect("tauriAccelerator" in shortcut).toBe(true);
        }
      }
    }
  });

  it("keeps shortcut chords unique per platform, command, and scope", () => {
    const seen = new Set<string>();

    for (const entry of KeyboardShortcutDataValues) {
      for (const shortcut of entry.shortcuts) {
        const key = `${entry.platform}:${entry.scope}:${entry.name}:${shortcut.value}`;
        assertFalse(seen.has(key), `Duplicate shortcut: ${key}`);
        seen.add(key);
      }
    }
  });

  it("keeps platform-specific source-backed entries", () => {
    const macCopy = pipe(
      MacOSKeyboardShortcutDataValues,
      A.findFirst((entry) => entry.name === "copy")
    );
    const windowsExplorer = pipe(
      WindowsKeyboardShortcutDataValues,
      A.findFirst((entry) => entry.name === "fileExplorer")
    );
    const linuxCopy = pipe(
      LinuxKeyboardShortcutDataValues,
      A.findFirst((entry) => entry.name === "copy")
    );
    const gnomeActivities = pipe(
      LinuxGnomeKeyboardShortcutDataValues,
      A.findFirst((entry) => entry.name === "activitiesOverview")
    );
    const kdeReload = pipe(
      LinuxKdePlasmaKeyboardShortcutDataValues,
      A.findFirst((entry) => entry.name === "reload")
    );

    expect(O.isSome(macCopy)).toBe(true);
    expect(O.isSome(windowsExplorer)).toBe(true);
    expect(O.isSome(linuxCopy)).toBe(true);
    expect(O.isSome(gnomeActivities)).toBe(true);
    expect(O.isSome(kdeReload)).toBe(true);
  });
});
