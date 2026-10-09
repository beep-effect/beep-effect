import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlDocument } from "../../../../effected/yaml/YamlDocument.ts";
import { lineLength } from "../../../../effected/yaml/internal/rules/line-length.ts";

it.effect("empty input provides no line-length inference floor", () => Effect.sync(() => {
  assert.isDefined(lineLength.infer);
  if (lineLength.infer === undefined) return;
  const document = YamlDocument.make({ contents: null, errors: [], warnings: [], directives: [] });
  assert.deepStrictEqual(lineLength.infer({ text: "", lines: [{ text: "", offset: 0, number: 0 }], tokens: [], document }), []);
}));
