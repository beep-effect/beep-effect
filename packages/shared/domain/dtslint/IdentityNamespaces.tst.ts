import { describe, expect, it } from "tstyche";
import type * as CoreIdentity from "@beep/identity";
import type * as EntityId from "@beep/shared-domain/entity/EntityId";
import type * as Identity from "@beep/shared-domain/identity";

describe("P3 identity namespace types", () => {
  it("exports the runtime AnyIdentityComposer schema type", () => {
    expect<Identity.AnyIdentityComposer>().type.toBe<CoreIdentity.IdentityComposer<string>>();
  });

  it("preserves AgentCapability companion aliases and literals", () => {
    expect<Identity.AgentCapability.AgentId>().type.toBe<EntityId.EntityIdValueFor<"AgentCapabilityAgentId">>();
    expect<Identity.AgentCapability.SkillId>().type.toBe<EntityId.EntityIdValueFor<"AgentCapabilitySkillId">>();
    expect<typeof Identity.AgentCapability.AgentId.tableName>().type.toBe<"agent_capability_agent">();
    expect<typeof Identity.AgentCapability.SkillId.tableName>().type.toBe<"agent_capability_skill">();
  });

  it("preserves Epistemic companion aliases and literals", () => {
    expect<Identity.Epistemic.CandidateClaimId>().type.toBe<EntityId.EntityIdValueFor<"EpistemicCandidateClaimId">>();
    expect<Identity.Epistemic.EvidenceId>().type.toBe<EntityId.EntityIdValueFor<"EpistemicEvidenceId">>();
    expect<Identity.Epistemic.ActivityId>().type.toBe<EntityId.EntityIdValueFor<"EpistemicActivityId">>();
    expect<Identity.Epistemic.UsageRecordId>().type.toBe<EntityId.EntityIdValueFor<"EpistemicUsageRecordId">>();
    expect<typeof Identity.Epistemic.CandidateClaimId.tableName>().type.toBe<"epistemic_candidate_claim">();
    expect<typeof Identity.Epistemic.EvidenceId.tableName>().type.toBe<"epistemic_evidence">();
    expect<typeof Identity.Epistemic.ActivityId.tableName>().type.toBe<"epistemic_activity">();
    expect<typeof Identity.Epistemic.UsageRecordId.tableName>().type.toBe<"epistemic_usage_record">();
  });

  it("preserves LawPractice companion aliases and literals", () => {
    expect<Identity.LawPractice.LegalClientId>().type.toBe<EntityId.EntityIdValueFor<"LawPracticeLegalClientId">>();
    expect<Identity.LawPractice.LegalContactId>().type.toBe<EntityId.EntityIdValueFor<"LawPracticeLegalContactId">>();
    expect<Identity.LawPractice.MatterId>().type.toBe<EntityId.EntityIdValueFor<"LawPracticeMatterId">>();
    expect<Identity.LawPractice.PatentAssetId>().type.toBe<EntityId.EntityIdValueFor<"LawPracticePatentAssetId">>();
    expect<typeof Identity.LawPractice.LegalClientId.tableName>().type.toBe<"law_practice_legal_client">();
    expect<typeof Identity.LawPractice.LegalContactId.tableName>().type.toBe<"law_practice_legal_contact">();
    expect<typeof Identity.LawPractice.MatterId.tableName>().type.toBe<"law_practice_matter">();
    expect<typeof Identity.LawPractice.PatentAssetId.tableName>().type.toBe<"law_practice_patent_asset">();
  });

  it("preserves Shared companion aliases and literals", () => {
    expect<Identity.Shared.OrganizationId>().type.toBe<EntityId.EntityIdValueFor<"SharedOrganizationId">>();
    expect<Identity.Shared.UserId>().type.toBe<EntityId.EntityIdValueFor<"SharedUserId">>();
    expect<Identity.Shared.MembershipId>().type.toBe<EntityId.EntityIdValueFor<"SharedMembershipId">>();
    expect<typeof Identity.Shared.OrganizationId.tableName>().type.toBe<"shared_organization">();
    expect<typeof Identity.Shared.UserId.tableName>().type.toBe<"shared_user">();
    expect<typeof Identity.Shared.MembershipId.tableName>().type.toBe<"shared_membership">();
  });

  it("preserves WealthManagement companion aliases and literals", () => {
    expect<Identity.WealthManagement.HouseholdId>().type.toBe<
      EntityId.EntityIdValueFor<"WealthManagementHouseholdId">
    >();
    expect<Identity.WealthManagement.WealthClientId>().type.toBe<
      EntityId.EntityIdValueFor<"WealthManagementWealthClientId">
    >();
    expect<Identity.WealthManagement.PartyId>().type.toBe<EntityId.EntityIdValueFor<"WealthManagementPartyId">>();
    expect<Identity.WealthManagement.AccountId>().type.toBe<EntityId.EntityIdValueFor<"WealthManagementAccountId">>();
    expect<typeof Identity.WealthManagement.HouseholdId.tableName>().type.toBe<"wealth_management_household">();
    expect<typeof Identity.WealthManagement.WealthClientId.tableName>().type.toBe<"wealth_management_wealth_client">();
    expect<typeof Identity.WealthManagement.PartyId.tableName>().type.toBe<"wealth_management_party">();
    expect<typeof Identity.WealthManagement.AccountId.tableName>().type.toBe<"wealth_management_account">();
  });

  it("preserves Workspace companion aliases and literals", () => {
    expect<Identity.Workspace.WorkspaceId>().type.toBe<EntityId.EntityIdValueFor<"WorkspaceWorkspaceId">>();
    expect<Identity.Workspace.EmailArtifactId>().type.toBe<EntityId.EntityIdValueFor<"WorkspaceEmailArtifactId">>();
    expect<Identity.Workspace.CandidateProjectId>().type.toBe<
      EntityId.EntityIdValueFor<"WorkspaceCandidateProjectId">
    >();
    expect<Identity.Workspace.CandidateTaskId>().type.toBe<EntityId.EntityIdValueFor<"WorkspaceCandidateTaskId">>();
    expect<Identity.Workspace.CandidateDraftId>().type.toBe<EntityId.EntityIdValueFor<"WorkspaceCandidateDraftId">>();
    expect<Identity.Workspace.ApprovalGateId>().type.toBe<EntityId.EntityIdValueFor<"WorkspaceApprovalGateId">>();
    expect<Identity.Workspace.ContextPacketId>().type.toBe<EntityId.EntityIdValueFor<"WorkspaceContextPacketId">>();
    expect<typeof Identity.Workspace.WorkspaceId.tableName>().type.toBe<"workspace_workspace">();
    expect<typeof Identity.Workspace.EmailArtifactId.tableName>().type.toBe<"workspace_email_artifact">();
    expect<typeof Identity.Workspace.CandidateProjectId.tableName>().type.toBe<"workspace_candidate_project">();
    expect<typeof Identity.Workspace.CandidateTaskId.tableName>().type.toBe<"workspace_candidate_task">();
    expect<typeof Identity.Workspace.CandidateDraftId.tableName>().type.toBe<"workspace_candidate_draft">();
    expect<typeof Identity.Workspace.ApprovalGateId.tableName>().type.toBe<"workspace_approval_gate">();
    expect<typeof Identity.Workspace.ContextPacketId.tableName>().type.toBe<"workspace_context_packet">();
  });
});
