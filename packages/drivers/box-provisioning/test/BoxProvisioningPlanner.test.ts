import {
  BoxCollaborationIntent,
  BoxDesiredState,
  BoxDiscoveryPermissionBlocked,
  BoxFolderIntent,
  BoxLogicalKey,
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
  BoxProvisioningPlan,
  BoxWebhookIntent,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import { HttpsUrl } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { desiredFixture, observedFixture } from "./fixtures.ts";

describe("@beep/box-provisioning planner", () => {
  it("round-trips schema-derived observed folders", () => {
    const decode = S.decodeUnknownSync(BoxObservedFolder);
    const encode = S.encodeSync(BoxObservedFolder);
    const equivalent = S.toEquivalence(BoxObservedFolder);

    fc.assert(
      fc.property(S.toArbitrary(BoxObservedFolder)(fc), (folder) => {
        expect(equivalent(decode(encode(folder)), folder)).toBe(true);
      }),
      fcRuns(10)
    );
  });

  it.effect(
    "emits a deterministic redacted plan with foreign and capability evidence",
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

  it("rejects duplicate provider natural keys before inventory or planning", () => {
    const encoded = S.encodeSync(BoxDesiredState)(desiredFixture);
    const folders = O.getOrElse(O.fromUndefinedOr(encoded.folders), A.empty);
    const collaborations = O.getOrElse(O.fromUndefinedOr(encoded.collaborations), A.empty);
    const webhooks = O.getOrElse(O.fromUndefinedOr(encoded.webhooks), A.empty);
    const duplicateFolder = {
      ...O.getOrThrow(A.head(folders)),
      logicalKey: "folder.duplicate",
    };
    const duplicateCollaboration = {
      ...O.getOrThrow(A.head(collaborations)),
      logicalKey: "collaboration.duplicate",
    };
    const duplicateWebhook = {
      ...O.getOrThrow(A.head(webhooks)),
      logicalKey: "webhook.duplicate",
    };

    expect(O.isNone(S.decodeOption(BoxDesiredState)({ ...encoded, folders: [...folders, duplicateFolder] }))).toBe(
      true
    );
    expect(
      O.isNone(
        S.decodeOption(BoxDesiredState)({
          ...encoded,
          collaborations: [...collaborations, duplicateCollaboration],
        })
      )
    ).toBe(true);
    expect(O.isNone(S.decodeOption(BoxDesiredState)({ ...encoded, webhooks: [...webhooks, duplicateWebhook] }))).toBe(
      true
    );
  });

  it.effect(
    "reports unmatched collaborations and webhooks as foreign resources",
    Effect.fnUntraced(function* () {
      const foreignObserved = BoxObservedState.make({
        ...observedFixture,
        collaborations: [
          BoxObservedCollaboration.make({
            folderProviderId: BoxProviderId.make("100"),
            principal: "foreign@example.test",
            principalProviderId: O.some(BoxProviderId.make("foreign-user-id")),
            principalType: "user",
            providerId: BoxProviderId.make("foreign-collaboration-id"),
            role: "viewer",
          }),
        ],
        webhooks: [
          BoxObservedWebhook.make({
            address: HttpsUrl.make("https://example.test/box/foreign"),
            providerId: BoxProviderId.make("foreign-webhook-id"),
            targetProviderId: BoxProviderId.make("100"),
            triggers: ["FILE.DOWNLOADED"],
          }),
        ],
      });

      const plan = yield* planBoxProvisioning(desiredFixture, foreignObserved);

      expect(A.map(plan.foreignResources, (resource) => resource.resourceKind)).toEqual([
        "folder",
        "collaboration",
        "webhook",
      ]);
    })
  );

  it.effect(
    "matches a collaboration by provider id while retaining its login",
    Effect.fnUntraced(function* () {
      const collaboration = O.getOrThrow(A.head(desiredFixture.collaborations));
      const desiredByProviderId = BoxDesiredState.make({
        ...desiredFixture,
        collaborations: [BoxCollaborationIntent.make({ ...collaboration, principal: "user-id" })],
      });
      const observed = BoxObservedState.make({
        ...observedFixture,
        folders: [
          ...observedFixture.folders,
          BoxObservedFolder.make({
            etag: O.none(),
            name: "Fixture child",
            parentProviderId: O.some(BoxProviderId.make("100")),
            providerId: BoxProviderId.make("101"),
          }),
        ],
        collaborations: [
          BoxObservedCollaboration.make({
            folderProviderId: BoxProviderId.make("101"),
            principal: "user@example.test",
            principalProviderId: O.some(BoxProviderId.make("user-id")),
            principalType: "user",
            providerId: BoxProviderId.make("collaboration-id"),
            role: "editor",
          }),
        ],
      });

      const plan = yield* planBoxProvisioning(desiredByProviderId, observed);
      const collaborationAction = A.findFirst(plan.actions, (action) => action.resourceKind === "collaboration");

      expect(O.map(collaborationAction, (action) => action._tag)).toEqual(O.some("Noop"));
      expect(A.some(plan.foreignResources, (resource) => resource.resourceKind === "collaboration")).toBe(false);
    })
  );

  it.effect(
    "surfaces permission-blocked discovery separately from entitlement blockers",
    Effect.fnUntraced(function* () {
      const plan = yield* planBoxProvisioning(
        desiredFixture,
        BoxObservedState.make({
          ...observedFixture,
          metadata: BoxDiscoveryPermissionBlocked.make({
            code: O.some("insufficient_scope"),
            kind: "metadata",
            status: 403,
          }),
        })
      );
      const metadataAction = A.findFirst(plan.actions, (action) => action.resourceKind === "metadata");

      expect(O.isSome(metadataAction)).toBe(true);
      if (O.isSome(metadataAction) && metadataAction.value._tag === "Blocked") {
        expect(metadataAction.value.reason._tag).toBe("BlockedByPolicy");
        if (metadataAction.value.reason._tag === "BlockedByPolicy") {
          expect(metadataAction.value.reason.policy).toBe("metadata-discovery-permission-denied");
        }
      }
    })
  );

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
