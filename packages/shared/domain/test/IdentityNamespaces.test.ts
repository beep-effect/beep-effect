import { $SharedDomainId, make } from "@beep/identity";
import * as Identity from "@beep/shared-domain/identity";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { cast } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { hasFunctionStatic, invokeStatic } from "./StaticProbes.ts";
import type * as EntityId from "@beep/shared-domain/entity/EntityId";

type IdentitySpec = {
  readonly brand: string;
  readonly description: string;
  readonly entityType: string;
  readonly label: string;
  readonly name: string;
  readonly resource: string;
  readonly schema: EntityId.Any;
  readonly slice: string;
  readonly tableName: string;
};

const specs = [
  {
    brand: "AgentsAgentId",
    description: "Identifier for an agents slice agent entity.",
    entityType: "AgentsAgent",
    label: "Agents.AgentId",
    name: "agent",
    resource: "agents.agent",
    schema: Identity.Agents.AgentId,
    slice: "agents",
    tableName: "agents_agent",
  },
  {
    brand: "AgentsSkillId",
    description: "Identifier for an agents slice skill entity.",
    entityType: "AgentsSkill",
    label: "Agents.SkillId",
    name: "skill",
    resource: "agents.skill",
    schema: Identity.Agents.SkillId,
    slice: "agents",
    tableName: "agents_skill",
  },
  {
    brand: "ArchitectureLabWorkerId",
    description: "Identifier for an architecture lab Worker entity.",
    entityType: "ArchitectureLabWorker",
    label: "ArchitectureLab.WorkerId",
    name: "worker",
    resource: "architecture_lab.worker",
    schema: Identity.ArchitectureLab.WorkerId,
    slice: "architecture_lab",
    tableName: "architecture_lab_worker",
  },
  {
    brand: "DocumentsSyncItemId",
    description: "Identifier for a documents SyncItem sync-tracking row.",
    entityType: "DocumentsSyncItem",
    label: "Documents.SyncItemId",
    name: "sync_item",
    resource: "documents.sync_item",
    schema: Identity.Documents.SyncItemId,
    slice: "documents",
    tableName: "documents_sync_item",
  },
  {
    brand: "DocumentsSyncOperationId",
    description: "Identifier for a documents SyncOperation outbox row.",
    entityType: "DocumentsSyncOperation",
    label: "Documents.SyncOperationId",
    name: "sync_operation",
    resource: "documents.sync_operation",
    schema: Identity.Documents.SyncOperationId,
    slice: "documents",
    tableName: "documents_sync_operation",
  },
  {
    brand: "DocumentsSyncCursorId",
    description: "Identifier for a documents SyncCursor remote-stream cursor row.",
    entityType: "DocumentsSyncCursor",
    label: "Documents.SyncCursorId",
    name: "sync_cursor",
    resource: "documents.sync_cursor",
    schema: Identity.Documents.SyncCursorId,
    slice: "documents",
    tableName: "documents_sync_cursor",
  },
  {
    brand: "DocumentsSyncConflictId",
    description: "Identifier for a documents SyncConflict remote-drift row.",
    entityType: "DocumentsSyncConflict",
    label: "Documents.SyncConflictId",
    name: "sync_conflict",
    resource: "documents.sync_conflict",
    schema: Identity.Documents.SyncConflictId,
    slice: "documents",
    tableName: "documents_sync_conflict",
  },
  {
    brand: "EpistemicCandidateClaimId",
    description: "Identifier for a candidate claim entity.",
    entityType: "EpistemicCandidateClaim",
    label: "Epistemic.CandidateClaimId",
    name: "candidate_claim",
    resource: "epistemic.candidate_claim",
    schema: Identity.Epistemic.CandidateClaimId,
    slice: "epistemic",
    tableName: "epistemic_candidate_claim",
  },
  {
    brand: "EpistemicEvidenceId",
    description: "Identifier for an evidence entity.",
    entityType: "EpistemicEvidence",
    label: "Epistemic.EvidenceId",
    name: "evidence",
    resource: "epistemic.evidence",
    schema: Identity.Epistemic.EvidenceId,
    slice: "epistemic",
    tableName: "epistemic_evidence",
  },
  {
    brand: "EpistemicActivityId",
    description: "Identifier for a provenance activity entity.",
    entityType: "EpistemicActivity",
    label: "Epistemic.ActivityId",
    name: "activity",
    resource: "epistemic.activity",
    schema: Identity.Epistemic.ActivityId,
    slice: "epistemic",
    tableName: "epistemic_activity",
  },
  {
    brand: "EpistemicUsageRecordId",
    description: "Identifier for a usage attribution record entity.",
    entityType: "EpistemicUsageRecord",
    label: "Epistemic.UsageRecordId",
    name: "usage_record",
    resource: "epistemic.usage_record",
    schema: Identity.Epistemic.UsageRecordId,
    slice: "epistemic",
    tableName: "epistemic_usage_record",
  },
  {
    brand: "EpistemicContradictionCandidateId",
    description: "Identifier for an immutable epistemic contradiction candidate.",
    entityType: "EpistemicContradictionCandidate",
    label: "Epistemic.ContradictionCandidateId",
    name: "contradiction_candidate",
    resource: "epistemic.contradiction_candidate",
    schema: Identity.Epistemic.ContradictionCandidateId,
    slice: "epistemic",
    tableName: "epistemic_contradiction_candidate",
  },
  {
    brand: "EpistemicContradictionReceiptId",
    description: "Identifier for a durable contradiction-submission receipt.",
    entityType: "EpistemicContradictionReceipt",
    label: "Epistemic.ContradictionReceiptId",
    name: "contradiction_receipt",
    resource: "epistemic.contradiction_receipt",
    schema: Identity.Epistemic.ContradictionReceiptId,
    slice: "epistemic",
    tableName: "epistemic_contradiction_receipt",
  },
  {
    brand: "EpistemicContradictionDispositionId",
    description: "Identifier for a durable human contradiction disposition.",
    entityType: "EpistemicContradictionDisposition",
    label: "Epistemic.ContradictionDispositionId",
    name: "contradiction_disposition",
    resource: "epistemic.contradiction_disposition",
    schema: Identity.Epistemic.ContradictionDispositionId,
    slice: "epistemic",
    tableName: "epistemic_contradiction_disposition",
  },
  {
    brand: "EpistemicEvidenceVerificationId",
    description: "Identifier for an immutable evidence-to-source verification manifestation.",
    entityType: "EpistemicEvidenceVerification",
    label: "Epistemic.EvidenceVerificationId",
    name: "evidence_verification",
    resource: "epistemic.evidence_verification",
    schema: Identity.Epistemic.EvidenceVerificationId,
    slice: "epistemic",
    tableName: "epistemic_evidence_verification",
  },
  {
    brand: "LawPracticeLegalClientId",
    description: "Identifier for a law-practice legal client entity.",
    entityType: "LawPracticeLegalClient",
    label: "LawPractice.LegalClientId",
    name: "legal_client",
    resource: "law_practice.legal_client",
    schema: Identity.LawPractice.LegalClientId,
    slice: "law_practice",
    tableName: "law_practice_legal_client",
  },
  {
    brand: "LawPracticeLegalContactId",
    description: "Identifier for a law-practice legal contact entity.",
    entityType: "LawPracticeLegalContact",
    label: "LawPractice.LegalContactId",
    name: "legal_contact",
    resource: "law_practice.legal_contact",
    schema: Identity.LawPractice.LegalContactId,
    slice: "law_practice",
    tableName: "law_practice_legal_contact",
  },
  {
    brand: "LawPracticeMatterId",
    description: "Identifier for a law-practice matter entity.",
    entityType: "LawPracticeMatter",
    label: "LawPractice.MatterId",
    name: "matter",
    resource: "law_practice.matter",
    schema: Identity.LawPractice.MatterId,
    slice: "law_practice",
    tableName: "law_practice_matter",
  },
  {
    brand: "LawPracticePatentAssetId",
    description: "Identifier for a law-practice patent asset entity.",
    entityType: "LawPracticePatentAsset",
    label: "LawPractice.PatentAssetId",
    name: "patent_asset",
    resource: "law_practice.patent_asset",
    schema: Identity.LawPractice.PatentAssetId,
    slice: "law_practice",
    tableName: "law_practice_patent_asset",
  },
  {
    brand: "SharedOrganizationId",
    description: "Identifier for a shared-kernel organization entity.",
    entityType: "SharedOrganization",
    label: "Shared.OrganizationId",
    name: "organization",
    resource: "shared.organization",
    schema: Identity.Shared.OrganizationId,
    slice: "shared",
    tableName: "shared_organization",
  },
  {
    brand: "SharedUserId",
    description: "Identifier for a shared-kernel user entity.",
    entityType: "SharedUser",
    label: "Shared.UserId",
    name: "user",
    resource: "shared.user",
    schema: Identity.Shared.UserId,
    slice: "shared",
    tableName: "shared_user",
  },
  {
    brand: "SharedMembershipId",
    description: "Identifier for a shared-kernel membership entity.",
    entityType: "SharedMembership",
    label: "Shared.MembershipId",
    name: "membership",
    resource: "shared.membership",
    schema: Identity.Shared.MembershipId,
    slice: "shared",
    tableName: "shared_membership",
  },
  {
    brand: "WorkspaceWorkspaceId",
    description: "Identifier for a workspace entity.",
    entityType: "WorkspaceWorkspace",
    label: "Workspace.WorkspaceId",
    name: "workspace",
    resource: "workspace.workspace",
    schema: Identity.Workspace.WorkspaceId,
    slice: "workspace",
    tableName: "workspace_workspace",
  },
  {
    brand: "WorkspaceEmailArtifactId",
    description: "Identifier for a normalized email artifact entity.",
    entityType: "WorkspaceEmailArtifact",
    label: "Workspace.EmailArtifactId",
    name: "email_artifact",
    resource: "workspace.email_artifact",
    schema: Identity.Workspace.EmailArtifactId,
    slice: "workspace",
    tableName: "workspace_email_artifact",
  },
  {
    brand: "WorkspaceCandidateProjectId",
    description: "Identifier for a candidate project entity.",
    entityType: "WorkspaceCandidateProject",
    label: "Workspace.CandidateProjectId",
    name: "candidate_project",
    resource: "workspace.candidate_project",
    schema: Identity.Workspace.CandidateProjectId,
    slice: "workspace",
    tableName: "workspace_candidate_project",
  },
  {
    brand: "WorkspaceCandidateTaskId",
    description: "Identifier for a candidate task entity.",
    entityType: "WorkspaceCandidateTask",
    label: "Workspace.CandidateTaskId",
    name: "candidate_task",
    resource: "workspace.candidate_task",
    schema: Identity.Workspace.CandidateTaskId,
    slice: "workspace",
    tableName: "workspace_candidate_task",
  },
  {
    brand: "WorkspaceCandidateDraftId",
    description: "Identifier for a candidate draft entity.",
    entityType: "WorkspaceCandidateDraft",
    label: "Workspace.CandidateDraftId",
    name: "candidate_draft",
    resource: "workspace.candidate_draft",
    schema: Identity.Workspace.CandidateDraftId,
    slice: "workspace",
    tableName: "workspace_candidate_draft",
  },
  {
    brand: "WorkspaceApprovalGateId",
    description: "Identifier for an approval gate entity.",
    entityType: "WorkspaceApprovalGate",
    label: "Workspace.ApprovalGateId",
    name: "approval_gate",
    resource: "workspace.approval_gate",
    schema: Identity.Workspace.ApprovalGateId,
    slice: "workspace",
    tableName: "workspace_approval_gate",
  },
  {
    brand: "WorkspaceContextPacketId",
    description: "Identifier for a bounded context packet entity.",
    entityType: "WorkspaceContextPacket",
    label: "Workspace.ContextPacketId",
    name: "context_packet",
    resource: "workspace.context_packet",
    schema: Identity.Workspace.ContextPacketId,
    slice: "workspace",
    tableName: "workspace_context_packet",
  },
  {
    brand: "WorkspaceThreadId",
    description: "Identifier for a durable workspace conversation thread.",
    entityType: "WorkspaceThread",
    label: "Workspace.ThreadId",
    name: "thread",
    resource: "workspace.thread",
    schema: Identity.Workspace.ThreadId,
    slice: "workspace",
    tableName: "workspace_thread",
  },
  {
    brand: "WorkspaceTurnId",
    description: "Identifier for a workspace conversation turn aggregate.",
    entityType: "WorkspaceTurn",
    label: "Workspace.TurnId",
    name: "turn",
    resource: "workspace.turn",
    schema: Identity.Workspace.TurnId,
    slice: "workspace",
    tableName: "workspace_turn",
  },
  {
    brand: "WorkspaceMessageId",
    description: "Identifier for md-aligned workspace message content.",
    entityType: "WorkspaceMessage",
    label: "Workspace.MessageId",
    name: "message",
    resource: "workspace.message",
    schema: Identity.Workspace.MessageId,
    slice: "workspace",
    tableName: "workspace_message",
  },
] satisfies ReadonlyArray<IdentitySpec>;

