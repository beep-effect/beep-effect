import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { DbSchema as EpistemicDbSchema } from "@beep/epistemic-tables";
import { makeDrizzle, migrate } from "@beep/postgres";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// The drizzle folder contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration's gist exclusion constraint), which the shared external
// pglite-socket lane cannot load. Extension-dependent proofs are pinned to the
// in-process lane.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const ledgerTableNames: ReadonlyArray<string> = ["epistemic_execution_decision", "epistemic_execution_outcome"];

// Every name below is load-bearing: the repository maps constraint violations
// by name, never by message prose, so a silent rename is a silent behavior
// change.
const expectedConstraintNames: ReadonlyArray<string> = [
  "epistemic_execution_decision_audience_bounded",
  "epistemic_execution_decision_genesis_prev",
  "epistemic_execution_decision_hash_unique",
  "epistemic_execution_decision_hash_verdict_unique",
  "epistemic_execution_decision_pk",
  "epistemic_execution_decision_reason_bounded",
  "epistemic_execution_decision_reason_iff_denied",
  "epistemic_execution_decision_run_hash_unique",
  "epistemic_execution_decision_seq_nonnegative",
  "epistemic_execution_decision_sink_class_bounded",
  "epistemic_execution_decision_verdict_bounded",
  "epistemic_execution_outcome_decision_fk",
  "epistemic_execution_outcome_decision_verdict_fk",
  "epistemic_execution_outcome_hash_unique",
  "epistemic_execution_outcome_pk",
  "epistemic_execution_outcome_settlement_bounded",
  "epistemic_execution_outcome_settles_allowed",
];

const expectedTriggerNames: ReadonlyArray<string> = [
  "epistemic_execution_decision_append_only",
  "epistemic_execution_decision_block_truncate",
  "epistemic_execution_outcome_append_only",
  "epistemic_execution_outcome_block_truncate",
];

const digest = (fill: string): string => fill.repeat(64);

const runKey = digest("a");

const decisionRowFixture = (seq: number, hash: string, prevHash: string | null) => ({
  audience: "external-network" as const,
  decidedAt: 1_000 + seq,
  destinationDigest: digest("d"),
  grantSetDigest: digest("e"),
  hash,
  operationDigest: digest("c"),
  policyRevision: "1.0.0",
  prevHash,
  runKey,
  seq,
  sinkClass: "network-egress" as const,
  verdict: "allowed" as const,
});

const sortedNames = (names: ReadonlyArray<string>): ReadonlyArray<string> => A.sort(names, Order.String);

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin epistemic-execution-ledger migration PgLite integration", () => {});
} else {
  describe("db-admin epistemic-execution-ledger migration PgLite integration", { concurrent: false }, () => {
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the epistemic-execution-ledger migration target SQL",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );

          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const constraintRows = yield* sql<{ readonly conname: string; readonly relname: string }>`
            SELECT constraint_class.conname, table_class.relname
            FROM pg_constraint AS constraint_class
            JOIN pg_class AS table_class ON table_class.oid = constraint_class.conrelid
            WHERE constraint_class.contype IN ('c', 'f', 'p', 'u', 'x')
          `;
          const triggerRows = yield* sql<{ readonly tgname: string; readonly relname: string }>`
            SELECT trigger_class.tgname, table_class.relname
            FROM pg_trigger AS trigger_class
            JOIN pg_class AS table_class ON table_class.oid = trigger_class.tgrelid
            WHERE NOT trigger_class.tgisinternal
          `;

          const constraintNames = pipe(
            constraintRows,
            A.filter((row) => A.contains(ledgerTableNames, row.relname)),
            A.map((row) => row.conname),
            sortedNames
          );
          const triggerNames = pipe(
            triggerRows,
            A.filter((row) => A.contains(ledgerTableNames, row.relname)),
            A.map((row) => row.tgname),
            sortedNames
          );

          expect(constraintNames).toEqual(expectedConstraintNames);
          expect(triggerNames).toEqual(expectedTriggerNames);

          yield* db.insert(EpistemicDbSchema.executionDecision).values(decisionRowFixture(0, digest("1"), null));
          yield* db.insert(EpistemicDbSchema.executionDecision).values(decisionRowFixture(1, digest("2"), digest("1")));
          yield* db.insert(EpistemicDbSchema.executionOutcome).values({
            decisionHash: digest("1"),
            hash: digest("f"),
            recordedAt: 5_000,
            runKey,
            settlement: "completed",
          });

          const decisionRows = yield* db.select().from(EpistemicDbSchema.executionDecision);
          const outcomeRows = yield* db.select().from(EpistemicDbSchema.executionOutcome);

          expect(decisionRows).toHaveLength(2);
          expect(outcomeRows).toHaveLength(1);
          expect(A.map(decisionRows, (row) => row.seq)).toEqual([0, 1]);

          // The adversarial probe stays LAST: implicit-transaction pglite hosts
          // roll the whole session chain back after an intentional failure, so
          // no statement may follow it. A direct UPDATE is rejected by the
          // append-only trigger.
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_execution_decision SET destination_digest = ${digest("9")} WHERE seq = 0
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });
  });
}
