/**
 * ACP terminal handle helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type * as Effect from "effect/Effect";
import type * as AcpSchema from "./_generated/schema.gen.ts";
import type * as AcpError from "./Acp.errors.ts";

/**
 * Handle for a terminal created through ACP.
 *
 * **Example** (Access terminal ID)
 *
 * ```ts
 * import type { AcpTerminal } from "@beep/acp/terminal"
 *
 * const terminalIdOf = (terminal: AcpTerminal) => terminal.terminalId
 * console.log(terminalIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface AcpTerminal {
  /** Terminates the terminal process.
   * Spec: https://agentclientprotocol.com/protocol/schema#terminal/kill
   */
  readonly kill: Effect.Effect<AcpSchema.KillTerminalResponse, AcpError.AcpError>;
  /** Reads buffered output from the terminal.
   * Spec: https://agentclientprotocol.com/protocol/schema#terminal/output
   */
  readonly output: Effect.Effect<AcpSchema.TerminalOutputResponse, AcpError.AcpError>;
  /** Releases the terminal handle from the ACP session.
   * Spec: https://agentclientprotocol.com/protocol/schema#terminal/release
   */
  readonly release: Effect.Effect<AcpSchema.ReleaseTerminalResponse, AcpError.AcpError>;
  readonly sessionId: string;
  readonly terminalId: string;
  /** Waits for terminal exit and returns the exit result.
   * Spec: https://agentclientprotocol.com/protocol/schema#terminal/wait_for_exit
   */
  readonly waitForExit: Effect.Effect<AcpSchema.WaitForTerminalExitResponse, AcpError.AcpError>;
}

/**
 * Options used to construct an ACP terminal handle.
 *
 * **Example** (Read session ID option)
 *
 * ```ts
 * import type { MakeTerminalOptions } from "@beep/acp/terminal"
 *
 * const sessionIdOf = (options: MakeTerminalOptions) => options.sessionId
 * console.log(sessionIdOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface MakeTerminalOptions {
  readonly kill: Effect.Effect<AcpSchema.KillTerminalResponse, AcpError.AcpError>;
  readonly output: Effect.Effect<AcpSchema.TerminalOutputResponse, AcpError.AcpError>;
  readonly release: Effect.Effect<AcpSchema.ReleaseTerminalResponse, AcpError.AcpError>;
  readonly sessionId: string;
  readonly terminalId: string;
  readonly waitForExit: Effect.Effect<AcpSchema.WaitForTerminalExitResponse, AcpError.AcpError>;
}

/**
 * Constructs an ACP terminal helper from terminal request effects.
 *
 * **Example** (Build terminal from options)
 *
 * ```ts
 * import { makeTerminal, type MakeTerminalOptions } from "@beep/acp/terminal"
 *
 * const fromOptions = (options: MakeTerminalOptions) => makeTerminal(options)
 * console.log(fromOptions)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function makeTerminal(options: MakeTerminalOptions): AcpTerminal {
  return {
    sessionId: options.sessionId,
    terminalId: options.terminalId,
    output: options.output,
    waitForExit: options.waitForExit,
    kill: options.kill,
    release: options.release,
  };
}
