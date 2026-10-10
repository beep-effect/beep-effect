import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InvalidSha256DigestError, Sha256Digest, InTotoSubject, InTotoStatementInput, InTotoSubjectInput, InTotoStatement } from "../../effected/sbom/InTotoStatement.ts";

const runs = { arbitrary: fcRuns(100) };

const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* encode(value);
      const decoded = yield* decode(encoded);
      assertTrue(equivalent(decoded, value));
      assert.deepStrictEqual(yield* encode(decoded), encoded);
    }),
    runs,
  );
};

describe("InTotoStatement property floor", () => {
  roundTrips("InvalidSha256DigestError", InvalidSha256DigestError);
  roundTrips("Sha256Digest", Sha256Digest);
  roundTrips("InTotoSubject", InTotoSubject);
  roundTrips("InTotoStatementInput", InTotoStatementInput);
  roundTrips("InTotoSubjectInput", InTotoSubjectInput);
  roundTrips("InTotoStatement", InTotoStatement);
});

// Digest normalization is a parser with a canonical string representation.
it.effect.prop("digest parsing is idempotent and faithful for uppercase prefixed input", [Arbitrary.schema(Sha256Digest)], ([digest]) => Effect.gen(function* () {
  const parsed = yield* Sha256Digest.parse(`SHA256:${digest.toUpperCase()}`);
  assert.strictEqual(parsed, digest);
  assert.strictEqual(yield* Sha256Digest.parse(parsed), parsed);
  assert.strictEqual(yield* Effect.fromResult(Sha256Digest.parseResult(parsed)), parsed);
}), runs);

it.effect.prop("statement JSON formatting is idempotent and parse/stringify preserves its fields", [InTotoSubject.pipe(S.Array, Arbitrary.schema), Arbitrary.schema(S.String), Arbitrary.schema(S.Json)], ([subject, predicateType, predicate]) => Effect.gen(function* () {
  const statement = InTotoStatement.of({ subject, predicateType, predicate });
  const bytes = statement.toJson();
  const parsed = yield* S.decodeEffect(S.fromJsonString(InTotoStatement))(bytes);
  assertTrue(S.toEquivalence(InTotoStatement)(parsed, statement));
  assert.strictEqual(parsed.toJson(), bytes);
  const reparsed = yield* S.decodeEffect(S.fromJsonString(InTotoStatement))(parsed.toJson());
  assertTrue(S.toEquivalence(InTotoStatement)(reparsed, parsed));
  assert.strictEqual(reparsed.toJson(), parsed.toJson());
}), runs);
