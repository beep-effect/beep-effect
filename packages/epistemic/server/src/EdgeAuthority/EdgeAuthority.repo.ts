/**
 * Bitemporal edge authority repository adapter.
 *
 * Every write here is one database transaction, and the transaction boundary is
 * the whole contract: a caller can never observe a logical edge with two open
 * heads or with none, because the close of the old head and the insert of its
 * replacement either both land or neither does. What the database rejects it
 * rejects by NAME — the exclusion constraint, the open-head partial unique
 * index, the ordered-interval CHECK constraints — and those names are mapped to typed
 * errors here rather than parsed out of driver message prose.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

/**
 * Derived from Graphiti (https://github.com/getzep/graphiti), v0.29.2,
 * commit ff7e29ccd127d8d9721b5cbb2163a6407ef915fe.
 * Copyright 2024, 2025 Zep Software, Inc. Licensed under the Apache License,
 * Version 2.0. See THIRD_PARTY_NOTICES.md.
 *
 * Modified: reimplemented in Effect/TypeScript over Postgres; no upstream
 * source was copied. The invalidate-don't-delete contract runs as one READ
 * COMMITTED FOR UPDATE transaction with DB exclusion/open-head backstops
 * instead of the donor's in-memory edge mutation.
 */

import { EdgeVersion, flattenEdgeSource, flattenEdgeTarget } from "@beep/epistemic-domain/entities/EdgeVersion";
import { logicalEdgeKey } from "@beep/epistemic-domain/values";
import { DbSchema } from "@beep/epistemic-tables";
import { fromEdgeVersionRow, toEdgeVersionInsert } from "@beep/epistemic-tables/entities/EdgeVersion";
import {
  EdgeAuthorityError,
  EdgeAuthorityRepository,
  EdgeConstraintViolation,
  EdgeRepositoryUnavailable,
  SupersessionConflict,
} from "@beep/epistemic-use-cases/EdgeAuthority";
import { PostgresDrizzle, PostgresError } from "@beep/postgres";
import { PosInt } from "@beep/schema/Int";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { A, N, O } from "@beep/utils";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { DateTime, Effect, Equal, Match, Order, pipe, Semaphore } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { LogicalEdgeKey } from "@beep/epistemic-domain/values";
import type { EdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion";
import type {
  EdgeAuthorityOperation,
  EdgeWriteOperation,
  RecordEdgeFact,
  SupersedeEdgeFact,
} from "@beep/epistemic-use-cases/EdgeAuthority";
import type { EffectPgQueryEffectHKT, EffectPgQueryResultHKT } from "drizzle-orm/effect-postgres/session";
import type { PgEffectTransaction } from "drizzle-orm/pg-core/effect/session";
import type { EmptyRelations } from "drizzle-orm/relations";

const EDGE_TABLE_NAME = "epistemic_edge_version" as const;
const edgeTable = DbSchema.edgeVersion;

const edgeVersionPublicId = PublicEntityId.factory(Epistemic.EdgeVersionId);
const decodeEdgeVersionId = S.decodeUnknownSync(Epistemic.EdgeVersionId);
const earlierThan = Order.isLessThan(DateTime.Order);
const notLaterThan = Order.isLessThanOrEqualTo(DateTime.Order);
const byVersion = Order.mapInput(Order.Number, (version: EdgeVersion) => version.version);

/**
 * Placeholder identity carried by a seed entity between construction and insert.
 * It never reaches the database: `toEdgeVersionInsert` drops `id` so the SERIAL
 * sequence assigns the real one, and the inserted row is decoded back before it
 * is returned.
 */
const pendingEdgeVersionId = decodeEdgeVersionId(1);

/**
 * Public handle for one edge version, derived from the pair that already
 * identifies it uniquely — `epistemic_edge_logical_version_unique` guarantees
 * one row per `(logical_key, version)`, so the derived handle inherits that
 * uniqueness instead of needing a generator and the CUID/crypto services one
 * would drag into the layer.
 */
const publicIdFor = (logicalKey: LogicalEdgeKey, version: PosInt) =>
  edgeVersionPublicId.fromUnknown(`${Epistemic.EdgeVersionId.tableName}_a${logicalKey}v${version}`);

type EdgeFactCommand = RecordEdgeFact | SupersedeEdgeFact;

type EdgeVersionShape = {
  readonly logicalKey: LogicalEdgeKey;
  readonly supersedesId: O.Option<Epistemic.EdgeVersionId>;
  readonly validTo: O.Option<DateTime.Utc>;
  readonly version: PosInt;
};

/**
 * Build the row a command asks for. Both temporal axes come from the command
 * verbatim — `recordedAt` is the arrival instant the caller reports, never a
 * clock read here — and the transaction axis always opens (`expiredAt` absent),
 * because a row is current the moment it is written.
 */
const buildEdgeVersion = (command: EdgeFactCommand, shape: EdgeVersionShape): EdgeVersion =>
  EdgeVersion.make({
    ...flattenEdgeSource(command.identity.source),
    ...flattenEdgeTarget(command.identity.target),
    createdAt: command.recordedAt,
    createdByPrincipal: command.recordedBy,
    entityType: Epistemic.EdgeVersionId.entityType,
    evidenceScope: command.identity.evidenceScope,
    expiredAt: O.none(),
    fact: command.fact,
    id: pendingEdgeVersionId,
    logicalKey: shape.logicalKey,
    matterScope: command.identity.matterScope,
    orgId: command.orgId,
    publicId: publicIdFor(shape.logicalKey, shape.version),
    qualifiers: command.identity.qualifiers,
    recordedAt: command.recordedAt,
    relation: command.identity.relation,
    rowVersion: PosInt.make(1),
    schemaVersion: command.schemaVersion,
    source: command.source,
    supersedesId: shape.supersedesId,
    updatedAt: command.recordedAt,
    updatedByPrincipal: command.recordedBy,
    validFrom: command.validFrom,
    validTo: shape.validTo,
    version: shape.version,
  });

/**
 * Canonical two-axis predicate: what was true at `validAt`, as far as anyone
 * knew at `knownAt`. Both axes are half-open, so the lower bound is included and
 * the upper bound is not, and an absent upper bound is unbounded rather than a
 * sentinel date.
 */
const asOfWhere = (logicalKey: LogicalEdgeKey, validAt: number, knownAt: number) =>
  and(
    eq(edgeTable.logicalKey, logicalKey),
    lte(edgeTable.validFrom, validAt),
    or(isNull(edgeTable.validTo), gt(edgeTable.validTo, validAt)),
    lte(edgeTable.recordedAt, knownAt),
    or(isNull(edgeTable.expiredAt), gt(edgeTable.expiredAt, knownAt))
  );

const nextVersionAfter = (versions: ReadonlyArray<EdgeVersion>): PosInt =>
  PosInt.make(A.reduce(versions, 0, (highest, version) => N.max(highest, version.version)) + 1);

/**
 * The row that is currently true and currently believed: open on both axes. The
 * `epistemic_edge_open_head_idx` partial unique index makes it at most one row.
 */
const openHeadOf = (versions: ReadonlyArray<EdgeVersion>): O.Option<EdgeVersion> =>
  A.findFirst(versions, (version) => O.isNone(version.validTo) && O.isNone(version.expiredAt));

/**
 * The version a supersession replaces, chosen among the rows the transaction
 * locked (every row still current on the transaction axis).
 *
 * **Details**
 *
 * The row open on both axes wins when there is one — after an out-of-order
 * arrival the highest version is the late OLDER fact, and superseding that
 * instead of the standing head would rewrite history at the wrong end. When no
 * row is valid-open (the fact was closed by a fact-became-false correction) the
 * highest version stands in, so a closed head can still be corrected.
 *
 * **Example** (Function typeof check)
 *
 * ```ts
 * import { supersessionHeadOf } from "./EdgeAuthority.repo.ts"
 *
 * console.log(typeof supersessionHeadOf) // "function"
 * ```
 *
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const supersessionHeadOf = (current: ReadonlyArray<EdgeVersion>): O.Option<EdgeVersion> =>
  pipe(
    openHeadOf(current),
    O.orElse(() => pipe(current, A.sort(byVersion), A.last))
  );

/**
 * Out-of-order donor rule (Graphiti `edge_operations.py:820-839`): a late fact
 * whose valid time starts BEFORE the standing head's is inserted already closed
 * at the head's `validFrom` rather than displacing it. A caller-supplied
 * `validTo` that already ends at or before the head is kept — it is more
 * specific than the rule's default — and any other command inserts its interval
 * as given.
 */
const recordValidTo = (command: RecordEdgeFact, versions: ReadonlyArray<EdgeVersion>): O.Option<DateTime.Utc> =>
  pipe(
    openHeadOf(versions),
    O.filter((head) => earlierThan(command.validFrom, head.validFrom)),
    O.match({
      onNone: () => command.validTo,
      onSome: (head) =>
        pipe(
          command.validTo,
          O.filter((validTo) => notLaterThan(validTo, head.validFrom)),
          O.orElse(() => O.some(head.validFrom))
        ),
    })
  );

const constraintNameOf = (operation: EdgeAuthorityOperation, cause: unknown): O.Option<string> =>
  PostgresError.fromUnknown(operation, cause).constraintName;

/**
 * Normalize one write failure. Typed failures raised by the transaction body
 * pass through untouched; a driver failure is classified by the constraint NAME
 * Postgres reported, and a failure that names no constraint is an availability
 * problem rather than a rejection.
 */
const normalizeWriteFailure =
  (operation: EdgeWriteOperation, logicalKey: LogicalEdgeKey, expectedVersion: PosInt) =>
  (cause: unknown): EdgeAuthorityError =>
    Match.value(cause).pipe(
      Match.when(EdgeAuthorityError.is, (typed) => typed),
      Match.orElse((driverCause) =>
        pipe(
          constraintNameOf(operation, driverCause),
          O.match({
            onNone: () =>
              EdgeRepositoryUnavailable.during(
                operation,
                `${operation} failed against ${EDGE_TABLE_NAME}`,
                driverCause
              ),
            // Three names mean "another writer got there first"; every other name
            // describes a malformed write.
            //
            // The open-head index and the valid-interval exclusion constraint are
            // the two obvious ones. The third — the `(logical_key, version)`
            // unique constraint — is unreachable for a lone writer, because the
            // version is always derived as `max + 1` over the rows this very
            // transaction locked. A duplicate can therefore only mean a
            // concurrent writer committed that version first, which is the same
            // lost race and the same caller recovery: re-read the head, re-derive
            // the version, try again. Two creators of one brand-new key hit this
            // one rather than the open-head index, because both compute version 1
            // and the btree unique index is checked first (proven by race B of
            // EdgeAuthority.pg.test.ts on real Postgres).
            onSome: (constraintName) =>
              Match.value(constraintName).pipe(
                Match.whenOr(
                  "epistemic_edge_open_head_idx",
                  "epistemic_edge_no_overlap",
                  "epistemic_edge_logical_version_unique",
                  () => SupersessionConflict.backstop(logicalKey, expectedVersion, driverCause)
                ),
                Match.orElse((name) => EdgeConstraintViolation.on(operation, name))
              ),
          })
        )
      )
    );

const writeFailure =
  (operation: EdgeWriteOperation, logicalKey: LogicalEdgeKey, expectedVersion: PosInt) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, EdgeAuthorityError, R> =>
    Effect.mapError(effect, normalizeWriteFailure(operation, logicalKey, expectedVersion));

const readUnavailable =
  (operation: EdgeAuthorityOperation) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, EdgeRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Epistemic EdgeAuthority repository dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: EDGE_TABLE_NAME, cause })
        )
      ),
      Effect.mapError((cause) =>
        EdgeRepositoryUnavailable.during(operation, `${operation} failed against ${EDGE_TABLE_NAME}`, cause)
      )
    );

