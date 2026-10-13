import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
import { sliceWithSegments, sourceOffsetAt } from "../../../effected/markdown/internal/segments.ts";
const natural = Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 1000 })));
describe("segment provenance properties", () => {
  it.effect.prop("slicing retains exact source offsets and a full repeated slice is idempotent", [natural, natural], ([source, length]) => Effect.sync(() => {
    const segments = [{ textOffset: 0, sourceOffset: source, length: length + 2 }];
    const sliced = sliceWithSegments(segments, 1, length + 1);
    assert.deepStrictEqual(sliceWithSegments(sliced, 0, length), sliced);
    for (let index = 0; index < length; index += 1) {
      assert.strictEqual(sourceOffsetAt(sliced, index, -1), sourceOffsetAt(segments, index + 1, -1));
    }
    assert.deepStrictEqual(sliceWithSegments(1, length + 1)(segments), sliced);
  }), runs);
});
