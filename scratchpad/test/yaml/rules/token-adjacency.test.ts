// Batch-6 token-adjacency rules (#129): comments-spacing, colon-spacing,
// hyphen-spacing — each through the shared fixture harness (which carries
// the mutation proofs).

import { builtin, testRule } from "./harness.ts";

testRule(builtin("comments-spacing"), [
	{
		name: "well-spaced comments pass",
		input: "# leading\na: 1 # trailing\n",
		expected: [],
	},
	{
		name: "a missing space after # reports and fixes",
		input: "#tight\na: 1\n",
		expected: [{ line: 0, character: 0, messageIncludes: 'after "#"' }],
		fixed: "# tight\na: 1\n",
	},
	{
		name: "a bare # is fine",
		input: "#\na: 1\n",
		expected: [],
	},
	{
		name: "a shebang at the stream head is exempt",
		input: "#!/usr/bin/env tool\na: 1\n",
		expected: [],
	},
	{
		// A ZERO-space trailing comment cannot exist — YAML 1.2 §6.6 requires
		// whitespace before `#` (a glued `1# c` is a plain scalar), so the
		// default minSpacesBefore of 1 is the grammar floor and the
		// before-check only bites when configured higher.
		name: "minSpacesBefore: 2 wants more breathing room",
		input: "a: 1 # c\n",
		setting: { minSpacesBefore: 2 },
		expected: [{ line: 0, character: 4 }],
		fixed: "a: 1  # c\n",
	},
	{
		name: "own-line comment indentation is not 'space before'",
		input: "a: 1\n  # indented own-line\nb: 2\n",
		expected: [],
	},
]);

testRule(builtin("colon-spacing"), [
	{
		name: "key: value passes",
		input: "a: 1\nb:\n  c: 2\n",
		expected: [],
	},
	{
		name: "space before the colon reports and fixes",
		input: "a : 1\n",
		expected: [{ line: 0, character: 1, messageIncludes: 'before ":"' }],
		fixed: "a: 1\n",
	},
	{
		name: "extra spaces after the colon report and fix to one",
		input: "a:   1\n",
		expected: [{ line: 0, character: 2, messageIncludes: 'after ":"' }],
		fixed: "a: 1\n",
	},
	{
		name: "a value on the next line is fine",
		input: "a:\n  b: 1\n",
		expected: [],
	},
	{
		name: "spaces before a comment after the colon are comments-spacing's business",
		input: "a:   # c\n  b: 1\n",
		expected: [],
	},
	{
		name: "an explicit-value colon at the head of its line is structure, not spacing",
		input: "? key\n: value\n",
		expected: [],
	},
]);

testRule(builtin("hyphen-spacing"), [
	{
		name: "- item passes",
		input: "- a\n- b\n",
		expected: [],
	},
	{
		name: "extra spaces after the hyphen report and fix to one",
		input: "-   a\n- b\n",
		expected: [{ line: 0, character: 1, messageIncludes: 'after "-"' }],
		fixed: "- a\n- b\n",
	},
	{
		name: "a nested value on the next line is fine",
		input: "-\n  a: 1\n",
		expected: [],
	},
	{
		name: "indentation before the hyphen is not this rule's business",
		input: "steps:\n  - a\n  - b\n",
		expected: [],
	},
]);
