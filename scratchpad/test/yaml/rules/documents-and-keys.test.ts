// Batch-4 rules (#129): document-start, document-end (stream head/tail
// markers, opt-in) and key-duplicates — each through the shared fixture
// harness (which carries the mutation proofs).

import { builtin, testRule } from "./harness.ts";

testRule(builtin("document-start"), [
	{
		name: "a marked stream passes the default (require) posture",
		input: "---\na: 1\n",
		expected: [],
	},
	{
		name: "a missing marker reports at the head and fixes by insertion",
		input: "a: 1\n",
		expected: [{ line: 0, character: 0, messageIncludes: "Missing" }],
		fixed: "---\na: 1\n",
	},
	{
		// Deliberately broken input: %YAML without --- is a parse error, and
		// exactly the shape whose missing marker cannot be auto-fixed.
		name: "a stream with directives takes no synthesized marker fix",
		input: "%YAML 1.2\na: 1\n",
		expected: [{ line: 0, messageIncludes: "Missing" }],
		expectsParseErrors: true,
	},
	{
		name: "present: false forbids the head marker and fixes by removal",
		input: "---\na: 1\n",
		setting: { present: false },
		expected: [{ line: 0, character: 0, messageIncludes: "Forbidden" }],
		fixed: "a: 1\n",
	},
	{
		// A %-directive stream REQUIRES its marker: removing it would leave
		// invalid YAML, so the diagnostic ships without a fix.
		name: "present: false on a directive stream reports but takes no removal fix",
		input: "%YAML 1.2\n---\na: 1\n",
		setting: { present: false },
		expected: [{ line: 1, character: 0, messageIncludes: "Forbidden" }],
		fixed: "%YAML 1.2\n---\na: 1\n",
	},
	{
		name: "CRLF: the removal fix deletes the marker line with both terminator characters",
		input: "---\r\na: 1\r\n",
		setting: { present: false },
		expected: [{ line: 0, character: 0, messageIncludes: "Forbidden" }],
		fixed: "a: 1\r\n",
	},
	{
		name: "present: false passes an unmarked stream",
		input: "a: 1\n",
		setting: { present: false },
		expected: [],
	},
	{
		name: "the empty document reports nothing",
		input: "",
		expected: [],
	},
]);

testRule(builtin("document-end"), [
	{
		name: "an ended stream passes the default (require) posture",
		input: "a: 1\n...\n",
		expected: [],
	},
	{
		// The diagnostic's offset is the text END (after the final newline), so
		// line/character point at the head of the line that follows the last
		// content line — the position the offset actually names.
		name: "a missing end marker reports at the tail and fixes by appending",
		input: "a: 1\n",
		expected: [{ line: 1, character: 0, messageIncludes: "Missing" }],
		fixed: "a: 1\n...\n",
	},
	{
		name: "a missing end marker on newline-less input reports at the line end",
		input: "a: 1",
		expected: [{ line: 0, character: 4, messageIncludes: "Missing" }],
		fixed: "a: 1\n...\n",
	},
	{
		name: "present: false forbids the tail marker and fixes by removal",
		input: "a: 1\n...\n",
		setting: { present: false },
		expected: [{ line: 1, character: 0, messageIncludes: "Forbidden" }],
		fixed: "a: 1\n",
	},
	{
		name: "CRLF: the removal fix deletes the marker line with both terminator characters",
		input: "a: 1\r\n...\r\n",
		setting: { present: false },
		expected: [{ line: 1, character: 0, messageIncludes: "Forbidden" }],
		fixed: "a: 1\r\n",
	},
	{
		name: "present: false passes an unended stream",
		input: "a: 1\n",
		setting: { present: false },
		expected: [],
	},
]);

testRule(builtin("key-duplicates"), [
	{
		name: "unique keys report nothing",
		input: "a: 1\nb: 2\n",
		expected: [],
	},
	{
		name: "a duplicate reports at the SECOND occurrence",
		input: "a: 1\nb: 2\na: 3\n",
		expected: [{ line: 2, character: 0, messageIncludes: "Duplicate key: a" }],
	},
	{
		name: "duplicates in nested mappings report at nested positions",
		input: "outer:\n  x: 1\n  x: 2\n",
		expected: [{ line: 2, character: 2, messageIncludes: "Duplicate key: x" }],
	},
	{
		name: "duplicates inside sequence items report",
		input: "- k: 1\n  k: 2\n",
		expected: [{ line: 1, character: 2 }],
	},
	{
		name: "an int key and a string key with the same spelling do not collide",
		input: '1: int\n"1": string\n',
		expected: [],
	},
	{
		name: "three occurrences report twice",
		input: "a: 1\na: 2\na: 3\n",
		expected: [{ line: 1 }, { line: 2 }],
	},
]);
