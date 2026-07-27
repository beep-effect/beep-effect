/**
 * Execution ledger repository adapter.
 *
 * Every method here is an append or a read — the adapter has no vocabulary for
 * update or delete, and the tables would reject both by trigger if it did. What
 * the database rejects it rejects by NAME — the chain primary key, the
 * outcome-per-decision primary key, the composite decision foreign key — and
 * those names are mapped to typed errors here rather than parsed out of driver
 * message prose.
 *
 * @packageDocumentation
 * @category repositories
 * @since 0.0.0
 */

import { DbSchema } from "@beep/epistemic-tables";
import {
  fromExecutionDecisionRow,
  fromExecutionOutcomeRow,
  toExecutionDecisionInsert,
  toExecutionOutcomeInsert,
} from "@beep/epistemic-tables/values/ExecutionRecord";
import {
  ExecutionLedger,
  ExecutionLedgerConstraintViolation,
  ExecutionLedgerUnavailable,
} from "@beep/epistemic-use-cases/ExecutionLedger";
import { PostgresDrizzle, PostgresError } from "@beep/postgres";
import { A, O } from "@beep/utils";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Effect, pipe } from "effect";
import type { ExecutionLedgerError, ExecutionLedgerOperation } from "@beep/epistemic-use-cases/ExecutionLedger";

const decisionTable = DbSchema.executionDecision;
const outcomeTable = DbSchema.executionOutcome;

const DECISION_TABLE_NAME = "epistemic_execution_decision" as const;
const OUTCOME_TABLE_NAME = "epistemic_execution_outcome" as const;

const constraintNameOf = (operation: ExecutionLedgerOperation, cause: unknown): O.Option<string> =>
  PostgresError.fromUnknown(operation, cause).constraintName;

const writeFailure =
  (operation: ExecutionLedgerOperation, tableName: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ExecutionLedgerError, R> =>
    Effect.mapError(effect, (cause) =>
      pipe(
        constraintNameOf(operation, cause),
        O.match({
          onNone: () => ExecutionLedgerUnavailable.during(operation, `${operation} failed against ${tableName}`, cause),
          onSome: (constraintName) => ExecutionLedgerConstraintViolation.on(operation, constraintName),
        })
      )
    );

const readUnavailable =
  (operation: ExecutionLedgerOperation, tableName: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ExecutionLedgerUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Epistemic ExecutionLedger repository dropped driver failure").pipe(
          Effect.annotateLogs({ cause, operation, table: tableName })
        )
      ),
      Effect.mapError((cause) =>
        ExecutionLedgerUnavailable.during(operation, `${operation} failed against ${tableName}`, cause)
      )
    );

/**
 * Build the Drizzle-backed execution ledger repository.
 *
 * @example
 * ```ts
 * import { makeDrizzleExecutionLedger } from "@beep/epistemic-server/ExecutionLedger"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(makeDrizzleExecutionLedger()))
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeDrizzleExecutionLedger = Effect.fn("Epistemic.ExecutionLedger.makeDrizzle")(function* () {
  const db = yield* PostgresDrizzle;

  return ExecutionLedger.of({
    appendDecision: Effect.fn("Epistemic.ExecutionLedger.appendDecision")(function* (record) {
      yield* db
        .insert(decisionTable)
        .values(toExecutionDecisionInsert(record))
        .pipe(writeFailure("appendDecision", DECISION_TABLE_NAME));
    }),
    appendOutcome: Effect.fn("Epistemic.ExecutionLedger.appendOutcome")(function* (record) {
      yield* db
        .insert(outcomeTable)
        .values(toExecutionOutcomeInsert(record))
        .pipe(writeFailure("appendOutcome", OUTCOME_TABLE_NAME));
    }),
    readDecisions: Effect.fn("Epistemic.ExecutionLedger.readDecisions")(function* (runKey) {
      const rows = yield* db
        .select()
        .from(decisionTable)
        .where(eq(decisionTable.runKey, runKey))
        .orderBy(asc(decisionTable.seq))
        .pipe(readUnavailable("readDecisions", DECISION_TABLE_NAME));
      return A.map(rows, fromExecutionDecisionRow);
    }),
    readOutcomes: Effect.fn("Epistemic.ExecutionLedger.readOutcomes")(function* (runKey) {
      const rows = yield* db
        .select()
        .from(outcomeTable)
        .where(eq(outcomeTable.runKey, runKey))
        .orderBy(asc(outcomeTable.recordedAt))
        .pipe(readUnavailable("readOutcomes", OUTCOME_TABLE_NAME));
      return A.map(rows, fromExecutionOutcomeRow);
    }),
    readUnsettledAllowed: Effect.fn("Epistemic.ExecutionLedger.readUnsettledAllowed")(function* (runKey) {
      // Scoped to allowed decisions on purpose: a refused dispatch legitimately
      // has no outcome row, and an unscoped LEFT JOIN would report every
      // ordinary denial as "outcome unknown".
      const rows = yield* db
        .select({ decision: decisionTable })
        .from(decisionTable)
        .leftJoin(outcomeTable, eq(outcomeTable.decisionHash, decisionTable.hash))
        .where(
          and(eq(decisionTable.runKey, runKey), eq(decisionTable.verdict, "allowed"), isNull(outcomeTable.decisionHash))
        )
        .orderBy(asc(decisionTable.seq))
        .pipe(readUnavailable("readUnsettledAllowed", DECISION_TABLE_NAME));
      return A.map(rows, (row) => fromExecutionDecisionRow(row.decision));
    }),
  });
});
