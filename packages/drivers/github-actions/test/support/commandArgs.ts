import * as A from "effect/Array";
import * as Redacted from "effect/Redacted";
import type * as CommandLine from "effect/process/CommandLine";

/**
 * The plain argv a real spawner hands the child. `ChildProcess` arguments are
 * `CommandLine.Word`s since effect 4.1.0; the suites script on the unwrapped text.
 */
export const commandArgs = (command: { readonly args: ReadonlyArray<CommandLine.Word> }): ReadonlyArray<string> =>
  A.map(command.args, (word) => (Redacted.isRedacted(word) ? Redacted.value(word) : word));
