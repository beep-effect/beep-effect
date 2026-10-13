import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { fromArray, paginate } from "../../../effected/github/internal/paginate.ts";

const runs = { arbitrary: fcRuns(100) };
const Sample = S.Struct({ items: S.Array(S.Int), perPage: S.Int.check(S.isBetween({ minimum: 1, maximum: 20 })), maxPages: S.Int.check(S.isBetween({ minimum: 1, maximum: 10 })) });

it.effect.prop("pagination preserves order, repeats independent traversals and bounds pages rather than items", [Arbitrary.schema(Sample)], ([sample]) => Effect.gen(function* () {
  const stream = paginate(() => fromArray(sample.items, sample.perPage), undefined);
  assert.deepStrictEqual(yield* Stream.runCollect(stream), sample.items);
  assert.deepStrictEqual(yield* Stream.runCollect(stream), sample.items);
  const bounded = paginate(sample.maxPages)(() => fromArray(sample.perPage)(sample.items));
  assert.deepStrictEqual(yield* Stream.runCollect(bounded), sample.items.slice(0, sample.perPage * sample.maxPages));
}), runs);
