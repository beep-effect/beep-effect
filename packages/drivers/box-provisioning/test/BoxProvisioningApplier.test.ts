import * as B from "@beep/box";
import { BoxDesiredState, BoxProvisioningApplier, planBoxProvisioning } from "@beep/box-provisioning";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import { desiredFixture, observedFixture } from "./fixtures.ts";

const mutationCounts = {
  collaborations: 0,
  folders: 0,
  webhooks: 0,
};

const mutationClient = {
  folders: {
    createFolder: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
      mutationCounts.folders += 1;
      return Promise.resolve({ id: "created-folder-id", type: "folder" });
    },
    getFolderById: (_folderId: string, _optionalsInput: unknown): Promise<unknown> =>
      Promise.resolve({
        etag: "etag-workspace",
        id: "100",
        name: "Fixture workspace",
        parent: { id: "0", type: "folder" },
        type: "folder",
      }),
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

describe("@beep/box-provisioning applier", () => {
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
      const changedDesired = BoxDesiredState.make({ ...desiredFixture, sourceRevision: "different-intent" });

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
});
