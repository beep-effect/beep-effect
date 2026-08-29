/**
 * Lexical commands the {@link ChatComposer} dispatches so consumers can wire
 * send/stop without the foundation knowing about turns, drafts, or transport.
 *
 * The send button click and the Enter-to-send key handler both dispatch
 * {@link SEND_MESSAGE_COMMAND}. A consumer handles it either by passing an
 * `onSend` prop (the composer registers a low-priority handler) or by
 * registering its own higher-priority handler from a child plugin (e.g. an
 * Effect-Atom binding that reads the editor state directly). An unhandled
 * command is a no-op, so the composer is safe to use without a handler.
 *
 * @packageDocumentation \@beep/editor/chat/commands
 * @since 0.0.0
 */

import { createCommand } from "lexical";
import type { LexicalCommand } from "lexical";

/**
 * Dispatched when the user requests to send the current message (Enter, per the
 * configured `sendOn`, or the send button).
 *
 * **Example** (Dispatch send message command)
 *
 * ```ts
 * import { SEND_MESSAGE_COMMAND } from "@beep/editor/chat/commands"
 * import type { LexicalEditor } from "lexical"
 *
 * const sendCurrentMessage = (editor: LexicalEditor) =>
 *   editor.dispatchCommand(SEND_MESSAGE_COMMAND, undefined)
 *
 * console.log(SEND_MESSAGE_COMMAND.type) // "SEND_MESSAGE_COMMAND"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const SEND_MESSAGE_COMMAND: LexicalCommand<void> = createCommand("SEND_MESSAGE_COMMAND");

/**
 * Dispatched when the user requests to stop an in-flight (streaming) turn via
 * the composer's stop button.
 *
 * **Example** (Dispatch stop message command)
 *
 * ```ts
 * import { STOP_MESSAGE_COMMAND } from "@beep/editor/chat/commands"
 * import type { LexicalEditor } from "lexical"
 *
 * const stopCurrentTurn = (editor: LexicalEditor) =>
 *   editor.dispatchCommand(STOP_MESSAGE_COMMAND, undefined)
 *
 * console.log(STOP_MESSAGE_COMMAND.type) // "STOP_MESSAGE_COMMAND"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const STOP_MESSAGE_COMMAND: LexicalCommand<void> = createCommand("STOP_MESSAGE_COMMAND");
