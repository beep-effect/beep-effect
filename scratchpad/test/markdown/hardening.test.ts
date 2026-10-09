// THE RECURSION-SURFACE ENUMERATION.
//
// Every self-recursive function in `src/` is listed here, with what bounds it.
// The house rule is that malformed input yields a typed error or a diagnostic
// and NEVER a defect, so an unbounded recursion reachable from parse input is
// a bug — one of the entries below was exactly that when this file was
// written (see "image alt flattening").
//
// GUARDED — depth is input-controlled, so a cap applies:
//
//  1. `blockParser.addChild` — not itself recursive, but it is where container
//     nesting is capped. Every deeper surface below inherits its bound,
//     because no tree deeper than the cap is ever built.
//  2. `blockParser.materializeBlock` — walks the block tree. Bounded by (1):
//     the tree it walks cannot be deeper than the cap that built it.
//  3. `blockParser.collectReferences` — walks the same tree, same bound. It
//     indexes link reference definitions AND GFM footnote definition labels,
//     so a `[^a]: [^b]: ...` recursion is bounded by (1) like any other
//     container nesting (pinned in `gfm-footnotes.test.ts`).
//  4. `inlineParser.materialize` / `materializeNode` — mutually recursive over
//     the inline tree, which nests as deeply as the input has balanced
//     delimiters. Carries its own explicit depth counter and cap.
//
// ITERATIVE ON PURPOSE — no cap, and none wanted (the toml lesson: know what
// NOT to guard):
//
//  5. `blockParser.incorporateLine` — the line loop. One pass per line.
//  6. `inlineParser.parse` / `parseOne` — the cursor only moves forward.
//  7. `inlineParser.processEmphasis` — the delimiter stack. Being iterative is
//     the entire point: it is what makes emphasis linear instead of the
//     quadratic blowup that is markdown's DoS vector.
//  8. The bracket stack (`inlines/link.ts`) — same reasoning.
//  9. `link.plainTextOf` — an image's alt flattening. THIS ONE WAS RECURSIVE
//     AND UNGUARDED, and it died with a `RangeError` — a defect — on an image
//     whose bracket content nested ten thousand emphasis markers. It runs
//     while the brackets close, BEFORE materialization's guard can see the
//     tree, so the guard could not save it. Rewritten with an explicit stack:
//     a flattening has no reason to recurse. Pinned by a test below.
// 10. `linkReferenceDefinition.extractDefinitions` — a `while` loop over one
//     paragraph's leading definitions.
// 11. `LineIndex.positionAt` — binary search, iterative.
//
// NOT A SURFACE:
//
// 12. `Schema.suspend` decode of `MarkdownNode` — recursive in principle, but
//     the parser is the only producer in P1 and (1) and (4) bound what it
//     produces. A hand-built tree decoded directly is the consumer's own
//     depth to manage.
// 13. The test HTML writer (`__test__/e2e/support/htmlWriter.ts`) — recursive
//     over the tree, and deliberately left uncapped: it only ever sees trees
//     this parser produced, which (1) and (4) already bound. It is test-only
//     and ships in no artifact.
//
// The defect-passthrough test (a deliberate non-carrier throw escaping as a
// defect) belongs with the facade and lands in Task 11.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../effected/markdown/internal/blockParser.ts";
import { GuardExceeded, isGuardExceeded } from "../../effected/markdown/internal/carriers.ts";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { InvalidLineTableError, LineIndex } from "../../effected/markdown/internal/lineIndex.ts";
import { preprocessLines } from "../../effected/markdown/internal/preprocess.ts";
import { renderHtml } from "./e2e/support/htmlWriter.ts";

