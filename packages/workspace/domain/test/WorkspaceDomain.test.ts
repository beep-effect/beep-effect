import { Document, P, Text } from "@beep/md";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import {
  ApprovalDecision,
  ApprovalGate,
  CandidateDraft,
  CandidateLifecycle,
  CandidateProject,
  CandidateTask,
  ContextPacket,
  EmailArtifact,
  Message,
  MessageItem,
  MessageRole,
  Thread,
  Turn,
  TurnItem,
  TurnItems,
  Workspace as WorkspaceEntity,
} from "@beep/workspace-domain";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const systemPrincipal = { kind: "System", component: "Runtime" } as const;
const MessageRoleArbitrary = S.toArbitrary(MessageRole);
const schemaLawCases: ReadonlyArray<readonly [string, S.Codec<unknown>]> = [
  ["ApprovalDecision", ApprovalDecision],
  ["CandidateLifecycle", CandidateLifecycle],
  ["MessageRole", MessageRole],
  ["TurnItem", TurnItem],
  ["TurnItems", TurnItems],
  ["Workspace", WorkspaceEntity],
  ["Thread", Thread],
  ["Message", Message],
  ["Turn", Turn],
  ["EmailArtifact", EmailArtifact],
  ["ContextPacket", ContextPacket],
  ["ApprovalGate", ApprovalGate],
  ["CandidateDraft", CandidateDraft],
  ["CandidateProject", CandidateProject],
  ["CandidateTask", CandidateTask],
];

const baseEntityInput = (entityType: string, id: number) => ({
  createdAt: id,
  createdByPrincipal: systemPrincipal,
  entityType,
  id,
  orgId: 1,
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  updatedAt: id + 1,
  updatedByPrincipal: systemPrincipal,
});

const assertSchemaArbitraryRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equivalent(decode(encode(value)), value)).toBe(true);
    }),
    { numRuns: 10 }
  );
};

