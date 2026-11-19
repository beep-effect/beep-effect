/**
 * Terminal escape sequences a tool writes into its messages and diffs.
 *
 * @since 0.0.0
 */
import * as Str from "effect/String";

// CSI (`ESC [` or the one-byte C1 form), OSC (`ESC ]` up to BEL or ST), escapes with intermediate
// bytes (`ESC ( B`, a character-set designation) and the two-byte escapes (`ESC 7`, `ESC c`, ...).
const ESCAPES =
  /(?:\u001b\[|\u009b)[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)|\u001b[ -/]+[0-~]|\u001b[0-~]/gu;

/**
 * Remove every terminal escape sequence from a text, leaving what it styled.
 *
 * @since 0.0.0
 */
export const stripEscapes: (text: string) => string = Str.replace(ESCAPES, "");
