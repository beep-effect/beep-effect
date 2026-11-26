import { Markdown, MarkdownParseOptions } from "@beep/markdown/Markdown";
import { Mdast } from "@beep/markdown/Mdast";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { loadMdastFixturePairs } from "../support/corpus.ts";

const options = MarkdownParseOptions.make({ dialect: "commonmark" });

const INLINE_CODE_LINE_ENDING_AND_INDENT = /\r?\n[ \t]*/g;
const TEXT_TRAILING_BLANKS = /[ \t]+\n/g;
const LABEL_CONTINUATION_INDENT = /\n[ \t]+/g;
const LABEL_INDENT = /\n[ \t]+/;

const maskString = (type: unknown, key: string, value: string): string => {
  if (key === "label") return Str.replace(LABEL_CONTINUATION_INDENT, "\n")(value);
  if (key !== "value") return value;
  if (type === "inlineCode") return Str.replace(INLINE_CODE_LINE_ENDING_AND_INDENT, " ")(value);
  return type === "text" ? Str.replace(TEXT_TRAILING_BLANKS, "\n")(value) : value;
};

const normalizeForComparison = (node: unknown): unknown => {
  if (A.isArray(node)) return A.map(node, normalizeForComparison);
  if (!P.isObject(node)) return node;
  const type = node.type;
  return R.map(node, (value: unknown, key: string) =>
    P.isString(value) ? maskString(type, key, value) : normalizeForComparison(value)
  );
};

const parseFixture = (markdown: string) => {
  const parsed = Markdown.parseResult(markdown, options);
  assert.isTrue(Result.isSuccess(parsed));
  if (Result.isFailure(parsed)) assert.fail("expected a successful fixture parse");
  return Mdast.toMdast(parsed.success);
};

const values = (tree: unknown, type: string, field: "value" | "label"): ReadonlyArray<string> => {
  if (A.isArray(tree)) return A.flatMap(tree, (item) => values(item, type, field));
  if (!P.isObject(tree)) return [];
  const own = tree[field];
  const children = A.flatMap(R.values(tree), (value) => values(value, type, field));
  return tree.type === type && P.isString(own) ? A.prepend(children, own) : children;
};

const hasLineEnding = Str.includes("\n");
const hasTabBeforeLineEnding = Str.includes("\t\n");
const hasIndentedContinuation = (label: string): boolean => LABEL_INDENT.test(label);

describe("mdast interop corpus: the projection deep-equals mdast-util-from-markdown@2.0.3's tree, positions included", () => {
  const pairs = loadMdastFixturePairs();

  for (const pair of pairs) {
    it(`projects ${pair.name} to the reference tree`, () => {
      assert.deepStrictEqual(
        normalizeForComparison(parseFixture(pair.markdown)),
        normalizeForComparison(pair.tree),
        "CommonMark-only fixtures generated with frontmatter capture off; both trees mask only the three engine-lineage divergences"
      );
    });
  }

  describe("divergence tripwires", () => {
    const fixture = (name: string) =>
      O.getOrThrowWith(
        A.findFirst(pairs, (candidate) => candidate.name === name),
        () => new Error(`no mdast fixture named ${name}`)
      );

    it("pins the inlineCode line-ending divergence on code-text", () => {
      const pair = fixture("code-text");
      assert.isTrue(
        A.some(values(pair.tree, "inlineCode", "value"), hasLineEnding),
        'micromark stores the raw line ending ("g\\n")'
      );
      const ours = values(parseFixture(pair.markdown), "inlineCode", "value");
      assert.isFalse(
        A.some(ours, hasLineEnding),
        'the spec\'s code-span rule converts line endings to spaces and commonmark.js stores that ("g "); if either side changes, delete the first mask clause and this'
      );
    });

    it("pins the soft-break trailing-tab divergence on hard-break-prefix", () => {
      const pair = fixture("hard-break-prefix");
      assert.isTrue(
        A.some(values(parseFixture(pair.markdown), "text", "value"), hasTabBeforeLineEnding),
        'commonmark.js strips only trailing spaces before a soft break, keeping a tab ("g\\t\\nh")'
      );
      assert.isFalse(
        A.some(values(pair.tree, "text", "value"), hasTabBeforeLineEnding),
        'micromark strips tabs too ("g\\nh"); if either side changes, delete the second mask clause and this'
      );
    });

    it("pins the multiline-label indentation divergence on character-references-everywhere", () => {
      const pair = fixture("character-references-everywhere");
      assert.isTrue(
        A.some(values(pair.tree, "definition", "label"), hasIndentedContinuation),
        "micromark preserves continuation-line indentation inside a multiline label"
      );
      const ours = values(parseFixture(pair.markdown), "definition", "label");
      assert.isFalse(
        A.some(ours, hasIndentedContinuation),
        "commonmark.js's paragraph accumulation strips it; if either side changes, delete the third mask clause and this"
      );
    });
  });
});
