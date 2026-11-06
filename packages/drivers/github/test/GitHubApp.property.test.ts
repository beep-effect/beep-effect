import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { AppIdentity, BotIdentity, GitHubAppError, Installation, InstallationToken } from "@beep/github/GitHubApp";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decode(encode(x)) preserves the value and never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("GitHubApp schema property floor", () => {
  roundTrips("GitHubAppError", GitHubAppError);
  roundTrips("InstallationToken", InstallationToken);
  roundTrips("BotIdentity", BotIdentity);
  roundTrips("AppIdentity", AppIdentity);
  roundTrips("Installation", Installation);
});
