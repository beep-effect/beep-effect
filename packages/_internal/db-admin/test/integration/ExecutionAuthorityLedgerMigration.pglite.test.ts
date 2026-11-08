import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";
import {
  ExecutionRunKey,
  GrantOperationDigest,
  SinkDestinationDigest,
  sealExecutionDecision,
  sealExecutionOutcome,
  verifyExecutionDecisionChain,
  verifyOutcomeBinding,
} from "@beep/execution-authority-domain/entities/ExecutionRecord";
import { PolicyRevision } from "@beep/execution-authority-domain/values/ExecutionGrant";
import { DenialReason } from "@beep/execution-authority-domain/values/ExecutionVerdict";
import { GrantSetDigest } from "@beep/execution-authority-domain/values/GrantSet";
import { DbSchema as ExecutionAuthorityDbSchema } from "@beep/execution-authority-tables";
import {
  fromExecutionDecisionRow,
  fromExecutionOutcomeRow,
  toExecutionDecisionInsert,
  toExecutionOutcomeInsert,
} from "@beep/execution-authority-tables/entities/ExecutionRecord";
import { makeDrizzle, migrate } from "@beep/postgres";
import { it } from "@beep/test-runner";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import type { ExecutionDecisionRecord } from "@beep/execution-authority-domain/entities/ExecutionRecord";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = NodeURL.fileURLToPath(new URL("../../drizzle", import.meta.url));
const renameMigration = "20261107032821_execution_authority_rename";

// The drizzle folder contains `CREATE EXTENSION btree_gist` (the epistemic edge
// migration's gist exclusion constraint), which the shared external
// pglite-socket lane cannot load. Extension-dependent proofs are pinned to the
// in-process lane.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" })).pipe(
    Layer.merge(NodeServices.layer)
  );

const constraintSuffixes: ReadonlyArray<string> = [
  "decision_audience_bounded",
  "decision_genesis_prev",
  "decision_hash_unique",
  "decision_hash_verdict_unique",
  "decision_pk",
  "decision_reason_bounded",
  "decision_reason_iff_denied",
  "decision_run_hash_unique",
  "decision_seq_nonnegative",
  "decision_sink_class_bounded",
  "decision_verdict_bounded",
  "outcome_decision_fk",
  "outcome_decision_verdict_fk",
  "outcome_hash_unique",
  "outcome_pk",
  "outcome_settlement_bounded",
  "outcome_settles_allowed",
];
const triggerSuffixes: ReadonlyArray<string> = [
  "decision_append_only",
  "decision_block_truncate",
  "outcome_append_only",
  "outcome_block_truncate",
];

