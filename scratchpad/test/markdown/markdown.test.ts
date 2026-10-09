// The `Markdown` facade: the pure `parseResult` primitive, the `Effect`
// `parse` defined in terms of it, the options default, the `MarkdownFromString`
// codec, and the two invariants that hold for EVERY input — parse never
// throws, and every position is inside the source.
//
// The guard tests here assert MATERIALIZATION, not detection: that the
// engine's `GuardExceeded` carrier becomes a typed `MarkdownParseError`
// carrying a positioned diagnostic. Detection itself is covered by
// `hardening.test.ts` at the carrier layer.

import { assert, describe, it } from "@effect/vitest";
import { Arbitrary, Effect, Result, Schema } from "effect";
import { MAX_NESTING_DEPTH } from "../../effected/markdown/internal/limits.ts";
import { Markdown, MarkdownParseError, MarkdownParseOptions } from "../../effected/markdown/Markdown.ts";
import type { MarkdownNode } from "../../effected/markdown/MarkdownNode.ts";
import { Paragraph, Root } from "../../effected/markdown/MarkdownNode.ts";

/** An input nesting containers past the cap: the block pass's guard trip. */
const nestingBomb = `${">".repeat(MAX_NESTING_DEPTH + 44)} foo\n`;

/**
 * An input tripping the guard from the OTHER throw site — the inline pass's
 * emphasis materialization rather than the block pass's container stack.
 * Delimiters pair two at a time, so the run has to exceed twice the cap
 * before the nesting it would build does.
 */
const emphasisBomb = `${"*".repeat(2 * MAX_NESTING_DEPTH + 20)}a${"*".repeat(2 * MAX_NESTING_DEPTH + 20)}`;

/** Walk every node of a tree, children-first-agnostic, yielding each node. */
const walk = (node: MarkdownNode, visit: (n: MarkdownNode) => void): void => {
	visit(node);
	const children = (node as { readonly children?: ReadonlyArray<MarkdownNode> }).children;
	if (children !== undefined) {
		for (const child of children) {
			walk(child, visit);
		}
	}
};

describe("Markdown.parseResult", () => {
	it("succeeds with a Root tree", () => {
		const result = Markdown.parseResult("# Title\n\nBody *text*.\n");
		assert.isTrue(Result.isSuccess(result));
		if (Result.isFailure(result)) return;
		const root = result.success;
		assert.instanceOf(root, Root);
		assert.strictEqual(root.type, "root");
		assert.deepStrictEqual(
			root.children.map((child) => child.type),
			["heading", "paragraph"],
		);
	});

	it("succeeds on the empty document", () => {
		const result = Markdown.parseResult("");
		assert.isTrue(Result.isSuccess(result));
		if (Result.isFailure(result)) return;
		assert.deepStrictEqual(result.success.children, []);
	});

	it("materializes a tripped guard as a typed MarkdownParseError", () => {
		const result = Markdown.parseResult(nestingBomb);
		assert.isTrue(Result.isFailure(result));
		if (Result.isSuccess(result)) return;
		const error = result.failure;
		assert.instanceOf(error, MarkdownParseError);
		assert.strictEqual(error._tag, "MarkdownParseError");
		assert.strictEqual(error.diagnostic.code, "NestingDepthExceeded");
	});

	it("materializes an inline-pass guard trip the same way as a block-pass one", () => {
		// Same typed outcome from a different throw site: the facade must not
		// have learned only the block pass's shape of carrier.
		const result = Markdown.parseResult(emphasisBomb);
		assert.isTrue(Result.isFailure(result));
		if (Result.isSuccess(result)) return;
		assert.instanceOf(result.failure, MarkdownParseError);
		assert.strictEqual(result.failure.diagnostic.code, "NestingDepthExceeded");
	});

	it("derives the position of an inline-pass guard trip from its offset", () => {
		const result = Markdown.parseResult(`para\n\n${emphasisBomb}`);
		assert.isTrue(Result.isFailure(result));
		if (Result.isSuccess(result)) return;
		const { line, character, offset } = result.failure.diagnostic;
		// Third line (zero-based 2), and the offset accounts for the two
		// preceding lines while `character` is measured from the line start.
		assert.strictEqual(line, 2);
		assert.isAbove(character, 0);
		assert.strictEqual(offset, character + "para\n\n".length);
	});

	it("populates line and character on the guard diagnostic", () => {
		const result = Markdown.parseResult(`a\n\n${nestingBomb}`);
		assert.isTrue(Result.isFailure(result));
		if (Result.isSuccess(result)) return;
		const { offset, line, character } = result.failure.diagnostic;
		// Derived from the offset against the source, so the trip on line 3
		// (zero-based 2) reports there and not at the document start.
		assert.strictEqual(line, 2);
		assert.isAbove(character, 0);
		assert.isAbove(offset, 0);
	});

	it("names the code, position and message in the error message", () => {
		const result = Markdown.parseResult(nestingBomb);
		if (Result.isSuccess(result)) {
			assert.fail("expected the nesting bomb to fail");
			return;
		}
		assert.include(result.failure.message, "NestingDepthExceeded");
	});

	it("renders the message position 1-based while the diagnostic fields stay 0-based", () => {
		const result = Markdown.parseResult(`a\n\n${nestingBomb}`);
		if (Result.isSuccess(result)) {
			assert.fail("expected the nesting bomb to fail");
			return;
		}
		const { line, character } = result.failure.diagnostic;
		assert.strictEqual(line, 2);
		assert.isAbove(character, 0);
		assert.include(result.failure.message, `NestingDepthExceeded at 3:${character + 1} `);
		assert.notInclude(result.failure.message, `at ${line}:${character} `);
	});

	it("rethrows a non-carrier as a defect rather than converting it", () => {
		// The defect-passthrough invariant: only the engine's own carriers
		// become typed failures. A programmer error inside a construct — here
		// a plain Error thrown from the node constructor the block pass calls
		// — must escape untouched, never be laundered into MarkdownParseError.
		const original = Paragraph.make;
		const boom = new Error("boom: a programmer error, not a carrier");
		Object.defineProperty(Paragraph, "make", {
			configurable: true,
			writable: true,
			value: () => {
				throw boom;
			},
		});
		try {
			assert.throws(() => Markdown.parseResult("a paragraph\n"), /boom: a programmer error/);
		} finally {
			Object.defineProperty(Paragraph, "make", { configurable: true, writable: true, value: original });
		}
		// And the seam really is restored — otherwise the assertion above is vacuous.
		assert.isTrue(Result.isSuccess(Markdown.parseResult("a paragraph\n")));
	});
});

