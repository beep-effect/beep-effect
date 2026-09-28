import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import {
  makeInMemorySyncConflictRepository,
  SyncConflictRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncConflict";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepository,
  SyncConflictRepositoryNotFound,
  SyncConflictSeed,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import * as Documents from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const workspaceId = WorkspaceIdentity.WorkspaceId.make(2);
const ghostConflictId = Documents.SyncConflictId.make(99);
const listOpenInput = ListOpenSyncConflictsInput.make({ provider: "box", workspaceId });

const conflictSeed = (remoteEventId: O.Option<string>) =>
  SyncConflictSeed.make({
    conflictKind: "remoteEdit",
    provider: "box",
    remoteEventId,
    remotePayload: { eventType: "ITEM_MODIFY" },
    resolutionStatus: "open",
    workspaceId,
  });
const encodeSyncConflictSeed = S.encodeResult(SyncConflictSeed);
const decodeSyncConflictSeed = S.decodeUnknownResult(SyncConflictSeed);
const equivalentSyncConflictSeed = S.toEquivalence(SyncConflictSeed);
const encodeSyncConflict = S.encodeResult(DomainSyncConflict.SyncConflict);
const decodeSyncConflict = S.decodeUnknownResult(DomainSyncConflict.SyncConflict);
const equivalentSyncConflict = S.toEquivalence(DomainSyncConflict.SyncConflict);

describe("SyncConflict server repository", () => {
  it.effect(
    "records remote drift and lists it while open",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncConflictRepository();
      const recorded = yield* repository.record(conflictSeed(O.some("evt-1")));

      expect(recorded.publicId).toBe("documents_sync_conflict_a1");
      expect(recorded.conflictKind).toBe("remoteEdit");

      const open = yield* repository.listOpen(listOpenInput);
      expect(A.map(open, (conflict) => conflict.id)).toEqual([recorded.id]);
    })
  );

  it.effect(
    "dedupes drift records by provider and remote event id",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncConflictRepository();
      const first = yield* repository.record(conflictSeed(O.some("evt-1")));
      const replay = yield* repository.record(conflictSeed(O.some("evt-1")));

      expect(replay.id).toBe(first.id);

      const open = yield* repository.listOpen(listOpenInput);
      expect(A.length(open)).toBe(1);
    })
  );

  it.effect(
    "records separate rows when the remote event id is absent",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncConflictRepository();
      const first = yield* repository.record(conflictSeed(O.none()));
      const second = yield* repository.record(conflictSeed(O.none()));

      expect(second.id).not.toBe(first.id);

      const open = yield* repository.listOpen(listOpenInput);
      expect(A.length(open)).toBe(2);
    })
  );

  it.effect(
    "marks drift records reviewed and drops them from the open list",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncConflictRepository();
      const recorded = yield* repository.record(conflictSeed(O.some("evt-1")));

      const reviewed = yield* repository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: recorded.id }));
      expect(reviewed.resolutionStatus).toBe("reviewed");
      expect(reviewed.id).toBe(recorded.id);

      const open = yield* repository.listOpen(listOpenInput);
      expect(open).toEqual([]);
    })
  );

  it.effect(
    "fails review for an unknown drift record with not-found",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncConflictRepository();

      const error = yield* Effect.flip(
        repository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: ghostConflictId }))
      );
      pipe(SyncConflictRepositoryNotFound.is(error), assertTrue);
      if (SyncConflictRepositoryNotFound.is(error)) {
        expect(error.conflictId).toBe(ghostConflictId);
      }
    })
  );

  it.layer(Layer.fresh(SyncConflictRepositoryInMemoryLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "resolves the repository through the in-memory layer",
      Effect.fnUntraced(function* () {
        const open = yield* SyncConflictRepository.pipe(
          Effect.flatMap((repository) => repository.listOpen(listOpenInput))
        );

        expect(open).toEqual([]);
      })
    );
  });

  describe("round-trips schema-derived sync conflicts and seeds", () => {
    it.prop(
      "DomainSyncConflict.SyncConflict",
      { value: Arbitrary.schema(DomainSyncConflict.SyncConflict) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncConflict(value));
        const decoded = Result.getOrThrow(decodeSyncConflict(encoded));
        assertTrue(equivalentSyncConflict(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
    it.prop(
      "SyncConflictSeed",
      { value: Arbitrary.schema(SyncConflictSeed) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncConflictSeed(value));
        const decoded = Result.getOrThrow(decodeSyncConflictSeed(encoded));
        assertTrue(equivalentSyncConflictSeed(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
  });
});
