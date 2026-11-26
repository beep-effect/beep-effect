import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlEdit } from "../../YamlEdit.ts";
import { YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { walkScalars } from "./util.ts";
import type { LintContext, LintLine } from "../../YamlLintRule.ts";
import type { YamlScalar } from "../../YamlNode.ts";

const $I = $YamlId.create("internal/rules/eof-newline");

/**
 * Configure the reporting severity for a missing final newline.
 *
 * **Details**
 *
 * Options for `eof-newline` (severity only — nothing to tune).
 *
 * **Example** (Decode eof-newline options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { eofNewlineOptions } from "@beep/yaml/internal/rules/eof-newline";
 *
 * const options = S.decodeUnknownSync(eofNewlineOptions)({ severity: "warning" });
 * console.log(options.severity) // warning
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class eofNewlineOptions extends S.Opaque<eofNewlineOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("eofNewlineOptions.severity", {
        description: "Reporting level for missing final-newline findings, defaulting to `error`",
      })
    ),
  }).pipe(
    $I.annoteSchema("eofNewlineOptions", {
      description: "Options for `eof-newline` (severity only — nothing to tune).",
    })
  )
) {}

const isBlankText = (text: string): boolean => /^[ \t]*$/.test(text);

const isBlockStyle = (scalar: YamlScalar): boolean =>
  scalar.style === "block-literal" || scalar.style === "block-folded";

const isKeptBlockSpanning = (scalar: YamlScalar, lastLine: LintLine): boolean =>
  scalar.chomp === "keep" &&
  isBlockStyle(scalar) &&
  P.isString(scalar.value) &&
  scalar.offset < lastLine.offset &&
  lastLine.offset < scalar.offset + scalar.length;

const leadingSpaceCount = (text: string): number => {
  let spaces = 0;
  while (text[spaces] === " ") spaces++;
  return spaces;
};

const contentBreakDecidedByScalarOrUndefined = (
  ctx: LintContext,
  lastLine: LintLine,
  scalar: YamlScalar
): boolean | undefined => {
  if (!isKeptBlockSpanning(scalar, lastLine)) return undefined;
  const firstContent = A.findFirst(
    ctx.lines,
    (line) => line.offset > scalar.offset && line.offset < scalar.offset + scalar.length && !isBlankText(line.text)
  );
  if (O.isNone(firstContent))
    return A.some(ctx.lines, (line) => line.offset > scalar.offset && line.offset < lastLine.offset);
  const firstValueContent = A.findFirst(Str.split(String(scalar.value), "\n"), (line) => !isBlankText(line));
  if (O.isNone(firstValueContent)) return undefined;
  const sourceSpaces = leadingSpaceCount(firstContent.value.text);
  const valueSpaces = leadingSpaceCount(firstValueContent.value);
  const contentIndentBeyondWhichSpacesAreScalarText = sourceSpaces - valueSpaces;
  const blankWithinContentIndentGainsKeepBreak = lastLine.text.length <= contentIndentBeyondWhichSpacesAreScalarText;
  return blankWithinContentIndentGainsKeepBreak ? true : undefined;
};

const completingAddsContentBreak = (ctx: LintContext, lastLine: LintLine): boolean => {
  let lastDecidingScalarInWalkOrderWins = false;
  walkScalars(ctx.document.contents, "root", (scalar) => {
    const effect = contentBreakDecidedByScalarOrUndefined(ctx, lastLine, scalar);
    if (effect !== undefined) lastDecidingScalarInWalkOrderWins = effect;
  });
  return lastDecidingScalarInWalkOrderWins;
};

/**
 * Report a missing final newline, with an inserting fix.
 *
 * **Details**
 *
 * Empty input is accepted. For non-empty input without a final newline, the
 * fix inserts a newline with a zero-length edit at the end of the source.
 * The diagnostic has no fix when completing a keep-chomp scalar blank line
 * would add a retained content newline.
 *
 * **Example** (Find a missing final newline)
 *
 * ```ts
 * import { eofNewline } from "@beep/yaml/internal/rules/eof-newline";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "eof-newline": {} },
 * });
 * const diagnostics = YamlLint.run("name: Ada", [eofNewline], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const eofNewline = YamlRule.make({
  id: "eof-newline",
  check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
    if (ctx.text.length === 0 || Str.endsWith("\n")(ctx.text)) return [];
    const lastLine = ctx.lines[ctx.lines.length - 1];
    if (lastLine === undefined) return [];
    const addsContentBreak = /^ +$/.test(lastLine.text) && completingAddsContentBreak(ctx, lastLine);
    const fix = addsContentBreak ? undefined : YamlEdit.make({ offset: ctx.text.length, length: 0, content: "\n" });
    return [
      YamlLintDiagnostic.make({
        rule: "eof-newline",
        severity: "error",
        message: "No newline at end of file",
        offset: ctx.text.length,
        length: 0,
        line: lastLine.number,
        character: lastLine.text.length,
        ...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
      }),
    ];
  }),
});
