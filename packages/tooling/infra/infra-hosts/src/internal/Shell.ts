/**
 * Shell rendering shared by the host stacks' command steps.
 *
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

/**
 * Quote a value as one POSIX shell word.
 *
 * @since 0.0.0
 */
export const shellQuote = (value: string): string => `'${pipe(value, Str.replaceAll("'", `'"'"'`))}'`;

/**
 * Join script lines into one bash program run without profile or rc files.
 *
 * @since 0.0.0
 */
export const bashProgram = (lines: ReadonlyArray<string>): string =>
  `/bin/bash --noprofile --norc -c ${shellQuote(A.join(lines, "\n"))}`;

/**
 * Run a bash program on a remote host over non-interactive SSH.
 *
 * The local `/bin/sh` that `Command.Exec` starts parses the outer quoting; ssh
 * hands the inner word to the remote login shell, which starts bash with the
 * program. `BatchMode` makes a missing key or an unarmed agent fail at once
 * instead of prompting inside a deploy.
 *
 * @since 0.0.0
 */
export const overSsh = (input: { readonly destination: string; readonly lines: ReadonlyArray<string> }): string =>
  `ssh -o BatchMode=yes -o ConnectTimeout=20 -- ${shellQuote(input.destination)} ${shellQuote(bashProgram(input.lines))}`;
