import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { colonSpacing } from "../../../../effected/yaml/internal/rules/colon-spacing.ts";

const direct = (text: string, options: unknown, omitLines = false) => YamlLint.run(text, [{
  id: colonSpacing.id,
  check: (ctx) => colonSpacing.check(omitLines ? { ...ctx, lines: [] } : ctx, options),
}], YamlLintConfig.make({ rules: { [colonSpacing.id]: "error" } }));

it.effect("colon-spacing edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  assert.strictEqual(direct("a :   value\n", null).length, 2);
  assert.strictEqual(direct("a :   value\n", {}).length, 2);
  assert.strictEqual(direct("a :   value\n", { maxSpacesBefore: 1, maxSpacesAfter: 2 }).length, 1);
}));
