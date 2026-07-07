import { baseEntityFixtureInput } from "@beep/test-utils";
import { CandidateDraft as CandidateDraftModel } from "@beep/workspace-domain/entities/CandidateDraft";
import { CandidateProject as CandidateProjectModel } from "@beep/workspace-domain/entities/CandidateProject";
import { Message as MessageModel } from "@beep/workspace-domain/entities/Message";
import { Thread as ThreadModel } from "@beep/workspace-domain/entities/Thread";
import { Turn as TurnModel } from "@beep/workspace-domain/entities/Turn";
import { DbSchema, Entities } from "@beep/workspace-tables";
import * as CandidateDraft from "@beep/workspace-tables/entities/CandidateDraft";
import * as CandidateProject from "@beep/workspace-tables/entities/CandidateProject";
import * as Message from "@beep/workspace-tables/entities/Message";
import * as Thread from "@beep/workspace-tables/entities/Thread";
import * as Turn from "@beep/workspace-tables/entities/Turn";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const ThreadArbitrary = S.toArbitrary(ThreadModel);
const ThreadEquivalence = S.toEquivalence(ThreadModel);
const MessageArbitrary = S.toArbitrary(MessageModel);
const MessageEquivalence = S.toEquivalence(MessageModel);
const TurnArbitrary = S.toArbitrary(TurnModel);
const TurnEquivalence = S.toEquivalence(TurnModel);

const expectBaseProjectionColumns = (table: typeof CandidateDraft.Table | typeof CandidateProject.Table) => {
  const columns = getColumns(table);

  expect(columns.id.name).toBe("id");
  expect(columns.id.primary).toBe(true);
  expect(columns.id.columnType).toBe("PgSerial");
  expect(columns.entityType.name).toBe("entity_type");
  expect(columns.entityType.notNull).toBe(true);
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

    expect(CandidateDraft.Table.definition.tableName).toBe("workspace_candidate_draft");
    expect(CandidateDraft.Table.definition.entityId.entityType).toBe("WorkspaceCandidateDraft");
    expect(CandidateDraft.Table.entitySchema).toBe(CandidateDraftModel);
    expect(config.name).toBe("workspace_candidate_draft");
    expectBaseProjectionColumns(CandidateDraft.Table);
  });

  it("materializes CandidateProject metadata without executing a live database", () => {
    const config = getTableConfig(CandidateProject.Table);

    expect(CandidateProject.Table.definition.tableName).toBe("workspace_candidate_project");
    expect(CandidateProject.Table.definition.entityId.entityType).toBe("WorkspaceCandidateProject");
    expect(CandidateProject.Table.entitySchema).toBe(CandidateProjectModel);
    expect(config.name).toBe("workspace_candidate_project");
    expectBaseProjectionColumns(CandidateProject.Table);
  });

  it("exports the metadata aggregate and entity namespaces", () => {
    expect(DbSchema.candidateDraft).toBe(CandidateDraft.Table);
    expect(DbSchema.candidateProject).toBe(CandidateProject.Table);
    expect(DbSchema.message).toBe(Message.Table);
    expect(DbSchema.thread).toBe(Thread.Table);
    expect(DbSchema.turn).toBe(Turn.Table);
    expect(Entities.CandidateDraft.Table).toBe(CandidateDraft.Table);
    expect(Entities.CandidateProject.Table).toBe(CandidateProject.Table);
    expect(Entities.Message.Table).toBe(Message.Table);
    expect(Entities.Thread.Table).toBe(Thread.Table);
    expect(Entities.Turn.Table).toBe(Turn.Table);
  });

  it("materializes Thread, Turn, and Message metadata without executing a live database", () => {
    expect(getTableConfig(Thread.Table).name).toBe("workspace_thread");
    expect(Thread.Table.entitySchema).toBe(ThreadModel);
    expect(getColumns(Thread.Table).workspaceId.name).toBe("workspace_id");

    expect(getTableConfig(Turn.Table).name).toBe("workspace_turn");
    expect(Turn.Table.entitySchema).toBe(TurnModel);
    expect(getColumns(Turn.Table).parentTurnId.name).toBe("parent_turn_id");
    expect(getColumns(Turn.Table).items.columnType).toBe("PgJsonb");

    expect(getTableConfig(Message.Table).name).toBe("workspace_message");
    expect(Message.Table.entitySchema).toBe(MessageModel);
    expect(getColumns(Message.Table).content.columnType).toBe("PgJsonb");
    expect(getColumns(Message.Table).role.name).toBe("role");
  });

  it("round-trips Thread, Turn, and Message rows through the converters", () => {
    const thread = S.decodeUnknownSync(ThreadModel)({
      ...baseEntityFixtureInput("WorkspaceThread", 10),
      title: "Matter intake",
      workspaceId: 2,
    });
    const threadInsert = Thread.toThreadInsert(thread);
    expect("id" in threadInsert).toBe(false);
    expect(threadInsert.title).toBe("Matter intake");
    expect(threadInsert.workspaceId).toBe(2);
    expect(threadInsert.entityType).toBe("WorkspaceThread");
    expect(Thread.fromThreadRow({ ...threadInsert, id: 10 }).title).toBe("Matter intake");

    const message = S.decodeUnknownSync(MessageModel)({
      ...baseEntityFixtureInput("WorkspaceMessage", 20),
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

    const turn = S.decodeUnknownSync(TurnModel)({
      ...baseEntityFixtureInput("WorkspaceTurn", 30),
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

  it("round-trips schema-derived Thread, Message, and Turn entities through the row converters", () =>
    fc.assert(
      fc.property(ThreadArbitrary, MessageArbitrary, TurnArbitrary, (thread, message, turn) => {
        const threadInsert = Thread.toThreadInsert(thread);
        const messageInsert = Message.toMessageInsert(message);
        const turnInsert = Turn.toTurnInsert(turn);

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
      }),
      { numRuns: 50 }
    ));
});
