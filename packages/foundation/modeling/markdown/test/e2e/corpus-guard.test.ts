import { assert, describe, it } from "@effect/vitest";
import {
  loadGfmExtensionsExamples,
  loadGfmSpecExtensionExamples,
  loadMdastFixturePairs,
  loadSpecExamples,
} from "../support/corpus.ts";
import { PATHOLOGICAL_CASES } from "../support/pathological/cases.ts";

const SPEC_EXAMPLE_COUNT = 652;

const GFM_SPEC_EXTENSION_EXAMPLE_COUNT = 22;

const GFM_EXTENSIONS_EXAMPLE_COUNT = 30;

const MIN_PATHOLOGICAL_CASE_COUNT = 20;

const MDAST_FIXTURE_PAIR_COUNT = 27;

describe("conformance corpus guard: a truncated or emptied vendored corpus fails here, not as a zero-example suite", () => {
  it("loads exactly the 652-example CommonMark spec corpus", () => {
    assert.strictEqual(loadSpecExamples().length, SPEC_EXAMPLE_COUNT);
  });

  it("loads exactly the 22-example GFM spec extension-section corpus", () => {
    assert.strictEqual(
      loadGfmSpecExtensionExamples().length,
      GFM_SPEC_EXTENSION_EXAMPLE_COUNT,
      "Tables, Strikethrough, Autolinks, Disallowed Raw HTML; the two upstream-disabled task-list examples are not extracted"
    );
  });

  it("loads exactly the 30-example GFM extensions.txt corpus", () => {
    assert.strictEqual(
      loadGfmExtensionsExamples().length,
      GFM_EXTENSIONS_EXAMPLE_COUNT,
      "extensions.txt in full, holding the only official footnote conformance examples"
    );
  });

  it("loads at least 20 pathological cases", () => {
    assert.isAtLeast(
      PATHOLOGICAL_CASES.length,
      MIN_PATHOLOGICAL_CASE_COUNT,
      "the cmark-gfm suite, its GFM tables case included, minus the upstream-disabled many-references case"
    );
  });

  it("loads exactly the 27-pair mdast interop fixture corpus", () => {
    const pairs = loadMdastFixturePairs();
    assert.strictEqual(
      pairs.length,
      MDAST_FIXTURE_PAIR_COUNT,
      "mdast-util-from-markdown@2.0.3 .md/.json pairs with full unist positions"
    );
    for (const pair of pairs) {
      assert.isObject(pair.tree, `${pair.name}.json parsed to a tree`);
    }
  });
});
