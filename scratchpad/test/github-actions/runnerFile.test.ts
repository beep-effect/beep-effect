import { assert, describe, it } from "@effect/vitest";
import { delimiterFor, heredocBlock, isUsableName } from "../../effected/github-actions/internal/runnerFile.ts";

// Follow FileCommandManager.ReadLine and its heredoc endIndex calculation,
// rather than removing framing by fixed slices.
// https://github.com/actions/runner/blob/main/src/Runner.Worker/FileCommandManager.cs
const parseRunnerBlock = (body: string, windows: boolean): string => {
	let index = 0;
	const readLine = () => {
		const lfIndex = body.indexOf("\n", index);
		assert.isAtLeast(lfIndex, index, "the runner requires a newline before the delimiter");
		const crlfIndex = body.indexOf("\r\n", index);
		const crlf = windows && crlfIndex >= 0 && crlfIndex < lfIndex;
		const end = crlf ? crlfIndex : lfIndex;
		const newlineLength = crlf ? 2 : 1;
		const line = body.slice(index, end);
		index = end + newlineLength;
		return { line, newlineLength };
	};
	const header = readLine().line;
	const delimiter = header.slice(header.indexOf("<<") + 2);
	const startIndex = index;
	let endIndex = index;
	let current = readLine();
	while (current.line !== delimiter) {
		endIndex = index - current.newlineLength;
		current = readLine();
	}
	return body.slice(startIndex, endIndex);
};

describe("runner-file heredoc protocol", () => {
	it("reproduces the Windows runner's terminal-CR loss with LF framing", () => {
		const block = heredocBlock({ name: "result", value: "abc\r" });
		assert.strictEqual(parseRunnerBlock(block, true), "abc");
		assert.strictEqual(parseRunnerBlock(block, false), "abc\r");
	});

	for (const windows of [false, true]) {
		it(`preserves terminal CR, CRLF and LF through the ${windows ? "Windows" : "POSIX"} runner parser`, () => {
			for (const value of ["", "\r", "abc\r", "abc\r\n", "abc\n", "first\r\nsecond\nlast\r", "EFFECTED_EOF\r"]) {
				const block = heredocBlock({ name: "result", value, lineEnding: windows ? "\r\n" : "\n" });
				assert.strictEqual(parseRunnerBlock(block, windows), value);
			}
		});
	}

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