// Every name below is load-bearing: the repository maps constraint violations
// by name, never by message prose, so a silent rename is a silent behavior
// change.
const prefixed = (prefix: string, suffixes: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.map(suffixes, (suffix) => `${prefix}${suffix}`);

const digest = (fill: string): string => Str.repeat(64)(fill);
const runKey = ExecutionRunKey.make(digest("a"));
const revision = Result.getOrThrow(S.decodeResult(PolicyRevision)("1.0.0"));

const decisionContent = (seq: number, prevHash: ExecutionDecisionRecord["prevHash"], denied: boolean) => {
  const common = {
    audience: "external-network",
    decidedAt: DateTime.makeUnsafe(1_000 + seq),
    destinationDigest: SinkDestinationDigest.make(digest("d")),
    grantSetDigest: GrantSetDigest.make(digest("e")),
    operationDigest: GrantOperationDigest.make(digest("c")),
    policyRevision: revision,
    prevHash,
    runKey,
    seq: S.Natural.make(seq),
    sinkClass: "network-egress",
  } as const;
  return denied
    ? ({ ...common, reason: DenialReason.Enum["destination-not-granted"], verdict: "denied" } as const)
    : ({ ...common, verdict: "allowed" } as const);
};

// seq 0 allowed and settled, seq 1 denied (never settles), seq 2 allowed and settled.
const first = sealExecutionDecision(decisionContent(0, O.none(), false));
const second = sealExecutionDecision(decisionContent(1, O.some(first.hash), true));
const third = sealExecutionDecision(decisionContent(2, O.some(second.hash), false));
const decisions = [first, second, third] as const;
const outcomes = A.map([first, third], (decision, index) =>
  sealExecutionOutcome({
    decisionHash: decision.hash,
    recordedAt: DateTime.makeUnsafe(2_000 + index),
    runKey,
    settlement: "completed",
  })
);

const readNames = Effect.fnUntraced(function* (prefix: string) {
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const tables = [`${prefix}decision`, `${prefix}outcome`];
  const constraintRows = yield* sql<{ readonly conname: string; readonly relname: string }>`
    SELECT constraint_class.conname, table_class.relname
    FROM pg_constraint AS constraint_class
    JOIN pg_class AS table_class ON table_class.oid = constraint_class.conrelid
    WHERE constraint_class.contype IN ('c', 'f', 'p', 'u', 'x')
  `;
  const notNullRows = yield* sql<{ readonly conname: string; readonly relname: string }>`
    SELECT constraint_class.conname, table_class.relname
    FROM pg_constraint AS constraint_class
    JOIN pg_class AS table_class ON table_class.oid = constraint_class.conrelid
    WHERE constraint_class.contype = 'n'
  `;
  const triggerRows = yield* sql<{ readonly tgname: string; readonly relname: string; readonly proname: string }>`
    SELECT trigger_class.tgname, table_class.relname, proc.proname
    FROM pg_trigger AS trigger_class
    JOIN pg_class AS table_class ON table_class.oid = trigger_class.tgrelid
    JOIN pg_proc AS proc ON proc.oid = trigger_class.tgfoid
    WHERE NOT trigger_class.tgisinternal
  `;
  const onLedger = <Row extends { readonly relname: string }>(rows: ReadonlyArray<Row>) =>
    A.filter(rows, (row) => A.contains(tables, row.relname));
  return {
    constraints: A.sort(
      A.map(onLedger(constraintRows), (row) => row.conname),
      Order.String
    ),
    notNull: A.map(onLedger(notNullRows), (row) => row.conname),
    triggers: A.sort(
      A.map(onLedger(triggerRows), (row) => row.tgname),
      Order.String
    ),
    guards: A.dedupe(A.map(onLedger(triggerRows), (row) => row.proname)),
  };
});

const expectNames = Effect.fnUntraced(function* (prefix: string) {
  const names = yield* readNames(prefix);
  expect(names.constraints).toEqual(prefixed(prefix, constraintSuffixes));
  expect(names.triggers).toEqual(prefixed(prefix, triggerSuffixes));
  expect(names.guards).toEqual([`${prefix}ledger_block_mutation`]);
  expect(A.every(names.notNull, Str.startsWith(prefix))).toBe(true);
});

const runMigrations = Effect.fnUntraced(function* (folder: string) {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  yield* migrate(db, {
    migrationsFolder: folder,
    migrationsSchema: pipe(
      info.schema,
      O.getOrElse(() => "drizzle")
    ),
  });
});

// The migrator applies the folders it is given in order; a copy without the
// rename (and anything after it) reproduces a database migrated before the move.
const copyFoldersBeforeRename = Effect.fnUntraced(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = yield* fileSystem.makeTempDirectoryScoped({ prefix: "db-admin-pre-rename-" });
  const listed = yield* fileSystem.readDirectory(migrationsFolder);
  const entries = A.sort(listed, Order.String);
  const earlier = A.takeWhile(entries, (entry) => entry < renameMigration);
  expect(A.contains(entries, renameMigration)).toBe(true);
  yield* Effect.forEach(earlier, (entry) =>
    fileSystem.copy(path.join(migrationsFolder, entry), path.join(target, entry))
  );
  return target;
});

