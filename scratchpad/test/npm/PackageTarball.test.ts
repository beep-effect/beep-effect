// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Crypto, Effect, Layer, PlatformError, Schema } from "effect";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import type { TarballError } from "../../effected/npm/index.ts";
import { PackageTarball, PublishedVersion } from "../../effected/npm/index.ts";
import { scripted } from "./publish-fixtures.ts";

/**
 * The bytes every fixture serves, and the integrity the registry would publish
 * for them — computed independently with `node:crypto`, so the assertion tests
 * this module's SRI spelling rather than agreeing with itself.
 */
const BODY = new TextEncoder().encode("effected-tarball-fixture");
const INTEGRITY = "sha512-YGOjDdAkq0He9th3F8QoLyZHfvbUNr9OGv/drJVnyUx2zF2bOOF29Gp5cML2pcOF2PQNjA+ybAkQXeTcdDIfFA==";

/** A real digest, so the integrity check is exercised rather than simulated. */
const liveCrypto = Layer.succeed(
	Crypto.Crypto,
	Crypto.make({
		digest: (algorithm, data) =>
			// `data.slice()` yields a Uint8Array over a plain ArrayBuffer, which is
			// what WebCrypto's BufferSource accepts.
			Effect.promise(async () => new Uint8Array(await globalThis.crypto.subtle.digest(algorithm, data.slice()))),
		randomBytes: (size) => new Uint8Array(size),
	}),
);

/** An `HttpClient` answering one scripted response for every request. */
const http = (result: { status: number; body?: Uint8Array } | "transport"): Layer.Layer<HttpClient.HttpClient> =>
	Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request) =>
			result === "transport"
				? Effect.fail(
						new HttpClientError.HttpClientError({
							reason: new HttpClientError.TransportError({ request, cause: new Error("ECONNRESET") }),
						}),
					)
				: Effect.succeed(
						HttpClientResponse.fromWeb(
							request,
							new Response(result.body === undefined ? BODY : result.body, { status: result.status }),
						),
					),
		),
	);

const published = (fields: { tarball?: string; integrity?: string }) =>
	Schema.decodeSync(PublishedVersion)({ name: "some-pkg", version: "1.2.3", ...fields });

const WITH_TARBALL = { tarball: "https://registry.test/some-pkg/-/some-pkg-1.2.3.tgz" };

/** Build the layer and the spawn log for one scripted scenario. */
const scenario = (response: { status: number; body?: Uint8Array } | "transport", tarExit = 0) => {
	const spawner = scripted(() => ({ exit: tarExit }));
	const layer = PackageTarball.layer.pipe(
		Layer.provide(Layer.mergeAll(spawner.layer, MemoryFileSystem.layer, liveCrypto, http(response))),
	);
	const extract = (version: PublishedVersion) =>
		Effect.gen(function* () {
			const tarball = yield* PackageTarball;
			return yield* tarball.extract(version);
		}).pipe(Effect.scoped, Effect.provide(layer));
	return { extract, spawns: spawner.spawns };
};

/** The typed error `extract` failed with. Fails the test if it succeeded. */
const failure = (
	version: PublishedVersion,
	response: { status: number; body?: Uint8Array } | "transport",
	tarExit = 0,
): Effect.Effect<TarballError, string> => Effect.flip(scenario(response, tarExit).extract(version));

/** The directory `extract` answered. Fails the test if it failed. */
const success = (
	version: PublishedVersion,
	response: { status: number; body?: Uint8Array } | "transport",
): Effect.Effect<string, TarballError> => scenario(response).extract(version);

