import { $ScratchpadId } from "@beep/identity/packages";
import type * as Redacted from "effect/Redacted";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as DateTime from "effect/DateTime";
import { HttpClient, HttpClientRequest } from "effect/http";
import type { ActionOutputs } from "./ActionOutputs.ts";
import type { BlobEnvelopeError } from "./BlobEnvelope.ts";
import { BlobEnvelope } from "./BlobEnvelope.ts";
import { sign } from "./internal/sigv4.ts";
import { unstubbed } from "./internal/unstubbed.ts";
import { Secret } from "./Secret.ts";

const $I = $ScratchpadId.create("effected/github-actions/BlobStore");

/**
 * Raised when a blob cannot be stored or retrieved.
 *
 * @public
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
	override get message(): string {
		switch (this.reason) {
			case "unreachable":
				return `The blob store could not be reached${this.key === undefined ? "" : ` for "${this.key}"`}`;
			case "refused":
				return `The blob store refused "${this.key}"${this.status === undefined ? "" : ` with status ${this.status}`}${
					this.detail === undefined ? "" : `: ${this.detail}`
				}`;
			default:
				return `The blob store is misconfigured${this.detail === undefined ? "" : `: ${this.detail}`}`;
		}
	}
}

/**
 * A stored value: the caller's metadata beside the bytes it describes.
 *
 * @public
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
 */
export interface BlobStoreShape {
	/**
	 * Read a blob, or nothing if the key is absent.
	 *
	 * @remarks
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
 * @public
 */
export interface S3Config {
	/** The bucket name. */
	readonly bucket: string;
	/** The bucket's region, used for SigV4 signing and the default AWS endpoint. */
	readonly region: string;
	/**
	 * A custom endpoint, e.g. `https://<account>.r2.cloudflarestorage.com`.
	 *
	 * @remarks
	 * Omitting it targets AWS itself. Addressing is always **path-style**
	 * (`<endpoint>/<bucket>/<key>`), which is what makes the same layer work
	 * against R2, MinIO and Spaces — virtual-host addressing needs per-bucket
	 * DNS that none of them provide the same way.
	 */
	readonly endpoint?: string | undefined;
	/** The access key id. */
	readonly accessKeyId: string;
	/** The secret access key, declassified once and masked in the runner log. */
	readonly secretAccessKey: Redacted.Redacted<string>;
	/** For temporary credentials. */
	readonly sessionToken?: Redacted.Redacted<string> | undefined;
	/** Prepended to every key, so one bucket can hold several caches. */
	readonly prefix?: string | undefined;
}

/**
 * Durable blob storage with a metadata channel.
 *
 * @remarks
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
 * @example
 * ```ts
 * import { BlobStore } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * class Meta extends S.Class<Meta>("Meta")({ tag: S.String, durationMs: S.Finite }) {}
 *
 * const program = Effect.gen(function* () {
 *   const store = yield* BlobStore;
 *   yield* store.put("build/1", { metadata: Meta.make({ tag: "x", durationMs: 12 }), body: bytes }, Meta);
 *   return yield* store.get("build/1", Meta);
 * });
 * ```
 *
 * @public
 */
export class BlobStore extends Context.Service<BlobStore, BlobStoreShape>()($I`BlobStore`) {
	/**
	 * An S3-compatible backend, signed with SigV4.
	 *
	 * @remarks
	 * No `@aws-sdk/*` dependency: signing is a specified algorithm over strings
	 * and HMACs, and this package already has `node:crypto`. The SDK's weight is
	 * in credential management, retries and a service catalogue none of which
	 * this needs.
	 *
	 * A parameterized layer factory mints a fresh layer per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly layerS3 = (config: S3Config): Layer.Layer<BlobStore, never, HttpClient.HttpClient | ActionOutputs> =>
		Layer.effect(BlobStore, makeS3(config));

	/** A test double. Unstubbed members die rather than reporting a miss. */
	static readonly makeTest = (overrides: Partial<BlobStoreShape> = {}): BlobStoreShape => ({
		get: () => dies("get"),
		put: () => dies("put"),
		has: () => dies("has"),
		...overrides,
	});

