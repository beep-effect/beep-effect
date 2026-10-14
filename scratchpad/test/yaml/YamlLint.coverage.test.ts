import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { YamlEdit } from "../../effected/yaml/YamlEdit.ts";
import { StyleConflict, StyleVoteTally, YamlLint, YamlLintConfig, YamlStyleConflictError } from "../../effected/yaml/YamlLint.ts";
import { YamlLintDiagnostic, type YamlRule } from "../../effected/yaml/YamlLintRule.ts";

describe("lint conflict display", () => {
  it.effect("renders every candidate with count and one-based location", () => Effect.sync(() => {
    const tally = StyleVoteTally.make({ rule: "quoted-strings", dimension: "quoteType", value: "double", count: 2, offset: 0, length: 3, line: 1, character: 2 });
    const error = YamlStyleConflictError.make({ conflicts: [StyleConflict.make({ rule: tally.rule, dimension: tally.dimension, candidates: [tally] })] });
    assert.strictEqual(error.message, 'Conflicting style for quoted-strings.quoteType: "double" (2×, first at 2:3)');
    assert.strictEqual(Reflect.getPrototypeOf(Reflect.construct(YamlLint, [])), YamlLint.prototype);
  }));
});

describe("lint fix interval selection", () => {
  it.effect("applies reversed disjoint fixes and preserves diagnostic priority at conflicts and boundaries", () => Effect.sync(() => {
    const text = "a: 1\nb: 2\n";
    const config = YamlLintConfig.make({ rules: { custom: "error" } });
    for (const { name, fixes, expected } of [
      {
        name: "disjoint fixes in reversed offset order",
        fixes: [
          YamlEdit.make({ offset: 5, length: 1, content: "B" }),
          YamlEdit.make({ offset: 0, length: 1, content: "A" }),
        ],
        expected: "A: 1\nB: 2\n",
      },
      {
        name: "overlap from an earlier source offset loses to the first diagnostic",
        fixes: [
          YamlEdit.make({ offset: 5, length: 1, content: "B" }),
          YamlEdit.make({ offset: 4, length: 2, content: "XX" }),
        ],
        expected: "a: 1\nB: 2\n",
      },
      {
        name: "a conflict with a non-last accepted edit is rejected",
        fixes: [
          YamlEdit.make({ offset: 5, length: 1, content: "B" }),
          YamlEdit.make({ offset: 0, length: 1, content: "A" }),
          YamlEdit.make({ offset: 4, length: 2, content: "XX" }),
        ],
        expected: "A: 1\nB: 2\n",
      },
      {
        name: "same-offset insertions retain priority across another accepted edit",
        fixes: [
          YamlEdit.make({ offset: 10, length: 0, content: "# first\n" }),
          YamlEdit.make({ offset: 0, length: 1, content: "A" }),
          YamlEdit.make({ offset: 10, length: 0, content: "# second\n" }),
        ],
        expected: "A: 1\nb: 2\n# first\n",
      },
      {
        name: "an insertion inside a replacement loses to the first diagnostic",
        fixes: [
          YamlEdit.make({ offset: 0, length: 4, content: "A: 1" }),
          YamlEdit.make({ offset: 2, length: 0, content: "#" }),
        ],
        expected: "A: 1\nb: 2\n",
      },
      {
        name: "a replacement around an insertion loses to the first diagnostic",
        fixes: [
          YamlEdit.make({ offset: 2, length: 0, content: "#" }),
          YamlEdit.make({ offset: 0, length: 4, content: "A: 1" }),
        ],
        expected: "a:# 1\nb: 2\n",
      },
      {
        name: "touching replacement intervals remain disjoint in reversed order",
        fixes: [
          YamlEdit.make({ offset: 5, length: 1, content: "B" }),
          YamlEdit.make({ offset: 0, length: 5, content: "A: 1\n" }),
        ],
        expected: "A: 1\nB: 2\n",
      },
      {
        name: "an insertion at the end of a later replacement remains disjoint",
        fixes: [
          YamlEdit.make({ offset: 5, length: 0, content: "# " }),
          YamlEdit.make({ offset: 0, length: 5, content: "A: 1\n" }),
        ],
        expected: "A: 1\n# b: 2\n",
      },
    ]) {
      const rule: YamlRule = {
        id: "custom",
        check: () => A.map(fixes, (fix, offset) => YamlLintDiagnostic.make({
          rule: "custom", severity: "error", message: name,
          offset, length: 0, line: 0, character: offset, fix,
        })),
      };
      assert.strictEqual(Result.getOrThrow(YamlLint.fix(text, [rule], config)), expected, name);
    }
  }));
});
