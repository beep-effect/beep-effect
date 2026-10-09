import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { GitHubError, GitHubErrorKind, GitHubValidationCode, GitHubValidationEntry, readRateLimitHeaders, readHeaderString } from "../../effected/github/GitHubError.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoded values decode without failure and preserve the value`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};
describe("GitHubError property floor", () => {
  roundTrips("GitHubErrorKind", GitHubErrorKind);
  roundTrips("GitHubValidationCode", GitHubValidationCode);
  roundTrips("GitHubValidationEntry", GitHubValidationEntry);
  roundTrips("GitHubError", GitHubError);
});

const ThrowableInput = S.Struct({ status: S.Literals([401, 403, 404, 409, 422, 429, 500]), message: S.String, response: S.Struct({ data: S.Struct({ errors: S.Array(GitHubValidationEntry) }) }) });
it.effect.prop("classification survives JSON serialization and reason normalization is idempotent", [Arbitrary.schema(ThrowableInput)], ([input]) => Effect.gen(function* () {
  const parsed = GitHubError.fromOctokit("operation", input, 0);
  const json = S.fromJsonString(ThrowableInput);
  const reparsed = GitHubError.fromOctokit("operation", yield* S.decodeEffect(json)(yield* S.encodeEffect(json)({ ...input, message: parsed.reason, response: { data: { errors: parsed.validation ?? [] } } })), 0);
  assert.strictEqual(reparsed.kind, parsed.kind);
  assert.strictEqual(reparsed.reason, parsed.reason);
  assert.deepStrictEqual(reparsed.validation, parsed.validation);
  const normalized = GitHubError.fromOctokit("operation", { ...input, message: parsed.reason }, 0);
  assert.strictEqual(normalized.reason, parsed.reason);
  assert.strictEqual(normalized.message, parsed.message);
}), runs);

const RateHeaders = S.Struct({ remaining: S.Int, limit: S.Int, resetEpochSeconds: S.Int });
it.effect.prop("rate headers retain all numbers through canonical rendering and JSON serialization", [Arbitrary.schema(RateHeaders)], ([value]) => Effect.gen(function* () {
  const headers = { "x-ratelimit-remaining": String(value.remaining), "x-ratelimit-limit": String(value.limit), "x-ratelimit-reset": String(value.resetEpochSeconds) };
  const parsed = readRateLimitHeaders(headers);
  assert.isDefined(parsed);
  const canonical = { "x-ratelimit-remaining": String(parsed.remaining), "x-ratelimit-limit": String(parsed.limit), "x-ratelimit-reset": String(parsed.resetEpochSeconds) };
  const codec = S.fromJsonString(S.Record(S.String, S.String));
  const decodedHeaders = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(canonical));
  assert.deepStrictEqual(readRateLimitHeaders(decodedHeaders), parsed);
  assert.isTrue(parsed.remaining === value.remaining);
  assert.isTrue(parsed.limit === value.limit);
  assert.isTrue(parsed.resetEpochSeconds === value.resetEpochSeconds);
  assert.deepStrictEqual(readRateLimitHeaders(canonical), parsed);
  for (const key of ["x-ratelimit-remaining", "x-ratelimit-limit", "x-ratelimit-reset"]) {
    const canonical = readHeaderString(headers, key);
    assert.strictEqual(readHeaderString({ [key]: canonical }, key), canonical);
    assert.strictEqual(readHeaderString(decodedHeaders, key), canonical);
  }
}), runs);
