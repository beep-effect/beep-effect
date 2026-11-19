/**
 * Terminal escape sequences a tool writes into its messages, diffs and
 * output streams, and the one pattern that removes them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Str from "effect/String";

// CSI (`ESC [` or the one-byte C1 form), OSC (`ESC ]` up to BEL or ST), the two-byte escapes, and
// `ESC c`, the full reset a test runner writes when it clears the screen.
const ESCAPES = /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[@-Z\\-_c]/gu;

/**
 * Remove every terminal escape sequence from a text, leaving what it styled.
 *
 * **Details**
 *
 * Removes CSI sequences (colours, cursor moves, screen clears) in both the
 * `ESC [` and the one-byte C1 form, OSC sequences such as hyperlinks and
 * window titles, the two-byte escapes, and the `ESC c` full reset. Other
 * control characters stay.
 *
 * **Example** (Strip a coloured word)
 *
 * ```ts
 * import { stripEscapes } from "@beep/gate-report/Escapes";
 *
 * console.log(stripEscapes("\u001b[31mred\u001b[39m")); // red
 * ```
 *
 * @param text - Text that may carry terminal escape sequences.
 * @returns The text with every escape sequence removed.
 * @category utilities
 * @since 0.0.0
 */
export const stripEscapes: (text: string) => string = Str.replace(ESCAPES, "");
