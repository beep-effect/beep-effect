import { assert, describe, it } from "@effect/vitest";
import {
	GuardExceeded,
	MARKDOWN_PARSE_ERROR_CODES,
	RawMarkdownError,
	isGuardExceeded,
	isRawMarkdownError,
} from "../../effected/markdown/internal/carriers.ts";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { MarkdownDiagnostic } from "../../effected/markdown/MarkdownDiagnostic.ts";

describe("MarkdownDiagnostic", () => {
	it("derives line and character from offset against LF source", () => {
		const d = MarkdownDiagnostic.fromRaw("aaaa\nbbbb\n", {
			code: "NestingDepthExceeded",
			message: "nesting depth exceeded",
			offset: 7,
			length: 1,
		});
		assert.strictEqual(d.line, 1);
		assert.strictEqual(d.character, 2);
	});

	it("derives line and character across CRLF newlines", () => {
		const d = MarkdownDiagnostic.fromRaw("aaaa\r\nbbbb\r\n", {
			code: "NestingDepthExceeded",
			message: "nesting depth exceeded",
			offset: 8,
			length: 1,
		});
		assert.strictEqual(d.line, 1);
		assert.strictEqual(d.character, 2);
	});

	it("clamps an offset at EOF to the final position", () => {
		const d = MarkdownDiagnostic.fromRaw("abc", {
			code: "NestingDepthExceeded",
			message: "m",
			offset: 3,
			length: 0,
		});
		assert.strictEqual(d.line, 0);
		assert.strictEqual(d.character, 3);
	});

	it("derives line and character when the offset lands on the newline itself", () => {
		const d = MarkdownDiagnostic.fromRaw("a\nb", { code: "NestingDepthExceeded", message: "m", offset: 1, length: 1 });
		assert.strictEqual(d.line, 0);
		assert.strictEqual(d.character, 1);
	});

	it("constructs via make and compares structurally equal for identical fields", () => {
		const a = MarkdownDiagnostic.make({
			code: "NestingDepthExceeded",
			message: "m",
			offset: 0,
			length: 1,
			line: 0,
			character: 0,
		});
		const b = MarkdownDiagnostic.make({
			code: "NestingDepthExceeded",
			message: "m",
			offset: 0,
			length: 1,
			line: 0,
			character: 0,
		});
		assert.deepStrictEqual(a, b);
	});

	it("pins the P1 error code vocabulary", () => {
		assert.deepStrictEqual([...MARKDOWN_PARSE_ERROR_CODES], ["NestingDepthExceeded"]);
	});

	it("exposes the cross-package MAX_NESTING_DEPTH parity constant", () => {
		assert.strictEqual(MAX_NESTING_DEPTH, 256);
	});

	it("RawMarkdownError carries its diagnostic and is recognized by its predicate", () => {
		const e = new RawMarkdownError({ code: "NestingDepthExceeded", message: "m", offset: 0, length: 1 });
		assert.strictEqual(e.diagnostic.code, "NestingDepthExceeded");
		assert.isTrue(isRawMarkdownError(e));
		assert.isFalse(isRawMarkdownError(new Error("m")));
	});

	it("GuardExceeded carries its guard-trip fields and is recognized by its predicate", () => {
		const e = new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, 300, 42);
		assert.strictEqual(e.reason, "NestingDepthExceeded");
		assert.strictEqual(e.limit, MAX_NESTING_DEPTH);
		assert.strictEqual(e.actual, 300);
		assert.strictEqual(e.offset, 42);
		assert.isTrue(isGuardExceeded(e));
		assert.isFalse(isGuardExceeded(new Error("m")));
	});

	it("distinguishes RawMarkdownError from GuardExceeded via predicates", () => {
		const raw = new RawMarkdownError({ code: "NestingDepthExceeded", message: "m", offset: 0, length: 1 });
		const guard = new GuardExceeded("NestingDepthExceeded", MAX_NESTING_DEPTH, 300, 42);
		assert.isFalse(isRawMarkdownError(guard));
		assert.isFalse(isGuardExceeded(raw));
	});
});
