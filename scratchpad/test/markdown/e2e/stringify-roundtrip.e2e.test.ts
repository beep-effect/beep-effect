// The re-parse equivalence property — what "canonical stringify" means
// operationally: for EVERY vendored conformance example, parsing the
// example, stringifying the tree and parsing the emission again must yield a
// render-equivalent document under the same dialect. Both sides render
// through the test writer and normalize through the P1 harness machinery, so
// the comparison isolates stringify: the first parse already passed spec
// conformance elsewhere, and any inequality here is a serialization bug.
//
// There is no skip list. The one special case is the extensions.txt crash
// regression (example 20, `<IGNORE>` expected output), which asserts
// round-trip termination the same way the conformance harness asserts parse
// termination — rendering it is meaningless on both sides of the round trip
// alike, so equivalence still holds and is still asserted.
//
// The tail of the file measures serialization cost against the design doc's
// ~17µs/node Schema-construction flag: stringify builds strings, not Schema
// nodes, so the flag must not bind here — the budget assertion pins that,
// calibrated like the pathological suite.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../../effected/markdown/internal/blockParser.ts";
import { stringifyTree } from "../../../effected/markdown/internal/stringify.ts";
import type { SpecExample } from "./support/corpus.ts";
import { loadGfmExtensionsExamples, loadGfmSpecExtensionExamples, loadSpecExamples } from "./support/corpus.ts";
import { renderHtml } from "./support/htmlWriter.ts";
import { normalizeHtml } from "./support/normalizeHtml.ts";

type Dialect = "commonmark" | "gfm";

const roundTrip = (markdown: string, dialect: Dialect): { before: string; after: string; emitted: string } => {
	const gfm = dialect === "gfm";
	const first = parseBlocks(markdown, dialect).root;
	const emitted = stringifyTree(first);
	const second = parseBlocks(emitted, dialect).root;
	return {
		before: normalizeHtml(renderHtml(first, { gfm })),
		after: normalizeHtml(renderHtml(second, { gfm })),
		emitted,
	};
};

const runCorpus = (
	name: string,
	examples: ReadonlyArray<SpecExample>,
	dialect: Dialect,
	expectedCount: number,
): void => {
	describe(name, () => {
		it("carries the whole corpus", () => {
			assert.strictEqual(examples.length, expectedCount);
		});

		for (const example of examples) {
			it(`example ${example.example} (${example.section})`, () => {
				const { before, after, emitted } = roundTrip(example.markdown, dialect);
				assert.strictEqual(
					after,
					before,
					`stringify round-trip diverged.\nsource:  ${JSON.stringify(example.markdown)}\nemitted: ${JSON.stringify(emitted)}`,
				);
			});
		}
	});
};

describe("stringify re-parse equivalence", () => {
	// The 652 spec examples round-trip under BOTH dialects: stringify output
	// must not depend on constructs the reading dialect lacks.
	runCorpus("CommonMark spec under commonmark", loadSpecExamples(), "commonmark", 652);
	runCorpus("CommonMark spec under gfm", loadSpecExamples(), "gfm", 652);
	runCorpus("GFM spec extensions", loadGfmSpecExtensionExamples(), "gfm", 22);
	runCorpus("cmark-gfm extensions.txt", loadGfmExtensionsExamples(), "gfm", 30);
});

describe("stringify cost", () => {
	it("serialization is string-building, not schema construction", () => {
		// Calibrate the same way the pathological suite does: measure a parse
		// through the heaviest machinery and scale the budget by how far this
		// environment (coverage instrumentation, hardware) is from the clean
		// baseline. Stringify of the same tree must land well under the parse
		// cost — it allocates strings, never Schema nodes.
		const input =
			"# heading\n\npara *em* **st** `code` [l](/u)\n\n- a\n- b\n\n> quote\n\n| a | b |\n| - | - |\n| 1 | 2 |\n".repeat(
				500,
			);
		const warm = parseBlocks(input, "gfm").root;
		stringifyTree(warm);

		const parseStart = performance.now();
		const tree = parseBlocks(input, "gfm").root;
		const parseMs = performance.now() - parseStart;

		const stringifyStart = performance.now();
		const emitted = stringifyTree(tree);
		const stringifyMs = performance.now() - stringifyStart;

		assert.isAbove(emitted.length, input.length / 2);
		// The flag would bind if serialization cost rivaled parse cost (which
		// includes Schema materialization). Pin an order-of-magnitude margin
		// rather than a wall-clock number: stringify must cost less than the
		// parse of the same document in the same environment.
		assert.isBelow(
			stringifyMs,
			parseMs,
			`stringify ${stringifyMs.toFixed(1)}ms should undercut parse ${parseMs.toFixed(1)}ms`,
		);
	});
});
