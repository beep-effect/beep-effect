import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Str from "effect/String";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Match from "effect/Match";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as DateTime from "effect/DateTime";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { ActionOutputs } from "./ActionOutputs.ts";
import type { BlobEnvelopeError } from "./BlobEnvelope.ts";
import { BlobEnvelope } from "./BlobEnvelope.ts";
import { sign, uriEncode } from "./internal/sigv4.ts";
import { unstubbed } from "./internal/unstubbed.ts";
import { Secret } from "./Secret.ts";

const $I = $ScratchpadId.create("effected/github-actions/BlobStore");

const DotSegment = LiteralKit([".", ".."]).pipe(
	$I.annoteSchema("DotSegment", { description: "Complete path segments that URL normalization would resolve." }),
);
const EndpointProtocol = LiteralKit(["http:", "https:"]).pipe(
	$I.annoteSchema("EndpointProtocol", { description: "Protocols supported by the S3 HTTP transport." }),
);

/**
 * Raised when a blob cannot be stored or retrieved.
 *
 * **Example** (Describe a refused blob write)
 *
 * ```ts
 * import { BlobStoreError } from "@beep/scratchpad/effected/github-actions/BlobStore";
 *
 * const error = BlobStoreError.make({ reason: "refused", key: "build/1", status: 403 });
 * console.log(error.message) // The blob store refused "build/1" with status 403
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class BlobStoreError extends S.TaggedError<BlobStoreError>($I`BlobStoreError`)("BlobStoreError", {
	/**
	 * `unreachable` — the store could not be contacted. `refused` — it answered,
	 * unhappily; `status` says how. `misconfigured` — the layer was built with
	 * settings the store cannot use.
	 */
	reason: S.Literals(["unreachable", "refused", "misconfigured"]).annotateKey({ description: "`unreachable` — the store could not be contacted. `refused` — it answered, unhappily; `status` says how. `misconfigured` — the layer was built with settings the store cannot use." }),
	/** The key involved. A stable identifier, never a value. */
	key: S.optionalKey(S.String).annotateKey({ description: "The key involved. A stable identifier, never a value." }),
	/** The HTTP status, when the store answered. */
	status: S.optionalKey(S.Finite).annotateKey({ description: "The HTTP status, when the store answered." }),
	/** What is wrong, when the reason alone does not say. */
	detail: S.optionalKey(S.String).annotateKey({ description: "What is wrong, when the reason alone does not say." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("BlobStoreError", { description: "Raised when a blob cannot be stored or retrieved." })) {
	/**
	 * Describes the storage failure with the available key, status and detail.
	 *
	 * **Example** (Read the failure message)
	 *
	 * ```ts
	 * import { BlobStoreError } from "@beep/scratchpad/effected/github-actions/BlobStore";
	 *
	 * const error = BlobStoreError.make({ reason: "unreachable", key: "build/1" });
	 * console.log(error.message) // The blob store could not be reached for "build/1"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return Match.value(this.reason).pipe(
			Match.when("unreachable", () => `The blob store could not be reached${this.key === undefined ? "" : ` for "${this.key}"`}`),
			Match.when("refused", () => `The blob store refused "${this.key}"${this.status === undefined ? "" : ` with status ${this.status}`}${
					this.detail === undefined ? "" : `: ${this.detail}`
				}`),
			Match.orElse(() => `The blob store is misconfigured${this.detail === undefined ? "" : `: ${this.detail}`}`),
		);
	}
}

/**
 * A stored value: the caller's metadata beside the bytes it describes.
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export interface StoredBlob<A> {
	/** The caller's own metadata, decoded through the caller's own schema. */
	readonly metadata: A;
	/** The payload, verbatim. */
	readonly body: Uint8Array;
}

/**
 * The members of the {@link BlobStore} service: `get`, `put` and `has` over
 * blobs that carry the caller's own metadata.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface BlobStoreShape {
	/**
  * Read a blob, or nothing if the key is absent.
  *
  * **Details**
  *
  * Fails with {@link BlobStoreError}, or a {@link BlobEnvelopeError} when the
  * stored bytes are not a valid envelope for `schema`.
  */
	readonly get: <A, I>(
		key: string,
		schema: S.Codec<A, I>,
	) => Effect.Effect<O.Option<StoredBlob<A>>, BlobStoreError | BlobEnvelopeError>;
	/** Write a blob. */
	readonly put: <A, I>(
		key: string,
		blob: StoredBlob<A>,
		schema: S.Codec<A, I>,
	) => Effect.Effect<void, BlobStoreError | BlobEnvelopeError>;
	/** Whether a key is present, without transferring the body. */
	readonly has: (key: string) => Effect.Effect<boolean, BlobStoreError>;
}

