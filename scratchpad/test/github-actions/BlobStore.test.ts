import { assert, describe, it } from "@effect/vitest";
import { assertSome, assertNone, assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as DateTime from "effect/DateTime";
import * as TestClock from "effect/testing/TestClock";
import { FetchHttpClient } from "effect/http";
import type { S3Config } from "../../effected/github-actions/index.ts";
import {
	ActionOutputs,
	BlobStore,
	BlobStoreError,
	NotABlobEnvelopeError,
} from "../../effected/github-actions/index.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";
import { canonicalize, digestHex, sign, signingKey, uriEncode } from "../../effected/github-actions/internal/sigv4.ts";

class AlternateBlobStore extends Context.Service<AlternateBlobStore, Context.Service.Shape<typeof BlobStore>>()(
	"@beep/scratchpad/test/github-actions/BlobStore.test/AlternateBlobStore",
) {}

class Meta extends S.Class<Meta>("Meta")({ tag: S.String, durationMs: S.Finite }) {}

const fetchStub = (
	handle: (
		input: Parameters<typeof globalThis.fetch>[0],
		init: Parameters<typeof globalThis.fetch>[1],
	) => Response | Promise<Response>,
): typeof globalThis.fetch =>
	Object.assign(
		(input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) =>
			Promise.resolve(handle(input, init)),
		{ preconnect: () => {} },
	);

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
				now: DateTime.toDateUtc(DateTime.makeUnsafe("2013-05-24T00:00:00.000Z")),
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
				now: DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-01T00:00:00.000Z")),
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
			now: DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-01T00:00:00.000Z")),
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
		{
			const seen: Array<{ url: string; method: string; authorization: string | null }> = [];

			const fake: typeof globalThis.fetch = fetchStub(
				(input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
					seen.push({
						url: String(input),
						method: init?.method ?? "GET",
						authorization: new Headers(init?.headers).get("authorization"),
					});
					return new Response(null, { status: 200 });
				},
			);
			it.layer(s3(fake), { timeout: "30 seconds" })((it) => {
				it.effect("puts a framed blob at a path-style url", () =>
					Effect.gen(function* () {
						yield* (yield* BlobStore).put(
							"build/1",
							{ metadata: Meta.make({ tag: "x", durationMs: 12 }), body: new Uint8Array([9]) },
							Meta,
						);

						// Path-style, not virtual-host: that is what makes one layer work
						// against R2, MinIO and Spaces as well as AWS.
						assert.strictEqual(seen[0]?.url, "https://account.r2.cloudflarestorage.com/cache/build/1");
						assert.strictEqual(seen[0]?.method, "PUT");
						assert.include(seen[0]?.authorization ?? "", "AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/");
					}),
				);
			});
		}

		{
			const seen: Array<string> = [];

			const fake: typeof globalThis.fetch = fetchStub((input: Parameters<typeof globalThis.fetch>[0]) => {
				seen.push(String(input));
				return new Response(null, { status: 200 });
			});
			it.layer(s3(fake, { ...CONFIG, prefix: "ci" }), { timeout: "30 seconds" })((it) => {
				it.effect("applies the key prefix", () =>
					Effect.gen(function* () {
						yield* (yield* BlobStore).has("k");
						assert.strictEqual(seen[0], "https://account.r2.cloudflarestorage.com/cache/ci/k");
					}),
				);
			});
		}

		{
			const keys = ["a#b", "a?b", "a%2Fb", "a//b", "folder/", "/leading//"];

			const paths = ["a%23b", "a%3Fb", "a%252Fb", "a//b", "folder/", "/leading//"];

			const seen: Array<{ url: string; authorization: string | null }> = [];

			const fake: typeof globalThis.fetch = fetchStub(
				(input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
					seen.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
					return new Response(null, { status: 200 });
				},
			);
			it.layer(s3(fake, { ...CONFIG, prefix: "ci?#%/" }), { timeout: "30 seconds" })((it) => {
				it.effect("encodes raw object segments once and signs the resource sent", () =>
					Effect.gen(function* () {
						yield* TestClock.setTime(1704067200000);

						const store = yield* BlobStore;

						for (const key of keys) {
							yield* store.has(key);
						}
						assert.deepStrictEqual(
							seen.map((entry) => entry.url),
							paths.map((path) => `${CONFIG.endpoint}/cache/ci%3F%23%25//${path}`),
						);
						for (const [index, key] of keys.entries()) {
							const expected = sign(
								{
									method: "HEAD",
									path: `cache/ci?#%//${key}`,
									host: "account.r2.cloudflarestorage.com",
									headers: {},
									body: new Uint8Array(0),
									now: DateTime.toDateUtc(DateTime.makeUnsafe("2024-01-01T00:00:00Z")),
								},
								{
									accessKeyId: CONFIG.accessKeyId,
									secretAccessKey: "secret-key",
									region: CONFIG.region,
									service: "s3",
								},
							);
							assert.strictEqual(seen[index]?.authorization, expected.authorization);
						}
					}),
				);
			});
		}

		{
			const stored = new Map<string, Uint8Array>();

			const fake: typeof globalThis.fetch = fetchStub(
				(input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
					const url = String(input);
					if (init?.method === "PUT") {
						return new Response(init.body).arrayBuffer().then((buffer) => {
							stored.set(url, new Uint8Array(buffer));
							return new Response(null, { status: 200 });
						});
					}
					const bytes = stored.get(url);
					return bytes === undefined ? new Response(null, { status: 404 }) : new Response(bytes, { status: 200 });
				},
			);

			const keys = ["a/b", "a//b", "folder", "folder/", "a#b", "a?b", "a%2Fb"];
			it.layer(s3(fake), { timeout: "30 seconds" })((it) => {
				it.effect("keeps repeated and trailing slash keys distinct in storage", () =>
					Effect.gen(function* () {
						const store = yield* BlobStore;

						for (const [index, key] of keys.entries()) {
							yield* store.put(
								key,
								{ metadata: Meta.make({ tag: key, durationMs: index }), body: new Uint8Array([index]) },
								Meta,
							);
						}

						for (const [index, key] of keys.entries()) {
							const found = yield* store.get(key, Meta);
							assertSome(found, {
								metadata: Meta.make({ tag: key, durationMs: index }),
								body: new Uint8Array([index]),
							});
							assert.strictEqual(found.value.metadata.tag, key);
							assert.deepStrictEqual(found.value.body, new Uint8Array([index]));
						}
						assert.strictEqual(stored.size, keys.length);
					}),
				);
			});
		}

		{
			const seen: Array<{ date: string | null; authorization: string | null }> = [];

			const fake: typeof globalThis.fetch = fetchStub(
				(_input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
					const headers = new Headers(init?.headers);
					seen.push({ date: headers.get("x-amz-date"), authorization: headers.get("authorization") });
					return new Response(null, { status: 200 });
				},
			);
			it.layer(s3(fake), { timeout: "30 seconds" })((it) => {
				it.effect("reads the signing instant from TestClock on every request", () =>
					Effect.gen(function* () {
						const store = yield* BlobStore;

						yield* TestClock.setTime(1704067200000);

						yield* store.has("key");

						yield* TestClock.setTime(1704153600000);

						yield* store.has("key");
						assert.deepStrictEqual(
							seen.map((entry) => entry.date),
							["20240101T000000Z", "20240102T000000Z"],
						);
						for (const [index, instant] of ["2024-01-01T00:00:00Z", "2024-01-02T00:00:00Z"].entries()) {
							const expected = sign(
								{
									method: "HEAD",
									path: "cache/key",
									host: "account.r2.cloudflarestorage.com",
									headers: {},
									body: new Uint8Array(0),
									now: DateTime.toDateUtc(DateTime.makeUnsafe(instant)),
								},
								{
									accessKeyId: CONFIG.accessKeyId,
									secretAccessKey: "secret-key",
									region: CONFIG.region,
									service: "s3",
								},
							);
							assert.strictEqual(seen[index]?.authorization, expected.authorization);
						}
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = fetchStub(() => new Response("", { status: 404 }));
			it.layer(s3(fake), { timeout: "30 seconds" })((it) => {
				it.effect("reports a miss as nothing, not as a failure", () =>
					Effect.gen(function* () {
						const found = yield* (yield* BlobStore).get("absent", Meta);
						assertNone(found);
					}),
				);
			});
		}

		{
			const present: typeof globalThis.fetch = fetchStub(() => new Response(null, { status: 200 }));

			const absent: typeof globalThis.fetch = fetchStub(() => new Response(null, { status: 404 }));
			it.layer(
				Layer.mergeAll(
					s3(present),
					Layer.effect(AlternateBlobStore, BlobStore).pipe(Layer.provide(Layer.fresh(s3(absent)))),
				),
				{ timeout: "30 seconds" },
			)((it) => {
				it.effect("has() is false for 404 and true for 200", () =>
					Effect.gen(function* () {
						assert.isTrue(yield* (yield* BlobStore).has("k"));
						assert.isFalse(yield* (yield* AlternateBlobStore).has("k"));
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = fetchStub(() => new Response("denied", { status: 403 }));
			it.layer(s3(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed, carrying the status, when the store refuses", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(Effect.flatMap(BlobStore, (store) => store.get("k", Meta)));
						assert.instanceOf(error, BlobStoreError);
						assert.strictEqual(error.reason === "refused" ? error.status : undefined, 403);
					}),
				);
			});
		}

		{
			const stored = new Map<string, Uint8Array>();

			const fake: typeof globalThis.fetch = fetchStub(
				(input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
					const key = String(input);
					if ((init?.method ?? "GET") === "PUT") {
						return new Response(init?.body).arrayBuffer().then((buffer) => {
							stored.set(key, new Uint8Array(buffer));
							return new Response(null, { status: 200 });
						});
					}
					const found = stored.get(key);
					return found === undefined ? new Response(null, { status: 404 }) : new Response(found, { status: 200 });
				},
			);

			const layer = s3(fake);
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("round-trips metadata and body through the real frame", () =>
					Effect.gen(function* () {
						const store = yield* BlobStore;

						yield* store.put(
							"k",
							{ metadata: Meta.make({ tag: "turbo", durationMs: 4200 }), body: new Uint8Array([1, 2, 3]) },
							Meta,
						);

						const found = yield* store.get("k", Meta);

						assertSome(found, {
							metadata: Meta.make({ tag: "turbo", durationMs: 4200 }),
							body: new Uint8Array([1, 2, 3]),
						});

						assert.deepStrictEqual(found.value.metadata, Meta.make({ tag: "turbo", durationMs: 4200 }));

						assert.deepStrictEqual([...found.value.body], [1, 2, 3]);
					}),
				);
			});
		}

		{
			// The reason the magic prefix exists: a store holding pre-envelope
			// entries must produce a clean, named failure rather than decoding
			// arbitrary bytes as metadata.
			const fake: typeof globalThis.fetch = fetchStub(
				() => new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 }),
			);
			it.layer(s3(fake), { timeout: "30 seconds" })((it) => {
				it.effect("reports an unframed legacy blob as a typed miss, not as garbage metadata", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(Effect.flatMap(BlobStore, (store) => store.get("legacy", Meta)));
						assert.instanceOf(error, NotABlobEnvelopeError);
					}),
				);
			});
		}

		{
			const outputs = recordingOutputs();

			const fake: typeof globalThis.fetch = fetchStub(() => new Response(null, { status: 200 }));

			const layer = s3(fake, { ...CONFIG, sessionToken: Redacted.make("session") }, outputs);
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("masks the signing key once, at layer construction", () =>
					Effect.gen(function* () {
						const store = yield* BlobStore;

						yield* store.has("a");

						yield* store.has("b");
						// Both credentials masked; once each, not once per request.
						assert.deepStrictEqual(outputs.masked, ["secret-key", "session"]);
					}),
				);
			});
		}
	});

	describe("the in-memory backend", () => {
		{
			it.layer(BlobStore.layerMemory, { timeout: "30 seconds" })((it) => {
				it.effect("runs the real framing, so a round trip proves the metadata survives", () =>
					Effect.gen(function* () {
						const store = yield* BlobStore;
						assert.isFalse(yield* store.has("k"));
						yield* store.put(
							"k",
							{ metadata: Meta.make({ tag: "t", durationMs: 1 }), body: new Uint8Array([7]) },
							Meta,
						);
						assert.isTrue(yield* store.has("k"));
						const found = yield* store.get("k", Meta);
						assertSome(found, { metadata: Meta.make({ tag: "t", durationMs: 1 }), body: new Uint8Array([7]) });
						assert.strictEqual(found.value.metadata.tag, "t");
						assert.deepStrictEqual([...found.value.body], [7]);
					}),
				);
			});
		}

		{
			it.layer(BlobStore.layerMemory, { timeout: "30 seconds" })((it) => {
				it.effect("reports an absent key as nothing", () =>
					Effect.gen(function* () {
						assertNone(yield* (yield* BlobStore).get("absent", Meta));
					}),
				);
			});
		}
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies rather than reporting a miss", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(BlobStore, (store) => store.has("k")));
				assertExitFailure(
					exit,
					Cause.die(
						UnstubbedMemberError.make({
							message: "BlobStore.makeTest: has() was called but not stubbed — pass a `has` override.",
						}),
					),
				);
			}).pipe(Effect.provideService(BlobStore, BlobStore.makeTest())),
		);
	});
});
