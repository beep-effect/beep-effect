import { builtin, testRule } from "./harness.ts";

testRule(builtin("quoted-strings"), [
  {
    name: "double-quoted values pass the default (double) policy",
    input: 'a: "one"\nb: plain\n',
    expected: [],
  },
  {
    name: "single-quoted values report and requote to double",
    input: "a: 'one'\nb: 'two'\n",
    expected: [
      { line: 0, character: 3, messageIncludes: "double" },
      { line: 1, character: 3 },
    ],
    fixed: 'a: "one"\nb: "two"\n',
  },
  {
    name: "quoteType single inverts the policy",
    input: 'a: "one"\n',
    setting: { quoteType: "single" },
    expected: [{ line: 0, character: 3, messageIncludes: "single" }],
    fixed: "a: 'one'\n",
  },
  {
    name: "a single→double swap that cannot preserve an embedded double quote ships no fix, and fix() is a no-op",
    input: `a: 'say "hi"'\n`,
    expected: [{ line: 0, character: 3 }],
    fixed: `a: 'say "hi"'\n`,
  },
  {
    name: "required: true flags plain string values and quotes them",
    input: "a: plain\nb: 2\n",
    setting: { required: true },
    expected: [{ line: 0, character: 3, messageIncludes: "quoted" }],
    fixed: 'a: "plain"\nb: 2\n',
  },
  {
    name: "keys are out of scope",
    input: "'a': \"one\"\n",
    expected: [],
  },
]);

testRule(builtin("truthy"), [
  {
    name: "canonical true/false pass the default allowed list",
    input: "a: true\nb: false\n",
    expected: [],
  },
  {
    name: "yes/no report as string lookalikes and fix by quoting",
    input: "a: yes\nb: No\n",
    expected: [
      { line: 0, character: 3, messageIncludes: '"yes"' },
      { line: 1, character: 3, messageIncludes: '"No"' },
    ],
    fixed: 'a: "yes"\nb: "No"\n',
  },
  {
    name: "boolean spellings outside allowed respell to the canonical value",
    input: "a: True\nb: FALSE\n",
    expected: [
      { line: 0, character: 3 },
      { line: 1, character: 3 },
    ],
    fixed: "a: true\nb: false\n",
  },
  {
    name: "the workflow on: key is flagged and quoted",
    input: "on:\n  push: {}\n",
    expected: [{ line: 0, character: 0, messageIncludes: '"on"' }],
    fixed: '"on":\n  push: {}\n',
  },
  {
    name: "checkKeys: false leaves keys alone",
    input: "on:\n  push: {}\n",
    setting: { checkKeys: false },
    expected: [],
  },
  {
    name: "a custom allowed list is honored, and a boolean with no allowed respelling of its truth value takes no fix",
    input: "a: yes\nb: true\n",
    setting: { allowed: ["yes", "no"] },
    expected: [{ line: 1, character: 3 }],
    fixed: "a: yes\nb: true\n",
  },
  {
    name: "tagged scalars are explicit intent and pass",
    input: "a: !!str yes\nb: !!bool True\n",
    expected: [],
  },
  {
    name: "quoted strings are not truthy",
    input: "a: \"yes\"\nb: 'on'\n",
    expected: [],
  },
]);
