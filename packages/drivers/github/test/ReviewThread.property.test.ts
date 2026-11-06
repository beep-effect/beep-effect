import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  DiffSide,
  isOutstanding,
  ReviewThreadActor,
  ReviewThreadComment,
  ReviewThreadNode,
  ReviewThreadPage,
  ReviewThreadPageInfo,
  ReviewThreads,
} from "@beep/github/ReviewThread";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const OptionalLogin = S.Option(S.String);
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(
    `${name}: encoded values decode without failure and preserve the original`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("ReviewThread schema properties", () => {
  roundTrips("DiffSide", DiffSide);
  roundTrips("ReviewThreadActor", ReviewThreadActor);
  roundTrips("ReviewThreadComment", ReviewThreadComment);
  roundTrips("ReviewThreadNode", ReviewThreadNode);
  roundTrips("ReviewThreadPageInfo", ReviewThreadPageInfo);
  roundTrips("ReviewThreadPage", ReviewThreadPage);
  roundTrips("ReviewThreads", ReviewThreads);

  it.effect.prop(
    "every unresolved thread is outstanding whoever the author is",
    [Arbitrary.schema(ReviewThreadNode), Arbitrary.schema(OptionalLogin)],
    ([thread, author]) =>
      Effect.sync(() => {
        const unresolved = ReviewThreadNode.make({ ...thread, isResolved: false });
        assertTrue(isOutstanding(unresolved, author));
      }),
    runs
  );

  it.effect.prop(
    "a resolved thread with an unknown pull request author is never outstanding",
    [Arbitrary.schema(ReviewThreadNode)],
    ([thread]) =>
      Effect.sync(() => {
        const resolved = ReviewThreadNode.make({ ...thread, isResolved: true });
        assert.isFalse(isOutstanding(resolved, O.none()));
      }),
    runs
  );
});
