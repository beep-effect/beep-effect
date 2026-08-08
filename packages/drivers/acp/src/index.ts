/**
 * Product-neutral Effect driver for the Agent Client Protocol.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * ACP driver error exports.
 *
 * **Example** (Create method not found error)
 *
 * ```ts
 * import { Errors } from "@beep/acp"
 *
 * const error = Errors.AcpRequestError.methodNotFound("x/test")
 * console.log(error.code)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * as Errors from "./Acp.errors.ts";
/**
 * Generated ACP schema exports.
 *
 * **Example** (Log schema protocol version)
 *
 * ```ts
 * import { Schema } from "@beep/acp"
 *
 * console.log(Schema.PROTOCOL_VERSION)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as Schema from "./Acp.models.ts";
/**
 * Agent-side ACP service exports.
 *
 * **Example** (Access agent service layer)
 *
 * ```ts
 * import { Agent } from "@beep/acp"
 *
 * const layer = Agent.layer
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as Agent from "./AcpAgent.service.ts";
/**
 * Client-side ACP service exports.
 *
 * **Example** (Access ACP client service)
 *
 * ```ts
 * import { Client } from "@beep/acp"
 *
 * const service = Client.AcpClient
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as Client from "./AcpClient.service.ts";
/**
 * ACP transport protocol exports.
 *
 * **Example** (Create patched ACP protocol)
 *
 * ```ts
 * import { Protocol } from "@beep/acp"
 *
 * const make = Protocol.makeAcpPatchedProtocol
 * console.log(make)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * as Protocol from "./AcpProtocol.service.ts";
/**
 * ACP RPC descriptor exports.
 *
 * **Example** (Access agent RPC group)
 *
 * ```ts
 * import { Rpc } from "@beep/acp"
 *
 * const group = Rpc.AgentRpcs
 * console.log(group)
 * ```
 *
 * @category protocols
 * @since 0.0.0
 */
export * as Rpc from "./AcpRpc.models.ts";
/**
 * ACP terminal handle exports.
 *
 * **Example** (Create terminal handle)
 *
 * ```ts
 * import { Terminal } from "@beep/acp"
 *
 * const make = Terminal.makeTerminal
 * console.log(make)
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export * as Terminal from "./AcpTerminal.models.ts";
