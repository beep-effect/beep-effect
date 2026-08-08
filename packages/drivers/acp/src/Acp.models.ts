/**
 * ACP generated wire schemas and method metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Generated ACP method metadata.
 *
 * **Example** (Log agent methods and version)
 *
 * ```ts
 * import { AGENT_METHODS, PROTOCOL_VERSION } from "@beep/acp/schema"
 *
 * console.log(AGENT_METHODS.initialize, PROTOCOL_VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./_generated/meta.gen.ts";
/**
 * Generated ACP wire schemas.
 *
 * **Example** (Make InitializeRequest with capabilities)
 *
 * ```ts
 * import { InitializeRequest } from "@beep/acp/schema"
 *
 * const request = InitializeRequest.make({
 *   clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
 *   clientInfo: { name: "beep", version: "0.0.0" },
 *   protocolVersion: 1
 * })
 * console.log(request.protocolVersion)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./_generated/schema.gen.ts";
