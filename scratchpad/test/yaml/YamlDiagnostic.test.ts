import { assert, describe, it } from "@effect/vitest";
import { YamlDiagnostic } from "../../effected/yaml/index.ts";

describe("YamlDiagnostic", () => {
	describe("fromRaw", () => {
		it("derives line/character from offset against the source text", () => {
			const text = "first: 1\nsecond: 2\nthird: 3";
			const d = YamlDiagnostic.fromRaw({ code: "UnexpectedToken", message: "boom", offset: 12, length: 3 }, text);
			assert.strictEqual(d.code, "UnexpectedToken");
			assert.strictEqual(d.message, "boom");
			assert.strictEqual(d.offset, 12);
			assert.strictEqual(d.length, 3);
			assert.strictEqual(d.line, 1);
			assert.strictEqual(d.character, 3);
		});

		it("counts CRLF as one line break and aligns characters after it", () => {
			const text = "a: 1\r\nb: 2";
			const d = YamlDiagnostic.fromRaw({ code: "MissingValue", message: "m", offset: 9, length: 1 }, text);
			assert.strictEqual(d.line, 1);
			assert.strictEqual(d.character, 3);
		});

		it("keeps the character nonnegative for an offset inside CRLF", () => {
			const d = YamlDiagnostic.fromRaw({ code: "UnexpectedToken", message: "m", offset: 1, length: 1 }, "\r\n");
			assert.strictEqual(d.offset, 1);
			assert.strictEqual(d.length, 1);
			assert.strictEqual(d.line, 1);
			assert.strictEqual(d.character, 0);
		});

		it("counts LS/PS as line breaks (position parity with jsonc)", () => {
			const text = `a${"\u2028"}b: 2`;
			const d = YamlDiagnostic.fromRaw({ code: "MissingKey", message: "m", offset: 3, length: 1 }, text);
			assert.strictEqual(d.line, 1);
			assert.strictEqual(d.character, 1);
		});

		it("clamps offsets past the end of the text", () => {
			const d = YamlDiagnostic.fromRaw({ code: "UnexpectedToken", message: "m", offset: 99, length: 0 }, "ab");
			assert.strictEqual(d.line, 0);
			assert.strictEqual(d.character, 99);
		});
	});

	describe("isFatal — the single fatal-code predicate", () => {
		it("declares exactly the union of the v3 fatal lists fatal", () => {
			const fatal = [
				"UndefinedAlias",
				"DuplicateAnchor",
				"AliasCountExceeded",
				"UnexpectedToken",
				"InvalidDirective",
				"MalformedFlowCollection",
				"InvalidIndentation",
				"TabIndentation",
				"UnresolvedTag",
				// Hardening additions beyond the v3 lists:
				"UnexpectedCharacter",
				"NestingDepthExceeded",
			] as const;
			for (const code of fatal) {
				assert.isTrue(YamlDiagnostic.isFatal(code), `${code} should be fatal`);
			}
			const nonFatal = [
				"DuplicateKey",
				"MissingValue",
				"MissingKey",
				"InvalidBlockStructure",
				"CircularAlias",
				"InvalidTagValue",
				"UnterminatedString",
				"CircularReference",
			] as const;
			for (const code of nonFatal) {
				assert.isFalse(YamlDiagnostic.isFatal(code), `${code} should not be fatal`);
			}
		});
	});

	describe("construction", () => {
		it("constructs via make with the parity five-field core plus message", () => {
			const d = YamlDiagnostic.make({
				code: "DuplicateKey",
				message: "Duplicate key: a",
				offset: 5,
				length: 1,
				line: 1,
				character: 0,
			});
			assert.strictEqual(d.code, "DuplicateKey");
			assert.strictEqual(d.line, 1);
			assert.strictEqual(d.character, 0);
		});
	});
});
