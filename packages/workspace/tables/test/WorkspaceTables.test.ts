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
import { Effect } from "effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const ThreadEquivalence = S.toEquivalence(ThreadModel);

const MessageEquivalence = S.toEquivalence(MessageModel);

const TurnEquivalence = S.toEquivalence(TurnModel);

const WorkspaceEquivalence = S.toEquivalence(WorkspaceModel);

const decodeUnknownThreadModel = S.decodeUnknownEffect(ThreadModel);
const decodeUnknownMessageModel = S.decodeUnknownEffect(MessageModel);
const decodeUnknownTurnModel = S.decodeUnknownEffect(TurnModel);
const decodeUnknownWorkspaceModel = S.decodeUnknownEffect(WorkspaceModel);

const absentAsNull = <A>(value: A | null | undefined): A | null => value ?? null;

// Every row codec here is a class schema, so an unencodable entity has to stay
// an instance of its model: clone onto the same prototype and corrupt a single
// column rather than handing the encoder a bare struct it would reject wholesale.
const withUnencodablePublicId = <A extends object>(entity: A): A =>
  Object.assign(Object.create(Object.getPrototypeOf(entity)), entity, { publicId: 42 });

const converterFailure = <A, E>(result: Result.Result<A, E>): Effect.Effect<E, A> =>
  result.pipe(Result.flip, Effect.fromResult);

