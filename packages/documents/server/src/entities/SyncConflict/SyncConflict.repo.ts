/**
 * SyncConflict repository adapters.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import {
  fromSyncConflictRow,
  SYNC_CONFLICT_TABLE_NAME,
  syncConflictTable,
  toSyncConflictInsert,
} from "@beep/documents-tables/entities/SyncConflict";
import {
  SyncConflictRepository,
  SyncConflictRepositoryNotFound,
  SyncConflictRepositoryUnavailable,
} from "@beep/documents-use-cases/entities/SyncConflict/server";
import { PostgresDrizzle } from "@beep/postgres";
import * as DocumentsIdentity from "@beep/shared-domain/identity/Documents";
import { A, N } from "@beep/utils";
import { and, asc, eq } from "drizzle-orm";
import { Effect, HashMap, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { byIdAscending, makeEntityStore, nextEntityId, SYSTEM_PRINCIPAL } from "../internal/RepoSupport.ts";
import type { SyncConflictSeed } from "@beep/documents-use-cases/entities/SyncConflict/server";

const decodeSyncConflict = S.decodeUnknownEffect(DomainSyncConflict.SyncConflict);

/**
 * Build a full SyncConflict entity from a drift seed and an assigned id.
 *
 * ProductEntity audit fields mirror the repository's application-write
 * posture: system principal audit fields, epoch timestamps, and a
 * sequence-shaped public id derived from the table name.
 */
const syncConflictFromSeed = Effect.fn("Documents.SyncConflictRepository.fromSeed")(
  (id: number, seed: SyncConflictSeed) =>
    decodeSyncConflict({
      conflictKind: seed.conflictKind,
      createdAt: 0,
      createdByPrincipal: SYSTEM_PRINCIPAL,
      entityType: DocumentsIdentity.SyncConflictId.entityType,
      id,
      localRelPath: O.getOrNull(seed.localRelPath),
      orgId: 1,
      provider: seed.provider,
      publicId: `${SYNC_CONFLICT_TABLE_NAME}_a${id}`,
      remoteEventId: O.getOrNull(seed.remoteEventId),
      remoteId: O.getOrNull(seed.remoteId),
      remotePayload: seed.remotePayload,
      resolutionStatus: seed.resolutionStatus,
      rowVersion: 1,
      schemaVersion: "0.1.0",
      source: "Application",
      syncItemId: O.getOrNull(seed.syncItemId),
      updatedAt: 0,
      updatedByPrincipal: SYSTEM_PRINCIPAL,
      workspaceId: seed.workspaceId,
    }).pipe(repositoryUnavailable("construct SyncConflict"))
);

/**
 * Mark one drift record as reviewed, leaving every other field unchanged.
 */
const reviewedConflict = (conflict: DomainSyncConflict.SyncConflict): DomainSyncConflict.SyncConflict =>
  DomainSyncConflict.SyncConflict.make({ ...conflict, resolutionStatus: "reviewed" });

const matchesRemoteEvent =
  (workspaceId: number, provider: string, remoteEventId: string) => (conflict: DomainSyncConflict.SyncConflict) =>
    conflict.workspaceId === workspaceId &&
    conflict.provider === provider &&
    O.exists(conflict.remoteEventId, (candidate) => candidate === remoteEventId);