/**
 * How to reach an S3-compatible object store.
 *
 * **Example** (Validate an S3 configuration)
 *
 * ```ts
 * import { S3Config } from "@beep/scratchpad/effected/github-actions/BlobStore";
 * import * as Redacted from "effect/Redacted";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(S3Config)({
 *   bucket: "build-cache",
 *   region: "us-east-1",
 *   accessKeyId: "example-key",
 *   secretAccessKey: Redacted.make("example-secret"),
 *   prefix: undefined,
 * })) // true
 * ```
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export const S3Config = S.Struct({
	/** The bucket name. */
	bucket: S.String.annotateKey({ description: "The bucket name." }),
	/** The bucket's region, used for SigV4 signing and the default AWS endpoint. */
	region: S.String.annotateKey({ description: "The bucket's region, used for SigV4 signing and the default AWS endpoint." }),
	/**
  * A custom endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`.
  *
  * **Details**
  *
  * Omitting it targets AWS itself. Addressing is always **path-style**
  * (`<endpoint>/<bucket>/<key>`), which is what makes the same layer work
  * against R2, MinIO and Spaces — virtual-host addressing needs per-bucket
  * DNS that none of them provide the same way.
  */
	endpoint: S.optional(S.String).annotateKey({ description: "A custom path-style endpoint. Omitting it targets AWS itself." }),
	/** The access key id. */
	accessKeyId: S.String.annotateKey({ description: "The access key id." }),
	/** The secret access key, declassified once and masked in the runner log. */
	secretAccessKey: S.Redacted(S.String).annotateKey({ description: "The secret access key, declassified once and masked in the runner log." }),
	/** For temporary credentials. */
	sessionToken: S.String.pipe(S.Redacted, S.optional).annotateKey({ description: "For temporary credentials." }),
	/** Prepended to every key, so one bucket can hold several caches. */
	prefix: S.optional(S.String).annotateKey({ description: "Prepended to every key, so one bucket can hold several caches." }),
}).annotate($I.annote("S3Config", { description: "How to reach an S3-compatible object store." }));

/**
 * The configuration accepted by the S3-compatible backend.
 *
 * @public
 * @category configuration
 * @since 0.0.0
 */
export type S3Config = typeof S3Config.Type;

