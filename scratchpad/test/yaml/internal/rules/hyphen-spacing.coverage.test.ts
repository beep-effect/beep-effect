import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlLint, YamlLintConfig } from "../../../../effected/yaml/YamlLint.ts";
import { hyphenSpacing } from "../../../../effected/yaml/internal/rules/hyphen-spacing.ts";

it.effect("direct options clamp spacing and retain a safe deletion", () => Effect.sync(() => {
  for (const options of [{ maxSpacesAfter: 2 }, { maxSpacesAfter: 0 }, { maxSpacesAfter: "invalid" }, null]) {
    const findings = YamlLint.run("-   x\n", [{ id: hyphenSpacing.id, check: (ctx) => hyphenSpacing.check(ctx, options) }], YamlLintConfig.make({ rules: { "hyphen-spacing": "error" } }));
    assert.strictEqual(findings.length, 1);
    const max = options?.maxSpacesAfter === 2 ? 2 : 1;
    assert.strictEqual(findings[0]?.length, 3);
    assert.strictEqual(findings[0]?.fix?.length, 3 - max);
    assert.strictEqual(findings[0]?.fix?.content, "");
  }
}));
