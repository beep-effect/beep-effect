import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { TarballError } from "../../effected/npm/index.ts";
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
			Effect.promise(() =>
				globalThis.crypto.subtle.digest(algorithm, data.slice()).then((buffer) => new Uint8Array(buffer)),
			),
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
	Result.getOrThrow(S.decodeResult(PublishedVersion)({ name: "some-pkg", version: "1.2.3", ...fields }));

const WITH_TARBALL = { tarball: "https://registry.test/some-pkg/-/some-pkg-1.2.3.tgz" };

/** Build the layer and the spawn log for one scripted scenario. */
const scenario = (response: { status: number; body?: Uint8Array } | "transport", tarExit = 0) => {
	const spawner = scripted(() => ({ exit: tarExit }));
	const layer = PackageTarball.layer.pipe(
		Layer.provide(Layer.mergeAll(spawner.layer, MemoryFileSystem.layer, liveCrypto, http(response))),
	);
	return { layer, spawns: spawner.spawns };
};

/** Extract under the layer and scope owned by this test's runner. */
const extract = Effect.fn("extract")(function* (version: PublishedVersion) {
	const tarball = yield* PackageTarball;
	return yield* tarball.extract(version);
});

describe("PackageTarball", () => {
	describe("the notFound discriminant", () => {
		{
			const fixture = scenario({ status: 200 });
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("fails notFound when the registry recorded no tarball", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(extract(published({})));
						assert.strictEqual(error.reason, "notFound");
					}),
				);
			});
		}

		{
			const fixture = scenario({ status: 404 });
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("reads a 404 as notFound, not as a transport failure", () =>
					// The split the consumer asked for: "this version does not exist" must
					// be distinguishable from "something went wrong fetching one that
					// does", because the two warrant opposite recovery.
					Effect.gen(function* () {
						const error = yield* Effect.flip(extract(published(WITH_TARBALL)));
						assert.strictEqual(error.reason, "notFound");
					}),
				);
			});
		}

		{
			const fixture = scenario({ status: 500 });
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("reads a 500 as http rather than notFound", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(extract(published(WITH_TARBALL)));
						assert.strictEqual(error.reason, "http");
						assert.strictEqual(error.status, 500);
					}),
				);
			});
		}

		{
			const fixture = scenario("transport");
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("reads a transport failure as http", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(extract(published(WITH_TARBALL)));
						assert.strictEqual(error.reason, "http");
					}),
				);
			});
		}
	});

	describe("integrity verification", () => {
		{
			const fixture = scenario({ status: 200 });
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("accepts bytes matching the published integrity", () =>
					Effect.gen(function* () {
						const directory = yield* extract(published({ ...WITH_TARBALL, integrity: INTEGRITY }));
						assert.match(directory, /\/package$/);
					}),
				);
			});
		}

		{
			const fixture = scenario({
				status: 200,
				body: new TextEncoder().encode("poisoned"),
			});
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("fails integrityMismatch when the bytes differ, naming both hashes", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(extract(published({ ...WITH_TARBALL, integrity: INTEGRITY })));
						assert.strictEqual(error.reason, "integrityMismatch");
						assert.strictEqual(error.expected, INTEGRITY);
						assert.notStrictEqual(error.actual, INTEGRITY);
					}),
				);
			});
		}

		{
			const run = scenario({ status: 200, body: new TextEncoder().encode("poisoned") });
			it.layer(run.layer, { timeout: "30 seconds" })((it) => {
				it.effect("NEVER reaches tar when integrity fails — the whole point of the ordering", () =>
					// A poisoned intermediary's bytes must not be unpacked. Asserting on
					// the spawn log rather than on the error makes that structural: a
					// mutant that verifies AFTER extracting still fails typed, and only
					// this assertion catches it.
					Effect.gen(function* () {
						yield* Effect.flip(extract(published({ ...WITH_TARBALL, integrity: INTEGRITY })));
						assert.deepStrictEqual(run.spawns, []);
					}),
				);
			});
		}

		{
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
			it.layer(layer, { timeout: "30 seconds" })((it) => {
				it.effect("reports a digest that could not be COMPUTED as unverifiable, not as a mismatch", () =>
					// A mismatch is a measurement: two digests exist and differ, which is what
					// tampering looks like. A runtime refusing the algorithm (SHA-1 under a
					// FIPS-configured Node) produces no digest at all, so nothing was
					// compared. Reporting the second as the first routes a platform problem
					// into tamper handling and renders "did not match (expected X, got
					// unknown)" — evidence of an attack nobody observed. This is the same
					// class the wave fixes in PackageManagerInstaller.
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.gen(function* () {
								const tarball = yield* PackageTarball;
								return yield* tarball.extract(published({ ...WITH_TARBALL, integrity: INTEGRITY }));
							}),
						);
						assert.strictEqual(error.reason, "integrityUnverifiable");
						assert.strictEqual(error.actual, undefined, "nothing was measured, so there is no actual digest to report");
						assert.include(error.message, "never checked");
						assert.notInclude(error.message, "did not match");
						assert.deepStrictEqual(spawner.spawns, [], "an unverified tarball must still never reach tar");
					}),
				);
			});
		}

		{
			const fixture = scenario({ status: 200 });
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("does not false-mismatch on an unpadded integrity, which the SRI grammar permits", () =>
					// Refusing a valid tarball over base64 padding would be worse than
					// the mismatch it imitates.
					Effect.gen(function* () {
						const version = published({ ...WITH_TARBALL, integrity: INTEGRITY.replace(/=+$/, "") });
						assert.match(yield* extract(version), /\/package$/);
					}),
				);
			});
		}

		{
			const fixture = scenario({ status: 200 });
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("proceeds when the registry published no integrity at all", () =>
					Effect.gen(function* () {
						assert.match(yield* extract(published(WITH_TARBALL)), /\/package$/);
					}),
				);
			});
		}
	});

	describe("extraction", () => {
		{
			const run = scenario({ status: 200 });
			it.layer(run.layer, { timeout: "30 seconds" })((it) => {
				it.effect("unpacks with tar and answers the package root", () =>
					Effect.gen(function* () {
						const directory = yield* extract(published(WITH_TARBALL));
						assert.strictEqual(run.spawns.length, 1);
						assert.strictEqual(run.spawns[0]?.command, "tar");
						assert.include(run.spawns[0]?.args ?? [], "-xzf");
						assert.match(directory, /\/package$/);
					}),
				);
			});
		}

		{
			const fixture = scenario({ status: 200 }, 1);
			it.layer(fixture.layer, { timeout: "30 seconds" })((it) => {
				it.effect("fails extractFailed when tar exits non-zero", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(extract(published(WITH_TARBALL)));
						assert.strictEqual(error.reason, "extractFailed");
					}),
				);
			});
		}
	});
});

