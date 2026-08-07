/**
 * Legal position record repository adapters whose surface is append and read
 * only in both variants, because nothing the legal position runtime records is
 * ever edited: a stored relation is superseded by a new record rather than
 * amended, a frame is one interpreter's reading and a later reading is its own,
 * an exercise records an attempt and a determination about it is a separate
 * fact, a correction is revised by appending a delta that names it, and a
 * candidate gains a priority basis or a verdict family by appending, never by
 * merging. The migration backs the same rule with `BEFORE UPDATE OR DELETE`
 * triggers, so neither adapter ever issues an UPDATE or a DELETE.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DbSchema } from "@beep/law-practice-tables";
import { fromActFrameRow, toActFrameInsert } from "@beep/law-practice-tables/entities/ActFrame";
import { fromCorrectionDeltaRow, toCorrectionDeltaInsert } from "@beep/law-practice-tables/entities/CorrectionDelta";
import {
  fromLegalOppositionCandidateRow,
  toLegalOppositionCandidateInsert,
} from "@beep/law-practice-tables/entities/LegalOppositionCandidate";
import {
  fromLegalPositionRelatorRow,
  toLegalPositionRelatorInsert,
} from "@beep/law-practice-tables/entities/LegalPositionRelator";
import { fromPowerExerciseRow, toPowerExerciseInsert } from "@beep/law-practice-tables/entities/PowerExercise";
import {
  LegalPositionRecordRepositoryShape,
  LegalPositionRecordRepositoryUnavailable,
} from "@beep/law-practice-use-cases/LegalPositionRecord";
import { PostgresDrizzle } from "@beep/postgres";
import { and, asc, eq } from "drizzle-orm";
import { Effect, flow, Order, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type {
  ActFrame,
  CorrectionDelta,
  LegalOppositionCandidate,
  LegalPositionRelator,
  PowerExercise,
} from "@beep/law-practice-domain";
import type {
  ActFrameRecordScope,
  LegalPositionRecordOperation,
  LegalPositionRecordScope,
} from "@beep/law-practice-use-cases/LegalPositionRecord";
import type { Result } from "effect";
import type * as S from "effect/Schema";

const candidateTable = DbSchema.legalOppositionCandidate;
const correctionTable = DbSchema.correctionDelta;
const exerciseTable = DbSchema.powerExercise;
const frameTable = DbSchema.actFrame;
const relatorTable = DbSchema.legalPositionRelator;

// Named per operation rather than per adapter so a dropped driver failure says
// which physical table refused the request, whichever direction it was going.
const tableNameFor: Record<LegalPositionRecordOperation, string> = {
  listCorrections: "law_practice_correction_delta",
  listExercises: "law_practice_power_exercise",
  listFrames: "law_practice_act_frame",
  listOppositionCandidates: "law_practice_legal_opposition_candidate",
  listRelators: "law_practice_legal_position_relator",
  recordCorrection: "law_practice_correction_delta",
  recordExercise: "law_practice_power_exercise",
  recordFrame: "law_practice_act_frame",
  recordOppositionCandidate: "law_practice_legal_opposition_candidate",
  recordRelator: "law_practice_legal_position_relator",
};

const repositoryUnavailable =
  (operation: LegalPositionRecordOperation) =>
  <Value, E, R>(
    effect: Effect.Effect<Value, E, R>
  ): Effect.Effect<Value, LegalPositionRecordRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Law-practice LegalPositionRecord repository dropped driver failure").pipe(
          Effect.annotateLogs({ cause, operation, table: tableNameFor[operation] })
        )
      ),
      Effect.mapError((cause) =>
        LegalPositionRecordRepositoryUnavailable.during(
          operation,
          `${operation} failed against ${tableNameFor[operation]}`,
          cause
        )
      )
    );

/**
 * Decode every selected row through its entity schema.
 *
 * The driver's declared column types are not trusted: a jsonb column hands back
 * whatever the database holds, so a row that no longer decodes is a repository
 * failure rather than a silently-shaped value.
 */
