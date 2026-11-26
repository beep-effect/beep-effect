import { assert, describe, it } from "@effect/vitest";
import { builtin, testRuleInference } from "./harness.ts";

describe("config inference (#345)", () => {
  testRuleInference(builtin("quoted-strings"), [
    {
      name: "unanimous double-quoted values infer quoteType double",
      inputs: ['a: "x"\nb: "y"\n'],
      strict: { kind: "options", options: { quoteType: "double" } },
    },
    {
      name: "unanimous single-quoted values infer quoteType single",
      inputs: ["a: 'x'\nb: 'y'\n"],
      strict: { kind: "options", options: { quoteType: "single" } },
    },
    {
      name: "mixed quote styles conflict under strict, naming both spellings; a 1-1 lenient tie breaks to canonical value order",
      inputs: ["a: \"x\"\nb: 'y'\n"],
      strict: { kind: "conflict", dimension: "quoteType", values: ["double", "single"] },
      lenient: { quoteType: "double" },
    },
    {
      name: "the dominant style wins under lenient",
      inputs: ['a: "x"\nb: "y"\nc: \'z\'\n'],
      strict: { kind: "conflict", dimension: "quoteType", values: ["double", "single"] },
      lenient: { quoteType: "double" },
    },
    {
      name: "plain scalars say nothing about quote preference",
      inputs: ["a: x\nb: y\n"],
      strict: { kind: "none" },
    },
    {
      name: "quoted KEYS do not vote — keys are out of the rule's scope",
      inputs: ["'k': v\n"],
      strict: { kind: "none" },
    },
    {
      name: "multi-file: two double-quoted files agree",
      inputs: ['a: "x"\n', 'b: "y"\n'],
      strict: { kind: "options", options: { quoteType: "double" } },
    },
  ]);

  testRuleInference(builtin("indentation"), [
    {
      name: "unanimous two-space nesting infers spaces 2",
      inputs: ["a:\n  b: 1\n  c:\n    d: 2\n"],
      strict: { kind: "options", options: { spaces: 2 } },
    },
    {
      name: "an indented sequence under a key infers both dimensions",
      inputs: ["k:\n  - a\n  - b\n"],
      strict: { kind: "options", options: { spaces: 2, indentSequences: true } },
    },
    {
      name: "a non-indented sequence under a key infers indentSequences false",
      inputs: ["k:\n- a\n- b\n"],
      strict: { kind: "options", options: { indentSequences: false } },
    },
    {
      name: "mixed indent units conflict under strict; a 1-1 lenient tie breaks to canonical value order",
      inputs: ["a:\n  b: 1\n", "c:\n    d: 2\n"],
      strict: { kind: "conflict", dimension: "spaces", values: [2, 4] },
      lenient: { spaces: 2 },
    },
    {
      name: "the dominant unit wins under lenient",
      inputs: ["a:\n  b: 1\n", "b:\n  c: 1\n", "c:\n    d: 2\n"],
      strict: { kind: "conflict", dimension: "spaces", values: [2, 4] },
      lenient: { spaces: 2 },
    },
    {
      name: "a flat document says nothing about indentation",
      inputs: ["a: 1\nb: 2\n"],
      strict: { kind: "none" },
    },
  ]);

  testRuleInference(builtin("document-start"), [
    {
      name: "consistently marked streams infer present true",
      inputs: ["---\na: 1\n", "---\nb: 2\n"],
      strict: { kind: "options", options: { present: true } },
    },
    {
      name: "consistently unmarked streams infer present false",
      inputs: ["a: 1\n", "b: 2\n"],
      strict: { kind: "options", options: { present: false } },
    },
    {
      name: "a mixed corpus conflicts under strict; a 1-1 lenient tie breaks to canonical value order",
      inputs: ["---\na: 1\n", "b: 2\n"],
      strict: { kind: "conflict", dimension: "present", values: [true, false] },
      lenient: { present: false },
    },
    {
      name: "a directive-headed unmarked stream is malformed, not no-marker evidence: it observes nothing, the directive MANDATES ---",
      inputs: ["%YAML 1.2\na: 1\n"],
      strict: { kind: "none" },
    },
    {
      name: "a directive-headed marked stream still votes present true",
      inputs: ["%YAML 1.2\n---\na: 1\n"],
      strict: { kind: "options", options: { present: true } },
    },
    {
      name: "empty input observes nothing",
      inputs: [""],
      strict: { kind: "none" },
    },
  ]);

  testRuleInference(builtin("document-end"), [
    {
      name: "consistently ended streams infer present true",
      inputs: ["a: 1\n...\n", "b: 2\n...\n"],
      strict: { kind: "options", options: { present: true } },
    },
    {
      name: "consistently unended streams infer present false",
      inputs: ["a: 1\n", "b: 2\n"],
      strict: { kind: "options", options: { present: false } },
    },
    {
      name: "a mixed corpus conflicts under strict",
      inputs: ["a: 1\n...\n", "b: 2\n"],
      strict: { kind: "conflict", dimension: "present", values: [true, false] },
      lenient: { present: false },
    },
  ]);

  testRuleInference(builtin("comments-spacing"), [
    {
      name: "spaced trailing comments infer both dimensions",
      inputs: ["a: 1 # one\nb: 2 # two\n"],
      strict: { kind: "options", options: { minSpacesBefore: 1, requireSpaceAfter: true } },
    },
    {
      name: "two-space unspaced-after comments infer the observed spellings",
      inputs: ["a: 1  #x\n"],
      strict: { kind: "options", options: { minSpacesBefore: 2, requireSpaceAfter: false } },
    },
    {
      name: "mixed before-spacing conflicts under strict",
      inputs: ["a: 1 # x\nb: 2  # y\n"],
      strict: { kind: "conflict", dimension: "minSpacesBefore", values: [1, 2] },
      lenient: { minSpacesBefore: 1, requireSpaceAfter: true },
    },
    {
      name: "an own-line comment votes only the after-space dimension",
      inputs: ["# note\na: 1\n"],
      strict: { kind: "options", options: { requireSpaceAfter: true } },
    },
    {
      name: "a comment-free document observes nothing",
      inputs: ["a: 1\n"],
      strict: { kind: "none" },
    },
  ]);

  testRuleInference(builtin("line-length"), [
    {
      name: "the longest line is a floor, never an inferred max",
      inputs: ["a: 1\nkey: something\n"],
      strict: { kind: "none" },
      floors: { max: 14 },
    },
  ]);

  testRuleInference(builtin("empty-lines"), [
    {
      name: "the longest body blank run is a floor, never an inferred max",
      inputs: ["a: 1\n\n\nb: 2\n"],
      strict: { kind: "none" },
      floors: { max: 2 },
    },
  ]);

  it("the policy rules carry no infer hook — default-driven by construction", () => {
    assert.isUndefined(
      builtin("truthy").infer,
      "truthy's only evidence is violations, so nothing about a clean corpus reveals what the policy should be"
    );
    assert.isUndefined(
      builtin("key-duplicates").infer,
      "key-duplicates' only evidence is violations, so nothing about a clean corpus reveals what the policy should be"
    );
    assert.isUndefined(builtin("parse-validity").infer);
    assert.isUndefined(builtin("trailing-spaces").infer);
    assert.isUndefined(builtin("eof-newline").infer);
    assert.isUndefined(builtin("colon-spacing").infer);
    assert.isUndefined(builtin("hyphen-spacing").infer);
  });
});