describe("recursion surfaces", () => {
	describe("container nesting (surfaces 1, 2 and 3)", () => {
		it("trips the guard rather than overflowing on deep blockquotes", () => {
			let caught: unknown;
			try {
				parseBlocks(`${">".repeat(MAX_NESTING_DEPTH + 44)} foo\n`);
			} catch (error) {
				caught = error;
			}

			assert.isTrue(isGuardExceeded(caught), "deep containers must trip the guard");
			assert.isFalse(caught instanceof RangeError, "a stack overflow is a defect, not a typed failure");
			if (isGuardExceeded(caught)) {
				assert.strictEqual(caught.reason, "NestingDepthExceeded");
				assert.strictEqual(caught.limit, MAX_NESTING_DEPTH);
			}
		});

		it("trips the guard on deep lists", () => {
			assert.throws(() => parseBlocks(`${"- ".repeat(MAX_NESTING_DEPTH)}foo\n`), GuardExceeded);
		});

		it("parses containers nested just under the cap", () => {
			// The positive control. Without it the test above would pass even if
			// the guard fired at depth 1.
			const { root } = parseBlocks(`${">".repeat(MAX_NESTING_DEPTH - 2)} foo\n`);
			assert.strictEqual(root.children[0]?.type, "blockquote");
		});
	});

	describe("inline nesting (surface 4)", () => {
		// Delimiters pair two at a time, so n markers a side nest n/2 deep.
		const markersFor = (depth: number): string => "*".repeat(depth * 2);

		it("trips the guard rather than overflowing on deep emphasis", () => {
			const markers = markersFor(MAX_NESTING_DEPTH + 10);
			let caught: unknown;
			try {
				parseBlocks(`${markers}a${markers}\n`);
			} catch (error) {
				caught = error;
			}

			assert.isTrue(isGuardExceeded(caught), "deep emphasis must trip the guard");
			assert.isFalse(caught instanceof RangeError);
		});

		it("parses emphasis nested just under the cap", () => {
			const markers = markersFor(MAX_NESTING_DEPTH - 6);
			const [paragraph] = parseBlocks(`${markers}a${markers}\n`).root.children;
			assert.strictEqual(paragraph?.type, "paragraph");
			assert.strictEqual(paragraph?.type === "paragraph" ? paragraph.children[0]?.type : undefined, "strong");
		});

		it("counts container and inline nesting against the same cap", () => {
			// Both guards use MAX_NESTING_DEPTH; neither leaks into the other.
			const source = `${">".repeat(10)} ${"*".repeat(20)}a${"*".repeat(20)}\n`;
			assert.doesNotThrow(() => parseBlocks(source));
		});
	});

	describe("image alt flattening (surface 9)", () => {
		it("flattens deeply nested alt content without overflowing the stack", () => {
			// The regression: this ran before materialization's guard and died
			// with a RangeError. Ten thousand levels is far past any cap — the
			// point is that flattening does not recurse at all.
			const markers = "*".repeat(20000);
			let caught: unknown;
			try {
				parseBlocks(`![${markers}a${markers}](/u)\n`);
			} catch (error) {
				caught = error;
			}

			assert.isFalse(caught instanceof RangeError, "alt flattening must not recurse");
			assert.isUndefined(caught);
		});

		it("still flattens nested markup into alt text correctly", () => {
			const [paragraph] = parseBlocks("![a *b* `c` [d](/e)](/u)\n").root.children;
			const image = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
			assert.strictEqual(image?.type, "image");
			assert.strictEqual(image?.type === "image" ? image.alt : "", "a b c d");
		});
	});
});

describe("the line index", () => {
	it("agrees with the parser about what a line is, for bare CR documents", () => {
		// The two modules used to decide independently: `preprocessLines`
		// splits on `\r\n`, `\n` AND a bare `\r`, while the index's own scan
		// recognized only `\n`. A bare-CR document therefore reported line 1
		// for everything. The parser now hands the index its own table.
		const source = "alpha\rbravo\rcharlie\n";
		const { root } = parseBlocks(source);

		assert.strictEqual(root.children.length, 1, "the three CR-separated lines are one paragraph");
		const paragraph = root.children[0];
		assert.strictEqual(paragraph?.position.start.line, 1);
		// `charlie` is the third line, so the paragraph ends there.
		assert.strictEqual(paragraph?.position.end.line, 3);
	});

	it("positions a block after a bare CR on the right line", () => {
		const source = "alpha\r\r# heading\n";
		const heading = parseBlocks(source).root.children[1];
		assert.strictEqual(heading?.type, "heading");
		assert.strictEqual(heading?.position.start.line, 3);
	});

	it("keeps LF semantics identical when built from a line table", () => {
		const source = "one\ntwo\nthree";
		const scanned = LineIndex.make(source);
		const handed = LineIndex.fromLineStarts(
			source,
			preprocessLines(source).map((line) => line.start),
		);

		for (let offset = 0; offset <= source.length; offset += 1) {
			assert.deepStrictEqual(
				{ ...handed.positionAt(offset) },
				{ ...scanned.positionAt(offset) },
				`disagreement at offset ${offset}`,
			);
		}
	});

	it("refuses a line table that does not start at zero", () => {
		assert.throws(() => LineIndex.fromLineStarts("abc", [1, 2]), InvalidLineTableError);
		assert.throws(() => LineIndex.fromLineStarts("abc", []), InvalidLineTableError);
	});
});

