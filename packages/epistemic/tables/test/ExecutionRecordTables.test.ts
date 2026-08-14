import {
  ExecutionDecisionRecord,
  ExecutionOutcomeRecord,
  sealExecutionDecision,
  sealExecutionOutcome,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import {
  EXECUTION_DECISION_TABLE_NAME,
  EXECUTION_OUTCOME_TABLE_NAME,
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
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
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

const decodeDecision = S.decodeUnknownSync(ExecutionDecisionRecord);
const decodeOutcome = S.decodeUnknownSync(ExecutionOutcomeRecord);
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

  it("round-trips an allowed decision through insert and select rows", () => {
    const insert = toExecutionDecisionInsert(allowedDecision);

    expect(decisionEquivalence(fromExecutionDecisionRow(asSelectedRow(insert)), allowedDecision)).toBe(true);
  });

  it("round-trips a denied decision with its bounded reason", () => {
    const insert = toExecutionDecisionInsert(deniedDecision);

    expect(insert.reason).toBe("destination-not-granted");
    expect(decisionEquivalence(fromExecutionDecisionRow(asSelectedRow(insert)), deniedDecision)).toBe(true);
  });

  it("round-trips an outcome record", () => {
    const insert = toExecutionOutcomeInsert(outcome);

    expect(outcomeEquivalence(fromExecutionOutcomeRow(asSelectedOutcomeRow(insert)), outcome)).toBe(true);
  });

  it("keeps sealed records and their row projections in agreement", () => {
    const sealed = sealExecutionDecision({
      audience: allowedDecision.audience,
      decidedAt: allowedDecision.decidedAt,
      destinationDigest: allowedDecision.destinationDigest,
      grantSetDigest: allowedDecision.grantSetDigest,
      operationDigest: allowedDecision.operationDigest,
      policyRevision: allowedDecision.policyRevision,
      prevHash: O.none(),
      runKey: allowedDecision.runKey,
      seq: allowedDecision.seq,
      sinkClass: allowedDecision.sinkClass,
      verdict: "allowed",
    });
    const rebuilt = fromExecutionDecisionRow(asSelectedRow(toExecutionDecisionInsert(sealed)));

    expect(decisionEquivalence(rebuilt, sealed)).toBe(true);

    const sealedOutcome = sealExecutionOutcome({
      decisionHash: sealed.hash,
      recordedAt: outcome.recordedAt,
      runKey: sealed.runKey,
      settlement: "completed",
    });

    expect(
      outcomeEquivalence(
        fromExecutionOutcomeRow(asSelectedOutcomeRow(toExecutionOutcomeInsert(sealedOutcome))),
        sealedOutcome
      )
    ).toBe(true);
  });
});
