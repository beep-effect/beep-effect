import { describe, expect, it } from "tstyche";
import type { EntityTable } from "@beep/drizzle";
import type * as CandidateDraft from "@beep/workspace-domain/entities/CandidateDraft";
import type * as CandidateProject from "@beep/workspace-domain/entities/CandidateProject";
import type * as Message from "@beep/workspace-domain/entities/Message";
import type * as Thread from "@beep/workspace-domain/entities/Thread";
import type * as Turn from "@beep/workspace-domain/entities/Turn";
import type * as Workspace from "@beep/workspace-domain/entities/Workspace";
import type { DbSchema } from "@beep/workspace-tables";
import type * as CandidateDraftTables from "@beep/workspace-tables/entities/CandidateDraft";
import type * as CandidateProjectTables from "@beep/workspace-tables/entities/CandidateProject";
import type * as MessageTables from "@beep/workspace-tables/entities/Message";
import type * as ThreadTables from "@beep/workspace-tables/entities/Thread";
import type * as TurnTables from "@beep/workspace-tables/entities/Turn";
import type * as WorkspaceTables from "@beep/workspace-tables/entities/Workspace";

describe("WorkspaceTables types", () => {
  it("exports the DbSchema type from the package entrypoint", () => {
    expect<DbSchema>().type.toBe<{
      readonly candidateDraft: typeof CandidateDraftTables.Table;
      readonly candidateProject: typeof CandidateProjectTables.Table;
      readonly message: typeof MessageTables.Table;
      readonly thread: typeof ThreadTables.Table;
      readonly turn: typeof TurnTables.Table;
      readonly workspace: typeof WorkspaceTables.Table;
    }>();
  });

  it("preserves CandidateDraft table and descriptor metadata literals", () => {
    expect<typeof CandidateDraftTables.Table>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof CandidateDraft.CandidateDraft>
    >();
    expect<typeof CandidateDraftTables.Table.definition.tableName>().type.toBe<"workspace_candidate_draft">();
    expect<typeof CandidateDraftTables.Table.definition.entityId.entityType>().type.toBe<"WorkspaceCandidateDraft">();
    expect<typeof CandidateDraftTables.Table.definition.persisted.fixtureKey.storageKind>().type.toBe<"text">();
    expect<typeof CandidateDraftTables.Table.definition.persisted.lifecycle.storageKind>().type.toBe<"literal">();
    expect<typeof CandidateDraftTables.Table.definition.persisted.snapshot.storageKind>().type.toBe<"jsonb">();
  });

  it("preserves CandidateProject table and descriptor metadata literals", () => {
    expect<typeof CandidateProjectTables.Table>().type.toBeAssignableTo<
      EntityTable.TableFor<typeof CandidateProject.CandidateProject>
    >();
    expect<typeof CandidateProjectTables.Table.definition.tableName>().type.toBe<"workspace_candidate_project">();
    expect<
      typeof CandidateProjectTables.Table.definition.entityId.entityType
    >().type.toBe<"WorkspaceCandidateProject">();
    expect<typeof CandidateProjectTables.Table.definition.persisted.fixtureKey.storageKind>().type.toBe<"text">();
    expect<typeof CandidateProjectTables.Table.definition.persisted.lifecycle.storageKind>().type.toBe<"literal">();
    expect<typeof CandidateProjectTables.Table.definition.persisted.snapshot.storageKind>().type.toBe<"jsonb">();
  });

  it("preserves Thread, Turn, and Message table metadata literals", () => {
    expect<typeof ThreadTables.Table>().type.toBeAssignableTo<EntityTable.TableFor<typeof Thread.Thread>>();
    expect<typeof ThreadTables.Table.definition.tableName>().type.toBe<"workspace_thread">();
    expect<typeof TurnTables.Table>().type.toBeAssignableTo<EntityTable.TableFor<typeof Turn.Turn>>();
    expect<typeof TurnTables.Table.definition.tableName>().type.toBe<"workspace_turn">();
    expect<typeof TurnTables.Table.definition.persisted.items.storageKind>().type.toBe<"jsonb">();
    expect<typeof MessageTables.Table>().type.toBeAssignableTo<EntityTable.TableFor<typeof Message.Message>>();
    expect<typeof MessageTables.Table.definition.tableName>().type.toBe<"workspace_message">();
    expect<typeof MessageTables.Table.definition.persisted.content.storageKind>().type.toBe<"jsonb">();
  });

  it("preserves Workspace table metadata literals", () => {
    expect<typeof WorkspaceTables.Table>().type.toBeAssignableTo<EntityTable.TableFor<typeof Workspace.Workspace>>();
    expect<typeof WorkspaceTables.Table.definition.tableName>().type.toBe<"workspace_workspace">();
    expect<typeof WorkspaceTables.Table.definition.entityId.entityType>().type.toBe<"WorkspaceWorkspace">();
    expect<typeof WorkspaceTables.Table.definition.persisted.vaultRootPath.storageKind>().type.toBe<"text">();
  });
});