describe("Markdown.parse", () => {
	it.effect("succeeds with the same tree parseResult returns", () =>
		Effect.gen(function* () {
			const source = "# Title\n\n- a\n- b\n\n[x]: /u\n";
			const viaEffect = yield* Markdown.parse(source);
			const viaResult = Markdown.parseResult(source);
			assert.isTrue(Result.isSuccess(viaResult));
			if (Result.isFailure(viaResult)) return;
			assert.deepStrictEqual(viaEffect, viaResult.success);
		}),
	);

	it.effect("fails with the same error parseResult fails with", () =>
		Effect.gen(function* () {
			const viaEffect = yield* Effect.result(Markdown.parse(nestingBomb));
			const viaResult = Markdown.parseResult(nestingBomb);
			assert.isTrue(Result.isFailure(viaEffect));
			assert.isTrue(Result.isFailure(viaResult));
			if (Result.isSuccess(viaEffect) || Result.isSuccess(viaResult)) return;
			assert.deepStrictEqual(viaEffect.failure, viaResult.failure);
		}),
	);

	it.effect("surfaces a non-carrier throw as a defect, not a typed failure", () =>
		Effect.gen(function* () {
			const original = Paragraph.make;
			Object.defineProperty(Paragraph, "make", {
				configurable: true,
				writable: true,
				value: () => {
					throw new Error("boom: a programmer error, not a carrier");
				},
			});
			const exit = yield* Effect.exit(Markdown.parse("a paragraph\n"));
			Object.defineProperty(Paragraph, "make", { configurable: true, writable: true, value: original });
			assert.isTrue(exit._tag === "Failure");
			if (exit._tag !== "Failure") return;
			// A die, not a typed fail: no MarkdownParseError anywhere in the cause.
			const rendered = String(exit.cause);
			assert.include(rendered, "boom: a programmer error");
			assert.notInclude(rendered, "MarkdownParseError");
		}),
	);
});

describe("MarkdownParseOptions", () => {
	// A construct only the gfm dialect parses: under commonmark the tildes
	// stay literal text, under gfm they become a `delete` node.
	const gfmMarker = "~~struck~~\n";

	const firstChildTypes = (result: Result.Result<Root, MarkdownParseError>): ReadonlyArray<string> => {
		if (Result.isFailure(result)) {
			assert.fail("expected the parse to succeed");
		}
		const paragraph = result.success.children[0];
		assert.instanceOf(paragraph, Paragraph);
		return paragraph.children.map((child) => child.type);
	};

	it("defaults the dialect to gfm when options are omitted", () => {
		const implicit = Markdown.parseResult(gfmMarker);
		const explicit = Markdown.parseResult(gfmMarker, MarkdownParseOptions.make({ dialect: "gfm" }));
		const empty = Markdown.parseResult(gfmMarker, MarkdownParseOptions.make({}));
		assert.deepStrictEqual(firstChildTypes(implicit), ["delete"]);
		if (Result.isFailure(implicit) || Result.isFailure(explicit) || Result.isFailure(empty)) {
			assert.fail("expected every options form to parse");
			return;
		}
		assert.deepStrictEqual(explicit.success, implicit.success);
		assert.deepStrictEqual(empty.success, implicit.success);
	});

	it("honors an explicit commonmark dialect by disabling every extension", () => {
		const commonmark = Markdown.parseResult(gfmMarker, MarkdownParseOptions.make({ dialect: "commonmark" }));
		assert.deepStrictEqual(firstChildTypes(commonmark), ["text"]);
	});

	it("admits both dialect literals and rejects anything else, typed", () => {
		const decode = Schema.decodeUnknownResult(MarkdownParseOptions);
		assert.isTrue(Result.isSuccess(decode({ dialect: "gfm" })));
		assert.isTrue(Result.isSuccess(decode({ dialect: "commonmark" })));
		assert.isTrue(Result.isFailure(decode({ dialect: "markdown-extra" })));
	});
});

