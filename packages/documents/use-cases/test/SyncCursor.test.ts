import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import {
  FindSyncCursorInput,
  SyncCursorRepository,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SyncCursorRepositoryShape } from "@beep/documents-use-cases/entities/SyncCursor/server";

const decodeUnknownSyncCursor = S.decodeUnknownEffect(DomainSyncCursor.SyncCursor);

const assertSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  const encoded = Result.getOrThrow(encode(value));
  const decoded = Result.getOrThrow(decode(encoded));
  pipe(equivalent(decoded, value), assertTrue);
};

const workspaceId = WorkspaceIdentity.WorkspaceId.make(2);
const decodeSyncCursor = (input: unknown) => decodeUnknownSyncCursor(input).pipe(Effect.orDie);

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
      O.match(A.findFirst(cursors, matchesMirror(seed)), {
        onNone: Effect.fn("onNone")(function* () {
          const created = yield* decodeSyncCursor(syncCursorRow(seed, nextId));
          nextId = nextId + 1;
          cursors = A.append(cursors, created);
          return created;
        }),
        onSome: (existing) =>
          Effect.sync(() => {
            const replaced = DomainSyncCursor.SyncCursor.make({
              ...existing,
              lastError: seed.lastError,
              lastEventId: seed.lastEventId,
              status: seed.status,
              streamPosition: seed.streamPosition,
            });
            cursors = A.map(cursors, (cursor) => (cursor.id === existing.id ? replaced : cursor));
            return replaced;
          }),
      }),
  };
};

describe("SyncCursor repository port", () => {
  it.effect(
    "finds none before the cursor bootstraps",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const found = yield* repository.find(FindSyncCursorInput.make({ provider: "box", workspaceId }));

      assertNone(found);
    })
  );

  it.effect(
    "keeps one cursor row per workspace and provider across upserts",
    Effect.fnUntraced(function* () {
      const repository = makeRepository();
      const created = yield* repository.upsert(cursorSeed("now"));
      const otherWorkspaceId = WorkspaceIdentity.WorkspaceId.make(3);
      const other = yield* repository.upsert(
        SyncCursorSeed.make({
          ...cursorSeed("other-position"),
          workspaceId: otherWorkspaceId,
        })
      );
      expect(other.id).not.toBe(created.id);
      const replaced = yield* repository.upsert(cursorSeed("stream-position-2"));

      expect(replaced.id).toBe(created.id);
      expect(replaced.streamPosition).toBe("stream-position-2");

      const found = yield* repository.find(FindSyncCursorInput.make({ provider: "box", workspaceId }));
      assertSome(
        O.map(found, (cursor) => cursor.streamPosition),
        "stream-position-2"
      );
      const otherFound = yield* repository.find(
        FindSyncCursorInput.make({ provider: "box", workspaceId: otherWorkspaceId })
      );
      assertSome(
        O.map(otherFound, (cursor) => cursor.id),
        other.id
      );
      assertSome(
        O.map(otherFound, (cursor) => cursor.streamPosition),
        "other-position"
      );
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

  it.prop(
    "round-trips schema-derived seeds and lookup inputs",
    [Arbitrary.schema(SyncCursorSeed), Arbitrary.schema(FindSyncCursorInput)],
    ([syncCursorSeed, findSyncCursorInput]) => {
      assertSchemaRoundTrip(SyncCursorSeed, syncCursorSeed);
      assertSchemaRoundTrip(FindSyncCursorInput, findSyncCursorInput);
    },
    { arbitrary: fcRuns(10) }
  );
});
