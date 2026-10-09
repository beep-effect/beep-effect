// The silently-empty-walk guard (toml precedent): asserts the vendored
// corpora actually loaded their full expected counts before any conformance
// harness is built on top of them. A regenerated or truncated spec.json, or
// an accidentally-emptied pathological case list, fails loudly here instead
// of silently passing zero-example test suites downstream.

import { assert, describe, it } from "@effect/vitest";
import {
	loadGfmExtensionsExamples,
	loadGfmSpecExtensionExamples,
	loadMdastFixturePairs,
	loadSpecExamples,
} from "./support/corpus.ts";
import { PATHOLOGICAL_CASES } from "./support/pathological/cases.ts";

// The CommonMark 0.31.2 spec embeds exactly 652 conformance examples.
const SPEC_EXAMPLE_COUNT = 652;

// cmark-gfm's spec.txt extension sections (Tables, Strikethrough, Autolinks,
// Disallowed Raw HTML), 22 examples — NOT the plan's estimated 24: the
// "Task list items (extension)" section's two examples are marked disabled
// upstream and excluded by extraction (see fixtures/gfm/VENDORED.md).
const GFM_SPEC_EXTENSION_EXAMPLE_COUNT = 22;

// cmark-gfm's extensions.txt corpus in full, incl. the only official
// footnote conformance examples.
const GFM_EXTENSIONS_EXAMPLE_COUNT = 30;

// The cmark-gfm pathological suite minus the GFM-only "tables" case and the
// upstream-disabled "many references" case (see support/pathological/VENDORED.md).
const MIN_PATHOLOGICAL_CASE_COUNT = 20;

// The mdast-util-from-markdown@2.0.3 interop fixture corpus: 27 .md/.json
// pairs with full unist positions (see fixtures/mdast/VENDORED.md).
const MDAST_FIXTURE_PAIR_COUNT = 27;

describe("conformance corpus guard", () => {
	it("loads exactly the 652-example CommonMark spec corpus", () => {
		assert.strictEqual(loadSpecExamples().length, SPEC_EXAMPLE_COUNT);
	});

	it("loads exactly the 22-example GFM spec extension-section corpus", () => {
		assert.strictEqual(loadGfmSpecExtensionExamples().length, GFM_SPEC_EXTENSION_EXAMPLE_COUNT);
	});

	it("loads exactly the 30-example GFM extensions.txt corpus", () => {
		assert.strictEqual(loadGfmExtensionsExamples().length, GFM_EXTENSIONS_EXAMPLE_COUNT);
	});

	it("loads at least 20 pathological cases", () => {
		assert.isAtLeast(PATHOLOGICAL_CASES.length, MIN_PATHOLOGICAL_CASE_COUNT);
	});

	it("loads exactly the 27-pair mdast interop fixture corpus", () => {
		const pairs = loadMdastFixturePairs();
		assert.strictEqual(pairs.length, MDAST_FIXTURE_PAIR_COUNT);
		for (const pair of pairs) {
			assert.isObject(pair.tree, `${pair.name}.json parsed to a tree`);
		}
	});
});