describe("TarballError facade", () => {
	it.effect("encodes the originating cause stack and preserves cause optionality", () =>
		Effect.gen(function* () {
			const cause = new Error("download failed");
			const stack = cause.stack;
			if (stack === undefined) assert.fail("expected the originating Error stack");
			const encoded = yield* S.encodeEffect(TarballError)(
				TarballError.make({ reason: "http", package: "pkg", version: "1.0.0", cause }),
			);
			assert.deepStrictEqual(encoded.cause, { name: cause.name, message: cause.message, stack });
			const withoutCause = yield* S.encodeEffect(TarballError)(
				TarballError.make({ reason: "notFound", package: "pkg", version: "1.0.0" }),
			);
			assert.isFalse("cause" in withoutCause);
		}),
	);

	it.effect("keeps compatible payloads on the facade while messages use their reason's fields", () =>
		Effect.gen(function* () {
			const input = {
				_tag: "TarballError" as const,
				reason: "notFound" as const,
				package: "pkg",
				version: "1.0.0",
				status: 404,
				expected: "irrelevant",
				actual: "irrelevant",
				cause: "irrelevant",
			};
			const error = yield* S.decodeEffect(TarballError)(input);
			assert.strictEqual(error.message, "No published tarball for pkg@1.0.0");
			assert.deepStrictEqual(yield* S.encodeEffect(TarballError)(error), input);
			assert.strictEqual(
				TarballError.make({ reason: "http", package: "pkg", version: "1.0.0" }).message,
				"Could not download the tarball for pkg@1.0.0",
			);
			assert.strictEqual(
				TarballError.make({ reason: "integrityMismatch", package: "pkg", version: "1.0.0" }).message,
				"The tarball for pkg@1.0.0 did not match the integrity the registry published (expected unknown, got unknown)",
			);
			assert.strictEqual(
				TarballError.make({ reason: "integrityUnverifiable", package: "pkg", version: "1.0.0" }).message,
				"Could not compute a digest to verify pkg@1.0.0, so its integrity was never checked (expected unknown)",
			);
			assert.strictEqual(
				TarballError.make({ reason: "extractFailed", package: "pkg", version: "1.0.0" }).message,
				"Could not extract the tarball for pkg@1.0.0",
			);
		}),
	);
});
