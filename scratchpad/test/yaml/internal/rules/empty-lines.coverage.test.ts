import { assert, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { emptyLines } from "../../../../effected/yaml/internal/rules/empty-lines.ts";

it.effect("empty-lines edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  const observations = YamlLint.observe("a: 1\n\nb: 2\n\nc: 3\n", [emptyLines]);
  assert.strictEqual(observations.floors.length, 1);
  assert.strictEqual(observations.floors[0]?.value, 1);
}));

it.effect("excess blank lines are removed whole under LF and CRLF while scalar content survives", () => Effect.sync(() => {
  const config = YamlLintConfig.make({ rules: { "empty-lines": { max: 1, maxStart: 0, maxEnd: 0 } } });
  for (const eol of ["\n", "\r\n"]) {
    const text = `${eol}a: 1${eol}${eol}${eol}b: 2${eol}${eol}`;
    assertSuccess(YamlLint.fix(text, [emptyLines], config), `a: 1${eol}${eol}b: 2${eol}`);
  }
  const scalar = "a: |+\n  first\n\n\n  last\n";
  assert.deepStrictEqual(YamlLint.run(scalar, [emptyLines], config), []);
}));