describe("Markdown.MarkdownFromString", () => {
	const decode = Schema.decodeUnknownEffect(Markdown.MarkdownFromString);
	const encode = Schema.encodeEffect(Markdown.MarkdownFromString);

	it.effect("decodes markdown source into a Root", () =>
		Effect.gen(function* () {
			const root = yield* decode("para *em*\n");
			assert.instanceOf(root, Root);
			assert.deepStrictEqual(
				root.children.map((child) => child.type),
				["paragraph"],
			);
		}),
	);

	it.effect("fails to decode a non-string", () =>
		Effect.gen(function* () {
			const result = yield* Effect.result(decode(42));
			assert.isTrue(Result.isFailure(result));
		}),
	);

	it.effect("encodes a tree back to markdown source", () =>
		Effect.gen(function* () {
			const root = yield* decode("para *em*\n");
			const emitted = yield* encode(root);
			assert.strictEqual(emitted, "para *em*\n");
		}),
	);
});

describe("Markdown parse invariants", () => {
	/**
	 * Unicode-hostile text: lone surrogates (unpaired halves that break naive
	 * code-point scanning), U+0000 (preprocessed to U+FFFD), every line
	 * terminator form, the markdown punctuation set, and full-plane unicode
	 * as runs of scalar values (the whole plane minus the surrogate block),
	 * which reach the astral code points the ASCII string generator never
	 * emits. `size` lifts the length scale to the 40-part cap.
	 */
	const ScalarValue = Schema.Union([
		Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 0xd7ff })),
		Schema.Int.check(Schema.isBetween({ minimum: 0xe000, maximum: 0x10ffff })),
	]);
	const HostilePart = Schema.Union([
		Schema.Literals(["\u0000", "\uD800", "\uDFFF", "\uFFFD", "\r\n", "\r", "\n", "\t", " "]),
		Schema.Literals(["#", "*", "_", "`", ">", "-", "[", "]", "(", ")", "!", "\\", "~", "<", "&", "|"]),
		Schema.String.check(Schema.isMaxLength(8)),
		Schema.Array(ScalarValue).check(Schema.isMaxLength(8)),
	]);
	const hostileText = Arbitrary.schema(Schema.Array(HostilePart).check(Schema.isMaxLength(40))).pipe(
		Arbitrary.map((parts) =>
			parts
				.map((part) =>
					typeof part === "string" ? part : part.map((codePoint) => String.fromCodePoint(codePoint)).join(""),
				)
				.join(""),
		),
	);

	it.prop(
		"never throws, whatever the input",
		[hostileText],
		([text]) => {
			const result = Markdown.parseResult(text);
			// Failure is legal (a guard trip); a throw is not.
			return Result.isSuccess(result) || Result.isFailure(result);
		},
		{ arbitrary: { runs: 250, size: 40 } },
	);

	// Invariant, not a performance budget: parsing ~500KB under coverage in a
	// whole-workspace run shares cores with 18 other suites, so the default 5s
	// timeout flakes on contention. The calibrated pathological suite owns
	// timing; this test only asserts totality.
	it("never throws on a large input", { timeout: 30_000 }, () => {
		const large = "para *em* [ref][a] `code`\n\n".repeat(20_000);
		assert.isAbove(large.length, 500_000);
		const result = Markdown.parseResult(large);
		assert.isTrue(Result.isSuccess(result));
	});

	it.prop(
		"keeps every node position inside the source",
		[hostileText],
		([text]) => {
			const result = Markdown.parseResult(text);
			if (Result.isFailure(result)) return true;
			let ok = true;
			walk(result.success, (node) => {
				const { start, end } = node.position;
				if (!(start.offset >= 0 && start.offset <= end.offset && end.offset <= text.length)) {
					ok = false;
				}
			});
			return ok;
		},
		{ arbitrary: { runs: 250, size: 40 } },
	);

	it("keeps every node position inside the source for a realistic document", () => {
		const source = [
			"# Title",
			"",
			"Body with *em*, **strong**, `code`, <https://example.com> and [ref][a].",
			"",
			"> quoted",
			"> - a",
			"> - b",
			"",
			"```ts",
			"const x = 1;",
			"```",
			"",
			'[a]: /url "title"',
			"",
		].join("\n");
		const result = Markdown.parseResult(source);
		assert.isTrue(Result.isSuccess(result));
		if (Result.isFailure(result)) return;
		let count = 0;
		walk(result.success, (node) => {
			count++;
			const { start, end } = node.position;
			assert.isAtLeast(start.offset, 0);
			assert.isAtMost(start.offset, end.offset);
			assert.isAtMost(end.offset, source.length);
		});
		// Guard against a silently-empty walk.
		assert.isAbove(count, 15);
	});
});