const runDownMigration = Effect.fnUntraced(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sql = (yield* SqlClient.SqlClient).withoutTransforms();
  const down = yield* fileSystem.readFileString(path.join(migrationsFolder, renameMigration, "down.sql"));
  yield* Effect.forEach(
    A.filter(A.map(Str.split("--> statement-breakpoint")(down), Str.trim), Str.isNonEmpty),
    (statement) => sql.unsafe(statement)
  );
});

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin execution-authority-ledger migration PgLite integration", () => {});
} else {
  describe("db-admin execution-authority-ledger migration PgLite integration", { concurrent: false }, () => {
    it.layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "migrates a ledger seeded before the move forward with every row and the chain intact, then reverses",
        Effect.fnUntraced(function* () {
          const preRenameFolder = yield* copyFoldersBeforeRename();
          yield* runMigrations(preRenameFolder);
          yield* expectNames("epistemic_execution_");

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          // Seed through the pre-move physical names with the row shape the
          // converters produce, so the rows are exactly what the old adapter wrote.
          for (const decision of decisions) {
            const row = Result.getOrThrow(toExecutionDecisionInsert(decision));
            yield* sql`
              INSERT INTO epistemic_execution_decision
                (run_key, seq, prev_hash, hash, verdict, reason, operation_digest, sink_class, audience,
                 destination_digest, grant_set_digest, policy_revision, decided_at)
              VALUES (${row.runKey}, ${row.seq}, ${row.prevHash ?? null}, ${row.hash}, ${row.verdict},
                ${row.reason ?? null}, ${row.operationDigest}, ${row.sinkClass}, ${row.audience},
                ${row.destinationDigest}, ${row.grantSetDigest}, ${row.policyRevision}, ${row.decidedAt})
            `;
          }
          for (const outcome of outcomes) {
            const row = Result.getOrThrow(toExecutionOutcomeInsert(outcome));
            yield* sql`
              INSERT INTO epistemic_execution_outcome (run_key, decision_hash, settlement, recorded_at, hash)
              VALUES (${row.runKey}, ${row.decisionHash}, ${row.settlement}, ${row.recordedAt}, ${row.hash})
            `;
          }

          yield* runMigrations(migrationsFolder);
          yield* expectNames("execution_authority_");

          const db = yield* makeDrizzle();
          const decisionRows = yield* db
            .select()
            .from(ExecutionAuthorityDbSchema.executionDecision)
            .orderBy(ExecutionAuthorityDbSchema.executionDecision.seq);
          const outcomeRows = yield* db.select().from(ExecutionAuthorityDbSchema.executionOutcome);
          const migratedDecisions = A.map(decisionRows, (row) => Result.getOrThrow(fromExecutionDecisionRow(row)));
          const migratedOutcomes = A.map(outcomeRows, (row) => Result.getOrThrow(fromExecutionOutcomeRow(row)));

          expect(A.map(migratedDecisions, (record) => record.hash)).toEqual(A.map(decisions, (record) => record.hash));
          expect(A.map(migratedDecisions, (record) => record.verdict)).toEqual(["allowed", "denied", "allowed"]);
          expect(verifyExecutionDecisionChain(migratedDecisions, runKey).result).toBe("chain-intact");
          expect(migratedOutcomes).toHaveLength(2);
          expect(
            A.every(migratedOutcomes, (outcome) =>
              A.some(migratedDecisions, (decision) => verifyOutcomeBinding(outcome, decision))
            )
          ).toBe(true);

          yield* runDownMigration();
          yield* expectNames("epistemic_execution_");
          const restoredDecisions = yield* sql<{ readonly count: number }>`
            SELECT count(*)::int AS count FROM epistemic_execution_decision
          `;
          const restoredOutcomes = yield* sql<{ readonly count: number }>`
            SELECT count(*)::int AS count FROM epistemic_execution_outcome
          `;
          expect(A.map(restoredDecisions, (row) => row.count)).toEqual([3]);
          expect(A.map(restoredOutcomes, (row) => row.count)).toEqual([2]);

          // The adversarial probe stays LAST: implicit-transaction pglite hosts
          // roll the whole session chain back after an intentional failure, so
          // no statement may follow it. The guard survives the round trip.
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_execution_decision SET destination_digest = ${digest("9")} WHERE seq = 0
          `);
          expect(NodeUtil.inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });

    it.layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "keeps the renamed ledger append-only on a fresh database",
        Effect.fnUntraced(function* () {
          yield* runMigrations(migrationsFolder);
          yield* expectNames("execution_authority_");

          const db = yield* makeDrizzle();
          for (const decision of decisions) {
            yield* db
              .insert(ExecutionAuthorityDbSchema.executionDecision)
              .values(Result.getOrThrow(toExecutionDecisionInsert(decision)));
          }
          const decisionRows = yield* db.select().from(ExecutionAuthorityDbSchema.executionDecision);
          expect(decisionRows).toHaveLength(3);

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          const mutation = yield* Effect.flip(sql`
            UPDATE execution_authority_decision SET destination_digest = ${digest("9")} WHERE seq = 0
          `);
          expect(NodeUtil.inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        120_000
      );
    });
  });
}
