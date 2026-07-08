import { DbAdminMigrationTargets, WorkspaceThreadMigrationTarget } from "@beep/db-admin";
import { ArchitectureLabMigrationTarget, DbAdminMigrationTarget } from "@beep/db-admin/migrations/ArchitectureLab";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const encodeMigrationTarget = S.encodeUnknownResult(DbAdminMigrationTarget);
const decodeMigrationTarget = S.decodeUnknownResult(DbAdminMigrationTarget);
const MigrationTargetArbitrary = S.toArbitrary(DbAdminMigrationTarget);

describe("db-admin migration targets", () => {
  it("registers the architecture lab WorkItem and Worker tables", () => {
    expect(DbAdminMigrationTargets).toContain(ArchitectureLabMigrationTarget);
    expect(ArchitectureLabMigrationTarget.tables).toContain("architecture_lab_work_item");
    expect(ArchitectureLabMigrationTarget.tables).toContain("architecture_lab_worker");
  });

  it("registers the workspace Thread, Turn, and Message tables", () => {
    expect(DbAdminMigrationTargets).toContain(WorkspaceThreadMigrationTarget);
    expect(WorkspaceThreadMigrationTarget.tables).toEqual(["workspace_thread", "workspace_turn", "workspace_message"]);
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
      tables: ["workspace_thread", "workspace_turn", "workspace_message"],
    });
  });

  it("round-trips migration target metadata from schema-derived arbitraries", () => {
    fc.assert(
      fc.property(MigrationTargetArbitrary, (target) => {
        const encoded = Result.getOrThrow(encodeMigrationTarget(target));
        const decoded = Result.getOrThrow(decodeMigrationTarget(encoded));

        expect(Eq.equals(decoded, target)).toBe(true);
      }),
      fcRuns(25)
    );
  });

  it("rejects invalid migration target identifiers at the schema boundary", () => {
    expect(
      Result.isFailure(
        decodeMigrationTarget({
          drizzleSchema: {},
          name: "ArchitectureLab",
          schemaName: "architecture_lab",
          tables: ["architecture_lab_work_item"],
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeMigrationTarget({
          drizzleSchema: {},
          name: "architecture-lab",
          schemaName: "ArchitectureLab",
          tables: ["architecture_lab_work_item"],
        })
      )
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeMigrationTarget({
          drizzleSchema: {},
          name: "architecture-lab",
          schemaName: "architecture_lab",
          tables: [],
        })
      )
    ).toBe(true);
  });
});
