import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
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

const isDotNetTrimStartWhitespace = (ch: string): boolean => {
  const code = O.getOrElse(Str.codePointAt(ch, 0), () => 0);
  return (
    (code >= 0x09 && code <= 0x0d) ||
    (code >= 0x2000 && code <= 0x200a) ||
    A.contains([0x20, 0x85, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000], code)
  );
};

/** Would the runner read this one line as a command, by either parser. */
export const isCommand = (line: string): boolean => {
  let i = 0;
  while (i < line.length && isDotNetTrimStartWhitespace(Str.slice(i, i + 1)(line))) i++;
  return pipe(line, Str.slice(i), Str.startsWith("::")) || Str.includes("##[")(line);
};

/** The lines of `text` the runner would read as a command. */
export const commandLines = (text: string): ReadonlyArray<string> =>
  pipe(text, Str.split(LINE_BREAK), A.filter(isCommand));
