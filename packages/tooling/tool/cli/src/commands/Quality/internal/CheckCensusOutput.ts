/**
 * Compiler-output, program-file and name-filter helpers shared by the check
 * census, its single-checker gate and its build-equivalence mode.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { runCaptured } from "@beep/repo-cli-kit/process/index";
import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const diagnosticLinePattern = /\berror TS\d+:/u;

/**
 * Whether a compiler output line reports a diagnostic (`error TS<code>:`), in
 * either tsgo's pretty or plain format.
 *
 * **Example** (Recognise a plain diagnostic)
 *
 * ```ts
 * import { isCompilerDiagnosticLine } from "@beep/repo-cli/test/Quality"
 *
 * console.log(isCompilerDiagnosticLine("src/a.ts(1,7): error TS2322: Type 'string' is not assignable.")) // true
 * ```
 *
 * @param line - One trimmed compiler output line.
 * @returns `true` for a diagnostic line.
 * @category parsing
 * @since 0.0.0
 */
export const isCompilerDiagnosticLine = (line: string): boolean => diagnosticLinePattern.test(line);

/**
 * Split captured compiler output into trimmed, non-empty lines.
 *
 * **Example** (Drop blank lines)
 *
 * ```ts
 * import { compilerOutputLines } from "@beep/repo-cli/test/Quality"
 *
 * console.log(compilerOutputLines("Types: 10\n\n  Instantiations: 42  \n")) // ["Types: 10", "Instantiations: 42"]
 * ```
 *
 * @param output - Captured compiler output.
 * @returns The trimmed non-empty lines in order.
 * @category parsing
 * @since 0.0.0
 */
export const compilerOutputLines = (output: string): ReadonlyArray<string> =>
  pipe(Str.split(output, "\n"), A.map(Str.trim), A.filter(Str.isNonEmpty));

/**
 * Predicate for a `--filter` flag: every name passes when the flag is absent,
 * otherwise only names containing its text.
 *
 * **Example** (Narrow to one package family)
 *
 * ```ts
 * import { nameFilterPredicate } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const matches = nameFilterPredicate(O.some("@beep/schema"))
 * console.log(matches("@beep/schema#typeperf/baseline"), matches("@beep/repo-cli")) // true false
 * ```
 *
 * @param filter - The optional substring from the command line.
 * @returns A predicate over package or program names.
 * @category filtering
 * @since 0.0.0
 */
export const nameFilterPredicate =
  (filter: O.Option<string>) =>
  (name: string): boolean =>
    O.match(filter, { onNone: () => true, onSome: (needle) => Str.includes(needle)(name) });

/**
 * List the files a compiler program holds: `<compiler> -p <config>
 * --listFilesOnly`, run from `cwd`, with diagnostic lines dropped.
 *
 * **Details**
 *
 * The compiler prints one absolute path per line, in the order it loaded the
 * files. A diagnostic (for example a missing referenced declaration) does not
 * fail the listing; the file lines are still returned.
 *
 * **Example** (List the build program of one package)
 *
 * ```ts
 * import { listProgramFiles } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const files = listProgramFiles("/repo/node_modules/.bin/tsrs", "tsconfig.json", "/repo/packages/foundation/modeling/schema")
 * console.log(Effect.isEffect(files)) // true
 * ```
 *
 * @param compilerPath - Absolute path of the compiler binary.
 * @param configPath - Config passed to `-p`, relative to `cwd` or absolute.
 * @param cwd - Directory the compiler runs from.
 * @returns The listed file paths in compiler order.
 * @category queries
 * @since 0.0.0
 */
export const listProgramFiles = Effect.fn("CheckCensus.listProgramFiles")(function* (
  compilerPath: string,
  configPath: string,
  cwd: string
): Effect.fn.Return<
  ReadonlyArray<string>,
  QualityScriptCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
> {
  const result = yield* runCaptured({
    command: compilerPath,
    args: ["-p", configPath, "--listFilesOnly"],
    cwd,
    source: "stdout",
    trim: true,
  }).pipe(QualityScriptCommandError.mapError(`Failed to list program files for ${configPath}.`));

  return pipe(
    compilerOutputLines(result.output),
    A.filter((line) => !isCompilerDiagnosticLine(line))
  );
});
