import * as B from "@beep/box";
import { BoxAdoptions, BoxDesiredState, recoverBoxAdoptions } from "@beep/box-provisioning";
import { BoxProvisioningApplier, BoxProvisioningApplyJournal } from "@beep/box-provisioning/BoxProvisioningApplier";
import { BoxObservedState } from "@beep/box-provisioning/BoxProvisioningObserved";
import { planBoxProvisioning } from "@beep/box-provisioning/BoxProvisioningPlanner";
import { provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { desiredFixture, observedFixture } from "./fixtures.ts";
import type { BoxApplyJournalEntry } from "@beep/box-provisioning/BoxProvisioningReceipt";

const emptyObserved = BoxObservedState.make({
  ...observedFixture,
  collaborations: [],
  folders: [],
  webhooks: [],
});

const makeMutationClient = (failFolderAt: number | undefined, rejectCollaboration: boolean) => {
  let folderCreateCount = 0;
  return {
    folders: {
      createFolder: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> => {
        folderCreateCount += 1;
        return folderCreateCount === failFolderAt
          ? Promise.reject({ responseInfo: { code: "folder_create_failed", statusCode: 500 } })
          : Promise.resolve({
              etag: `etag-created-folder-${folderCreateCount}`,
              id: `created-folder-${folderCreateCount}`,
              name: folderCreateCount === 1 ? "Fixture workspace" : "Fixture child",
              parent: { id: folderCreateCount === 1 ? "0" : "created-folder-1", type: "folder" },
              type: "folder",
            });
      },
      getFolderById: (folderId: string, _optionalsInput: unknown): Promise<unknown> =>
        Promise.resolve({
          etag: folderId === "created-folder-1" ? "etag-created-folder-1" : "etag-created-folder-2",
          id: folderId,
          name: folderId === "created-folder-1" ? "Fixture workspace" : "Fixture child",
          parent: { id: folderId === "created-folder-1" ? "0" : "created-folder-1", type: "folder" },
          type: "folder",
        }),
      getFolderItems: (_folderId: string, _optionalsInput: unknown): Promise<unknown> =>
        Promise.resolve({ entries: [] }),
    },
    listCollaborations: {
      getFolderCollaborations: (_folderId: string, _optionalsInput: unknown): Promise<unknown> =>
        Promise.resolve({ entries: [] }),
    },
    userCollaborations: {
      createCollaboration: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> =>
        rejectCollaboration
          ? Promise.reject({ responseInfo: { code: "user_already_collaborator", statusCode: 400 } })
          : Promise.resolve({ id: "created-collaboration", type: "collaboration" }),
    },
    webhooks: {
      createWebhook: (_requestBody: unknown, _optionalsInput: unknown): Promise<unknown> =>
        Promise.resolve({ id: "created-webhook" }),
      getWebhooks: (_queryParams: unknown): Promise<unknown> => Promise.resolve({ entries: [] }),
    },
  };
};

const applyWithJournal = Effect.fn("BoxProvisioningApplyJournalTest.applyWithJournal")(function* (
  failFolderAt: number | undefined,
  rejectCollaboration: boolean
) {
  const entries = yield* Ref.make<ReadonlyArray<BoxApplyJournalEntry>>(A.empty());
  const journal = BoxProvisioningApplyJournal.of({
    append: Effect.fn("BoxProvisioningApplyJournalTest.append")((entry) => Ref.update(entries, A.append(entry))),
  });
  const plan = yield* planBoxProvisioning(desiredFixture, emptyObserved);
  const layer = BoxProvisioningApplier.layerWithJournal.pipe(
    Layer.provide(
      Layer.mergeAll(
        B.Box.makeLayerFromClient(makeMutationClient(failFolderAt, rejectCollaboration)),
        Layer.succeed(BoxProvisioningApplyJournal, journal)
      )
    )
  );
  const error = yield* BoxProvisioningApplier.pipe(
    Effect.flatMap((applier) => applier.apply(desiredFixture, plan)),
    Effect.flip,
    provideScopedLayer(layer)
  );
  return { entries: yield* Ref.get(entries), error, plan };
});

describe("@beep/box-provisioning apply journal", () => {
  it.effect(
    "retains every prior Applied entry and the failed folder when folder N fails",
    Effect.fnUntraced(function* () {
      const result = yield* applyWithJournal(2, false);

      expect(result.error._tag).toBe("BoxError");
      expect(A.map(result.entries, (entry) => entry.phase)).toEqual(["Started", "Applied", "Started", "Failed"]);
      expect(A.map(result.entries, (entry) => entry.sequence)).toEqual([0, 1, 2, 3]);
      expect(A.every(result.entries, (entry) => entry.planDigest === result.plan.planDigest)).toBe(true);
      expect(A.every(result.entries, (entry) => entry.attemptId === result.entries[0]?.attemptId)).toBe(true);
      expect(result.entries[1]?.resourceKind).toBe("folder");
      expect(result.entries[3]?.resourceKind).toBe("folder");
      const applied = result.entries[1];
      expect(applied?.phase).toBe("Applied");
      if (applied?.phase === "Applied") {
        expect(O.getOrUndefined(applied.parentProviderId)).toBe("0");
      }
    })
  );

  it.effect(
    "retains applied folders and the failed collaboration after collaboration rejection",
    Effect.fnUntraced(function* () {
      const result = yield* applyWithJournal(undefined, true);

      expect(result.error._tag).toBe("BoxError");
      expect(A.map(result.entries, (entry) => entry.phase)).toEqual([
        "Started",
        "Applied",
        "Started",
        "Applied",
        "Started",
        "Failed",
      ]);
      expect(A.filter(result.entries, (entry) => entry.phase === "Applied")).toHaveLength(2);
      expect(result.entries[5]?.resourceKind).toBe("collaboration");
    })
  );

  it.effect(
    "generates a distinct attempt id for each apply invocation",
    Effect.fnUntraced(function* () {
      const first = yield* applyWithJournal(2, false);
      const second = yield* applyWithJournal(2, false);

      expect(first.entries[0]?.attemptId).not.toBe(second.entries[0]?.attemptId);
    })
  );

  it.effect(
    "recovers exactly the folders applied before folder N fails",
    Effect.fnUntraced(function* () {
      const result = yield* applyWithJournal(2, false);
      const recovered = recoverBoxAdoptions(desiredFixture, result.entries);

      expect(recovered.entries).toHaveLength(1);
      expect(recovered.entries[0]?.expectedProviderId).toBe("created-folder-1");
      expect(recovered.entries[0]?.expectedParentProviderId).toBe("0");
    })
  );

  it.effect(
    "uses only the latest attempt for one plan during recovery",
    Effect.fnUntraced(function* () {
      const first = yield* applyWithJournal(2, false);
      const latest = yield* applyWithJournal(1, false);
      const desiredWithoutAdoptions = BoxDesiredState.make({
        ...desiredFixture,
        adoptions: BoxAdoptions.make({ entries: [] }),
      });
      const recovered = recoverBoxAdoptions(desiredWithoutAdoptions, A.appendAll(first.entries, latest.entries));

      expect(recovered.entries).toHaveLength(0);
    })
  );
});
