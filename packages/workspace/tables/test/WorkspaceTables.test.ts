import { fcRuns, productEntityFixtureInput } from "@beep/test-utils";
import { CandidateDraft as CandidateDraftModel } from "@beep/workspace-domain/entities/CandidateDraft";
import { CandidateProject as CandidateProjectModel } from "@beep/workspace-domain/entities/CandidateProject";
import { Message as MessageModel } from "@beep/workspace-domain/entities/Message";
import { Thread as ThreadModel } from "@beep/workspace-domain/entities/Thread";
import { Turn as TurnModel } from "@beep/workspace-domain/entities/Turn";
import { Workspace as WorkspaceModel } from "@beep/workspace-domain/entities/Workspace";
import { DbSchema, Entities } from "@beep/workspace-tables";
import * as CandidateDraft from "@beep/workspace-tables/entities/CandidateDraft";
import * as CandidateProject from "@beep/workspace-tables/entities/CandidateProject";
import * as Message from "@beep/workspace-tables/entities/Message";
import * as Thread from "@beep/workspace-tables/entities/Thread";
import * as Turn from "@beep/workspace-tables/entities/Turn";
import * as Workspace from "@beep/workspace-tables/entities/Workspace";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ThreadArbitrary = S.toArbitrary(ThreadModel)(fc);
const ThreadEquivalence = S.toEquivalence(ThreadModel);
const MessageArbitrary = S.toArbitrary(MessageModel)(fc);
const MessageEquivalence = S.toEquivalence(MessageModel);
const TurnArbitrary = S.toArbitrary(TurnModel)(fc);
const TurnEquivalence = S.toEquivalence(TurnModel);
const WorkspaceArbitrary = S.toArbitrary(WorkspaceModel)(fc);
const WorkspaceEquivalence = S.toEquivalence(WorkspaceModel);

const expectBaseProjectionColumns = (table: typeof CandidateDraft.Table | typeof CandidateProject.Table) => {
  const columns = getColumns(table);

  expect(columns.id.name).toBe("id");
  expect(columns.id.primary).toBe(true);
  expect(columns.id.columnType).toBe("PgSerial");
  expect(columns.entityType.name).toBe("entity_type");
  expect(columns.entityType.notNull).toBe(true);
  expect(columns.publicId.name).toBe("public_id");
  expect(columns.publicId.columnType).toBe("PgText");
  expect(columns.publicId.notNull).toBe(true);
  expect(columns.fixtureKey.name).toBe("fixture_key");
  expect(columns.fixtureKey.columnType).toBe("PgText");
  expect(columns.lifecycle.name).toBe("lifecycle");
  expect(columns.lifecycle.columnType).toBe("PgText");
  expect(columns.snapshot.name).toBe("snapshot");
  expect(columns.snapshot.columnType).toBe("PgJsonb");
};

