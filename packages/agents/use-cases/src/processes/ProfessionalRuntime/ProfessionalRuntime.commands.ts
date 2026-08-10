/**
 * SDK commands for the Agentic Professional Runtime proof.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentsUseCasesId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CandidateOutputSet, RuntimeScope } from "./ProfessionalRuntime.contracts.ts";

const $I = $AgentsUseCasesId.create("processes/ProfessionalRuntime/ProfessionalRuntime.commands");

/**
 * Command for proposing candidate work through the SDK facade.
 *
 * **Example** (Propose from runtime fixture)
 *
 * ```ts
 * import { RuntimeFixtureInput, runRuntimeFixture } from "@beep/agents-use-cases/proof"
 * import { ProposeCandidateOutputSet, RuntimeScope } from "@beep/agents-use-cases/public"
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
 *   seed: {
 *     organization: { organizationId: "org-law-fixture" },
 *     scenarioId: "law-patent-intake",
 *     workspace: { workspaceId: "workspace-law-fixture" }
 *   }
 * })
 *
 * const program = Effect.map(runRuntimeFixture(fixture), (outputSet) =>
 *   ProposeCandidateOutputSet.make({
 *     outputSet,
 *     producedByPrincipalId: "principal-agent-runtime-fixture",
 *     scope: RuntimeScope.make({
 *       organizationId: "org-law-fixture",
 *       threadId: "thread-law-001",
 *       workspaceId: "workspace-law-fixture"
 *     })
 *   })
 * )
 *
 * Effect.runPromise(program).then((command) =>
 *   console.log(command.outputSet.scenarioId)
 * )
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ProposeCandidateOutputSet extends S.Class<ProposeCandidateOutputSet>($I`ProposeCandidateOutputSet`)(
  {
    outputSet: CandidateOutputSet.annotateKey({ description: "Candidate output set proposed through the SDK." }),
    producedByPrincipalId: S.NonEmptyString.annotateKey({
      description: "Principal identifier for the runtime producer proposing the output set.",
    }),
    scope: RuntimeScope.annotateKey({ description: "Runtime scope for the proposal command." }),
  },
  $I.annote("ProposeCandidateOutputSet", {
    description: "Command proposing a candidate output set with producing-principal provenance.",
  })
) {}
