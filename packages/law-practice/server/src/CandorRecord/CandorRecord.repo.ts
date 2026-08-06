/**
 * Candor record repository adapters whose surface is append and read only in
 * both variants, because a filed decision is never edited: a newer observation is a new event, a revised
 * judgment is a new disposition naming the one it supersedes, and a supplement
 * or correction is its own submission act with its own operative date. The
 * migration backs the same rule with `BEFORE UPDATE OR DELETE` triggers, so
 * neither adapter ever issues an UPDATE or a DELETE.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { CitingApplicationIdentity } from "@beep/law-practice-domain";
import { DbSchema } from "@beep/law-practice-tables";
import {
  fromCandorDispositionRow,
  toCandorDispositionInsert,
} from "@beep/law-practice-tables/entities/CandorDisposition";
import {
  fromIdsSubmissionFactRow,
  toIdsSubmissionFactInsert,
} from "@beep/law-practice-tables/entities/IdsSubmissionFact";
import {
  fromPatentCitationEventRow,
  toPatentCitationEventInsert,
} from "@beep/law-practice-tables/entities/PatentCitationEvent";
import {
  CandorRecordRepositoryShape,
  CandorRecordRepositoryUnavailable,
} from "@beep/law-practice-use-cases/CandorRecord";
import { PostgresDrizzle } from "@beep/postgres";
import { asc, eq } from "drizzle-orm";
import { Effect, flow, Order, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { CandorDisposition, IdsSubmissionFact, PatentCitationEvent } from "@beep/law-practice-domain";
import type { CandorRecordOperation } from "@beep/law-practice-use-cases/CandorRecord";
import type { Result } from "effect";

const dispositionTable = DbSchema.candorDisposition;
const eventTable = DbSchema.patentCitationEvent;
const submissionFactTable = DbSchema.idsSubmissionFact;

// Named per operation rather than per adapter so a dropped driver failure says
// which physical table refused the request, whichever direction it was going.
const tableNameFor: Record<CandorRecordOperation, string> = {
  listDispositions: "law_practice_candor_disposition",
  listEvents: "law_practice_patent_citation_event",
  listSubmissionFacts: "law_practice_ids_submission_fact",
  recordDisposition: "law_practice_candor_disposition",
  recordEvent: "law_practice_patent_citation_event",
  recordSubmissionFact: "law_practice_ids_submission_fact",
};

const repositoryUnavailable =
  (operation: CandorRecordOperation) =>
  <Value, E, R>(effect: Effect.Effect<Value, E, R>): Effect.Effect<Value, CandorRecordRepositoryUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Law-practice CandorRecord repository dropped driver failure").pipe(
          Effect.annotateLogs({ cause, operation, table: tableNameFor[operation] })
        )
      ),
      Effect.mapError((cause) =>
        CandorRecordRepositoryUnavailable.during(
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
  operation: CandorRecordOperation,
  decode: (row: unknown) => Result.Result<Entity, S.SchemaError>
): Effect.Effect<ReadonlyArray<Entity>, CandorRecordRepositoryUnavailable> =>
  Effect.forEach(rows, flow(decode, Effect.fromResult)).pipe(repositoryUnavailable(operation));

/** Decode the row an append returned, falling back to the appended value. */
const decodeAppended = <Entity>(
  rows: ReadonlyArray<unknown>,
  operation: CandorRecordOperation,
  decode: (row: unknown) => Result.Result<Entity, S.SchemaError>,
  appended: Entity
): Effect.Effect<Entity, CandorRecordRepositoryUnavailable> =>
  pipe(
    rows,
    A.head,
    O.map(flow(decode, Effect.fromResult)),
    // The database assigns the SERIAL id, so the returned row is the authority;
    // the appended value only stands in if the driver returned none.
    O.getOrElse((): Effect.Effect<Entity, S.SchemaError> => Effect.succeed(appended)),
    repositoryUnavailable(operation)
  );

// Reads are keyed by one exact citing-application representation, so the filter
// value is encoded through the schema that wrote the column rather than
// hand-built as JSON.
const encodeCitingApplication = S.encodeEffect(CitingApplicationIdentity);
const sameFiling = S.toEquivalence(CitingApplicationIdentity);

