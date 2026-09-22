import {
  ExecutionDecisionRecord,
  ExecutionOutcomeRecord,
  sealExecutionDecision,
  sealExecutionOutcome,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import {
  EXECUTION_DECISION_TABLE_NAME,
  EXECUTION_OUTCOME_TABLE_NAME,
  ExecutionRecordConverterError,
  executionDecisionTable,
  executionOutcomeTable,
  fromExecutionDecisionRow,
  fromExecutionOutcomeRow,
  toExecutionDecisionInsert,
  toExecutionOutcomeInsert,
} from "@beep/epistemic-tables/values/ExecutionRecord";
import { describe, expect, it } from "@effect/vitest";
import { getColumns, getTableName } from "drizzle-orm";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type {
  ExecutionDecisionInsert,
  ExecutionDecisionRow,
  ExecutionOutcomeInsert,
  ExecutionOutcomeRow,
} from "@beep/epistemic-tables/values/ExecutionRecord";
import type { Table } from "drizzle-orm";

const digest = (fill: string): string => fill.repeat(64);

// A selected row always carries every column; the insert projection leaves the
// nullable ones optional, so the row shape fills them with the null the
// database would return.
const asSelectedRow = (insert: ExecutionDecisionInsert): ExecutionDecisionRow => ({
  ...insert,
  prevHash: insert.prevHash ?? null,
  reason: insert.reason ?? null,
});

const asSelectedOutcomeRow = (insert: ExecutionOutcomeInsert): ExecutionOutcomeRow => ({
  ...insert,
  decisionVerdict: insert.decisionVerdict ?? "allowed",
});

const decodeDecision = S.decodeUnknownEffect(ExecutionDecisionRecord);
const decodeOutcome = S.decodeUnknownEffect(ExecutionOutcomeRecord);
const decisionEquivalence = S.toEquivalence(ExecutionDecisionRecord);
const outcomeEquivalence = S.toEquivalence(ExecutionOutcomeRecord);

const allowedDecision = decodeDecision({
  audience: "external-network",
  decidedAt: 1_000,
  destinationDigest: digest("d"),
  grantSetDigest: digest("e"),
  hash: digest("1"),
  operationDigest: digest("c"),
  policyRevision: "1.0.0",
  prevHash: null,
  runKey: digest("a"),
  seq: 0,
  sinkClass: "network-egress",
  verdict: "allowed",
});

const deniedDecision = decodeDecision({
  audience: "external-network",
  decidedAt: 2_000,
  destinationDigest: digest("d"),
  grantSetDigest: digest("e"),
  hash: digest("2"),
  operationDigest: digest("c"),
  policyRevision: "1.0.0",
  prevHash: digest("1"),
  reason: "destination-not-granted",
  runKey: digest("a"),
  seq: 1,
  sinkClass: "network-egress",
  verdict: "denied",
});

const outcome = decodeOutcome({
  decisionHash: digest("1"),
  hash: digest("f"),
  recordedAt: 3_000,
  runKey: digest("a"),
  settlement: "completed",
});

// The payload-capable drizzle column types this ledger must never grow. The
// UsageRecord table's `metadata: jsonb` is the precedent escape hatch these
// tables exist to not have.
const payloadCapableColumnTypes: ReadonlyArray<string> = ["PgJsonb", "PgJson", "PgBytea"];

const columnFacts = (table: Table): Readonly<Record<string, { readonly columnType: string; readonly name: string }>> =>
  R.map(getColumns(table), (column) => ({
    columnType: column.columnType,
    name: column.name,
  }));

// The record schemas encode instances, so an unencodable record has to stay an
// instance: clone onto the same prototype and corrupt one sealed field.
const withUnencodableHash = <A extends object>(record: A): A =>
  Object.assign(Object.create(Object.getPrototypeOf(record)), record, { hash: 42 });

const converterFailure = <A, E>(result: Result.Result<A, E>): Effect.Effect<E, A> =>
  result.pipe(Result.flip, Effect.fromResult);

const expectConverterFailure = (
  error: ExecutionRecordConverterError,
  operation: ExecutionRecordConverterError["operation"]
): void => {
  expect(error._tag).toBe("ExecutionRecordConverterError");
  expect(error.operation).toBe(operation);
  expect(Str.isNonEmpty(error.reason)).toBe(true);
};

// `defaultFormatter` renders a `message: ""` annotation verbatim, so this is a
// real SchemaError whose rendered message is empty - the input the `fromSchema`
// fallback branch is written for.
const emptyMessageSchemaError = S.decodeUnknownResult(S.String.annotate({ message: "" }))(0).pipe(
  Result.flip,
  Effect.fromResult
);

describe("ExecutionRecordTables", () => {
  it("pins the physical table names", () => {
    expect(getTableName(executionDecisionTable)).toBe(EXECUTION_DECISION_TABLE_NAME);
    expect(getTableName(executionOutcomeTable)).toBe(EXECUTION_OUTCOME_TABLE_NAME);
  });

  it("exposes exactly the decision columns and no payload-capable column", () => {
    const facts = columnFacts(executionDecisionTable);

    // Exact column set: a payload column cannot be added unnoticed.
    expect(A.sort(R.keys(facts), Order.String)).toEqual([
      "audience",
      "decidedAt",
      "destinationDigest",
      "grantSetDigest",
      "hash",
      "operationDigest",
      "policyRevision",
      "prevHash",
      "reason",
      "runKey",
      "seq",
      "sinkClass",
      "verdict",
    ]);

    for (const fact of R.values(facts)) {
      expect(payloadCapableColumnTypes).not.toContain(fact.columnType);
    }
  });

  it("exposes exactly the outcome columns and no payload-capable column", () => {
    const facts = columnFacts(executionOutcomeTable);

    expect(A.sort(R.keys(facts), Order.String)).toEqual([
      "decisionHash",
      "decisionVerdict",
      "hash",
      "recordedAt",
      "runKey",
      "settlement",
    ]);

    for (const fact of R.values(facts)) {
      expect(payloadCapableColumnTypes).not.toContain(fact.columnType);
    }
  });

  it.effect(
    "round-trips an allowed decision through insert and select rows",
    Effect.fnUntraced(function* () {
      const decision = yield* allowedDecision;
      const insert = yield* Effect.fromResult(toExecutionDecisionInsert(decision));

      expect(
        decisionEquivalence(yield* Effect.fromResult(fromExecutionDecisionRow(asSelectedRow(insert))), decision)
      ).toBe(true);
    })
  );

  it.effect(
    "round-trips a denied decision with its bounded reason",
    Effect.fnUntraced(function* () {
      const decision = yield* deniedDecision;
      const insert = yield* Effect.fromResult(toExecutionDecisionInsert(decision));

      expect(insert.reason).toBe("destination-not-granted");
      expect(
        decisionEquivalence(yield* Effect.fromResult(fromExecutionDecisionRow(asSelectedRow(insert))), decision)
      ).toBe(true);
    })
  );

  it.effect(
    "round-trips an outcome record",
    Effect.fnUntraced(function* () {
      const recorded = yield* outcome;
      const insert = yield* Effect.fromResult(toExecutionOutcomeInsert(recorded));

      expect(
        outcomeEquivalence(yield* Effect.fromResult(fromExecutionOutcomeRow(asSelectedOutcomeRow(insert))), recorded)
      ).toBe(true);
    })
  );

  it.effect(
    "keeps sealed records and their row projections in agreement",
    Effect.fnUntraced(function* () {
      const decision = yield* allowedDecision;
      const recorded = yield* outcome;
      const sealed = sealExecutionDecision({
        audience: decision.audience,
        decidedAt: decision.decidedAt,
        destinationDigest: decision.destinationDigest,
        grantSetDigest: decision.grantSetDigest,
        operationDigest: decision.operationDigest,
        policyRevision: decision.policyRevision,
        prevHash: O.none(),
        runKey: decision.runKey,
        seq: decision.seq,
        sinkClass: decision.sinkClass,
        verdict: "allowed",
      });
      const rebuilt = yield* Effect.fromResult(
        toExecutionDecisionInsert(sealed).pipe(Result.map(asSelectedRow), Result.flatMap(fromExecutionDecisionRow))
      );

      expect(decisionEquivalence(rebuilt, sealed)).toBe(true);

      const sealedOutcome = sealExecutionOutcome({
        decisionHash: sealed.hash,
        recordedAt: recorded.recordedAt,
        runKey: sealed.runKey,
        settlement: "completed",
      });

      expect(
        outcomeEquivalence(
          yield* Effect.fromResult(
            toExecutionOutcomeInsert(sealedOutcome).pipe(
              Result.map(asSelectedOutcomeRow),
              Result.flatMap(fromExecutionOutcomeRow)
            )
          ),
          sealedOutcome
        )
      ).toBe(true);
    })
  );
  it.effect(
    "reports a typed converter failure on every ledger boundary",
    Effect.fnUntraced(function* () {
      const decision = yield* allowedDecision;
      const decisionInsert = yield* Effect.fromResult(toExecutionDecisionInsert(decision));
      const recorded = yield* outcome;
      const outcomeInsert = yield* Effect.fromResult(toExecutionOutcomeInsert(recorded));

      expectConverterFailure(
        yield* converterFailure(toExecutionDecisionInsert(withUnencodableHash(decision))),
        "toDecisionInsert"
      );
      expectConverterFailure(
        yield* converterFailure(
          fromExecutionDecisionRow({
            ...asSelectedRow(decisionInsert),
            hash: 42,
          } as unknown as ExecutionDecisionRow)
        ),
        "fromDecisionRow"
      );
      expectConverterFailure(
        yield* converterFailure(toExecutionOutcomeInsert(withUnencodableHash(recorded))),
        "toOutcomeInsert"
      );
      expectConverterFailure(
        yield* converterFailure(
          fromExecutionOutcomeRow({
            ...asSelectedOutcomeRow(outcomeInsert),
            hash: 42,
          } as unknown as ExecutionOutcomeRow)
        ),
        "fromOutcomeRow"
      );
    })
  );

  it.effect(
    "falls back to a generic reason when the schema failure renders empty",
    Effect.fnUntraced(function* () {
      const schemaError = yield* emptyMessageSchemaError;
      expect(schemaError.message).toBe("");

      const converterError = ExecutionRecordConverterError.fromSchema("fromDecisionRow", schemaError);
      expect(converterError._tag).toBe("ExecutionRecordConverterError");
      expect(converterError.operation).toBe("fromDecisionRow");
      expect(converterError.reason).toBe("schema conversion failed");
    })
  );
});
