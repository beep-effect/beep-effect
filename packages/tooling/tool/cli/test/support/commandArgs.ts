import * as A from "effect/Array";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import type * as CommandLine from "effect/process/CommandLine";

/**
 * The plain argv a real spawner hands the child. `ChildProcess` arguments are
 * `CommandLine.Word`s since effect 4.1.0; the suites script on the unwrapped text.
 */
export const commandArgs = (command: { readonly args: ReadonlyArray<CommandLine.Word> }): ReadonlyArray<string> =>
  A.map(command.args, (word) => (Redacted.isRedacted(word) ? Redacted.value(word) : word));

/**
 * The plain environment overrides a real spawner hands the child, or
 * `undefined` when the command sets none. Values may be `Redacted` since
 * effect 4.1.0; the suites assert on the unwrapped text.
 */
export const commandEnv = (command: {
  readonly options: { readonly env?: Record<string, string | Redacted.Redacted<string> | undefined> | undefined };
}): Record<string, string | undefined> | undefined =>
  command.options.env === undefined
    ? undefined
    : R.map(command.options.env, (value) => (Redacted.isRedacted(value) ? Redacted.value(value) : value));
