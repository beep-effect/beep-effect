// The runner-file heredoc protocol — `GITHUB_OUTPUT`, `GITHUB_ENV` and
// `GITHUB_STATE` all take `name<<DELIM\nvalue\nDELIM\n` — spelled once for
// `ActionOutputs` and `ActionState`.
//
// **Delimiters are derived, never random.** GitHub's own toolkit uses a
// random UUID here and accepts the (tiny) chance of collision. Deriving the
// delimiter instead makes collision **impossible** rather than improbable,
// needs no randomness — so no `Crypto` in `R` and no unreproducible output —
// and is trivially testable. A value that contains a delimiter would
// terminate its block early and corrupt every entry after it, which is a
// value-controlled injection into the runner's own file.

/** The base delimiter for a heredoc block. */
const BASE_DELIMITER = "EFFECTED_EOF";

/** A delimiter guaranteed absent from `value`. @internal */
export const delimiterFor = (value: string): string => {
	let longestRun = -1;
	let occurrence = value.indexOf(BASE_DELIMITER);
	while (occurrence >= 0) {
		const runStart = occurrence + BASE_DELIMITER.length;
		let runEnd = runStart;
		while (value[runEnd] === "_") {
			runEnd++;
		}
		const runLength = runEnd - runStart;
		if (runLength > longestRun) {
			longestRun = runLength;
		}
		// No base delimiter can begin inside the underscore run just scanned.
		occurrence = value.indexOf(BASE_DELIMITER, runEnd);
	}
	return longestRun < 0 ? BASE_DELIMITER : `${BASE_DELIMITER}${"_".repeat(longestRun + 1)}`;
};

/**
 * Whether `name` can head a block without breaking the structure it lives
 * in: non-empty, free of the line breaks that would end it early, and free
 * of the separators the runner's file-command parser would re-split the
 * line on.
 *
 * @remarks
 * The runner (`FileCommandManager`) locates the first `=` and the first
 * `<<` on each line and whichever comes first decides the shape: a
 * `key=value` property assignment, or a `name<<delimiter` heredoc block.
 * Because a block line is always `name<<DELIMITER`, an `=` anywhere in the
 * name precedes the marker and the line parses as a property assignment cut
 * at that `=`, leaving every line of the block to be read as stray entries;
 * a `<<` inside the name splits there instead and yields a delimiter the
 * terminating line can never match. Either way the entries after the
 * malformed block are corrupted, so both separators are refused. A name
 * ending in a single `<` corrupts the block the same way: the composed
 * header `name<<<DELIMITER` matches the runner's first `<<` one character
 * early, so the delimiter it waits for is `<DELIMITER` and the terminating
 * line never matches — the whole file is lost. An interior `<` is safe
 * (`a<b` still composes a header that splits exactly at the marker), so
 * only the trailing position is refused.
 *
 * @internal
 */
export const isUsableName = (name: string): boolean =>
	name !== "" && /[\r\n=]|<<|<$/.test(name) === false;

/**
 * One heredoc block, ready to append. The caller has checked the name with
 * {@link isUsableName}.
 *
 * @internal
 */
export const heredocBlock = ({ name, value }: { readonly name: string; readonly value: string }): string => {
	const delimiter = delimiterFor(value);
	return `${name}<<${delimiter}\n${value}\n${delimiter}\n`;
};
