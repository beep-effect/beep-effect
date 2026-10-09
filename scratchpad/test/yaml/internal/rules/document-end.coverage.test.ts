import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { documentEnd } from "../../../../effected/yaml/internal/rules/document-end.ts";

const direct = (text: string, options: unknown, omitLines = false) => YamlLint.run(text, [{
  id: documentEnd.id,
  check: (ctx) => documentEnd.check(omitLines ? { ...ctx, lines: [] } : ctx, options),
}], YamlLintConfig.make({ rules: { [documentEnd.id]: "error" } }));

it.effect("document-end edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  assert.deepStrictEqual(YamlLint.observe("", [documentEnd]).votes, []);
  assert.deepStrictEqual(YamlLint.observe("# only a comment\n", [documentEnd]).votes, []);
  const missing = direct("value", {}, true);
  assert.strictEqual(missing[0]?.line, 0);
  assert.strictEqual(missing[0]?.character, 0);
  const newline = direct("value\n", {}, true);
  assert.strictEqual(newline[0]?.line, 1);
  assert.strictEqual(newline[0]?.character, 0);
  const forbidden = direct("...\n", { present: false }, true);
  assert.strictEqual(forbidden.length, 1);
  assert.strictEqual(forbidden[0]?.fix, undefined);
  const inline = direct("... # keep\n", { present: false });
  assert.strictEqual(inline.length, 1);
  assert.strictEqual(inline[0]?.fix, undefined);
}));