const persistedOrSeed = (rows: ReadonlyArray<EdgeVersionRow>, seed: EdgeVersion): EdgeVersion =>
  pipe(
    rows,
    A.head,
    O.map(fromEdgeVersionRow),
    O.getOrElse(() => seed)
  );

type EdgeAuthorityTransaction = PgEffectTransaction<EffectPgQueryEffectHKT, EffectPgQueryResultHKT, EmptyRelations>;

type SupersedeEdgeFactResult = {
  readonly former: EdgeVersion;
  readonly replacement: EdgeVersion;
};

type SupersedeEdgeFactInTransaction = {
  (
    command: SupersedeEdgeFact
  ): (tx: EdgeAuthorityTransaction) => Effect.Effect<SupersedeEdgeFactResult, EdgeAuthorityError>;
  (
    tx: EdgeAuthorityTransaction,
    command: SupersedeEdgeFact
  ): Effect.Effect<SupersedeEdgeFactResult, EdgeAuthorityError>;
};

/**
 * Execute the conflict-safe close-and-insert supersession primitive inside a
 * caller-owned transaction.
 *
 * **Details**
 *
 * This is intentionally server-private: it lets higher-level workflows append
 * their own outcome record in the same transaction without duplicating edge
 * authority logic or exposing a transaction handle through a public port.
 *
 * **Example** (Caller transaction wrapper)
 *
 * ```ts
 * import { supersedeEdgeFactInTransaction } from "./EdgeAuthority.repo.ts"
 *
 * const runInsideCallerTransaction = (
 *   tx: Parameters<typeof supersedeEdgeFactInTransaction>[0],
 *   command: Parameters<typeof supersedeEdgeFactInTransaction>[1]
 * ) => supersedeEdgeFactInTransaction(tx, command)
 *
 * console.log(typeof runInsideCallerTransaction) // "function"
 * ```
 *
 * @effects Locks and closes the current edge head, then inserts its replacement
 * inside the caller-owned transaction.
 * @internal
 * @category repositories
 * @since 0.0.0
 */
