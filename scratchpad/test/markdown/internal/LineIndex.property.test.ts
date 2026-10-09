import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidLineTableError, LineIndex } from "../../../effected/markdown/internal/lineIndex.ts";
const runs = { arbitrary: fcRuns(100) };
describe("line index properties", () => {
  it.effect.prop("InvalidLineTableError decodes every encoding to an equivalent value without failure", [Arbitrary.schema(InvalidLineTableError)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(InvalidLineTableError)(value);
    const decoded = yield* S.decodeEffect(InvalidLineTableError)(encoded);
    assert.strictEqual(S.toEquivalence(InvalidLineTableError)(value, decoded), true);
    assert.deepStrictEqual(yield* S.encodeEffect(InvalidLineTableError)(decoded), encoded);
  }), runs);
  it.effect.prop("positions agree with an independent prefix scan at every source offset", [Arbitrary.schema(S.String)], ([text]) => Effect.sync(() => {
    const index = LineIndex.make(text);
    for (let offset = 0; offset <= text.length; offset += 1) {
      const prefix = text.slice(0, offset).split("\n");
      assert.deepStrictEqual(index.positionAt(offset), { line: prefix.length, column: (prefix[prefix.length - 1]?.length ?? 0) + 1 });
    }
    assert.deepStrictEqual(index.positionAt(-1), { line: 1, column: 1 });
    assert.deepStrictEqual(index.positionAt(text.length + 1), index.positionAt(text.length));
  }), runs);
});
