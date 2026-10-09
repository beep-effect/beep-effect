// The dialect matrix: all 652 CommonMark spec examples, parsed and rendered
// under BOTH dialects, with the full-stack output compared across them.
//
// This is the phase's central regression artifact. The gfm dialect is a
// registry composition over the commonmark substrate, so on input containing
// no extension syntax the two dialects must agree byte-for-byte after
// normalization. The examples where they legitimately differ are enumerated
// below, each with the construct that causes it — and the assertion runs in
// BOTH directions: an unlisted example that diverges is a regression in the
// gfm dialect's additivity, and a listed example that agrees is a stale entry
// that must be removed (it would otherwise hide a construct silently
// switching off).
//
// "Full-stack" means each side uses its whole pipeline: the gfm side parses
// under `"gfm"` AND renders with the writer's gfm mode, because the tagfilter
// is part of GFM's output contract even though it is not parse behavior.

import { assert, describe, it } from "@effect/vitest";
import { parseBlocks } from "../../../effected/markdown/internal/blockParser.ts";
import { loadSpecExamples } from "./support/corpus.ts";
import { renderHtml } from "./support/htmlWriter.ts";
import { normalizeHtml } from "./support/normalizeHtml.ts";

/**
 * The spec examples whose output legitimately differs under gfm, keyed by
 * example number, valued by the construct responsible. Discovered
 * empirically over the full corpus, then verified by hand — eleven entries,
 * two constructs.
 */
const EXPECTED_GFM_DIVERGENT: ReadonlyMap<number, string> = new Map([
	// The tagfilter escapes `<script>`, `<style>` and `<textarea>` in raw
	// HTML output under gfm (six examples across HTML block types 1 and 2).
	[170, "tagfilter: <script> block"],
	[171, "tagfilter: <textarea> block"],
	[172, "tagfilter: <style> block"],
	[173, "tagfilter: unclosed <style> block"],
	[176, "tagfilter: one-line <style> block"],
	[178, "tagfilter: <script> block closed mid-line"],
	// Autolink literals promote bare URLs and email addresses that CommonMark
	// leaves as literal text (five examples, all in the spec's Autolinks
	// section as NEGATIVE cases for the angle-bracket form).
	[602, "autolink literal: URL inside an invalid <> autolink"],
	[606, "autolink literal: email inside an invalid <> autolink"],
	[608, "autolink literal: URL inside a spaced-out <> non-autolink"],
	[611, "autolink literal: bare URL"],
	[612, "autolink literal: bare email address"],
]);

const examples = loadSpecExamples();

describe("dialect matrix: commonmark vs gfm over the spec corpus", () => {
	it("runs the whole corpus", () => {
		// Silently-empty-walk guard.
		assert.strictEqual(examples.length, 652);
	});

	for (const example of examples) {
		const expectation = EXPECTED_GFM_DIVERGENT.get(example.example);
		it(`example ${example.example}${expectation === undefined ? "" : ` diverges (${expectation})`}`, () => {
			const commonmark = normalizeHtml(renderHtml(parseBlocks(example.markdown, "commonmark").root));
			const gfm = normalizeHtml(renderHtml(parseBlocks(example.markdown, "gfm").root, { gfm: true }));
			if (expectation === undefined) {
				assert.strictEqual(gfm, commonmark, `dialects diverge on an example not in EXPECTED_GFM_DIVERGENT`);
			} else {
				assert.notStrictEqual(
					gfm,
					commonmark,
					`listed as divergent (${expectation}) but the dialects agree — stale entry`,
				);
			}
		});
	}
});
