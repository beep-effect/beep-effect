import { Result, Schema } from "effect";

/**
 * Raised when bytes cannot be read as an envelope.
 *
 * @public
 */
export class NotABlobEnvelopeError extends Schema.TaggedError<NotABlobEnvelopeError>()("NotABlobEnvelopeError", {
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	override get message(): string {
		return "Bytes are not an @effected/github-actions blob envelope";
	}
}

/**
 * Raised when the frame ends mid-header or mid-metadata.
 *
 * @public
 */
export class TruncatedBlobEnvelopeError extends Schema.TaggedError<TruncatedBlobEnvelopeError>()(
	"TruncatedBlobEnvelopeError",
	{
		/** The underlying failure, preserved structurally. */
		cause: Schema.optionalKey(Schema.Defect()),
	},
) {
	override get message(): string {
		return "Blob envelope is truncated";
	}
}

/**
 * Raised when the envelope came from a newer revision of the format.
 *
 * @public
 */
export class UnsupportedBlobEnvelopeVersionError extends Schema.TaggedError<UnsupportedBlobEnvelopeVersionError>()(
	"UnsupportedBlobEnvelopeVersionError",
	{
		/** The envelope version found. */
		version: Schema.Number,
		/** The underlying failure, preserved structurally. */
		cause: Schema.optionalKey(Schema.Defect()),
	},
) {
	override get message(): string {
		return `Blob envelope version ${this.version} is not supported`;
	}
}

/**
 * Raised when well-framed metadata does not satisfy the caller's schema.
 *
 * @public
 */
export class BlobMetadataDecodeError extends Schema.TaggedError<BlobMetadataDecodeError>()("BlobMetadataDecodeError", {
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	override get message(): string {
		return "Blob envelope metadata did not satisfy the schema";
	}
}

/**
 * Raised when the value being stored does not satisfy its schema.
 *
 * @public
 */
export class BlobMetadataEncodeError extends Schema.TaggedError<BlobMetadataEncodeError>()("BlobMetadataEncodeError", {
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	override get message(): string {
		return "Blob metadata could not be encoded";
	}
}

/**
 * Anything that can go wrong reading or writing a blob envelope.
 *
 * @remarks
 * **One class per failure, rather than one class with a `reason` field.** Each
 * member carries exactly the fields its own message needs — the version is
 * required on the one member that reports it — so a value short a field is a
 * compile error rather than a message reading `"undefined"`.
 *
 * @public
 */
export type BlobEnvelopeError =
	| NotABlobEnvelopeError
	| TruncatedBlobEnvelopeError
	| UnsupportedBlobEnvelopeVersionError
	| BlobMetadataDecodeError
	| BlobMetadataEncodeError;

/** Identifies the frame family. Four bytes: `E F B S`. */
const MAGIC = Uint8Array.from([0x45, 0x46, 0x42, 0x53]);

/** The only version this build writes. */
const VERSION = 1;

/** magic + version + metadata length. */
const HEADER_BYTES = MAGIC.length + 1 + 4;

/**
 * The schema-versioned frame that gives a stored blob a **metadata channel**.
 *
 * @remarks
 * Layout:
 *
 * ```text
 * [4B magic "EFBS"][1B version][4B metadata length, big-endian][metadata JSON][body]
 * ```
 *
 * Three properties earn the format:
 *
 * - **The magic prefix makes an unframed blob legible.** Raw, unframed bytes
 *   decode as {@link NotABlobEnvelopeError} rather than as garbage metadata, so
 *   a store holding entries written without an envelope produces a clean miss
 *   instead of a corrupt read.
 * - **The version lives in the blob, not in the key.** A format revision is
 *   detected on read and reported typed
 *   ({@link UnsupportedBlobEnvelopeVersionError}), so **keys stay stable** and
 *   old entries age out naturally rather than needing a `v2/...` key prefix.
 * - **The metadata is the caller's own schema.** This module owns *framing*;
 *   the caller owns *meaning*. Fields like a cache tag or a duration are
 *   schema fields, not bytes at fixed offsets in a private codec.
 *
 * **Pure**: `Result`-returning, no IO, no service — the framing is testable
 * from a byte array, which is the point.
 *
 * @example
 * ```ts
 * import { BlobEnvelope } from "./index.ts";
 * import { Result, Schema } from "effect";
 *
 * const Meta = Schema.Struct({ tag: Schema.String });
 *
 * const framed = BlobEnvelope.encodeResult({ tag: "v1" }, new Uint8Array([1, 2, 3]), Meta);
 * if (Result.isSuccess(framed)) {
 *   const read = BlobEnvelope.decodeResult(framed.success, Meta);
 *   // => Result.succeed({ metadata: { tag: "v1" }, body: Uint8Array [1, 2, 3] })
 * }
 * ```
 *
 * @public
 */
export class BlobEnvelope {
	private constructor() {}

	/** The envelope version this build writes and accepts. */
	static readonly version: number = VERSION;

	/**
	 * Frame metadata and a body into a single blob.
	 *
	 * @returns a `Result` holding the framed bytes, or a
	 * {@link BlobMetadataEncodeError} when `metadata` does not satisfy `schema`
	 */
	static encodeResult<A, I>(
		metadata: A,
		body: Uint8Array,
		schema: Schema.Codec<A, I>,
	): Result.Result<Uint8Array, BlobEnvelopeError> {
		const encoded = Schema.encodeUnknownResult(Schema.fromJsonString(schema))(metadata);
		if (Result.isFailure(encoded)) {
			return Result.fail(new BlobMetadataEncodeError({ cause: encoded.failure }));
		}
		const metaBytes = new TextEncoder().encode(encoded.success);
		const out = new Uint8Array(HEADER_BYTES + metaBytes.length + body.length);
		out.set(MAGIC, 0);
		out[MAGIC.length] = VERSION;
		new DataView(out.buffer).setUint32(MAGIC.length + 1, metaBytes.length, false);
		out.set(metaBytes, HEADER_BYTES);
		out.set(body, HEADER_BYTES + metaBytes.length);
		return Result.succeed(out);
	}

	/**
	 * Read a framed blob back into its metadata and body.
	 *
	 * @returns a `Result` holding the decoded metadata and a copy of the body, or
	 * a {@link BlobEnvelopeError}: {@link NotABlobEnvelopeError} for unframed
	 * bytes, {@link TruncatedBlobEnvelopeError},
	 * {@link UnsupportedBlobEnvelopeVersionError}, or
	 * {@link BlobMetadataDecodeError} when the metadata fails `schema`
	 */
	static decodeResult<A, I>(
		bytes: Uint8Array,
		schema: Schema.Codec<A, I>,
	): Result.Result<{ readonly metadata: A; readonly body: Uint8Array }, BlobEnvelopeError> {
		if (bytes.length < MAGIC.length || !MAGIC.every((byte, index) => bytes[index] === byte)) {
			return Result.fail(new NotABlobEnvelopeError({}));
		}
		if (bytes.length < HEADER_BYTES) {
			return Result.fail(new TruncatedBlobEnvelopeError({}));
		}
		const version = bytes[MAGIC.length] ?? 0;
		if (version !== VERSION) {
			return Result.fail(new UnsupportedBlobEnvelopeVersionError({ version }));
		}
		const metaLength = new DataView(bytes.buffer, bytes.byteOffset).getUint32(MAGIC.length + 1, false);
		if (bytes.length < HEADER_BYTES + metaLength) {
			return Result.fail(new TruncatedBlobEnvelopeError({}));
		}
		const metaText = new TextDecoder().decode(bytes.subarray(HEADER_BYTES, HEADER_BYTES + metaLength));
		const decoded = Schema.decodeUnknownResult(Schema.fromJsonString(schema))(metaText);
		if (Result.isFailure(decoded)) {
			return Result.fail(new BlobMetadataDecodeError({ cause: decoded.failure }));
		}
		return Result.succeed({
			metadata: decoded.success,
			// `slice`, not `subarray`: the body must not alias the frame's buffer,
			// or a caller mutating it would corrupt the envelope it came from.
			body: bytes.slice(HEADER_BYTES + metaLength),
		});
	}
}
