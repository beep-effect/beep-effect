import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { BlobEnvelope, NotABlobEnvelopeError, TruncatedBlobEnvelopeError, UnsupportedBlobEnvelopeVersionError,
  BlobMetadataDecodeError, BlobMetadataEncodeError } from "../../effected/github-actions/BlobEnvelope.ts";

it.effect("envelope failures explain the precise framing or metadata problem", () => Effect.sync(() => {
  assert.strictEqual(NotABlobEnvelopeError.make({}).message, "Bytes are not an @effected/github-actions blob envelope");
  assert.strictEqual(TruncatedBlobEnvelopeError.make({}).message, "Blob envelope is truncated");
  assert.strictEqual(UnsupportedBlobEnvelopeVersionError.make({ version: 7 }).message, "Blob envelope version 7 is not supported");
  assert.strictEqual(BlobMetadataDecodeError.make({}).message, "Blob envelope metadata did not satisfy the schema");
  assert.strictEqual(BlobMetadataEncodeError.make({}).message, "Blob metadata could not be encoded");
}));

it.effect("the JavaScript codec constructor produces an instance and the frame revision stays one", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(BlobEnvelope, []);
  assert.strictEqual(Object.getPrototypeOf(instance), BlobEnvelope.prototype);
  assert.strictEqual(BlobEnvelope.version, 1);
}));
