import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { commentsSpacing } from "../../../../effected/yaml/internal/rules/comments-spacing.ts";

const direct = (text: string, options: unknown, omitLines = false) => YamlLint.run(text, [{
  id: commentsSpacing.id,
  check: (ctx) => commentsSpacing.check(omitLines ? { ...ctx, lines: [] } : ctx, options),
}], YamlLintConfig.make({ rules: { [commentsSpacing.id]: "error" } }));

it.effect("comments-spacing edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  assert.deepStrictEqual(YamlLint.observe("#!/bin/yaml\n#\na: 1\n", [commentsSpacing]).votes, []);
  assert.deepStrictEqual(direct("#\n", null), []);
}));
