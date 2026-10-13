import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { MergeMethod, PullRequestInfo, UpsertedPullRequest } from "../../effected/github/PullRequest.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(`${name}: encoded values decode without failure and preserve the original`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assertTrue(S.toEquivalence(schema)(decoded, value));
  }), runs);
};

describe("PullRequest schema property floor", () => {
  roundTrips("MergeMethod", MergeMethod);
  roundTrips("PullRequestInfo", PullRequestInfo);
  roundTrips("UpsertedPullRequest", UpsertedPullRequest);
});
