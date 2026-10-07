import { assert, describe, it } from "@effect/vitest";
import { pipe } from "effect/Function";
import { createScanner } from "@beep/scratchpad/effected/jsonc/internal/scanner";

describe("createScanner", () => {
	it("preserves trivia by default and with false in both calling styles", () => {
		const text = " /* comment */\n1";
		const scanners = [
			createScanner(text),
			createScanner(text, false),
			createScanner(text, undefined),
			pipe(text, createScanner()),
			pipe(text, createScanner(false)),
			pipe(text, createScanner(undefined)),
		];
		for (const scanner of scanners) {
			assert.strictEqual(scanner.scan(), "Trivia");
			assert.strictEqual(scanner.scan(), "BlockComment");
			assert.strictEqual(scanner.scan(), "LineBreak");
			assert.strictEqual(scanner.scan(), "Number");
			assert.strictEqual(scanner.getTokenValue(), "1");
			assert.strictEqual(scanner.scan(), "EOF");
		}
	});

	it("skips trivia only when true in both calling styles", () => {
		const text = " /* block */ // line\n1";
		for (const scanner of [createScanner(text, true), pipe(text, createScanner(true))]) {
			assert.strictEqual(scanner.scan(), "Number");
			assert.strictEqual(scanner.getTokenValue(), "1");
			assert.strictEqual(scanner.scan(), "EOF");
		}
	});

	it("does not duplicate the buffered prefix when an unterminated string ends with a trailing backslash", () => {
		const scanner = createScanner('"abc\\');
		assert.strictEqual(scanner.scan(), "String");
		assert.strictEqual(scanner.getTokenValue(), "abc");
		assert.strictEqual(scanner.getTokenError(), "UnexpectedEndOfString");
	});

	it("recovers an empty value for an unterminated string containing only a trailing backslash", () => {
		const scanner = createScanner('"\\');
		assert.strictEqual(scanner.scan(), "String");
		assert.strictEqual(scanner.getTokenValue(), "");
		assert.strictEqual(scanner.getTokenError(), "UnexpectedEndOfString");
	});

	it("preserves prior decoded escapes when a later trailing backslash terminates the string", () => {
		const scanner = createScanner('"a\\nb\\');
		assert.strictEqual(scanner.scan(), "String");
		assert.strictEqual(scanner.getTokenValue(), "a\nb");
		assert.strictEqual(scanner.getTokenError(), "UnexpectedEndOfString");
	});
});
