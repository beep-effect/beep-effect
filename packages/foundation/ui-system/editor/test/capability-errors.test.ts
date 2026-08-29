import {
  CapabilityConflictError,
  DependencyCycleError,
  DevelopmentOnlyCapabilityError,
  IncompatibleRegistrationError,
  KeybindingConflictError,
  MissingDependencyError,
  UnknownCapabilityError,
  UnknownCommandError,
} from "@beep/editor/capability/errors";
import { CapabilityId, CommandId, KeyChord, ProfileId } from "@beep/editor/capability/schemas";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";

const profileId = ProfileId.make("test.profile");
const capabilityId = CapabilityId.make("format.bold");
const dependencyId = CapabilityId.make("extension.history");
const commandId = CommandId.make("format.bold");

describe("capability resolution error messages", () => {
  it.effect(
    "every typed error names the identifiers a host needs to act on",
    Effect.fnUntraced(function* () {
      const errors = [
        UnknownCapabilityError.make({ profileId, capabilityId }),
        MissingDependencyError.make({ profileId, capabilityId, dependencyId }),
        DependencyCycleError.make({ profileId, cycle: [capabilityId, dependencyId, capabilityId] }),
        CapabilityConflictError.make({ profileId, capabilityId, conflictsWith: dependencyId }),
        DevelopmentOnlyCapabilityError.make({ profileId, capabilityId }),
        IncompatibleRegistrationError.make({
          profileId,
          capabilityId,
          registration: "CheckListPlugin",
          reason: "CheckListPlugin requires ListPlugin",
        }),
        UnknownCommandError.make({ profileId, commandId }),
        KeybindingConflictError.make({
          profileId,
          platform: "windows-linux",
          chord: KeyChord.make({ modifiers: ["control"], key: "b" }),
          commandIds: [commandId, CommandId.make("format.italic")],
        }),
      ];
      A.forEach(errors, (error) => {
        expect(error.message.length).toBeGreaterThan(20);
      });
      expect(
        IncompatibleRegistrationError.make({
          profileId,
          capabilityId,
          registration: "CheckListPlugin",
          reason: "CheckListPlugin requires ListPlugin",
        }).message
      ).toContain("CheckListPlugin");
      expect(UnknownCapabilityError.make({ profileId, capabilityId }).message).toContain(capabilityId);
      expect(MissingDependencyError.make({ profileId, capabilityId, dependencyId }).message).toContain(dependencyId);
      expect(UnknownCommandError.make({ profileId, commandId }).message).toContain(commandId);
      expect(
        KeybindingConflictError.make({
          profileId,
          platform: "apple",
          chord: KeyChord.make({ modifiers: ["meta"], key: "b" }),
          commandIds: [commandId],
        }).message
      ).toContain("format.bold");
      yield* Effect.void;
    })
  );
});
