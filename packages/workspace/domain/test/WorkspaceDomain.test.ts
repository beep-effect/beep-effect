import { Document, P, Text } from "@beep/md";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns } from "@beep/test-utils";
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
  WorkspaceVaultRootPath,
} from "@beep/workspace-domain";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeMessageRoleSync = S.decodeSync(MessageRole);
const decodeUnknownEmailArtifactSync = S.decodeUnknownSync(EmailArtifact);
const decodeUnknownMessageSync = S.decodeUnknownSync(Message);
const decodeUnknownThreadSync = S.decodeUnknownSync(Thread);
const decodeUnknownTurnSync = S.decodeUnknownSync(Turn);
const decodeUnknownTurnItemsSync = S.decodeUnknownSync(TurnItems);
const decodeUnknownWorkspaceEntitySync = S.decodeUnknownSync(WorkspaceEntity);
const decodeUnknownWorkspaceVaultRootPathSync = S.decodeUnknownSync(WorkspaceVaultRootPath);
const encodeEmailArtifactSync = S.encodeSync(EmailArtifact);
const encodeMessageRoleSync = S.encodeSync(MessageRole);
const encodeTurnSync = S.encodeSync(Turn);
const encodeWorkspaceEntitySync = S.encodeSync(WorkspaceEntity);

const systemPrincipal = { kind: "System", component: "Runtime" } as const;
const MessageRoleArbitrary = S.toArbitrary(MessageRole)(fc);
const publicIdFor = (entityType: string, id: number) =>
  `${entityType.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase()}_a${id}`;
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
  publicId: publicIdFor(entityType, id),
  rowVersion: 1,
  schemaVersion: "0.0.0",
  source: "System",
  updatedAt: id + 1,
  updatedByPrincipal: systemPrincipal,
});

