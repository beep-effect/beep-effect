/**
 * SyncCursor repository adapters.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainSyncCursor from "@beep/documents-domain/entities/SyncCursor";
import {
  fromSyncCursorRow,
  SYNC_CURSOR_TABLE_NAME,
  syncCursorTable,
  toSyncCursorInsert,
} from "@beep/documents-tables/entities/SyncCursor";
import {
  SyncCursorRepository,
  SyncCursorRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncCursor/server";
import { PostgresDrizzle } from "@beep/postgres";
import { A, N } from "@beep/utils";
import { and, eq } from "drizzle-orm";
import { Effect, HashMap, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeEntityStore, nextEntityId, SYSTEM_PRINCIPAL } from "../internal/RepoSupport.ts";
import type { DmsProvider } from "@beep/documents-domain/values/Sync";
import type { SyncCursorSeed } from "@beep/documents-use-cases/entities/SyncCursor/server";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";

const decodeSyncCursor = S.decodeUnknownSync(DomainSyncCursor.SyncCursor);

/**
 * Build a full SyncCursor entity from an upsert seed and an assigned id.
 *
 * BaseEntity bookkeeping fields mirrors the repository's application-write
 * posture: system principal audit fields, epoch timestamps, and a
 * sequence-shaped public id derived from the table name.
 */
const syncCursorFromSeed = (id: number, seed: SyncCursorSeed): DomainSyncCursor.SyncCursor =>
  decodeSyncCursor({
    createdAt: 0,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: DomainSyncCursor.SyncCursorId.entityType,
    id,
    lastError: O.getOrNull(seed.lastError),
    lastEventId: O.getOrNull(seed.lastEventId),
    orgId: 1,
    provider: seed.provider,
    publicId: `${SYNC_CURSOR_TABLE_NAME}_a${id}`,
    rowVersion: 1,
    schemaVersion: "0.1.0",
    source: "Application",
    status: seed.status,
    streamPosition: seed.streamPosition,
    updatedAt: 0,
    updatedByPrincipal: SYSTEM_PRINCIPAL,
    workspaceId: seed.workspaceId,
  });

/**
 * Apply the seed's mutable cursor fields onto an existing cursor row.
 */
const replaceCursorFields = (
  existing: DomainSyncCursor.SyncCursor,
  seed: SyncCursorSeed
): DomainSyncCursor.SyncCursor =>
  DomainSyncCursor.SyncCursor.make({
    ...existing,
    lastError: seed.lastError,
    lastEventId: seed.lastEventId,
    status: seed.status,
    streamPosition: seed.streamPosition,
  });

type MirrorScope = {
  readonly provider: DmsProvider;
  readonly workspaceId: WorkspaceIdentity.WorkspaceId;
};

const matchesMirror = (input: MirrorScope) => (cursor: DomainSyncCursor.SyncCursor) =>
  cursor.workspaceId === input.workspaceId && cursor.provider === input.provider;

/**
 * Build the in-memory SyncCursor repository used by deterministic sync tests.
 *
 * **Details**
 *
 * At most one cursor row exists per workspace and provider pair: `upsert`
 * inserts when absent and replaces the seed fields in place when present.
 *
 * **Example** (Import in-memory repository)
 *
 * ```ts
 * import { makeInMemorySyncCursorRepository } from "@beep/documents-server/entities/SyncCursor"
 *
 * console.log(makeInMemorySyncCursorRepository)
 * ```
 *
 * @effects Allocates an in-memory `Ref` store plus an id counter and mutates
 * that process-local state for find and upsert repository calls.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemorySyncCursorRepository = Effect.fn("Documents.SyncCursorRepository.makeInMemory")(function* () {
  const { counter, snapshot, store } = yield* makeEntityStore(
    HashMap.empty<DomainSyncCursor.SyncCursorId, DomainSyncCursor.SyncCursor>()
  );

  return SyncCursorRepository.of({
    find: Effect.fn("Documents.SyncCursorRepository.find")(function* (input) {
      const cursors = yield* snapshot;
      return A.findFirst(cursors, matchesMirror(input));
    }),
    upsert: Effect.fn("Documents.SyncCursorRepository.upsert")(function* (seed) {
      const cursors = yield* snapshot;
      const existing = A.findFirst(cursors, matchesMirror(seed));
      if (O.isSome(existing)) {
        const replaced = replaceCursorFields(existing.value, seed);
        yield* Ref.update(store, HashMap.set(replaced.id, replaced));
        return replaced;
      }
      const id = yield* Ref.getAndUpdate(counter, N.increment);
      const cursor = syncCursorFromSeed(id, seed);
      yield* Ref.update(store, HashMap.set(cursor.id, cursor));
      return cursor;
    }),
  });
});

const repositoryUnavailable =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, SyncCursorRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Documents SyncCursor repository adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: SYNC_CURSOR_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        SyncCursorRepositoryUnavailable.make({
          reason: `${operation} failed against ${SYNC_CURSOR_TABLE_NAME}`,
        })
      )
    );

/**
 * Build a Drizzle-backed SyncCursor repository used by live persistence tests.
 *
 * **Example** (Import Drizzle repository)
 *
 * ```ts
 * import { makeDrizzleSyncCursorRepository } from "@beep/documents-server/entities/SyncCursor"
 *
 * console.log(makeDrizzleSyncCursorRepository)
 * ```
 *
 * @effects Requires `PostgresDrizzle`; executes `select`, `insert`, and
 * `update` statements against the SyncCursor table and redacts driver
 * failures to `SyncCursorRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleSyncCursorRepository = Effect.fn("Documents.SyncCursorRepository.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  const findRow = Effect.fn("Documents.SyncCursorRepository.drizzleFindRow")(function* (input: MirrorScope) {
    const rows = yield* db
      .select()
      .from(syncCursorTable)
      .where(and(eq(syncCursorTable.workspaceId, input.workspaceId), eq(syncCursorTable.provider, input.provider)))
      .limit(1)
      .pipe(repositoryUnavailable("select SyncCursor"));
    return pipe(rows, A.head, O.map(fromSyncCursorRow));
  });

  return SyncCursorRepository.of({
    find: Effect.fn("Documents.SyncCursorRepository.drizzleFind")(function* (input) {
      return yield* findRow(input);
    }),
    upsert: Effect.fn("Documents.SyncCursorRepository.drizzleUpsert")(function* (seed) {
      const existing = yield* findRow(seed);
      if (O.isSome(existing)) {
        const replaced = replaceCursorFields(existing.value, seed);
        const rows = yield* db
          .update(syncCursorTable)
          .set(toSyncCursorInsert(replaced))
          .where(eq(syncCursorTable.id, replaced.id))
          .returning()
          .pipe(repositoryUnavailable("update SyncCursor"));
        return pipe(
          rows,
          A.head,
          O.map(fromSyncCursorRow),
          O.getOrElse(() => replaced)
        );
      }
      const currentRows = yield* db.select().from(syncCursorTable).pipe(repositoryUnavailable("list SyncCursor"));
      const cursor = syncCursorFromSeed(nextEntityId(currentRows), seed);
      const rows = yield* db
        .insert(syncCursorTable)
        .values(toSyncCursorInsert(cursor))
        .returning()
        .pipe(repositoryUnavailable("insert SyncCursor"));
      return pipe(
        rows,
        A.head,
        O.map(fromSyncCursorRow),
        O.getOrElse(() => cursor)
      );
    }),
  });
});
