/**
 * Deterministic fixture SDK facade for the Agentic Professional Runtime proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { SchemaUtils } from "@beep/schema";
import { PromotionGateRequest, PromotionGateVerdict, PromotionTenantRef } from "@beep/shared-use-cases/PromotionGate";
import { A } from "@beep/utils";
import { Effect, flow, HashMap, HashSet } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { RuntimeScope } from "./ProfessionalRuntime.contracts.ts";
import {
  ProfessionalRuntimePromotionBlocked,
  ProfessionalRuntimeValidationError,
} from "./ProfessionalRuntime.errors.ts";
import { runRuntimeFixture } from "./ProfessionalRuntime.fixtures.ts";
import type { PromotionGateShape } from "@beep/shared-use-cases/server";
import type { ProposeCandidateOutputSet } from "./ProfessionalRuntime.commands.ts";
import type { CandidateOutputSet, RuntimeEvidenceRef, SdkContextPacket } from "./ProfessionalRuntime.contracts.ts";
import type { RuntimeFixtureInput } from "./ProfessionalRuntime.fixtures.ts";
import type { GetContextPacket } from "./ProfessionalRuntime.queries.ts";
import type { ProfessionalRuntimeSdk } from "./ProfessionalRuntime.service.ts";
import type { RuntimeFixtureScenarioId } from "./ProfessionalRuntime.values.ts";

const ensure = (condition: boolean, message: string): Effect.Effect<void, ProfessionalRuntimeValidationError> =>
  condition ? Effect.void : ProfessionalRuntimeValidationError.failEffect(message);

const fixtureForScenario = (
  fixtures: ReadonlyArray<RuntimeFixtureInput>,
  scenarioId: RuntimeFixtureScenarioId
): Effect.Effect<RuntimeFixtureInput, ProfessionalRuntimeValidationError> =>
  O.match(
    A.findFirst(fixtures, (fixture) => fixture.email.scenarioId === scenarioId),
    {
      onNone: ProfessionalRuntimeValidationError.failEffectThunk(`Unknown runtime fixture scenario: ${scenarioId}`),
      onSome: Effect.succeed,
    }
  );

const outputForScenario = flow(fixtureForScenario, Effect.flatMap(runRuntimeFixture));

const sameScope = SchemaUtils.toEquivalence(RuntimeScope);

const sameOrderedStrings = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && A.every(left, (value, index) => value === right[index]);

// TODO(effect-native-migration): model schema
const toPlainJson = (value: unknown): string => S.encodeUnknownSync(S.fromJsonString(S.Unknown))(value);

const spanIdsFromEvidence = (evidence: RuntimeEvidenceRef): ReadonlyArray<string> => [
  ...O.toArray(evidence.spanId),
  ...O.getOrElse(evidence.spanIds, A.empty<string>),
];

const collectEvidence = (outputSet: CandidateOutputSet): ReadonlyArray<RuntimeEvidenceRef> => [
  ...A.flatMap(outputSet.claims, (claim) => claim.evidence),
  ...outputSet.candidateProject.evidence,
  ...A.flatMap(outputSet.tasks, (task) => task.evidence),
  ...A.flatMap(outputSet.drafts, (draft) => draft.evidence),
  ...A.flatMap(outputSet.approvalGates, (gate) => gate.evidence),
];

const collectCandidateIds = (outputSet: CandidateOutputSet): HashSet.HashSet<string> =>
  HashSet.fromIterable([
    ...A.map(outputSet.claims, (claim) => claim.claimId),
    ...A.map(outputSet.tasks, (task) => task.taskId),
    ...A.map(outputSet.drafts, (draft) => draft.draftId),
  ]);

const collectSourceArtifactSpans = (packet: SdkContextPacket): HashMap.HashMap<string, HashSet.HashSet<string>> =>
  HashMap.fromIterable(
    A.map(packet.sourceArtifacts, (artifact) => [
      artifact.artifactId,
      HashSet.fromIterable(A.map(artifact.spanRefs, (spanRef) => spanRef.spanId)),
    ])
  );

const when = (condition: boolean, issue: string): ReadonlyArray<string> => (condition ? [issue] : []);

const collectEvidenceIssue = (
  sourceArtifactSpans: HashMap.HashMap<string, HashSet.HashSet<string>>,
  evidence: RuntimeEvidenceRef
): ReadonlyArray<string> => {
  const spanIds = spanIdsFromEvidence(evidence);
  const knownSpans = HashMap.get(sourceArtifactSpans, evidence.artifactId);

  if (spanIds.length === 0) {
    return [`evidence for ${evidence.artifactId} does not reference any spans`];
  }

  if (O.isNone(knownSpans)) {
    return [`evidence references unknown artifact ${evidence.artifactId}`];
  }

  return A.map(
    A.filter(spanIds, (spanId) => !HashSet.has(knownSpans.value, spanId)),
    (spanId) => `evidence references unknown span ${evidence.artifactId}#${spanId}`
  );
};

const collectEvidenceIssues = (
  outputSet: CandidateOutputSet,
  sourceArtifactSpans: HashMap.HashMap<string, HashSet.HashSet<string>>
): ReadonlyArray<string> =>
  A.flatMap(collectEvidence(outputSet), (evidence) => collectEvidenceIssue(sourceArtifactSpans, evidence));

const collectApprovalGateIssues =
  (principalIds: HashSet.HashSet<string>, candidateIds: HashSet.HashSet<string>) =>
  (gate: CandidateOutputSet["approvalGates"][number]): ReadonlyArray<string> => [
    ...when(
      !HashSet.has(principalIds, gate.reviewerPrincipalId),
      `${gate.approvalGateId} reviewer ${gate.reviewerPrincipalId} is missing from context packet principals`
    ),
    ...A.map(
      A.filter(gate.candidateRefs, (candidateRef) => !HashSet.has(candidateIds, candidateRef)),
      (candidateRef) => `${gate.approvalGateId} references unknown candidate ${candidateRef}`
    ),
  ];

const collectOutputIssues = (outputSet: CandidateOutputSet, producedByPrincipalId: string): ReadonlyArray<string> => {
  const principalIds = HashSet.fromIterable(outputSet.contextPacket.principals);
  const sourceArtifactSpans = collectSourceArtifactSpans(outputSet.contextPacket);
  const candidateIds = collectCandidateIds(outputSet);
  const claimIds = A.map(outputSet.claims, (claim) => claim.claimId);
  const taskIds = A.map(outputSet.tasks, (task) => task.taskId);
  const draftIds = A.map(outputSet.drafts, (draft) => draft.draftId);
  const gateIds = A.map(outputSet.approvalGates, (gate) => gate.approvalGateId);

  return [
    ...when(
      outputSet.contextPacket.scenarioId !== outputSet.scenarioId,
      `context packet scenario ${outputSet.contextPacket.scenarioId} does not match ${outputSet.scenarioId}`
    ),
    ...when(
      outputSet.contextPacket.request.artifactId !== outputSet.contextPacket.sourceArtifacts[0]?.artifactId,
      "context packet request artifact is not declared as a source artifact"
    ),
    ...when(
      !HashSet.has(principalIds, producedByPrincipalId),
      `producing principal ${producedByPrincipalId} is missing from context packet principals`
    ),
    ...A.map(
      A.filter(outputSet.claims, (claim) => claim.producedByPrincipalId !== producedByPrincipalId),
      (claim) => `${claim.claimId} was produced by ${claim.producedByPrincipalId}, not ${producedByPrincipalId}`
    ),
    ...A.map(
      A.filter(outputSet.drafts, (draft) => draft.producedByPrincipalId !== producedByPrincipalId),
      (draft) => `${draft.draftId} was produced by ${draft.producedByPrincipalId}, not ${producedByPrincipalId}`
    ),
    ...A.map(
      A.filter(outputSet.tasks, (task) => !HashSet.has(principalIds, task.assigneePrincipalId)),
      (task) => `${task.taskId} assignee ${task.assigneePrincipalId} is missing from context packet principals`
    ),
    ...A.flatMap(outputSet.approvalGates, collectApprovalGateIssues(principalIds, candidateIds)),
    ...A.map(
      A.filter(outputSet.contextPacket.activities, (activity) => !HashSet.has(principalIds, activity.principalId)),
      (activity) => `${activity.activityId} principal ${activity.principalId} is missing from context packet principals`
    ),
    ...when(
      !sameOrderedStrings(outputSet.contextPacket.candidateClaims, claimIds),
      "context packet candidate claim refs do not match claims"
    ),
    ...when(
      !sameOrderedStrings(outputSet.contextPacket.candidateTasks, taskIds),
      "context packet candidate task refs do not match tasks"
    ),
    ...when(
      !sameOrderedStrings(outputSet.contextPacket.candidateDrafts, draftIds),
      "context packet candidate draft refs do not match drafts"
    ),
    ...when(
      !sameOrderedStrings(outputSet.contextPacket.approvalGates, gateIds),
      "context packet approval gate refs do not match approval gates"
    ),
    ...collectEvidenceIssues(outputSet, sourceArtifactSpans),
  ];
};

const validateOutputSet = (
  outputSet: CandidateOutputSet,
  producedByPrincipalId: string
): Effect.Effect<void, ProfessionalRuntimeValidationError> => {
  const issues = collectOutputIssues(outputSet, producedByPrincipalId);

  return issues.length === 0
    ? Effect.void
    : ProfessionalRuntimeValidationError.failEffect(`${outputSet.scenarioId}: ${A.join(issues, "; ")}`);
};

const requirePromotionClear = Effect.fn("agents.professional_runtime.require_promotion_clear")(function* (
  gate: PromotionGateShape,
  command: ProposeCandidateOutputSet,
  promotionSubjects: RuntimeFixtureInput["promotionSubjects"]
) {
  const evaluateSubjects = Effect.forEach(
    promotionSubjects,
    (subject) =>
      gate
        .evaluate(
          PromotionGateRequest.make({
            subject,
            tenantRef: PromotionTenantRef.make(command.scope.organizationId),
          })
        )
        .pipe(
          Effect.flatMap((verdict) =>
            PromotionGateVerdict.match(verdict, {
              blocked: ({ reason }) =>
                Effect.annotateCurrentSpan({ "agents.professional_runtime.promotion_outcome": "blocked" }).pipe(
                  Effect.andThen(ProfessionalRuntimePromotionBlocked.failEffect(subject, reason))
                ),
              clear: () => Effect.void,
            })
          )
        ),
    { discard: true }
  );

  // The first pass establishes policy clearance before acceptance work. The
  // second pass is the acceptance-time revision check: vertical gates must
  // re-read their authority, so a citation appended during the first pass is
  // visible before this function returns an accepted candidate.
  yield* evaluateSubjects;
  yield* evaluateSubjects;

  yield* Effect.annotateCurrentSpan({ "agents.professional_runtime.promotion_outcome": "clear" });
});

/**
 * Create an in-memory SDK facade over deterministic runtime fixture inputs.
 *
 * **Details**
 *
 * The facade looks up fixtures by scenario id, validates requested scope and
 * artifact ids, and only accepts proposed output sets that exactly match the
 * deterministic fixture output.
 *
 * **Example** (In-memory SDK fixture lookup)
 *
 * ```ts
 * import {
 *   RuntimeFixtureInput,
 *   makeInMemoryProfessionalRuntimeSdk
 * } from "@beep/agents-use-cases/proof"
 * import { GetContextPacket, RuntimeScope } from "@beep/agents-use-cases/public"
 * import { PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate"
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
 * const sdk = makeInMemoryProfessionalRuntimeSdk({
 *   fixtures: [fixture],
 *   promotionGate: { evaluate: () => Effect.succeed(PromotionGateVerdict.cases.clear.make({})) }
 * })
 * const program = sdk.getContextPacket(
 *   GetContextPacket.make({
 *     artifactId: "email-artifact-law-001",
 *     scenarioId: "law-patent-intake",
 *     scope: RuntimeScope.make({
 *       organizationId: "org-law-fixture",
 *       threadId: "thread-law-001",
 *       workspaceId: "workspace-law-fixture"
 *     })
 *   })
 * )
 *
 * Effect.runPromise(program).then((packet) =>
 *   console.log(packet.request.artifactId)
 * )
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeInMemoryProfessionalRuntimeSdk = (options: {
  readonly fixtures: ReadonlyArray<RuntimeFixtureInput>;
  readonly promotionGate: PromotionGateShape;
}): ProfessionalRuntimeSdk => ({
  getContextPacket: Effect.fn("ProfessionalRuntimeSdk.getContextPacket")(function* (query: GetContextPacket) {
    const outputSet = yield* outputForScenario(options.fixtures, query.scenarioId);

    yield* ensure(
      outputSet.contextPacket.request.artifactId === query.artifactId,
      `${query.scenarioId}: context packet artifact ${outputSet.contextPacket.request.artifactId} does not match ${query.artifactId}`
    );
    yield* ensure(
      sameScope(outputSet.contextPacket.scope, query.scope),
      `${query.scenarioId}: context packet scope does not match query scope`
    );

    return outputSet.contextPacket;
  }),
  proposeCandidateOutputSet: Effect.fn("ProfessionalRuntimeSdk.proposeCandidateOutputSet")(function* (
    command: ProposeCandidateOutputSet
  ) {
    const fixture = yield* fixtureForScenario(options.fixtures, command.outputSet.scenarioId);
    const generatedOutputSet = yield* runRuntimeFixture(fixture);

    yield* ensure(
      sameScope(command.outputSet.contextPacket.scope, command.scope),
      `${command.outputSet.scenarioId}: proposed output scope does not match command scope`
    );
    yield* validateOutputSet(command.outputSet, command.producedByPrincipalId);
    yield* ensure(
      toPlainJson(command.outputSet) === toPlainJson(generatedOutputSet),
      `${command.outputSet.scenarioId}: proposed output set does not match deterministic fixture output`
    );
    yield* requirePromotionClear(options.promotionGate, command, fixture.promotionSubjects);
    yield* Effect.annotateCurrentSpan({ "agents.professional_runtime.outcome": "accepted" });

    return command.outputSet;
  }),
});
