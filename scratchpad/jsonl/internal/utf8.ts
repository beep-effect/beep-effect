/**
 * UTF-8 byte accounting.
 *
 * A zero-dependency leaf so that both the line splitter and the error taxonomy
 * can measure bytes without either importing the other — the same cycle
 * firewall the other pure-tier packages use.
 *
 * @internal
 */

/**
 * The UTF-8 byte length of a JavaScript string.
 *
 * Journal offsets are **bytes**, because that is what `FileSystem.stream`'s
 * `offset` option and every persisted cursor mean. `String.length` counts
 * UTF-16 code units and is wrong for every non-ASCII journal: `"\u{1F600}"` has
 * length 2 and occupies 4 bytes.
 *
 * Matches `TextEncoder#encode(...).length` exactly, including the WHATWG rule
 * that an unpaired surrogate encodes as U+FFFD (3 bytes), but without
 * allocating a buffer per call.
 *
 * @internal
 */
export const utf8Length = (text: string): number => {
	let bytes = 0;
	for (let index = 0; index < text.length; index++) {
		const code = text.charCodeAt(index);
		if (code < 0x80) {
			bytes += 1;
		} else if (code < 0x800) {
			bytes += 2;
		} else if (code >= 0xd800 && code <= 0xdbff) {
			// High surrogate: a valid pair is one 4-byte code point; an unpaired
			// one is replaced with U+FFFD, which is 3 bytes.
			const next = index + 1 < text.length ? text.charCodeAt(index + 1) : 0;
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4;
				index++;
			} else {
				bytes += 3;
			}
		} else {
			// Low surrogates reaching here are unpaired, and encode as U+FFFD too.
			bytes += 3;
		}
	}
	return bytes;
};
