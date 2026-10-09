/**
 * Test data loaders for the vendored CommonMark and GFM conformance corpora.
 *
 * Reads the generated `spec.json` fixture at
 * `__test__/fixtures/commonmark/spec.json` (see VENDORED.md there) — one
 * entry per embedded CommonMark 0.31.2 spec example — and the two GFM
 * fixtures at `__test__/fixtures/gfm/` (see VENDORED.md there): the
 * extension-section examples from cmark-gfm's `spec.txt` and the full
 * `extensions.txt` corpus (including the only official footnote examples).
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/** Root directory of the vendored CommonMark conformance fixtures. */
export const COMMONMARK_FIXTURES_DIR = resolve(import.meta.dirname, "../../fixtures/commonmark");

/** Root directory of the vendored GFM conformance fixtures. */
export const GFM_FIXTURES_DIR = resolve(import.meta.dirname, "../../fixtures/gfm");

/** A single CommonMark spec conformance example. */
export interface SpecExample {
	readonly markdown: string;
	readonly html: string;
	readonly example: number;
	readonly section: string;
}

/** Shape of a `spec.json` entry as produced by upstream's `spec_tests.py --dump-tests`. */
interface RawSpecExample {
	readonly markdown: string;
	readonly html: string;
	readonly example: number;
	readonly start_line: number;
	readonly end_line: number;
	readonly section: string;
}

/**
 * Load the 652-example CommonMark 0.31.2 conformance corpus from the
 * vendored `spec.json` fixture, narrowed to the package's `SpecExample`
 * shape (upstream's `start_line`/`end_line` are dropped — nothing under
 * `__test__/` consumes them).
 */
export const loadSpecExamples = (): ReadonlyArray<SpecExample> => {
	const raw = readFileSync(resolve(COMMONMARK_FIXTURES_DIR, "spec.json"), "utf8");
	const examples = JSON.parse(raw) as ReadonlyArray<RawSpecExample>;
	return examples.map(({ markdown, html, example, section }) => ({ markdown, html, example, section }));
};

/**
 * Load the 22-example GFM extension-section conformance corpus (Tables,
 * Strikethrough, Autolinks, Disallowed Raw HTML) from the vendored
 * `spec-extensions.json` fixture, narrowed to the package's `SpecExample`
 * shape. See `fixtures/gfm/VENDORED.md` for the extraction method and the
 * discrepancy against the P2 plan's 24-example estimate (the "Task list
 * items (extension)" section's two examples are marked disabled upstream
 * and excluded).
 */
export const loadGfmSpecExtensionExamples = (): ReadonlyArray<SpecExample> => {
	const raw = readFileSync(resolve(GFM_FIXTURES_DIR, "spec-extensions.json"), "utf8");
	const examples = JSON.parse(raw) as ReadonlyArray<RawSpecExample>;
	return examples.map(({ markdown, html, example, section }) => ({ markdown, html, example, section }));
};

/**
 * Load the 30-example `extensions.txt` conformance corpus (Tables,
 * Strikethroughs, Autolinks, HTML tag filter, Footnotes, Interop, Task
 * lists — the only official footnote corpus) from the vendored
 * `extensions.json` fixture, narrowed to the package's `SpecExample` shape.
 */
export const loadGfmExtensionsExamples = (): ReadonlyArray<SpecExample> => {
	const raw = readFileSync(resolve(GFM_FIXTURES_DIR, "extensions.json"), "utf8");
	const examples = JSON.parse(raw) as ReadonlyArray<RawSpecExample>;
	return examples.map(({ markdown, html, example, section }) => ({ markdown, html, example, section }));
};

/** Root directory of the vendored mdast interop fixtures. */
export const MDAST_FIXTURES_DIR = resolve(import.meta.dirname, "../../fixtures/mdast");

/** One vendored mdast interop fixture: a source and its reference tree. */
export interface MdastFixturePair {
	readonly name: string;
	readonly markdown: string;
	readonly tree: unknown;
}

/**
 * Load the 27 position-complete `.md`/`.json` interop fixture pairs vendored
 * from `mdast-util-from-markdown@2.0.3` (see `fixtures/mdast/VENDORED.md`).
 * Each pair carries the fixture's markdown source and the reference mdast
 * tree the upstream utility produces for it, positions included.
 */
export const loadMdastFixturePairs = (): ReadonlyArray<MdastFixturePair> =>
	readdirSync(MDAST_FIXTURES_DIR)
		.filter((file) => file.endsWith(".md") && file !== "VENDORED.md")
		.map((file) => file.slice(0, -3))
		.sort()
		.map((name) => ({
			name,
			markdown: readFileSync(resolve(MDAST_FIXTURES_DIR, `${name}.md`), "utf8"),
			tree: JSON.parse(readFileSync(resolve(MDAST_FIXTURES_DIR, `${name}.json`), "utf8")) as unknown,
		}));
