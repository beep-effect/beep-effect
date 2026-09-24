/**
 * Driver-failure proof for the Drizzle vault-sync repository adapters.
 *
 * The durable-row proof under `test/integration` shows what these adapters do
 * once the migration bundle has been applied. This one shows what they do when
 * the driver refuses: the PGlite database is deliberately left unmigrated, so
 * every statement comes back as `relation does not exist`, and each adapter
 * must redact that driver failure into its own `…RepositoryUnavailable` rather
 * than leak the raw cause to the sync engine.
 */

import { RemoteItemId, VaultRelPath } from "@beep/documents-domain/values/Sync";
import { makeDrizzleSyncConflictRepository } from "@beep/documents-server/entities/SyncConflict";
import { makeDrizzleSyncCursorRepository } from "@beep/documents-server/entities/SyncCursor";
import { makeDrizzleSyncItemRepository } from "@beep/documents-server/entities/SyncItem";
import { SYNC_CURSOR_TABLE_NAME } from "@beep/documents-tables/entities/SyncCursor";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepositoryUnavailable,
  SyncConflictSeed,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import {
  FindSyncCursorInput,
  SyncCursorRepositoryUnavailable,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import {
  FindSyncItemByPathInput,
  FindSyncItemByRemoteIdInput,
  ListSyncItemsByWorkspaceInput,
  SyncItemRepositoryUnavailable,
  SyncItemSeed,
} from "@beep/documents-use-cases/entities/SyncItem/server";
import { makeDrizzleLayer } from "@beep/postgres";
import { NonNegativeInt } from "@beep/schema";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { makePgliteSqlTestLayer } from "@beep/test-utils";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const workspaceId = WorkspaceIdentity.WorkspaceId.make(2);
const remoteId = RemoteItemId.make("9001");
const conflictId = Documents.SyncConflictId.make(1);
const generationOne = NonNegativeInt.make(1);

const itemSeed = SyncItemSeed.make({
  itemKind: "file",
  localGeneration: generationOne,
  localRelPath: VaultRelPath.make("matters/client-default/zeta.pdf"),
  provider: "box",
  syncState: "pending",
  workspaceId,
});

const cursorSeed = SyncCursorSeed.make({
  provider: "box",
  status: "active",
  streamPosition: "now",
  workspaceId,
});

const conflictSeed = SyncConflictSeed.make({
  conflictKind: "remoteEdit",
  provider: "box",
  remoteEventId: O.some("evt-1"),
  remotePayload: { eventType: "ITEM_MODIFY" },
  resolutionStatus: "open",
  workspaceId,
});

const UnmigratedDrizzleLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteSqlTestLayer({ mode: "in-process" })))
);

// A failed statement leaves an implicit-transaction PGlite session in the
// aborted state, where the only legal next statement is the rollback that
// quiesces it, so every expected failure is followed by one.
const quiesce = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* Effect.ignore(sql.unsafe("ROLLBACK"));
});

describe("Documents sync repository driver failures", { concurrent: false }, () => {
  layer(UnmigratedDrizzleLayer, { timeout: "2 minutes" })((it) => {
    it.effect(
      "redacts every SyncItem statement to SyncItemRepositoryUnavailable",
      Effect.fnUntraced(function* () {
        const repository = yield* makeDrizzleSyncItemRepository();

        const created = yield* Effect.flip(repository.create(itemSeed));
        yield* quiesce();
        const byPath = yield* Effect.flip(
          repository.findByPath(
            FindSyncItemByPathInput.make({ localRelPath: itemSeed.localRelPath, provider: "box", workspaceId })
          )
        );
        yield* quiesce();
        const byRemoteId = yield* Effect.flip(
          repository.findByRemoteId(FindSyncItemByRemoteIdInput.make({ provider: "box", remoteId, workspaceId }))
        );
        yield* quiesce();
        const listed = yield* Effect.flip(
          repository.listByWorkspace(ListSyncItemsByWorkspaceInput.make({ provider: "box", workspaceId }))
        );
        yield* quiesce();

        expect(A.map([created, byPath, byRemoteId, listed], SyncItemRepositoryUnavailable.is)).toEqual([
          true,
          true,
          true,
          true,
        ]);
      })
    );

    it.effect(
      "redacts every SyncCursor statement to SyncCursorRepositoryUnavailable",
      Effect.fnUntraced(function* () {
        const repository = yield* makeDrizzleSyncCursorRepository();

        const found = yield* Effect.flip(repository.find(FindSyncCursorInput.make({ provider: "box", workspaceId })));
        yield* quiesce();
        const upserted = yield* Effect.flip(repository.upsert(cursorSeed));
        yield* quiesce();

        expect(A.map([found, upserted], SyncCursorRepositoryUnavailable.is)).toEqual([true, true]);
        expect(found.reason).toBe(`select SyncCursor failed against ${SYNC_CURSOR_TABLE_NAME}`);
      })
    );

    it.effect(
      "redacts every SyncConflict statement to SyncConflictRepositoryUnavailable",
      Effect.fnUntraced(function* () {
        const repository = yield* makeDrizzleSyncConflictRepository();

        const open = yield* Effect.flip(
          repository.listOpen(ListOpenSyncConflictsInput.make({ provider: "box", workspaceId }))
        );
        yield* quiesce();
        const reviewed = yield* Effect.flip(
          repository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId }))
        );
        yield* quiesce();
        const recorded = yield* Effect.flip(repository.record(conflictSeed));
        yield* quiesce();

        expect(A.map([open, reviewed, recorded], SyncConflictRepositoryUnavailable.is)).toEqual([true, true, true]);
      })
    );
  });
});
