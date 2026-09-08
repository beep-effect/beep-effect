/**
 * Deterministic fixture runner for the P3 runtime data-loop proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import { PromotionSubjectRef } from "@beep/shared-use-cases/PromotionGate";
import { A, Str } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { CandidateOutputSet } from "./ProfessionalRuntime.contracts.ts";
import { ProfessionalRuntimeValidationError } from "./ProfessionalRuntime.errors.ts";
import { RuntimeFixtureScenarioId } from "./ProfessionalRuntime.values.ts";

// cspell:words Priya Raman

const $I = $AgentsUseCasesId.create("processes/ProfessionalRuntime/ProfessionalRuntime.fixtures");

class RuntimeFixtureEmailInput extends S.Class<RuntimeFixtureEmailInput>($I`RuntimeFixtureEmailInput`)(
  {
    artifactId: S.String,
    scenarioId: RuntimeFixtureScenarioId,
    sourceSpans: S.Array(S.String),
    subject: S.String,
    threadId: S.String,
  },
  $I.annote("RuntimeFixtureEmailInput", {
    description: "Email artifact metadata and declared source spans for a deterministic runtime fixture.",
  })
) {}

class RuntimeFixtureOrganizationInput extends S.Class<RuntimeFixtureOrganizationInput>(
  $I`RuntimeFixtureOrganizationInput`
)(
  {
    organizationId: S.String,
  },
  $I.annote("RuntimeFixtureOrganizationInput", {
    description: "Organization seed values used to scope a deterministic runtime fixture.",
  })
) {}

class RuntimeFixtureWorkspaceInput extends S.Class<RuntimeFixtureWorkspaceInput>($I`RuntimeFixtureWorkspaceInput`)(
  {
    workspaceId: S.String,
  },
  $I.annote("RuntimeFixtureWorkspaceInput", {
    description: "Workspace seed values used to scope a deterministic runtime fixture.",
  })
) {}

class RuntimeFixtureSeedInput extends S.Class<RuntimeFixtureSeedInput>($I`RuntimeFixtureSeedInput`)(
  {
    organization: RuntimeFixtureOrganizationInput,
    scenarioId: RuntimeFixtureScenarioId,
    workspace: RuntimeFixtureWorkspaceInput,
  },
  $I.annote("RuntimeFixtureSeedInput", {
    description: "Scenario seed values used to build deterministic runtime fixture scope.",
  })
) {}

/**
 * Parsed fixture inputs for one runtime data-loop scenario.
 *
 * **Example** (Make RuntimeFixtureInput with seed)
 *
 * ```ts
 * import { RuntimeFixtureInput } from "@beep/agents-use-cases/proof"
 *
 * const fixture = RuntimeFixtureInput.make({
 *   body: "[span:law-email-001-s2] We need help preparing a provisional patent application.",
 *   email: {
 *     artifactId: "email-artifact-law-001",
 *     scenarioId: "law-patent-intake",
 *     sourceSpans: ["law-email-001-s2"],
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
 * console.log(fixture.email.scenarioId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RuntimeFixtureInput extends S.Class<RuntimeFixtureInput>($I`RuntimeFixtureInput`)(
  {
    body: S.String,
    email: RuntimeFixtureEmailInput,
    promotionSubjects: S.NonEmptyArray(PromotionSubjectRef).annotateKey({
      description: "Trusted product subjects bound to the deterministic fixture output by its host.",
    }),
    seed: RuntimeFixtureSeedInput,
  },
  $I.annote("RuntimeFixtureInput", {
    description: "Parsed fixture input combining the email body, email metadata, and scenario seed.",
  })
) {}

const assertScenario = (input: RuntimeFixtureInput): void => {
  if (input.seed.scenarioId !== input.email.scenarioId) {
    ProfessionalRuntimeValidationError.throwError(
      `Mismatched seed/email scenario ids: ${input.seed.scenarioId} !== ${input.email.scenarioId}`
    );
  }
};

const assertSpanRefs = (input: RuntimeFixtureInput, spanIds: ReadonlyArray<string>): void => {
  const missing = A.filter(spanIds, (spanId) => !Str.includes(`[span:${spanId}]`)(input.body));

  if (missing.length > 0) {
    ProfessionalRuntimeValidationError.throwError(
      `${input.email.scenarioId}: missing body spans: ${A.join(missing, ", ")}`
    );
  }
};

const runLawPatentIntake = (input: RuntimeFixtureInput): CandidateOutputSet => {
  const spanIds = ["law-email-001-s2", "law-email-001-s3", "law-email-001-s4", "law-email-001-s5"];
  assertSpanRefs(input, spanIds);

  return CandidateOutputSet.fromUnknown({
    scenarioId: "law-patent-intake",
    claims: [
      {
        claimId: "claim-law-provisional-request-001",
        lifecycle: "candidate",
        claimType: "client_request",
        subjectRef: {
          kind: "matter",
          id: "matter-law-robotic-gripper-001",
        },
        statement:
          "Northstar Robotics asked for help preparing a provisional patent application for the robotic gripper control system.",
        confidence: "high",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "law-email-001-s2",
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
      {
        claimId: "claim-law-demo-date-001",
        lifecycle: "candidate",
        claimType: "deadline_context",
        subjectRef: {
          kind: "patentAsset",
          id: "patent-asset-robotic-gripper-001",
        },
        statement: "The client plans a public prototype demonstration on June 12, 2026.",
        confidence: "high",
        eventDate: "2026-06-12",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "law-email-001-s3",
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
      {
        claimId: "claim-law-inventor-candidates-001",
        lifecycle: "candidate",
        claimType: "inventor_context",
        subjectRef: {
          kind: "patentAsset",
          id: "patent-asset-robotic-gripper-001",
        },
        statement: "Avery Chen and Priya Raman are named by the client as the main contributors.",
        confidence: "medium",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "law-email-001-s4",
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
    ],
    candidateProject: {
      projectId: "project-law-provisional-filing-001",
      lifecycle: "candidate",
      workspaceId: input.seed.workspace.workspaceId,
      title: "Prepare provisional patent intake",
      verticalContextRefs: [
        {
          kind: "matter",
          id: "matter-law-robotic-gripper-001",
        },
        {
          kind: "patentAsset",
          id: "patent-asset-robotic-gripper-001",
        },
      ],
      evidence: [
        {
          artifactId: input.email.artifactId,
          spanIds: ["law-email-001-s2", "law-email-001-s3"],
        },
      ],
    },
    tasks: [
      {
        taskId: "task-law-schedule-intake-call-001",
        projectId: "project-law-provisional-filing-001",
        lifecycle: "candidate",
        title: "Schedule patent intake call next week",
        assigneePrincipalId: "principal-user-law-jordan-miles",
        dueDate: "2026-05-08",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "law-email-001-s5",
          },
        ],
      },
      {
        taskId: "task-law-request-invention-materials-001",
        projectId: "project-law-provisional-filing-001",
        lifecycle: "candidate",
        title: "Request design notes, photos, and control-flow diagram",
        assigneePrincipalId: "principal-user-law-jordan-miles",
        dueDate: "2026-05-05",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "law-email-001-s4",
          },
        ],
      },
      {
        taskId: "task-law-confirm-public-demo-deadline-001",
        projectId: "project-law-provisional-filing-001",
        lifecycle: "candidate",
        title: "Confirm filing timeline before June 12 public demo",
        assigneePrincipalId: "principal-user-law-jordan-miles",
        dueDate: "2026-05-10",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "law-email-001-s3",
          },
        ],
      },
    ],
    drafts: [
      {
        draftId: "draft-law-patent-acknowledgement-001",
        artifactId: "draft-artifact-law-patent-acknowledgement-001",
        lifecycle: "candidate",
        draftKind: "client_email_reply",
        to: [
          {
            displayName: "Avery Chen",
            email: "avery.chen@example.test",
          },
        ],
        subject: `Re: ${input.email.subject}`,
        body: "Hi Avery,\n\nThanks for the note. I can help you prepare for the provisional patent discussion, and the June 12 demo date is important context for our timing. Please send the design notes, photos, and control-flow diagram when ready. I will also send over an intake checklist and a few times for a call next week.\n\nBest,\nJordan",
        requiresApproval: true,
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanIds,
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
    ],
    approvalGates: [
      {
        approvalGateId: "approval-law-patent-intake-001",
        lifecycle: "candidate",
        decision: "pending",
        reviewerPrincipalId: "principal-user-law-jordan-miles",
        policyBasis:
          "Attorney approval is required before accepting legal-context claims, creating authoritative tasks, or sending a client-facing draft.",
        requestedActions: [
          "accept_or_edit_candidate_claims",
          "accept_or_edit_candidate_tasks",
          "approve_or_revise_client_email_draft",
        ],
        candidateRefs: [
          "claim-law-provisional-request-001",
          "claim-law-demo-date-001",
          "claim-law-inventor-candidates-001",
          "task-law-schedule-intake-call-001",
          "task-law-request-invention-materials-001",
          "task-law-confirm-public-demo-deadline-001",
          "draft-law-patent-acknowledgement-001",
        ],
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanIds,
          },
        ],
      },
    ],
    contextPacket: {
      schemaVersion: "runtime-data-loop.expected.context-packet.v1",
      scenarioId: "law-patent-intake",
      contextPacketId: "context-law-patent-intake-001",
      generatedAt: "2026-05-01T14:13:30Z",
      scope: {
        organizationId: input.seed.organization.organizationId,
        workspaceId: input.seed.workspace.workspaceId,
        threadId: input.email.threadId,
      },
      request: {
        kind: "email_to_candidate_work",
        artifactId: input.email.artifactId,
      },
      principals: ["principal-user-law-jordan-miles", "principal-agent-runtime-fixture"],
      verticalContext: [
        {
          kind: "legalClient",
          id: "legal-client-northstar-robotics",
        },
        {
          kind: "matter",
          id: "matter-law-robotic-gripper-001",
        },
        {
          kind: "patentAsset",
          id: "patent-asset-robotic-gripper-001",
        },
      ],
      sourceArtifacts: [
        {
          artifactId: input.email.artifactId,
          sourceKind: "email",
          title: input.email.subject,
          spanRefs: [
            {
              spanId: "law-email-001-s2",
              purpose: "client request",
            },
            {
              spanId: "law-email-001-s3",
              purpose: "public demo date",
            },
            {
              spanId: "law-email-001-s4",
              purpose: "contributors and source materials",
            },
            {
              spanId: "law-email-001-s5",
              purpose: "requested next step",
            },
          ],
        },
      ],
      candidateClaims: [
        "claim-law-provisional-request-001",
        "claim-law-demo-date-001",
        "claim-law-inventor-candidates-001",
      ],
      candidateTasks: [
        "task-law-schedule-intake-call-001",
        "task-law-request-invention-materials-001",
        "task-law-confirm-public-demo-deadline-001",
      ],
      candidateDrafts: ["draft-law-patent-acknowledgement-001"],
      approvalGates: ["approval-law-patent-intake-001"],
      activities: [
        {
          activityId: "activity-law-email-ingested-001",
          activityType: "artifact_ingested",
          principalId: "principal-agent-runtime-fixture",
          artifactId: input.email.artifactId,
        },
        {
          activityId: "activity-law-candidates-proposed-001",
          activityType: "candidate_work_proposed",
          principalId: "principal-agent-runtime-fixture",
          spanIds,
        },
      ],
      usage: [
        {
          usageRecordId: "usage-law-fixture-agent-001",
          mode: "deterministic_fixture",
          provider: "fixture",
          model: "none",
        },
      ],
      exclusions: [
        "No raw email provider state is included.",
        "No external docket or filing portal state is included.",
        "No accepted legal advice is included.",
      ],
    },
  });
};

const runWealthCashRequest = (input: RuntimeFixtureInput): CandidateOutputSet => {
  const spanIds = ["wealth-email-001-s2", "wealth-email-001-s3", "wealth-email-001-s4", "wealth-email-001-s5"];
  assertSpanRefs(input, spanIds);

  return CandidateOutputSet.fromUnknown({
    scenarioId: "wealth-cash-request",
    claims: [
      {
        claimId: "claim-wealth-cash-need-001",
        lifecycle: "candidate",
        claimType: "client_cash_need",
        subjectRef: {
          kind: "household",
          id: "household-park-family",
        },
        statement: "The Park household needs about $150,000 available by June 3, 2026.",
        confidence: "high",
        eventDate: "2026-06-03",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "wealth-email-001-s2",
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
      {
        claimId: "claim-wealth-taxable-account-source-001",
        lifecycle: "candidate",
        claimType: "client_assumption",
        subjectRef: {
          kind: "account",
          id: "account-park-taxable-4421",
        },
        statement: "Mira assumed the cash could come from the taxable account ending in 4421.",
        confidence: "high",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "wealth-email-001-s3",
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
      {
        claimId: "claim-wealth-tax-sensitivity-001",
        lifecycle: "candidate",
        claimType: "client_preference",
        subjectRef: {
          kind: "household",
          id: "household-park-family",
        },
        statement: "Mira wants to avoid creating an unfavorable tax situation when sourcing cash.",
        confidence: "high",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "wealth-email-001-s3",
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
    ],
    candidateProject: {
      projectId: "project-wealth-cash-need-001",
      lifecycle: "candidate",
      workspaceId: input.seed.workspace.workspaceId,
      title: "Review Park household cash need",
      verticalContextRefs: [
        {
          kind: "household",
          id: "household-park-family",
        },
        {
          kind: "client",
          id: "client-mira-park",
        },
        {
          kind: "account",
          id: "account-park-taxable-4421",
        },
      ],
      evidence: [
        {
          artifactId: input.email.artifactId,
          spanIds: ["wealth-email-001-s2", "wealth-email-001-s3"],
        },
      ],
    },
    tasks: [
      {
        taskId: "task-wealth-review-liquidity-001",
        projectId: "project-wealth-cash-need-001",
        lifecycle: "candidate",
        title: "Review liquidity and tax-sensitive funding options",
        assigneePrincipalId: "principal-user-wealth-tia-rowan",
        dueDate: "2026-05-08",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanIds: ["wealth-email-001-s2", "wealth-email-001-s3", "wealth-email-001-s4"],
          },
        ],
      },
      {
        taskId: "task-wealth-schedule-friday-call-001",
        projectId: "project-wealth-cash-need-001",
        lifecycle: "candidate",
        title: "Offer Friday afternoon call times",
        assigneePrincipalId: "principal-user-wealth-tia-rowan",
        dueDate: "2026-05-08",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "wealth-email-001-s5",
          },
        ],
      },
      {
        taskId: "task-wealth-confirm-no-movement-001",
        projectId: "project-wealth-cash-need-001",
        lifecycle: "candidate",
        title: "Confirm no money movement occurs before advisor review",
        assigneePrincipalId: "principal-user-wealth-tia-rowan",
        dueDate: "2026-05-03",
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanId: "wealth-email-001-s4",
          },
        ],
      },
    ],
    drafts: [
      {
        draftId: "draft-wealth-cash-acknowledgement-001",
        artifactId: "draft-artifact-wealth-cash-acknowledgement-001",
        lifecycle: "candidate",
        draftKind: "client_email_reply",
        to: [
          {
            displayName: "Mira Park",
            email: "mira.park@example.test",
          },
        ],
        subject: `Re: ${input.email.subject}`,
        body: "Hi Mira,\n\nThanks for flagging the June 3 cash need. I will review the available options before recommending any movement, including the taxable account ending in 4421 and any tax considerations we should weigh. I can also send a few Friday afternoon times for a quick call.\n\nBest,\nTia",
        requiresApproval: true,
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanIds,
          },
        ],
        producedByPrincipalId: "principal-agent-runtime-fixture",
      },
    ],
    approvalGates: [
      {
        approvalGateId: "approval-wealth-cash-request-001",
        lifecycle: "candidate",
        decision: "pending",
        reviewerPrincipalId: "principal-user-wealth-tia-rowan",
        policyBasis:
          "Advisor approval is required before accepting client-intent claims, creating authoritative tasks, or sending a client-facing draft.",
        requestedActions: [
          "accept_or_edit_candidate_claims",
          "accept_or_edit_candidate_tasks",
          "approve_or_revise_client_email_draft",
        ],
        candidateRefs: [
          "claim-wealth-cash-need-001",
          "claim-wealth-taxable-account-source-001",
          "claim-wealth-tax-sensitivity-001",
          "task-wealth-review-liquidity-001",
          "task-wealth-schedule-friday-call-001",
          "task-wealth-confirm-no-movement-001",
          "draft-wealth-cash-acknowledgement-001",
        ],
        evidence: [
          {
            artifactId: input.email.artifactId,
            spanIds,
          },
        ],
      },
    ],
    contextPacket: {
      schemaVersion: "runtime-data-loop.expected.context-packet.v1",
      scenarioId: "wealth-cash-request",
      contextPacketId: "context-wealth-cash-request-001",
      generatedAt: "2026-05-01T15:05:10Z",
      scope: {
        organizationId: input.seed.organization.organizationId,
        workspaceId: input.seed.workspace.workspaceId,
        threadId: input.email.threadId,
      },
      request: {
        kind: "email_to_candidate_work",
        artifactId: input.email.artifactId,
      },
      principals: ["principal-user-wealth-tia-rowan", "principal-agent-runtime-fixture"],
      verticalContext: [
        {
          kind: "household",
          id: "household-park-family",
        },
        {
          kind: "client",
          id: "client-mira-park",
        },
        {
          kind: "account",
          id: "account-park-taxable-4421",
        },
      ],
      sourceArtifacts: [
        {
          artifactId: input.email.artifactId,
          sourceKind: "email",
          title: input.email.subject,
          spanRefs: [
            {
              spanId: "wealth-email-001-s2",
              purpose: "cash need and date",
            },
            {
              spanId: "wealth-email-001-s3",
              purpose: "assumed source and tax sensitivity",
            },
            {
              spanId: "wealth-email-001-s4",
              purpose: "request for recommendation before action",
            },
            {
              spanId: "wealth-email-001-s5",
              purpose: "requested call timing",
            },
          ],
        },
      ],
      candidateClaims: [
        "claim-wealth-cash-need-001",
        "claim-wealth-taxable-account-source-001",
        "claim-wealth-tax-sensitivity-001",
      ],
      candidateTasks: [
        "task-wealth-review-liquidity-001",
        "task-wealth-schedule-friday-call-001",
        "task-wealth-confirm-no-movement-001",
      ],
      candidateDrafts: ["draft-wealth-cash-acknowledgement-001"],
      approvalGates: ["approval-wealth-cash-request-001"],
      activities: [
        {
          activityId: "activity-wealth-email-ingested-001",
          activityType: "artifact_ingested",
          principalId: "principal-agent-runtime-fixture",
          artifactId: input.email.artifactId,
        },
        {
          activityId: "activity-wealth-candidates-proposed-001",
          activityType: "candidate_work_proposed",
          principalId: "principal-agent-runtime-fixture",
          spanIds,
        },
      ],
      usage: [
        {
          usageRecordId: "usage-wealth-fixture-agent-001",
          mode: "deterministic_fixture",
          provider: "fixture",
          model: "none",
        },
      ],
      exclusions: [
        "No portfolio accounting or custodian state is included.",
        "No external money movement instruction is included.",
        "No accepted financial recommendation is included.",
      ],
    },
  });
};

const fixtureRunnerForScenario: (
  scenarioId: RuntimeFixtureScenarioId
) => (input: RuntimeFixtureInput) => CandidateOutputSet = RuntimeFixtureScenarioId.$match({
  "law-patent-intake": () => runLawPatentIntake,
  "wealth-cash-request": () => runWealthCashRequest,
});

/**
 * Run one deterministic runtime data-loop fixture.
 *
 * **Details**
 *
 * Dispatches by `input.email.scenarioId`, verifies that seed and email
 * scenario ids match, and checks that the fixture body contains every source
 * span required by the selected scenario.
 *
 * **Example** (Run multi-span law fixture)
 *
 * ```ts
 * import { RuntimeFixtureInput, runRuntimeFixture } from "@beep/agents-use-cases/proof"
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
 *   console.log(outputSet.scenarioId)
 * )
 * ```
 *
 * @effects Runs only deterministic in-memory fixture generation; no network,
 * storage, or model services are required. Fails with
 * {@link ProfessionalRuntimeValidationError} for unknown scenarios, mismatched
 * scenario ids, or missing source-span markers.
 * @category testing
 * @since 0.0.0
 */
export const runRuntimeFixture = Effect.fn("RuntimeFixture.run")((input: RuntimeFixtureInput) =>
  Effect.try({
    try: () => {
      assertScenario(input);

      return fixtureRunnerForScenario(input.email.scenarioId)(input);
    },
    catch: (error) =>
      ProfessionalRuntimeValidationError.is(error)
        ? error
        : ProfessionalRuntimeValidationError.make({ message: String(error) }),
  })
);
