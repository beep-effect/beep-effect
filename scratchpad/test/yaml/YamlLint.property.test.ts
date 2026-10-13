import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { YamlLint } from "../../effected/yaml/YamlLint.ts";
import { LintContext, YamlLintDiagnostic } from "../../effected/yaml/YamlLintRule.ts";
import { eofNewline } from "../../effected/yaml/internal/rules/eof-newline.ts";
import { YamlLintRuleSetting, YamlLintConfig, StyleVoteTally, StyleFloorTally, StyleEvidence, StyleConflict, YamlStyleConflictError } from "../../effected/yaml/YamlLint.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and decoding never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("YamlLint schema property floor", () => {
  roundTrips("YamlLintRuleSetting", YamlLintRuleSetting);
  roundTrips("YamlLintConfig", YamlLintConfig);
  roundTrips("StyleVoteTally", StyleVoteTally);
  roundTrips("StyleFloorTally", StyleFloorTally);
  roundTrips("StyleEvidence", StyleEvidence);
  roundTrips("StyleConflict", StyleConflict);
  roundTrips("YamlStyleConflictError", YamlStyleConflictError);
});

describe("YamlLint line and own-key regressions", () => {
  it("lines agree with CR-aware token positions and omit only the final empty segment", () => {
    for (const [text, expected] of [
      ["a\r\nb\rc\nd\u2028e\u2029f\r", [
        { text: "a", offset: 0, number: 0 },
        { text: "b", offset: 3, number: 1 },
        { text: "c", offset: 5, number: 2 },
        { text: "d\u2028e\u2029f", offset: 7, number: 3 },
      ]],
      ["", []],
      ["\r", [{ text: "", offset: 0, number: 0 }]],
      ["\r\n", [{ text: "", offset: 0, number: 0 }]],
      ["\n", [{ text: "", offset: 0, number: 0 }]],
      ["a\r\r", [{ text: "a", offset: 0, number: 0 }, { text: "", offset: 2, number: 1 }]],
    ] as const) {
      let checks = 0;
      YamlLint.run(text, [{ id: "lines", check: (ctx) => {
        checks++;
        assert.isTrue(S.is(LintContext)(ctx));
        assert.deepStrictEqual(ctx.lines, expected);
        for (const token of ctx.tokens) {
          const line = ctx.lines[token.line];
          if (line !== undefined) assert.strictEqual(token.character, token.offset - line.offset);
        }
        return [];
      } }], YamlLintConfig.make({ rules: { lines: "error" } }));
      assert.strictEqual(checks, 1);
    }
  });

  it("eof-newline retains its LF policy while reporting the last CR-aware line", () => {
    const config = YamlLintConfig.make({ rules: { "eof-newline": "error" } });
    const diagnostic = YamlLint.run("a: 1\rb: 2", [eofNewline], config)[0];
    assert.strictEqual(diagnostic?.line, 1);
    assert.strictEqual(diagnostic?.character, 4);
    assert.strictEqual(diagnostic?.offset, 9);
    assert.strictEqual(YamlLint.run("a: 1\r", [eofNewline], config).length, 1);
    assert.deepStrictEqual(YamlLint.run("a: 1\r\n", [eofNewline], config), []);
  });

  it("absent toString and constructor rules never run", () => {
    let checks = 0;
    const rules = ["toString", "constructor"].map((id) => ({ id, check: () => {
      checks++;
      return [];
    } }));
    assert.deepStrictEqual(YamlLint.run("a: 1\n", rules, YamlLintConfig.make({ rules: {} })), []);
    assert.strictEqual(checks, 0);
  });

  it("an own __proto__ rule obeys warning and off settings", () => {
    const rule = { id: "__proto__", check: () => [YamlLintDiagnostic.make({
      rule: "__proto__", severity: "error", message: "own rule", offset: 0, length: 0, line: 0, character: 0,
    })] };
    const warning = YamlLintConfig.make({ rules: R.fromEntries([["__proto__", "warning"] as const]) });
    assert.strictEqual(O.getOrUndefined(R.get(warning.rules, "__proto__")), "warning");
    assert.strictEqual(YamlLint.run("a: 1\n", [rule], warning)[0]?.severity, "warning");
    const off = YamlLintConfig.make({ rules: R.fromEntries([["__proto__", "off"] as const]) });
    assert.deepStrictEqual(YamlLint.run("a: 1\n", [rule], off), []);
  });
});
