import * as B from "@beep/box";
import {
  BoxAdoptions,
  BoxDesiredState,
  BoxObservedCollaboration,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
  BoxSourceRevision,
  planBoxProvisioning,
} from "@beep/box-provisioning";
import { BoxProvisioningApplier } from "@beep/box-provisioning/BoxProvisioningApplier";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { desiredFixture, observedAfterApplyFixture, observedFixture, postApplyAdoptionsFixture } from "./fixtures.ts";

const mutationCounts = {
  collaborations: 0,
  folders: 0,
  webhooks: 0,
};

const mutationClient = {
  folders: {
    createFolder: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
      mutationCounts.folders += 1;
      return Promise.resolve({
        etag: "etag-created-child",
        id: "created-folder-id",
        name: "Fixture child",
        parent: { id: "100", type: "folder" },
        type: "folder",
      });
    },
    getFolderById: (folderId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve(
        folderId === "created-folder-id"
          ? {
              etag: "etag-created-child",
              id: "created-folder-id",
              name: "Fixture child",
              parent: { id: "100", type: "folder" },
              type: "folder",
            }
          : {
              etag: "etag-workspace",
              id: "100",
              name: "Fixture workspace",
              parent: { id: "0", type: "folder" },
              type: "folder",
            }
      ),
    getFolderItems: (_folderId: string, _optionalsInput: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
  listCollaborations: {
    getFolderCollaborations: (_folderId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve({ entries: [] }),
  },
  userCollaborations: {
    createCollaboration: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
      mutationCounts.collaborations += 1;
      return Promise.resolve({ id: "created-collaboration-id", type: "collaboration" });
    },
  },
  webhooks: {
    createWebhook: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
      mutationCounts.webhooks += 1;
      return Promise.resolve({ id: "created-webhook-id" });
    },
    getWebhooks: (_queryParams: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
};

const ApplierTestLayer = BoxProvisioningApplier.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(mutationClient)));

const updateCounts = { collaborations: 0, webhooks: 0 };

const observedFolderPayload = (folderId: string) =>
  folderId === "100"
    ? {
        etag: "etag-workspace",
        id: "100",
        name: "Fixture workspace",
        parent: { id: "0", type: "folder" },
        type: "folder",
      }
    : { etag: "etag-child", id: "101", name: "Fixture child", parent: { id: "100", type: "folder" }, type: "folder" };

const updateClient = {
  folders: {
    getFolderById: (folderId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve(observedFolderPayload(folderId)),
    getFolderItems: (_folderId: string, _optionalsInput: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
  },
  userCollaborations: {
    getCollaborationById: (_collaborationId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve({
        accessibleBy: { id: "user-id", login: "collaborator@example.test", type: "user" },
        id: "200",
        item: { id: "101", type: "folder" },
        role: "viewer",
        type: "collaboration",
      }),
    updateCollaborationById: (_collaborationId: string, _optionalsInput: unknown): Promise<unknown> => {
      updateCounts.collaborations += 1;
      return Promise.resolve({
        accessibleBy: { id: "user-id", login: "collaborator@example.test", type: "user" },
        id: "200",
        item: { id: "101", type: "folder" },
        role: "editor",
        type: "collaboration",
      });
    },
  },
  webhooks: {
    getWebhookById: (_webhookId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve({
        address: "https://example.test/box/events",
        id: "300",
        target: { id: "100", type: "folder" },
        triggers: ["FILE.DOWNLOADED"],
        type: "webhook",
      }),
    updateWebhookById: (_webhookId: string, _optionalsInput: unknown): Promise<unknown> => {
      updateCounts.webhooks += 1;
      return Promise.resolve({
        address: "https://example.test/box/events",
        id: "300",
        target: { id: "100", type: "folder" },
        triggers: ["FILE.UPLOADED"],
        type: "webhook",
      });
    },
  },
};

const UpdateApplierTestLayer = BoxProvisioningApplier.layer.pipe(
  Layer.provide(B.Box.makeLayerFromClient(updateClient))
);

layer(BunCrypto.layer)("@beep/box-provisioning applier", (it) => {
  it.effect(
    "applies planned collaboration and webhook updates",
    Effect.fnUntraced(function* () {
      updateCounts.collaborations = 0;
      updateCounts.webhooks = 0;
      const drifted = BoxObservedState.make({
        ...observedAfterApplyFixture,
        collaborations: A.map(observedAfterApplyFixture.collaborations, (collaboration) =>
          BoxObservedCollaboration.make({
            ...collaboration,
            principalProviderId: O.some(BoxProviderId.make("user-id")),
            role: "viewer",
          })
        ),
        webhooks: A.map(observedAfterApplyFixture.webhooks, (webhook) =>
          BoxObservedWebhook.make({ ...webhook, triggers: ["FILE.DOWNLOADED"] })
        ),
      });
      const plan = yield* planBoxProvisioning(desiredFixture, drifted, postApplyAdoptionsFixture);

      const receipt = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
        provideScopedLayer(UpdateApplierTestLayer)
      );

      expect(updateCounts).toEqual({ collaborations: 1, webhooks: 1 });
      expect(A.map(receipt.outcomes, (outcome) => outcome._tag)).toEqual([
        "Skipped",
        "Skipped",
        "Applied",
        "Applied",
        "Blocked",
        "Blocked",
      ]);
    })
  );

  it.effect(
    "performs zero dependent mutations for an unallowlisted exact-name collision",
    Effect.fnUntraced(function* () {
      mutationCounts.collaborations = 0;
      mutationCounts.folders = 0;
      mutationCounts.webhooks = 0;
      const desired = BoxDesiredState.make({
        ...desiredFixture,
        adoptions: BoxAdoptions.make({ entries: [] }),
      });
      const plan = yield* planBoxProvisioning(desired, observedFixture);

      const error = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desired, plan)),
        Effect.flip,
        provideScopedLayer(ApplierTestLayer)
      );

      expect(error._tag).toBe("BoxProvisioningBlockerContractError");
      expect(mutationCounts).toEqual({ collaborations: 0, folders: 0, webhooks: 0 });
    })
  );

  it.effect(
    "executes only planned v1 mutations and records blocked actions",
    Effect.fnUntraced(function* () {
      mutationCounts.collaborations = 0;
      mutationCounts.folders = 0;
      mutationCounts.webhooks = 0;
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const receipt = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
        provideScopedLayer(ApplierTestLayer)
      );

      expect(mutationCounts).toEqual({ collaborations: 1, folders: 1, webhooks: 1 });
      expect(A.map(receipt.outcomes, (outcome) => outcome._tag)).toEqual([
        "Skipped",
        "Applied",
        "Applied",
        "Applied",
        "Blocked",
        "Blocked",
      ]);
      expect(receipt.planDigest).toBe(plan.planDigest);
    })
  );

  it.effect(
    "rejects a desired payload other than the one bound into the plan",
    Effect.fnUntraced(function* () {
      mutationCounts.collaborations = 0;
      mutationCounts.folders = 0;
      mutationCounts.webhooks = 0;
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const changedDesired = BoxDesiredState.make({
        ...desiredFixture,
        sourceRevision: BoxSourceRevision.make("different-intent"),
      });

      const error = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(changedDesired, plan)),
        Effect.flip,
        provideScopedLayer(ApplierTestLayer)
      );

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("desired-state-digest-mismatch");
      }
      expect(mutationCounts).toEqual({ collaborations: 0, folders: 0, webhooks: 0 });
    })
  );

  it.effect(
    "rejects live drift immediately before dispatch",
    Effect.fnUntraced(function* () {
      mutationCounts.collaborations = 0;
      mutationCounts.folders = 0;
      mutationCounts.webhooks = 0;
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const driftClient = {
        ...mutationClient,
        folders: {
          ...mutationClient.folders,
          getFolderById: (_folderId: string, _optionalsInput: unknown): Promise<unknown> =>
            Promise.resolve({
              etag: "changed-etag",
              id: "100",
              name: "Fixture workspace",
              parent: { id: "0", type: "folder" },
              type: "folder",
            }),
        },
      };
      const DriftLayer = BoxProvisioningApplier.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(driftClient)));

      const error = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
        Effect.flip,
        provideScopedLayer(DriftLayer)
      );

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("action-precondition-mismatch");
      }
      expect(mutationCounts).toEqual({ collaborations: 0, folders: 0, webhooks: 0 });
    })
  );

  it.effect(
    "rejects a case-equivalent just-in-time folder collision before create",
    Effect.fnUntraced(function* () {
      const collisionMutationCounts = { collaborations: 0, folders: 0, webhooks: 0 };
      const plan = yield* planBoxProvisioning(desiredFixture, observedFixture);
      const collisionClient = {
        ...mutationClient,
        folders: {
          ...mutationClient.folders,
          createFolder: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            collisionMutationCounts.folders += 1;
            return Promise.resolve({ id: "created-folder-id", type: "folder" });
          },
          getFolderItems: (folderId: string, _optionalsInput: unknown): Promise<unknown> =>
            Promise.resolve(
              folderId === "100"
                ? { entries: [{ id: "existing-child", name: "fixture CHILD ", type: "folder" }] }
                : { entries: [] }
            ),
        },
        userCollaborations: {
          createCollaboration: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            collisionMutationCounts.collaborations += 1;
            return Promise.resolve({ id: "created-collaboration-id", type: "collaboration" });
          },
        },
        webhooks: {
          ...mutationClient.webhooks,
          createWebhook: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            collisionMutationCounts.webhooks += 1;
            return Promise.resolve({ id: "created-webhook-id" });
          },
        },
      };
      const CollisionLayer = BoxProvisioningApplier.layer.pipe(
        Layer.provide(B.Box.makeLayerFromClient(collisionClient))
      );

      const error = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
        Effect.flip,
        provideScopedLayer(CollisionLayer)
      );

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("action-precondition-mismatch");
      }
      expect(collisionMutationCounts).toEqual({ collaborations: 0, folders: 0, webhooks: 0 });
    })
  );

  it.effect(
    "aborts a child POST when a newly created parent is renamed after its own action",
    Effect.fnUntraced(function* () {
      let parentReadCount = 0;
      let folderPosts = 0;
      const emptyObserved = BoxObservedState.make({ ...observedFixture, folders: [] });
      const plan = yield* planBoxProvisioning(desiredFixture, emptyObserved);
      const parentDriftClient = {
        ...mutationClient,
        folders: {
          ...mutationClient.folders,
          createFolder: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            folderPosts += 1;
            return Promise.resolve(
              folderPosts === 1
                ? {
                    etag: "etag-created-parent",
                    id: "created-parent-id",
                    name: "Fixture workspace",
                    parent: { id: "0", type: "folder" },
                    type: "folder",
                  }
                : {
                    etag: "etag-created-child",
                    id: "created-child-id",
                    name: "Fixture child",
                    parent: { id: "created-parent-id", type: "folder" },
                    type: "folder",
                  }
            );
          },
          getFolderById: (folderId: string, _optionalsInput: unknown): Promise<unknown> => {
            parentReadCount += 1;
            return Promise.resolve({
              etag: "etag-created-parent",
              id: folderId,
              name: "Renamed workspace",
              parent: { id: "0", type: "folder" },
              type: "folder",
            });
          },
        },
      };
      const ParentDriftLayer = BoxProvisioningApplier.layer.pipe(
        Layer.provide(B.Box.makeLayerFromClient(parentDriftClient))
      );

      const error = yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
        Effect.flip,
        provideScopedLayer(ParentDriftLayer)
      );

      expect(error._tag).toBe("BoxProvisioningInvariantError");
      if (error._tag === "BoxProvisioningInvariantError") {
        expect(error.code).toBe("action-precondition-mismatch");
      }
      expect(parentReadCount).toBe(1);
      expect(folderPosts).toBe(1);
    })
  );

  it.effect(
    "allows dependent child and collaboration POSTs when only parent etags change",
    Effect.fnUntraced(function* () {
      const etagMutationCounts = { collaborations: 0, folders: 0, webhooks: 0 };
      const emptyObserved = BoxObservedState.make({ ...observedFixture, folders: [] });
      const plan = yield* planBoxProvisioning(desiredFixture, emptyObserved);
      const etagOnlyClient = {
        ...mutationClient,
        folders: {
          ...mutationClient.folders,
          createFolder: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            etagMutationCounts.folders += 1;
            return Promise.resolve(
              etagMutationCounts.folders === 1
                ? {
                    etag: "etag-created-parent",
                    id: "created-parent-id",
                    name: "Fixture workspace",
                    parent: { id: "0", type: "folder" },
                    type: "folder",
                  }
                : {
                    etag: "etag-created-child",
                    id: "created-child-id",
                    name: "Fixture child",
                    parent: { id: "created-parent-id", type: "folder" },
                    type: "folder",
                  }
            );
          },
          getFolderById: (folderId: string, _optionalsInput: unknown): Promise<unknown> =>
            Promise.resolve(
              folderId === "created-parent-id"
                ? {
                    etag: "etag-parent-after-dependent-write",
                    id: folderId,
                    name: "Fixture workspace",
                    parent: { id: "0", type: "folder" },
                    type: "folder",
                  }
                : {
                    etag: "etag-child-after-dependent-write",
                    id: folderId,
                    name: "Fixture child",
                    parent: { id: "created-parent-id", type: "folder" },
                    type: "folder",
                  }
            ),
        },
        userCollaborations: {
          createCollaboration: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            etagMutationCounts.collaborations += 1;
            return Promise.resolve({ id: "created-collaboration-id", type: "collaboration" });
          },
        },
        webhooks: {
          ...mutationClient.webhooks,
          createWebhook: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
            etagMutationCounts.webhooks += 1;
            return Promise.resolve({ id: "created-webhook-id" });
          },
        },
      };
      const EtagOnlyLayer = BoxProvisioningApplier.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(etagOnlyClient)));

      yield* BoxProvisioningApplier.pipe(
        Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
        provideScopedLayer(EtagOnlyLayer)
      );

      expect(etagMutationCounts).toEqual({ collaborations: 1, folders: 2, webhooks: 1 });
    })
  );
});
