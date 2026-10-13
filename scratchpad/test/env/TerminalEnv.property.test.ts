import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { StreamEnv } from "../../effected/env/TerminalEnv.ts";

const runs = { arbitrary: fcRuns(100) };

describe("TerminalEnv schema property floor", () => {
  it.effect.prop(
    "StreamEnv: decode(encode(x)) equals x and never fails",
    [Arbitrary.schema(StreamEnv)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(StreamEnv)(value);
      const decoded = yield* S.decodeEffect(StreamEnv)(encoded);
      assert.isTrue(S.toEquivalence(StreamEnv)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(StreamEnv)(decoded), encoded);
    }),
    runs,
  );
});