describe("PackageTarball", () => {
	describe("the notFound discriminant", () => {
		it.effect("fails notFound when the registry recorded no tarball", () =>
			Effect.gen(function* () {
				const error = yield* failure(published({}), { status: 200 });
				assert.strictEqual(error.reason, "notFound");
			}),
		);

		it.effect("reads a 404 as notFound, not as a transport failure", () =>
			// The split the consumer asked for: "this version does not exist" must
			// be distinguishable from "something went wrong fetching one that
			// does", because the two warrant opposite recovery.
			Effect.gen(function* () {
				const error = yield* failure(published(WITH_TARBALL), { status: 404 });
				assert.strictEqual(error.reason, "notFound");
			}),
		);

		it.effect("reads a 500 as http rather than notFound", () =>
			Effect.gen(function* () {
				const error = yield* failure(published(WITH_TARBALL), { status: 500 });
				assert.strictEqual(error.reason, "http");
				assert.strictEqual(error.status, 500);
			}),
		);

		it.effect("reads a transport failure as http", () =>
			Effect.gen(function* () {
				const error = yield* failure(published(WITH_TARBALL), "transport");
				assert.strictEqual(error.reason, "http");
			}),
		);
	});

	describe("integrity verification", () => {
		it.effect("accepts bytes matching the published integrity", () =>
			Effect.gen(function* () {
				const directory = yield* success(published({ ...WITH_TARBALL, integrity: INTEGRITY }), { status: 200 });
				assert.match(directory, /\/package$/);
			}),
		);

		it.effect("fails integrityMismatch when the bytes differ, naming both hashes", () =>
			Effect.gen(function* () {
				const error = yield* failure(published({ ...WITH_TARBALL, integrity: INTEGRITY }), {
					status: 200,
					body: new TextEncoder().encode("poisoned"),
				});
				assert.strictEqual(error.reason, "integrityMismatch");
				assert.strictEqual(error.expected, INTEGRITY);
				assert.notStrictEqual(error.actual, INTEGRITY);
			}),
		);

		it.effect("NEVER reaches tar when integrity fails — the whole point of the ordering", () =>
			// A poisoned intermediary's bytes must not be unpacked. Asserting on
			// the spawn log rather than on the error makes that structural: a
			// mutant that verifies AFTER extracting still fails typed, and only
			// this assertion catches it.
			Effect.gen(function* () {
				const run = scenario({ status: 200, body: new TextEncoder().encode("poisoned") });
				yield* Effect.flip(run.extract(published({ ...WITH_TARBALL, integrity: INTEGRITY })));
				assert.deepStrictEqual(run.spawns, []);
			}),
		);

		it.effect("reports a digest that could not be COMPUTED as unverifiable, not as a mismatch", () =>
			// A mismatch is a measurement: two digests exist and differ, which is what
			// tampering looks like. A runtime refusing the algorithm (SHA-1 under a
			// FIPS-configured Node) produces no digest at all, so nothing was
			// compared. Reporting the second as the first routes a platform problem
			// into tamper handling and renders "did not match (expected X, got
			// unknown)" — evidence of an attack nobody observed. This is the same
			// class the wave fixes in PackageManagerInstaller.
			Effect.gen(function* () {
				const refusingCrypto = Layer.succeed(
					Crypto.Crypto,
					Crypto.make({
						digest: () =>
							Effect.fail(
								PlatformError.badArgument({ module: "Crypto", method: "digest", description: "algorithm refused" }),
							),
						randomBytes: (size) => new Uint8Array(size),
					}),
				);
				const spawner = scripted(() => ({ exit: 0 }));
				const layer = PackageTarball.layer.pipe(
					Layer.provide(Layer.mergeAll(spawner.layer, MemoryFileSystem.layer, refusingCrypto, http({ status: 200 }))),
				);
				const error = yield* Effect.flip(
					Effect.gen(function* () {
						const tarball = yield* PackageTarball;
						return yield* tarball.extract(published({ ...WITH_TARBALL, integrity: INTEGRITY }));
					}).pipe(Effect.scoped, Effect.provide(layer)),
				);
				assert.strictEqual(error.reason, "integrityUnverifiable");
				assert.strictEqual(error.actual, undefined, "nothing was measured, so there is no actual digest to report");
				assert.include(error.message, "never checked");
				assert.notInclude(error.message, "did not match");
				assert.deepStrictEqual(spawner.spawns, [], "an unverified tarball must still never reach tar");
			}),
		);

		it.effect("does not false-mismatch on an unpadded integrity, which the SRI grammar permits", () =>
			// Refusing a valid tarball over base64 padding would be worse than
			// the mismatch it imitates.
			Effect.gen(function* () {
				const version = published({ ...WITH_TARBALL, integrity: INTEGRITY.replace(/=+$/, "") });
				assert.match(yield* success(version, { status: 200 }), /\/package$/);
			}),
		);

		it.effect("proceeds when the registry published no integrity at all", () =>
			Effect.gen(function* () {
				assert.match(yield* success(published(WITH_TARBALL), { status: 200 }), /\/package$/);
			}),
		);
	});

	describe("extraction", () => {
		it.effect("unpacks with tar and answers the package root", () =>
			Effect.gen(function* () {
				const run = scenario({ status: 200 });
				const directory = yield* run.extract(published(WITH_TARBALL));
				assert.strictEqual(run.spawns.length, 1);
				assert.strictEqual(run.spawns[0]?.command, "tar");
				assert.include(run.spawns[0]?.args ?? [], "-xzf");
				assert.match(directory, /\/package$/);
			}),
		);

		it.effect("fails extractFailed when tar exits non-zero", () =>
			Effect.gen(function* () {
				const error = yield* failure(published(WITH_TARBALL), { status: 200 }, 1);
				assert.strictEqual(error.reason, "extractFailed");
			}),
		);
	});
});
