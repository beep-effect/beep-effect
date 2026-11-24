// comments-spacing: a `#` needs a space after it to read as prose,
// and a TRAILING comment needs breathing room from the content before it.
// Own-line versus trailing is decided from token adjacency (content before
// the comment on its line) — the comment model's leading/trailing split
// at the source level. A shebang (`#!` at the very start of the stream) is
// exempt.

import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlEdit } from "../../YamlEdit.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

const $I = $YamlId.create("internal/rules/comments-spacing");

/**
 * **Example** (Decode comments-spacing options)
 *
 * ```ts
 * import { commentsSpacingOptions } from "@beep/yaml/internal/rules/comments-spacing";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(commentsSpacingOptions)({ minSpacesBefore: 2, requireSpaceAfter: true });
 * console.log(options.minSpacesBefore); // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class commentsSpacingOptions extends S.Opaque<commentsSpacingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("commentsSpacingOptions.severity", {
        description: "Reporting level for comment-spacing findings, defaulting to `error`",
      })
    ),
    minSpacesBefore: S.optionalKey(nonNegativeIntegerOption).pipe(
      $I.annoteKey("commentsSpacingOptions.minSpacesBefore", {
        description: "Minimum spaces or tabs between line content and a trailing comment's `#`, defaulting to 1",
      })
    ),
    requireSpaceAfter: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("commentsSpacingOptions.requireSpaceAfter", {
        description:
          "Whether nonempty comments require a space or tab after `#`, defaulting to `true` and exempting an initial shebang",
      })
    ),
  }).pipe(
    $I.annoteSchema("commentsSpacingOptions", {
      description:
        "Options for `comments-spacing`: `minSpacesBefore` between content and a trailing `#` (default 1 — the kit's own emission spelling) and `requireSpaceAfter` the `#` (default `true`).",
    })
  )
) {}

/**
 * The horizontal whitespace run directly before a comment token, and whether
 * line content precedes it (a TRAILING comment) — shared by the check and
 * the inference hook so the two cannot disagree about what "before" means.
 */
const spacingBefore: {
  (ctx: LintContext, token: YamlToken): { readonly spaces: number; readonly hasContentBefore: boolean };
  (token: YamlToken): (ctx: LintContext) => { readonly spaces: number; readonly hasContentBefore: boolean };
} = dual(2, (ctx: LintContext, token: YamlToken): { readonly spaces: number; readonly hasContentBefore: boolean } => {
  let i = token.offset - 1;
  let spaces = 0;
  while (i >= 0 && (ctx.text[i] === " " || ctx.text[i] === "\t")) {
    spaces++;
    i--;
  }
  return {
    spaces,
    hasContentBefore: i >= 0 && ctx.text[i] !== "\n" && ctx.text[i] !== "\r" && !(i === 0 && ctx.text[i] === "\uFEFF"),
  };
});

/** Recognizes a shebang (hash followed by an exclamation mark) at the very start of the stream. */
const isShebang = (token: YamlToken): boolean => token.offset === 0 && Str.startsWith("#!")(token.text);

/** The configured spacing requirements, with their defaults. */
const readCommentOptions = (options: unknown): { readonly minBefore: number; readonly requireAfter: boolean } => {
  const opts = P.isObject(options) ? options : {};
  return {
    minBefore: P.isNumber(opts.minSpacesBefore) ? opts.minSpacesBefore : 1,
    requireAfter: S.is(S.Boolean)(opts.requireSpaceAfter) ? opts.requireSpaceAfter : true,
  };
};

/** Every comment token except a leading shebang. */
const lintableComments = (ctx: LintContext): ReadonlyArray<YamlToken> =>
  A.filter(ctx.tokens, (token) => token.kind === "comment" && !isShebang(token));

/** True when a space or tab follows the `#`. */
const hasSpaceAfterHash = (token: YamlToken): boolean => /[ \t]/.test(Str.slice(1, 2)(token.text));