	/** {@link BlobStore.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<BlobStoreShape> = {}): Layer.Layer<BlobStore> =>
		Layer.succeed(BlobStore, BlobStore.makeTest(overrides));

	/**
	 * An in-memory backend.
	 *
	 * @remarks
	 * Not a stub: it runs the real {@link BlobEnvelope} framing, so a round trip
	 * through it exercises encode and decode exactly as a network backend would.
	 * A test that wants to prove its metadata survives storage should use this
	 * rather than a double whose `get` returns whatever its `put` was handed.
	 */
	static readonly layerMemory: Layer.Layer<BlobStore> = Layer.sync(BlobStore, () => {
		const entries = new Map<string, Uint8Array>();
		return {
			get: Effect.fn("BlobStore.get")(<A, I>(key: string, schema: S.Codec<A, I>) =>
				Effect.suspend(() => {
					const stored = entries.get(key);
					return stored === undefined
						? Effect.succeed(O.none<StoredBlob<A>>())
						: BlobEnvelope.decodeResult(stored, schema).pipe(Effect.fromResult, Effect.asSome);
				})),
			put: Effect.fn("BlobStore.put")(<A, I>(key: string, blob: StoredBlob<A>, schema: S.Codec<A, I>) =>
				Effect.suspend(() =>
					Effect.map(Effect.fromResult(BlobEnvelope.encodeResult(blob.metadata, blob.body, schema)), (framed) => {
						entries.set(key, framed);
					}),
				)),
			has: Effect.fn("BlobStore.has")((key: string) => Effect.sync(() => entries.has(key))),
		};
	});
}

const dies = unstubbed("BlobStore.makeTest");

const makeS3 = (config: S3Config): Effect.Effect<BlobStoreShape, never, HttpClient.HttpClient | ActionOutputs> =>
	Effect.gen(function* () {
		const http = yield* HttpClient.HttpClient;
		// Trailing slashes stripped without a regex: the anchored `/\/+$/` form
		// backtracks quadratically on slash runs (CodeQL js/polynomial-redos).
		let endpoint = config.endpoint ?? `https://s3.${config.region}.amazonaws.com`;
		while (endpoint.endsWith("/")) {
			endpoint = endpoint.slice(0, -1);
		}
		const host = new URL(endpoint).host;

		// Declassified ONCE, here, through the package's only declassification
		// seam — which also registers both values with the runner's log filter.
		// Doing it per request would emit a workflow command per object.
		const secretAccessKey = yield* Secret.forSigning(config.secretAccessKey);
		const sessionToken = config.sessionToken === undefined ? undefined : yield* Secret.forSigning(config.sessionToken);

		const objectPath = (key: string): string =>
			[config.bucket, ...(config.prefix === undefined ? [] : [config.prefix]), key]
				.join("/")
				.replaceAll(/\/{2,}/g, "/");

		const request = (method: string, key: string, body: Uint8Array) => {
			const path = objectPath(key);
			const headers = sign(
				{ method, path, host, headers: {}, body, now: DateTime.toDateUtc(DateTime.nowUnsafe()) },
				{
					accessKeyId: config.accessKeyId,
					secretAccessKey,
					...O.getSomesStruct({ sessionToken: O.fromUndefinedOr(sessionToken) }),
					region: config.region,
					service: "s3",
				},
			);
			return { url: `${endpoint}/${path}`, headers };
		};

		const send = (method: "GET" | "PUT" | "HEAD", key: string, body: Uint8Array) =>
			Effect.suspend(() => {
				const { url, headers } = request(method, key, body);
				const base = HttpClientRequest.make(method)(url, { headers });
				const built = body.length === 0 ? base : HttpClientRequest.bodyUint8Array(base, body);
				return http
					.execute(built)
					.pipe(Effect.mapError((cause) => BlobStoreError.make({ reason: "unreachable", key, cause })));
			});

		/** Anything outside 2xx is the store refusing; a caller reads `404` first where a miss is an answer. */
		const accepted = (key: string, status: number): Effect.Effect<void, BlobStoreError> =>
			status < 200 || status >= 300 ? Effect.fail(BlobStoreError.make({ reason: "refused", key, status })) : Effect.void;

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
