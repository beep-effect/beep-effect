import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import {
  makeInMemorySyncCursorRepository,
  SyncCursorRepositoryInMemoryLayer,
} from "@beep/documents-server/entities/SyncCursor";
import {
  FindSyncCursorInput,
  SyncCursorRepository,
  SyncCursorSeed,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Layer, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const workspaceId = WorkspaceIdentity.WorkspaceId.make(2);
const findInput = FindSyncCursorInput.make({ provider: "box", workspaceId });
const encodeSyncCursorSeed = S.encodeResult(SyncCursorSeed);
const decodeSyncCursorSeed = S.decodeUnknownResult(SyncCursorSeed);
const equivalentSyncCursorSeed = S.toEquivalence(SyncCursorSeed);
const encodeSyncCursor = S.encodeResult(DomainSyncCursor.SyncCursor);
const decodeSyncCursor = S.decodeUnknownResult(DomainSyncCursor.SyncCursor);
const equivalentSyncCursor = S.toEquivalence(DomainSyncCursor.SyncCursor);

describe("SyncCursor server repository", () => {
  it.effect(
    "finds none before the cursor bootstraps",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncCursorRepository();

      const found = yield* repository.find(findInput);
      assertNone(found);
    })
  );

  it.effect(
    "keeps one cursor row per workspace and provider across upserts",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncCursorRepository();
      const created = yield* repository.upsert(
        SyncCursorSeed.make({ provider: "box", status: "active", streamPosition: "now", workspaceId })
      );
      expect(created.publicId).toBe("documents_sync_cursor_a1");
      expect(created.streamPosition).toBe("now");

      const replaced = yield* repository.upsert(
        SyncCursorSeed.make({
          lastError: O.some("stream read interrupted"),
          lastEventId: O.some("evt-2"),
          provider: "box",
          status: "error",
          streamPosition: "stream-position-2",
          workspaceId,
        })
      );
      expect(replaced.id).toBe(created.id);
      expect(replaced.streamPosition).toBe("stream-position-2");
      assertSome<string>(replaced.lastEventId, "evt-2");
      assertSome<string>(replaced.lastError, "stream read interrupted");
      expect(replaced.status).toBe("error");

      const found = yield* repository.find(findInput);
      assertSome<string>(
        O.map(found, (cursor) => cursor.streamPosition),
        "stream-position-2"
      );
    })
  );

  it.layer(Layer.fresh(SyncCursorRepositoryInMemoryLayer), { timeout: "10 seconds" })((it) => {
    it.effect(
      "resolves the repository through the in-memory layer",
      Effect.fnUntraced(function* () {
        const found = yield* SyncCursorRepository.pipe(Effect.flatMap((repository) => repository.find(findInput)));

        assertNone(found);
      })
    );
  });

  describe("round-trips schema-derived sync cursors and seeds", () => {
    it.prop(
      "DomainSyncCursor.SyncCursor",
      { value: Arbitrary.schema(DomainSyncCursor.SyncCursor) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncCursor(value));
        const decoded = Result.getOrThrow(decodeSyncCursor(encoded));
        assertTrue(equivalentSyncCursor(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
    it.prop(
      "SyncCursorSeed",
      { value: Arbitrary.schema(SyncCursorSeed) },
      ({ value }) => {
        const encoded = Result.getOrThrow(encodeSyncCursorSeed(value));
        const decoded = Result.getOrThrow(decodeSyncCursorSeed(encoded));
        assertTrue(equivalentSyncCursorSeed(decoded, value));
      },
      { arbitrary: fcRuns(10) }
    );
  });
});
