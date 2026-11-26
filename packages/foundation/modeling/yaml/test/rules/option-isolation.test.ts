import { YamlLint, YamlLintConfig } from "@beep/yaml";
import { YamlRule } from "@beep/yaml/YamlLintRule";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import { builtin } from "./harness.ts";
import type { LintContext, YamlLintDiagnostic } from "@beep/yaml/YamlLintRule";

const checkWithUndecodedOptions = (id: string, text: string, options: unknown) => {
  const rule = builtin(id);
  return A.filter(
    YamlLint.run(
      text,
      [
        YamlRule.make({
          id,
          check: dual(
            2,
            (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => rule.check(ctx, options)
          ),
        }),
      ],
      YamlLintConfig.make({ rules: { [id]: "error" } })
    ),
    (d) => d.rule === id
  );
};

describe("direct rule option isolation", () => {
  it("empty-lines retains max when maxEnd is fractional", () => {
    assert.deepStrictEqual(
      checkWithUndecodedOptions("empty-lines", "a: 1\n\n\n\n\nb: 2\n", { max: 5, maxEnd: 2.5 }),
      []
    );
  });
  it("empty-lines retains maxStart when max is invalid", () => {
    assert.deepStrictEqual(checkWithUndecodedOptions("empty-lines", "\n\na: 1\n", { maxStart: 2, max: "invalid" }), []);
  });
  it("empty-lines retains maxEnd when maxStart is invalid", () => {
    assert.deepStrictEqual(
      checkWithUndecodedOptions("empty-lines", "a: 1\n\n\n", { maxEnd: 2, maxStart: "invalid" }),
      []
    );
  });
  it("indentation retains spaces when indentSequences is invalid", () => {
    const diagnostics = checkWithUndecodedOptions("indentation", "a:\n  b: 1\n", {
      spaces: 4,
      indentSequences: "invalid",
    });
    assert.strictEqual(diagnostics.length, 1);
    assert.include(diagnostics[0]?.message ?? "", "expected 4");
  });
  it("indentation retains indentSequences when spaces is invalid", () => {
    const diagnostics = checkWithUndecodedOptions("indentation", "a:\n  - x\n", {
      spaces: "invalid",
      indentSequences: false,
    });
    assert.strictEqual(diagnostics.length, 1);
    assert.include(diagnostics[0]?.message ?? "", "should not be indented");
  });
  it("line-length retains max when severity is invalid", () => {
    const diagnostics = checkWithUndecodedOptions("line-length", "a: long\n", { max: 4, severity: "invalid" });
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.character, 4);
  });
  it("quoted-strings retains quoteType when required is invalid", () => {
    const diagnostics = checkWithUndecodedOptions("quoted-strings", 'a: "x"\n', {
      quoteType: "single",
      required: "invalid",
    });
    assert.strictEqual(diagnostics.length, 1);
    assert.include(diagnostics[0]?.message ?? "", "single quotes");
  });
  it("quoted-strings retains required when quoteType is invalid", () => {
    const diagnostics = checkWithUndecodedOptions("quoted-strings", "a: x\n", { quoteType: "invalid", required: true });
    assert.strictEqual(diagnostics.length, 1);
    assert.include(diagnostics[0]?.message ?? "", "should be quoted");
  });
  it("truthy retains allowed when checkKeys is invalid", () => {
    assert.deepStrictEqual(
      checkWithUndecodedOptions("truthy", "on: yes\n", { allowed: ["on", "yes"], checkKeys: "invalid" }),
      []
    );
  });
  it("truthy retains checkKeys when allowed is invalid", () => {
    assert.deepStrictEqual(
      checkWithUndecodedOptions("truthy", "on: x\n", { allowed: "invalid", checkKeys: false }),
      []
    );
  });
});
