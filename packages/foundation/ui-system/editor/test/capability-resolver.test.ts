import { editorCapabilityCatalog } from "@beep/editor/capability/catalog";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { resolveEditorProfile } from "@beep/editor/capability/resolver";
import {
  CapabilityDescriptor,
  CapabilityId,
  CapabilityRegistrations,
  CommandDefinition,
  CommandId,
  EditorProfile,
  Keybinding,
  KeybindingOverride,
  KeyChord,
  ProfileId,
  ResolvedEditorProfile,
} from "@beep/editor/capability/schemas";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Result } from "effect";
import * as S from "effect/Schema";
import type { CapabilityDisposition, ProfileKind } from "@beep/editor/capability/schemas";

const emptyRegistrations = (): CapabilityRegistrations =>
  CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] });

const binding = (key: string): Keybinding =>
  Keybinding.make({
    platform: "windows-linux",
    chord: KeyChord.make({ modifiers: ["control"], key }),
  });

const command = (id: string, key: string): CommandDefinition =>
  CommandDefinition.make({
    id: CommandId.make(id),
    label: id,
    helpText: `Run ${id}.`,
    surfaces: ["toolbar"],
    keybindings: [binding(key)],
  });

const capability = (
  id: string,
  dependencies: ReadonlyArray<string> = [],
  conflicts: ReadonlyArray<string> = [],
  disposition: CapabilityDisposition = "implement",
  registrations: CapabilityRegistrations = emptyRegistrations(),
  commands: ReadonlyArray<CommandDefinition> = []
): CapabilityDescriptor =>
  CapabilityDescriptor.make({
    id: CapabilityId.make(id),
    title: id,
    summary: `Synthetic ${id} capability.`,
    classification: { category: "authoring", disposition },
    dependencies: A.map(dependencies, (dependency) => CapabilityId.make(dependency)),
    conflicts: A.map(conflicts, (conflict) => CapabilityId.make(conflict)),
    registrations,
    commands,
    readOnlyFallback: "render-canonical",
    canonicalCompatibility: "not-applicable",
    evidence: `test#${id}`,
  });

const profile = (
  ids: ReadonlyArray<string>,
  overrides: ReadonlyArray<KeybindingOverride> = [],
  kind: ProfileKind = "production"
): EditorProfile =>
  EditorProfile.make({
    id: ProfileId.make("editor.resolver-test"),
    kind,
    capabilities: A.map(ids, (id) => CapabilityId.make(id)),
    keybindingOverrides: overrides,
  });

const failureTag = (result: ReturnType<typeof resolveEditorProfile>): string =>
  Result.match(result, { onFailure: (error) => error._tag, onSuccess: () => "success" });

describe("capability resolver", () => {
  it.effect(
    "returns every typed pre-command failure in deterministic check order",
    Effect.fnUntraced(function* () {
      expect(failureTag(resolveEditorProfile([], profile(["node.missing"])))).toBe("UnknownCapabilityError");

      const development = capability("node.development", [], [], "development-only");
      expect(failureTag(resolveEditorProfile([development], profile(["node.development"])))).toBe(
        "DevelopmentOnlyCapabilityError"
      );

      const dependent = capability("node.dependent", ["node.base"]);
      const base = capability("node.base");
      expect(failureTag(resolveEditorProfile([base, dependent], profile(["node.dependent"])))).toBe(
        "MissingDependencyError"
      );

      const cycleA = capability("node.cycle-a", ["node.cycle-b"]);
      const cycleB = capability("node.cycle-b", ["node.cycle-a"]);
      expect(failureTag(resolveEditorProfile([cycleA, cycleB], profile(["node.cycle-a", "node.cycle-b"])))).toBe(
        "DependencyCycleError"
      );

      const conflictA = capability("node.conflict-a", [], ["node.conflict-b"]);
      const conflictB = capability("node.conflict-b");
      expect(
        failureTag(resolveEditorProfile([conflictA, conflictB], profile(["node.conflict-a", "node.conflict-b"])))
      ).toBe("CapabilityConflictError");

      yield* Effect.void;
    })
  );

  it.effect(
    "rejects incompatible registrations and unknown override commands",
    Effect.fnUntraced(function* () {
      const transformer = capability(
        "transformer.synthetic",
        [],
        [],
        "implement",
        CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: ["HEADING"] })
      );
      expect(failureTag(resolveEditorProfile([transformer], profile(["transformer.synthetic"])))).toBe(
        "IncompatibleRegistrationError"
      );

      const override = KeybindingOverride.make({
        commandId: CommandId.make("command.missing"),
        keybindings: [],
      });
      const plain = capability("node.plain");
      expect(failureTag(resolveEditorProfile([plain], profile(["node.plain"], [override])))).toBe(
        "UnknownCommandError"
      );

      yield* Effect.void;
    })
  );

  it.effect(
    "detects authored and overridden keybinding collisions",
    Effect.fnUntraced(function* () {
      const first = capability("format.first", [], [], "implement", emptyRegistrations(), [
        command("command.first", "b"),
      ]);
      const secondAuthored = capability("format.second", [], [], "implement", emptyRegistrations(), [
        command("command.second", "b"),
      ]);
      expect(
        failureTag(resolveEditorProfile([first, secondAuthored], profile(["format.first", "format.second"])))
      ).toBe("KeybindingConflictError");

      const secondOverride = capability("format.second", [], [], "implement", emptyRegistrations(), [
        command("command.second", "i"),
      ]);
      const override = KeybindingOverride.make({
        commandId: CommandId.make("command.second"),
        keybindings: [binding("b")],
      });
      expect(
        failureTag(
          resolveEditorProfile([first, secondOverride], profile(["format.first", "format.second"], [override]))
        )
      ).toBe("KeybindingConflictError");

      yield* Effect.void;
    })
  );

  it.effect(
    "produces structurally equal catalog-ordered output independent of profile order",
    Effect.fnUntraced(function* () {
      const original = yield* Effect.fromResult(
        resolveEditorProfile(editorCapabilityCatalog, referenceProfiles.minimal)
      );
      const reordered = EditorProfile.make({
        id: referenceProfiles.minimal.id,
        kind: referenceProfiles.minimal.kind,
        capabilities: A.reverse(referenceProfiles.minimal.capabilities),
        keybindingOverrides: referenceProfiles.minimal.keybindingOverrides,
      });
      const second = yield* Effect.fromResult(resolveEditorProfile(editorCapabilityCatalog, reordered));
      const third = yield* Effect.fromResult(resolveEditorProfile(editorCapabilityCatalog, referenceProfiles.minimal));

      const encode = S.encodeEffect(ResolvedEditorProfile);
      expect(Equal.equals(yield* encode(original), yield* encode(second))).toBe(true);
      expect(Equal.equals(yield* encode(original), yield* encode(third))).toBe(true);
    })
  );
});
