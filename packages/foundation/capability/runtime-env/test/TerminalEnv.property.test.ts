import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { StreamEnv } from "@beep/runtime-env/TerminalEnv";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };

describe("TerminalEnv schema property floor", () => {
  it.effect.prop(
    "StreamEnv: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(StreamEnv)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(StreamEnv)(value);
        const decoded = yield* S.decodeEffect(StreamEnv)(encoded);
        assert.isTrue(S.toEquivalence(StreamEnv)(decoded, value));
        const value1 = yield* S.encodeEffect(StreamEnv)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
});
