import { DbAdminMigrationTargets, DocumentsSyncMigrationTarget, WorkspaceThreadMigrationTarget } from "@beep/db-admin";
import { ArchitectureLabMigrationTarget, DbAdminMigrationTarget } from "@beep/db-admin/migrations/ArchitectureLab";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";

const encodeMigrationTarget = S.encodeUnknownResult(DbAdminMigrationTarget);
const decodeMigrationTarget = S.decodeUnknownResult(DbAdminMigrationTarget);
const MigrationTargetArbitrary = Arbitrary.schema(DbAdminMigrationTarget);

describe("db-admin migration targets", () => {
  it("registers the architecture lab WorkItem and Worker tables", () => {
    expect(DbAdminMigrationTargets).toContain(ArchitectureLabMigrationTarget);
    expect(ArchitectureLabMigrationTarget.tables).toContain("architecture_lab_work_item");
    expect(ArchitectureLabMigrationTarget.tables).toContain("architecture_lab_worker");
  });

  it("registers the workspace Workspace, Thread, Turn, and Message tables", () => {
    expect(DbAdminMigrationTargets).toContain(WorkspaceThreadMigrationTarget);
    expect(WorkspaceThreadMigrationTarget.tables).toEqual([
      "workspace_workspace",
      "workspace_thread",
      "workspace_turn",
      "workspace_message",
    ]);
  });

  it("registers the documents SyncItem, SyncOperation, SyncCursor, and SyncConflict tables", () => {
    expect(DbAdminMigrationTargets).toContain(DocumentsSyncMigrationTarget);
    expect(DocumentsSyncMigrationTarget.tables).toEqual([
      "documents_sync_item",
      "documents_sync_operation",
      "documents_sync_cursor",
      "documents_sync_conflict",
    ]);
  });

  it("preserves encoded migration target wire shapes", () => {
    expect(Result.getOrThrow(encodeMigrationTarget(ArchitectureLabMigrationTarget))).toEqual({
      drizzleSchema: ArchitectureLabMigrationTarget.drizzleSchema,
      name: "architecture-lab",
      schemaName: "architecture_lab",
      tables: ["architecture_lab_work_item", "architecture_lab_worker"],
    });

    expect(Result.getOrThrow(encodeMigrationTarget(WorkspaceThreadMigrationTarget))).toEqual({
      drizzleSchema: WorkspaceThreadMigrationTarget.drizzleSchema,
      name: "workspace-thread",
      schemaName: "workspace",
      tables: ["workspace_workspace", "workspace_thread", "workspace_turn", "workspace_message"],
    });
  });

  it.prop(
    "round-trips migration target metadata from schema-derived arbitraries",
    [MigrationTargetArbitrary],
    ([target]) => {
      const encoded = Result.getOrThrow(encodeMigrationTarget(target));
      const decoded = Result.getOrThrow(decodeMigrationTarget(encoded));
      pipe(Eq.equals(decoded, target), assertTrue);
    },
    { arbitrary: fcRuns(25) }
  );

  it("rejects invalid migration target identifiers at the schema boundary", () => {
    pipe(
      decodeMigrationTarget({
        drizzleSchema: {},
        name: "ArchitectureLab",
        schemaName: "architecture_lab",
        tables: ["architecture_lab_work_item"],
      }),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decodeMigrationTarget({
        drizzleSchema: {},
        name: "architecture-lab",
        schemaName: "ArchitectureLab",
        tables: ["architecture_lab_work_item"],
      }),
      Result.isFailure,
      assertTrue
    );
    pipe(
      decodeMigrationTarget({
        drizzleSchema: {},
        name: "architecture-lab",
        schemaName: "architecture_lab",
        tables: [],
      }),
      Result.isFailure,
      assertTrue
    );
  });
});