describe("WorkspaceTables", () => {
  it("materializes CandidateDraft metadata without executing a live database", () => {
    const config = getTableConfig(CandidateDraft.Table);

    expect(CandidateDraft.TABLE_NAME).toBe("workspace_candidate_draft");
    expect(CandidateDraftModel.sql.tableName).toBe("workspace_candidate_draft");
    expect(config.name).toBe("workspace_candidate_draft");
    expectBaseProjectionColumns(CandidateDraft.Table);
  });

  it("materializes CandidateProject metadata without executing a live database", () => {
    const config = getTableConfig(CandidateProject.Table);

    expect(CandidateProject.TABLE_NAME).toBe("workspace_candidate_project");
    expect(CandidateProjectModel.sql.tableName).toBe("workspace_candidate_project");
    expect(config.name).toBe("workspace_candidate_project");
    expectBaseProjectionColumns(CandidateProject.Table);
  });

  it("exports the metadata aggregate and entity namespaces", () => {
    expect(DbSchema.candidateDraft).toBe(CandidateDraft.Table);
    expect(DbSchema.candidateProject).toBe(CandidateProject.Table);
    expect(DbSchema.message).toBe(Message.Table);
    expect(DbSchema.thread).toBe(Thread.Table);
    expect(DbSchema.turn).toBe(Turn.Table);
    expect(DbSchema.workspace).toBe(Workspace.Table);
    expect(Entities.CandidateDraft.Table).toBe(CandidateDraft.Table);
    expect(Entities.CandidateProject.Table).toBe(CandidateProject.Table);
    expect(Entities.Message.Table).toBe(Message.Table);
    expect(Entities.Thread.Table).toBe(Thread.Table);
    expect(Entities.Turn.Table).toBe(Turn.Table);
    expect(Entities.Workspace.Table).toBe(Workspace.Table);
  });

  it("materializes Thread, Turn, and Message metadata without executing a live database", () => {
    expect(getTableConfig(Thread.Table).name).toBe("workspace_thread");
    expect(Thread.TABLE_NAME).toBe("workspace_thread");
    expect(ThreadModel.sql.tableName).toBe("workspace_thread");
    expect(getColumns(Thread.Table).workspaceId.name).toBe("workspace_id");

    expect(getTableConfig(Turn.Table).name).toBe("workspace_turn");
    expect(Turn.TABLE_NAME).toBe("workspace_turn");
    expect(TurnModel.sql.tableName).toBe("workspace_turn");
    expect(getColumns(Turn.Table).parentTurnId.name).toBe("parent_turn_id");
    expect(getColumns(Turn.Table).items.columnType).toBe("PgJsonb");

    expect(getTableConfig(Message.Table).name).toBe("workspace_message");
    expect(Message.TABLE_NAME).toBe("workspace_message");
    expect(MessageModel.sql.tableName).toBe("workspace_message");
    expect(getColumns(Message.Table).content.columnType).toBe("PgJsonb");
    expect(getColumns(Message.Table).role.name).toBe("role");

    expect(getTableConfig(Workspace.Table).name).toBe("workspace_workspace");
    expect(Workspace.TABLE_NAME).toBe("workspace_workspace");
    expect(WorkspaceModel.sql.tableName).toBe("workspace_workspace");
    expect(getColumns(Workspace.Table).vaultRootPath.name).toBe("vault_root_path");
  });

  it("round-trips Thread, Turn, and Message rows through the converters", () => {
    const thread = ThreadModel.decodeUnknownSync({
      ...productEntityFixtureInput("WorkspaceThread", 10),
      title: "Matter intake",
      workspaceId: 2,
    });
    const threadInsert = Thread.toThreadInsert(thread);
    expect("id" in threadInsert).toBe(false);
    expect(threadInsert.title).toBe("Matter intake");
    expect(threadInsert.workspaceId).toBe(2);
    expect(threadInsert.entityType).toBe("WorkspaceThread");
    expect(Thread.fromThreadRow({ ...threadInsert, id: 10 }).title).toBe("Matter intake");

    const message = MessageModel.decodeUnknownSync({
      ...productEntityFixtureInput("WorkspaceMessage", 20),
      content: { _tag: "document", children: [] },
      role: "user",
      threadId: 10,
      turnId: 30,
    });
    const messageInsert = Message.toMessageInsert(message);
    expect("id" in messageInsert).toBe(false);
    expect(messageInsert.role).toBe("user");
    expect(messageInsert.threadId).toBe(10);
    expect(Message.fromMessageRow({ ...messageInsert, id: 20 }).role).toBe("user");

    const turn = TurnModel.decodeUnknownSync({
      ...productEntityFixtureInput("WorkspaceTurn", 30),
      items: [{ itemType: "message", messageId: 20 }],
      parentTurnId: null,
      threadId: 10,
      turnIndex: 0,
    });
    const turnInsert = Turn.toTurnInsert(turn);
    expect("id" in turnInsert).toBe(false);
    expect(turnInsert.threadId).toBe(10);
    expect(turnInsert.turnIndex).toBe(0);
    expect(turnInsert.parentTurnId).toBe(null);
    const roundTripped = Turn.fromTurnRow({
      ...turnInsert,
      id: 30,
      // $inferInsert types parentTurnId as optional (number | null | undefined);
      // the select-row converter expects number | null, so resolve the absent
      // optional to its concrete null before round-tripping.
      parentTurnId: turnInsert.parentTurnId ?? null,
    });
    expect(roundTripped.items[0]?.itemType).toBe("message");
    expect(O.isNone(roundTripped.parentTurnId)).toBe(true);
  });

  it("round-trips Workspace rows through the converters", () => {
    const workspace = WorkspaceModel.decodeUnknownSync({
      ...productEntityFixtureInput("WorkspaceWorkspace", 40),
      fixtureKey: "workspace.default",
      name: "Default Workspace",
      organizationFixtureKey: "organization.default",
      ownerPrincipalFixtureKey: "principal.default",
      vaultRootPath: "/tmp/beep-workspace-vault",
    });

    const workspaceInsert = Workspace.toWorkspaceInsert(workspace);

    expect("id" in workspaceInsert).toBe(false);
    expect(workspaceInsert.entityType).toBe("WorkspaceWorkspace");
    expect(workspaceInsert.fixtureKey).toBe("workspace.default");
    expect(workspaceInsert.name).toBe("Default Workspace");
    expect(workspaceInsert.organizationFixtureKey).toBe("organization.default");
    expect(workspaceInsert.ownerPrincipalFixtureKey).toBe("principal.default");
    expect(workspaceInsert.vaultRootPath).toBe("/tmp/beep-workspace-vault");

    const roundTripped = Workspace.fromWorkspaceRow({
      ...workspaceInsert,
      id: 40,
      vaultRootPath: workspaceInsert.vaultRootPath ?? null,
    });

    expect(roundTripped.name).toBe("Default Workspace");
    expect(O.getOrUndefined(roundTripped.vaultRootPath)).toBe("/tmp/beep-workspace-vault");
  });

  it("round-trips schema-derived Thread, Message, Turn, and Workspace entities through the row converters", () =>
    fc.assert(
      fc.property(
        ThreadArbitrary,
        MessageArbitrary,
        TurnArbitrary,
        WorkspaceArbitrary,
        (thread, message, turn, workspace) => {
          const threadInsert = Thread.toThreadInsert(thread);
          const messageInsert = Message.toMessageInsert(message);
          const turnInsert = Turn.toTurnInsert(turn);
          const workspaceInsert = Workspace.toWorkspaceInsert(workspace);

          expect(ThreadEquivalence(Thread.fromThreadRow({ ...threadInsert, id: thread.id }), thread)).toBe(true);
          expect(MessageEquivalence(Message.fromMessageRow({ ...messageInsert, id: message.id }), message)).toBe(true);
          expect(
            TurnEquivalence(
              Turn.fromTurnRow({
                ...turnInsert,
                id: turn.id,
                parentTurnId: turnInsert.parentTurnId ?? null,
              }),
              turn
            )
          ).toBe(true);
          expect(
            WorkspaceEquivalence(
              Workspace.fromWorkspaceRow({
                ...workspaceInsert,
                id: workspace.id,
                vaultRootPath: workspaceInsert.vaultRootPath ?? null,
              }),
              workspace
            )
          ).toBe(true);
        }
      ),
      fcRuns(50)
    ));
});
