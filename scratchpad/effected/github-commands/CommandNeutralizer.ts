/** V2: after leading .NET whitespace, which is JavaScript's `\s` plus U+0085, the line starts with `::`. */
const V2 = /^[\s\u0085]*::/;

/** Legacy: `##[` anywhere. */
const LEGACY = /##\[/g;

/** The runner's line breaks: it splits at a lone CR as well as at LF and CRLF. */
const LINE_BREAK = /\r\n|\r|\n/;

/** U+200B, written by code point so the source carries no invisible character. */
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);

const neutralize = (line: string): string => {
	const legacy = line.replace(LEGACY, `##${ZERO_WIDTH_SPACE}[`);
	return V2.test(legacy) ? `${ZERO_WIDTH_SPACE}${legacy}` : legacy;
};

/**
 * Make text safe to write to a GitHub Actions log: no line of it can be read by the runner as a workflow command.
 *
 * @remarks
 * The runner has TWO command parsers, and a line is a command if either accepts it
 * (`actions/runner`, `src/Runner.Common/ActionCommand.cs` and `src/Runner.Worker/ActionCommandManager.cs`, where
 * `TryProcessCommand` tries `TryParseV2` and then `TryParse`):
 *
 * - **V2** (`TryParseV2`): `message.TrimStart()` with .NET's whitespace, which includes U+0085, then
 *   `StartsWith("::")`. A line like that gets a zero-width space (U+200B) in front of it, which .NET does not count
 *   as whitespace, so it no longer starts with `::`.
 * - **Legacy** (`TryParse`): `message.IndexOf("##[")`, so `##[` is a command WHEREVER it occurs in the line, not only
 *   at its start. Every occurrence gets a zero-width space between the `##` and the `[`.
 *
 * A bare `##` with no `[` straight after it is not a command and is left alone, so a markdown heading is untouched.
 * Input is split at CR, LF and CRLF, as the runner splits a stream, so a lone CR starts a line.
 *
 * The result is **idempotent**: a line this has neutralized matches neither rule, so neutralizing it again changes
 * nothing. That is what lets a renderer that neutralizes as it builds and a facade that neutralizes the finished text
 * both apply it without a second marker.
 *
 * This does not escape a command you mean to write: that is {@link WorkflowCommand}, whose message and property
 * escaping is a different protocol. There is no detector here either, on purpose: a function that decided what is a
 * command, shipped beside the code that neutralizes it, would be the implementation's own opinion, and a test using it
 * would pin the output as its own oracle.
 *
 * @example
 * ```ts
 * import { CommandNeutralizer } from "./index.ts";
 *
 * CommandNeutralizer.text("note\n::add-mask::secret\nprefix ##[error]x");
 * // the `::` line starts with a zero-width space and the `##[` has one inside it; "note" is untouched
 * ```
 *
 * @public
 */
export class CommandNeutralizer {
	private constructor() {}

	/**
	 * Split `text` at the runner's line breaks and neutralize each line.
	 *
	 * @param text - text that is data, not a command
	 * @returns one entry per line, in order
	 */
	static lines(text: string): ReadonlyArray<string> {
		return text.split(LINE_BREAK).map(neutralize);
	}

	/**
	 * Neutralize `text` and join the lines with a line feed.
	 *
	 * @remarks
	 * Line breaks come back as LF whatever they were, which is what the runner reads them as.
	 *
	 * @param text - text that is data, not a command
	 */
	static text(text: string): string {
		return CommandNeutralizer.lines(text).join("\n");
	}
}
