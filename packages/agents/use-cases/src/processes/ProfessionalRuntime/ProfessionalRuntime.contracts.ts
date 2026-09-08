/**
 * SDK data-transfer contracts for the Agentic Professional Runtime proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { EmailString, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import {
  RuntimeActivityType,
  RuntimeApprovalDecision,
  RuntimeCandidateLifecycle,
  RuntimeClaimConfidence,
  RuntimeFixtureScenarioId,
  RuntimeRequestKind,
  RuntimeSourceKind,
  RuntimeUsageMode,
} from "./ProfessionalRuntime.values.ts";

const $I = $AgentsUseCasesId.create("processes/ProfessionalRuntime/ProfessionalRuntime.contracts");
const RuntimeOrganizationId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeOrganizationId", {
    description: "Non-empty organization identifier used by runtime DTOs.",
  })
);
const RuntimeWorkspaceId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeWorkspaceId", {
    description: "Non-empty workspace identifier used by runtime DTOs.",
  })
);
const RuntimeThreadId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeThreadId", {
    description: "Non-empty thread identifier used by runtime DTOs.",
  })
);
const RuntimeArtifactId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeArtifactId", {
    description: "Non-empty source or draft artifact identifier used by runtime DTOs.",
  })
);
const RuntimeSpanId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeSpanId", {
    description: "Non-empty source span identifier used by runtime evidence references.",
  })
);
const RuntimeEntityId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeEntityId", {
    description: "Non-empty vertical or runtime entity identifier.",
  })
);
const RuntimeEntityKind = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeEntityKind", {
    description: "Non-empty vertical or runtime entity kind.",
  })
);
const RuntimeClaimId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeClaimId", {
    description: "Non-empty candidate claim identifier.",
  })
);
const RuntimeProjectId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeProjectId", {
    description: "Non-empty candidate project identifier.",
  })
);
const RuntimeTaskId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeTaskId", {
    description: "Non-empty candidate task identifier.",
  })
);
const RuntimeDraftId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeDraftId", {
    description: "Non-empty candidate draft identifier.",
  })
);
const RuntimeApprovalGateId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeApprovalGateId", {
    description: "Non-empty candidate approval-gate identifier.",
  })
);
const RuntimePrincipalId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimePrincipalId", {
    description: "Non-empty principal identifier used for runtime provenance.",
  })
);
const RuntimeContextPacketId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeContextPacketId", {
    description: "Non-empty context packet identifier.",
  })
);
const RuntimeUsageRecordId = S.NonEmptyString.pipe(
  $I.annoteSchema("RuntimeUsageRecordId", {
    description: "Non-empty usage attribution record identifier.",
  })
);
const RuntimeLocalDateText = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}$/u, {
    identifier: $I`RuntimeLocalDateTextCheck`,
    title: "Runtime Local Date Text",
    description: "A local calendar date encoded as YYYY-MM-DD.",
    message: "Expected a local date encoded as YYYY-MM-DD",
  })
).pipe(
  $I.annoteSchema("RuntimeLocalDateText", {
    description: "Local calendar date text encoded as YYYY-MM-DD.",
  })
);
const RuntimeIsoInstantText = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u, {
    identifier: $I`RuntimeIsoInstantTextCheck`,
    title: "Runtime ISO Instant Text",
    description: "An ISO-like UTC instant encoded as YYYY-MM-DDTHH:mm:ssZ.",
    message: "Expected an ISO UTC instant encoded as YYYY-MM-DDTHH:mm:ssZ",
  })
).pipe(
  $I.annoteSchema("RuntimeIsoInstantText", {
    description: "UTC instant text encoded as YYYY-MM-DDTHH:mm:ssZ.",
  })
);
const RuntimeContextPacketSchemaVersion = S.Literal("runtime-data-loop.expected.context-packet.v1").pipe(
  $I.annoteSchema("RuntimeContextPacketSchemaVersion", {
    description: "Schema version literal emitted by deterministic runtime context packets.",
  })
);

/**
 * Scope for an SDK request.
 *
 * **Example** (Make scope with IDs)
 *
 * ```ts
 * import { RuntimeScope } from "@beep/agents-use-cases/public"
 *
 * const scope = RuntimeScope.make({
 *   organizationId: "org-1",
 *   threadId: "thread-1",
 *   workspaceId: "workspace-1"
 * })
 *
 * console.log(scope.workspaceId) // "workspace-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeScope extends S.Class<RuntimeScope>($I`RuntimeScope`)(
  {
    organizationId: RuntimeOrganizationId.annotateKey({
      description: "Organization scope identifier for the runtime request.",
    }),
    threadId: RuntimeThreadId.annotateKey({ description: "Thread scope identifier for the runtime request." }),
    workspaceId: RuntimeWorkspaceId.annotateKey({
      description: "Workspace scope identifier for the runtime request.",
    }),
  },
  $I.annote("RuntimeScope", {
    description: "Tenant, workspace, and thread scope for an SDK request.",
  })
) {}

/**
 * Lightweight reference to a vertical or runtime entity.
 *
 * **Example** (Make household entity ref)
 *
 * ```ts
 * import { RuntimeEntityRef } from "@beep/agents-use-cases/public"
 *
 * const household = RuntimeEntityRef.make({
 *   id: "household-park-family",
 *   kind: "household"
 * })
 *
 * console.log(`${household.kind}:${household.id}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeEntityRef extends S.Class<RuntimeEntityRef>($I`RuntimeEntityRef`)(
  {
    id: RuntimeEntityId.annotateKey({ description: "Identifier of the referenced runtime or vertical entity." }),
    kind: RuntimeEntityKind.annotateKey({ description: "Kind of the referenced runtime or vertical entity." }),
  },
  $I.annote("RuntimeEntityRef", {
    description: "Kind/id reference to a vertical or runtime entity.",
  })
) {}

/**
 * Source evidence reference for a candidate output.
 *
 * **Example** (Make evidence with spans)
 *
 * ```ts
 * import { RuntimeEvidenceRef } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const evidence = RuntimeEvidenceRef.make({
 *   artifactId: "email-artifact-001",
 *   spanIds: O.some(["email-001-s2", "email-001-s3"])
 * })
 *
 * console.log(O.getOrElse(evidence.spanIds, () => []).length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeEvidenceRef extends S.Class<RuntimeEvidenceRef>($I`RuntimeEvidenceRef`)(
  {
    artifactId: RuntimeArtifactId.annotateKey({ description: "Source artifact identifier carrying the evidence." }),
    spanId: RuntimeSpanId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional single source span identifier.",
    }),
    spanIds: S.Array(RuntimeSpanId).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional source span identifiers when evidence covers multiple spans.",
    }),
  },
  $I.annote("RuntimeEvidenceRef", {
    description: "Reference to one or more source spans on an artifact.",
  })
) {
  static readonly encodeResult = S.encodeResult(RuntimeEvidenceRef);
}

/**
 * Candidate claim proposed by the runtime.
 *
 * **Example** (Make high-confidence claim)
 *
 * ```ts
 * import {
 *   RuntimeCandidateClaim,
 *   RuntimeEntityRef,
 *   RuntimeEvidenceRef
 * } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const claim = RuntimeCandidateClaim.make({
 *   claimId: "claim-cash-need-001",
 *   claimType: "client_cash_need",
 *   confidence: "high",
 *   evidence: [RuntimeEvidenceRef.make({ artifactId: "email-001", spanId: O.some("s2") })],
 *   lifecycle: "candidate",
 *   producedByPrincipalId: "principal-agent-runtime-fixture",
 *   statement: "The household needs cash available by June 3.",
 *   subjectRef: RuntimeEntityRef.make({ id: "household-park-family", kind: "household" })
 * })
 *
 * console.log(claim.confidence) // "high"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeCandidateClaim extends S.Class<RuntimeCandidateClaim>($I`RuntimeCandidateClaim`)(
  {
    claimId: RuntimeClaimId.annotateKey({ description: "Candidate claim identifier." }),
    claimType: S.NonEmptyString.annotateKey({ description: "Domain-specific candidate claim type." }),
    confidence: RuntimeClaimConfidence.annotateKey({ description: "Confidence assigned to the candidate claim." }),
    eventDate: RuntimeLocalDateText.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional local date associated with the claim event.",
    }),
    evidence: S.Array(RuntimeEvidenceRef).annotateKey({ description: "Evidence references supporting the claim." }),
    lifecycle: RuntimeCandidateLifecycle.annotateKey({ description: "Lifecycle state of the candidate claim." }),
    producedByPrincipalId: RuntimePrincipalId.annotateKey({
      description: "Principal identifier for the agent that produced the claim.",
    }),
    statement: S.NonEmptyString.annotateKey({ description: "Human-readable candidate claim statement." }),
    subjectRef: RuntimeEntityRef.annotateKey({ description: "Subject entity that the claim is about." }),
  },
  $I.annote("RuntimeCandidateClaim", {
    description: "Candidate claim with source evidence and producing principal provenance.",
  })
) {
  static readonly encodeResult = S.encodeResult(RuntimeCandidateClaim);
}

/**
 * Candidate project proposed by the runtime.
 *
 * **Example** (Make candidate project)
 *
 * ```ts
 * import {
 *   RuntimeCandidateProject,
 *   RuntimeEntityRef,
 *   RuntimeEvidenceRef
 * } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const project = RuntimeCandidateProject.make({
 *   evidence: [RuntimeEvidenceRef.make({ artifactId: "email-001", spanId: O.some("s2") })],
 *   lifecycle: "candidate",
 *   projectId: "project-cash-need-001",
 *   title: "Review household cash need",
 *   verticalContextRefs: [
 *     RuntimeEntityRef.make({ id: "household-park-family", kind: "household" })
 *   ],
 *   workspaceId: "workspace-wealth"
 * })
 *
 * console.log(project.title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeCandidateProject extends S.Class<RuntimeCandidateProject>($I`RuntimeCandidateProject`)(
  {
    evidence: S.Array(RuntimeEvidenceRef).annotateKey({ description: "Evidence references supporting the project." }),
    lifecycle: RuntimeCandidateLifecycle.annotateKey({ description: "Lifecycle state of the candidate project." }),
    projectId: RuntimeProjectId.annotateKey({ description: "Candidate project identifier." }),
    title: S.NonEmptyString.annotateKey({ description: "Candidate project title." }),
    verticalContextRefs: S.Array(RuntimeEntityRef).annotateKey({
      description: "Vertical context entities attached to the candidate project.",
    }),
    workspaceId: RuntimeWorkspaceId.annotateKey({ description: "Workspace identifier for the candidate project." }),
  },
  $I.annote("RuntimeCandidateProject", {
    description: "Candidate project with workspace, context references, and source evidence.",
  })
) {}

/**
 * Candidate task proposed by the runtime.
 *
 * **Example** (Make task with due date)
 *
 * ```ts
 * import { RuntimeCandidateTask, RuntimeEvidenceRef } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const task = RuntimeCandidateTask.make({
 *   assigneePrincipalId: "principal-user-wealth-tia-rowan",
 *   dueDate: "2026-05-08",
 *   evidence: [RuntimeEvidenceRef.make({ artifactId: "email-001", spanId: O.some("s5") })],
 *   lifecycle: "candidate",
 *   projectId: "project-cash-need-001",
 *   taskId: "task-schedule-call-001",
 *   title: "Offer Friday afternoon call times"
 * })
 *
 * console.log(task.dueDate) // "2026-05-08"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeCandidateTask extends S.Class<RuntimeCandidateTask>($I`RuntimeCandidateTask`)(
  {
    assigneePrincipalId: RuntimePrincipalId.annotateKey({
      description: "Principal identifier assigned to the candidate task.",
    }),
    dueDate: RuntimeLocalDateText.annotateKey({ description: "Task due date encoded as YYYY-MM-DD." }),
    evidence: S.Array(RuntimeEvidenceRef).annotateKey({ description: "Evidence references supporting the task." }),
    lifecycle: RuntimeCandidateLifecycle.annotateKey({ description: "Lifecycle state of the candidate task." }),
    projectId: RuntimeProjectId.annotateKey({ description: "Candidate project identifier for this task." }),
    taskId: RuntimeTaskId.annotateKey({ description: "Candidate task identifier." }),
    title: S.NonEmptyString.annotateKey({ description: "Candidate task title." }),
  },
  $I.annote("RuntimeCandidateTask", {
    description: "Candidate task with assignee, due date, and source evidence.",
  })
) {}

/**
 * Recipient for a candidate draft.
 *
 * **Example** (Make draft recipient)
 *
 * ```ts
 * import { RuntimeDraftRecipient } from "@beep/agents-use-cases/public"
 * import { EmailString } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const recipient = RuntimeDraftRecipient.make({
 *   displayName: "Mira Park",
 *   email: S.decodeUnknownSync(EmailString)("mira.park@example.test")
 * })
 *
 * console.log(recipient.email)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeDraftRecipient extends S.Class<RuntimeDraftRecipient>($I`RuntimeDraftRecipient`)(
  {
    displayName: S.NonEmptyString.annotateKey({ description: "Display name for the draft recipient." }),
    email: EmailString.annotateKey({ description: "Email address for the draft recipient." }),
  },
  $I.annote("RuntimeDraftRecipient", {
    description: "Draft recipient display name and email address.",
  })
) {}

/**
 * Candidate draft proposed by the runtime.
 *
 * **Example** (Make approval-required draft)
 *
 * ```ts
 * import {
 *   RuntimeCandidateDraft,
 *   RuntimeDraftRecipient,
 *   RuntimeEvidenceRef
 * } from "@beep/agents-use-cases/public"
 * import { EmailString } from "@beep/schema"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const draft = RuntimeCandidateDraft.make({
 *   artifactId: "draft-artifact-001",
 *   body: "I will review the cash options before recommending movement.",
 *   draftId: "draft-cash-acknowledgement-001",
 *   draftKind: "client_email_reply",
 *   evidence: [RuntimeEvidenceRef.make({ artifactId: "email-001", spanId: O.some("s5") })],
 *   lifecycle: "candidate",
 *   producedByPrincipalId: "principal-agent-runtime-fixture",
 *   requiresApproval: true,
 *   subject: "Re: Cash need",
 *   to: [
 *     RuntimeDraftRecipient.make({
 *       displayName: "Mira Park",
 *       email: S.decodeUnknownSync(EmailString)("mira.park@example.test")
 *     })
 *   ]
 * })
 *
 * console.log(draft.requiresApproval) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeCandidateDraft extends S.Class<RuntimeCandidateDraft>($I`RuntimeCandidateDraft`)(
  {
    artifactId: RuntimeArtifactId.annotateKey({ description: "Draft artifact identifier." }),
    body: S.NonEmptyString.annotateKey({ description: "Draft body text proposed by the runtime." }),
    draftId: RuntimeDraftId.annotateKey({ description: "Candidate draft identifier." }),
    draftKind: S.NonEmptyString.annotateKey({ description: "Domain-specific draft kind." }),
    evidence: S.Array(RuntimeEvidenceRef).annotateKey({ description: "Evidence references supporting the draft." }),
    lifecycle: RuntimeCandidateLifecycle.annotateKey({ description: "Lifecycle state of the candidate draft." }),
    producedByPrincipalId: RuntimePrincipalId.annotateKey({
      description: "Principal identifier for the agent that produced the draft.",
    }),
    requiresApproval: S.Boolean.annotateKey({ description: "Whether the draft requires approval before use." }),
    subject: S.NonEmptyString.annotateKey({ description: "Draft subject line." }),
    to: S.Array(RuntimeDraftRecipient).annotateKey({ description: "Draft recipients." }),
  },
  $I.annote("RuntimeCandidateDraft", {
    description: "Candidate draft artifact with approval requirement, evidence, and producing principal.",
  })
) {}

/**
 * Candidate approval gate proposed by the runtime.
 *
 * **Example** (Make pending approval gate)
 *
 * ```ts
 * import { RuntimeApprovalGate, RuntimeEvidenceRef } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const gate = RuntimeApprovalGate.make({
 *   approvalGateId: "approval-cash-request-001",
 *   candidateRefs: ["claim-cash-need-001", "draft-cash-acknowledgement-001"],
 *   decision: "pending",
 *   evidence: [RuntimeEvidenceRef.make({ artifactId: "email-001", spanIds: O.some(["s2", "s5"]) })],
 *   lifecycle: "candidate",
 *   policyBasis: "Advisor approval is required before sending client-facing drafts.",
 *   requestedActions: ["approve_or_revise_client_email_draft"],
 *   reviewerPrincipalId: "principal-user-wealth-tia-rowan"
 * })
 *
 * console.log(gate.decision) // "pending"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeApprovalGate extends S.Class<RuntimeApprovalGate>($I`RuntimeApprovalGate`)(
  {
    approvalGateId: RuntimeApprovalGateId.annotateKey({ description: "Candidate approval-gate identifier." }),
    candidateRefs: S.Array(S.NonEmptyString).annotateKey({
      description: "Candidate claim, task, draft, or project identifiers covered by the gate.",
    }),
    decision: RuntimeApprovalDecision.annotateKey({ description: "Current approval decision for the gate." }),
    evidence: S.Array(RuntimeEvidenceRef).annotateKey({ description: "Evidence references supporting the gate." }),
    lifecycle: RuntimeCandidateLifecycle.annotateKey({ description: "Lifecycle state of the approval gate." }),
    policyBasis: S.NonEmptyString.annotateKey({ description: "Policy rationale for requiring approval." }),
    requestedActions: S.Array(S.NonEmptyString).annotateKey({
      description: "Actions requested from the reviewer.",
    }),
    reviewerPrincipalId: RuntimePrincipalId.annotateKey({ description: "Principal identifier for the reviewer." }),
  },
  $I.annote("RuntimeApprovalGate", {
    description: "Human approval gate over candidate claims, tasks, and drafts.",
  })
) {}

/**
 * Request section embedded in a context packet.
 *
 * **Example** (Make context packet request)
 *
 * ```ts
 * import { RuntimeContextPacketRequest } from "@beep/agents-use-cases/public"
 *
 * const request = RuntimeContextPacketRequest.make({
 *   artifactId: "email-artifact-001",
 *   kind: "email_to_candidate_work"
 * })
 *
 * console.log(request.kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeContextPacketRequest extends S.Class<RuntimeContextPacketRequest>($I`RuntimeContextPacketRequest`)(
  {
    artifactId: RuntimeArtifactId.annotateKey({
      description: "Source artifact identifier that triggered the context packet.",
    }),
    kind: RuntimeRequestKind.annotateKey({ description: "Runtime request kind summarized by the packet." }),
  },
  $I.annote("RuntimeContextPacketRequest", {
    description: "Original runtime request summarized inside a context packet.",
  })
) {}

/**
 * Source span declared by a context packet source artifact.
 *
 * **Example** (Make source span ref)
 *
 * ```ts
 * import { RuntimeSourceSpanRef } from "@beep/agents-use-cases/public"
 *
 * const span = RuntimeSourceSpanRef.make({
 *   purpose: "cash need and date",
 *   spanId: "email-001-s2"
 * })
 *
 * console.log(span.spanId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeSourceSpanRef extends S.Class<RuntimeSourceSpanRef>($I`RuntimeSourceSpanRef`)(
  {
    purpose: S.NonEmptyString.annotateKey({ description: "Evidence purpose represented by the source span." }),
    spanId: RuntimeSpanId.annotateKey({ description: "Source span identifier declared by the artifact." }),
  },
  $I.annote("RuntimeSourceSpanRef", {
    description: "Declared source span and its evidence purpose.",
  })
) {}

/**
 * Source artifact declared by a context packet.
 *
 * **Example** (Make source artifact)
 *
 * ```ts
 * import { RuntimeSourceArtifact, RuntimeSourceSpanRef } from "@beep/agents-use-cases/public"
 *
 * const artifact = RuntimeSourceArtifact.make({
 *   artifactId: "email-artifact-001",
 *   sourceKind: "email",
 *   spanRefs: [
 *     RuntimeSourceSpanRef.make({ purpose: "cash need and date", spanId: "email-001-s2" })
 *   ],
 *   title: "Cash need"
 * })
 *
 * console.log(artifact.spanRefs[0]?.purpose)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeSourceArtifact extends S.Class<RuntimeSourceArtifact>($I`RuntimeSourceArtifact`)(
  {
    artifactId: RuntimeArtifactId.annotateKey({ description: "Source artifact identifier." }),
    sourceKind: RuntimeSourceKind.annotateKey({ description: "Source artifact kind." }),
    spanRefs: S.Array(RuntimeSourceSpanRef).annotateKey({
      description: "Source spans declared on the artifact.",
    }),
    title: S.NonEmptyString.annotateKey({ description: "Human-readable source artifact title." }),
  },
  $I.annote("RuntimeSourceArtifact", {
    description: "Source artifact and the spans available for evidence references.",
  })
) {}

/**
 * Runtime provenance activity included in a context packet.
 *
 * **Example** (Make provenance activity)
 *
 * ```ts
 * import { RuntimeActivity } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const activity = RuntimeActivity.make({
 *   activityId: "activity-candidates-proposed-001",
 *   activityType: "candidate_work_proposed",
 *   principalId: "principal-agent-runtime-fixture",
 *   spanIds: O.some(["email-001-s2", "email-001-s5"])
 * })
 *
 * console.log(activity.activityType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeActivity extends S.Class<RuntimeActivity>($I`RuntimeActivity`)(
  {
    activityId: S.NonEmptyString.annotateKey({ description: "Runtime provenance activity identifier." }),
    activityType: RuntimeActivityType.annotateKey({ description: "Runtime provenance activity type." }),
    artifactId: RuntimeArtifactId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional artifact identifier linked to the activity.",
    }),
    principalId: RuntimePrincipalId.annotateKey({ description: "Principal identifier responsible for the activity." }),
    spanIds: S.Array(RuntimeSpanId).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
      description: "Optional span identifiers linked to the activity.",
    }),
  },
  $I.annote("RuntimeActivity", {
    description: "Provenance activity for ingestion and candidate proposal events.",
  })
) {
  static readonly encodeResult = S.encodeResult(RuntimeActivity);
}

/**
 * Runtime usage attribution included in a context packet.
 *
 * **Example** (Make fixture usage record)
 *
 * ```ts
 * import { RuntimeUsageRecord } from "@beep/agents-use-cases/public"
 *
 * const usage = RuntimeUsageRecord.make({
 *   mode: "deterministic_fixture",
 *   model: "none",
 *   provider: "fixture",
 *   usageRecordId: "usage-fixture-agent-001"
 * })
 *
 * console.log(`${usage.provider}:${usage.model}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeUsageRecord extends S.Class<RuntimeUsageRecord>($I`RuntimeUsageRecord`)(
  {
    mode: RuntimeUsageMode.annotateKey({ description: "Runtime usage mode." }),
    model: S.NonEmptyString.annotateKey({ description: "Model name or sentinel used by the runtime path." }),
    provider: S.NonEmptyString.annotateKey({ description: "Provider name or sentinel used by the runtime path." }),
    usageRecordId: RuntimeUsageRecordId.annotateKey({ description: "Runtime usage attribution record identifier." }),
  },
  $I.annote("RuntimeUsageRecord", {
    description: "Usage attribution for the runtime path that produced candidate work.",
  })
) {}

/**
 * Context packet returned to SDK clients.
 *
 * **Example** (Assemble full context packet)
 *
 * ```ts
 * import {
 *   RuntimeActivity,
 *   RuntimeContextPacketRequest,
 *   RuntimeEntityRef,
 *   RuntimeScope,
 *   RuntimeSourceArtifact,
 *   RuntimeSourceSpanRef,
 *   RuntimeUsageRecord,
 *   SdkContextPacket
 * } from "@beep/agents-use-cases/public"
 * import * as O from "effect/Option"
 *
 * const packet = SdkContextPacket.make({
 *   activities: [
 *     RuntimeActivity.make({
 *       activityId: "activity-ingested-001",
 *       activityType: "artifact_ingested",
 *       artifactId: O.some("email-001"),
 *       principalId: "principal-agent-runtime-fixture"
 *     })
 *   ],
 *   approvalGates: ["approval-cash-request-001"],
 *   candidateClaims: ["claim-cash-need-001"],
 *   candidateDrafts: ["draft-cash-acknowledgement-001"],
 *   candidateTasks: ["task-schedule-call-001"],
 *   contextPacketId: "context-cash-request-001",
 *   exclusions: ["No external money movement instruction is included."],
 *   generatedAt: "2026-05-01T15:05:10Z",
 *   principals: ["principal-user-wealth-tia-rowan", "principal-agent-runtime-fixture"],
 *   request: RuntimeContextPacketRequest.make({
 *     artifactId: "email-001",
 *     kind: "email_to_candidate_work"
 *   }),
 *   scenarioId: "wealth-cash-request",
 *   schemaVersion: "runtime-data-loop.expected.context-packet.v1",
 *   scope: RuntimeScope.make({
 *     organizationId: "org-wealth",
 *     threadId: "thread-wealth-001",
 *     workspaceId: "workspace-wealth"
 *   }),
 *   sourceArtifacts: [
 *     RuntimeSourceArtifact.make({
 *       artifactId: "email-001",
 *       sourceKind: "email",
 *       spanRefs: [
 *         RuntimeSourceSpanRef.make({ purpose: "cash need and date", spanId: "email-001-s2" })
 *       ],
 *       title: "Cash need"
 *     })
 *   ],
 *   usage: [
 *     RuntimeUsageRecord.make({
 *       mode: "deterministic_fixture",
 *       model: "none",
 *       provider: "fixture",
 *       usageRecordId: "usage-fixture-agent-001"
 *     })
 *   ],
 *   verticalContext: [
 *     RuntimeEntityRef.make({ id: "household-park-family", kind: "household" })
 *   ]
 * })
 *
 * console.log(packet.request.artifactId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SdkContextPacket extends S.Class<SdkContextPacket>($I`SdkContextPacket`)(
  {
    activities: S.Array(RuntimeActivity).annotateKey({ description: "Runtime provenance activities in the packet." }),
    approvalGates: S.Array(RuntimeApprovalGateId).annotateKey({
      description: "Approval-gate identifiers included in the packet.",
    }),
    candidateClaims: S.Array(RuntimeClaimId).annotateKey({
      description: "Candidate claim identifiers included in the packet.",
    }),
    candidateDrafts: S.Array(RuntimeDraftId).annotateKey({
      description: "Candidate draft identifiers included in the packet.",
    }),
    candidateTasks: S.Array(RuntimeTaskId).annotateKey({
      description: "Candidate task identifiers included in the packet.",
    }),
    contextPacketId: RuntimeContextPacketId.annotateKey({ description: "Context packet identifier." }),
    exclusions: S.Array(S.NonEmptyString).annotateKey({
      description: "Explicit exclusions and unavailable capabilities for the packet.",
    }),
    generatedAt: RuntimeIsoInstantText.annotateKey({ description: "UTC instant when the packet was generated." }),
    principals: S.Array(RuntimePrincipalId).annotateKey({
      description: "Principal identifiers available in the packet context.",
    }),
    request: RuntimeContextPacketRequest.annotateKey({ description: "Runtime request summarized by the packet." }),
    scenarioId: RuntimeFixtureScenarioId.annotateKey({ description: "Fixture scenario identifier for the packet." }),
    schemaVersion: RuntimeContextPacketSchemaVersion.annotateKey({
      description: "Context packet schema version literal.",
    }),
    scope: RuntimeScope.annotateKey({ description: "Request scope for the context packet." }),
    sourceArtifacts: S.Array(RuntimeSourceArtifact).annotateKey({
      description: "Source artifacts available as evidence in the packet.",
    }),
    usage: S.Array(RuntimeUsageRecord).annotateKey({ description: "Runtime usage attribution records." }),
    verticalContext: S.Array(RuntimeEntityRef).annotateKey({
      description: "Vertical context entities relevant to the packet.",
    }),
  },
  $I.annote("SdkContextPacket", {
    description: "Evidence-bounded context packet returned through the runtime SDK.",
  })
) {}

/**
 * Batch of candidate outputs proposed by an agent run.
 *
 * **Example** (Run fixture for candidates)
 *
 * ```ts
 * import { runRuntimeFixture, RuntimeFixtureInput } from "@beep/agents-use-cases/proof"
 * import { Effect } from "effect"
 *
 * const fixture = RuntimeFixtureInput.make({
 *   body: [
 *     "[span:law-email-001-s2] We need help preparing a provisional patent application.",
 *     "[span:law-email-001-s3] The public prototype demonstration is planned for June 12, 2026.",
 *     "[span:law-email-001-s4] Avery Chen and Priya Raman are the main contributors.",
 *     "[span:law-email-001-s5] Please schedule an intake call next week."
 *   ].join("\n"),
 *   email: {
 *     artifactId: "email-artifact-law-001",
 *     scenarioId: "law-patent-intake",
 *     sourceSpans: ["law-email-001-s2", "law-email-001-s3", "law-email-001-s4", "law-email-001-s5"],
 *     subject: "Provisional patent help",
 *     threadId: "thread-law-001"
 *   },
 *   promotionSubjects: [{ id: "application-16138242", kind: "patent-application" }],
 *   seed: {
 *     organization: { organizationId: "org-law-fixture" },
 *     scenarioId: "law-patent-intake",
 *     workspace: { workspaceId: "workspace-law-fixture" }
 *   }
 * })
 *
 * Effect.runPromise(runRuntimeFixture(fixture)).then((outputSet) =>
 *   console.log(outputSet.claims.length) // 3
 * )
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CandidateOutputSet extends S.Class<CandidateOutputSet>($I`CandidateOutputSet`)(
  {
    approvalGates: S.Array(RuntimeApprovalGate).annotateKey({
      description: "Candidate approval gates proposed by the runtime.",
    }),
    candidateProject: RuntimeCandidateProject.annotateKey({
      description: "Candidate project proposed by the runtime.",
    }),
    claims: S.Array(RuntimeCandidateClaim).annotateKey({ description: "Candidate claims proposed by the runtime." }),
    contextPacket: SdkContextPacket.annotateKey({ description: "Evidence-bounded context packet for the output set." }),
    drafts: S.Array(RuntimeCandidateDraft).annotateKey({ description: "Candidate drafts proposed by the runtime." }),
    scenarioId: RuntimeFixtureScenarioId.annotateKey({
      description: "Fixture scenario identifier for the output set.",
    }),
    tasks: S.Array(RuntimeCandidateTask).annotateKey({ description: "Candidate tasks proposed by the runtime." }),
  },
  $I.annote("CandidateOutputSet", {
    description: "Structured candidate claims, project, tasks, drafts, gates, and context packet.",
  })
) {
  static readonly fromUnknown = S.decodeUnknownSync(CandidateOutputSet);

  static readonly encodeResult = S.encodeResult(CandidateOutputSet);
}
