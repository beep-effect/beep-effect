import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

// Adapted from actions/runner Runner.Common/ActionCommand.cs and Runner.Worker/ActionCommandManager.cs (MIT).

const DOTNET_READLINE_BREAK = /\r\n|\r|\n/;

const LEADING_DOTNET_WHITESPACE = /^[\t-\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*/;

/** Would the runner read this one line as a command, by either parser. */
export const isCommand = (line: string): boolean =>
  pipe(line, Str.replace(LEADING_DOTNET_WHITESPACE, ""), Str.startsWith("::")) || Str.includes("##[")(line);

/** The lines of `text` the runner would read as a command. */
export const commandLines = (text: string): ReadonlyArray<string> =>
  pipe(text, Str.split(DOTNET_READLINE_BREAK), A.filter(isCommand));
