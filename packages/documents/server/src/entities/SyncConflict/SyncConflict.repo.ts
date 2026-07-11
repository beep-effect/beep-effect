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
import { A, N } from "@beep/utils";
import { and, asc, eq } from "drizzle-orm";
import { Effect, HashMap, Order, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { SyncConflictSeed } from "@beep/documents-use-cases/entities/SyncConflict/server";

const decodeSyncConflict = S.decodeUnknownSync(DomainSyncConflict.SyncConflict);

const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;

const byIdAscending = Order.mapInput(Order.Number, (conflict: DomainSyncConflict.SyncConflict) => conflict.id);

const nextEntityId = (rows: ReadonlyArray<{ readonly id: number }>): number =>
  A.reduce(rows, 0, (max, row) => N.max(max, row.id)) + 1;

/**
 * Build a full SyncConflict entity from a drift seed and an assigned id.
 *
 * BaseEntity bookkeeping fields mirrors the repository's application-write
 * posture: system principal audit fields, epoch timestamps, and a
 * sequence-shaped public id derived from the table name.
 */
const syncConflictFromSeed = (id: number, seed: SyncConflictSeed): DomainSyncConflict.SyncConflict =>
  decodeSyncConflict({
    conflictKind: seed.conflictKind,
    createdAt: 0,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: DomainSyncConflict.SyncConflictId.entityType,
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
  });

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
 * `record` deduplicates by provider event within one workspace: when the
 * seed's `remoteEventId` is present and a record already exists for the same
 * workspace, provider, and event, that record is returned unchanged.
 *
 * @example
 * ```ts
 * import { makeInMemorySyncConflictRepository } from "@beep/documents-server/entities/SyncConflict"
 *
 * console.log(makeInMemorySyncConflictRepository)
 * ```
 *
 * @effects Allocates an in-memory `Ref` store plus an id counter and mutates
 * that process-local state for record, list, and review repository calls.
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemorySyncConflictRepository = Effect.fn("Documents.SyncConflictRepository.makeInMemory")(
  function* () {
    const store = yield* Ref.make(HashMap.empty<DomainSyncConflict.SyncConflictId, DomainSyncConflict.SyncConflict>());
    const counter = yield* Ref.make(1);
    const snapshot = Effect.map(Ref.get(store), (conflicts) => A.fromIterable(HashMap.values(conflicts)));

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
          A.sort(byIdAscending)
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
        const conflict = syncConflictFromSeed(id, seed);
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
 * @example
 * ```ts
 * import { makeDrizzleSyncConflictRepository } from "@beep/documents-server/entities/SyncConflict"
 *
 * console.log(makeDrizzleSyncConflictRepository)
 * ```
 *
 * @effects Requires `PostgresDrizzle`; executes `select`, `insert`, and
 * `update` statements against the SyncConflict table and redacts driver
 * failures to `SyncConflictRepositoryUnavailable`.
 *
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
        return A.map(rows, fromSyncConflictRow);
      }),
      markReviewed: Effect.fn("Documents.SyncConflictRepository.drizzleMarkReviewed")(function* (input) {
        const rows = yield* db
          .select()
          .from(syncConflictTable)
          .where(eq(syncConflictTable.id, input.conflictId))
          .limit(1)
          .pipe(repositoryUnavailable("select SyncConflict"));
        const existing = pipe(rows, A.head, O.map(fromSyncConflictRow));
        if (O.isNone(existing)) {
          return yield* SyncConflictRepositoryNotFound.make({ conflictId: input.conflictId });
        }
        const reviewed = reviewedConflict(existing.value);
        const updatedRows = yield* db
          .update(syncConflictTable)
          .set(toSyncConflictInsert(reviewed))
          .where(eq(syncConflictTable.id, reviewed.id))
          .returning()
          .pipe(repositoryUnavailable("update SyncConflict"));
        return pipe(
          updatedRows,
          A.head,
          O.map(fromSyncConflictRow),
          O.getOrElse(() => reviewed)
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
          const existing = pipe(existingRows, A.head, O.map(fromSyncConflictRow));
          if (O.isSome(existing)) {
            return existing.value;
          }
        }
        const currentRows = yield* db.select().from(syncConflictTable).pipe(repositoryUnavailable("list SyncConflict"));
        const conflict = syncConflictFromSeed(nextEntityId(currentRows), seed);
        const rows = yield* db
          .insert(syncConflictTable)
          .values(toSyncConflictInsert(conflict))
          .returning()
          .pipe(repositoryUnavailable("insert SyncConflict"));
        return pipe(
          rows,
          A.head,
          O.map(fromSyncConflictRow),
          O.getOrElse(() => conflict)
        );
      }),
    });
  }
);
