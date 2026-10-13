import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CommitComparison, CommitFile, CommitSummary, FileStatus } from "../../effected/github/GitHubCommit.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) preserves x and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
    }),
    runs,
  );
};

describe("GitHubCommit schema property floor", () => {
  roundTrips("CommitSummary", CommitSummary);
  roundTrips("FileStatus", FileStatus);
  roundTrips("CommitFile", CommitFile);
  roundTrips("CommitComparison", CommitComparison);
});
