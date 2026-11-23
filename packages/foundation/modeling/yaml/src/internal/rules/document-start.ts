// document-start: the `---` marker at the head of the stream —
// required (`present: true`, the default) or forbidden (`present: false`).
// Scope is deliberately the STREAM HEAD only: `---` separators between the
// documents of a multi-document stream are structure, not style — removing
// one would merge two documents, and no lint rule gets to do that.
//
// Opt-in: absent from both presets (many real-world corpora — workflow
// files above all — never carry the marker).

import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlEdit } from "../../YamlEdit.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

const $I = $YamlId.create("internal/rules/document-start");

/**
 * **Example** (Decode document-start options)
 *
 * ```ts
 * import { documentStartOptions } from "@beep/yaml/internal/rules/document-start";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(documentStartOptions)({ present: false });
 * console.log(options.present); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class documentStartOptions extends S.Opaque<documentStartOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("documentStartOptions.severity", {
        description: "Reporting level for document-start marker findings, defaulting to `error`",
      })
    ),
    present: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("documentStartOptions.present", {
        description: "Whether the stream's initial `---` marker is required (`true`, default) or forbidden (`false`)",
      })
    ),
  }).pipe(
    $I.annoteSchema("documentStartOptions", {
      description: "Options for `document-start`: require (`true`, default) or forbid the marker.",
    })
  )
) {}

const TRIVIA = HashSet.fromIterable(["newline", "whitespace", "comment", "byte-order-mark", "directive"]);

/** True when the stream carries `%YAML`/`%TAG` directives — which REQUIRE `---`. */
const hasDirectives = (ctx: LintContext): boolean => A.some(ctx.tokens, (t) => t.kind === "directive");

/** The first non-trivia token: it decides whether the stream is headed by `---`. */
const headToken = (ctx: LintContext): O.Option<YamlToken> =>
  A.findFirst(ctx.tokens, (t) => !HashSet.has(TRIVIA, t.kind));

/** True when `text` holds only whitespace and line terminators (the same set `String.prototype.trim` strips). */
const isBlank = (text: string): boolean => /^\s*$/u.test(text);

/** A line holding the `---` marker and nothing but surrounding whitespace. */
const MARKER_ALONE = /^\s*---\s*$/u;

/** Report a non-blank stream not headed by `---`. */
const missingStartMarker = (ctx: LintContext, first: YamlToken | undefined): ReadonlyArray<YamlLintDiagnostic> => {
  if (first?.kind === "document-start" || isBlank(ctx.text)) return [];
  return [
    YamlLintDiagnostic.make({
      rule: "document-start",
      severity: "error",
      message: 'Missing "---" document start marker',
      offset: 0,
      length: 0,
      line: 0,
      character: 0,
      // A stream with %directives cannot take a synthesized `---` at
      // offset 0 (directives precede the marker); no fix there.
      ...(hasDirectives(ctx)
        ? {}
        : { fix: YamlEdit.make({ offset: Str.startsWith("\uFEFF")(ctx.text) ? 1 : 0, length: 0, content: "---\n" }) }),
    }),
  ];
};

/**
 * Only a marker ALONE on its line takes a fix — `--- content` would
 * splice the content line. A stream with %directives REQUIRES the
 * marker, so removing it would invalidate the directives: no fix.
 */
const isRemovableStartMarker = (ctx: LintContext, first: YamlToken): boolean => {
  const lineText = ctx.lines[first.line]?.text ?? "";
  // An empty first document needs its start marker unless an explicit
  // end marker independently preserves it. Header comments alone do not.
  const preservesDocument = ctx.document.contents !== null || ctx.document.hasDocumentEnd === true;
  return !hasDirectives(ctx) && preservesDocument && MARKER_ALONE.test(lineText);
};

/** Report the forbidden head `---`, fixing it only when the marker line can go whole. */
const forbiddenStartMarker = (ctx: LintContext, first: YamlToken): YamlLintDiagnostic => {
  const alone = isRemovableStartMarker(ctx, first);
  // The fix removes the marker line whole: marker plus its terminator
  // (two characters under CRLF, one under LF).
  const terminator =
    Str.slice(first.offset + first.length, first.offset + first.length + 2)(ctx.text) === "\r\n" ? 2 : 1;
  return YamlLintDiagnostic.make({
    rule: "document-start",
    severity: "error",
    message: 'Forbidden "---" document start marker',
    offset: first.offset,
    length: first.length,
    line: first.line,
    character: first.character,
    ...(alone ? { fix: YamlEdit.make({ offset: first.offset, length: first.length + terminator, content: "" }) } : {}),
  });
};

/**
 * Checks the `---` marker at the head of the stream.
 *
 * **Details**
 *
 * The rule requires the marker by default when enabled, or forbids it with
 * `present: false`. It is opt-in and absent from both presets because many
 * real-world corpora, especially workflow files, never carry the marker.
 *
 * **Gotchas**
 *
 * Separators between documents are structure, not style: removing one
 * would merge two documents. Streams with directives require a start marker;
 * the rule does not synthesize or remove markers in those streams. Removal
 * fixes also require a marker alone on its line and must preserve an empty
 * first document. A stream BOM stays before an inserted marker.
 *
 * **Example** (Report document-start violations)
 *
 * ```ts
 * import { documentStart } from "@beep/yaml/internal/rules/document-start";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({ rules: { "document-start": "error" } });
 * const diagnostics = YamlLint.run("a: 1\n", [documentStart], config);
 * console.log(diagnostics[0]?.message); // Missing "---" document start marker
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const documentStart = YamlRule.make({
  id: "document-start",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const opts = P.isObject(options) ? options : {};
    const present = S.is(S.Boolean)(opts.present) ? opts.present : true;
    // The first non-trivia token decides: is the stream headed by `---`?
    const first = O.getOrUndefined(headToken(ctx));
    if (present) return missingStartMarker(ctx, first);
    return first?.kind === "document-start" ? [forbiddenStartMarker(ctx, first)] : [];
  }),
  // Inference: a non-empty stream votes `present` — headed by `---`
  // or not. An unmarked file IS evidence of the no-marker style (the
  // workflow-file corpus above all), so absence votes `false` rather than
  // saying nothing.
  infer: (ctx) => {
    if (isBlank(ctx.text)) return [];
    const head = headToken(ctx);
    if (O.isNone(head)) return [];
    const first = head.value;
    const headed = first.kind === "document-start";
    // A %directive-headed stream REQUIRES the marker (check refuses to
    // synthesize or remove one there): an unmarked directive stream is
    // malformed input, not evidence of the no-marker style — no vote.
    if (!headed && hasDirectives(ctx)) return [];
    return [
      StyleVote.make(
        headed
          ? {
              dimension: "present",
              value: true,
              offset: first.offset,
              length: first.length,
              line: first.line,
              character: first.character,
            }
          : { dimension: "present", value: false, offset: 0, length: 0, line: 0, character: 0 }
      ),
    ];
  },
});
