import { assert, describe, it } from "@effect/vitest";
import { Doc, Render, Status } from "../../effected/cli/index.ts";

const changes = (n: number) =>
	Doc.counter(Status.core, "success", {
		key: "changes",
		label: { one: "change", other: "changes" },
		n,
		showZero: true,
	});
const errors = (n: number) =>
	Doc.counter(Status.core, "failure", { key: "errors", label: { one: "error", other: "errors" }, n, showZero: true });

const ctx = Render.contextOf({ audience: "agent" });
const plain = (layout: "inline" | "columns" | "row", n: number, share?: false) =>
	Render.plain(
		[Doc.counts({ counters: [changes(n), errors(n)], layout, ...(share === undefined ? {} : { share }) })],
		ctx,
	);

describe("Doc.counter with a plural label", () => {
	it("a standalone count reads by its own n: one for exactly 1, other for 0 and 2", () => {
		assert.strictEqual(plain("inline", 0), "0/0 changes, 0 errors");
		assert.strictEqual(plain("inline", 1), "1/2 changes, 1 error", "the headline reads by its total, 2");
		assert.strictEqual(plain("inline", 2), "2/4 changes, 2 errors");
	});

	it("a share headline reads by the total, the denominator: 1/1 repo, 1/3 repos, 2/3 repos", () => {
		const repos = (n: number, total: number) =>
			Render.plain(
				[
					Doc.counts({
						counters: [
							Doc.counter(Status.core, "success", { key: "repos", label: { one: "repo", other: "repos" }, n }),
						],
						layout: "inline",
						total: () => total,
					}),
				],
				ctx,
			);
		assert.strictEqual(repos(1, 1), "1/1 repo");
		assert.strictEqual(repos(1, 3), "1/3 repos");
		assert.strictEqual(repos(2, 3), "2/3 repos");
	});

	it("only the share headline reads by the total: the counters after it read by their own n", () => {
		const text = Render.plain([Doc.counts({ counters: [changes(1), errors(1)], layout: "inline" })], ctx);
		assert.strictEqual(text, "1/2 changes, 1 error");
	});

	it("applies with share off, and in the columns and row layouts", () => {
		assert.strictEqual(plain("inline", 1, false), "1 change, 1 error", "control: with no share, by n");
		assert.strictEqual(plain("columns", 1), "change  1\nerror   1");
		assert.strictEqual(plain("columns", 2), "changes  2\nerrors   2");
		assert.strictEqual(plain("row", 1), "1/2 changes  1 error");
	});

	it("applies in markdown", () => {
		const md = (n: number) =>
			Render.markdown([Doc.counts({ counters: [changes(n), errors(n)], layout: "columns" })], ctx);
		assert.strictEqual(md(1), "- change: 1\n- error: 1");
		assert.strictEqual(md(2), "- changes: 2\n- errors: 2");
		const row = Render.markdown([Doc.counts({ counters: [changes(1), errors(1)], layout: "row" })], ctx);
		assert.include(row, "| changes | error |", "a markdown row heads the share headline's column by the total");
		const inline = Render.markdown([Doc.counts({ counters: [changes(1), errors(1)], layout: "inline" })], ctx);
		assert.strictEqual(inline, "1/2 changes, 1 error");
	});

	it("heads a counts table's column with the plural form, since the column holds every row's count", () => {
		const text = Render.plain(
			[
				Doc.countsTable([
					{ label: "a", counters: [changes(1)] },
					{ label: "b", counters: [changes(2)] },
				]),
			],
			ctx,
		);
		assert.include(text, "changes");
		assert.notMatch(text, /\bchange\b/);
	});

	it("a plain string label is unchanged, and the counter copies the label as readonly plain data", () => {
		const one = Doc.counter(Status.core, "success", { key: "p", label: "passed", n: 1 });
		assert.strictEqual(one.label, "passed");
		const label = { one: "change", other: "changes" };
		const plural = Doc.counter(Status.core, "success", { key: "changes", label, n: 1 });
		assert.deepStrictEqual(plural.label, { one: "change", other: "changes" });
		assert.notStrictEqual(plural.label, label, "the counter owns a copy of the plural label");
		label.other = "edited";
		assert.deepStrictEqual(plural.label, { one: "change", other: "changes" }, "editing the input leaves the counter unchanged");
	});
});
