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

const hasDirectivesThatRequireStartMarker = (ctx: LintContext): boolean =>
  A.some(ctx.tokens, (t) => t.kind === "directive");

const firstNonTriviaToken = (ctx: LintContext): O.Option<YamlToken> =>
  A.findFirst(ctx.tokens, (t) => !HashSet.has(TRIVIA, t.kind));

const isBlankByTrimWhitespaceSet = (text: string): boolean => /^\s*$/u.test(text);

const MARKER_ALONE = /^\s*---\s*$/u;

const missingStartMarker = (ctx: LintContext, first: YamlToken | undefined): ReadonlyArray<YamlLintDiagnostic> => {
  if (first?.kind === "document-start" || isBlankByTrimWhitespaceSet(ctx.text)) return [];
  return [
    YamlLintDiagnostic.make({
      rule: "document-start",
      severity: "error",
      message: 'Missing "---" document start marker',
      offset: 0,
      length: 0,
      line: 0,
      character: 0,
      ...(hasDirectivesThatRequireStartMarker(ctx)
        ? {}
        : { fix: YamlEdit.make({ offset: Str.startsWith("\uFEFF")(ctx.text) ? 1 : 0, length: 0, content: "---\n" }) }),
    }),
  ];
};

const isRemovableStartMarker = (ctx: LintContext, first: YamlToken): boolean => {
  const lineText = ctx.lines[first.line]?.text ?? "";
  const contentOrEndMarkerKeepsFirstDocument = ctx.document.contents !== null || ctx.document.hasDocumentEnd === true;
  return (
    !hasDirectivesThatRequireStartMarker(ctx) && contentOrEndMarkerKeepsFirstDocument && MARKER_ALONE.test(lineText)
  );
};

const forbiddenStartMarker = (ctx: LintContext, first: YamlToken): YamlLintDiagnostic => {
  const markerLineCanGoWhole = isRemovableStartMarker(ctx, first);
  const crlfOrLfTerminatorLength =
    Str.slice(first.offset + first.length, first.offset + first.length + 2)(ctx.text) === "\r\n" ? 2 : 1;
  return YamlLintDiagnostic.make({
    rule: "document-start",
    severity: "error",
    message: 'Forbidden "---" document start marker',
    offset: first.offset,
    length: first.length,
    line: first.line,
    character: first.character,
    ...(markerLineCanGoWhole
      ? { fix: YamlEdit.make({ offset: first.offset, length: first.length + crlfOrLfTerminatorLength, content: "" }) }
      : {}),
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
    const first = O.getOrUndefined(firstNonTriviaToken(ctx));
    if (present) return missingStartMarker(ctx, first);
    return first?.kind === "document-start" ? [forbiddenStartMarker(ctx, first)] : [];
  }),
  infer: (ctx) => {
    if (isBlankByTrimWhitespaceSet(ctx.text)) return [];
    const head = firstNonTriviaToken(ctx);
    if (O.isNone(head)) return [];
    const first = head.value;
    const headed = first.kind === "document-start";
    const unmarkedDirectiveStreamIsMalformedNotStyleEvidence = !headed && hasDirectivesThatRequireStartMarker(ctx);
    if (unmarkedDirectiveStreamIsMalformedNotStyleEvidence) return [];
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
