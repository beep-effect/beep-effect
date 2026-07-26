import { fileURLToPath } from "node:url";
import { makeDrizzle, migrate } from "@beep/postgres";
import { makePgliteIntegrationGate, makePgliteSqlTestLayer, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as SqlClient from "effect/unstable/sql/SqlClient";

const { shouldRunPgliteIntegration } = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));

// The drizzle folder now contains `CREATE EXTENSION btree_gist`, which the
// shared external pglite-socket lane cannot load. Migration proofs are
// extension-dependent, so they are pinned to the in-process driver with the
// bundled extension registered rather than gate-selected.
const makeMigrationProofLayer = () =>
  Layer.fresh(makePgliteSqlTestLayer({ inProcess: { extensions: { btree_gist } }, mode: "in-process" }));

if (!shouldRunPgliteIntegration) {
  describe.skip("db-admin architecture-lab migration PgLite integration", () => {});
} else {
  describe.concurrent("db-admin architecture-lab migration PgLite integration", () => {
    layer(makeMigrationProofLayer(), { timeout: "2 minutes" })((it) => {
      it.effect(
        "runs the architecture-lab migration target SQL",
        Effect.fnUntraced(function* () {
          const info = yield* TestDatabaseInfo;
          const db = yield* makeDrizzle();
          const migrationsSchema = pipe(
            info.schema,
            O.getOrElse(() => "drizzle")
          );

          yield* migrate(db, { migrationsFolder, migrationsSchema });

          const sql = (yield* SqlClient.SqlClient).withoutTransforms();
          yield* sql`
            INSERT INTO architecture_lab_worker (
              created_at,
              created_by_principal,
              org_id,
              public_id,
              row_version,
              schema_version,
              source,
              updated_at,
              updated_by_principal,
              display_name,
              status,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"ArchitectureLab"}'::jsonb,
              1,
              'architecture_lab_worker_a1',
              1,
              '0.1.0',
              'Application',
              0,
              '{"kind":"System","component":"ArchitectureLab"}'::jsonb,
              'Ada Lovelace',
              'active',
              'ArchitectureLabWorker',
              1
            )
          `;
          yield* sql`
            INSERT INTO architecture_lab_work_item (id, title, status, assignee_id, priority)
            VALUES ('migration-proof-1', 'Prove db-admin migration', 'assigned', 1, 'high')
          `;
          const rows = yield* sql<{ readonly id: string }>`
            SELECT id FROM architecture_lab_work_item ORDER BY id ASC
          `;
          const workerRows = yield* sql<{ readonly display_name: string }>`
            SELECT display_name FROM architecture_lab_worker ORDER BY id ASC
          `;

          yield* sql`
            INSERT INTO workspace_workspace (
              created_at,
              created_by_principal,
              org_id,
              public_id,
              row_version,
              schema_version,
              source,
              updated_at,
              updated_by_principal,
              fixture_key,
              name,
              organization_fixture_key,
              owner_principal_fixture_key,
              vault_root_path,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"WorkspaceVault"}'::jsonb,
              1,
              'workspace_workspace_a1',
              1,
              '0.1.0',
              'Application',
              0,
              '{"kind":"System","component":"WorkspaceVault"}'::jsonb,
              'workspace.default',
              'Default Workspace',
              'organization.default',
              'principal.default',
              '/tmp/beep-vault',
              'WorkspaceWorkspace',
              1
            )
          `;
          const workspaceRows = yield* sql<{ readonly vault_root_path: string | null }>`
            SELECT vault_root_path FROM workspace_workspace ORDER BY id ASC
          `;

          yield* sql`
            INSERT INTO workspace_thread (
              created_at,
              created_by_principal,
              org_id,
              public_id,
              row_version,
              schema_version,
              source,
              updated_at,
              updated_by_principal,
              title,
              workspace_id,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              1,
              'workspace_thread_a10',
              1,
              '0.1.0',
              'Application',
              0,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              'Matter intake',
              1,
              'WorkspaceThread',
              10
            )
          `;
          yield* sql`
            INSERT INTO workspace_turn (
              created_at,
              created_by_principal,
              org_id,
              public_id,
              row_version,
              schema_version,
              source,
              updated_at,
              updated_by_principal,
              items,
              parent_turn_id,
              thread_id,
              turn_index,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              1,
              'workspace_turn_a11',
              1,
              '0.1.0',
              'Application',
              0,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              '[{"itemType":"message","messageId":20}]'::jsonb,
              NULL,
              10,
              0,
              'WorkspaceTurn',
              11
            ),
            (
              1,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              1,
              'workspace_turn_a12',
              1,
              '0.1.0',
              'Application',
              1,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              '[{"itemType":"message","messageId":21}]'::jsonb,
              11,
              10,
              1,
              'WorkspaceTurn',
              12
            )
          `;
          yield* sql`
            INSERT INTO workspace_message (
              created_at,
              created_by_principal,
              org_id,
              public_id,
              row_version,
              schema_version,
              source,
              updated_at,
              updated_by_principal,
              content,
              role,
              thread_id,
              turn_id,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              1,
              'workspace_message_a20',
              1,
              '0.1.0',
              'Application',
              0,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              '{"_tag":"document","children":[{"_tag":"p","children":[{"_tag":"text","value":"Hello"}]}]}'::jsonb,
              'user',
              10,
              11,
              'WorkspaceMessage',
              20
            ),
            (
              1,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              1,
              'workspace_message_a21',
              1,
              '0.1.0',
              'Application',
              1,
              '{"kind":"System","component":"WorkspaceThreadDomain"}'::jsonb,
              '{"_tag":"document","children":[{"_tag":"p","children":[{"_tag":"text","value":"Branched"}]}]}'::jsonb,
              'assistant',
              10,
              12,
              'WorkspaceMessage',
              21
            )
          `;
          const turnRows = yield* sql<{ readonly id: number; readonly parent_turn_id: number | null }>`
            SELECT id, parent_turn_id FROM workspace_turn ORDER BY id ASC
          `;
          const messageRows = yield* sql<{ readonly role: string }>`
            SELECT role FROM workspace_message ORDER BY id ASC
          `;

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
              cost_usd_approx_micros,
              credential_reference,
              input_tokens,
              latency_millis,
              metadata,
              model,
              output_tokens,
              provider,
              total_tokens,
              unit_count,
              entity_type,
              id
            )
            VALUES (
              0,
              '{"kind":"System","component":"UsageRecordMigration"}'::jsonb,
              1,
              'epistemic_usage_record_a30',
              1,
              '0.1.0',
              'System',
              0,
              '{"kind":"System","component":"UsageRecordMigration"}'::jsonb,
              1,
              '{"kind":"System","component":"UsageRecordMigration"}'::jsonb,
              NULL,
              NULL,
              12,
              NULL,
              '{"trace":"migration-proof"}'::jsonb,
              'fixture-model',
              34,
              'fixture',
              46,
              NULL,
              'EpistemicUsageRecord',
              30
            )
          `;
          const usageRows = yield* sql<{ readonly public_id: string; readonly provider: string }>`
            SELECT public_id, provider FROM epistemic_usage_record ORDER BY id ASC
          `;

          expect(
            pipe(
              rows,
              A.map((row) => row.id)
            )
          ).toEqual(["migration-proof-1"]);
          expect(
            pipe(
              workerRows,
              A.map((row) => row.display_name)
            )
          ).toEqual(["Ada Lovelace"]);
          expect(workspaceRows).toEqual([{ vault_root_path: "/tmp/beep-vault" }]);
          expect(turnRows).toEqual([
            { id: 11, parent_turn_id: null },
            { id: 12, parent_turn_id: 11 },
          ]);
          expect(
            pipe(
              messageRows,
              A.map((row) => row.role)
            )
          ).toEqual(["user", "assistant"]);
          expect(usageRows).toEqual([{ public_id: "epistemic_usage_record_a30", provider: "fixture" }]);
        }),
        120_000
      );
    });
  });
}
