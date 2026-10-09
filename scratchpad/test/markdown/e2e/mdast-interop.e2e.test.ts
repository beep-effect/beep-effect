// The mdast interop harness: parse each vendored fixture's markdown with
// this package's parser, project through Mdast.toMdast, and deep-equal the
// reference tree mdast-util-from-markdown@2.0.3 produced for the same
// source — positions included. AST-plus-position equality is strictly
// stronger than render equivalence: it proves the projected trees are
// drop-in mdast for the remark ecosystem.
//
// The fixtures exercise CommonMark shapes only (upstream's core loads no
// GFM extensions), so every fixture parses under dialect "commonmark" with
// frontmatter capture off — the configuration upstream generated the .json
// files with. See fixtures/mdast/VENDORED.md.
//
// KNOWN ENGINE-LINEAGE DIVERGENCES. This engine is a commonmark.js port;
// the fixtures come from micromark. The two reference implementations agree
// on rendered HTML but disagree on three stored-value details, all
// whitespace-shaped, none reachable from the mdast readme's field
// contracts. Each is masked by `normalizeForComparison` — applied to BOTH
// trees so it can hide only these exact classes — and each is pinned by a
// tripwire test below that fails if either side ever changes:
//
// 1. inlineCode values: the CommonMark spec's code-span rule converts
//    interior line endings to spaces and commonmark.js stores the converted
//    form (ours: `"g "`); micromark stores the raw line ending (`"g\n"`).
// 2. text values at soft breaks: commonmark.js strips only trailing
//    *spaces* before a soft break, keeping a trailing tab (ours:
//    `"g\t\nh"`); micromark strips tabs too (`"g\nh"`).
// 3. multiline reference labels: commonmark.js's paragraph accumulation
//    strips continuation-line indentation, so a label spanning lines loses
//    it (ours: `"\n1\n"`); micromark preserves the source indentation
//    (`"\n  1\n"`).

import { assert, describe, it } from "@effect/vitest";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import { Markdown, MarkdownParseOptions } from "../../../effected/markdown/Markdown.ts";
import { Mdast } from "../../../effected/markdown/Mdast.ts";
import { loadMdastFixturePairs } from "./support/corpus.ts";

const options = MarkdownParseOptions.make({ dialect: "commonmark" });

/**
 * Mask the three documented divergences, on both trees: inlineCode line
 * endings to spaces, text trailing tabs/spaces before a line ending
 * stripped, label continuation-line indentation collapsed. Everything else
 * — every other field, every position — passes through untouched.
 */
const normalizeForComparison = (node: unknown): unknown => {
	if (Array.isArray(node)) {
		return node.map(normalizeForComparison);
	}
	if (!P.isObject(node)) {
		return node;
	}
	const record = node;
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record)) {
		if (key === "value" && record.type === "inlineCode" && typeof value === "string") {
			// Divergences 1 and 3 combined: the line ending becomes a space
			// and any continuation-line indentation after it (which this
			// engine's paragraph accumulation strips) is swallowed with it.
			out[key] = value.replace(/\r?\n[ \t]*/g, " ");
		} else if (key === "value" && record.type === "text" && typeof value === "string") {
			out[key] = value.replace(/[ \t]+\n/g, "\n");
		} else if (key === "label" && typeof value === "string") {
			out[key] = value.replace(/\n[ \t]+/g, "\n");
		} else {
			out[key] = normalizeForComparison(value);
		}
	}
	return out;
};

const parseFixture = (markdown: string) => {
	const parsed = Markdown.parseResult(markdown, options);
	assert.isTrue(Result.isSuccess(parsed));
	if (Result.isFailure(parsed)) assert.fail("expected a successful fixture parse");
	return Mdast.toMdast(parsed.success);
};

const values = (tree: unknown, type: string, field: "value" | "label"): string[] => {
	const out: string[] = [];
	const walk = (n: unknown): void => {
		if (Array.isArray(n)) {
			for (const item of n) {
				walk(item);
			}
			return;
		}
		if (P.isObject(n)) {
			const record = n;
			if (record.type === type && typeof record[field] === "string") {
				out.push(record[field]);
			}
			for (const value of Object.values(record)) {
				walk(value);
			}
		}
	};
	walk(tree);
	return out;
};

describe("mdast interop corpus", () => {
	const pairs = loadMdastFixturePairs();

	for (const pair of pairs) {
		it(`projects ${pair.name} to the reference tree`, () => {
			assert.deepStrictEqual(normalizeForComparison(parseFixture(pair.markdown)), normalizeForComparison(pair.tree));
		});
	}

	describe("divergence tripwires", () => {
		const fixture = (name: string) => {
			const pair = pairs.find((candidate) => candidate.name === name);
			assert.isDefined(pair);
			return pair;
		};

		it("pins the inlineCode line-ending divergence on code-text", () => {
			const pair = fixture("code-text");
			// micromark stores the raw line ending; this engine stores the
			// spec's space-converted form. If either side changes, the
			// normalizer's first clause is dead weight — delete it and this.
			assert.isTrue(values(pair.tree, "inlineCode", "value").some((value) => value.includes("\n")));
			const ours = values(parseFixture(pair.markdown), "inlineCode", "value");
			assert.isFalse(ours.some((value) => value.includes("\n")));
		});

		it("pins the soft-break trailing-tab divergence on hard-break-prefix", () => {
			const pair = fixture("hard-break-prefix");
			// commonmark.js strips only spaces before a soft break; micromark
			// strips tabs too. If either side changes, the normalizer's
			// second clause is dead weight — delete it and this.
			assert.isTrue(values(parseFixture(pair.markdown), "text", "value").some((value) => value.includes("\t\n")));
			assert.isFalse(values(pair.tree, "text", "value").some((value) => value.includes("\t\n")));
		});

		it("pins the multiline-label indentation divergence on character-references-everywhere", () => {
			const pair = fixture("character-references-everywhere");
			// micromark preserves continuation-line indentation inside a
			// label; commonmark.js's paragraph accumulation strips it. If
			// either side changes, the normalizer's third clause is dead
			// weight — delete it and this.
			assert.isTrue(values(pair.tree, "definition", "label").some((label) => /\n[ \t]+/.test(label)));
			const ours = values(parseFixture(pair.markdown), "definition", "label");
			assert.isFalse(ours.some((label) => /\n[ \t]+/.test(label)));
		});
	});
});
