import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { InvalidLineTableError, LineIndex } from "@beep/markdown/internal/lineIndex";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
describe("line index properties", () => {
  it.effect.prop(
    "InvalidLineTableError decodes every encoding to an equivalent value without failure",
    [Arbitrary.schema(InvalidLineTableError)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(InvalidLineTableError)(value);
        const decoded = yield* S.decodeEffect(InvalidLineTableError)(encoded);
        assert.strictEqual(S.toEquivalence(InvalidLineTableError)(value, decoded), true);
        const value1 = yield* S.encodeEffect(InvalidLineTableError)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
  it.effect.prop(
    "positions agree with an independent prefix scan at every source offset",
    [Arbitrary.schema(S.String)],
    ([text]) =>
      Effect.sync(() => {
        const index = LineIndex.make(text);
        for (let offset = 0; offset <= text.length; offset += 1) {
          const prefix = Str.split("\n")(Str.slice(0, offset)(text));
          assert.deepStrictEqual(index.positionAt(offset), {
            line: prefix.length,
            column: (prefix[prefix.length - 1]?.length ?? 0) + 1,
          });
        }
        assert.deepStrictEqual(index.positionAt(-1), { line: 1, column: 1 });
        assert.deepStrictEqual(index.positionAt(text.length + 1), index.positionAt(text.length));
      }),
    runs
  );
});
