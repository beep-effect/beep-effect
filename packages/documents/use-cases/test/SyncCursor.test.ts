import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import {
  FindSyncCursorInput,
  SyncCursorRepository,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { SyncCursorRepositoryShape } from "@beep/documents-use-cases/entities/SyncCursor/server";

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
const decodeSyncCursor = S.decodeUnknownSync(DomainSyncCursor.SyncCursor);

const cursorSeed = (streamPosition: string) =>
  SyncCursorSeed.make({
    provider: "box",
    status: "active",
    streamPosition,
    workspaceId,
  });

const syncCursorRow = (seed: SyncCursorSeed, id: number) => ({
  ...productEntityFixtureInput(DocumentsIdentity.SyncCursorId.entityType, id),
  lastError: O.getOrNull(seed.lastError),
  lastEventId: O.getOrNull(seed.lastEventId),
  provider: seed.provider,
  status: seed.status,
  streamPosition: seed.streamPosition,
  workspaceId: seed.workspaceId,
});

const makeRepository = (): SyncCursorRepositoryShape => {
  let cursors: ReadonlyArray<DomainSyncCursor.SyncCursor> = A.empty();
  let nextId = 1;

  const matchesMirror =
    (input: { readonly provider: string; readonly workspaceId: number }) => (cursor: DomainSyncCursor.SyncCursor) =>
      cursor.workspaceId === input.workspaceId && cursor.provider === input.provider;

  return {
    find: (input) => Effect.sync(() => A.findFirst(cursors, matchesMirror(input))),
    upsert: (seed) =>
      Effect.sync(() =>
        O.match(A.findFirst(cursors, matchesMirror(seed)), {
          onNone: () => {
            const created = decodeSyncCursor(syncCursorRow(seed, nextId));
            nextId = nextId + 1;
            cursors = A.append(cursors, created);
            return created;
          },
          onSome: (existing) => {
            const replaced = decodeSyncCursor({
              ...S.encodeSync(DomainSyncCursor.SyncCursor)(existing),
              lastError: O.getOrNull(seed.lastError),
              lastEventId: O.getOrNull(seed.lastEventId),
              status: seed.status,
              streamPosition: seed.streamPosition,
            });
            cursors = A.map(cursors, (cursor) => (cursor.id === existing.id ? replaced : cursor));
            return replaced;
          },
        })
      ),
  };
};

describe("SyncCursor repository port", () => {
  it.effect(
    "finds none before the cursor bootstraps",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const found = yield* repository.find(FindSyncCursorInput.make({ provider: "box", workspaceId }));

      expect(O.isNone(found)).toBe(true);
    })
  );

  it.effect(
    "keeps one cursor row per workspace and provider across upserts",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const created = yield* repository.upsert(cursorSeed("now"));
      const replaced = yield* repository.upsert(cursorSeed("stream-position-2"));

      expect(replaced.id).toBe(created.id);
      expect(replaced.streamPosition).toBe("stream-position-2");

      const found = yield* repository.find(FindSyncCursorInput.make({ provider: "box", workspaceId }));
      expect(O.map(found, (cursor) => cursor.streamPosition)).toEqual(O.some("stream-position-2"));
    })
  );

  it.effect(
    "resolves the repository port through its context tag",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const resolved = yield* SyncCursorRepository.pipe(Effect.provideService(SyncCursorRepository, repository));

      expect(resolved).toBe(repository);
    })
  );

  it("round-trips schema-derived seeds and lookup inputs", () => {
    assertSchemaArbitraryRoundTrip(SyncCursorSeed);
    assertSchemaArbitraryRoundTrip(FindSyncCursorInput);
  });
});
