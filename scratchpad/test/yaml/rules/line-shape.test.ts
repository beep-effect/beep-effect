// Batch-3 line-shape rules (#129): line-length, trailing-spaces,
// empty-lines, eof-newline — each through the shared fixture harness (which
// carries the mutation proofs).

import { builtin, testRule } from "./harness.ts";

testRule(builtin("line-length"), [
	{
		name: "lines within the default 120 report nothing",
		input: `short: 1\nlonger: ${"x".repeat(100)}\n`,
		expected: [],
	},
	{
		name: "a line past the default 120 reports at the boundary",
		input: `key: ${"x".repeat(130)}\n`,
		expected: [{ line: 0, character: 120, length: 15, messageIncludes: "longer than 120" }],
	},
	{
		name: "a configured max applies",
		input: "key: 123456\n",
		setting: { max: 8 },
		expected: [{ line: 0, character: 8, length: 3, messageIncludes: "longer than 8" }],
	},
	{
		// Line text excludes the terminator whole — CRLF's `\r` is not a
		// 121st character.
		name: "CRLF: an exactly-max-width line passes at the default 120",
		input: `key: ${"x".repeat(115)}\r\n`,
		expected: [],
	},
	{
		name: "CRLF: one character past the max reports 121, not 122",
		input: `key: ${"x".repeat(116)}\r\n`,
		expected: [{ line: 0, character: 120, length: 1, messageIncludes: "(121)" }],
	},
	{
		name: "multiple long lines each report",
		input: `a: ${"x".repeat(10)}\nb: ${"y".repeat(10)}\n`,
		setting: { max: 5 },
		expected: [
			{ line: 0, character: 5 },
			{ line: 1, character: 5 },
		],
	},
]);

testRule(builtin("trailing-spaces"), [
	{
		name: "clean lines report nothing",
		input: "a: 1\nb: 2\n",
		expected: [],
	},
	{
		name: "trailing spaces report and fix away",
		input: "a: 1   \nb: 2\t\n",
		expected: [
			{ line: 0, character: 4, length: 3 },
			{ line: 1, character: 4, length: 1 },
		],
		fixed: "a: 1\nb: 2\n",
	},
	{
		name: "trailing whitespace inside block-scalar content is the value's business",
		input: "a: |\n  content   \n  more\n",
		expected: [],
	},
	{
		name: "a trailing-space fix never touches comments",
		input: "a: 1 # keep me   \n",
		expected: [{ line: 0, character: 14, length: 3 }],
		fixed: "a: 1 # keep me\n",
	},
	{
		name: "CRLF: trailing spaces before the \\r report and fix away, keeping the terminator",
		input: "a: 1   \r\nb: 2\r\n",
		expected: [{ line: 0, character: 4, length: 3 }],
		fixed: "a: 1\r\nb: 2\r\n",
	},
]);

testRule(builtin("empty-lines"), [
	{
		name: "up to two consecutive blank lines pass by default",
		input: "a: 1\n\n\nb: 2\n",
		expected: [],
	},
	{
		name: "a third consecutive blank line reports and fixes away",
		input: "a: 1\n\n\n\nb: 2\n",
		expected: [{ line: 3, character: 0 }],
		fixed: "a: 1\n\n\nb: 2\n",
	},
	{
		name: "a lower configured max applies",
		input: "a: 1\n\n\nb: 2\n",
		setting: { max: 1 },
		expected: [{ line: 2, character: 0 }],
		fixed: "a: 1\n\nb: 2\n",
	},
	{
		name: "blank lines at document start are capped by maxStart",
		input: "\n\na: 1\n",
		expected: [{ line: 0, character: 0 }],
		fixed: "a: 1\n",
	},
	{
		name: "blank lines at document end are capped by maxEnd",
		input: "a: 1\n\n\n",
		expected: [{ line: 1, character: 0 }],
		fixed: "a: 1\n",
	},
	{
		name: "blank lines inside block-scalar content are the value's business",
		input: "a: |+\n  one\n\n\n\n  two\n",
		expected: [],
	},
	{
		name: "CRLF: blank lines count as empty and the fix removes both terminator characters",
		input: "a: 1\r\n\r\n\r\n\r\nb: 2\r\n",
		expected: [{ line: 3, character: 0, length: 2 }],
		fixed: "a: 1\r\n\r\n\r\nb: 2\r\n",
	},
]);

testRule(builtin("eof-newline"), [
	{
		name: "a trailing newline reports nothing",
		input: "a: 1\n",
		expected: [],
	},
	{
		name: "the empty document reports nothing",
		input: "",
		expected: [],
	},
	{
		name: "a missing final newline reports and fixes",
		input: "a: 1",
		expected: [{ line: 0, character: 4, length: 0 }],
		fixed: "a: 1\n",
	},
]);
