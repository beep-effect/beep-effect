/**
 * Deterministic Professional Runtime proof helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Deterministic fixture assistant-turn kernel Layer and its pure block helper.
 *
 * **Example** (Fixture blocks for turns)
 *
 * ```ts
 * import { fixtureBlocksFor } from "@beep/agents-use-cases/proof"
 *
 * const blocks = fixtureBlocksFor([{ role: "user", text: "hello" }])
 * console.log(blocks.length) // 4
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export {
  FixtureTurnKernel,
  fixtureBlocksFor,
  fixtureEventsFor,
  fixtureProviderUsage,
} from "./processes/AssistantTurn/AssistantTurn.fixture.ts";
/**
 * In-memory runtime SDK facade backed by deterministic proof fixtures.
 *
 * **Example** (In-memory runtime SDK facade)
 *
 * ```ts
 * import { makeInMemoryProfessionalRuntimeSdk } from "@beep/agents-use-cases/proof"
 *
 * const sdk = makeInMemoryProfessionalRuntimeSdk([])
 * console.log(typeof sdk.getContextPacket) // "function"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export { makeInMemoryProfessionalRuntimeSdk } from "./processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts";
/**
 * Runtime fixture schema and deterministic runner used by proof harnesses.
 *
 * **Example** (Run deterministic runtime fixture)
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
 * @category fixtures
 * @since 0.0.0
 */
export {
  RuntimeFixtureInput,
  runRuntimeFixture,
} from "./processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts";
/**
 * Public runtime SDK contracts reused by proof helpers.
 *
 * **Example** (Make runtime scope contract)
 *
 * ```ts
 * import { RuntimeScope } from "@beep/agents-use-cases/proof"
 *
 * const scope = RuntimeScope.make({
 *   organizationId: "org-1",
 *   threadId: "thread-1",
 *   workspaceId: "workspace-1"
 * })
 * console.log(scope.organizationId)
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./public.ts";
