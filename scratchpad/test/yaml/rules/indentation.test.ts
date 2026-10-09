// Batch-7 (#129): indentation — built last, after the harness proved itself
// on the twelve mechanical rules. Style only: structural legality is
// parse-validity's business.

import { builtin, testRule, testRuleInference } from "./harness.ts";

testRule(builtin("indentation"), [
	{
		name: "a consistently 2-space document passes",
		input: "a:\n  b:\n    c: 1\nd:\n  e: 2\n",
		expected: [],
	},
	{
		name: "a consistently 4-space document passes under consistent",
		input: "a:\n    b:\n        c: 1\n",
		expected: [],
	},
	{
		name: "a drifting level is flagged against the first observed unit",
		input: "a:\n  b: 1\nc:\n    d: 1\n",
		expected: [{ line: 3, character: 0, messageIncludes: "expected 2" }],
	},
	{
		name: "spaces: 4 pins the unit explicitly",
		input: "a:\n  b: 1\n",
		setting: { spaces: 4 },
		expected: [{ line: 1, character: 0, messageIncludes: "expected 4" }],
	},
	{
		name: "sequence indent style is consistent: the first occurrence decides",
		input: "a:\n  - x\nb:\n- y\n",
		expected: [{ line: 3, character: 0, messageIncludes: "should be indented" }],
	},
	{
		name: "indentSequences: true demands indented sequences",
		input: "a:\n- x\n",
		setting: { indentSequences: true },
		expected: [{ line: 1, character: 0, messageIncludes: "should be indented" }],
	},
	{
		name: "indentSequences: false forbids indented sequences",
		input: "a:\n  - x\n",
		setting: { indentSequences: false },
		expected: [{ line: 1, character: 0, messageIncludes: "should not be indented" }],
	},
	{
		// Content lines stay ABOVE the detected block-scalar indent — a
		// shallower line would terminate the scalar and reject the document,
		// making the fixture vacuous.
		name: "block-scalar content lines are the value's business",
		input: "a: |\n  deep\n   deeper\nb: 1\n",
		expected: [],
	},
	{
		// The closer sits at column 2, NOT column 0 — this parser rejects a
		// col-0 flow closer (pre-existing strictness), and a fixture on a
		// rejected shape asserts nothing.
		name: "flow collection continuation lines are flow syntax, not block indent",
		input: "a: {\n      x: 1,\n      y: 2\n  }\nb: 1\n",
		expected: [],
	},
	{
		name: "comment lines are not block structure",
		input: "a:\n  b: 1\n      # deep comment\nc: 2\n",
		expected: [],
	},
	{
		// `-5` is a plain scalar (YAML 1.2 §7.1), not a sequence entry — it
		// must not train seqIndented=true and flag the valid unindented
		// sequence below.
		name: "a -leading plain scalar value does not train the sequence policy (indented first)",
		input: "threshold:\n  -5\nallowed:\n- alice\n- bob\n",
		expected: [],
	},
	{
		// Reverse polarity: unindented sequences first, then a `-5` scalar —
		// which must not be flagged as an indented sequence entry.
		name: "a -leading plain scalar value does not train the sequence policy (unindented first)",
		input: "key1:\n- a\n- b\nkey2:\n  -5\n",
		expected: [],
	},
]);

// Round-1 regressions: real marker tokens, quoted comments, and compact levels.
testRule(builtin("indentation"), [
	{
		name: "---key retains its block indentation level",
		input: "outer:\n  ---key:\n    child: 1\n",
		setting: { spaces: 2 },
		expected: [],
	},
	{
		name: "...key retains its block indentation level",
		input: "outer:\n  ...key:\n    child: 1\n",
		setting: { spaces: 2 },
		expected: [],
	},
	{
		name: "a quoted hash key still opens a sequence with a trailing comment",
		input: '"a # b": # real comment\n  - x\n',
		setting: { indentSequences: false },
		expected: [{ line: 1, character: 0, messageIncludes: "should not be indented" }],
	},
	{
		name: "a quoted hash key still opens a sequence without a trailing comment",
		input: "'a # b':\n  - x\n",
		setting: { indentSequences: false },
		expected: [{ line: 1, character: 0, messageIncludes: "should not be indented" }],
	},
	{
		name: "a flow mapping after a sequence entry opens no block level",
		input: "- {a: 1}\n- {b: 2}\n",
		setting: { spaces: 4 },
		expected: [],
	},
	{
		name: "compact mapping nesting advances from the key column",
		input: "outer:\n  - two:\n      child: 1\n",
		setting: { spaces: 2 },
		expected: [],
	},
	{
		name: "expanded mapping nesting uses the same indentation unit",
		input: "outer:\n  -\n    two:\n      child: 1\n",
		setting: { spaces: 2 },
		expected: [],
	},
	{
		name: "a sequence under a compact key is compared with the key column",
		input: "outer:\n  - two:\n      - child\n",
		setting: { spaces: 2, indentSequences: false },
		expected: [
			{ line: 1, messageIncludes: "should not be indented" },
			{ line: 2, messageIncludes: "should not be indented" },
		],
	},
]);

testRuleInference(builtin("indentation"), [
	{
		name: "---key contributes the intermediate two-space level",
		inputs: ["outer:\n  ---key:\n    child: 1\n"],
		strict: { kind: "options", options: { spaces: 2 } },
	},
	{
		name: "...key contributes the intermediate two-space level",
		inputs: ["outer:\n  ...key:\n    child: 1\n"],
		strict: { kind: "options", options: { spaces: 2 } },
	},
	{
		name: "a quoted hash key with a real comment votes sequence indentation",
		inputs: ['"a # b": # real comment\n  - x\n'],
		strict: { kind: "options", options: { spaces: 2, indentSequences: true } },
	},
	{
		name: "a quoted hash key without a comment votes sequence indentation",
		inputs: ["'a # b':\n  - x\n"],
		strict: { kind: "options", options: { spaces: 2, indentSequences: true } },
	},
	{
		name: "flow mappings after sequence entries do not vote block spaces",
		inputs: ["- {a: 1}\n- {b: 2}\n"],
		strict: { kind: "none" },
	},
	{
		name: "equivalent compact and expanded mappings infer one spaces unit",
		inputs: ["outer:\n  - two:\n      child: 1\n", "outer:\n  -\n    two:\n      child: 1\n"],
		strict: { kind: "options", options: { spaces: 2, indentSequences: true } },
	},
]);
