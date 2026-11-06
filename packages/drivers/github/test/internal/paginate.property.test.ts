import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { fromArray, paginate } from "@beep/github/internal/paginate";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({
  items: S.Array(S.Int),
  perPage: S.Int.check(S.isBetween({ minimum: 1, maximum: 20 })),
  maxPages: S.Int.check(S.isBetween({ minimum: 1, maximum: 10 })),
});

it.effect.prop(
  "pagination preserves order, repeats independent traversals and bounds pages rather than items",
  [Arbitrary.schema(Sample)],
  ([sample]) =>
    Effect.gen(function* () {
      const stream = paginate(() => fromArray(sample.items, sample.perPage), undefined);
      const resultCollect = yield* Stream.runCollect(stream);
      assert.deepStrictEqual(resultCollect, sample.items);
      const resultCollect1 = yield* Stream.runCollect(stream);
      assert.deepStrictEqual(resultCollect1, sample.items);
      const bounded = paginate(sample.maxPages)(() => fromArray(sample.perPage)(sample.items));
      const resultCollect2 = yield* Stream.runCollect(bounded);
      assert.deepStrictEqual(resultCollect2, sample.items.slice(0, sample.perPage * sample.maxPages));
    }),
  runs
);
