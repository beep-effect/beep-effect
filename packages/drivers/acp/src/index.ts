/**
 * Product-neutral Effect driver for the Agent Client Protocol.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
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
 * Generated ACP generation-2 schema and method metadata exports.
 *
 * **Example** (Log both protocol versions)
 *
 * ```ts
 * import { Schema } from "@beep/acp"
 *
 * console.log(Schema.PROTOCOL_VERSION, Schema.V1_PROTOCOL_VERSION)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as Schema from "./Acp.models.ts";
/**
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
 * **Example** (Check a protocol generation choice)
 *
 * ```ts
 * import { Client } from "@beep/acp"
 *
 * console.log(Client.AcpClientProtocolGeneration.is.negotiate("negotiate")) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as Client from "./AcpClient.service.ts";
/**
 * **Example** (Read the default live-terminal bound)
 *
 * ```ts
 * import { Terminals } from "@beep/acp"
 *
 * console.log(Terminals.AcpClientTerminalLimits.make({}).maxLiveTerminals) // 16
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as Terminals from "./AcpClientTerminals.service.ts";
/**
 * Normalized ACP compatibility exports shared by protocol generations 1 and 2.
 *
 * **Example** (Read the unknown-variant sentinel)
 *
 * ```ts
 * import { Compat } from "@beep/acp"
 *
 * console.log(Compat.ACP_UNKNOWN) // "_acp_unknown"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as Compat from "./AcpCompat.models.ts";
/**
 * **Example** (Read a JSON text with an escaped key)
 *
 * ```ts
 * import { Json } from "@beep/acp"
 * import * as Result from "effect/Result"
 *
 * console.log(Result.isSuccess(Json.readJsonText('{"\\n":true}')))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export * as Json from "./AcpJson.codec.ts";
/**
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
 * Bounded, redacted stderr tails for ACP peer processes.
 *
 * **Example** (Redact a home directory)
 *
 * ```ts
 * import { Stderr } from "@beep/acp"
 *
 * console.log(Stderr.sanitizeStderrExcerpt("/home/ada/.agent/log", ["/home/ada"])) // ~/.agent/log
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * as Stderr from "./AcpStderr.models.ts";
/**
 * Generated ACP generation-1 schema exports.
 *
 * **Example** (Check a generation-1 command input)
 *
 * ```ts
 * import { SchemaV1 } from "@beep/acp"
 * import * as S from "effect/Schema"
 *
 * const isCommand = S.is(SchemaV1.AvailableCommand)
 * console.log(isCommand({ name: "plan", description: "Make a plan", input: { hint: "Task" } }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * as SchemaV1 from "./AcpV1.models.ts";
