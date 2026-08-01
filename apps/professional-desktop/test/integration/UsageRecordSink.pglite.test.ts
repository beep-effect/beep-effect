import { appendTurnFinalizationUsageRecord, TurnFinalizationUsageAppend } from "@beep/epistemic-domain";
import * as UsageRecordTable from "@beep/epistemic-tables/entities/UsageRecord";
import { makeDrizzle, makeDrizzleLayer } from "@beep/postgres";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { UsageRecordSink, UsageRecordSinkDrizzle } from "@/chat/UsageRecordSink";
import { migrateOnBoot } from "@/runtime/Migrations";

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
// The bundled migrations issue `CREATE EXTENSION btree_gist`, so the test
// database has to register the bundled extension exactly as the sidecar's
// `makeBundledPgliteLayer` does.
const makeInProcessPgliteLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const decodeUsageAppend = S.decodeUnknownSync(TurnFinalizationUsageAppend);

const usageAppendInput = {
  activityId: null,
  actor: { kind: "System", component: "Runtime" },
  costUsdApproxMicros: null,
  createdAt: 100,
  createdByPrincipal: { kind: "System", component: "Runtime" },
  credentialReference: null,
  entityType: "EpistemicUsageRecord",
  id: 1,
  inputTokens: 12,
  latencyMillis: null,
  metadata: { trace: "fixture" },
  model: "fixture-model",
  orgId: 1,
  outputTokens: 34,
  provider: "fixture",
  publicId: "epistemic_usage_record_a1",
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  totalTokens: 46,
  unitCount: null,
  updatedAt: 101,
  updatedByPrincipal: { kind: "System", component: "Runtime" },
};

const migrateEpistemicUsage = Effect.fnUntraced(function* () {
  yield* migrateOnBoot;
});

const UsageRecordSinkLayer = UsageRecordSinkDrizzle.pipe(
  Layer.provideMerge(makeDrizzleLayer()),
  Layer.provideMerge(makeInProcessPgliteLayer()),
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

if (!shouldRunPgliteIntegration) {
  describe.skip("Professional desktop UsageRecordSink Drizzle PgLite integration", () => {});
} else {
  describe("Professional desktop UsageRecordSink Drizzle PgLite integration", { concurrent: false }, () => {
    layer(UsageRecordSinkLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "persists a finalized turn UsageRecord through the Drizzle sink",
        Effect.fnUntraced(function* () {
          yield* migrateEpistemicUsage();
          const sink = yield* UsageRecordSink;
          const db = yield* makeDrizzle();

          const record = appendTurnFinalizationUsageRecord(decodeUsageAppend(usageAppendInput));
          yield* sink.append(record);

          const rows = yield* db.select().from(UsageRecordTable.Table);
          expect(rows).toHaveLength(1);
          const row = rows[0];
          expect(row?.provider).toBe("fixture");
          expect(row?.model).toBe("fixture-model");

          const decoded = UsageRecordTable.fromUsageRecordRow(rows[0]!);
          expect(decoded.provider).toBe("fixture");
          expect(O.isNone(decoded.activityId)).toBe(true);
          expect(O.getOrNull(decoded.inputTokens)).toBe(12);
          expect(O.isNone(decoded.unitCount)).toBe(true);
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
