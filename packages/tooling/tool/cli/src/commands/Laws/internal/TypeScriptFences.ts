/**
 * Shared TypeScript fence extraction for the Markdown-aware laws.
 *
 * **Details**
 *
 * The fences are `@beep/markdown`'s `MarkdownFence.fences`: every backtick or
 * tilde fence a CommonMark/GFM parse opens, including fences inside list items
 * and blockquotes and fences the text ends before a closing fence. A fence
 * counts when its info string starts with a language word, with no space after
 * the marker run: `typescript`, `tsx`, `mts`, `cts` or `ts` for
 * {@link typescriptFences}, and those plus `javascript`, `jsx`, `mjs`, `cjs`
 * and `js` for {@link scriptFences}. The schema tag idiom law, the Markdown
 * fence typecheck law and the root Effect import law read fences through this
 * module, so they agree on which blocks are code.
 *
 * Both extractors return `[fences, warnings]`. A text with no run of three
 * backticks or tildes holds no fence and is not parsed. A text the parser
 * refuses (its nesting or inline guards tripped) yields no fences and one
 * warning, which every law reports as a finding instead of passing the file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFence } from "@beep/markdown/MarkdownFence";
import { A, Str } from "@beep/utils";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { CodeFence } from "@beep/markdown/MarkdownFence";

const $I = $RepoCliId.create("commands/Laws/internal/TypeScriptFences");

const FENCE_RUN = /`{3}|~{3}/u;
const TYPESCRIPT_LANGUAGE = /^(typescript|tsx|mts|cts|ts)(?![\w-])/iu;
const SCRIPT_LANGUAGE = /^(typescript|javascript|tsx|jsx|mts|cts|mjs|cjs|ts|js)(?![\w-])/iu;

/**
 * One TypeScript fence found in a Markdown or JSDoc text.
 *
 * **Details**
 *
 * `language` is the lowercased language word; `infoString` is the whole
 * trimmed info string after the opening marker run, language word included.
 * `code` is the body as CommonMark reads it, so a fence inside a blockquote or
 * list item loses its container prefix and indentation line by line.
 * `openingLineIndex` is the 0-based line of the opening fence and
 * `codeLineIndex` the 0-based line where the body starts.
 *
 * **Example** (Describe a fence)
 *
 * ```ts
 * import { TypeScriptFence } from "@beep/repo-cli/test/Laws"
 *
 * const fence = TypeScriptFence.make({
 *   code: "const a = 1\n",
 *   infoString: "ts",
 *   language: "ts",
 *   openingLineIndex: 0,
 *   codeLineIndex: 1,
 * })
 * console.log(fence.codeLineIndex) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypeScriptFence extends S.Opaque<TypeScriptFence, { readonly brand: unique symbol }>()(
  S.Struct({
    code: S.String,
    infoString: S.String,
    language: S.String,
    openingLineIndex: S.Int,
    codeLineIndex: S.Int,
  }).pipe(
    $I.annoteSchema("TypeScriptFence", {
      description: "One TypeScript fence of a Markdown or JSDoc text with its info string and 0-based line indexes.",
    })
  )
) {}

/**
 * One TypeScript or JavaScript fence with the source span of its body.
 *
 * **Details**
 *
 * `code` is the body as CommonMark reads it (container prefixes and fence
 * indentation removed). `codeStart` and `codeEnd` are the half-open span of the
 * body as written, from the line after the opening fence up to the closing
 * fence's line. `inPlace` is `true` when the written body is `code` (a closed,
 * unindented, top-level fence, CRLF read as LF), so a rewrite of `code` can be
 * spliced back into the span; for any other fence a splice would drop the
 * container prefixes, so a rewrite must be done by hand.
 *
 * **Example** (Describe a script fence)
 *
 * ```ts import.meta.vitest name="Describe a script fence"
 * import { ScriptFence } from "@beep/repo-cli/test/Laws"
 *
 * const fence = ScriptFence.make({ code: "const a = 1\n", codeStart: 6, codeEnd: 18, extension: ".ts", inPlace: true })
 * fence.codeEnd - fence.codeStart // => 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScriptFence extends S.Opaque<ScriptFence, { readonly brand: unique symbol }>()(
  S.Struct({
    code: S.String,
    codeStart: S.Natural,
    codeEnd: S.Natural,
    extension: S.Literals([".ts", ".tsx"]),
    inPlace: S.Boolean,
  }).pipe(
    $I.annoteSchema("ScriptFence", {
      description:
        "One TypeScript or JavaScript fence body as CommonMark reads it, with its half-open written span, parse extension and whether the span holds that body verbatim.",
    })
  )
) {}

type LanguageFence = { readonly fence: CodeFence; readonly language: string };

// The fences whose info string opens with a language word `pattern` captures, with that word lowercased,
// and the parse failure as a warning (with no fences) when the parser refused the text.
const fencesWithLanguage = (
  content: string,
  pattern: RegExp
): readonly [fences: ReadonlyArray<LanguageFence>, warnings: ReadonlyArray<string>] =>
  FENCE_RUN.test(content)
    ? Result.match(MarkdownDocument.parseResult(content), {
        onFailure: (error): readonly [ReadonlyArray<LanguageFence>, ReadonlyArray<string>] => [
          A.empty(),
          A.of(`cannot read fences: ${error.message}`),
        ],
        onSuccess: (document): readonly [ReadonlyArray<LanguageFence>, ReadonlyArray<string>] => [
          A.getSomes(
            A.map(MarkdownFence.fences(document), (fence) =>
              O.map(O.fromNullishOr(pattern.exec(fence.infoString)?.[1]), (word) => ({
                fence,
                language: Str.toLowerCase(word),
              }))
            )
          ),
          A.empty(),
        ],
      })
    : [A.empty(), A.empty()];

/**
 * Extract every TypeScript fence of a Markdown or JSDoc text.
 *
 * **Example** (Read a fence's info string and body line)
 *
 * ```ts import.meta.vitest name="Read a fence's info string and body line"
 * import { typescriptFences } from "@beep/repo-cli/test/Laws"
 *
 * const fence = "`".repeat(3)
 * const [[first]] = typescriptFences(["# Title", `${fence}ts skip-type-checking`, "const a = 1", fence].join("\n"))
 * console.log(first?.infoString, first?.codeLineIndex) // "ts skip-type-checking" 2
 * ```
 *
 * @param content - Markdown or JSDoc text.
 * @returns Fences in source order, and one warning when the text cannot be parsed.
 * @category utilities
 * @since 0.0.0
 */
