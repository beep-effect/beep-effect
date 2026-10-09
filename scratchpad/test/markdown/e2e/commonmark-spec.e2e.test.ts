// The CommonMark 0.31.2 conformance harness.
//
// One test per spec example: our tree, rendered by the test-only HTML writer
// and normalized, must equal the spec's expected HTML normalized the same way
// (the mdast-util-from-markdown precedent — the package ships no HTML).
//
// All 652 examples run and all 652 pass. There is no skip map and no
// per-example deferral list: both existed while the parser was being built
// task by task, and both are gone. `SECTIONS_GREEN` stays as a tripwire — the
// gate below fails if a section ever leaves it, so a future dialect cannot
// quietly drop a section's coverage to make a change land.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../../effected/markdown/internal/blockParser.ts";
import type { SpecExample } from "./support/corpus.ts";
import { loadSpecExamples } from "./support/corpus.ts";
import { renderHtml } from "./support/htmlWriter.ts";
import { normalizeHtml } from "./support/normalizeHtml.ts";

/** Every section of the spec. All of them run. */
const SECTIONS_GREEN: ReadonlyArray<string> = [
	"Tabs",
	"Backslash escapes",
	"Entity and numeric character references",
	"Precedence",
	"Thematic breaks",
	"ATX headings",
	"Setext headings",
	"Indented code blocks",
	"Fenced code blocks",
	"HTML blocks",
	"Link reference definitions",
	"Paragraphs",
	"Blank lines",
	"Block quotes",
	"List items",
	"Lists",
	"Inlines",
	"Code spans",
	"Emphasis and strong emphasis",
	"Links",
	"Images",
	"Autolinks",
	"Raw HTML",
	"Hard line breaks",
	"Soft line breaks",
	"Textual content",
];

const bySection = (examples: ReadonlyArray<SpecExample>): ReadonlyMap<string, ReadonlyArray<SpecExample>> => {
	const sections = new Map<string, SpecExample[]>();
	for (const example of examples) {
		const bucket = sections.get(example.section);
		if (bucket === undefined) {
			sections.set(example.section, [example]);
		} else {
			bucket.push(example);
		}
	}
	return sections;
};

const examples = loadSpecExamples();
const sections = bySection(examples);

describe("CommonMark 0.31.2 conformance", () => {
	describe("gate", () => {
		it("allowlists only sections the corpus actually has", () => {
			for (const section of SECTIONS_GREEN) {
				assert.isTrue(sections.has(section), `SECTIONS_GREEN names a section the corpus does not: ${section}`);
			}
		});

		it("runs every section the corpus has", () => {
			// The empty-skip-map goal, as an assertion: a section missing from
			// the allowlist would silently stop being tested.
			for (const section of sections.keys()) {
				assert.isTrue(
					SECTIONS_GREEN.includes(section),
					`the corpus has a section the harness does not run: ${section}`,
				);
			}
		});
	});

	for (const [section, sectionExamples] of sections) {
		describe(section, () => {
			for (const example of sectionExamples) {
				it(`example ${example.example}`, () => {
					const actual = normalizeHtml(renderHtml(parseBlocks(example.markdown).root));
					assert.strictEqual(actual, normalizeHtml(example.html));
				});
			}
		});
	}
});