const decodeRows = <Entity>(
  rows: ReadonlyArray<unknown>,
  operation: LegalPositionRecordOperation,
  decode: (row: unknown) => Result.Result<Entity, S.SchemaError>
): Effect.Effect<ReadonlyArray<Entity>, LegalPositionRecordRepositoryUnavailable> =>
  Effect.forEach(rows, flow(decode, Effect.fromResult)).pipe(repositoryUnavailable(operation));

/** Decode the row an append returned, falling back to the appended value. */
const decodeAppended = <Entity>(
  rows: ReadonlyArray<unknown>,
  operation: LegalPositionRecordOperation,
  decode: (row: unknown) => Result.Result<Entity, S.SchemaError>,
  appended: Entity
): Effect.Effect<Entity, LegalPositionRecordRepositoryUnavailable> =>
  pipe(
    rows,
    A.head,
    O.map(flow(decode, Effect.fromResult)),
    // The database assigns the SERIAL id, so the returned row is the authority;
    // the appended value only stands in if the driver returned none.
    O.getOrElse((): Effect.Effect<Entity, S.SchemaError> => Effect.succeed(appended)),
    repositoryUnavailable(operation)
  );

// The in-memory sibling orders by the same key the Drizzle variant does, so a
// read proved here cannot pass in memory and fail against the database. The
// order is the order records were appended; it is never a ranking.
const byIdAscending = Order.mapInput(Order.Number, (record: { readonly id: number }) => record.id);

// A read is scoped by organization first, always. Two tenants can record
// positions about the same norm and the same act, so an unscoped read would
// merge two legal pictures into one.
const heldBy = <Entity extends { readonly id: number; readonly orgId: number }>(
  records: ReadonlyArray<Entity>,
  scope: LegalPositionRecordScope
): ReadonlyArray<Entity> =>
  pipe(
    records,
    A.filter((record) => record.orgId === scope.orgId),
    A.sort(byIdAscending)
  );

// The two frame-keyed reads narrow the tenant scope by the frame the records
// cite, so an exercise attempted under one reading is never returned for
// another.
const citingFrame = <Entity extends { readonly frame: number; readonly id: number; readonly orgId: number }>(
  records: ReadonlyArray<Entity>,
  scope: ActFrameRecordScope
): ReadonlyArray<Entity> =>
  pipe(
    records,
    A.filter((record) => record.orgId === scope.orgId && record.frame === scope.frame),
    A.sort(byIdAscending)
  );