export const typescriptFences = (
  content: string
): readonly [fences: ReadonlyArray<TypeScriptFence>, warnings: ReadonlyArray<string>] => {
  const [fences, warnings] = fencesWithLanguage(content, TYPESCRIPT_LANGUAGE);
  return [
    A.map(fences, ({ fence, language }) =>
      TypeScriptFence.make({
        code: fence.value,
        infoString: Str.trim(fence.infoString),
        language,
        openingLineIndex: fence.line,
        codeLineIndex: fence.line + 1,
      })
    ),
    warnings,
  ];
};

/**
 * Extract every TypeScript or JavaScript fence of a Markdown text with its body span.
 *
 * **Example** (Read a JavaScript fence's span)
 *
 * ```ts
 * import { scriptFences } from "@beep/repo-cli/test/Laws"
 *
 * const fence = "`".repeat(3)
 * const [[first]] = scriptFences([`${fence}jsx`, "const a = <b />", fence].join("\n"))
 * console.log(first?.extension, first?.codeStart, first?.inPlace) // ".tsx" 7 true
 * ```
 *
 * @param content - Markdown text.
 * @returns Fences in source order, and one warning when the text cannot be parsed.
 * @category utilities
 * @since 0.0.0
 */
export const scriptFences = (
  content: string
): readonly [fences: ReadonlyArray<ScriptFence>, warnings: ReadonlyArray<string>] => {
  const [fences, warnings] = fencesWithLanguage(content, SCRIPT_LANGUAGE);
  return [
    A.map(fences, ({ fence, language }) =>
      ScriptFence.make({
        code: fence.value,
        codeStart: fence.bodyStart,
        codeEnd: fence.bodyEnd,
        extension: language === "tsx" || language === "jsx" ? ".tsx" : ".ts",
        inPlace: !fence.unterminated && Str.replace(/\r\n?/gu, "\n")(fence.body) === fence.value,
      })
    ),
    warnings,
  ];
};
