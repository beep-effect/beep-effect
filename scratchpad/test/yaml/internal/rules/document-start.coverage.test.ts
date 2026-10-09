import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { documentStart } from "../../../../effected/yaml/internal/rules/document-start.ts";

const direct = (text: string, options: unknown, omitLines = false) => YamlLint.run(text, [{
  id: documentStart.id,
  check: (ctx) => documentStart.check(omitLines ? { ...ctx, lines: [] } : ctx, options),
}], YamlLintConfig.make({ rules: { [documentStart.id]: "error" } }));

it.effect("document-start edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  assert.deepStrictEqual(YamlLint.observe("# only a comment\n", [documentStart]).votes, []);
  const result = direct("---\na: 1\n", { present: false }, true);
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0]?.fix, undefined);
}));
