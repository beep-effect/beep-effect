import * as B from "@beep/box";
import { BoxProvisioningApplier, planBoxProvisioning } from "@beep/box-provisioning";
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
  },
};

const ApplierTestLayer = BoxProvisioningApplier.layer.pipe(Layer.provide(B.Box.makeLayerFromClient(mutationClient)));

describe("@beep/box-provisioning applier", () => {
  it.effect(
    "executes only planned v1 mutations and records blocked actions",
    Effect.fnUntraced(function* () {
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
});