/**
 * Build the in-memory legal position record repository.
 *
 * **When to use**
 *
 * Use when the append-and-read-only contract is what is under test and SQL is
 * not: the durable-row proof runs against the Drizzle variant, and this one
 * keeps the tenant and frame scoping honest at unit speed with no database.
 *
 * **Gotchas**
 *
 * Reads are ordered by `id` ascending to match the Drizzle variant's
 * `ORDER BY id ASC`, but no id is assigned here — the appended value supplies
 * its own — so nothing that depends on a database-assigned identity can be
 * proved against this variant.
 *
 * **Example** (Read an empty store scoped to one organization)
 *
 * ```ts
 * import { makeInMemoryLegalPositionRecordRepository } from "@beep/law-practice-server/LegalPositionRecord"
 * import { LegalPositionRecordScope } from "@beep/law-practice-use-cases/LegalPositionRecord"
 * import * as Shared from "@beep/shared-domain/identity/Shared"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* makeInMemoryLegalPositionRecordRepository()
 *   return yield* repository.listRelators(
 *     LegalPositionRecordScope.make({ orgId: Shared.OrganizationId.make(1) })
 *   )
 * })
 *
 * Effect.runPromise(program).then((relators) => console.log(relators.length)) // 0
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryLegalPositionRecordRepository = Effect.fn("LegalPositionRecord.makeInMemory")(function* () {
  const candidates = yield* Ref.make<ReadonlyArray<LegalOppositionCandidate>>([]);
  const corrections = yield* Ref.make<ReadonlyArray<CorrectionDelta>>([]);
  const exercises = yield* Ref.make<ReadonlyArray<PowerExercise>>([]);
  const frames = yield* Ref.make<ReadonlyArray<ActFrame>>([]);
  const relators = yield* Ref.make<ReadonlyArray<LegalPositionRelator>>([]);

  return LegalPositionRecordRepositoryShape.make({
    listCorrections: Effect.fn("LegalPositionRecord.listCorrections")(function* (scope: ActFrameRecordScope) {
      return citingFrame(yield* Ref.get(corrections), scope);
    }),
    listExercises: Effect.fn("LegalPositionRecord.listExercises")(function* (scope: ActFrameRecordScope) {
      return citingFrame(yield* Ref.get(exercises), scope);
    }),
    listFrames: Effect.fn("LegalPositionRecord.listFrames")(function* (scope: LegalPositionRecordScope) {
      return heldBy(yield* Ref.get(frames), scope);
    }),
    listOppositionCandidates: Effect.fn("LegalPositionRecord.listOppositionCandidates")(function* (
      scope: LegalPositionRecordScope
    ) {
      return heldBy(yield* Ref.get(candidates), scope);
    }),
    listRelators: Effect.fn("LegalPositionRecord.listRelators")(function* (scope: LegalPositionRecordScope) {
      return heldBy(yield* Ref.get(relators), scope);
    }),
    recordCorrection: Effect.fn("LegalPositionRecord.recordCorrection")(function* (correction: CorrectionDelta) {
      yield* Ref.update(corrections, A.append(correction));
      return correction;
    }),
    recordExercise: Effect.fn("LegalPositionRecord.recordExercise")(function* (exercise: PowerExercise) {
      yield* Ref.update(exercises, A.append(exercise));
      return exercise;
    }),
    recordFrame: Effect.fn("LegalPositionRecord.recordFrame")(function* (frame: ActFrame) {
      yield* Ref.update(frames, A.append(frame));
      return frame;
    }),
    recordOppositionCandidate: Effect.fn("LegalPositionRecord.recordOppositionCandidate")(function* (
      candidate: LegalOppositionCandidate
    ) {
      yield* Ref.update(candidates, A.append(candidate));
      return candidate;
    }),
    recordRelator: Effect.fn("LegalPositionRecord.recordRelator")(function* (relator: LegalPositionRelator) {
      yield* Ref.update(relators, A.append(relator));
      return relator;
    }),
  });
});

/**
 * Build the Drizzle-backed legal position record repository.
 *
 * **Details**
 *
 * Every read is filtered by organization, the two frame-keyed reads narrow that
 * by the frame the records cite, and all five order by `id` ascending so a
 * scope's records read back in the order they were appended.
 *
 * **Gotchas**
 *
 * `ORDER BY id ASC` is append order and nothing more. For opposition candidates
 * in particular it must never be read as a ranking: the pair inside a candidate
 * is an unordered set, and no priority basis carries an order to sort by.
 *
 * **Example** (Build the adapter without touching a database)
 *
 * ```ts
 * import { makeLegalPositionRecordRepository } from "@beep/law-practice-server/LegalPositionRecord"
 * import { Effect } from "effect"
 *
 * const program = makeLegalPositionRecordRepository().pipe(
 *   Effect.map((repository) => typeof repository.recordRelator === "function")
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeLegalPositionRecordRepository = Effect.fn("LegalPositionRecord.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return LegalPositionRecordRepositoryShape.make({
    listCorrections: Effect.fn("LegalPositionRecord.drizzleListCorrections")(function* (scope: ActFrameRecordScope) {
      const rows = yield* db
        .select()
        .from(correctionTable)
        .where(and(eq(correctionTable.orgId, scope.orgId), eq(correctionTable.frame, scope.frame)))
        .orderBy(asc(correctionTable.id))
        .pipe(repositoryUnavailable("listCorrections"));
      return yield* decodeRows(rows, "listCorrections", fromCorrectionDeltaRow);
    }),
    listExercises: Effect.fn("LegalPositionRecord.drizzleListExercises")(function* (scope: ActFrameRecordScope) {
      const rows = yield* db
        .select()
        .from(exerciseTable)
        .where(and(eq(exerciseTable.orgId, scope.orgId), eq(exerciseTable.frame, scope.frame)))
        .orderBy(asc(exerciseTable.id))
        .pipe(repositoryUnavailable("listExercises"));
      return yield* decodeRows(rows, "listExercises", fromPowerExerciseRow);
    }),
    listFrames: Effect.fn("LegalPositionRecord.drizzleListFrames")(function* (scope: LegalPositionRecordScope) {
      const rows = yield* db
        .select()
        .from(frameTable)
        .where(eq(frameTable.orgId, scope.orgId))
        .orderBy(asc(frameTable.id))
        .pipe(repositoryUnavailable("listFrames"));
      return yield* decodeRows(rows, "listFrames", fromActFrameRow);
    }),
    listOppositionCandidates: Effect.fn("LegalPositionRecord.drizzleListOppositionCandidates")(function* (
      scope: LegalPositionRecordScope
    ) {
      const rows = yield* db
        .select()
        .from(candidateTable)
        .where(eq(candidateTable.orgId, scope.orgId))
        .orderBy(asc(candidateTable.id))
        .pipe(repositoryUnavailable("listOppositionCandidates"));
      return yield* decodeRows(rows, "listOppositionCandidates", fromLegalOppositionCandidateRow);
    }),
    listRelators: Effect.fn("LegalPositionRecord.drizzleListRelators")(function* (scope: LegalPositionRecordScope) {
      const rows = yield* db
        .select()
        .from(relatorTable)
        .where(eq(relatorTable.orgId, scope.orgId))
        .orderBy(asc(relatorTable.id))
        .pipe(repositoryUnavailable("listRelators"));
      return yield* decodeRows(rows, "listRelators", fromLegalPositionRelatorRow);
    }),
    recordCorrection: Effect.fn("LegalPositionRecord.drizzleRecordCorrection")(function* (correction: CorrectionDelta) {
      const insert = yield* Effect.fromResult(toCorrectionDeltaInsert(correction)).pipe(
        repositoryUnavailable("recordCorrection")
      );
      const rows = yield* db
        .insert(correctionTable)
        .values(insert)
        .returning()
        .pipe(repositoryUnavailable("recordCorrection"));
      return yield* decodeAppended(rows, "recordCorrection", fromCorrectionDeltaRow, correction);
    }),
    recordExercise: Effect.fn("LegalPositionRecord.drizzleRecordExercise")(function* (exercise: PowerExercise) {
      const insert = yield* Effect.fromResult(toPowerExerciseInsert(exercise)).pipe(
        repositoryUnavailable("recordExercise")
      );
      const rows = yield* db
        .insert(exerciseTable)
        .values(insert)
        .returning()
        .pipe(repositoryUnavailable("recordExercise"));
      return yield* decodeAppended(rows, "recordExercise", fromPowerExerciseRow, exercise);
    }),
    recordFrame: Effect.fn("LegalPositionRecord.drizzleRecordFrame")(function* (frame: ActFrame) {
      const insert = yield* Effect.fromResult(toActFrameInsert(frame)).pipe(repositoryUnavailable("recordFrame"));
      const rows = yield* db.insert(frameTable).values(insert).returning().pipe(repositoryUnavailable("recordFrame"));
      return yield* decodeAppended(rows, "recordFrame", fromActFrameRow, frame);
    }),
    recordOppositionCandidate: Effect.fn("LegalPositionRecord.drizzleRecordOppositionCandidate")(function* (
      candidate: LegalOppositionCandidate
    ) {
      const insert = yield* Effect.fromResult(toLegalOppositionCandidateInsert(candidate)).pipe(
        repositoryUnavailable("recordOppositionCandidate")
      );
      const rows = yield* db
        .insert(candidateTable)
        .values(insert)
        .returning()
        .pipe(repositoryUnavailable("recordOppositionCandidate"));
      return yield* decodeAppended(rows, "recordOppositionCandidate", fromLegalOppositionCandidateRow, candidate);
    }),
    recordRelator: Effect.fn("LegalPositionRecord.drizzleRecordRelator")(function* (relator: LegalPositionRelator) {
      const insert = yield* Effect.fromResult(toLegalPositionRelatorInsert(relator)).pipe(
        repositoryUnavailable("recordRelator")
      );
      const rows = yield* db
        .insert(relatorTable)
        .values(insert)
        .returning()
        .pipe(repositoryUnavailable("recordRelator"));
      return yield* decodeAppended(rows, "recordRelator", fromLegalPositionRelatorRow, relator);
    }),
  });
});
