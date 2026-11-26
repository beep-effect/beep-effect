import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import { StyleFloor, YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { insideScalarSpan, nonNegativeIntegerOption, walkScalars } from "./util.ts";
import type { LintContext, LintLine } from "../../YamlLintRule.ts";
import type { YamlScalar } from "../../YamlNode.ts";

const $I = $YamlId.create("internal/rules/empty-lines");

/**
 * Limit consecutive blank lines in the body and at document boundaries.
 *
 * **Details**
 *
 * Options for `empty-lines`: `max` consecutive blank lines in the body
 * (default 2), `maxStart` at the document start and `maxEnd` at the end
 * (both default 0).
 *
 * **Example** (Decode empty-lines options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { emptyLinesOptions } from "@beep/yaml/internal/rules/empty-lines";
 *
 * const options = S.decodeUnknownSync(emptyLinesOptions)({ max: 1, maxStart: 0, maxEnd: 0 });
 * console.log(options.max) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class emptyLinesOptions extends S.Opaque<emptyLinesOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("emptyLinesOptions.severity", {
        description: "Reporting level for excessive blank-line findings, defaulting to `error`",
      })
    ),
    max: S.optionalKey(nonNegativeIntegerOption).pipe(
      $I.annoteKey("emptyLinesOptions.max", {
        description: "Maximum consecutive blank lines in the document body outside scalar content, defaulting to 2",
      })
    ),
    maxStart: S.optionalKey(nonNegativeIntegerOption).pipe(
      $I.annoteKey("emptyLinesOptions.maxStart", {
        description: "Maximum consecutive blank lines at the start of the input, defaulting to 0",
      })
    ),
    maxEnd: S.optionalKey(nonNegativeIntegerOption).pipe(
      $I.annoteKey("emptyLinesOptions.maxEnd", {
        description: "Maximum consecutive blank lines at the end of the input outside scalar content, defaulting to 0",
      })
    ),
  }).pipe(
    $I.annoteSchema("emptyLinesOptions", {
      description:
        "Options for `empty-lines`: `max` consecutive blank lines in the body (default 2), `maxStart` at the document start and `maxEnd` at the end (both default 0).",
    })
  )
) {}

// decision: layout-rules-skip-scalar-content
const layoutBlankPredicateGuardingComposedScalars = (ctx: LintContext): ((line: LintLine) => boolean) => {
  const spans: Array<YamlScalar> = [];
  walkScalars(ctx.document.contents, "root", (scalar) => {
    if (scalar.sourceMultiline === true) spans.push(scalar);
  });
  return (line) =>
    line.text === "" &&
    !insideScalarSpan(ctx.tokens, line.offset) &&
    !A.some(spans, (scalar) => scalar.offset < line.offset && line.offset < scalar.offset + scalar.length);
};

type HalfOpenLayoutBlankRun = { readonly start: number; readonly end: number };

type BlankCaps = { readonly max: number; readonly maxStart: number; readonly maxEnd: number };

const readBlankCaps = (options: unknown): BlankCaps => ({
  max: P.hasProperty(options, "max") && S.is(emptyLinesOptions.fields.max.schema)(options.max) ? options.max : 2,
  maxStart:
    P.hasProperty(options, "maxStart") && S.is(emptyLinesOptions.fields.maxStart.schema)(options.maxStart)
      ? options.maxStart
      : 0,
  maxEnd:
    P.hasProperty(options, "maxEnd") && S.is(emptyLinesOptions.fields.maxEnd.schema)(options.maxEnd)
      ? options.maxEnd
      : 0,
});

const blankRuns = (ctx: LintContext): ReadonlyArray<HalfOpenLayoutBlankRun> => {
  const lines = ctx.lines;
  const isLayoutBlank = layoutBlankPredicateGuardingComposedScalars(ctx);
  const runs: Array<HalfOpenLayoutBlankRun> = [];
  let i = 0;
  while (i < lines.length) {
    if (!isLayoutBlank(A.getUnsafe(lines, i))) {
      i++;
      continue;
    }
    let end = i;
    while (end < lines.length && isLayoutBlank(A.getUnsafe(lines, end))) end++;
    runs.push({ start: i, end });
    i = end;
  }
  return runs;
};

const isBodyRun = (ctx: LintContext, run: HalfOpenLayoutBlankRun): boolean =>
  run.start !== 0 && run.end !== ctx.lines.length;

const allowedForRun = (ctx: LintContext, run: HalfOpenLayoutBlankRun, caps: BlankCaps): number => {
  if (run.start === 0) return caps.maxStart;
  return run.end === ctx.lines.length ? caps.maxEnd : caps.max;
};

const runFinding = (ctx: LintContext, run: HalfOpenLayoutBlankRun, allowed: number): YamlLintDiagnostic | undefined => {
  const runLength = run.end - run.start;
  if (runLength <= allowed) return undefined;
  const firstExcessIndexInsideRunSinceAllowedBelowLength = run.start + allowed;
  const firstExcess = A.getUnsafe(ctx.lines, firstExcessIndexInsideRunSinceAllowedBelowLength);
  const nextLine = ctx.lines[run.end];
  const sourceEndThroughLastTerminatorFromNextLine = nextLine !== undefined ? nextLine.offset : ctx.text.length;
  return YamlLintDiagnostic.make({
    rule: "empty-lines",
    severity: "error",
    message: `Too many consecutive blank lines (${runLength} > ${allowed})`,
    offset: firstExcess.offset,
    length: sourceEndThroughLastTerminatorFromNextLine - firstExcess.offset,
    line: firstExcess.number,
    character: 0,
    fix: YamlEdit.make({
      offset: firstExcess.offset,
      length: sourceEndThroughLastTerminatorFromNextLine - firstExcess.offset,
      content: "",
    }),
  });
};

/**
 * Report runs of blank lines beyond the configured caps, with a deleting fix.
 *
 * **Details**
 *
 * Blank lines inside scalar content are skipped. Deletions cover whole line
 * terminators, including CRLF. Inference records the longest body run as a
 * floor; it does not infer the caps.
 *
 * **Example** (Count an excessive blank-line run)
 *
 * ```ts
 * import { emptyLines } from "@beep/yaml/internal/rules/empty-lines";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "empty-lines": { max: 1 } },
 * });
 * const diagnostics = YamlLint.run("name: Ada\n\n\n\nnext: item\n", [emptyLines], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const emptyLines = YamlRule.make({
  id: "empty-lines",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const caps = readBlankCaps(options);
    const out: Array<YamlLintDiagnostic> = [];
    for (const run of blankRuns(ctx)) {
      const finding = runFinding(ctx, run, allowedForRun(ctx, run, caps));
      if (finding !== undefined) out.push(finding);
    }
    return out;
  }),
  infer: (ctx) => {
    let longestBodyRunIsOnlyAFloorForMax = 0;
    for (const run of blankRuns(ctx)) {
      if (isBodyRun(ctx, run))
        longestBodyRunIsOnlyAFloorForMax = Math.max(longestBodyRunIsOnlyAFloorForMax, run.end - run.start);
    }
    return longestBodyRunIsOnlyAFloorForMax > 0
      ? [StyleFloor.make({ dimension: "max", value: longestBodyRunIsOnlyAFloorForMax })]
      : [];
  },
});