/**
 * Durable blob storage with a metadata channel.
 *
 * **Details**
 *
 * `get`/`put`/`has` over `Uint8Array` **plus the caller's own metadata**, framed
 * by {@link BlobEnvelope}. The metadata channel is the reason this exists:
 * fields like a cache tag or a duration travel as schema-typed metadata, and a
 * format revision is detected in the blob rather than by prefixing keys.
 *
 * Deliberately no `list` and no `delete`: eviction belongs to the backend, and
 * both backends already have one.
 *
 * Backends: {@link BlobStore.layerS3}, `GitHubCacheBlobStore.layer` and the
 * in-memory {@link BlobStore.layerMemory}.
 *
 * **Example** (Store and retrieve a blob with typed metadata)
 *
 * ```ts
 * import { BlobStore } from "@beep/scratchpad/effected/github-actions/BlobStore";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import * as S from "effect/Schema";
 *
 * class Meta extends S.Class<Meta>("Meta")({ tag: S.String, durationMs: S.Finite }) {}
 * const bytes = new Uint8Array([1, 2, 3]);
 * const program = Effect.gen(function* () {
 *   const store = yield* BlobStore;
 *   yield* store.put("build/1", { metadata: Meta.make({ tag: "x", durationMs: 12 }), body: bytes }, Meta);
 *   const stored = yield* store.get("build/1", Meta);
 *   return O.map(stored, (blob) => blob.metadata.tag).pipe(O.getOrElse(() => "missing"));
 * });
 * console.log(Effect.runSync(Effect.provide(program, BlobStore.layerMemory))) // x
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class BlobStore extends Context.Service<BlobStore, BlobStoreShape>()($I`BlobStore`) {
	/**
	 * An S3-compatible backend, signed with SigV4.
	 *
	 * **Details**
	 *
	 * No `@aws-sdk/*` dependency: signing is a specified algorithm over strings
	 * and HMACs, and this package already has `node:crypto`. The SDK's weight is
	 * in credential management, retries and a service catalogue none of which
	 * this needs.
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 *
	 * **Example** (Configure an S3-compatible backend)
	 *
	 * ```ts
	 * import { BlobStore } from "@beep/scratchpad/effected/github-actions/BlobStore";
	 * import * as Layer from "effect/Layer";
	 * import * as Redacted from "effect/Redacted";
	 *
	 * const layer = BlobStore.layerS3({
	 *   bucket: "build-cache",
	 *   region: "us-east-1",
	 *   accessKeyId: "example-key",
	 *   secretAccessKey: Redacted.make("example-secret"),
	 * });
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerS3 = (config: S3Config): Layer.Layer<BlobStore, never, HttpClient.HttpClient | ActionOutputs> =>
		Layer.effect(BlobStore, makeS3(config));

	/**
	 * A test double. Unstubbed members die rather than reporting a miss.
	 *
	 * **Example** (Stub a key-presence check)
	 *
	 * ```ts
	 * import { BlobStore } from "@beep/scratchpad/effected/github-actions/BlobStore";
	 * import * as Effect from "effect/Effect";
	 *
	 * const store = BlobStore.makeTest({ has: (_key) => Effect.succeed(true) });
	 * console.log(Effect.runSync(store.has("build/1"))) // true
	 * ```
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<BlobStoreShape> = {}): BlobStoreShape => ({
		get: () => dies("get"),
		put: () => dies("put"),
		has: () => dies("has"),
		...overrides,
	});

	/**
	 * {@link BlobStore.makeTest} behind `Layer.succeed`.
	 *
	 * **Example** (Provide a stubbed blob service)
	 *
	 * ```ts
	 * import { BlobStore } from "@beep/scratchpad/effected/github-actions/BlobStore";
	 * import * as Effect from "effect/Effect";
	 *
	 * const layer = BlobStore.layerTest({ has: (_key) => Effect.succeed(false) });
	 * const program = Effect.flatMap(BlobStore, (store) => store.has("build/1"));
	 * console.log(Effect.runSync(Effect.provide(program, layer))) // false
	 * ```
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<BlobStoreShape> = {}): Layer.Layer<BlobStore> =>
		Layer.succeed(BlobStore, BlobStore.makeTest(overrides));

	/**
	 * An in-memory backend.
	 *
	 * **Details**
	 *
	 * Not a stub: it runs the real {@link BlobEnvelope} framing, so a round trip
	 * through it exercises encode and decode exactly as a network backend would.
	 * A test that wants to prove its metadata survives storage should use this
	 * rather than a double whose `get` returns whatever its `put` was handed.
	 *
	 * **Example** (Round trip metadata through the memory backend)
	 *
	 * ```ts
	 * import { BlobStore } from "@beep/scratchpad/effected/github-actions/BlobStore";
	 * import * as Effect from "effect/Effect";
	 * import * as O from "effect/Option";
	 * import * as S from "effect/Schema";
	 *
	 * class Meta extends S.Class<Meta>("Meta")({ tag: S.String, durationMs: S.Finite }) {}
	 * const bytes = new Uint8Array([1, 2, 3]);
	 * const program = Effect.gen(function* () {
	 *   const store = yield* BlobStore;
	 *   yield* store.put("build/1", { metadata: Meta.make({ tag: "x", durationMs: 12 }), body: bytes }, Meta);
	 *   const stored = yield* store.get("build/1", Meta);
	 *   return O.map(stored, (blob) => blob.metadata.tag).pipe(O.getOrElse(() => "missing"));
	 * });
	 * console.log(Effect.runSync(Effect.provide(program, BlobStore.layerMemory))) // x
	 * ```
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerMemory: Layer.Layer<BlobStore> = Layer.sync(BlobStore, () => {
		const entries = MutableHashMap.empty<string, Uint8Array>();
		return {
			get: Effect.fn("BlobStore.get")(<A, I>(key: string, schema: S.Codec<A, I>) =>
				Effect.suspend(() => {
					const stored = MutableHashMap.get(entries, key);
					return O.match(stored, {
						onNone: () => Effect.succeed(O.none<StoredBlob<A>>()),
						onSome: (bytes) => BlobEnvelope.decodeResult(bytes, schema).pipe(Effect.fromResult, Effect.asSome),
					});
				})),
			put: Effect.fn("BlobStore.put")(<A, I>(key: string, blob: StoredBlob<A>, schema: S.Codec<A, I>) =>
				Effect.suspend(() =>
					Effect.map(Effect.fromResult(BlobEnvelope.encodeResult(blob.metadata, blob.body, schema)), (framed) => {
						MutableHashMap.set(entries, key, framed);
					}),
				)),
			has: Effect.fn("BlobStore.has")((key: string) => Effect.sync(() => MutableHashMap.has(entries, key))),
		};
	});
}

const dies = unstubbed("BlobStore.makeTest");

const makeS3 = Effect.fn("makeS3")(function* (config: S3Config) {
		const http = yield* HttpClient.HttpClient;
		const endpointResult = S.decodeResult(S.URLFromString)(
			config.endpoint ?? `https://s3.${config.region}.amazonaws.com`,
		);

		// Declassified ONCE, here, through the package's only declassification
		// seam — which also registers both values with the runner's log filter.
		// Doing it per request would emit a workflow command per object.
		const secretAccessKey = yield* Secret.forSigning(config.secretAccessKey);
		const sessionToken = yield* O.match(O.fromUndefinedOr(config.sessionToken), {
			onNone: () => Effect.succeed(O.none<string>()),
			onSome: flow(Secret.forSigning, Effect.asSome),
		});

		const objectPath = (key: string): string =>
			A.join([config.bucket, ...(config.prefix === undefined ? [] : [config.prefix]), key], "/");

		const request = (endpoint: URL, method: string, path: string, body: Uint8Array, now: DateTime.Utc) => {
			// Keep the endpoint's existing escapes; only raw object segments are encoded.
			// Strip trailing slashes without a backtracking regex.
			let encodedPathPrefix = endpoint.pathname;
			while (Str.endsWith("/")(encodedPathPrefix)) {
				encodedPathPrefix = Str.slice(0, -1)(encodedPathPrefix);
			}
			const headers = sign(
				{ method, path, encodedPathPrefix, host: endpoint.host, headers: {}, body, now: DateTime.toDateUtc(now) },
				{
					accessKeyId: config.accessKeyId,
					secretAccessKey,
					...O.getSomesStruct({ sessionToken }),
					region: config.region,
					service: "s3",
				},
			);
			return { url: `${endpoint.origin}${encodedPathPrefix}/${A.join(A.map(Str.split(path, "/"), uriEncode), "/")}`, headers };
		};

		const send = Effect.fn("BlobStore.send")(function* (method: "GET" | "PUT" | "HEAD", key: string, body: Uint8Array) {
			const endpoint = yield* Effect.fromResult(endpointResult).pipe(
				Effect.mapError((cause) => BlobStoreError.make({
					reason: "misconfigured", key, detail: "The endpoint must be a valid absolute HTTP URL", cause,
				})),
			);
			if (!S.is(EndpointProtocol)(endpoint.protocol) || endpoint.host === "") {
				return yield* BlobStoreError.make({
					reason: "misconfigured", key, detail: "The endpoint must be a valid absolute HTTP URL",
				});
			}
			if (Str.includes("?")(endpoint.href) || Str.includes("#")(endpoint.href)) {
				return yield* BlobStoreError.make({
					reason: "misconfigured", key, detail: "The endpoint must not contain a search or hash",
				});
			}
			const path = objectPath(key);
			if (A.some(Str.split(path, "/"), S.is(DotSegment))) {
				return yield* BlobStoreError.make({
					reason: "misconfigured",
					key,
					detail: "The object path must not contain complete . or .. segments",
				});
			}
			const now = yield* DateTime.now;
			const { url, headers } = request(endpoint, method, path, body, now);
			const base = HttpClientRequest.make(method)(url, { headers });
			const built = body.length === 0 ? base : HttpClientRequest.bodyUint8Array(base, body);
			return yield* http
				.execute(built)
				.pipe(Effect.mapError((cause) => BlobStoreError.make({ reason: "unreachable", key, cause })));
		});

		/** Anything outside 2xx is the store refusing; a caller reads `404` first where a miss is an answer. */
		const accepted = (key: string, status: number): Effect.Effect<void, BlobStoreError> =>
			Bool.match(status < 200 || status >= 300, {
				onTrue: () => Effect.fail(BlobStoreError.make({ reason: "refused", key, status })),
				onFalse: () => Effect.void,
			});

		return {
			get: Effect.fn("get")(function*<A, I>(key: string, schema: S.Codec<A, I>) {
					const response = yield* send("GET", key, new Uint8Array(0));
					// A miss is not a failure: it is the answer the caller asked for.
					if (response.status === 404) {
						return O.none<StoredBlob<A>>();
					}
					yield* accepted(key, response.status);
					const buffer = yield* response.arrayBuffer.pipe(
						Effect.mapError((cause) => BlobStoreError.make({ reason: "unreachable", key, cause })),
					);
					return O.some(yield* Effect.fromResult(BlobEnvelope.decodeResult(new Uint8Array(buffer), schema)));
				}),

			put: Effect.fn("put")(function*<A, I>(key: string, blob: StoredBlob<A>, schema: S.Codec<A, I>) {
					const framed = yield* Effect.fromResult(BlobEnvelope.encodeResult(blob.metadata, blob.body, schema));
					const response = yield* send("PUT", key, framed);
					yield* accepted(key, response.status);
				}),

			has: Effect.fn("has")(function*(key: string) {
					const response = yield* send("HEAD", key, new Uint8Array(0));
					if (response.status === 404) {
						return false;
					}
					yield* accepted(key, response.status);
					return true;
				}),
		} satisfies BlobStoreShape;
	});
