/**
 * Compiler diagnostic lines: the forms the TypeScript compiler prints a
 * diagnostic in, parsed into one typed diagnostic. This module has no
 * report-model dependency, so the repo CLI's issue parser reads it cheaply.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoGateRunId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { pipe } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoGateRunId.create("TsDiagnostic");

/**
 * The compiler's pretty diagnostic line once its colours are stripped:
 * `file:line:column - error TS2322: message`.
 *
 * **Details**
 *
 * Moved from the repo CLI's issue parser, which now consumes
 * {@link parsePrettyDiagnostic}. Its named groups are `file`, `line`,
 * `column`, `severity`, `code` (digits only) and `message`.
 *
 * **Example** (Match a pretty diagnostic)
 *
 * ```ts
 * import { tsDiagnosticPattern } from "@beep/repo-gate-run/TsDiagnostic";
 *
 * console.log(tsDiagnosticPattern.exec("src/a.ts:3:7 - error TS2322: nope")?.groups?.code); // 2322
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const tsDiagnosticPattern =
  /^(?<file>[^:\n]+):(?<line>\d+):(?<column>\d+)(?:\s+-)?\s+(?<severity>error|warning)\s+TS(?<code>\d+):\s+(?<message>.+)$/u;

const plainDiagnosticPattern =
  /^(?<file>[^\n]+)\((?<line>\d+),(?<column>\d+)\):\s+(?<severity>error|warning)\s+TS(?<code>\d+):\s+(?<message>.+)$/u;

const globalDiagnosticPattern = /^(?<severity>error|warning)\s+TS(?<code>\d+):\s+(?<message>.+)$/u;

/**
 * **Example** (Match a severity)
 *
 * ```ts
 * import { DiagnosticSeverity } from "@beep/repo-gate-run/TsDiagnostic";
 *
 * console.log(DiagnosticSeverity.is.warning("warning")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DiagnosticSeverity = LiteralKit(["error", "warning"]).pipe(
  $I.annoteSchema("DiagnosticSeverity", {
    description: "A compiler diagnostic's severity: error or warning.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type DiagnosticSeverity = typeof DiagnosticSeverity.Type;

/**
 * One compiler diagnostic as printed: its file and position when it has
 * them, its severity, its code (`TS2322`) and its message.
 *
 * **Details**
 *
 * Positions are kept as printed, so a caller that only reads them (the
 * issue parser) sees what the compiler wrote; the adapter makes a
 * {@link Location} only from a one-based line and column.
 *
 * **Example** (Build a diagnostic)
 *
 * ```ts
 * import { TsDiagnostic } from "@beep/repo-gate-run/TsDiagnostic";
 * import * as O from "effect/Option";
 *
 * const diagnostic = TsDiagnostic.make({
 *   file: O.some("src/a.ts"), line: 3, column: 7, severity: "error", code: "TS2322", message: "nope",
 * });
 * console.log(diagnostic.code); // TS2322
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class TsDiagnostic extends S.Opaque<TsDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.OptionFromOptionalKey(S.String),
    line: S.Finite,
    column: S.Finite,
    severity: DiagnosticSeverity,
    code: S.NonEmptyString,
    message: S.String,
  }).pipe(
    $I.annoteSchema("TsDiagnostic", {
      description: "One compiler diagnostic as printed: file, position, severity, code and message.",
    })
  )
) {}

const isFinite = S.is(S.Finite);

const decimal = (digits: string | undefined): number =>
  pipe(
    O.fromUndefinedOr(digits),
    O.flatMap(N.parse),
    O.filter(isFinite),
    O.getOrElse(() => 0)
  );

const fromMatch = (match: RegExpExecArray | null): O.Option<TsDiagnostic> =>
  O.map(O.fromNullishOr(match?.groups), (groups) =>
    TsDiagnostic.make({
      file: O.fromUndefinedOr(groups.file),
      line: decimal(groups.line),
      column: decimal(groups.column),
      severity: groups.severity === "warning" ? "warning" : "error",
      code: `TS${groups.code}`,
      message: groups.message ?? "",
    })
  );

/**
 * Parse one line in the compiler's pretty form,
 * `file:line:column - error TS2322: message`.
 *
 * **Example** (Parse a pretty line)
 *
 * ```ts
 * import { parsePrettyDiagnostic } from "@beep/repo-gate-run/TsDiagnostic";
 * import * as O from "effect/Option";
 *
 * const parsed = parsePrettyDiagnostic("src/a.ts:3:7 - error TS2322: nope");
 * console.log(O.map(parsed, (diagnostic) => diagnostic.line)); // { _id: 'Option', _tag: 'Some', value: 3 }
 * ```
 *
 * @param line - one line of compiler output, colours already stripped
 * @returns the diagnostic when the line is in the pretty form, else none
 * @category parsing
 * @since 0.0.0
 */
export const parsePrettyDiagnostic = (line: string): O.Option<TsDiagnostic> =>
  fromMatch(tsDiagnosticPattern.exec(line));

/**
 * Parse one line of compiler output in any form it prints a diagnostic in:
 * pretty (`file:line:column - error`), plain (`file(line,column): error`)
 * or with no location (`error TS6305: ...`).
 *
 * **Gotchas**
 *
 * In the plain form the file runs to the final `(line,column):`, so a path
 * may contain parentheses.
 *
 * **Example** (Parse a plain line)
 *
 * ```ts
 * import { parseDiagnosticLine } from "@beep/repo-gate-run/TsDiagnostic";
 * import * as O from "effect/Option";
 *
 * console.log(O.isSome(parseDiagnosticLine("src/a.ts(3,7): error TS2322: nope"))); // true
 * ```
 *
 * @param line - one line of compiler output, colours already stripped
 * @returns the diagnostic the line prints, in whichever form, or none for any other line
 * @category parsing
 * @since 0.0.0
 */
export const parseDiagnosticLine = (line: string): O.Option<TsDiagnostic> =>
  pipe(
    parsePrettyDiagnostic(line),
    O.orElse(() => fromMatch(plainDiagnosticPattern.exec(line))),
    O.orElse(() => fromMatch(globalDiagnosticPattern.exec(line)))
  );
