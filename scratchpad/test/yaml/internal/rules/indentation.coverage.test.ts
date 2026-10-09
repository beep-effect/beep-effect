import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { indentation } from "../../../../effected/yaml/internal/rules/indentation.ts";

it.effect("directives, tabs and framing do not train block indentation", () => Effect.sync(() => {
  const text = "%YAML 1.2\n---\na:\n\tbad: x\n...\n";
  const findings = YamlLint.run(text, [indentation], YamlLintConfig.make({ rules: { indentation: { spaces: 2 } } }));
  assert.deepStrictEqual(findings.filter((finding) => finding.rule === "indentation"), []);
  const evidence = YamlLint.observe(text, [indentation]);
  assert.deepStrictEqual(evidence.votes, []);
}));

it.effect("compact nested sequences train their actual indentation and stable sequence policy", () => Effect.sync(() => {
  const text = "a:\n  - - x\n    - y\nb:\n  - z\n";
  const findings = YamlLint.run(text, [indentation], YamlLintConfig.make({ rules: { indentation: { spaces: 2, indentSequences: true } } }));
  assert.deepStrictEqual(findings, []);
  const evidence = YamlLint.observe(text, [indentation]);
  assert.deepStrictEqual(evidence.votes.filter((vote) => vote.dimension === "indentSequences").map((vote) => vote.value), [true]);
  assert.isAbove(evidence.votes.filter((vote) => vote.dimension === "spaces").length, 0);
  assert.deepStrictEqual(evidence.votes.filter((vote) => vote.dimension === "indentSequences").map((vote) => vote.count), [2]);
}));

it.effect("an unindented first sequence establishes policy before an indentation unit exists", () => Effect.sync(() => {
  const text = "a:\n- x\nb:\n- y\n";
  assert.deepStrictEqual(YamlLint.run(text, [indentation], YamlLintConfig.make({ rules: { indentation: "error" } })), []);
  const evidence = YamlLint.observe(text, [indentation]);
  assert.deepStrictEqual(evidence.votes.map((vote) => vote.value), [false]);
  assert.deepStrictEqual(evidence.votes.map((vote) => vote.count), [2]);
}));
