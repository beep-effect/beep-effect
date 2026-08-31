import {
  BoxDesiredState,
  BoxObservedState,
  BoxProviderId,
  BoxProvisioningPlan,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { desiredFixture, observedFixture } from "./fixtures.ts";

describe("@beep/box-provisioning planner", () => {
  it.effect(
    "emits a deterministic redacted plan with foreign and entitlement evidence",
    Effect.fnUntraced(function* () {
      const first = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const second = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const text = yield* S.encodeEffect(S.fromJsonString(BoxProvisioningPlan))(first);

      expect(Equal.equals(first, second)).toBe(true);
      expect(first.planDigest).toBe(second.planDigest);
      expect(first.blockerCount).toBe(2);
      expect(first.destructiveCount).toBe(0);
      expect(first.externalCollaboratorCount).toBe(1);
      expect(first.foreignResources).toHaveLength(1);
      expect(A.map(first.actions, (action) => action._tag)).toEqual([
        "Noop",
        "Create",
        "Create",
        "Create",
        "Blocked",
        "Blocked",
      ]);
      expect(text).not.toContain("Fixture workspace");
      expect(text).not.toContain("Fixture child");
      expect(text).not.toContain("collaborator@example.test");
      expect(text).not.toContain("https://example.test/box/events");
    })
  );

  it("rejects cycles before inventory or planning", () => {
    const decoded = S.decodeOption(BoxDesiredState)({
      version: "box-provisioning/v1",
      sourceRevision: "intent-cycle",
      expectedEnterpriseId: "enterprise-id",
      expectedSubjectId: "service-account-id",
      rootFolderId: "0",
      entitlements: {
        externalCollaboratorsRequirePaidSeats: true,
        metadata: "unavailable",
        planName: "Business",
        retention: "unavailable",
      },
      folders: [
        { logicalKey: "folder.a", parentKey: "folder.b", name: "A" },
        { logicalKey: "folder.b", parentKey: "folder.a", name: "B" },
      ],
      collaborations: [],
      webhooks: [],
      metadata: [],
      retention: [],
    });

    expect(O.isNone(decoded)).toBe(true);
  });

  it.effect(
    "rejects an authenticated subject other than the pinned service identity",
    Effect.fnUntraced(function* () {
      const error = yield* planBoxProvisioning(
        desiredFixture,
        BoxObservedState.make({
          ...observedFixture,
          subjectId: BoxProviderId.make("wrong-user-id"),
        })
      ).pipe(Effect.flip);

      expect(error._tag).toBe("BoxProvisioningSubjectMismatchError");
    })
  );
});
