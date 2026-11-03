import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GitHubGraphQLError, GraphQLDocument, GraphQLErrorEntry } from "@beep/github/GraphQL";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) preserves x and never fails`,
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

describe("GraphQL schema property floor", () => {
  roundTrips("GraphQLErrorEntry", GraphQLErrorEntry);
  roundTrips("GitHubGraphQLError", GitHubGraphQLError);
});

const Throwable = S.Struct({
  status: S.optionalKey(S.Literals([200, 401, 403, 404, 422, 429, 500])),
  message: S.String,
  errors: S.Array(GraphQLErrorEntry),
  headers: S.optionalKey(S.Struct({ "retry-after": S.Int.check(S.isBetween({ minimum: 0, maximum: 600 })) })),
});
const ThrowableJson = S.fromJsonString(Throwable);

it.effect.prop(
  "throwable parsing preserves classification and ordered errors through JSON and normalization",
  [Arbitrary.schema(Throwable)],
  ([input]) =>
    Effect.gen(function* () {
      const parsed = GitHubGraphQLError.fromThrowable("query", input, 0);
      const canonical = { ...input, message: parsed.reason, errors: parsed.errors };
      const normalized = GitHubGraphQLError.fromThrowable("query", canonical, 0);
      const text = yield* S.encodeEffect(ThrowableJson)(canonical);
      const value2 = yield* S.decodeEffect(ThrowableJson)(text);
      const reparsed = GitHubGraphQLError.fromThrowable("query", value2, 0);
      for (const error of [normalized, reparsed]) {
        assert.strictEqual(error.kind, parsed.kind);
        assert.strictEqual(error.reason, parsed.reason);
        assert.strictEqual(error.message, parsed.message);
        assert.strictEqual(error.retryable, parsed.retryable);
        assert.strictEqual(error.retryAfterMillis, parsed.retryAfterMillis);
        assert.deepStrictEqual(error.errors, parsed.errors);
      }
      assert.deepStrictEqual(parsed.errors, input.errors);
    }),
  runs
);

const Response = S.Struct({ count: S.FiniteFromString, label: S.String });
const Document = GraphQLDocument.make({ name: "count", document: "query Count", response: Response })<{
  owner: string;
}>();
it.effect.prop(
  "document decoding preserves a nonidentity codec's response through encode and JSON",
  [Arbitrary.schema(Response)],
  ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(Response)(value);
      const parsed = yield* Document.decode(encoded);
      assert.isTrue(S.toEquivalence(Response)(parsed, value));
      const json = Response.pipe(S.toEncoded, S.fromJsonString);
      const argument = S.decodeEffect(json);
      const argument1 = S.encodeEffect(json);
      const value3 = yield* S.encodeEffect(Response)(parsed);
      const argument11 = yield* argument1(value3);
      const wire = yield* argument(argument11);
      const decoded3 = yield* Document.decode(wire);
      assert.deepStrictEqual(decoded3, parsed);
    }),
  runs
);

const Variables = S.Struct({ owner: S.String });
it.effect.prop(
  "document variable encoding is identity by default and custom normalization is idempotent",
  [Arbitrary.schema(Variables)],
  ([variables]) =>
    Effect.gen(function* () {
      assert.strictEqual(Document.encodeVariables(variables), variables);
      const custom = GraphQLDocument.make({ name: "owner", document: "query Owner", response: S.String })<{
        owner: string;
      }>((input) => ({ owner: Str.trim(input.owner) }));
      const encoded = custom.encodeVariables(variables);
      assert.deepStrictEqual(encoded, { owner: Str.trim(variables.owner) });
      const value4 = yield* S.decodeUnknownEffect(Variables)(encoded);
      assert.deepStrictEqual(custom.encodeVariables(value4), encoded);
    }),
  runs
);