describe("prototype pollution", () => {
	const DANGEROUS = ["__proto__", "constructor", "prototype", "toString", "hasOwnProperty"] as const;

	it("holds dangerous reference labels as data and resolves them", () => {
		const document = `${DANGEROUS.map((label) => `[${label}]: /url-${label}\n`).join("")}\n${DANGEROUS.map(
			(label) => `[${label}]\n\n`,
		).join("")}`;
		const { root, refmap } = parseBlocks(document);

		for (const label of DANGEROUS) {
			const key = label.toUpperCase();
			assert.isTrue(refmap.has(key), `the refmap lost the ${label} definition`);
			assert.strictEqual(refmap.get(key)?.url, `/url-${label}`);
		}

		// Each reference formed against its definition rather than staying
		// literal — which is what proves the lookup went through the Map.
		const rendered = renderHtml(root);
		for (const label of DANGEROUS) {
			assert.include(rendered, `href="/url-${label}"`, `the ${label} reference did not resolve`);
		}
	});

	it("leaves Object.prototype untouched", () => {
		const before = Object.getOwnPropertyNames(Object.prototype).sort();
		parseBlocks('[__proto__]: /evil "polluted"\n\n[constructor]: /evil2\n\n[__proto__]\n');

		assert.deepStrictEqual(Object.getOwnPropertyNames(Object.prototype).sort(), before);
		assert.strictEqual(Object.getPrototypeOf({}), Object.prototype);
		const plain: Record<string, unknown> = {};
		assert.isUndefined(plain.url);
	});

	it("keys the refmap through a real Map, not an object", () => {
		const { refmap } = parseBlocks("[a]: /1\n");
		assert.strictEqual(Object.getPrototypeOf(refmap), Map.prototype);
	});
});

describe("adversarial characters", () => {
	it("replaces U+0000 with U+FFFD through the whole pipeline", () => {
		const { root } = parseBlocks("a\u0000b\n");
		const paragraph = root.children[0];
		const text = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
		assert.strictEqual(text?.type === "text" ? text.value : "", "a\uFFFDb");
		assert.include(renderHtml(root), "a\uFFFDb");
	});

	it("replaces U+0000 inside every construct that carries text", () => {
		const sources = [
			"# a\u0000b\n",
			"    a\u0000b\n",
			"```\na\u0000b\n```\n",
			"> a\u0000b\n",
			"`a\u0000b`\n",
			"[a\u0000b]: /url\n\n[a\u0000b]\n",
		];
		for (const source of sources) {
			const rendered = renderHtml(parseBlocks(source).root);
			assert.notInclude(rendered, "\u0000", `a NUL survived: ${JSON.stringify(source)}`);
		}
	});

	it("parses a lone surrogate without throwing", () => {
		for (const source of ["a\uD800b\n", "a\uDFFFb\n", "\uD800\n", "*\uD800*\n", "[\uD800](/u)\n"]) {
			assert.doesNotThrow(() => renderHtml(parseBlocks(source).root), `failed for ${JSON.stringify(source)}`);
		}
	});

	it("keeps a lone surrogate in the text it came from", () => {
		const { root } = parseBlocks("a\uD800b\n");
		const paragraph = root.children[0];
		const text = paragraph?.type === "paragraph" ? paragraph.children[0] : undefined;
		assert.strictEqual(text?.type === "text" ? text.value : "", "a\uD800b");
	});

	it("parses an unterminated construct at the end of input without throwing", () => {
		for (const source of ["`code", "[link](", "![img][", "<!-- comment", "***", "> ", "- ", "```"]) {
			assert.doesNotThrow(() => renderHtml(parseBlocks(source).root), `failed for ${JSON.stringify(source)}`);
		}
	});

	it("parses the empty document and a lone newline", () => {
		for (const source of ["", "\n", "\r", "\r\n", "\n\n\n"]) {
			const { root } = parseBlocks(source);
			assert.strictEqual(root.children.length, 0, `failed for ${JSON.stringify(source)}`);
		}
	});
});
