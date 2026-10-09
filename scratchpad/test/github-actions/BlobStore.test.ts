// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option, Redacted, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import type { S3Config } from "../../effected/github-actions/index.ts";
import { ActionOutputs, BlobStore, BlobStoreError, NotABlobEnvelopeError } from "../../effected/github-actions/index.ts";
import { canonicalize, digestHex, sign, signingKey, uriEncode } from "../../effected/github-actions/internal/sigv4.ts";

class Meta extends Schema.Class<Meta>("Meta")({ tag: Schema.String, durationMs: Schema.Number }) {}

const CONFIG: S3Config = {
	bucket: "cache",
	region: "auto",
	endpoint: "https://account.r2.cloudflarestorage.com",
	accessKeyId: "AKIAEXAMPLE",
	secretAccessKey: Redacted.make("secret-key"),
};

/** Records every mask, so the declassification ordering is observable. */
const recordingOutputs = () => {
	const masked: Array<string> = [];
	const layer = ActionOutputs.layerTest({
		setSecret: (value) =>
			Effect.suspend(() => {
				masked.push(value);
				return Effect.void;
			}),
	});
	return { masked, layer };
};

const s3 = (fake: typeof globalThis.fetch, config: S3Config = CONFIG, outputs = recordingOutputs()) =>
	BlobStore.layerS3(config).pipe(
		Layer.provide(
			Layer.mergeAll(
				outputs.layer,
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fake))),
			),
		),
	);

describe("SigV4", () => {
	// The oracle is AWS's own published examples, not this implementation's
	// output. That distinction was load-bearing: the first draft was checked
	// against a remembered signature constant that turned out to belong to a
	// different example, and only reproducing a value AWS publishes settled which
	// side was wrong.
	it("reproduces AWS's documented canonical request for GET Object", () => {
		const { canonicalRequest } = canonicalize(
			{
				method: "GET",
				// AWS's example is virtual-host addressed (the bucket is in the host),
				// so the canonical path is just the key. The signer is agnostic — it
				// signs whatever path it is given, which is what lets this same code
				// serve the path-style addressing R2 and MinIO need.
				path: "test.txt",
				host: "examplebucket.s3.amazonaws.com",
				headers: { range: "bytes=0-9" },
				body: new Uint8Array(0),
				now: new Date("2013-05-24T00:00:00.000Z"),
			},
			{
				accessKeyId: "AKIAIOSFODNN7EXAMPLE",
				secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
				region: "us-east-1",
				service: "s3",
			},
		);
		// AWS documents this exact hash for the GET Object example.
		assert.strictEqual(digestHex(canonicalRequest), "7344ae5b7ee6c3e7e6b0fe0640412a37625d1fbfff95c48bbb2dc43964946972");
	});

	it("reproduces AWS's documented signing-key derivation", () => {
		const key = signingKey("wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", "20120215", "us-east-1", "iam");
		assert.strictEqual(
			Buffer.from(key).toString("hex"),
			"f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d",
		);
	});

	it("encodes the characters encodeURIComponent leaves alone", () => {
		// `!'()*` are unreserved to encodeURIComponent and reserved to AWS. A key
		// containing one signs one string and requests another, and the server says
		// only `SignatureDoesNotMatch`.
		assert.strictEqual(uriEncode("a!b'c(d)e*f"), "a%21b%27c%28d%29e%2Af");
		assert.strictEqual(uriEncode("plain-file_name.tar~gz"), "plain-file_name.tar~gz");
	});

	it("signs the headers it returns, so nothing is sent unsigned", () => {
		const headers = sign(
			{
				method: "PUT",
				path: "bucket/key",
				host: "example.test",
				headers: {},
				body: new Uint8Array([1, 2, 3]),
				now: new Date("2024-01-01T00:00:00.000Z"),
			},
			{ accessKeyId: "AK", secretAccessKey: "SK", region: "us-east-1", service: "s3", sessionToken: "ST" },
		);
		const signedHeaders = /SignedHeaders=([^,]+)/.exec(headers.authorization ?? "")?.[1]?.split(";") ?? [];
		const sent = Object.keys(headers)
			.filter((name) => name !== "authorization")
			.sort();
		assert.deepStrictEqual([...signedHeaders].sort(), sent, "every header sent must be a header signed");
		assert.include(signedHeaders, "x-amz-security-token", "a session token must be signed, not merely sent");
	});

	it("sorts canonical headers regardless of insertion order", () => {
		const request = {
			method: "GET" as const,
			path: "bucket/key",
			host: "example.test",
			body: new Uint8Array(0),
			now: new Date("2024-01-01T00:00:00.000Z"),
		};
		const credentials = { accessKeyId: "AK", secretAccessKey: "SK", region: "us-east-1", service: "s3" };
		const first = canonicalize({ ...request, headers: { "z-last": "1", "a-first": "2" } }, credentials);
		const second = canonicalize({ ...request, headers: { "a-first": "2", "z-last": "1" } }, credentials);
		// The signature covers this exact string, so an order-dependent canonical
		// form produces a valid-looking signature the server rejects.
		assert.strictEqual(first.canonicalRequest, second.canonicalRequest);
	});
});

