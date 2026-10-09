/**
 * What the GitHub Actions runner reads as a workflow command, written from the runner's own source and imported by
 * nothing in `src/`: `actions/runner`, `src/Runner.Common/ActionCommand.cs` and
 * `src/Runner.Worker/ActionCommandManager.cs` (`TryProcessCommand`). The runner tries two parsers on every line:
 *
 * - V2 (`TryParseV2`): `message.TrimStart()` with .NET's whitespace, then `StartsWith("::")`.
 * - legacy (`TryParse`): `message.IndexOf("##[")`, the `Prefix` constant, so `##[` is a command WHEREVER it occurs in
 *   the line. A bare `##`, with no `[` straight after it, is not a command.
 *
 * Lines are what .NET reading a stream gives: split at CRLF, CR or LF.
 */

/** The runner's line breaks. */
export const LINE_BREAK = /\r\n|\r|\n/;

/**
 * .NET's `Char.IsWhiteSpace`, which is what `TrimStart` removes. Note U+0085 is in it and U+200B and U+FEFF are not.
 */
export const isDotNetWhitespace = (ch: string): boolean => {
	const code = ch.codePointAt(0) ?? 0;
	return (
		(code >= 0x09 && code <= 0x0d) ||
		code === 0x20 ||
		code === 0x85 ||
		code === 0xa0 ||
		code === 0x1680 ||
		(code >= 0x2000 && code <= 0x200a) ||
		code === 0x2028 ||
		code === 0x2029 ||
		code === 0x202f ||
		code === 0x205f ||
		code === 0x3000
	);
};

/** Would the runner read this one line as a command, by either parser. */
export const isCommand = (line: string): boolean => {
	let i = 0;
	while (i < line.length && isDotNetWhitespace(line.charAt(i))) i++;
	return line.slice(i).startsWith("::") || line.includes("##[");
};

/** The lines of `text` the runner would read as a command. */
export const commandLines = (text: string): ReadonlyArray<string> => text.split(LINE_BREAK).filter(isCommand);