export const supersedeEdgeFactInTransaction: SupersedeEdgeFactInTransaction = dual(
  2,
  (
    tx: EdgeAuthorityTransaction,
    command: SupersedeEdgeFact
  ): Effect.Effect<SupersedeEdgeFactResult, EdgeAuthorityError> => {
    const logicalKey = logicalEdgeKey(command.identity);
    return Effect.gen(function* () {
      const currentRows = yield* tx
        .select()
        .from(edgeTable)
        .where(and(eq(edgeTable.logicalKey, logicalKey), isNull(edgeTable.expiredAt)))
        .for("update");
      const head = supersessionHeadOf(A.map(currentRows, fromEdgeVersionRow));
      if (O.isNone(head)) {
        return yield* SupersessionConflict.lockLoser(logicalKey, command.expectedVersion);
      }
      if (!Equal.equals(head.value.version, command.expectedVersion)) {
        return yield* SupersessionConflict.staleVersion(logicalKey, command.expectedVersion, head.value.version);
      }

      const closed = yield* tx
        .update(edgeTable)
        .set({ expiredAt: DateTime.toEpochMillis(command.recordedAt) })
        .where(and(eq(edgeTable.id, head.value.id), isNull(edgeTable.expiredAt)))
        .returning();
      if (A.length(closed) === 0) {
        return yield* SupersessionConflict.lockLoser(logicalKey, command.expectedVersion);
      }
      const former = persistedOrSeed(
        closed,
        EdgeVersion.make({ ...head.value, expiredAt: O.some(command.recordedAt) })
      );

      const seed = buildEdgeVersion(command, {
        logicalKey,
        supersedesId: O.some(head.value.id),
        validTo: command.validTo,
        version: PosInt.make(head.value.version + 1),
      });
      const inserted = yield* tx.insert(edgeTable).values(toEdgeVersionInsert(seed)).returning();
      return { former, replacement: persistedOrSeed(inserted, seed) };
    }).pipe(writeFailure("supersede", logicalKey, command.expectedVersion));
  }
);

