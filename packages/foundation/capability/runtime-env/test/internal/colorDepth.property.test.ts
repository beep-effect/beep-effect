import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { colorDepth } from "@beep/runtime-env/internal/colorDepth";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const Input = S.Struct({ env: S.Record(S.String, S.String), tty: S.Boolean });
const json = S.fromJsonString(Input);

describe("color depth detection fidelity", () => {
  it.effect.prop(
    "snapshot serialization preserves the color verdict",
    [Arbitrary.schema(Input)],
    ([input]) =>
      Effect.gen(function* () {
        const argument = S.decodeEffect(json);
        const value = yield* S.encodeEffect(json)(input);
        const restored = yield* argument(value);
        assert.strictEqual(colorDepth(restored.env, restored.tty), colorDepth(input.env, input.tty));
        assert.strictEqual(colorDepth(input.env, input.tty), colorDepth(input.tty)(input.env));
        assert.strictEqual(colorDepth({ ...input.env, FORCE_COLOR: "3", NO_COLOR: "1" }, input.tty), "truecolor");
      }),
    runs
  );
});
