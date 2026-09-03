import { appendTurnFinalizationUsageRecord, TurnFinalizationUsageAppend } from "@beep/epistemic-domain";
import * as UsageRecordTable from "@beep/epistemic-tables/entities/UsageRecord";
import { makeDrizzle, makeDrizzleLayer, migrateBundle } from "@beep/postgres";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { UsageRecordSink, UsageRecordSinkDrizzle } from "@/chat/UsageRecordSink";
import { migrateOnBoot } from "@/runtime/Migrations";
import { migrationBundle } from "@/runtime/Migrations.gen";

const { shouldRunPgliteIntegration, pgliteIntegrationTimeoutMillis } = makePgliteIntegrationGate();
// The bundled migrations issue `CREATE EXTENSION btree_gist`, so the test
// database has to register the bundled extension exactly as the sidecar's
// `makeBundledPgliteLayer` does.
const makeInProcessPgliteLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

const decodeUsageAppend = S.decodeUnknownSync(TurnFinalizationUsageAppend);
const optionalActivityMigrationName = "20260801021411_usage_record_optional_activity";
const migrationsBeforeOptionalActivity = A.filter(
  migrationBundle,
  (migration) => migration.name !== optionalActivityMigrationName
);

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
  Layer.provideMerge(BunCrypto.layer),
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

if (!shouldRunPgliteIntegration) {
  describe.skip("Professional desktop UsageRecordSink Drizzle PgLite integration", () => {});
} else {
  describe("Professional desktop UsageRecordSink Drizzle PgLite integration", { concurrent: false }, () => {
    layer(UsageRecordSinkLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "preserves legacy activity provenance and persists a finalized turn UsageRecord",
        Effect.fnUntraced(function* () {
          const db = yield* makeDrizzle();
          yield* migrateBundle(db, { migrations: migrationsBeforeOptionalActivity, migrationsSchema: "drizzle" });
          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          yield* sql`
            INSERT INTO epistemic_usage_record (
              created_at,
              created_by_principal,
              org_id,
              public_id,
              row_version,
              schema_version,
              source,
              updated_at,
              updated_by_principal,
              activity_id,
              actor,
              metadata,
              model,
              provider,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"LegacyUsageRecord"}'::jsonb,
              1,
              'epistemic_usage_record_legacy',
              1,
              '0.0.0',
              'System',
              0,
              '{"kind":"System","component":"LegacyUsageRecord"}'::jsonb,
              1,
              '{"kind":"System","component":"LegacyUsageRecord"}'::jsonb,
              '{"legacy":true}'::jsonb,
              'legacy-model',
              'legacy-provider',
              'EpistemicUsageRecord',
              41
            )
          `;
          const legacyBefore = yield* sql<{ readonly activity_id: number | null }>`
            SELECT activity_id FROM epistemic_usage_record WHERE id = 41
          `;
          expect(legacyBefore).toEqual([{ activity_id: 1 }]);

          yield* migrateEpistemicUsage();
          const legacyAfter = yield* sql<{ readonly activity_id: number | null }>`
            SELECT activity_id FROM epistemic_usage_record WHERE id = 41
          `;
          expect(legacyAfter).toEqual([{ activity_id: 1 }]);

          const sink = yield* UsageRecordSink;

          const record = appendTurnFinalizationUsageRecord(decodeUsageAppend(usageAppendInput));
          yield* sink.append(record);

          const rows = yield* db.select().from(UsageRecordTable.Table);
          expect(rows).toHaveLength(2);
          const appended = A.findFirst(rows, (row) => row.publicId === usageAppendInput.publicId);
          expect(O.isSome(appended)).toBe(true);
          if (O.isSome(appended)) {
            expect(appended.value.provider).toBe("fixture");
            expect(appended.value.model).toBe("fixture-model");

            const decoded = UsageRecordTable.fromUsageRecordRow(appended.value);
            expect(decoded.provider).toBe("fixture");
            expect(O.isNone(decoded.activityId)).toBe(true);
            expect(O.getOrNull(decoded.inputTokens)).toBe(12);
            expect(O.isNone(decoded.unitCount)).toBe(true);
          }
        }),
        pgliteIntegrationTimeoutMillis
      );
    });
  });
}