/**
 * Build the Drizzle-backed bitemporal edge authority repository.
 *
 * **Example** (Build Effect repository)
 *
 * ```ts
 * import { makeDrizzleEdgeAuthorityRepository } from "@beep/epistemic-server/EdgeAuthority"
 * import { Effect } from "effect"
 *
 * const program = makeDrizzleEdgeAuthorityRepository().pipe(
 *   Effect.map((repository) => typeof repository.supersede === "function")
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @effects Requires `PostgresDrizzle`. Reads run as single statements; `record`
 * and `supersede` each run one serialized `FOR UPDATE` transaction that closes
 * and inserts atomically, and driver failures are classified by constraint name
 * into `SupersessionConflict`, `EdgeConstraintViolation`, or
 * `EdgeRepositoryUnavailable`.
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleEdgeAuthorityRepository = Effect.fn("Epistemic.EdgeAuthority.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  // One in-process writer at a time. The database backstops are the real
  // guarantee — they hold against writers this process never sees — but
  // serializing local writes keeps the common case out of the conflict path
  // instead of making every concurrent caller re-read and retry.
  const writeSemaphore = Semaphore.makeUnsafe(1);

  const readAsOfAt = Effect.fn("Epistemic.EdgeAuthority.readAsOfAt")(function* (
    operation: EdgeAuthorityOperation,
    logicalKey: LogicalEdgeKey,
    validAt: number,
    knownAt: number
  ) {
    const rows = yield* db
      .select()
      .from(edgeTable)
      .where(asOfWhere(logicalKey, validAt, knownAt))
      .pipe(readUnavailable(operation));
    return pipe(rows, A.head, O.map(fromEdgeVersionRow));
  });

  return EdgeAuthorityRepository.of({
    readAsOf: Effect.fn("Epistemic.EdgeAuthority.readAsOf")(function* (query) {
      return yield* readAsOfAt(
        "readAsOf",
        query.logicalKey,
        DateTime.toEpochMillis(query.validAt),
        DateTime.toEpochMillis(query.knownAt)
      );
    }),
    readLatest: Effect.fn("Epistemic.EdgeAuthority.readLatest")(function* (logicalKey) {
      const now = DateTime.toEpochMillis(yield* DateTime.now);
      return yield* readAsOfAt("readLatest", logicalKey, now, now);
    }),
    record: Effect.fn("Epistemic.EdgeAuthority.record")(function* (command) {
      const logicalKey = logicalEdgeKey(command.identity);
      return yield* writeSemaphore.withPermit(
        db
          .transaction(
            Effect.fnUntraced(function* (tx) {
              const rows = yield* tx.select().from(edgeTable).where(eq(edgeTable.logicalKey, logicalKey)).for("update");
              const versions = A.map(rows, fromEdgeVersionRow);
              const version = nextVersionAfter(versions);
              const seed = buildEdgeVersion(command, {
                logicalKey,
                supersedesId: O.none(),
                validTo: recordValidTo(command, versions),
                version,
              });
              const inserted = yield* tx
                .insert(edgeTable)
                .values(toEdgeVersionInsert(seed))
                .returning()
                // A `record` carries no caller expectation about the head, so a
                // backstop rejection reports the version this write attempted:
                // that is what the losing writer must re-derive before it tries
                // again.
                .pipe(writeFailure("record", logicalKey, version));
              return persistedOrSeed(inserted, seed);
            })
          )
          // Residual transaction-level failures only; the statements inside
          // already carry their own classification, and typed failures pass
          // through this mapper untouched.
          .pipe(writeFailure("record", logicalKey, PosInt.make(1)))
      );
    }),
    supersede: Effect.fn("Epistemic.EdgeAuthority.supersede")(function* (command) {
      const logicalKey = logicalEdgeKey(command.identity);
      const result = yield* writeSemaphore.withPermit(
        db
          .transaction((tx) => supersedeEdgeFactInTransaction(tx, command))
          .pipe(writeFailure("supersede", logicalKey, command.expectedVersion))
      );
      return result.replacement;
    }),
  });
});
