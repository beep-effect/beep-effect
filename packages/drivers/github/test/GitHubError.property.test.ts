import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  GitHubError,
  GitHubErrorKind,
  GitHubValidationCode,
  GitHubValidationEntry,
  readRateLimitHeaders,
} from "@beep/github/GitHubError";
import { headerString } from "@beep/github/internal/headers";
import { assert, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: encoded values decode without failure and preserve the value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};
describe("GitHubError property floor", () => {
  roundTrips("GitHubErrorKind", GitHubErrorKind);
  roundTrips("GitHubValidationCode", GitHubValidationCode);
  roundTrips("GitHubValidationEntry", GitHubValidationEntry);
  roundTrips("GitHubError", GitHubError);
});

const ThrowableInput = S.Struct({
  status: S.Literals([401, 403, 404, 409, 422, 429, 500]),
  message: S.String,
  response: S.Struct({ data: S.Struct({ errors: S.Array(GitHubValidationEntry) }) }),
});
it.effect.prop(
  "classification survives JSON serialization and reason normalization is idempotent",
  [Arbitrary.schema(ThrowableInput)],
  ([input]) =>
    Effect.gen(function* () {
      const parsed = GitHubError.fromOctokit("operation", input, 0);
      const json = S.fromJsonString(ThrowableInput);
      const argument = S.decodeEffect(json);
      const value3 = yield* S.encodeEffect(json)({
        ...input,
        message: parsed.reason,
        response: { data: { errors: parsed.validation ?? [] } },
      });
      const value2 = yield* argument(value3);
      const reparsed = GitHubError.fromOctokit("operation", value2, 0);
      assert.strictEqual(reparsed.kind, parsed.kind);
      assert.strictEqual(reparsed.reason, parsed.reason);
      assert.deepStrictEqual(reparsed.validation, parsed.validation);
      const normalized = GitHubError.fromOctokit("operation", { ...input, message: parsed.reason }, 0);
      assert.strictEqual(normalized.reason, parsed.reason);
      assert.strictEqual(normalized.message, parsed.message);
    }),
  runs
);

const RateHeaders = S.Struct({ remaining: S.Int, limit: S.Int, resetEpochSeconds: S.Int });
it.effect.prop(
  "rate headers retain all numbers through canonical rendering and JSON serialization",
  [Arbitrary.schema(RateHeaders)],
  ([value]) =>
    Effect.gen(function* () {
      const headers = {
        "x-ratelimit-remaining": String(value.remaining),
        "x-ratelimit-limit": String(value.limit),
        "x-ratelimit-reset": String(value.resetEpochSeconds),
      };
      const parsed = O.getOrThrow(readRateLimitHeaders(headers));
      const canonical = {
        "x-ratelimit-remaining": String(parsed.remaining),
        "x-ratelimit-limit": String(parsed.limit),
        "x-ratelimit-reset": String(parsed.resetEpochSeconds),
      };
      const codec = S.fromJsonString(S.Record(S.String, S.String));
      const argument1 = S.decodeEffect(codec);
      const value4 = yield* S.encodeEffect(codec)(canonical);
      const decodedHeaders = yield* argument1(value4);
      assertSome(readRateLimitHeaders(decodedHeaders), parsed);
      assert.isTrue(parsed.remaining === value.remaining);
      assert.isTrue(parsed.limit === value.limit);
      assert.isTrue(parsed.resetEpochSeconds === value.resetEpochSeconds);
      assertSome(readRateLimitHeaders(canonical), parsed);
      for (const key of ["x-ratelimit-remaining", "x-ratelimit-limit", "x-ratelimit-reset"]) {
        const canonical = headerString(headers, key);
        assert.strictEqual(headerString({ [key]: canonical }, key), canonical);
        assert.strictEqual(headerString(decodedHeaders, key), canonical);
      }
    }),
  runs
);
