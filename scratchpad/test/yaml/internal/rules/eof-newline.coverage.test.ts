import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlDocument } from "../../../../effected/yaml/YamlDocument.ts";
import { YamlScalar } from "../../../../effected/yaml/YamlNode.ts";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { eofNewline } from "../../../../effected/yaml/internal/rules/eof-newline.ts";

const direct = (text: string, options: unknown, omitLines = false) => YamlLint.run(text, [{
  id: eofNewline.id,
  check: (ctx) => eofNewline.check(omitLines ? { ...ctx, lines: [] } : ctx, options),
}], YamlLintConfig.make({ rules: { [eofNewline.id]: "error" } }));

it.effect("eof-newline edge cases retain diagnostics and safe fix boundaries", () => Effect.sync(() => {
  assert.deepStrictEqual(direct("value", {}, true), []);
}));


it.effect("retains the newline fix when recovered scalar text has no nonblank value line", () => Effect.sync(() => {
  const text = "|+\n  content\n  ";
  const diagnostics = YamlLint.run(text, [{
    id: eofNewline.id,
    check: (ctx) => eofNewline.check({ ...ctx, document: YamlDocument.make({ ...ctx.document,
      contents: YamlScalar.make({ value: "\n", style: "block-literal", chomp: "keep", offset: 0, length: text.length }),
    }) }, {}),
  }], YamlLintConfig.make({ rules: { [eofNewline.id]: "error" } }));
  assert.strictEqual(diagnostics.length, 1);
  assert.strictEqual(diagnostics[0]?.fix?.content, "\n");
}));
