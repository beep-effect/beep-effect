import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Viewport, ViewportState, ViewportRow, ViewportMove } from "../../../effected/cli/ui/Viewport.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  count: S.Int.check(S.isBetween({ minimum: 0, maximum: 100 })),
  height: S.Int.check(S.isBetween({ minimum: 1, maximum: 30 })),
  cursor: S.Int.check(S.isBetween({ minimum: -100, maximum: 200 })),
  nextHeight: S.Int.check(S.isBetween({ minimum: 1, maximum: 30 })),
});
it.effect.prop("resize is idempotent and retains selection; home and end are stable at list boundaries", [Arbitrary.schema(Sample)], ([sample]) =>
  Effect.sync(() => {
    const initial = Viewport.init(sample.count, sample.height, sample.cursor);
    const resized = Viewport.resize(initial, sample.nextHeight);
    assert.deepStrictEqual(Viewport.resize(resized, sample.nextHeight), resized);
    assert.strictEqual(resized.cursor, initial.cursor);
    assert.strictEqual(resized.count, sample.count);
    const home = Viewport.step(resized, "home");
    const end = Viewport.step(resized, "end");
    assert.strictEqual(home.cursor, 0);
    assert.strictEqual(end.cursor, Math.max(0, sample.count - 1));
    assert.deepStrictEqual(Viewport.step(home, "up"), home);
    assert.deepStrictEqual(Viewport.step(end, "down"), end);
    assert.isAtMost(resized.offset, resized.cursor);
    assert.isBelow(resized.cursor, resized.offset + resized.height);
  }), runs);

for (const model of [ViewportState, ViewportRow, ViewportMove]) {
  it.effect.prop(`${model.ast.annotations?.identifier} round-trips the production viewport schema`, [Arbitrary.schema(model)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(model)(value);
      assert.deepStrictEqual(yield* S.decodeEffect(model)(encoded), value);
    }), runs);
}
