import { YamlLint, YamlLintConfig } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { builtin, testRule } from "./harness.ts";

testRule(builtin("parse-validity"), [
  {
    name: "a valid document reports nothing",
    input: "a: 1\nb:\n  - x\n",
    expected: [],
  },
  {
    name: "an undefined alias reports a positioned error",
    input: "a: *missing\n",
    expected: [{ line: 0, character: 3, severity: "error", messageIncludes: "missing" }],
    expectsParseErrors: true,
  },
  {
    name: "duplicate keys are key-duplicates' business, not parse-validity's",
    input: "a: 1\na: 2\n",
    expected: [],
  },
]);

describe("parse-validity always-on contract", () => {
  it("runs under an empty config (no rules entry required)", () => {
    const diagnostics = YamlLint.run("a: *missing\n", YamlLint.builtins, YamlLintConfig.make({ rules: {} }));
    assert.isAbove(A.filter(diagnostics, (d) => d.rule === "parse-validity").length, 0);
  });
});