const assertSchemaArbitraryRoundTrips = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  const arbitrary = S.toArbitrary(schema)(fc);
  const decode = S.decodeUnknownSync(schema);
  const encode = S.encodeSync(schema);
  const equivalent = S.toEquivalence(schema);

  fc.assert(
    fc.property(arbitrary, (value) => {
      expect(equivalent(decode(encode(value)), value)).toBe(true);
    }),
    fcRuns(10)
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
        const decoded = decodeMessageRoleSync(role);
        const encoded = encodeMessageRoleSync(decoded);

        expect(encoded).toBe(role);
        expect(["system", "user", "assistant", "agent", "tool"].includes(decoded)).toBe(true);
      }),
      fcRuns(25)
    ));

  it("wires Workspace to the workspace ProductEntity identity", () => {
    expect(WorkspaceEntity.sql.tableName).toBe(WorkspaceIdentity.WorkspaceId.tableName);
    expect(WorkspaceIdentity.WorkspaceId.entityType).toBe("WorkspaceWorkspace");
    expect(Object.keys(WorkspaceEntity.insert.fields)).not.toContain("id");
    expect(Object.keys(WorkspaceEntity.update.fields)).toContain("id");
    expect(Object.keys(WorkspaceEntity.jsonCreate.fields)).toEqual([
      "fixtureKey",
      "name",
      "organizationFixtureKey",
      "ownerPrincipalFixtureKey",
      "vaultRootPath",
    ]);
  });

  it("decodes and constructs a Workspace row", () => {
    const decoded = decodeUnknownWorkspaceEntitySync({
      ...baseEntityInput("WorkspaceWorkspace", 2),
      fixtureKey: "workspace.acme",
      name: "Acme Workspace",
      organizationFixtureKey: "org.acme",
      ownerPrincipalFixtureKey: "principal.owner",
      vaultRootPath: null,
    });
    const constructed = WorkspaceEntity.make(decoded);

    expect(decoded).toBeInstanceOf(WorkspaceEntity);
    expect(constructed).toBeInstanceOf(WorkspaceEntity);
    expect(constructed.entityType).toBe("WorkspaceWorkspace");
    expect(constructed.organizationFixtureKey).toBe("org.acme");
    expect(constructed.ownerPrincipalFixtureKey).toBe("principal.owner");
  });

  it("rejects relative, tilde, and blank workspace vault roots", () => {
    expect(() => decodeUnknownWorkspaceVaultRootPathSync("vault")).toThrow();
    expect(() => decodeUnknownWorkspaceVaultRootPathSync("C:relative-vault")).toThrow();
    expect(() => decodeUnknownWorkspaceVaultRootPathSync("~/Vault")).toThrow();
    expect(() => decodeUnknownWorkspaceVaultRootPathSync(" ")).toThrow();
    expect(decodeUnknownWorkspaceVaultRootPathSync("C:\\Vault")).toBe("C:\\Vault");
  });

  it("normalizes trailing separators on workspace vault roots but still rejects bare roots", () => {
    expect(decodeUnknownWorkspaceVaultRootPathSync("/home/user/vault1/")).toBe("/home/user/vault1");
    expect(decodeUnknownWorkspaceVaultRootPathSync("/home/user/vault1///")).toBe("/home/user/vault1");
    expect(decodeUnknownWorkspaceVaultRootPathSync("C:\\Vault\\")).toBe("C:\\Vault");
    expect(decodeUnknownWorkspaceVaultRootPathSync("\\\\server\\share\\vault\\")).toBe("\\\\server\\share\\vault");
    expect(() => decodeUnknownWorkspaceVaultRootPathSync("/")).toThrow();
    expect(() => decodeUnknownWorkspaceVaultRootPathSync("C:\\")).toThrow();
  });

  it("preserves crispened workspace and email wire shapes", () => {
    const workspaceWire = {
      ...baseEntityInput("WorkspaceWorkspace", 20),
      fixtureKey: "workspace.acme",
      name: "Acme Workspace",
      organizationFixtureKey: "org.acme",
      ownerPrincipalFixtureKey: "principal.owner",
      vaultRootPath: null,
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

    expect(encodeWorkspaceEntitySync(decodeUnknownWorkspaceEntitySync(workspaceWire))).toStrictEqual(workspaceWire);
    expect(encodeEmailArtifactSync(decodeUnknownEmailArtifactSync(emailWire))).toStrictEqual(emailWire);
  });

  it("wires Thread, Turn, and Message to workspace identities", () => {
    expect(Thread.sql.tableName).toBe(WorkspaceIdentity.ThreadId.tableName);
    expect(Turn.sql.tableName).toBe(WorkspaceIdentity.TurnId.tableName);
    expect(Message.sql.tableName).toBe(WorkspaceIdentity.MessageId.tableName);
    expect(Object.keys(Thread.jsonCreate.fields)).toEqual(["title", "workspaceId"]);
    expect(Object.keys(Turn.jsonCreate.fields)).toEqual(["items", "parentTurnId", "threadId", "turnIndex"]);
    expect(Object.keys(Message.jsonCreate.fields)).toEqual(["content", "role", "threadId", "turnId"]);
  });

  it("decodes thread branching and md-aligned message content", () => {
    const messageContent = {
      _tag: "document",
      children: [{ _tag: "p", children: [{ _tag: "text", value: "Hello thread" }] }],
    };
    const thread = decodeUnknownThreadSync({
      ...baseEntityInput("WorkspaceThread", 10),
      title: "Matter intake",
      workspaceId: 2,
    });
    const message = decodeUnknownMessageSync({
      ...baseEntityInput("WorkspaceMessage", 11),
      content: messageContent,
      role: "assistant",
      threadId: 10,
      turnId: 12,
    });
    const rootTurn = decodeUnknownTurnSync({
      ...baseEntityInput("WorkspaceTurn", 12),
      items: [{ itemType: "message", messageId: 11 }],
      parentTurnId: null,
      threadId: 10,
      turnIndex: 0,
    });
    const branchTurn = decodeUnknownTurnSync({
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
    const decoded = decodeUnknownTurnSync(turnWire);
    const { parentTurnId: _parentTurnId, ...turnInput } = decoded;
    const constructed = Turn.make(turnInput);

    expect(constructed.parentTurnId).toEqual(O.none());
    expect(encodeTurnSync(constructed)).toStrictEqual(turnWire);
    expect(() => decodeUnknownTurnItemsSync([])).toThrow();
  });

  it("round-trips schema-derived exported workspace domain schemas", () => {
    for (const [, schema] of schemaLawCases) {
      assertSchemaArbitraryRoundTrips(schema);
    }
  });
});
