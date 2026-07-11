import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import * as Documents from "@beep/documents-domain/identity/Documents";
import {
  ListOpenSyncConflictsInput,
  MarkSyncConflictReviewedInput,
  SyncConflictRepositoryNotFound,
  SyncConflictSeed,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { SyncConflictRepositoryShape } from "@beep/documents-use-cases/entities/SyncConflict/server";

const assertSchemaArbitraryRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema);
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

const workspaceId = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId)(2);
const unknownConflictId = S.decodeUnknownSync(Documents.SyncConflictId)(99);
const decodeSyncConflict = S.decodeUnknownSync(DomainSyncConflict.SyncConflict);
const encodeSyncConflict = S.encodeSync(DomainSyncConflict.SyncConflict);

const driftSeed = (remoteEventId: O.Option<string>) =>
  SyncConflictSeed.make({
    conflictKind: "remoteEdit",
    provider: "box",
    remoteEventId: O.map(remoteEventId, S.decodeUnknownSync(S.NonEmptyString)),
    remotePayload: { eventType: "ITEM_MODIFY" },
    resolutionStatus: "open",
    workspaceId,
  });

const syncConflictRow = (seed: SyncConflictSeed, id: number) => ({
  ...baseEntityFixtureInput(DomainSyncConflict.SyncConflictId.entityType, id),
  conflictKind: seed.conflictKind,
  localRelPath: O.getOrNull(seed.localRelPath),
  provider: seed.provider,
  remoteEventId: O.getOrNull(seed.remoteEventId),
  remoteId: O.getOrNull(seed.remoteId),
  remotePayload: seed.remotePayload,
  resolutionStatus: seed.resolutionStatus,
  syncItemId: O.getOrNull(seed.syncItemId),
  workspaceId: seed.workspaceId,
});

const makeRepository = (): SyncConflictRepositoryShape => {
  let conflicts: ReadonlyArray<DomainSyncConflict.SyncConflict> = A.empty();
  let nextId = 1;

  return {
    record: (seed) =>
      Effect.sync(() => {
        const existing = O.flatMap(seed.remoteEventId, (remoteEventId) =>
          A.findFirst(
            conflicts,
            (conflict) =>
              conflict.provider === seed.provider &&
              O.exists(conflict.remoteEventId, (eventId) => eventId === remoteEventId)
          )
        );
        return O.getOrElse(existing, () => {
          const created = decodeSyncConflict(syncConflictRow(seed, nextId));
          nextId = nextId + 1;
          conflicts = A.append(conflicts, created);
          return created;
        });
      }),
    listOpen: (input) =>
      Effect.sync(() =>
        A.filter(
          conflicts,
          (conflict) =>
            conflict.workspaceId === input.workspaceId &&
            conflict.provider === input.provider &&
            conflict.resolutionStatus === "open"
        )
      ),
    markReviewed: (input) =>
      O.match(
        A.findFirst(conflicts, (conflict) => conflict.id === input.conflictId),
        {
          onNone: () => Effect.fail(SyncConflictRepositoryNotFound.make({ conflictId: input.conflictId })),
          onSome: (existing) =>
            Effect.sync(() => {
              const reviewed = decodeSyncConflict({ ...encodeSyncConflict(existing), resolutionStatus: "reviewed" });
              conflicts = A.map(conflicts, (conflict) => (conflict.id === existing.id ? reviewed : conflict));
              return reviewed;
            }),
        }
      ),
  };
};

describe("SyncConflict repository port", () => {
  it.effect(
    "dedupes drift records by provider and remote event id",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const first = yield* repository.record(driftSeed(O.some("evt-1")));
      const replayed = yield* repository.record(driftSeed(O.some("evt-1")));
      const synthetic = yield* repository.record(driftSeed(O.none()));

      expect(replayed.id).toBe(first.id);
      expect(replayed.resolutionStatus).toBe("open");
      expect(synthetic.id).not.toBe(first.id);
    })
  );

  it.effect(
    "lists only open drift records for the workspace mirror",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const first = yield* repository.record(driftSeed(O.some("evt-1")));
      yield* repository.record(driftSeed(O.some("evt-2")));
      yield* repository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: first.id }));

      const open = yield* repository.listOpen(ListOpenSyncConflictsInput.make({ provider: "box", workspaceId }));
      expect(A.map(open, (conflict) => O.getOrNull(conflict.remoteEventId))).toEqual(["evt-2"]);
    })
  );

  it.effect(
    "marks drift records reviewed and fails for unknown identities",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const recorded = yield* repository.record(driftSeed(O.some("evt-1")));
      const reviewed = yield* repository.markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: recorded.id }));
      expect(reviewed.resolutionStatus).toBe("reviewed");

      const error = yield* repository
        .markReviewed(MarkSyncConflictReviewedInput.make({ conflictId: unknownConflictId }))
        .pipe(Effect.flip);
      expect(SyncConflictRepositoryNotFound.is(error)).toBe(true);
    })
  );

  it("round-trips schema-derived seeds and inputs", () => {
    assertSchemaArbitraryRoundTrip(SyncConflictSeed);
    assertSchemaArbitraryRoundTrip(ListOpenSyncConflictsInput);
    assertSchemaArbitraryRoundTrip(MarkSyncConflictReviewedInput);
  });
});
