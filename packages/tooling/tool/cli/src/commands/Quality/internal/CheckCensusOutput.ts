/**
 * Compiler-output and name-filter helpers shared by the check census and its
 * single-checker gate.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as O from "effect/Option";

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
