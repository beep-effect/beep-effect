import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { eofNewline } from "../../../../effected/yaml/internal/rules/eof-newline.ts";

const direct = (text: string, options: unknown, omitLines = false) => YamlLint.run(text, [{
  id: eofNewline.id,
  check: (ctx) => eofNewline.check(omitLines ? { ...ctx, lines: [] } : ctx, options),
}], YamlLintConfig.make({ rules: { [eofNewline.id]: "error" } }));

it.effect("eof-newline edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  assert.deepStrictEqual(direct("value", {}, true), []);
}));
