import { fileURLToPath } from "node:url";
import { EpistemicConfig } from "@beep/epistemic-config/server";
import { testEpistemicConfig } from "@beep/epistemic-config/test";
import {
  ExecutionSink,
  GrantOperation,
  GrantPurpose,
  GrantResource,
  SinkDestination,
} from "@beep/epistemic-domain/values/ExecutionGrant";
import {
  ExecutionRunKey,
  verifyExecutionDecisionChain,
  verifyOutcomeBinding,
} from "@beep/epistemic-domain/values/ExecutionRecord";
import { makeGovernedTierGate } from "@beep/epistemic-server/GovernedTierGate";
import { EpistemicServerDrizzleLive } from "@beep/epistemic-server/layer";
import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import { CurrentMcpCaller, dispatchWithTierGate, McpCallerIdentity, TierGate } from "@beep/mcp-kit";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { NonNegativeInt } from "@beep/schema";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { A, O } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Duration, Effect, Layer, pipe, Ref } from "effect";
import { Tool } from "effect/unstable/ai";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { GovernedTierGateOptions } from "@beep/epistemic-server/GovernedTierGate";
import type { TierGateShape } from "@beep/mcp-kit";

const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();

// Pinned to the in-process pglite driver with the bundled btree_gist
// extension, matching the ExecutionLedger integration harness.
const makeMigrationCapableLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const GovernedGateTestLayer = EpistemicServerDrizzleLive.pipe(
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

const gateOptions: GovernedTierGateOptions = {
  grantTtl: Duration.hours(12),
  operations: [GrantOperation.make("ontology_propose_change_batch")],
  purpose: GrantPurpose.make("ontology-workspace-mutation"),
  resource: GrantResource.make("ontology-workspace"),
  sink: ExecutionSink.make({
    audience: "local-workspace",
    destination: SinkDestination.make("workspace://ontology"),
    sinkClass: "mcp-write",
  }),
};

const grantedTool = Tool.make("ontology_propose_change_batch");
const ungrantedTool = Tool.make("ontology_unlisted_mutation");

const callerOf = (clientId: number) => O.some(McpCallerIdentity.make({ clientId: NonNegativeInt.make(clientId) }));

const makeGate = () =>
  makeGovernedTierGate(gateOptions).pipe(Effect.provideService(EpistemicConfig, testEpistemicConfig));

const dispatchAs = <A2, E, R>(
  gate: TierGateShape,
  clientId: number,
  tool: Tool.Any,
  onApproved: Effect.Effect<A2, E, R>
) =>
  dispatchWithTierGate({ tool, toolCallId: O.none() }, onApproved).pipe(
    Effect.provideService(TierGate, gate),
    Effect.provideService(CurrentMcpCaller, callerOf(clientId))
  );

const rawSql = Effect.map(Effect.service(SqlClient.SqlClient), (client) => client.withoutTransforms());

const readRunKeys = Effect.fnUntraced(function* () {
  const sql = yield* rawSql;
  const rows = yield* sql<{ readonly run_key: string }>`
    SELECT DISTINCT run_key FROM epistemic_execution_decision
  `;
  return A.map(rows, (row) => row.run_key);
});

const countDecisions = Effect.fnUntraced(function* () {
  const sql = yield* rawSql;
  const rows = yield* sql<{ readonly count: number }>`
    SELECT COUNT(*)::int AS count FROM epistemic_execution_decision
  `;
  return rows[0]?.count ?? -1;
});

// The run key is minted inside the gate, so a test discovers its own run by
// diffing the distinct run keys before and after its dispatches.
const newRunKeySince = Effect.fnUntraced(function* (before: ReadonlyArray<string>) {
  const after = yield* readRunKeys();
  const fresh = A.filter(after, (key) => !A.contains(before, key));
  expect(fresh).toHaveLength(1);
  return ExecutionRunKey.make(fresh[0]!);
});

if (!shouldRunPgliteIntegration) {
  describe.skip("Epistemic GovernedTierGate PgLite integration", () => {});
} else {
  describe("Epistemic GovernedTierGate PgLite integration", { concurrent: false }, () => {
    layer(GovernedGateTestLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "an allowed dispatch writes its decision ahead of the effect and exactly two rows in total",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const gate = yield* makeGate();
          const runKeysBefore = yield* readRunKeys();
          const decisionsBefore = yield* countDecisions();
          const observedDuringEffect = yield* Ref.make(-1);

          // The wrapped effect stands in for the tool handler: by the time it
          // runs, its own write-ahead decision row is already committed and
          // readable — the only new row in the table.
          const result = yield* dispatchAs(
            gate,
            1,
            grantedTool,
            Effect.flatMap(countDecisions(), (count) => Ref.set(observedDuringEffect, count - decisionsBefore))
          );

          expect(result._tag).toBe("Dispatched");
          expect(yield* Ref.get(observedDuringEffect)).toBe(1);

          const runKey = yield* newRunKeySince(runKeysBefore);
          const decisions = yield* ledger.readDecisions(runKey);
          expect(decisions).toHaveLength(1);
          expect(decisions[0]!.verdict).toBe("allowed");
          expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");

          const outcomes = yield* ledger.readOutcomes(runKey);
          expect(outcomes).toHaveLength(1);
          expect(outcomes[0]!.settlement).toBe("completed");
          expect(verifyOutcomeBinding(outcomes[0]!, decisions[0]!)).toBe(true);
          expect(yield* ledger.readUnsettledAllowed(runKey)).toHaveLength(0);
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "a refused dispatch writes exactly one row and is not reported as outcome-unknown",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const gate = yield* makeGate();
          const runKeysBefore = yield* readRunKeys();
          const ran = yield* Ref.make(false);

          const result = yield* dispatchAs(gate, 2, ungrantedTool, Ref.set(ran, true));

          expect(result._tag).toBe("Refused");
          expect(yield* Ref.get(ran)).toBe(false);

          const runKey = yield* newRunKeySince(runKeysBefore);
          const decisions = yield* ledger.readDecisions(runKey);
          expect(decisions).toHaveLength(1);
          const decision = decisions[0]!;
          expect(decision.verdict).toBe("denied");
          expect(decision.verdict === "denied" && decision.reason).toBe("operation-not-granted");
          expect(yield* ledger.readOutcomes(runKey)).toHaveLength(0);
          // An ordinary denial has no outcome row and must not be reported by
          // the derived unknown-outcome predicate, which is scoped to allowed.
          expect(yield* ledger.readUnsettledAllowed(runKey)).toHaveLength(0);
        }),
        pgliteIntegrationTimeoutMillis
      );

      it.effect(
        "a session's mixed dispatches chain into one verified run against the real constraints",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const ledger = yield* ExecutionLedger;
          const gate = yield* makeGate();
          const runKeysBefore = yield* readRunKeys();

          yield* dispatchAs(gate, 3, grantedTool, Effect.void);
          yield* dispatchAs(gate, 3, ungrantedTool, Effect.void);
          yield* dispatchAs(gate, 3, grantedTool, Effect.void);

          const runKey = yield* newRunKeySince(runKeysBefore);
          const decisions = yield* ledger.readDecisions(runKey);
          expect(A.map(decisions, (record) => record.seq)).toEqual([0, 1, 2]);
          expect(A.map(decisions, (record) => record.verdict)).toEqual(["allowed", "denied", "allowed"]);
          expect(verifyExecutionDecisionChain(decisions, runKey).result).toBe("chain-intact");

          const outcomes = yield* ledger.readOutcomes(runKey);
          expect(A.map(outcomes, (record) => record.decisionHash)).toEqual([decisions[0]!.hash, decisions[2]!.hash]);
          expect(yield* ledger.readUnsettledAllowed(runKey)).toHaveLength(0);
        }),
        pgliteIntegrationTimeoutMillis
      );
    });

    // A separate database: this block destroys the decision table to prove the
    // fail-closed refusal against a real driver failure, not a stub.
    layer(GovernedGateTestLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "a real decision-write failure refuses the dispatch and the effect does not run",
        Effect.fnUntraced(function* () {
          yield* migrateLedger();
          const gate = yield* makeGate();
          const ran = yield* Ref.make(false);
          const sql = yield* rawSql;
          yield* sql`DROP TABLE epistemic_execution_outcome`;
          yield* sql`DROP TABLE epistemic_execution_decision`;

          const result = yield* dispatchAs(gate, 4, grantedTool, Ref.set(ran, true));

          expect(result._tag).toBe("Refused");
          expect(yield* Ref.get(ran)).toBe(false);
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
