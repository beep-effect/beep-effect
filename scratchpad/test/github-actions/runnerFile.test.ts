import { assert, describe, it } from "@effect/vitest";
import { delimiterFor, heredocBlock, isUsableName } from "../../effected/github-actions/internal/runnerFile.ts";

describe("runner-file heredoc protocol", () => {
	it("keeps the base delimiter when it is absent", () => {
		for (const value of ["", "ordinary value", "EFFECTED_EO", "EFFECTED_EO_F", "________"]) {
			assert.strictEqual(delimiterFor(value), "EFFECTED_EOF");
		}
	});

	it("counts bare and embedded base occurrences as collisions", () => {
		for (const value of ["EFFECTED_EOF", "prefixEFFECTED_EOFsuffix", "_EFFECTED_EOF", "EFFECTED_EOFx___"]) {
			assert.strictEqual(delimiterFor(value), "EFFECTED_EOF_");
		}
	});

	it("adds exactly one underscore beyond a following run", () => {
		for (const [value, expected] of [
			["EFFECTED_EOF_", "EFFECTED_EOF__"],
			["EFFECTED_EOF__suffix", "EFFECTED_EOF___"],
			["prefixEFFECTED_EOF___suffix___", "EFFECTED_EOF____"],
		] as const) {
			assert.strictEqual(delimiterFor(value), expected);
		}
	});

	it("selects the longest run across multiple occurrences in either order", () => {
		for (const value of [
			"EFFECTED_EOF\nEFFECTED_EOF___\nEFFECTED_EOF_",
			"EFFECTED_EOF___\nEFFECTED_EOF_\nEFFECTED_EOF",
			"prefixEFFECTED_EOF_suffixEFFECTED_EOF___suffix",
		]) {
			assert.strictEqual(delimiterFor(value), "EFFECTED_EOF____");
		}
	});

	it("finds adjacent occurrences and stops each run at the next base", () => {
		assert.strictEqual(delimiterFor("EFFECTED_EOFEFFECTED_EOF"), "EFFECTED_EOF_");
		assert.strictEqual(delimiterFor("EFFECTED_EOF__EFFECTED_EOF____EFFECTED_EOF_"), "EFFECTED_EOF_____");
	});

	it("handles a million-underscore run and a later embedded collision", () => {
		const underscores = "_".repeat(1_000_000);
		const value = `prefixEFFECTED_EOF${underscores}suffixEFFECTED_EOF___`;
		const delimiter = delimiterFor(value);
		assert.strictEqual(delimiter, `EFFECTED_EOF${underscores}_`);
		assert.isFalse(value.includes(delimiter));
	});

	it("preserves heredoc bytes for empty and multiline values with collisions", () => {
		assert.strictEqual(heredocBlock({ name: "result", value: "" }), "result<<EFFECTED_EOF\n\nEFFECTED_EOF\n");
		const value = "first\r\nembeddedEFFECTED_EOF__suffix\nEFFECTED_EOF\nlast";
		assert.strictEqual(
			heredocBlock({ name: "result", value }),
			`result<<EFFECTED_EOF___\n${value}\nEFFECTED_EOF___\n`,
		);
	});

	it("keeps the name guard's accepted and rejected boundaries", () => {
		for (const name of ["result", "a<b", "<name", "name>"]) {
			assert.isTrue(isUsableName(name));
		}
		for (const name of ["", "a\rb", "a\nb", "a=b", "a<<b", "name<", "<"]) {
			assert.isFalse(isUsableName(name));
		}
	});
});