const expectConverterFailure = (error: { readonly _tag: string; readonly message: string }, tag: string): void => {
  expect(error._tag).toBe(tag);
  expect(Str.isNonEmpty(error.message)).toBe(true);
};

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

  it.effect(
    "round-trips Thread, Turn, and Message rows through the converters",
    Effect.fnUntraced(function* () {
      const thread = yield* decodeUnknownThreadModel({
        ...productEntityFixtureInput("WorkspaceThread", 10),
        title: "Matter intake",
        workspaceId: 2,
      });
      const threadInsert = yield* Effect.fromResult(Thread.toThreadInsert(thread));
      expect("id" in threadInsert).toBe(false);
      expect(threadInsert.title).toBe("Matter intake");
      expect(threadInsert.workspaceId).toBe(2);
      expect(threadInsert.entityType).toBe("WorkspaceThread");
      const roundTrippedThread = yield* Effect.fromResult(Thread.fromThreadRow({ ...threadInsert, id: 10 }));
      expect(roundTrippedThread.title).toBe("Matter intake");

      const message = yield* decodeUnknownMessageModel({
        ...productEntityFixtureInput("WorkspaceMessage", 20),
        content: { _tag: "document", children: [] },
        role: "user",
        threadId: 10,
        turnId: 30,
      });
      const messageInsert = yield* Effect.fromResult(Message.toMessageInsert(message));
      expect("id" in messageInsert).toBe(false);
      expect(messageInsert.role).toBe("user");
      expect(messageInsert.threadId).toBe(10);
      const roundTrippedMessage = yield* Effect.fromResult(Message.fromMessageRow({ ...messageInsert, id: 20 }));
      expect(roundTrippedMessage.role).toBe("user");

      const turn = yield* decodeUnknownTurnModel({
        ...productEntityFixtureInput("WorkspaceTurn", 30),
        items: [{ itemType: "message", messageId: 20 }],
        parentTurnId: null,
        threadId: 10,
        turnIndex: 0,
      });
      const turnInsert = yield* Effect.fromResult(Turn.toTurnInsert(turn));
      expect("id" in turnInsert).toBe(false);
      expect(turnInsert.threadId).toBe(10);
      expect(turnInsert.turnIndex).toBe(0);
      expect(turnInsert.parentTurnId).toBe(null);
      const roundTripped = yield* Effect.fromResult(
        Turn.fromTurnRow({
          ...turnInsert,
          id: 30,
          // $inferInsert types parentTurnId as optional (number | null | undefined);
          // the select-row converter expects number | null, so resolve the absent
          // optional to its concrete null before round-tripping.
          parentTurnId: turnInsert.parentTurnId ?? null,
        })
      );
      expect(roundTripped.items[0]?.itemType).toBe("message");
      expect(O.isNone(roundTripped.parentTurnId)).toBe(true);
    })
  );

  it.effect(
    "round-trips Workspace rows through the converters",
    Effect.fnUntraced(function* () {
      const workspace = yield* decodeUnknownWorkspaceModel({
        ...productEntityFixtureInput("WorkspaceWorkspace", 40),
        fixtureKey: "workspace.default",
        name: "Default Workspace",
        organizationFixtureKey: "organization.default",
        ownerPrincipalFixtureKey: "principal.default",
        vaultRootPath: "/tmp/beep-workspace-vault",
      });

      const workspaceInsert = yield* Effect.fromResult(Workspace.toWorkspaceInsert(workspace));

      expect("id" in workspaceInsert).toBe(false);
      expect(workspaceInsert.entityType).toBe("WorkspaceWorkspace");
      expect(workspaceInsert.fixtureKey).toBe("workspace.default");
      expect(workspaceInsert.name).toBe("Default Workspace");
      expect(workspaceInsert.organizationFixtureKey).toBe("organization.default");
      expect(workspaceInsert.ownerPrincipalFixtureKey).toBe("principal.default");
      expect(workspaceInsert.vaultRootPath).toBe("/tmp/beep-workspace-vault");

      const roundTripped = yield* Effect.fromResult(
        Workspace.fromWorkspaceRow({
          ...workspaceInsert,
          id: 40,
          vaultRootPath: workspaceInsert.vaultRootPath ?? null,
        })
      );

      expect(roundTripped.name).toBe("Default Workspace");
      expect(O.getOrUndefined(roundTripped.vaultRootPath)).toBe("/tmp/beep-workspace-vault");
    })
  );

  it.effect.prop(
    "round-trips schema-derived Thread, Message, Turn, and Workspace entities through the row converters",
    [S.Tuple([ThreadModel, MessageModel, TurnModel, WorkspaceModel])],
    Effect.fnUntraced(function* ([[thread, message, turn, workspace]]) {
      const threadInsert = yield* Effect.fromResult(Thread.toThreadInsert(thread));
      const messageInsert = yield* Effect.fromResult(Message.toMessageInsert(message));
      const turnInsert = yield* Effect.fromResult(Turn.toTurnInsert(turn));
      const workspaceInsert = yield* Effect.fromResult(Workspace.toWorkspaceInsert(workspace));
      const roundTrippedThread = yield* Effect.fromResult(Thread.fromThreadRow({ ...threadInsert, id: thread.id }));
      const roundTrippedMessage = yield* Effect.fromResult(
        Message.fromMessageRow({ ...messageInsert, id: message.id })
      );
      const roundTrippedTurn = yield* Effect.fromResult(
        Turn.fromTurnRow({
          ...turnInsert,
          id: turn.id,
          parentTurnId: absentAsNull(turnInsert.parentTurnId),
        })
      );
      const roundTrippedWorkspace = yield* Effect.fromResult(
        Workspace.fromWorkspaceRow({
          ...workspaceInsert,
          id: workspace.id,
          vaultRootPath: absentAsNull(workspaceInsert.vaultRootPath),
        })
      );

      expect(ThreadEquivalence(roundTrippedThread, thread)).toBe(true);
      expect(MessageEquivalence(roundTrippedMessage, message)).toBe(true);
      expect(TurnEquivalence(roundTrippedTurn, turn)).toBe(true);
      expect(WorkspaceEquivalence(roundTrippedWorkspace, workspace)).toBe(true);
    }),
    { arbitrary: fcRuns(50) }
  );
  it.effect(
    "reports a typed converter failure on both sides of each entity boundary",
    Effect.fnUntraced(function* () {
      const thread = yield* decodeUnknownThreadModel({
        ...productEntityFixtureInput("WorkspaceThread", 10),
        title: "Matter intake",
        workspaceId: 2,
      });
      const threadInsert = yield* Effect.fromResult(Thread.toThreadInsert(thread));
      expectConverterFailure(
        yield* converterFailure(Thread.toThreadInsert(withUnencodablePublicId(thread))),
        "ThreadConverterError"
      );
      expectConverterFailure(
        yield* converterFailure(
          Thread.fromThreadRow({ ...threadInsert, id: 10, publicId: 42 } as unknown as Thread.ThreadRow)
        ),
        "ThreadConverterError"
      );

      const message = yield* decodeUnknownMessageModel({
        ...productEntityFixtureInput("WorkspaceMessage", 20),
        content: { _tag: "document", children: [] },
        role: "user",
        threadId: 10,
        turnId: 30,
      });
      const messageInsert = yield* Effect.fromResult(Message.toMessageInsert(message));
      expectConverterFailure(
        yield* converterFailure(Message.toMessageInsert(withUnencodablePublicId(message))),
        "MessageConverterError"
      );
      expectConverterFailure(
        yield* converterFailure(
          Message.fromMessageRow({ ...messageInsert, id: 20, publicId: 42 } as unknown as Message.MessageRow)
        ),
        "MessageConverterError"
      );

      const turn = yield* decodeUnknownTurnModel({
        ...productEntityFixtureInput("WorkspaceTurn", 30),
        items: [{ itemType: "message", messageId: 20 }],
        parentTurnId: null,
        threadId: 10,
        turnIndex: 0,
      });
      const turnInsert = yield* Effect.fromResult(Turn.toTurnInsert(turn));
      expectConverterFailure(
        yield* converterFailure(Turn.toTurnInsert(withUnencodablePublicId(turn))),
        "TurnConverterError"
      );
      expectConverterFailure(
        yield* converterFailure(
          Turn.fromTurnRow({
            ...turnInsert,
            id: 30,
            parentTurnId: absentAsNull(turnInsert.parentTurnId),
            publicId: 42,
          } as unknown as Turn.TurnRow)
        ),
        "TurnConverterError"
      );

      const workspace = yield* decodeUnknownWorkspaceModel({
        ...productEntityFixtureInput("WorkspaceWorkspace", 40),
        fixtureKey: "workspace.default",
        name: "Default Workspace",
        organizationFixtureKey: "organization.default",
        ownerPrincipalFixtureKey: "principal.default",
        vaultRootPath: "/tmp/beep-workspace-vault",
      });
      const workspaceInsert = yield* Effect.fromResult(Workspace.toWorkspaceInsert(workspace));
      expectConverterFailure(
        yield* converterFailure(Workspace.toWorkspaceInsert(withUnencodablePublicId(workspace))),
        "WorkspaceConverterError"
      );
      expectConverterFailure(
        yield* converterFailure(
          Workspace.fromWorkspaceRow({
            ...workspaceInsert,
            id: 40,
            publicId: 42,
            vaultRootPath: absentAsNull(workspaceInsert.vaultRootPath),
          } as unknown as Workspace.WorkspaceRow)
        ),
        "WorkspaceConverterError"
      );
    })
  );
});
