import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { lineText, lineTextAround } from "../../../../effected/cli/ui/internal/lineText.ts";
const runs = { arbitrary: fcRuns(100) };
it.effect("a tab maps to one visible space on either side of the cursor", () => Effect.sync(() => {
  assert.deepStrictEqual(lineTextAround("a\tb", 1), ["a", " b"]);
  assert.deepStrictEqual(lineTextAround("a\tb", 2), ["a ", "b"]);
}));
it.effect.prop("lineText is idempotent and its normalized text survives serialization faithfully", [Arbitrary.schema(S.String)], ([text]) => Effect.gen(function* () {
  const normalized = lineText(text);
  assert.strictEqual(lineText(normalized), normalized);
  const codec = S.fromJsonString(S.String);
  const encoded = yield* S.encodeEffect(codec)(normalized);
  assert.strictEqual(lineText(yield* S.decodeEffect(codec)(encoded)), normalized);
  assert.notMatch(normalized, /[\x00-\x1f\x7f-\x9f]/);
}), runs);
it.effect.prop("safe text retains content while hostile decoration and line breaks become one safe row", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
  const safe = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  assert.strictEqual(lineText(`\x1b[31m${safe}\x1b[0m\r\n${safe}\n${safe}\n`), `${safe} ${safe} ${safe} `);
}), runs);
