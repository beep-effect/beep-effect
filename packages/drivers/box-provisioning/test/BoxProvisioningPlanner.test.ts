import {
  BoxDesiredState,
  BoxFolderIntent,
  BoxLogicalKey,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
  BoxProvisioningPlan,
  BoxWebhookIntent,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import { HttpsUrl } from "@beep/schema";
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

  it.effect(
    "treats resource and trigger ordering as semantically irrelevant",
    Effect.fnUntraced(function* () {
      const forwardWebhook = BoxWebhookIntent.make({
        address: HttpsUrl.make("https://example.test/box/events"),
        folderKey: BoxLogicalKey.make("folder.workspace"),
        logicalKey: BoxLogicalKey.make("webhook.workspace"),
        triggers: ["FILE.DOWNLOADED", "FILE.UPLOADED"],
      });
      const reverseWebhook = BoxWebhookIntent.make({
        ...forwardWebhook,
        triggers: ["FILE.UPLOADED", "FILE.DOWNLOADED"],
      });
      const siblingFolder = BoxFolderIntent.make({
        logicalKey: BoxLogicalKey.make("folder.sibling"),
        name: "Fixture sibling",
        parentKey: O.none(),
      });
      const forwardDesired = BoxDesiredState.make({
        ...desiredFixture,
        folders: A.append(desiredFixture.folders, siblingFolder),
        webhooks: [forwardWebhook],
      });
      const reversedDesired = BoxDesiredState.make({
        ...forwardDesired,
        folders: A.reverse(forwardDesired.folders),
        collaborations: A.reverse(forwardDesired.collaborations),
        webhooks: [reverseWebhook],
        metadata: A.reverse(forwardDesired.metadata),
        retention: A.reverse(forwardDesired.retention),
      });
      const forwardObservedWebhook = BoxObservedWebhook.make({
        address: HttpsUrl.make("https://example.test/box/events"),
        providerId: BoxProviderId.make("300"),
        targetProviderId: BoxProviderId.make("100"),
        triggers: ["FILE.DOWNLOADED", "FILE.UPLOADED"],
      });
      const reverseObservedWebhook = BoxObservedWebhook.make({
        ...forwardObservedWebhook,
        triggers: ["FILE.UPLOADED", "FILE.DOWNLOADED"],
      });
      const forwardObserved = BoxObservedState.make({
        ...observedFixture,
        webhooks: [forwardObservedWebhook],
      });
      const reversedObserved = BoxObservedState.make({
        ...forwardObserved,
        folders: A.reverse(observedFixture.folders),
        collaborations: A.reverse(observedFixture.collaborations),
        webhooks: [reverseObservedWebhook],
      });

      const forward = yield* planBoxProvisioning(forwardDesired, forwardObserved);
      const reversed = yield* planBoxProvisioning(reversedDesired, reversedObserved);

      expect(Equal.equals(forward, reversed)).toBe(true);
      expect(forward.desiredStateDigest).toBe(reversed.desiredStateDigest);
      expect(forward.liveStateDigest).toBe(reversed.liveStateDigest);
      expect(forward.planDigest).toBe(reversed.planDigest);
    })
  );

  it.effect(
    "plans an absent parent-child tree and its dependents as one creation chain",
    Effect.fnUntraced(function* () {
      const emptyObserved = BoxObservedState.make({
        ...observedFixture,
        folders: [],
        collaborations: [],
        webhooks: [],
      });

      const result = yield* planBoxProvisioning(desiredFixture, emptyObserved);

      expect(A.map(result.actions, (action) => action._tag)).toEqual([
        "Create",
        "Create",
        "Create",
        "Create",
        "Blocked",
        "Blocked",
      ]);
      expect(result.actions[1]?.dependencies).toEqual([result.actions[0]?.actionKey]);
      expect(result.actions[2]?.dependencies).toEqual([result.actions[1]?.actionKey]);
      expect(result.actions[3]?.dependencies).toEqual([result.actions[0]?.actionKey]);
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