/** True when prose follows the `#` without a separating space. */
const lacksSpaceAfter = (token: YamlToken): boolean => token.text.length > 1 && !hasSpaceAfterHash(token);

const missingSpaceAfter = (token: YamlToken): YamlLintDiagnostic =>
  YamlLintDiagnostic.make({
    rule: "comments-spacing",
    severity: "error",
    message: 'Missing space after "#"',
    offset: token.offset,
    length: 1,
    line: token.line,
    character: token.character,
    fix: YamlEdit.make({ offset: token.offset + 1, length: 0, content: " " }),
  });

/**
 * Space before a TRAILING comment's `#`: only when content precedes
 * the comment on its line (own-line comments are indentation's
 * business).
 */
const spacingBeforeFinding = (
  ctx: LintContext,
  token: YamlToken,
  minBefore: number
): YamlLintDiagnostic | undefined => {
  const { spaces, hasContentBefore } = spacingBefore(ctx, token);
  if (!hasContentBefore || spaces >= minBefore) return undefined;
  return YamlLintDiagnostic.make({
    rule: "comments-spacing",
    severity: "error",
    message: `Too few spaces before comment (${spaces} < ${minBefore})`,
    offset: token.offset - spaces,
    length: spaces,
    line: token.line,
    character: token.character - spaces,
    fix: YamlEdit.make({
      offset: token.offset,
      length: 0,
      content: Str.repeat(minBefore - spaces)(" "),
    }),
  });
};

const spaceAfterVote = (token: YamlToken): StyleVote =>
  StyleVote.make({
    dimension: "requireSpaceAfter",
    value: hasSpaceAfterHash(token),
    offset: token.offset,
    length: token.length,
    line: token.line,
    character: token.character,
  });

const spacingBeforeVote = (ctx: LintContext, token: YamlToken): StyleVote | undefined => {
  const { spaces, hasContentBefore } = spacingBefore(ctx, token);
  if (!hasContentBefore) return undefined;
  return StyleVote.make({
    dimension: "minSpacesBefore",
    value: spaces,
    offset: token.offset - spaces,
    length: spaces,
    line: token.line,
    character: token.character - spaces,
  });
};

/**
 * Enforces spacing after the `#`, and before a trailing comment's `#`.
 *
 * **Details**
 *
 * Spaces or tabs separate comment prose from the hash and trailing comments
 * from preceding line content. Own-line comments do not contribute
 * before-spacing evidence. A shebang at the very start of the stream is exempt.
 *
 * **Example** (Report comments-spacing violations)
 *
 * ```ts
 * import { commentsSpacing } from "@beep/yaml/internal/rules/comments-spacing";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({ rules: { "comments-spacing": "error" } });
 * const diagnostics = YamlLint.run("a: 1 #text\n", [commentsSpacing], config);
 * console.log(diagnostics[0]?.message); // Missing space after "#"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const commentsSpacing = YamlRule.make({
  id: "comments-spacing",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const { minBefore, requireAfter } = readCommentOptions(options);
    const out: Array<YamlLintDiagnostic> = [];
    for (const token of lintableComments(ctx)) {
      // Space after `#`: a bare `#` is fine, `#text` is not.
      if (requireAfter && lacksSpaceAfter(token)) out.push(missingSpaceAfter(token));
      const before = spacingBeforeFinding(ctx, token, minBefore);
      if (before !== undefined) out.push(before);
    }
    return out;
  }),
  // Inference: every non-shebang comment with content after its `#`
  // votes `requireSpaceAfter` (does a space follow?), and every TRAILING
  // comment votes its observed spacing for `minSpacesBefore`. A bare `#`
  // says nothing about after-spacing; own-line comments say nothing about
  // before-spacing (their leading run is indentation).
  infer: (ctx) => {
    const out: Array<StyleVote> = [];
    for (const token of lintableComments(ctx)) {
      if (token.text.length > 1) out.push(spaceAfterVote(token));
      const before = spacingBeforeVote(ctx, token);
      if (before !== undefined) out.push(before);
    }
    return out;
  },
});