// The in-memory sibling orders by the same key the Drizzle variant does, so a
// read proved here cannot pass in memory and fail against the database.
const byIdAscending = Order.mapInput(Order.Number, (record: { readonly id: number }) => record.id);

const filedUnder = <Entity extends { readonly citingApplication: CitingApplicationIdentity; readonly id: number }>(
  records: ReadonlyArray<Entity>,
  citingApplication: CitingApplicationIdentity
): ReadonlyArray<Entity> =>
  pipe(
    records,
    A.filter((record) => sameFiling(record.citingApplication, citingApplication)),
    A.sort(byIdAscending)
  );

/**
 * Build the in-memory candor record repository.
 *
 * **When to use**
 *
 * Use when the append-and-read-only contract is what is under test and SQL is
 * not: the durable-row proof runs against the Drizzle variant, and this one
 * keeps the gate's read scoping honest at unit speed with no database.
 *
 * **Gotchas**
 *
 * Reads are ordered by `id` ascending to match the Drizzle variant's
 * `ORDER BY id ASC`, but no id is assigned here — the appended value supplies
 * its own — so nothing that depends on a database-assigned identity can be
 * proved against this variant.
 *
 * **Example** (Read an empty store scoped to one filing)
 *
 * ```ts
 * import { CitingApplicationIdentity } from "@beep/law-practice-domain"
 * import { makeInMemoryCandorRecordRepository } from "@beep/law-practice-server/CandorRecord"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.gen(function* () {
 *   const repository = yield* makeInMemoryCandorRecordRepository()
 *   const filing = yield* S.decodeUnknownEffect(CitingApplicationIdentity)({
 *     applicationNumber: "16138242",
 *     kind: "UsptoNormalized",
 *   })
 *   return yield* repository.listEvents(filing)
 * })
 *
 * Effect.runPromise(program).then((events) => console.log(events.length)) // 0
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeInMemoryCandorRecordRepository = Effect.fn("CandorRecord.makeInMemory")(function* () {
  const dispositions = yield* Ref.make<ReadonlyArray<CandorDisposition>>([]);
  const events = yield* Ref.make<ReadonlyArray<PatentCitationEvent>>([]);
  const submissionFacts = yield* Ref.make<ReadonlyArray<IdsSubmissionFact>>([]);

  return CandorRecordRepositoryShape.make({
    listDispositions: Effect.fn("CandorRecord.listDispositions")(function* (
      citingApplication: CitingApplicationIdentity
    ) {
      return filedUnder(yield* Ref.get(dispositions), citingApplication);
    }),
    listEvents: Effect.fn("CandorRecord.listEvents")(function* (citingApplication: CitingApplicationIdentity) {
      return filedUnder(yield* Ref.get(events), citingApplication);
    }),
    listSubmissionFacts: Effect.fn("CandorRecord.listSubmissionFacts")(function* (
      citingApplication: CitingApplicationIdentity
    ) {
      return filedUnder(yield* Ref.get(submissionFacts), citingApplication);
    }),
    recordDisposition: Effect.fn("CandorRecord.recordDisposition")(function* (disposition: CandorDisposition) {
      yield* Ref.update(dispositions, A.append(disposition));
      return disposition;
    }),
    recordEvent: Effect.fn("CandorRecord.recordEvent")(function* (event: PatentCitationEvent) {
      yield* Ref.update(events, A.append(event));
      return event;
    }),
    recordSubmissionFact: Effect.fn("CandorRecord.recordSubmissionFact")(function* (fact: IdsSubmissionFact) {
      yield* Ref.update(submissionFacts, A.append(fact));
      return fact;
    }),
  });
});

/**
 * Build the Drizzle-backed candor record repository.
 *
 * **Details**
 *
 * Every read is filtered by one exact citing-application representation,
 * encoded through `CitingApplicationIdentity` so the jsonb comparison value is
 * produced by the same codec that wrote the column, and ordered by `id`
 * ascending so a filing's records read back in the order they were appended.
 *
 * **Gotchas**
 *
 * Nothing here matches across representations: a filing recorded as a
 * normalized USPTO number is not found by its WIPO ST.13 form. Reconciling the
 * two is a named follow-on, never a silent equality rule.
 *
 * **Example** (Build the adapter without touching a database)
 *
 * ```ts
 * import { makeCandorRecordRepository } from "@beep/law-practice-server/CandorRecord"
 * import { Effect } from "effect"
 *
 * const program = makeCandorRecordRepository().pipe(
 *   Effect.map((repository) => typeof repository.recordEvent === "function")
 * )
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeCandorRecordRepository = Effect.fn("CandorRecord.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return CandorRecordRepositoryShape.make({
    listDispositions: Effect.fn("CandorRecord.drizzleListDispositions")(function* (
      citingApplication: CitingApplicationIdentity
    ) {
      const filing = yield* encodeCitingApplication(citingApplication).pipe(repositoryUnavailable("listDispositions"));
      const rows = yield* db
        .select()
        .from(dispositionTable)
        .where(eq(dispositionTable.citingApplication, filing))
        .orderBy(asc(dispositionTable.id))
        .pipe(repositoryUnavailable("listDispositions"));
      return yield* decodeRows(rows, "listDispositions", fromCandorDispositionRow);
    }),
    listEvents: Effect.fn("CandorRecord.drizzleListEvents")(function* (citingApplication: CitingApplicationIdentity) {
      const filing = yield* encodeCitingApplication(citingApplication).pipe(repositoryUnavailable("listEvents"));
      const rows = yield* db
        .select()
        .from(eventTable)
        .where(eq(eventTable.citingApplication, filing))
        .orderBy(asc(eventTable.id))
        .pipe(repositoryUnavailable("listEvents"));
      return yield* decodeRows(rows, "listEvents", fromPatentCitationEventRow);
    }),
    listSubmissionFacts: Effect.fn("CandorRecord.drizzleListSubmissionFacts")(function* (
      citingApplication: CitingApplicationIdentity
    ) {
      const filing = yield* encodeCitingApplication(citingApplication).pipe(
        repositoryUnavailable("listSubmissionFacts")
      );
      const rows = yield* db
        .select()
        .from(submissionFactTable)
        .where(eq(submissionFactTable.citingApplication, filing))
        .orderBy(asc(submissionFactTable.id))
        .pipe(repositoryUnavailable("listSubmissionFacts"));
      return yield* decodeRows(rows, "listSubmissionFacts", fromIdsSubmissionFactRow);
    }),
    recordDisposition: Effect.fn("CandorRecord.drizzleRecordDisposition")(function* (disposition: CandorDisposition) {
      const insert = yield* Effect.fromResult(toCandorDispositionInsert(disposition)).pipe(
        repositoryUnavailable("recordDisposition")
      );
      const rows = yield* db
        .insert(dispositionTable)
        .values(insert)
        .returning()
        .pipe(repositoryUnavailable("recordDisposition"));
      return yield* decodeAppended(rows, "recordDisposition", fromCandorDispositionRow, disposition);
    }),
    recordEvent: Effect.fn("CandorRecord.drizzleRecordEvent")(function* (event: PatentCitationEvent) {
      const insert = yield* Effect.fromResult(toPatentCitationEventInsert(event)).pipe(
        repositoryUnavailable("recordEvent")
      );
      const rows = yield* db.insert(eventTable).values(insert).returning().pipe(repositoryUnavailable("recordEvent"));
      return yield* decodeAppended(rows, "recordEvent", fromPatentCitationEventRow, event);
    }),
    recordSubmissionFact: Effect.fn("CandorRecord.drizzleRecordSubmissionFact")(function* (fact: IdsSubmissionFact) {
      const insert = yield* Effect.fromResult(toIdsSubmissionFactInsert(fact)).pipe(
        repositoryUnavailable("recordSubmissionFact")
      );
      const rows = yield* db
        .insert(submissionFactTable)
        .values(insert)
        .returning()
        .pipe(repositoryUnavailable("recordSubmissionFact"));
      return yield* decodeAppended(rows, "recordSubmissionFact", fromIdsSubmissionFactRow, fact);
    }),
  });
});
