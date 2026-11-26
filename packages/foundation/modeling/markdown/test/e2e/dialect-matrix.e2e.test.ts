import { parseBlocks } from "@beep/markdown/internal/blockParser";
import { assert, describe, it } from "@effect/vitest";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import { loadSpecExamples } from "../support/corpus.ts";
import { renderHtml } from "../support/htmlWriter.ts";
import { normalizeHtml } from "../support/normalizeHtml.ts";

const EXPECTED_GFM_DIVERGENT: HashMap.HashMap<number, string> = HashMap.make(
  [170, "tagfilter: <script> block"],
  [171, "tagfilter: <textarea> block"],
  [172, "tagfilter: <style> block"],
  [173, "tagfilter: unclosed <style> block"],
  [176, "tagfilter: one-line <style> block"],
  [178, "tagfilter: <script> block closed mid-line"],
  [602, "autolink literal: URL inside an invalid <> autolink"],
  [608, "autolink literal: URL inside a spaced-out <> non-autolink"],
  [611, "autolink literal: bare URL"],
  [612, "autolink literal: bare email address"]
);

const examples = loadSpecExamples();

describe("dialect matrix: commonmark vs gfm over the spec corpus, each side through its full parse-and-render pipeline", () => {
  it("runs the whole corpus", () => {
    assert.strictEqual(examples.length, 652, "silently-empty-walk guard");
  });

  for (const example of examples) {
    const expectation = O.getOrUndefined(HashMap.get(EXPECTED_GFM_DIVERGENT, example.example));
    it(`example ${example.example}${expectation === undefined ? "" : ` diverges (${expectation})`}`, () => {
      const commonmark = normalizeHtml(renderHtml(parseBlocks(example.markdown, { dialect: "commonmark" }).root));
      const gfm = normalizeHtml(renderHtml(parseBlocks(example.markdown, { dialect: "gfm" }).root, { gfm: true }));
      if (expectation === undefined) {
        assert.strictEqual(
          gfm,
          commonmark,
          `dialects diverge on an example not in EXPECTED_GFM_DIVERGENT: gfm must stay additive over the commonmark substrate, and its side renders in gfm mode because the tagfilter is GFM output contract, not parse behavior`
        );
      } else {
        assert.notStrictEqual(
          gfm,
          commonmark,
          `listed as divergent (${expectation}) but the dialects agree — stale entry that would hide a construct silently switching off`
        );
      }
    });
  }
});
