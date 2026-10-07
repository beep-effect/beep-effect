/**
 * UTF-8 byte counts for JSONL string records.
 * @packageDocumentation
 * @since 0.0.0
 */
const encoder = new TextEncoder();

// UTF-8 byte accounting.
//
// Keep the WHATWG codec in this leaf so byte accounting has one runtime owner.

/**
 * The UTF-8 byte length of a JavaScript string.
 *
 * **Details**
 *
 * Journal offsets are **bytes**, because that is what `FileSystem.stream`'s
 * `offset` option and every persisted cursor mean. `String.length` counts
 * UTF-16 code units and is wrong for every non-ASCII journal: `"\u{1F600}"` has
 * length 2 and occupies 4 bytes.
 *
 * Matches `TextEncoder#encode(...).length` exactly, including the WHATWG rule
 * that an unpaired surrogate encodes as U+FFFD (3 bytes), using the runtime codec
 * rather than allocating an Option for every UTF-16 code unit.
 *
 * **Example** (Measure an astral character)
 *
 * ```ts import.meta.vitest name="Measure an astral character"
 * import { utf8Length } from "@beep/scratchpad/effected/jsonl/internal/utf8";
 * utf8Length("😀") // => 4
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const utf8Length = (text: string): number => encoder.encode(text).length;
