import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { BlobStoreError, S3Config } from "@beep/github-actions/BlobStore";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decoding an encoded value succeeds and preserves its value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assert.isTrue(equivalent(decoded, value));
        assert.deepStrictEqual(yield* encode(decoded), encoded);
      }),
    runs
  );
};
describe("BlobStore property floor", () => {
  roundTrips("BlobStoreError", BlobStoreError);
  roundTrips("S3Config", S3Config);
  it.effect.prop(
    "S3Config: round trips preserve absent optional fields and reject explicitly undefined ones",
    [Arbitrary.schema(S3Config)],
    ([value]) =>
      Effect.gen(function* () {
        const required = {
          bucket: value.bucket,
          region: value.region,
          accessKeyId: value.accessKeyId,
          secretAccessKey: value.secretAccessKey,
        };
        const encoded = yield* S.encodeEffect(S3Config)(S3Config.make(required));
        const decoded = yield* S.decodeEffect(S3Config)(encoded);
        assert.deepStrictEqual(encoded, required);
        assert.deepStrictEqual(decoded, required);
        // Exact optional keys (EF-40): an optional key is omitted, never undefined.
        for (const key of ["endpoint", "sessionToken", "prefix"]) {
          assert.isFalse(S.is(S3Config)({ ...required, [key]: undefined }));
        }
      }),
    runs
  );
});
