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
import { composeFirstDocument } from "../composer/document.ts";
import { ParseOptionsInput } from "../options.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

const $I = $YamlId.create("internal/rules/document-end");

/**
 * **Example** (Decode document-end options)
 *
 * ```ts
 * import { documentEndOptions } from "@beep/yaml/internal/rules/document-end";
 * import * as S from "effect/Schema";
 *
 * const options = S.decodeUnknownSync(documentEndOptions)({ present: false });
 * console.log(options.present); // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class documentEndOptions extends S.Opaque<documentEndOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("documentEndOptions.severity", {
        description: "Reporting level for document-end marker findings, defaulting to `error`",
      })
    ),
    present: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("documentEndOptions.present", {
        description: "Whether the stream's final `...` marker is required (`true`, default) or forbidden (`false`)",
      })
    ),
  }).pipe(
    $I.annoteSchema("documentEndOptions", {
      description: "Options for `document-end`: require (`true`, default) or forbid the marker.",
    })
  )
) {}

const TRIVIA = HashSet.fromIterable(["newline", "whitespace", "comment", "byte-order-mark"]);

const lastNonTriviaToken = (ctx: LintContext): YamlToken | undefined =>
  O.getOrUndefined(A.findLast(ctx.tokens, (t) => !HashSet.has(TRIVIA, t.kind)));

const endOfStreamPosition = (
  ctx: LintContext
): { readonly offset: number; readonly length: number; readonly line: number; readonly character: number } => {
  const lastLine = O.getOrUndefined(A.last(ctx.lines));
  const offsetSitsOnLineAfterLastKeptLine = Str.endsWith("\n")(ctx.text) || Str.endsWith("\r")(ctx.text);
  return {
    offset: ctx.text.length,
    length: 0,
    line: (lastLine?.number ?? 0) + (offsetSitsOnLineAfterLastKeptLine ? 1 : 0),
    character: offsetSitsOnLineAfterLastKeptLine ? 0 : (lastLine?.text.length ?? 0),
  };
};

const missingEndMarker = (ctx: LintContext, tail: YamlToken | undefined): ReadonlyArray<YamlLintDiagnostic> => {
  if (tail?.kind === "document-end" || Str.trim(ctx.text) === "") return [];
  const markerLineAfterTheNewlineEofNewlineOwns = Str.endsWith("\n")(ctx.text) ? "...\n" : "\n...\n";
  return [
    YamlLintDiagnostic.make({
      rule: "document-end",
      severity: "error",
      message: 'Missing "..." document end marker',
      ...endOfStreamPosition(ctx),
      fix: YamlEdit.make({
        offset: ctx.text.length,
        length: 0,
        content: markerLineAfterTheNewlineEofNewlineOwns,
      }),
    }),
  ];
};

const isDocumentMarker = (token: YamlToken): boolean =>
  token.kind === "document-start" || token.kind === "document-end";

const finalDocumentStart = (ctx: LintContext, tail: YamlToken): number => {
  const boundary = O.getOrUndefined(
    A.findLast(ctx.tokens, (token) => token.offset < tail.offset && isDocumentMarker(token))
  );
  if (boundary === undefined) return 0;
  const endMarkerClosesPriorDocument = boundary.kind === "document-end";
  return boundary.offset + (endMarkerClosesPriorDocument ? boundary.length : 0);
};

const isRemovableEndMarker = (ctx: LintContext, tail: YamlToken): boolean => {
  const lineText = ctx.lines[tail.line]?.text ?? "";
  // Compose only the final document: ctx.document is the first one.
  const finalDocument = composeFirstDocument(
    Str.slice(finalDocumentStart(ctx, tail))(ctx.text),
    ParseOptionsInput.make({ uniqueKeys: false })
  );
  const preservesDocument = finalDocument.contents !== null || finalDocument.hasDocumentStart === true;
  return preservesDocument && Str.trim(lineText) === "...";
};

const forbiddenEndMarker = (ctx: LintContext, tail: YamlToken): YamlLintDiagnostic => {
  const markerLineCanGoWhole = isRemovableEndMarker(ctx, tail);
  const crlfOrLfTerminatorLength = Str.startsWith("\r\n", tail.offset + tail.length)(ctx.text) ? 2 : 1;
  return YamlLintDiagnostic.make({
    rule: "document-end",
    severity: "error",
    message: 'Forbidden "..." document end marker',
    offset: tail.offset,
    length: tail.length,
    line: tail.line,
    character: tail.character,
    ...(markerLineCanGoWhole
      ? { fix: YamlEdit.make({ offset: tail.offset, length: tail.length + crlfOrLfTerminatorLength, content: "" }) }
      : {}),
  });
};

/**
 * Checks the `...` marker at the tail of the stream.
 *
 * **Details**
 *
 * The rule requires the marker by default when enabled, or forbids it with
 * `present: false`. Only the stream tail is checked; mid-stream markers
 * are document structure. The rule is opt-in and absent from both presets.
 *
 * **Example** (Report document-end violations)
 *
 * ```ts
 * import { documentEnd } from "@beep/yaml/internal/rules/document-end";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({ rules: { "document-end": "error" } });
 * const diagnostics = YamlLint.run("a: 1\n", [documentEnd], config);
 * console.log(diagnostics[0]?.message); // Missing "..." document end marker
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const documentEnd = YamlRule.make({
  id: "document-end",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const opts = P.isObject(options) ? options : {};
    const present = S.is(S.Boolean)(opts.present) ? opts.present : true;
    const tail = lastNonTriviaToken(ctx);
    if (present) return missingEndMarker(ctx, tail);
    return tail?.kind === "document-end" ? [forbiddenEndMarker(ctx, tail)] : [];
  }),
  infer: (ctx) => {
    if (Str.trim(ctx.text) === "") return [];
    const tail = lastNonTriviaToken(ctx);
    if (tail === undefined) return [];
    const ended = tail.kind === "document-end";
    if (ended) {
      return [
        StyleVote.make({
          dimension: "present",
          value: true,
          offset: tail.offset,
          length: tail.length,
          line: tail.line,
          character: tail.character,
        }),
      ];
    }
    return [StyleVote.make({ dimension: "present", value: false, ...endOfStreamPosition(ctx) })];
  },
});
