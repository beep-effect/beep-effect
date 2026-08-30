import { fileURLToPath } from "node:url";
import { inspect } from "node:util";
import { PolicyRevision } from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  DecisionRecordHash,
  ExecutionRunKey,
  GrantOperationDigest,
  SinkDestinationDigest,
  sealExecutionDecision,
  sealExecutionOutcome,
  verifyExecutionDecisionChain,
  verifyOutcomeBinding,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import { DenialReason } from "@beep/epistemic-domain/values/ExecutionVerdict";
import { GrantSetDigest } from "@beep/epistemic-domain/values/GrantSet";
import { EpistemicServerDrizzleLive } from "@beep/epistemic-server/layer";
import { ExecutionLedger, ExecutionLedgerConstraintViolation } from "@beep/epistemic-use-cases/ExecutionLedger";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { NonNegativeInt } from "@beep/schema";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { DateTime, Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type {
  DecisionRecordHash as DecisionRecordHashType,
  ExecutionDecisionRecord,
} from "@beep/epistemic-domain/values/ExecutionRecord";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();

// The db-admin drizzle folder creates `btree_gist` for the edge exclusion
// constraint, which the shared external pglite-socket lane cannot load, so this
// suite is pinned to the in-process driver with the bundled extension.
const makeMigrationCapableLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const ExecutionLedgerTestLayer = EpistemicServerDrizzleLive.pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makeMigrationCapableLayer())
);

const migrateLedger = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const revision = PolicyRevision.decodeUnknownSync("1.0.0");

const decisionContent = (input: {
  readonly runKey: string;
  readonly seq: number;
  readonly prevHash: O.Option<DecisionRecordHashType>;
  readonly verdict?: "allowed" | "denied";
}) => {
  const common = {
    audience: "external-network",
    decidedAt: DateTime.makeUnsafe(input.seq + 1_000),
    destinationDigest: SinkDestinationDigest.make("d".repeat(64)),
    grantSetDigest: GrantSetDigest.make("e".repeat(64)),
    operationDigest: GrantOperationDigest.make("c".repeat(64)),
    policyRevision: revision,
    prevHash: input.prevHash,
    runKey: ExecutionRunKey.make(input.runKey),
    seq: NonNegativeInt.make(input.seq),
    sinkClass: "network-egress",
  } as const;
  return input.verdict === "denied"
    ? ({ ...common, reason: DenialReason.Enum["destination-not-granted"], verdict: "denied" } as const)
    : ({ ...common, verdict: "allowed" } as const);
};

// Chains a run of sealed decisions: seq 0 allowed, seq 1 denied, seq 2 allowed.
const sealedRun = (runKey: string): ReadonlyArray<ExecutionDecisionRecord> => {
  const first = sealExecutionDecision(decisionContent({ prevHash: O.none(), runKey, seq: 0 }));
  const second = sealExecutionDecision(
    decisionContent({ prevHash: O.some(first.hash), runKey, seq: 1, verdict: "denied" })
  );
  const third = sealExecutionDecision(decisionContent({ prevHash: O.some(second.hash), runKey, seq: 2 }));
  return [first, second, third];
};

const rawSql = Effect.map(Effect.service(SqlClient.SqlClient), (client) => client.withoutTransforms());

