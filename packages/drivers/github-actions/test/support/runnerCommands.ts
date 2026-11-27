import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

const DOTNET_READLINE_BREAK = /\r\n|\r|\n/;

const LEADING_DOTNET_WHITESPACE = /^[\t-\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*/;

/**
 * Would the runner read this one line as a command, by either parser.
 *
 * **Details**
 *
 * Written from the runner's own source, not from `src/`: `actions/runner` `src/Runner.Common/ActionCommand.cs` and
 * `src/Runner.Worker/ActionCommandManager.cs` (`TryProcessCommand`) try two parsers on every line. V2 (`TryParseV2`)
 * runs `TrimStart()`, which strips the leading .NET `Char.IsWhiteSpace` run (U+0085 is in it, U+200B and U+FEFF are
 * not), then checks `StartsWith("::")`. Legacy (`TryParse`) uses `IndexOf("##[")`, so `##[` is a command wherever it
 * occurs in the line, while a bare `##` with no `[` straight after it is not.
 */
export const isCommand = (line: string): boolean =>
  pipe(line, Str.replace(LEADING_DOTNET_WHITESPACE, ""), Str.startsWith("::")) || Str.includes("##[")(line);

/**
 * The lines of `text` the runner would read as a command.
 *
 * **Details**
 *
 * Lines are what .NET reading a stream gives: split at CRLF, CR or LF.
 */
export const commandLines = (text: string): ReadonlyArray<string> =>
  pipe(text, Str.split(DOTNET_READLINE_BREAK), A.filter(isCommand));
