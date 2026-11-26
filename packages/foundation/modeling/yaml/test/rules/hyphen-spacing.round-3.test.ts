import { Yaml, YamlLint, YamlLintConfig } from "@beep/yaml";
import { hyphenSpacing } from "@beep/yaml/internal/rules/hyphen-spacing";
import { YamlRule } from "@beep/yaml/YamlLintRule";
import { assert, describe, it } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Str from "effect/String";
import type { LintContext, YamlLintDiagnostic } from "@beep/yaml/YamlLintRule";

const config = YamlLintConfig.make({ rules: { "hyphen-spacing": "error" } });
const headers = ["|2", ">2", "|2-", "|-2", ">2-", ">-2", "|2+", "|+2", ">2+", ">+2"];
const properties = ["", "!!str ", "&ref ", "!!str &ref ", "&ref !!str "];

const chompSuffix = (header: string): string => {
  const stripDropsFinalBreak = Str.includes("-")(header);
  if (stripDropsFinalBreak) return "";
  const keepRetainsTrailingBlank = Str.includes("+")(header);
  const clipKeepsOneBreak = "\n";
  return keepRetainsTrailingBlank ? "\n\n" : clipKeepsOneBreak;
};

const decodedHelloWorldBlockValue = (header: string): string =>
  (header[0] === "|" ? "hello\nworld" : "hello world") + chompSuffix(header);

const assertMappingValueFix = (header: string, property: string, value: string) => {
  const input = `-   - item: ${property}${header}\n    hello\n    world\n\n`;
  const fixed = `- - item: ${property}${header}\n    hello\n    world\n\n`;
  const expected = [[{ item: value }]];
  const diagnostics = YamlLint.run(input, [hyphenSpacing], config);
  assert.strictEqual(diagnostics.length, 1);
  assert.isDefined(diagnostics[0]?.fix);
  assertSuccess(Yaml.parseResult(input), expected);
  const result = YamlLint.fix(input, [hyphenSpacing], config);
  assertSuccess(result, fixed);
  assertSuccess(Yaml.parseResult(result.success), expected);
};

const assertNestedFixWithheld = (header: string, property: string, value: string) => {
  const nested = `-   - ${property}${header}\n      hello\n      world\n\n`;
  const nestedDiagnostics = YamlLint.run(nested, [hyphenSpacing], config);
  assert.strictEqual(nestedDiagnostics.length, 1);
  assert.isUndefined(nestedDiagnostics[0]?.fix);
  assertSuccess(Yaml.parseResult(nested), [[value]]);
  const nestedResult = YamlLint.fix(nested, [hyphenSpacing], config);
  assertSuccess(nestedResult, nested);
  assertSuccess(Yaml.parseResult(nestedResult.success), [[value]]);
};

const assertDirectFixApplied = (header: string, property: string, value: string) => {
  const direct = `-   ${property}${header}\n  hello\n  world\n\n`;
  const directDiagnostics = YamlLint.run(direct, [hyphenSpacing], config);
  assert.strictEqual(directDiagnostics.length, 1);
  assert.isDefined(directDiagnostics[0]?.fix);
  assertSuccess(Yaml.parseResult(direct), [value]);
  const directResult = YamlLint.fix(direct, [hyphenSpacing], config);
  assertSuccess(directResult, `- ${property}${header}\n  hello\n  world\n\n`);
  assertSuccess(Yaml.parseResult(directResult.success), [value]);
};

describe("hyphen relocation safety", () => {
  it("fixes outer hyphens before explicit-indent mapping values without changing decoded values", () => {
    for (const header of headers) {
      const value = decodedHelloWorldBlockValue(header);
      for (const property of properties) assertMappingValueFix(header, property, value);
    }
  });

  it("withholds only fixes that move the explicit-indent scalar's parent hyphen", () => {
    for (const header of headers) {
      const value = decodedHelloWorldBlockValue(header);
      for (const property of properties) {
        assertNestedFixWithheld(header, property, value);
        assertDirectFixApplied(header, property, value);
      }
    }
  });

  it("bounds token reads linearly for recovered deeply nested input", () => {
    const readsBySize: Array<number> = [];
    for (const size of [1024, 2048]) {
      const input = `${Str.repeat(size)("-   ")}x\n`;
      let reads = 0;
      let tokenCount = 0;
      const diagnostics = YamlLint.run(
        input,
        [
          YamlRule.make({
            id: hyphenSpacing.id,
            check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
              assert.isAbove(ctx.document.errors.length, 0);
              tokenCount = ctx.tokens.length;
              const tokenReadCounter = new Proxy(ctx.tokens, {
                get: (target, key, receiver) => {
                  reads++;
                  return Reflect.get(target, key, receiver);
                },
              });
              return hyphenSpacing.check({ ...ctx, tokens: tokenReadCounter }, {});
            }),
          }),
        ],
        config
      );
      assert.strictEqual(diagnostics.length, size);
      assert.isTrue(A.every(diagnostics, (diagnostic) => diagnostic.fix !== undefined));
      assert.isAtMost(reads, 12 * tokenCount, "token-array reads count deterministic operations, excluding parsing");
      readsBySize.push(reads);
    }
    assert.isAtMost(A.getUnsafe(readsBySize, 1), 2 * A.getUnsafe(readsBySize, 0));
  });
});
