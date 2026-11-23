import { renderSafeHtml, safeHtmlValue } from "@beep/md/Md.html";
import { MdParseOptions, parseResult, parseSafeResult } from "@beep/md/Md.parse";
import { documentSafetyIssues } from "@beep/md/Md.safe";
import { MdHtmlPolicy, MdUnsafeDocumentError } from "@beep/md/Md.syntax";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { bridgeCorpusLedger, bridgeCorpusRow, bridgeCorpusText } from "./support/bridgeCorpus.ts";
import { CORPUS_INPUTS } from "./support/corpusInputs.ts";
import type { MdParseSafeFailure } from "@beep/md/Md.parse";
import type { SafeDocument } from "@beep/md/Md.safe";

const ROWS = A.map(CORPUS_INPUTS, bridgeCorpusRow);

const isUnsafeDocumentError = S.is(MdUnsafeDocumentError);

const childrenOf = (node: unknown): ReadonlyArray<unknown> =>
  P.hasProperty(node, "children") && A.isArray(node.children) ? node.children : [];

const countTag = (node: unknown, tag: string): number =>
  A.reduce(
    childrenOf(node),
    P.hasProperty(node, "_tag") && node._tag === tag ? 1 : 0,
    (total, child) => total + countTag(child, tag)
  );

const holdsSafeProfile = (result: Result.Result<SafeDocument, MdParseSafeFailure>): boolean =>
  Result.match(result, {
    onSuccess: (document) =>
      A.isReadonlyArrayEmpty(documentSafetyIssues(document)) && P.isString(safeHtmlValue(renderSafeHtml(document))),
    onFailure: (error) => !isUnsafeDocumentError(error) || A.isReadonlyArrayNonEmpty(error.violations),
  });

const MarkdownToken = Arbitrary.schema(
  S.Literals([
    "a",
    " ",
    "\n",
    "\n\n",
    "# ",
    "> ",
    "> [!NOTE] ",
    "- [ ] ",
    "1. ",
    "*",
    "`",
    "$",
    "---",
    "<b>",
    "</b>",
    "<script>",
    "<!-- c -->",
    "<br/>",
    "&amp;",
    "[x](javascript:alert)",
    "![x](data:x)",
    "https://example.com",
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "[^n]",
    "[^n]: note",
    "| a |\n| - |",
    "```js\n",
  ])
);

const MarkdownText = pipe(
  Arbitrary.array(MarkdownToken, { maxLength: 24 }),
  Arbitrary.map((tokens) => A.join(tokens, ""))
);

describe("@beep/md bridge corpus, read from the @beep/markdown/conformance JSON subpaths that Vite inlines at transform time, so no test reads a file", () => {
  it.effect(
    "reproduces the bridge-corpus ledger, a conformance fixture no code reads to excuse a failure, so any bridge behaviour change shows up as a ledger diff in review",
    () =>
      Effect.promise(() =>
        expect(bridgeCorpusText(bridgeCorpusLedger(ROWS))).toMatchFileSnapshot("../data/conformance/bridge-corpus.json")
      )
  );

  it("covers every vendored conformance example", () => {
    expect(bridgeCorpusLedger(ROWS).summary.examples).toStrictEqual({
      commonmark: 652,
      "gfm-extensions": 30,
      "gfm-spec": 22,
      mdast: 27,
    });
  });

  it("parses every corpus example", () => {
    expect(A.filter(ROWS, (row) => row.outcome === "parseError")).toStrictEqual([]);
  });
});

describe("@beep/md safe profile", () => {
  it("never yields an unsafe document from the corpus under any HTML policy", () => {
    for (const input of CORPUS_INPUTS) {
      for (const html of MdHtmlPolicy.literals) {
        expect(holdsSafeProfile(parseSafeResult(input.markdown, { dialect: input.dialect, html }))).toBe(true);
      }
    }
  });

  it("rejects every corpus document that keeps raw HTML", () => {
    const withRawHtml = A.filter(CORPUS_INPUTS, (input) =>
      Result.match(parseResult(input.markdown, { dialect: input.dialect, html: "rawHtml" }), {
        onFailure: () => false,
        onSuccess: (bridged) => countTag(bridged.document, "rawHtml") > 0,
      })
    );
    expect(withRawHtml.length).toBeGreaterThan(0);
    for (const input of withRawHtml) {
      const failureTags = Result.match(parseSafeResult(input.markdown, { dialect: input.dialect, html: "rawHtml" }), {
        onSuccess: () => A.empty<string>(),
        onFailure: (error) =>
          isUnsafeDocumentError(error) ? A.map(error.violations, (violation) => violation._tag) : [error._tag],
      });
      expect(failureTags).toContain("RawNode");
    }
  });

  it.prop(
    "never yields an unsafe document from generated text",
    [MarkdownText, Arbitrary.schema(MdParseOptions)],
    ([text, options]) => holdsSafeProfile(parseSafeResult(text, options)),
    { arbitrary: { ...fcRuns(300), seed: 2_082 } }
  );
});
