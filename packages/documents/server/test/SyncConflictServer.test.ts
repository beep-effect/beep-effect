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
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));

      return equivalent(decoded, value);
    }),
    fcRuns(10)
  );
};

const workspaceId = S.decodeSync(WorkspaceIdentity.WorkspaceId)(2);
const ghostConflictId = S.decodeSync(Documents.SyncConflictId)(99);
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
      expect(SyncConflictRepositoryNotFound.is(error)).toBe(true);
      if (SyncConflictRepositoryNotFound.is(error)) {
        expect(error.conflictId).toBe(ghostConflictId);
      }
    })
  );

  it.effect(
    "resolves the repository through the in-memory layer",
    Effect.fnUntraced(function* () {
      const open = yield* SyncConflictRepository.pipe(
        Effect.flatMap((repository) => repository.listOpen(listOpenInput)),
        provideScopedLayer(SyncConflictRepositoryInMemoryLayer)
      );

      expect(open).toEqual([]);
    })
  );

  it("round-trips schema-derived sync conflicts and seeds", () => {
    assertSchemaArbitraryRoundTrip(DomainSyncConflict.SyncConflict);
    assertSchemaArbitraryRoundTrip(SyncConflictSeed);
  });
});
