import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { YamlDocument } from "../../../../effected/yaml/YamlDocument.ts";
import { keyDuplicates } from "../../../../effected/yaml/internal/rules/key-duplicates.ts";

it.effect("complex mapping keys are traversed without inventing scalar duplicate identities", () => Effect.gen(function* () {
  const text = "? [a, b]\n: one\n? [a, b]\n: two\n";
  const document = yield* YamlDocument.parse(text, { uniqueKeys: false });
  assert.deepStrictEqual(keyDuplicates.check({ text, document, lines: [], tokens: [] }, {}), []);
}));
