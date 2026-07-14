/**
 * Client-safe runtime SDK contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Provider-instance commands, queries, actionable errors, and RPC contracts.
 *
 * @example
 * ```ts
 * import { ProviderInstanceRpcs } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.has("ListProviderInstances")) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./entities/ProviderInstance/index.js";
/**
 * Assistant-turn generation kernel contracts, errors, and port tag.
 *
 * @example
 * ```ts
 * import { TurnHistoryItem } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const item = S.decodeUnknownSync(TurnHistoryItem)({ role: "assistant", text: "Done." })
 * console.log(item.role) // "assistant"
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./processes/AssistantTurn/index.js";
/**
 * Chat wire contract: rpc declarations, the `ChatRpcs` group, and the
 * client-safe `ChatActionError` carried on every chat request.
 *
 * @example
 * ```ts
 * import { ChatActionError, ChatRpcs } from "@beep/agents-use-cases/public"
 *
 * const error = ChatActionError.make({ message: "thread not found" })
 * console.log(ChatRpcs.requests.has("SendMessage"), error._tag) // true "ChatActionError"
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./processes/Chat/index.js";
/**
 * Candidate output command contracts accepted by the runtime SDK.
 *
 * @example
 * ```ts
 * import { ProposeCandidateOutputSet } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * const isCommand = S.is(ProposeCandidateOutputSet)
 * console.log(isCommand({ outputSet: {}, producedByPrincipalId: "agent", scope: {} })) // false
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export * from "./processes/ProfessionalRuntime/ProfessionalRuntime.commands.js";
/**
 * Client-safe runtime DTO and context packet contracts.
 *
 * @example
 * ```ts
 * import { RuntimeScope } from "@beep/agents-use-cases/public"
 *
 * const scope = RuntimeScope.make({
 *   organizationId: "org-1",
 *   threadId: "thread-1",
 *   workspaceId: "workspace-1"
 * })
 * console.log(scope.workspaceId)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * from "./processes/ProfessionalRuntime/ProfessionalRuntime.contracts.js";
/**
 * Client-safe runtime validation errors.
 *
 * @example
 * ```ts
 * import { ProfessionalRuntimeValidationError } from "@beep/agents-use-cases/public"
 *
 * console.log(ProfessionalRuntimeValidationError.make({ message: "invalid runtime proposal" }))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./processes/ProfessionalRuntime/ProfessionalRuntime.errors.js";
/**
 * Context packet query contracts accepted by the runtime SDK.
 *
 * @example
 * ```ts
 * import { GetContextPacket, RuntimeScope } from "@beep/agents-use-cases/public"
 *
 * const query = GetContextPacket.make({
 *   artifactId: "email-artifact-law-001",
 *   scenarioId: "law-patent-intake",
 *   scope: RuntimeScope.make({
 *     organizationId: "org-law-fixture",
 *     threadId: "thread-law-001",
 *     workspaceId: "workspace-law-fixture"
 *   })
 * })
 * console.log(query.scenarioId)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export * from "./processes/ProfessionalRuntime/ProfessionalRuntime.queries.js";
/**
 * Client-safe runtime literal vocabularies.
 *
 * @example
 * ```ts
 * import { RuntimeCandidateLifecycle } from "@beep/agents-use-cases/public"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RuntimeCandidateLifecycle)("candidate")) // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export * from "./processes/ProfessionalRuntime/ProfessionalRuntime.values.js";
/**
 * Client-safe SDK facade interface.
 *
 * @example
 * ```ts
 * import { makeInMemoryProfessionalRuntimeSdk } from "@beep/agents-use-cases/proof"
 * import type { ProfessionalRuntimeSdk } from "@beep/agents-use-cases/public"
 *
 * const sdk: ProfessionalRuntimeSdk = makeInMemoryProfessionalRuntimeSdk([])
 * console.log(typeof sdk.proposeCandidateOutputSet) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type { ProfessionalRuntimeSdk } from "./processes/ProfessionalRuntime/ProfessionalRuntime.service.js";