if (!shouldRunPgliteIntegration) {
  describe.skip("Epistemic ExecutionLedger repository PgLite integration", () => {});
} else {
  describe("Epistemic ExecutionLedger repository PgLite integration", { concurrent: false }, () => {
    layer(ExecutionLedgerTestLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "appends a chained run, reads it back intact, and settles the allowed decisions",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("1".repeat(64));
          const [first, second, third] = sealedRun(runKey);

          for (const decision of [first, second, third]) {
            yield* ledger.appendDecision(decision);
          }

          // A denied decision never settles: dispatch refuses before the effect
          // runs, so only the two allowed decisions get outcome rows — the
          // first here, the second later, to exercise the unsettled predicate.
          const firstOutcome = sealExecutionOutcome({
            decisionHash: first.hash,
            recordedAt: DateTime.makeUnsafe(2_000),
            runKey,
            settlement: "completed",
          });
          yield* ledger.appendOutcome(firstOutcome);

          const decisions = yield* ledger.readDecisions(runKey);
          expect(decisions).toHaveLength(3);
          expect(A.map(decisions, (record) => record.seq)).toEqual([0, 1, 2]);
          expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");

          const outcomes = yield* ledger.readOutcomes(runKey);
          expect(outcomes).toHaveLength(1);
          const settled = yield* pipe(
            A.head(outcomes),
            O.match({
              onNone: () => Effect.die("expected the settled outcome to read back"),
              onSome: Effect.succeed,
            })
          );
          expect(verifyOutcomeBinding(settled, first)).toBe(true);

          // The unsettled predicate is scoped to allowed decisions: the denied
          // seq-1 decision has no outcome row and must NOT be reported.
          const unsettled = yield* ledger.readUnsettledAllowed(runKey);
          expect(A.map(unsettled, (record) => record.seq)).toEqual([2]);

          const thirdOutcome = sealExecutionOutcome({
            decisionHash: third.hash,
            recordedAt: DateTime.makeUnsafe(3_000),
            runKey,
            settlement: "failed",
          });
          yield* ledger.appendOutcome(thirdOutcome);

          expect(yield* ledger.readUnsettledAllowed(runKey)).toHaveLength(0);
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a chain collision by the named chain primary key",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("2".repeat(64));
          const [first] = sealedRun(runKey);

          yield* ledger.appendDecision(first);

          // The rejection probe stays LAST in its effect: a failed statement
          // aborts the surrounding pglite transaction chain.
          const violation = yield* Effect.flip(ledger.appendDecision(first));

          expect(ExecutionLedgerConstraintViolation.is(violation)).toBe(true);
          if (ExecutionLedgerConstraintViolation.is(violation)) {
            expect(violation.constraintName).toBe("epistemic_execution_decision_pk");
          }
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects an outcome whose decision was never written, by the composite foreign key",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("3".repeat(64));

          const orphan = sealExecutionOutcome({
            decisionHash: DecisionRecordHash.make("b".repeat(64)),
            recordedAt: DateTime.makeUnsafe(2_000),
            runKey,
            settlement: "completed",
          });

          const violation = yield* Effect.flip(ledger.appendOutcome(orphan));

          expect(ExecutionLedgerConstraintViolation.is(violation)).toBe(true);
          if (ExecutionLedgerConstraintViolation.is(violation)) {
            expect(violation.constraintName).toBe("epistemic_execution_outcome_decision_fk");
          }
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a second outcome for one decision, by the outcome primary key",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("4".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);

          const outcome = sealExecutionOutcome({
            decisionHash: first.hash,
            recordedAt: DateTime.makeUnsafe(2_000),
            runKey,
            settlement: "completed",
          });
          yield* ledger.appendOutcome(outcome);

          const duplicate = sealExecutionOutcome({
            decisionHash: first.hash,
            recordedAt: DateTime.makeUnsafe(3_000),
            runKey,
            settlement: "interrupted",
          });
          const violation = yield* Effect.flip(ledger.appendOutcome(duplicate));

          expect(ExecutionLedgerConstraintViolation.is(violation)).toBe(true);
          if (ExecutionLedgerConstraintViolation.is(violation)) {
            expect(violation.constraintName).toBe("epistemic_execution_outcome_pk");
          }
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a free-text denial reason at the table, not just in the schema",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const sql = yield* rawSql;
          const runKey = "5".repeat(64);
          const digest = "d".repeat(64);

          // Raw SQL bypasses every domain codec on purpose: the bounded-reason
          // CHECK is the last line against a compromised writer smuggling
          // payload text into a no-payload ledger.
          const violation = yield* Effect.flip(sql`
            INSERT INTO epistemic_execution_decision (
              run_key, seq, prev_hash, hash, verdict, reason, operation_digest,
              sink_class, audience, destination_digest, grant_set_digest,
              policy_revision, decided_at
            ) VALUES (
              ${runKey}, 0, NULL, ${digest}, 'denied', 'exfiltrated: SSN 000-00-0000',
              ${digest}, 'network-egress', 'external-network', ${digest}, ${digest},
              '1.0.0', 1000
            )
          `);

          expect(inspect(violation, { depth: 10 })).toContain("epistemic_execution_decision_reason_bounded");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects an outcome settling a denied decision, by the verdict foreign key",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("b".repeat(64));
          const [first, second] = sealedRun(runKey);
          yield* ledger.appendDecision(first);
          yield* ledger.appendDecision(second);

          // seq 1 is the DENIED decision: dispatch never ran an effect for it,
          // so an outcome bound to its hash is a fabrication. The table shape
          // rejects it — the outcome's constant decision_verdict column can
          // only reference an (hash, verdict) pair whose verdict is allowed.
          const fabricated = sealExecutionOutcome({
            decisionHash: second.hash,
            recordedAt: DateTime.makeUnsafe(2_000),
            runKey,
            settlement: "completed",
          });
          const violation = yield* Effect.flip(ledger.appendOutcome(fabricated));

          expect(ExecutionLedgerConstraintViolation.is(violation)).toBe(true);
          if (ExecutionLedgerConstraintViolation.is(violation)) {
            expect(violation.constraintName).toBe("epistemic_execution_outcome_decision_verdict_fk");
          }
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a direct UPDATE on the outcome table by its append-only trigger",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("c".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);
          yield* ledger.appendOutcome(
            sealExecutionOutcome({
              decisionHash: first.hash,
              recordedAt: DateTime.makeUnsafe(2_000),
              runKey,
              settlement: "failed",
            })
          );

          const sql = yield* rawSql;
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_execution_outcome SET settlement = 'completed' WHERE run_key = ${runKey}
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a direct DELETE on the outcome table by its append-only trigger",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("d".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);
          yield* ledger.appendOutcome(
            sealExecutionOutcome({
              decisionHash: first.hash,
              recordedAt: DateTime.makeUnsafe(2_000),
              runKey,
              settlement: "completed",
            })
          );

          const sql = yield* rawSql;
          const deletion = yield* Effect.flip(sql`
            DELETE FROM epistemic_execution_outcome WHERE run_key = ${runKey}
          `);

          expect(inspect(deletion, { depth: 10 })).toContain("append-only");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects TRUNCATE of the whole ledger by the statement-level triggers",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const sql = yield* rawSql;

          // Row-level triggers never fire on TRUNCATE, and a truncated run
          // would read back as an EMPTY chain the verifier certifies intact —
          // the one wipe that would not even be tamper-evident. The
          // statement-level triggers exist for exactly this hole.
          const truncation = yield* Effect.flip(sql`
            TRUNCATE epistemic_execution_decision, epistemic_execution_outcome
          `);

          expect(inspect(truncation, { depth: 10 })).toContain("append-only");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a genesis row that claims a predecessor, by the genesis CHECK",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const sql = yield* rawSql;
          const digest = "d".repeat(64);

          const violation = yield* Effect.flip(sql`
            INSERT INTO epistemic_execution_decision (
              run_key, seq, prev_hash, hash, verdict, reason, operation_digest,
              sink_class, audience, destination_digest, grant_set_digest,
              policy_revision, decided_at
            ) VALUES (
              ${"e".repeat(64)}, 1, NULL, ${digest}, 'allowed', NULL,
              ${digest}, 'network-egress', 'external-network', ${digest}, ${digest},
              '1.0.0', 1000
            )
          `);

          expect(inspect(violation, { depth: 10 })).toContain("epistemic_execution_decision_genesis_prev");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects an allowed row carrying a reason, by the reason-iff-denied CHECK",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const sql = yield* rawSql;
          const digest = "d".repeat(64);

          // The reason itself is in the bounded list, so the only constraint
          // this row can violate is the presence rule — pinning the CHECK body,
          // not just its name.
          const violation = yield* Effect.flip(sql`
            INSERT INTO epistemic_execution_decision (
              run_key, seq, prev_hash, hash, verdict, reason, operation_digest,
              sink_class, audience, destination_digest, grant_set_digest,
              policy_revision, decided_at
            ) VALUES (
              ${"f".repeat(64)}, 0, NULL, ${digest}, 'allowed', 'grant-expired',
              ${digest}, 'network-egress', 'external-network', ${digest}, ${digest},
              '1.0.0', 1000
            )
          `);

          expect(inspect(violation, { depth: 10 })).toContain("epistemic_execution_decision_reason_iff_denied");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects an unbounded settlement literal, by the settlement CHECK",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("0".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);

          const sql = yield* rawSql;
          const violation = yield* Effect.flip(sql`
            INSERT INTO epistemic_execution_outcome (
              run_key, decision_hash, settlement, recorded_at, hash
            ) VALUES (
              ${runKey}, ${first.hash}, 'exfiltrated', 2000, ${"9".repeat(64)}
            )
          `);

          expect(inspect(violation, { depth: 10 })).toContain("epistemic_execution_outcome_settlement_bounded");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a direct UPDATE by the append-only trigger",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("6".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);

          const sql = yield* rawSql;
          const mutation = yield* Effect.flip(sql`
            UPDATE epistemic_execution_decision
            SET destination_digest = ${"9".repeat(64)}
            WHERE run_key = ${runKey}
          `);

          expect(inspect(mutation, { depth: 10 })).toContain("append-only");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "rejects a direct DELETE by the append-only trigger",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("7".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);

          const sql = yield* rawSql;
          const deletion = yield* Effect.flip(sql`
            DELETE FROM epistemic_execution_decision WHERE run_key = ${runKey}
          `);

          expect(inspect(deletion, { depth: 10 })).toContain("append-only");
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "detects a tampered row at its index once the owner drops the trigger",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("8".repeat(64));
          const chain = sealedRun(runKey);
          for (const decision of chain) {
            yield* ledger.appendDecision(decision);
          }

          // PGlite connects as table owner and an owner can drop the trigger —
          // the documented reason this ledger is tamper-EVIDENT, not
          // tamper-proof. The trigger is defense in depth; the chain verifier
          // is the primary proof, and this is the test that makes that claim
          // earn itself: mutate a sealed field mid-chain and the verifier must
          // name the exact index.
          const sql = yield* rawSql;
          yield* sql`DROP TRIGGER epistemic_execution_decision_append_only ON epistemic_execution_decision`;
          yield* sql`
            UPDATE epistemic_execution_decision
            SET destination_digest = ${"9".repeat(64)}
            WHERE run_key = ${runKey} AND seq = 1
          `;

          const tampered = yield* ledger.readDecisions(runKey);
          expect(tampered).toHaveLength(3);
          const verification = verifyExecutionDecisionChain(tampered, runKey);
          expect(verification.result).toBe("chain-broken");
          if (verification.result === "chain-broken") {
            expect(verification.atIndex).toBe(1);
          }

          // Restore the trigger so later suites against this database keep the
          // guard they expect.
          yield* sql`
            CREATE TRIGGER epistemic_execution_decision_append_only
              BEFORE UPDATE OR DELETE ON epistemic_execution_decision
              FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation()
          `;
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "detects a forged outcome binding once the owner drops the outcome trigger",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const runKey = ExecutionRunKey.make("9".repeat(64));
          const [first] = sealedRun(runKey);
          yield* ledger.appendDecision(first);
          const outcome = sealExecutionOutcome({
            decisionHash: first.hash,
            recordedAt: DateTime.makeUnsafe(2_000),
            runKey,
            settlement: "failed",
          });
          yield* ledger.appendOutcome(outcome);

          const sql = yield* rawSql;
          yield* sql`DROP TRIGGER epistemic_execution_outcome_append_only ON epistemic_execution_outcome`;
          // Rewrite history: a failed execution becomes a completed one.
          yield* sql`
            UPDATE epistemic_execution_outcome
            SET settlement = 'completed'
            WHERE run_key = ${runKey}
          `;

          const outcomes = yield* ledger.readOutcomes(runKey);
          const forged = yield* pipe(
            A.head(outcomes),
            O.match({
              onNone: () => Effect.die("expected the forged outcome to read back"),
              onSome: Effect.succeed,
            })
          );
          expect(forged.settlement).toBe("completed");
          expect(verifyOutcomeBinding(forged, first)).toBe(false);

          yield* sql`
            CREATE TRIGGER epistemic_execution_outcome_append_only
              BEFORE UPDATE OR DELETE ON epistemic_execution_outcome
              FOR EACH ROW EXECUTE FUNCTION epistemic_execution_ledger_block_mutation()
          `;
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
