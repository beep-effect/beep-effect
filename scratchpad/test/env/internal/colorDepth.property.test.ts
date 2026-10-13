import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { colorDepth } from "../../../effected/env/internal/colorDepth.ts";

const runs = { arbitrary: fcRuns(100) };
const Input = S.Struct({ env: S.Record(S.String, S.String), tty: S.Boolean });
const json = S.fromJsonString(Input);

describe("color depth detection fidelity", () => {
  it.effect.prop("snapshot serialization preserves the color verdict", [Arbitrary.schema(Input)], ([input]) =>
    Effect.gen(function* () {
      const restored = yield* S.decodeEffect(json)(yield* S.encodeEffect(json)(input));
      assert.strictEqual(colorDepth(restored.env, restored.tty), colorDepth(input.env, input.tty));
      assert.strictEqual(colorDepth(input.env, input.tty), colorDepth(input.tty)(input.env));
      assert.strictEqual(colorDepth({ ...input.env, FORCE_COLOR: "3", NO_COLOR: "1" }, input.tty), "truecolor");
    }), runs);
});