/**
 * Build the in-memory SyncConflict repository used by deterministic sync tests.
 *
 * **Details**
 *
 * `record` deduplicates by provider event within one workspace: when the
 * seed's `remoteEventId` is present and a record already exists for the same
 * workspace, provider, and event, that record is returned unchanged.
 *
 * **Example** (Import in-memory factory)
 *
 * ```ts
 * import { makeInMemorySyncConflictRepository } from "@beep/documents-server/entities/SyncConflict"
 *
 * console.log(makeInMemorySyncConflictRepository)
 * ```
 *
 * @effects Allocates an in-memory `Ref` store plus an id counter and mutates
 * that process-local state for record, list, and review repository calls.
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemorySyncConflictRepository = Effect.fn("Documents.SyncConflictRepository.makeInMemory")(
  function* () {
    const { counter, snapshot, store } = yield* makeEntityStore(
      HashMap.empty<DocumentsIdentity.SyncConflictId, DomainSyncConflict.SyncConflict>()
    );

    return SyncConflictRepository.of({
      listOpen: Effect.fn("Documents.SyncConflictRepository.listOpen")(function* (input) {
        const conflicts = yield* snapshot;
        return pipe(
          conflicts,
          A.filter(
            (conflict) =>
              conflict.workspaceId === input.workspaceId &&
              conflict.provider === input.provider &&
              DomainSyncConflict.SyncConflictResolution.is.open(conflict.resolutionStatus)
          ),
          A.sort(byIdAscending<DomainSyncConflict.SyncConflict>())
        );
      }),
      markReviewed: Effect.fn("Documents.SyncConflictRepository.markReviewed")(function* (input) {
        const conflicts = yield* Ref.get(store);
        const existing = HashMap.get(conflicts, input.conflictId);
        if (O.isNone(existing)) {
          return yield* SyncConflictRepositoryNotFound.make({ conflictId: input.conflictId });
        }
        const reviewed = reviewedConflict(existing.value);
        yield* Ref.update(store, HashMap.set(reviewed.id, reviewed));
        return reviewed;
      }),
      record: Effect.fn("Documents.SyncConflictRepository.record")(function* (seed) {
        const conflicts = yield* snapshot;
        const existing = O.flatMap(seed.remoteEventId, (remoteEventId) =>
          A.findFirst(conflicts, matchesRemoteEvent(seed.workspaceId, seed.provider, remoteEventId))
        );
        if (O.isSome(existing)) {
          return existing.value;
        }
        const id = yield* Ref.getAndUpdate(counter, N.increment);
        const conflict = yield* syncConflictFromSeed(id, seed);
        yield* Ref.update(store, HashMap.set(conflict.id, conflict));
        return conflict;
      }),
    });
  }
);

const repositoryUnavailable =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, SyncConflictRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Documents SyncConflict repository adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: SYNC_CONFLICT_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        SyncConflictRepositoryUnavailable.make({
          reason: `${operation} failed against ${SYNC_CONFLICT_TABLE_NAME}`,
        })
      )
    );

/**
 * Build a Drizzle-backed SyncConflict repository used by live persistence tests.
 *
 * **Example** (Import Drizzle factory)
 *
 * ```ts
 * import { makeDrizzleSyncConflictRepository } from "@beep/documents-server/entities/SyncConflict"
 *
 * console.log(makeDrizzleSyncConflictRepository)
 * ```
 *
 * @effects Requires `PostgresDrizzle`; executes `select`, `insert`, and
 * `update` statements against the SyncConflict table and redacts driver
 * failures to `SyncConflictRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleSyncConflictRepository = Effect.fn("Documents.SyncConflictRepository.makeDrizzle")(
  function* () {
    const db = yield* PostgresDrizzle;

    return SyncConflictRepository.of({
      listOpen: Effect.fn("Documents.SyncConflictRepository.drizzleListOpen")(function* (input) {
        const rows = yield* db
          .select()
          .from(syncConflictTable)
          .where(
            and(
              eq(syncConflictTable.workspaceId, input.workspaceId),
              eq(syncConflictTable.provider, input.provider),
              eq(syncConflictTable.resolutionStatus, DomainSyncConflict.SyncConflictResolution.Enum.open)
            )
          )
          .orderBy(asc(syncConflictTable.id))
          .pipe(repositoryUnavailable("list open SyncConflict"));
        return yield* Effect.fromResult(Result.all(A.map(rows, fromSyncConflictRow))).pipe(
          repositoryUnavailable("decode SyncConflict")
        );
      }),
      markReviewed: Effect.fn("Documents.SyncConflictRepository.drizzleMarkReviewed")(function* (input) {
        const rows = yield* db
          .select()
          .from(syncConflictTable)
          .where(eq(syncConflictTable.id, input.conflictId))
          .limit(1)
          .pipe(repositoryUnavailable("select SyncConflict"));
        const existingRow = A.head(rows);
        if (O.isNone(existingRow)) {
          return yield* SyncConflictRepositoryNotFound.make({ conflictId: input.conflictId });
        }
        const existing = yield* Effect.fromResult(fromSyncConflictRow(existingRow.value)).pipe(
          repositoryUnavailable("decode SyncConflict")
        );
        const reviewed = reviewedConflict(existing);
        const insert = yield* Effect.fromResult(toSyncConflictInsert(reviewed)).pipe(
          repositoryUnavailable("encode SyncConflict insert")
        );
        const updatedRows = yield* db
          .update(syncConflictTable)
          .set(insert)
          .where(eq(syncConflictTable.id, reviewed.id))
          .returning()
          .pipe(repositoryUnavailable("update SyncConflict"));
        return yield* pipe(
          A.head(updatedRows),
          O.match({
            onNone: () => Effect.succeed(reviewed),
            onSome: (row) =>
              Effect.fromResult(fromSyncConflictRow(row)).pipe(repositoryUnavailable("decode SyncConflict")),
          })
        );
      }),
      record: Effect.fn("Documents.SyncConflictRepository.drizzleRecord")(function* (seed) {
        if (O.isSome(seed.remoteEventId)) {
          const existingRows = yield* db
            .select()
            .from(syncConflictTable)
            .where(
              and(
                eq(syncConflictTable.workspaceId, seed.workspaceId),
                eq(syncConflictTable.provider, seed.provider),
                eq(syncConflictTable.remoteEventId, seed.remoteEventId.value)
              )
            )
            .limit(1)
            .pipe(repositoryUnavailable("select SyncConflict by remote event"));
          const existingRow = A.head(existingRows);
          if (O.isSome(existingRow)) {
            return yield* Effect.fromResult(fromSyncConflictRow(existingRow.value)).pipe(
              repositoryUnavailable("decode SyncConflict")
            );
          }
        }
        const currentRows = yield* db.select().from(syncConflictTable).pipe(repositoryUnavailable("list SyncConflict"));
        const conflict = yield* syncConflictFromSeed(nextEntityId(currentRows), seed);
        const insert = yield* Effect.fromResult(toSyncConflictInsert(conflict)).pipe(
          repositoryUnavailable("encode SyncConflict insert")
        );
        const rows = yield* db
          .insert(syncConflictTable)
          .values(insert)
          .returning()
          .pipe(repositoryUnavailable("insert SyncConflict"));
        return yield* pipe(
          A.head(rows),
          O.match({
            onNone: () => Effect.succeed(conflict),
            onSome: (row) =>
              Effect.fromResult(fromSyncConflictRow(row)).pipe(repositoryUnavailable("decode SyncConflict")),
          })
        );
      }),
    });
  }
);
