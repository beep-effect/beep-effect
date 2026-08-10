/**
 * Package entry point for `@beep/agents-client`.
 *
 * @packageDocumentation
 * @category clients
 * @since 0.0.0
 */

/**
 * Desktop chat surface atoms backed by the `ChatRpcs` wire contract.
 *
 * **Example** (Serializable threads atoms)
 *
 * ```ts
 * import { threadsAtoms } from "@beep/agents-client"
 * import * as Workspace from "@beep/shared-domain/identity/Workspace"
 * import * as S from "effect/Schema"
 * import { Atom } from "effect/unstable/reactivity"
 *
 * const workspaceId = S.decodeUnknownSync(Workspace.WorkspaceId)(1)
 *
 * console.log(Atom.isSerializable(threadsAtoms(workspaceId))) // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export * from "./Chat.atoms.ts";
/**
 * Resolve the default browser or desktop-sidecar chat RPC endpoint.
 *
 * @category utilities
 * @since 0.0.0
 */
export { resolveChatRpcHttpUrl } from "./Chat.layer.ts";
/**
 * Env-gated client-side OTLP observability layer wired into the atom runtime so
 * the webview's rpc calls carry span context (joined traces).
 *
 * **Example** (Verify observability layer)
 *
 * ```ts
 * import { ClientObservabilityLive } from "@beep/agents-client"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ClientObservabilityLive)) // true
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export * from "./ClientObservability.ts";
/**
 * Reactive provider-instance list and lifecycle mutations.
 *
 * **Example** (Log provider instances atom)
 *
 * ```ts
 * import { providerInstancesAtom } from "@beep/agents-client"
 *
 * console.log(providerInstancesAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export * from "./ProviderInstance.atoms.ts";
/**
 * Provider-instance RPC transport and atom client wiring.
 *
 * **Example** (Log provider instance client)
 *
 * ```ts
 * import { ProviderInstanceClient } from "@beep/agents-client"
 *
 * console.log(ProviderInstanceClient)
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export * from "./ProviderInstance.service.ts";
