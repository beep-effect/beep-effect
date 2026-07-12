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
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

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
const findInput = FindSyncCursorInput.make({ provider: "box", workspaceId });

describe("SyncCursor server repository", () => {
  it.effect(
    "finds none before the cursor bootstraps",
    Effect.fnUntraced(function* () {
      const repository = yield* makeInMemorySyncCursorRepository();

      const found = yield* repository.find(findInput);
      expect(O.isNone(found)).toBe(true);
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
      expect(replaced.lastEventId).toEqual(O.some("evt-2"));
      expect(replaced.lastError).toEqual(O.some("stream read interrupted"));
      expect(replaced.status).toBe("error");

      const found = yield* repository.find(findInput);
      expect(O.map(found, (cursor) => cursor.streamPosition)).toEqual(O.some("stream-position-2"));
    })
  );

  it.effect(
    "resolves the repository through the in-memory layer",
    Effect.fnUntraced(function* () {
      const found = yield* SyncCursorRepository.pipe(
        Effect.flatMap((repository) => repository.find(findInput)),
        provideScopedLayer(SyncCursorRepositoryInMemoryLayer)
      );

      expect(O.isNone(found)).toBe(true);
    })
  );

  it("round-trips schema-derived sync cursors and seeds", () => {
    assertSchemaArbitraryRoundTrip(DomainSyncCursor.SyncCursor);
    assertSchemaArbitraryRoundTrip(SyncCursorSeed);
  });
});
