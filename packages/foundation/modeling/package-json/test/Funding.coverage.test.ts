import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Funding } from "@beep/package-json/Funding";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

it.effect("FromValue preserves spelling and rebuilds remembered objects when url or type changes", () =>
  Effect.gen(function* () {
    const original = yield* S.decodeEffect(Funding.FromValue)({ url: "old", type: "github", custom: 42 });
    const value = yield* S.encodeEffect(Funding.FromValue)(original);
    assert.deepStrictEqual(value, {
      url: "old",
      type: "github",
      custom: 42,
    });
    const urlChanged = Funding.make({ url: "new", type: "github", rest: { custom: 42 } });
    Funding.rememberWire(urlChanged, { url: "old", type: "github", custom: 42 });
    const value1 = yield* S.encodeEffect(Funding.FromValue)(urlChanged);
    assert.deepStrictEqual(value1, {
      url: "new",
      type: "github",
      custom: 42,
    });
    const typeChanged = Funding.make({ url: "old", type: "other" });
    Funding.rememberWire(typeChanged, { url: "old", type: "github" });
    const value2 = yield* S.encodeEffect(Funding.FromValue)(typeChanged);
    assert.deepStrictEqual(value2, { url: "old", type: "other" });
  })
);

it.effect.prop(
  "FromValue replays a generated object entry verbatim",
  [S.Struct({ url: S.String, type: S.optionalKey(S.String) })],
  ([wire]) =>
    Effect.gen(function* () {
      const funding = yield* S.decodeEffect(Funding.FromValue)(wire);
      assert.strictEqual(funding.url, wire.url);
      const value3 = yield* S.encodeEffect(Funding.FromValue)(funding);
      assert.deepStrictEqual(value3, wire);
    }),
  { arbitrary: fcRuns(50) }
);
