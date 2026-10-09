// The string-level frontmatter surface: split raw source at the closed fence
// grammar without parsing anything, and join back byte-exactly.

import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import { FrontmatterSource, FrontmatterSourceBlock, FrontmatterSourceSplit } from "../../effected/markdown/FrontmatterSource.ts";
import { Markdown } from "../../effected/markdown/Markdown.ts";

const split = FrontmatterSource.split;
const join = FrontmatterSource.join;

describe("FrontmatterSource", () => {
	describe("split", () => {
		it("splits a yaml block with byte-exact boundaries", () => {
			const source = "---\ntitle: hi\n---\n\n# Body\n";
			const result = split(source);
			assert.strictEqual(result.frontmatter?.format, "yaml");
			assert.strictEqual(result.frontmatter?.value, "title: hi\n");
			assert.strictEqual(result.frontmatter?.newline, "\n");
			assert.strictEqual(result.body, "\n# Body\n");
			assert.strictEqual(result.bodyOffset, 18);
		});

		it("recognizes the whole closed fence set and nothing else", () => {
			assert.strictEqual(split("+++\na = 1\n+++\nb\n").frontmatter?.format, "toml");
			assert.strictEqual(split('---json\n{"a":1}\n---\nb\n').frontmatter?.format, "json");
			// Not fences: wrong spelling, padding, unknown language hints.
			for (const source of ["----\nx\n----\n", "---yaml\nx\n---\n", " ---\nx\n---\n", "--- \nx\n---\n"]) {
				assert.strictEqual(split(source).frontmatter, undefined, source);
			}
		});

		it("treats an unclosed fence as no frontmatter, body verbatim", () => {
			const source = "---\ntitle: hi\n";
			const result = split(source);
			assert.strictEqual(result.frontmatter, undefined);
			assert.strictEqual(result.body, source);
			assert.strictEqual(result.bodyOffset, 0);
		});

		it("keeps an empty block and a blank-line block distinct", () => {
			assert.strictEqual(split("---\n---\nbody").frontmatter?.value, "");
			assert.strictEqual(split("---\n\n---\nbody").frontmatter?.value, "\n");
		});

		it("records CRLF fence terminators and keeps interior terminators verbatim", () => {
			const source = "---\r\na: 1\r\nb: 2\r\n---\r\nbody";
			const result = split(source);
			assert.strictEqual(result.frontmatter?.newline, "\r\n");
			assert.strictEqual(result.frontmatter?.value, "a: 1\r\nb: 2\r\n");
			assert.strictEqual(result.body, "body");
		});

		it("handles a closing fence at end of document", () => {
			const source = "---\nfoo: 1\n---";
			const result = split(source);
			assert.strictEqual(result.frontmatter?.value, "foo: 1\n");
			assert.strictEqual(result.body, "");
			assert.strictEqual(result.bodyOffset, source.length);
		});

		it("keeps value bytes verbatim — no U+0000 substitution at string level", () => {
			const result = split("---\na: \u0000\n---\nb");
			assert.strictEqual(result.frontmatter?.value, "a: \u0000\n");
		});

		it("agrees with body === source.slice(bodyOffset) on every input", () => {
			for (const source of [
				"---\ntitle: hi\n---\nbody\n",
				"---\n---\n",
				"+++\n+++\nx",
				"no frontmatter at all\n",
				"---\nunclosed\n",
				"",
			]) {
				const result = split(source);
				assert.strictEqual(result.body, source.slice(result.bodyOffset), source);
			}
		});

		it("agrees with the parser's capture toggle about block existence and format", () => {
			for (const source of [
				"---\ntitle: hi\n---\nbody\n",
				"+++\na = 1\n+++\n",
				'---json\n{"a":1}\n---\n',
				"---\nunclosed\n",
				"# plain\n",
				"---\n---\n",
			]) {
				const stringLevel = split(source).frontmatter;
				const parsed = Markdown.parseResult(source, { frontmatter: true });
				assertSuccess(parsed, Result.getOrThrow(parsed));
				if (Result.isSuccess(parsed)) {
					const head = parsed.success.children[0];
					const captured = head?.type === "frontmatter" ? head : undefined;
					assert.strictEqual(stringLevel === undefined, captured === undefined, source);
					if (stringLevel !== undefined && captured !== undefined) {
						assert.strictEqual(stringLevel.format, captured.format, source);
					}
				}
			}
		});
	});

	describe("join", () => {
		it("round-trips unmodified sources byte-exactly", () => {
			for (const source of [
				"---\ntitle: hi\n---\n\n# Body\n",
				"---\ntitle: hi\n---\nbody",
				"---\n---\n",
				"---\n\n---\nbody\n",
				"+++\na = 1\nb = 2\n+++\ntext\n",
				'---json\n{"a": 1}\n---\n\ncontent\n',
				"---\r\na: 1\r\n---\r\nbody\r\n",
				"# no block here\n",
				"---\nunclosed, so body verbatim\n",
				"",
			]) {
				assert.strictEqual(join(split(source)), source, JSON.stringify(source));
			}
		});

		it("normalizes the one unterminated spelling: a closing fence at EOF gains a newline", () => {
			const source = "---\nfoo: 1\n---";
			assert.strictEqual(join(split(source)), `${source}\n`);
		});

		it("serializes hand-built parts, appending the missing value terminator", () => {
			const result = join(
				FrontmatterSourceSplit.make({
					frontmatter: FrontmatterSourceBlock.make({ format: "yaml", value: "a: 1" }),
					body: "hi\n",
				}),
			);
			assert.strictEqual(result, "---\na: 1\n---\nhi\n");
		});

		it("serializes every format's fence spelling", () => {
			const body = "b\n";
			const of = (format: "yaml" | "toml" | "json"): string =>
				join(
					FrontmatterSourceSplit.make({
						frontmatter: FrontmatterSourceBlock.make({ format, value: "v\n" }),
						body,
					}),
				);
			assert.strictEqual(of("yaml"), "---\nv\n---\nb\n");
			assert.strictEqual(of("toml"), "+++\nv\n+++\nb\n");
			assert.strictEqual(of("json"), "---json\nv\n---\nb\n");
		});

		it("returns the body verbatim when there is no block", () => {
			assert.strictEqual(join(FrontmatterSourceSplit.make({ body: "# doc\n" })), "# doc\n");
		});

		it("honors a hand-built CRLF newline", () => {
			const result = join(
				FrontmatterSourceSplit.make({
					frontmatter: FrontmatterSourceBlock.make({ format: "yaml", value: "a: 1", newline: "\r\n" }),
					body: "b",
				}),
			);
			assert.strictEqual(result, "---\r\na: 1\r\n---\r\nb");
		});
	});
});
