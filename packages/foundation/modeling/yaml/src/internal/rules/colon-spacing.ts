import { $YamlId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import { YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption, positiveIntegerOption } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

const $I = $YamlId.create("internal/rules/colon-spacing");

/**
 * **Gotchas**
 *
 * `maxSpacesBefore: 0` is legal (`key:` needs no space before the colon),
 * but at least one separation space must FOLLOW it — `0` would make the fix
 * emit `a:val`, a plain scalar, not a mapping entry.
 *
 * **Example** (Decode colon-spacing options)
 *
 * ```ts
 * import { colonSpacingOptions } from "@beep/yaml/internal/rules/colon-spacing";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(colonSpacingOptions)({ maxSpacesBefore: 0, maxSpacesAfter: 1 });
 * console.log(options.maxSpacesAfter); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class colonSpacingOptions extends S.Opaque<colonSpacingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("colonSpacingOptions.severity", {
        description: "Reporting level for colon-spacing findings, defaulting to `error`",
      })
    ),
    maxSpacesBefore: S.optionalKey(nonNegativeIntegerOption).pipe(
      $I.annoteKey("colonSpacingOptions.maxSpacesBefore", {
        description: "Maximum spaces between preceding line content and a block-mapping `:`, defaulting to 0",
      })
    ),
    maxSpacesAfter: S.optionalKey(positiveIntegerOption).pipe(
      $I.annoteKey("colonSpacingOptions.maxSpacesAfter", {
        description:
          "Maximum spaces between a block-mapping `:` and its same-line value, at least 1 and defaulting to 1",
      })
    ),
  }).pipe(
    $I.annoteSchema("colonSpacingOptions", {
      description:
        "Options for `colon-spacing`: `maxSpacesBefore` (default 0) and `maxSpacesAfter` (default 1) around the `:` indicator. `maxSpacesBefore: 0` is legal (`key:` needs no space before the colon), but at least one separation space must FOLLOW it — `0` would make the fix emit `a:val`, a plain scalar, not a mapping entry.",
    })
  )
) {}

const readColonLimits = (options: unknown): { readonly maxBefore: number; readonly maxAfter: number } => {
  const opts = P.isObject(options) ? options : {};
  const maxAfterClampedSoHandBuiltOptionsKeepSeparation = Math.max(
    1,
    P.isNumber(opts.maxSpacesAfter) ? opts.maxSpacesAfter : 1
  );
  return {
    maxBefore: P.isNumber(opts.maxSpacesBefore) ? opts.maxSpacesBefore : 0,
    maxAfter: maxAfterClampedSoHandBuiltOptionsKeepSeparation,
  };
};

const spacesBeforeFinding = (text: string, token: YamlToken, maxBefore: number): YamlLintDiagnostic | undefined => {
  let i = token.offset - 1;
  while (i >= 0 && text[i] === " ") i--;
  const before = token.offset - 1 - i;
  const prev = text[i];
  const hasContentBefore = prev !== undefined && prev !== "\n" && prev !== "\r" && prev !== "\t";
  if (!hasContentBefore || before <= maxBefore) return undefined;
  return YamlLintDiagnostic.make({
    rule: "colon-spacing",
    severity: "error",
    message: `Too many spaces before ":" (${before} > ${maxBefore})`,
    offset: token.offset - before,
    length: before,
    line: token.line,
    character: token.character - before,
    fix: YamlEdit.make({
      offset: token.offset - before,
      length: before - maxBefore,
      content: "",
    }),
  });
};

const spacesAfterFinding = (text: string, token: YamlToken, maxAfter: number): YamlLintDiagnostic | undefined => {
  const start = token.offset + token.length;
  let j = start;
  while (j < text.length && text[j] === " ") j++;
  const after = j - start;
  const next = text[j];
  const valueOnNextLineOrCommentSpacingOwnsIt = next === undefined || next === "\n" || next === "\r" || next === "#";
  if (valueOnNextLineOrCommentSpacingOwnsIt) return undefined;
  if (after <= maxAfter) return undefined;
  return YamlLintDiagnostic.make({
    rule: "colon-spacing",
    severity: "error",
    message: `Too many spaces after ":" (${after} > ${maxAfter})`,
    offset: start,
    length: after,
    line: token.line,
    character: token.character + token.length,
    fix: YamlEdit.make({
      offset: start,
      length: after - maxAfter,
      content: "",
    }),
  });
};

/**
 * Enforces spacing around the block-mapping `:` indicator.
 *
 * **Details**
 *
 * The default permits no spaces before the colon and at most one after it.
 * An explicit-value colon at the head of its line is structure rather than
 * spacing; a comment after the colon belongs to the comments-spacing rule.
 *
 * **Example** (Report colon-spacing violations)
 *
 * ```ts
 * import { colonSpacing } from "@beep/yaml/internal/rules/colon-spacing";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({ rules: { "colon-spacing": "error" } });
 * const diagnostics = YamlLint.run("a:  1\n", [colonSpacing], config);
 * console.log(diagnostics[0]?.message); // Too many spaces after ":" (2 > 1)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const colonSpacing = YamlRule.make({
  id: "colon-spacing",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const { maxBefore, maxAfter } = readColonLimits(options);
    const out: Array<YamlLintDiagnostic> = [];
    for (const token of ctx.tokens) {
      if (token.kind !== "block-map-value") continue;
      const before = spacesBeforeFinding(ctx.text, token, maxBefore);
      if (before !== undefined) out.push(before);
      const after = spacesAfterFinding(ctx.text, token, maxAfter);
      if (after !== undefined) out.push(after);
    }
    return out;
  }),
});