const expectFailure = Effect.fn("expectFailure")(function* <A, E>(effect: Effect.Effect<A, E, never>) {
  const exit = yield* Effect.exit(effect);
  expect(Exit.isFailure(exit)).toBe(true);
});
const codecStaticKeys = [
  "decodeEffect",
  "decodeSync",
  "decodeUnknownEffect",
  "decodeUnknownOption",
  "decodeUnknownSync",
  "encodeEffect",
  "encodeUnknownEffect",
  "equivalence",
  "is",
];

describe("P3 identity namespaces", () => {
  it("expose deterministic entity-id metadata", () => {
    for (const spec of specs) {
      expect(spec.schema.brand, spec.label).toBe(spec.brand);
      expect(spec.schema.entityType, spec.label).toBe(spec.entityType);
      expect(spec.schema.resource, spec.label).toBe(spec.resource);
      expect(spec.schema.slice, spec.label).toBe(spec.slice);
      expect(spec.schema.tableName, spec.label).toBe(spec.tableName);
      expect(spec.schema.definition.description, spec.label).toBe(spec.description);
      expect(spec.schema.definition.name, spec.label).toBe(spec.name);
    }
  });

  it("carry the factory-attached codec statics at runtime", () => {
    for (const spec of specs) {
      for (const key of codecStaticKeys) {
        expect(hasFunctionStatic(spec.schema, key), `${spec.label}.${key}`).toBe(true);
      }
      expect(hasFunctionStatic(spec.schema, "fromUnknown"), `${spec.label}.fromUnknown`).toBe(false);
      expect(hasFunctionStatic(spec.schema, "decodeOption"), `${spec.label}.decodeOption`).toBe(false);
      expect(O.getOrThrow(invokeStatic(spec.schema, "decodeSync", 1)), spec.label).toBe(1);
      expect(O.getOrThrow(invokeStatic(spec.schema, "decodeUnknownSync", 1)), spec.label).toBe(1);
    }
  });

  it.effect(
    "decode positive integer ids and reject invalid ids",
    Effect.fnUntraced(function* () {
      for (const spec of specs) {
        const decode = S.decodeUnknownEffect(spec.schema);

        expect(yield* decode(1), spec.label).toBe(1);
        expect(spec.schema.equivalence(cast(1), cast(1)), spec.label).toBe(true);
        expect(spec.schema.equivalence(cast(1), cast(2)), spec.label).toBe(false);
        yield* expectFailure(decode(0));
      }
    })
  );

  it("round-trips schema-derived ids for every identity namespace", () => {
    for (const spec of specs) {
      fc.assert(
        fc.property(S.toArbitrary(spec.schema)(fc), (id) => {
          const decoded = S.decodeSync(spec.schema)(id);
          const encoded = S.encodeSync(spec.schema)(decoded);

          expect(encoded, spec.label).toBe(id);
          expect(spec.schema.equivalence(cast(decoded), cast(id)), spec.label).toBe(true);
        }),
        fcRuns(10)
      );
    }
  });

  it.effect(
    "validates runtime identity composers",
    Effect.fnUntraced(function* () {
      const { $IdentityComposerExampleId } = make("identity-composer-example");
      const decode = S.decodeUnknownEffect(Identity.AnyIdentityComposer);

      const rootComposer = yield* decode($SharedDomainId);
      const nestedComposer = yield* decode($SharedDomainId.create("identity"));
      const customComposer = yield* decode($IdentityComposerExampleId);

      expect(rootComposer.make("Probe")).toBe("@beep/shared-domain/Probe");
      expect(nestedComposer.string()).toBe("@beep/shared-domain/identity");
      expect(customComposer.identifier).toBe("@beep/identity-composer-example");
    })
  );

  it.effect(
    "rejects invalid identity composer lookalikes",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(Identity.AnyIdentityComposer);
      const wrongProbeResult = Object.assign(() => "@beep/fake/IdentityComposerProbe", {
        identifier: "@beep/fake",
        value: "@beep/fake",
        annote: () => ({}),
        annoteHttp: () => (self: unknown) => self,
        annoteKey: () => (self: unknown) => self,
        annoteSchema: () => (self: unknown) => self,
        compose: () => ({}),
        create: () => wrongProbeResult,
        make: () => "@beep/fake/WrongProbe",
        string: () => "@beep/fake",
        symbol: () => Symbol.for("@beep/fake"),
      });

      yield* expectFailure(decode({ identifier: "@beep/fake" }));
      yield* expectFailure(decode(() => "@beep/fake/IdentityComposerProbe"));
      yield* expectFailure(decode(wrongProbeResult));
    })
  );
});
