import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import * as Result from "effect/Result";
import { BlobEnvelope, NotABlobEnvelopeError, TruncatedBlobEnvelopeError,
  UnsupportedBlobEnvelopeVersionError, BlobMetadataDecodeError, BlobMetadataEncodeError
} from "../../effected/github-actions/BlobEnvelope.ts";

const Meta = S.Struct({ label: S.String, count: S.Int });
const Body = S.Uint8Array.check(S.isMaxLength(128));
const unwrap = <A, E>(result: Result.Result<A, E>): A => Result.getOrThrowWith(result, (error) => error);

describe("BlobEnvelope property floor", () => {
  roundTrips("NotABlobEnvelopeError round-trips", NotABlobEnvelopeError);
  roundTrips("TruncatedBlobEnvelopeError round-trips", TruncatedBlobEnvelopeError);
  roundTrips("UnsupportedBlobEnvelopeVersionError round-trips", UnsupportedBlobEnvelopeVersionError);
  roundTrips("BlobMetadataDecodeError round-trips", BlobMetadataDecodeError);
  roundTrips("BlobMetadataEncodeError round-trips", BlobMetadataEncodeError);
  it.effect.prop("envelope codec preserves metadata and every body byte", [Arbitrary.schema(Meta), Arbitrary.schema(Body)],
    ([metadata, body]) => Effect.sync(() => {
      const frame = unwrap(BlobEnvelope.encodeResult(metadata, body, Meta));
      const decoded = unwrap(BlobEnvelope.decodeResult(frame, Meta));
      assert.isTrue(S.toEquivalence(Meta)(decoded.metadata, metadata));
      assert.deepStrictEqual(decoded.body, body);
      const reframed = unwrap(BlobEnvelope.encodeResult(decoded.metadata, decoded.body, Meta));
      assert.deepStrictEqual(reframed, frame);
      assert.deepStrictEqual(unwrap(BlobEnvelope.decodeResult(reframed, Meta)), decoded);
      decoded.body.fill(42);
      assert.deepStrictEqual(unwrap(BlobEnvelope.decodeResult(frame, Meta)).body, body);
    }), runs);
});
