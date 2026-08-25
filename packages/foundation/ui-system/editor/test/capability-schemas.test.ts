import {
  CapabilityCatalog,
  CapabilityDescriptor,
  CapabilityId,
  CapabilityRegistrations,
  CommandDefinition,
  CommandId,
  EditorProfile,
  KeyChordFromString,
  ProfileId,
  ResolvedEditorProfile,
} from "@beep/editor/capability/schemas";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal, Exit } from "effect";
import * as S from "effect/Schema";
import type { NodeRegistrationKey } from "@beep/editor/capability/schemas";

const descriptorInput = {
  id: "format.bold",
  title: "Bold",
  summary: "Portable strong emphasis.",
  classification: { category: "authoring", disposition: "implement" },
  dependencies: [],
  conflicts: [],
  registrations: { nodes: [], extensions: [], transformers: [] },
  commands: [
    {
      id: "format.bold",
      label: "Bold",
      helpText: "Toggle bold formatting on the selection.",
      surfaces: ["toolbar"],
      keybindings: [
        { platform: "windows-linux", chord: "Ctrl+B" },
        { platform: "apple", chord: "Cmd+B" },
      ],
    },
  ],
  readOnlyFallback: "render-canonical",
  canonicalCompatibility: "lossless",
  evidence: "editor-capability-atlas/v1#format.bold",
} as const;

const emptyRegistrations = (): CapabilityRegistrations =>
  CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] });

const descriptor = (id: string, commandId: string, node: ReadonlyArray<NodeRegistrationKey> = []) => ({
  ...descriptorInput,
  id,
  registrations: { nodes: node, extensions: [], transformers: [] },
  commands: [
    {
      ...descriptorInput.commands[0],
      id: commandId,
    },
  ],
  evidence: `test#${id}`,
});

describe("capability schemas", () => {
  it.effect(
    "round-trips descriptors, profiles, and resolved profiles",
    Effect.fnUntraced(function* () {
      const decodedDescriptor = yield* S.decodeEffect(CapabilityDescriptor)(descriptorInput);
      const descriptorEncoded = yield* S.encodeEffect(CapabilityDescriptor)(decodedDescriptor);
      const descriptorRoundTrip = yield* S.decodeEffect(CapabilityDescriptor)(descriptorEncoded);
      expect(Equal.equals(decodedDescriptor, descriptorRoundTrip)).toBe(true);

      const profile = EditorProfile.make({
        id: ProfileId.make("editor.schema-test"),
        capabilities: [CapabilityId.make("format.bold")],
      });
      const profileEncoded = yield* S.encodeEffect(EditorProfile)(profile);
      const profileRoundTrip = yield* S.decodeEffect(EditorProfile)(profileEncoded);
      expect(Equal.equals(profile, profileRoundTrip)).toBe(true);

      const resolved = ResolvedEditorProfile.make({
        profileId: profile.id,
        kind: profile.kind,
        capabilities: [],
        registrations: emptyRegistrations(),
        commands: [],
        guardedChords: [],
      });
      const resolvedEncoded = yield* S.encodeEffect(ResolvedEditorProfile)(resolved);
      const resolvedRoundTrip = yield* S.decodeEffect(ResolvedEditorProfile)(resolvedEncoded);
      expect(Equal.equals(resolved, resolvedRoundTrip)).toBe(true);
    })
  );

  it.effect(
    "parses the atlas chord vocabulary and rejects malformed strings",
    Effect.fnUntraced(function* () {
      const vocabulary = ["Ctrl+Alt+1", "Cmd+Option+1", "Control+Shift+Q", "Ctrl+\\", "Cmd+.", "Win+Shift+X"];
      for (const chord of vocabulary) {
        const parsed = yield* S.decodeEffect(KeyChordFromString)(chord);
        expect(parsed.key).not.toBe("");
      }

      for (const malformed of ["", "Ctrl+", "Hyper+K", "Ctrl+Hyper+K"]) {
        const exit = yield* Effect.exit(S.decodeEffect(KeyChordFromString)(malformed));
        expect(Exit.isFailure(exit)).toBe(true);
      }
    })
  );

  it.effect(
    "rejects duplicate catalog ids, command ids, and registration keys",
    Effect.fnUntraced(function* () {
      const duplicateIds = yield* Effect.exit(
        S.decodeEffect(CapabilityCatalog)([
          descriptor("node.one", "command.one"),
          descriptor("node.one", "command.two"),
        ])
      );
      expect(Exit.isFailure(duplicateIds)).toBe(true);

      const duplicateCommands = yield* Effect.exit(
        S.decodeEffect(CapabilityCatalog)([
          descriptor("node.one", "command.same"),
          descriptor("node.two", "command.same"),
        ])
      );
      expect(Exit.isFailure(duplicateCommands)).toBe(true);

      const duplicateRegistrations = yield* Effect.exit(
        S.decodeEffect(CapabilityCatalog)([
          descriptor("node.one", "command.one", ["TextNode"]),
          descriptor("node.two", "command.two", ["TextNode"]),
        ])
      );
      expect(Exit.isFailure(duplicateRegistrations)).toBe(true);

      const valid = yield* S.decodeEffect(CapabilityCatalog)([
        descriptor("node.one", "command.one", ["TextNode"]),
        descriptor("node.two", "command.two", ["TabNode"]),
      ]);
      expect(A.length(valid)).toBe(2);
      expect(valid[0]?.id).toBe(CapabilityId.make("node.one"));
      expect(valid[0]?.commands[0]?.id).toBe(CommandId.make("command.one"));
      expect(CommandDefinition.make).toBeDefined();
      expect(CapabilityDescriptor.make).toBeDefined();
    })
  );
});