describe("BlobStore", () => {
	describe("the S3 backend", () => {
		it.effect("puts a framed blob at a path-style url", () =>
			Effect.gen(function* () {
				const seen: Array<{ url: string; method: string; authorization: string | null }> = [];
				const fake: typeof globalThis.fetch = async (input, init) => {
					seen.push({
						url: String(input),
						method: init?.method ?? "GET",
						authorization: new Headers(init?.headers).get("authorization"),
					});
					return new Response(null, { status: 200 });
				};
				yield* Effect.gen(function* () {
					yield* (yield* BlobStore).put(
						"build/1",
						{ metadata: Meta.make({ tag: "x", durationMs: 12 }), body: new Uint8Array([9]) },
						Meta,
					);
				}).pipe(Effect.provide(s3(fake)));

				// Path-style, not virtual-host: that is what makes one layer work
				// against R2, MinIO and Spaces as well as AWS.
				assert.strictEqual(seen[0]?.url, "https://account.r2.cloudflarestorage.com/cache/build/1");
				assert.strictEqual(seen[0]?.method, "PUT");
				assert.include(seen[0]?.authorization ?? "", "AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/");
			}),
		);

		it.effect("applies the key prefix", () =>
			Effect.gen(function* () {
				const seen: Array<string> = [];
				const fake: typeof globalThis.fetch = async (input) => {
					seen.push(String(input));
					return new Response(null, { status: 200 });
				};
				yield* Effect.gen(function* () {
					yield* (yield* BlobStore).has("k");
				}).pipe(Effect.provide(s3(fake, { ...CONFIG, prefix: "ci" })));
				assert.strictEqual(seen[0], "https://account.r2.cloudflarestorage.com/cache/ci/k");
			}),
		);

		it.effect("reports a miss as nothing, not as a failure", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = async () => new Response("", { status: 404 });
				const found = yield* Effect.gen(function* () {
					return yield* (yield* BlobStore).get("absent", Meta);
				}).pipe(Effect.provide(s3(fake)));
				assert.isTrue(Option.isNone(found));
			}),
		);

		it.effect("has() is false for 404 and true for 200", () =>
			Effect.gen(function* () {
				const present: typeof globalThis.fetch = async () => new Response(null, { status: 200 });
				const absent: typeof globalThis.fetch = async () => new Response(null, { status: 404 });
				assert.isTrue(
					yield* Effect.gen(function* () {
						return yield* (yield* BlobStore).has("k");
					}).pipe(Effect.provide(s3(present))),
				);
				assert.isFalse(
					yield* Effect.gen(function* () {
						return yield* (yield* BlobStore).has("k");
					}).pipe(Effect.provide(s3(absent))),
				);
			}),
		);

		it.effect("fails typed, carrying the status, when the store refuses", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = async () => new Response("denied", { status: 403 });
				const error = yield* Effect.flip(
					Effect.flatMap(BlobStore, (store) => store.get("k", Meta)).pipe(Effect.provide(s3(fake))),
				);
				assert.instanceOf(error, BlobStoreError);
				assert.strictEqual(error.reason === "refused" ? error.status : undefined, 403);
			}),
		);

		it.effect("round-trips metadata and body through the real frame", () =>
			Effect.gen(function* () {
				const stored = new Map<string, Uint8Array>();
				const fake: typeof globalThis.fetch = async (input, init) => {
					const key = String(input);
					if ((init?.method ?? "GET") === "PUT") {
						stored.set(key, new Uint8Array(await new Response(init?.body).arrayBuffer()));
						return new Response(null, { status: 200 });
					}
					const found = stored.get(key);
					return found === undefined ? new Response(null, { status: 404 }) : new Response(found, { status: 200 });
				};
				const layer = s3(fake);
				yield* Effect.gen(function* () {
					const store = yield* BlobStore;
					yield* store.put(
						"k",
						{ metadata: Meta.make({ tag: "turbo", durationMs: 4200 }), body: new Uint8Array([1, 2, 3]) },
						Meta,
					);
					const found = yield* store.get("k", Meta);
					assert.isTrue(Option.isSome(found));
					if (Option.isSome(found)) {
						assert.deepStrictEqual(found.value.metadata, Meta.make({ tag: "turbo", durationMs: 4200 }));
						assert.deepStrictEqual([...found.value.body], [1, 2, 3]);
					}
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("reports an unframed legacy blob as a typed miss, not as garbage metadata", () =>
			Effect.gen(function* () {
				// The reason the magic prefix exists: a store holding pre-envelope
				// entries must produce a clean, named failure rather than decoding
				// arbitrary bytes as metadata.
				const fake: typeof globalThis.fetch = async () =>
					new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 });
				const error = yield* Effect.flip(
					Effect.flatMap(BlobStore, (store) => store.get("legacy", Meta)).pipe(Effect.provide(s3(fake))),
				);
				assert.instanceOf(error, NotABlobEnvelopeError);
			}),
		);

		it.effect("masks the signing key once, at layer construction", () =>
			Effect.gen(function* () {
				const outputs = recordingOutputs();
				const fake: typeof globalThis.fetch = async () => new Response(null, { status: 200 });
				const layer = s3(fake, { ...CONFIG, sessionToken: Redacted.make("session") }, outputs);
				yield* Effect.gen(function* () {
					const store = yield* BlobStore;
					yield* store.has("a");
					yield* store.has("b");
				}).pipe(Effect.provide(layer));
				// Both credentials masked; once each, not once per request.
				assert.deepStrictEqual(outputs.masked, ["secret-key", "session"]);
			}),
		);
	});

	describe("the in-memory backend", () => {
		it.effect("runs the real framing, so a round trip proves the metadata survives", () =>
			Effect.gen(function* () {
				const store = yield* BlobStore;
				assert.isFalse(yield* store.has("k"));
				yield* store.put("k", { metadata: Meta.make({ tag: "t", durationMs: 1 }), body: new Uint8Array([7]) }, Meta);
				assert.isTrue(yield* store.has("k"));
				const found = yield* store.get("k", Meta);
				assert.isTrue(Option.isSome(found));
				if (Option.isSome(found)) {
					assert.strictEqual(found.value.metadata.tag, "t");
					assert.deepStrictEqual([...found.value.body], [7]);
				}
			}).pipe(Effect.provide(BlobStore.layerMemory)),
		);

		it.effect("reports an absent key as nothing", () =>
			Effect.gen(function* () {
				assert.isTrue(Option.isNone(yield* (yield* BlobStore).get("absent", Meta)));
			}).pipe(Effect.provide(BlobStore.layerMemory)),
		);
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies rather than reporting a miss", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(BlobStore, (store) => store.has("k")));
				assert.strictEqual(exit._tag, "Failure");
			}).pipe(Effect.provide(BlobStore.layerTest())),
		);
	});
});
