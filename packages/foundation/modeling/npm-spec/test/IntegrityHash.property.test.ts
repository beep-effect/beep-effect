import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  CorepackIntegrityHash,
  IntegrityAlgorithm,
  IntegrityHash,
  InvalidIntegrityHashError,
  InvalidSriIntegrityHashError,
  SriIntegrityHash,
} from "@beep/npm-spec/IntegrityHash";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>, generation: S.Schema<T> = schema): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves it`,
    [Arbitrary.schema(generation)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

const GeneratableIntegrity = IntegrityHash.check(
  S.isPattern(
    /^(?:(?:sha1|sha256|sha384|sha512)-[A-Za-z0-9+/]+={0,2}|(?:sha1|sha224|sha256|sha384|sha512)\.[0-9a-f]+|[0-9]+(?:c[0-9]+)?\/[0-9a-f]+)$/
  )
);
// FromSri is deliberately partial on the wider CorepackIntegrityHash brand:
// only a complete SHA-512 digest has an SRI inverse.
const BridgeDomain = CorepackIntegrityHash.check(S.isPattern(/^sha512\.[0-9a-f]{128}$/));

describe("IntegrityHash property floor", () => {
  roundTrips("IntegrityAlgorithm", IntegrityAlgorithm);
  roundTrips("InvalidIntegrityHashError", InvalidIntegrityHashError);
  roundTrips("IntegrityHash", IntegrityHash, GeneratableIntegrity);
  roundTrips("SriIntegrityHash", SriIntegrityHash);
  roundTrips("InvalidSriIntegrityHashError", InvalidSriIntegrityHashError);
  roundTrips("CorepackIntegrityHash", CorepackIntegrityHash);
  roundTrips("CorepackIntegrityHash.FromSri", CorepackIntegrityHash.FromSri, BridgeDomain);
});

it.effect.prop(
  "decode preserves every accepted integrity spelling",
  [Arbitrary.schema(GeneratableIntegrity)],
  ([text]) =>
    Effect.gen(function* () {
      const decoded2 = yield* IntegrityHash.decode(text);
      assert.strictEqual(decoded2, text);
      const argument = S.encodeEffect(IntegrityHash);
      const decoded1 = yield* IntegrityHash.decode(text);
      const value3 = yield* argument(decoded1);
      assert.strictEqual(value3, text);
    }),
  runs
);

it.effect.prop(
  "SHA-512 conversion preserves digest bytes and canonical SRI formatting is idempotent",
  [Arbitrary.schema(BridgeDomain)],
  ([hash]) =>
    Effect.gen(function* () {
      const sri = yield* S.encodeEffect(CorepackIntegrityHash.FromSri)(hash);
      const fromSri4 = yield* CorepackIntegrityHash.fromSri(sri);
      assert.strictEqual(fromSri4, hash);
      const decoded = yield* S.decodeEffect(CorepackIntegrityHash.FromSri)(sri);
      const canonical = yield* S.encodeEffect(CorepackIntegrityHash.FromSri)(decoded);
      assert.strictEqual(canonical, sri);
      const value5 = yield* S.decodeEffect(CorepackIntegrityHash.FromSri)(canonical);
      assert.strictEqual(value5, hash);
      const argument1 = S.encodeEffect(CorepackIntegrityHash.FromSri);
      const value2 = yield* S.decodeEffect(CorepackIntegrityHash.FromSri)(canonical);
      const value6 = yield* argument1(value2);
      assert.strictEqual(value6, canonical);
      const fromSri7 = yield* CorepackIntegrityHash.fromSri(`"${sri}"`);
      assert.strictEqual(fromSri7, hash);
    }),
  runs
);
