import { assert, describe, it } from "@effect/vitest";
import { Result, Schema } from "effect";
import type { BlobEnvelopeError } from "../../effected/github-actions/index.ts";
import { BlobEnvelope, UnsupportedBlobEnvelopeVersionError } from "../../effected/github-actions/index.ts";

const Meta = Schema.Struct({ tag: Schema.String, durationMs: Schema.Finite });
type Meta = typeof Meta.Type;

const bytes = (...values: ReadonlyArray<number>) => Uint8Array.from(values);

const encoded = (metadata: Meta, body: Uint8Array) => {
	const result = BlobEnvelope.encodeResult(metadata, body, Meta);
	if (!Result.isSuccess(result)) {
		assert.fail(`expected encode to succeed: ${result.failure._tag}`);
	}
	return result.success;
};

const failure = (input: Uint8Array): BlobEnvelopeError => {
	const result = BlobEnvelope.decodeResult(input, Meta);
	if (!Result.isFailure(result)) {
		assert.fail("expected decode to fail");
	}
	return result.failure;
};

describe("BlobEnvelope", () => {
	describe("round trip", () => {
		it("recovers metadata and body exactly", () => {
			const body = bytes(1, 2, 3, 250, 0, 255);
			const result = BlobEnvelope.decodeResult(encoded({ tag: "turbo", durationMs: 12 }, body), Meta);
			if (!Result.isSuccess(result)) {
				assert.fail("expected decode to succeed");
			}
			assert.deepStrictEqual(result.success.metadata, { tag: "turbo", durationMs: 12 });
			assert.deepStrictEqual([...result.success.body], [...body]);
		});

		it("handles an empty body", () => {
			const result = BlobEnvelope.decodeResult(encoded({ tag: "t", durationMs: 0 }, bytes()), Meta);
			assert.isTrue(Result.isSuccess(result));
		});

		it("handles metadata containing multi-byte characters", () => {
			const result = BlobEnvelope.decodeResult(encoded({ tag: "héllo — 🎉", durationMs: 1 }, bytes(9)), Meta);
			if (!Result.isSuccess(result)) {
				assert.fail("expected decode to succeed");
			}
			// The length prefix counts BYTES, not characters; a code-unit count
			// would slice the body at the wrong offset here.
			assert.strictEqual(result.success.metadata.tag, "héllo — 🎉");
			assert.deepStrictEqual([...result.success.body], [9]);
		});

		it("does not alias the frame's buffer, so mutating the body is safe", () => {
			const frame = encoded({ tag: "t", durationMs: 1 }, bytes(1, 2, 3));
			const result = BlobEnvelope.decodeResult(frame, Meta);
			if (!Result.isSuccess(result)) {
				assert.fail("expected decode to succeed");
			}
			const copy = Uint8Array.from(frame);
			result.success.body[0] = 99;
			assert.deepStrictEqual([...frame], [...copy], "the frame must be unchanged");
		});
	});

	describe("legacy and version handling", () => {
		it("reports raw unframed bytes as notAnEnvelope, not as corrupt metadata", () => {
			// This is what lets a store holding pre-envelope entries produce a
			// clean miss instead of a garbage read.
			assert.strictEqual(failure(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))._tag, "NotABlobEnvelopeError");
		});

		it("reports an empty blob as notAnEnvelope", () => {
			assert.strictEqual(failure(bytes())._tag, "NotABlobEnvelopeError");
		});

		it("reports a future version as unsupportedVersion, carrying the version", () => {
			const frame = encoded({ tag: "t", durationMs: 1 }, bytes(1));
			frame[4] = 99;
			const error = failure(frame);
			assert.instanceOf(error, UnsupportedBlobEnvelopeVersionError);
			assert.strictEqual(error.version, 99);
		});

		it("keys stay stable across revisions — the version is in the blob, not the key", () => {
			// The property the design buys: a revision is detected on READ, so a
			// consumer never has to namespace keys by format version.
			const frame = encoded({ tag: "t", durationMs: 1 }, bytes(1));
			frame[4] = 2;
			assert.strictEqual(failure(frame)._tag, "UnsupportedBlobEnvelopeVersionError");
		});
	});

	describe("truncation", () => {
		it("reports a frame cut off inside the header", () => {
			assert.strictEqual(
				failure(encoded({ tag: "t", durationMs: 1 }, bytes(1)).slice(0, 6))._tag,
				"TruncatedBlobEnvelopeError",
			);
		});

		it("reports a frame cut off inside the metadata", () => {
			const frame = encoded({ tag: "a-fairly-long-tag", durationMs: 1 }, bytes(1, 2, 3));
			assert.strictEqual(failure(frame.slice(0, frame.length - 12))._tag, "TruncatedBlobEnvelopeError");
		});
	});

	describe("schema mismatch", () => {
		it("reports metadata that does not satisfy the caller's schema", () => {
			const Other = Schema.Struct({ completelyDifferent: Schema.Boolean });
			const frame = encoded({ tag: "t", durationMs: 1 }, bytes(1));
			const result = BlobEnvelope.decodeResult(frame, Other);
			if (!Result.isFailure(result)) {
				assert.fail("expected decode to fail");
			}
			assert.strictEqual(result.failure._tag, "BlobMetadataDecodeError");
		});

		it("reports a value that cannot be encoded", () => {
			const result = BlobEnvelope.encodeResult({ tag: 1 } as never, bytes(), Meta);
			if (!Result.isFailure(result)) {
				assert.fail("expected encode to fail");
			}
			assert.strictEqual(result.failure._tag, "BlobMetadataEncodeError");
		});
	});

	describe("properties", () => {
		it.prop(
			"any metadata and body round-trips",
			[
				Schema.String,
				Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 2 ** 31 })),
				Schema.Uint8Array.check(Schema.isMaxLength(64)),
			],
			([tag, durationMs, body]) => {
				const result = BlobEnvelope.decodeResult(encoded({ tag, durationMs }, body), Meta);
				if (!Result.isSuccess(result)) {
					assert.fail("round trip must succeed");
				}
				assert.strictEqual(result.success.metadata.tag, tag);
				assert.strictEqual(result.success.metadata.durationMs, durationMs);
				assert.deepStrictEqual([...result.success.body], [...body]);
				return true;
			},
		);

		it.prop(
			"arbitrary bytes never throw — they fail typed",
			[Schema.Uint8Array.check(Schema.isMaxLength(128))],
			([input]) => {
				// A corrupt cache entry must be a typed miss, never a defect.
				const result = BlobEnvelope.decodeResult(input, Meta);
				assert.isTrue(Result.isSuccess(result) || Result.isFailure(result));
				return true;
			},
		);
	});
});