describe("@beep/workspace-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(ApprovalDecision.is.pending("pending")).toBe(true);
    expect(CandidateLifecycle.is.candidate("candidate")).toBe(true);
    expect(MessageRole.is.assistant("assistant")).toBe(true);
  });

  it("round-trips schema-derived message roles", () =>
    fc.assert(
      fc.property(MessageRoleArbitrary, (role) => {
        const decoded = S.decodeUnknownSync(MessageRole)(role);
        const encoded = S.encodeSync(MessageRole)(decoded);

        expect(encoded).toBe(role);
        expect(["system", "user", "assistant", "agent", "tool"].includes(decoded)).toBe(true);
      }),
      { numRuns: 25 }
    ));

  it("wires Workspace to the workspace BaseEntity identity", () => {
    expect(WorkspaceEntity.definition.entityId).toBe(WorkspaceIdentity.WorkspaceId);
    expect(WorkspaceEntity.definition.entityId.tableName).toBe("workspace_workspace");
    expect(WorkspaceEntity.definition.entityId.entityType).toBe("WorkspaceWorkspace");
    expect(WorkspaceEntity.definition.persisted.id.storageKind).toBe("entityId");
    expect(WorkspaceEntity.definition.persisted.ownerPrincipalFixtureKey.columnName).toBe(
      "owner_principal_fixture_key"
    );
  });

  it("decodes and constructs a Workspace row", () => {
    const decoded = S.decodeUnknownSync(WorkspaceEntity)({
      ...baseEntityInput("WorkspaceWorkspace", 2),
      fixtureKey: "workspace.acme",
      name: "Acme Workspace",
      organizationFixtureKey: "org.acme",
      ownerPrincipalFixtureKey: "principal.owner",
    });
    const constructed = WorkspaceEntity.make(decoded);

    expect(decoded).toBeInstanceOf(WorkspaceEntity);
    expect(constructed).toBeInstanceOf(WorkspaceEntity);
    expect(constructed.entityType).toBe("WorkspaceWorkspace");
    expect(constructed.organizationFixtureKey).toBe("org.acme");
    expect(constructed.ownerPrincipalFixtureKey).toBe("principal.owner");
  });

  it("preserves crispened workspace and email wire shapes", () => {
    const workspaceWire = {
      ...baseEntityInput("WorkspaceWorkspace", 20),
      fixtureKey: "workspace.acme",
      name: "Acme Workspace",
      organizationFixtureKey: "org.acme",
      ownerPrincipalFixtureKey: "principal.owner",
    };
    const emailWire = {
      ...baseEntityInput("WorkspaceEmailArtifact", 21),
      artifactFixtureKey: "artifact.email-intake",
      body: "We need help preparing a provisional patent application.",
      from: { address: "ada@example.com" },
      receivedAt: "2024-01-01T00:00:00Z",
      sourceSpans: ["law-email-001-s2"],
      subject: "Provisional patent help",
      threadFixtureKey: "thread.law-intake",
      to: [{ address: "agent@example.com" }],
    };

    expect(S.encodeSync(WorkspaceEntity)(S.decodeUnknownSync(WorkspaceEntity)(workspaceWire))).toStrictEqual(
      workspaceWire
    );
    expect(S.encodeSync(EmailArtifact)(S.decodeUnknownSync(EmailArtifact)(emailWire))).toStrictEqual(emailWire);
  });

  it("wires Thread, Turn, and Message to workspace identities", () => {
    expect(Thread.definition.entityId).toBe(WorkspaceIdentity.ThreadId);
    expect(Thread.definition.entityId.tableName).toBe("workspace_thread");
    expect(Turn.definition.entityId).toBe(WorkspaceIdentity.TurnId);
    expect(Turn.definition.entityId.tableName).toBe("workspace_turn");
    expect(Turn.definition.persisted.parentTurnId.columnName).toBe("parent_turn_id");
    expect(Message.definition.entityId).toBe(WorkspaceIdentity.MessageId);
    expect(Message.definition.entityId.tableName).toBe("workspace_message");
    expect(Message.definition.persisted.content.storageKind).toBe("jsonb");
  });

  it("decodes thread branching and md-aligned message content", () => {
    const messageContent = {
      _tag: "document",
      children: [{ _tag: "p", children: [{ _tag: "text", value: "Hello thread" }] }],
    };
    const thread = S.decodeUnknownSync(Thread)({
      ...baseEntityInput("WorkspaceThread", 10),
      title: "Matter intake",
      workspaceId: 2,
    });
    const message = S.decodeUnknownSync(Message)({
      ...baseEntityInput("WorkspaceMessage", 11),
      content: messageContent,
      role: "assistant",
      threadId: 10,
      turnId: 12,
    });
    const rootTurn = S.decodeUnknownSync(Turn)({
      ...baseEntityInput("WorkspaceTurn", 12),
      items: [{ itemType: "message", messageId: 11 }],
      parentTurnId: null,
      threadId: 10,
      turnIndex: 0,
    });
    const branchTurn = S.decodeUnknownSync(Turn)({
      ...baseEntityInput("WorkspaceTurn", 13),
      items: [{ itemType: "message", messageId: 11 }],
      parentTurnId: 12,
      threadId: 10,
      turnIndex: 1,
    });

    expect(thread).toBeInstanceOf(Thread);
    expect(message).toBeInstanceOf(Message);
    expect(message.content).toEqual(
      Document.make({ children: [P.make({ children: [Text.make({ value: "Hello thread" })] })] })
    );
    expect(rootTurn.parentTurnId).toEqual(O.none());
    expect(branchTurn.parentTurnId).toEqual(O.some(12));
    expect(rootTurn.items).toEqual([MessageItem.make({ messageId: WorkspaceIdentity.MessageId.make(11) })]);
  });

  it("keeps turn wire shape stable while defaulting root lineage at construction", () => {
    const turnWire = {
      ...baseEntityInput("WorkspaceTurn", 14),
      items: [{ itemType: "message", messageId: 11 }],
      parentTurnId: null,
      threadId: 10,
      turnIndex: 0,
    };
    const decoded = S.decodeUnknownSync(Turn)(turnWire);
    const { parentTurnId: _parentTurnId, ...turnInput } = decoded;
    const constructed = Turn.make(turnInput);

    expect(constructed.parentTurnId).toEqual(O.none());
    expect(S.encodeSync(Turn)(constructed)).toStrictEqual(turnWire);
    expect(() => S.decodeUnknownSync(TurnItems)([])).toThrow();
  });

  it("round-trips schema-derived exported workspace domain schemas", () => {
    for (const [, schema] of schemaLawCases) {
      assertSchemaArbitraryRoundTrips(schema);
    }
  });
});
