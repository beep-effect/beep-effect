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
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const systemPrincipal = { kind: "System", component: "Runtime" } as const;

const decodeMessageRole = S.decodeEffect(MessageRole);
const encodeMessageRole = S.encodeEffect(MessageRole);
const decodeUnknownWorkspaceEntity = S.decodeUnknownEffect(WorkspaceEntity);
const encodeWorkspaceEntity = S.encodeEffect(WorkspaceEntity);
const decodeWorkspaceVaultRootPath = S.decodeEffect(WorkspaceVaultRootPath);
const decodeUnknownEmailArtifact = S.decodeUnknownEffect(EmailArtifact);
const encodeEmailArtifact = S.encodeEffect(EmailArtifact);
const decodeUnknownThread = S.decodeUnknownEffect(Thread);
const decodeUnknownMessage = S.decodeUnknownEffect(Message);
const decodeUnknownTurn = S.decodeUnknownEffect(Turn);
const encodeTurn = S.encodeEffect(Turn);
const decodeUnknownTurnItems = S.decodeUnknownEffect(TurnItems);

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

const assertSchemaArbitraryRoundTrips = Effect.fn("WorkspaceDomainTest.assertSchemaArbitraryRoundTrips")(function* <
  Schema extends S.Codec<unknown>,
>(schema: Schema) {
  const equivalent = S.toEquivalence(schema);
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.schema(schema),
    (value) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
        return equivalent(decoded, value);
      }),
    fcRuns(10)
  );
  expect(result._tag).toBe("Passed");
});

describe("@beep/workspace-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(ApprovalDecision.is.pending("pending")).toBe(true);
    expect(CandidateLifecycle.is.candidate("candidate")).toBe(true);
    expect(MessageRole.is.assistant("assistant")).toBe(true);
  });

  it.effect.prop(
    "round-trips schema-derived message roles",
    [MessageRole],
    ([role]) =>
      Effect.gen(function* () {
        const decoded = yield* decodeMessageRole(role);
        const encoded = yield* encodeMessageRole(decoded);

        expect(encoded).toBe(role);
        expect(["system", "user", "assistant", "agent", "tool"].includes(decoded)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

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

  it.effect("decodes and constructs a Workspace row", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeUnknownWorkspaceEntity({
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
    })
  );

  it.effect("rejects relative, tilde, and blank workspace vault roots", () =>
    Effect.gen(function* () {
      const vaultExit = yield* Effect.exit(decodeWorkspaceVaultRootPath("vault"));
      const relativeExit = yield* Effect.exit(decodeWorkspaceVaultRootPath("C:relative-vault"));
      const tildeExit = yield* Effect.exit(decodeWorkspaceVaultRootPath("~/Vault"));
      const blankExit = yield* Effect.exit(decodeWorkspaceVaultRootPath(" "));
      expect(Exit.isFailure(vaultExit)).toBe(true);
      expect(Exit.isFailure(relativeExit)).toBe(true);
      expect(Exit.isFailure(tildeExit)).toBe(true);
      expect(Exit.isFailure(blankExit)).toBe(true);
      expect(yield* decodeWorkspaceVaultRootPath("C:\\Vault")).toBe("C:\\Vault");
    })
  );

  it.effect("normalizes trailing separators on workspace vault roots but still rejects bare roots", () =>
    Effect.gen(function* () {
      expect(yield* decodeWorkspaceVaultRootPath("/home/user/vault1/")).toBe("/home/user/vault1");
      expect(yield* decodeWorkspaceVaultRootPath("/home/user/vault1///")).toBe("/home/user/vault1");
      expect(yield* decodeWorkspaceVaultRootPath("C:\\Vault\\")).toBe("C:\\Vault");
      expect(yield* decodeWorkspaceVaultRootPath("\\\\server\\share\\vault\\")).toBe("\\\\server\\share\\vault");
      const rootExit = yield* Effect.exit(decodeWorkspaceVaultRootPath("/"));
      const driveExit = yield* Effect.exit(decodeWorkspaceVaultRootPath("C:\\"));
      expect(Exit.isFailure(rootExit)).toBe(true);
      expect(Exit.isFailure(driveExit)).toBe(true);
    })
  );

  it.effect("preserves crispened workspace and email wire shapes", () =>
    Effect.gen(function* () {
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

      const encodedWorkspace = yield* encodeWorkspaceEntity(yield* decodeUnknownWorkspaceEntity(workspaceWire));
      const encodedEmail = yield* encodeEmailArtifact(yield* decodeUnknownEmailArtifact(emailWire));
      expect(encodedWorkspace).toStrictEqual(workspaceWire);
      expect(encodedEmail).toStrictEqual(emailWire);
    })
  );

  it("wires Thread, Turn, and Message to workspace identities", () => {
    expect(Thread.sql.tableName).toBe(WorkspaceIdentity.ThreadId.tableName);
    expect(Turn.sql.tableName).toBe(WorkspaceIdentity.TurnId.tableName);
    expect(Message.sql.tableName).toBe(WorkspaceIdentity.MessageId.tableName);
    expect(Object.keys(Thread.jsonCreate.fields)).toEqual(["title", "workspaceId"]);
    expect(Object.keys(Turn.jsonCreate.fields)).toEqual(["items", "parentTurnId", "threadId", "turnIndex"]);
    expect(Object.keys(Message.jsonCreate.fields)).toEqual(["content", "role", "threadId", "turnId"]);
  });

  it.effect("decodes thread branching and md-aligned message content", () =>
    Effect.gen(function* () {
      const messageContent = {
        _tag: "document",
        children: [{ _tag: "p", children: [{ _tag: "text", value: "Hello thread" }] }],
      };
      const thread = yield* decodeUnknownThread({
        ...baseEntityInput("WorkspaceThread", 10),
        title: "Matter intake",
        workspaceId: 2,
      });
      const message = yield* decodeUnknownMessage({
        ...baseEntityInput("WorkspaceMessage", 11),
        content: messageContent,
        role: "assistant",
        threadId: 10,
        turnId: 12,
      });
      const rootTurn = yield* decodeUnknownTurn({
        ...baseEntityInput("WorkspaceTurn", 12),
        items: [{ itemType: "message", messageId: 11 }],
        parentTurnId: null,
        threadId: 10,
        turnIndex: 0,
      });
      const branchTurn = yield* decodeUnknownTurn({
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
    })
  );

  it.effect("keeps turn wire shape stable while defaulting root lineage at construction", () =>
    Effect.gen(function* () {
      const turnWire = {
        ...baseEntityInput("WorkspaceTurn", 14),
        items: [{ itemType: "message", messageId: 11 }],
        parentTurnId: null,
        threadId: 10,
        turnIndex: 0,
      };
      const decoded = yield* decodeUnknownTurn(turnWire);
      const { parentTurnId: _parentTurnId, ...turnInput } = decoded;
      const constructed = Turn.make(turnInput);

      expect(constructed.parentTurnId).toEqual(O.none());
      expect(yield* encodeTurn(constructed)).toStrictEqual(turnWire);
      const emptyItemsExit = yield* Effect.exit(decodeUnknownTurnItems([]));
      expect(Exit.isFailure(emptyItemsExit)).toBe(true);
    })
  );

  it.effect("round-trips schema-derived exported workspace domain schemas", () =>
    Effect.gen(function* () {
      for (const [, schema] of schemaLawCases) {
        yield* assertSchemaArbitraryRoundTrips(schema);
      }
    })
  );
});
