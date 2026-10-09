import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as FileSystem from "effect/FileSystem";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertExitFailure } from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import { NpmRegistry, PublishedVersion, RegistryReadError } from "../../effected/npm/NpmRegistry.ts";

const WireCause = S.Struct({ name: S.String, message: S.String, stack: S.String });

/** One scripted HTTP outcome. */
type Route = { readonly status: number; readonly body?: unknown; readonly raw?: string } | { readonly fail: true };

interface Stub {
	readonly layer: Layer.Layer<HttpClient.HttpClient>;
	readonly requests: ReadonlyArray<{ readonly url: string; readonly authorization: string | undefined }>;
}

const JsonBody = S.fromJsonString(S.Unknown);

/** A scripted `HttpClient` plus the log of what it was asked for. */
const stub = (route: (url: string) => Route): Stub => {
	const requests: Array<{ url: string; authorization: string | undefined }> = [];
	const layer = Layer.succeed(
		HttpClient.HttpClient,
		HttpClient.make((request, url) =>
			Effect.suspend(() => {
				requests.push({ url: url.toString(), authorization: request.headers.authorization });
				const result = route(url.toString());
				if ("fail" in result) {
					// A transport-level failure: the request never produced a response.
					return Effect.fail(
						new HttpClientError.HttpClientError({
							reason: new HttpClientError.TransportError({ request, cause: new Error("ECONNRESET") }),
						}),
					);
				}
				const body = result.raw ?? Result.getOrThrow(S.encodeResult(JsonBody)(result.body ?? {}));
				return Effect.succeed(HttpClientResponse.fromWeb(request, new Response(body, { status: result.status })));
			}),
		),
	);
	return { layer, requests };
};

const registry = Effect.service(NpmRegistry);

/** A minimal version manifest as the registry serves it. */
const versionManifest = {
	name: "pkg",
	version: "1.1.0",
	dist: { integrity: "sha512-abc123==", tarball: "https://registry.npmjs.org/pkg/-/pkg-1.1.0.tgz" },
};

/** A minimal packument. */
const packument = {
	name: "pkg",
	"dist-tags": { latest: "1.1.0", next: "2.0.0-beta.1" },
	versions: { "1.0.0": {}, "1.1.0": {}, "2.0.0-beta.1": {} },
	time: {
		created: "2020-01-01T00:00:00.000Z",
		modified: "2024-01-01T00:00:00.000Z",
		"1.0.0": "2021-01-01T00:00:00.000Z",
		"1.1.0": "2022-06-01T12:00:00.000Z",
	},
};

describe("NpmRegistry.version", () => {
	{
		const client = stub(() => ({ status: 200, body: versionManifest }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("returns the published version with its integrity and tarball", () =>
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(registry, (r) => r.version("pkg", "1.1.0"));
					assertSome(found, O.getOrThrow(found));
					assert.instanceOf(found.value, PublishedVersion);
					assert.strictEqual(found.value.version, "1.1.0");
					assert.strictEqual(found.value.integrity, "sha512-abc123==");
					assert.strictEqual(found.value.tarball, versionManifest.dist.tarball);
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 404, body: { error: "Not found" } }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a 404 is Option.none, NOT an error", () =>
				// The house None-is-success convention, extended from the resolver
				// contracts to registry reads: a version that is not published is a
				// normal branch of the publish flow, not a failure.
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(registry, (r) => r.version("pkg", "9.9.9"));
					assertNone(found);
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 500, body: {} }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("any other non-2xx fails with kind 'status', carrying the code", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(registry, (r) => r.version("pkg", "1.1.0")));
					assert.instanceOf(error, RegistryReadError);
					if (S.is(RegistryReadError)(error)) {
						assert.strictEqual(error.kind, "status");
						assert.strictEqual(error.status, 500);
						assert.strictEqual(error.package, "pkg");
					}
				}),
			);
		});
	}

	{
		const client = stub(() => ({ fail: true }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a transport failure fails with kind 'transport'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(registry, (r) => r.version("pkg", "1.1.0")));
					if (S.is(RegistryReadError)(error)) {
						assert.strictEqual(error.kind, "transport");
						assert.strictEqual(error.status, undefined);
					}
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, raw: "not json at all" }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a body that is not the expected shape fails with kind 'decode'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(Effect.flatMap(registry, (r) => r.version("pkg", "1.1.0")));
					if (S.is(RegistryReadError)(error)) {
						assert.strictEqual(error.kind, "decode");
					}
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: { name: "pkg", version: "1.1.0" } }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a version manifest with no dist block still resolves", () =>
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(registry, (r) => r.version("pkg", "1.1.0"));
					assertSome(found, O.getOrThrow(found));
					assert.strictEqual(found.value.integrity, undefined);
					assert.strictEqual(found.value.tarball, undefined);
				}),
			);
		});
	}
});

describe("NpmRegistry — the registry dimension", () => {
	{
		const client = stub(() => ({ status: 200, body: versionManifest }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("targets the default registry when none is given", () =>
				Effect.gen(function* () {
					yield* Effect.flatMap(registry, (r) => r.version("pkg", "1.1.0"));
					assert.include(client.requests[0]?.url ?? "", "registry.npmjs.org");
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: versionManifest }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("targets a per-call registry — the axis that broke the old double", () =>
				// `publish.ts` probes two registries for ONE package inside one program,
				// so the registry cannot be baked into the layer.
				Effect.gen(function* () {
					const r = yield* registry;
					yield* r.version("pkg", "1.1.0", { registry: "https://npm.pkg.github.com" });
					yield* r.version("pkg", "1.1.0", { registry: "https://registry.npmjs.org" });
					assert.include(client.requests[0]?.url ?? "", "npm.pkg.github.com");
					assert.include(client.requests[1]?.url ?? "", "registry.npmjs.org");
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: versionManifest }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("URL-encodes a scoped package name", () =>
				// `@scope/pkg` must reach the registry as `@scope%2Fpkg`; an unencoded
				// slash reads as a path segment and 404s on every scoped package.
				Effect.gen(function* () {
					yield* Effect.flatMap(registry, (r) => r.version("@effected/npm", "1.1.0"));
					assert.include(client.requests[0]?.url ?? "", "%2F");
					assert.notInclude(new URL(client.requests[0]?.url ?? "http://x").pathname, "@effected/npm");
				}),
			);
		});
	}

	it.layer(NodeFileSystem.layer, { timeout: "30 seconds" })((it) => {
		it.effect("keeps a `token` tripwire on RegistryTarget so the rename cannot fail silently", () =>
			Effect.gen(function* () {
				// Removing the field outright would be a SILENT break: callers pass it
				// through a conditional spread, and a spread of an unknown property is
				// not an excess-property error, so an authenticated probe would quietly
				// become an anonymous one — 401, read as "not published", republish.
				// Typed `never`, the same spread is a compile error. Asserted on the
				// source because the guarantee IS the type, which erases at runtime.
				const fs = yield* FileSystem.FileSystem;
				const source = yield* fs.readFileString(
					decodeURIComponent(new URL("../../effected/npm/NpmRegistry.ts", import.meta.url).pathname),
				);
				assert.include(source, "readonly token?: never;");
				assert.include(source, "@deprecated");
			}),
		);
	});

	{
		const client = stub(() => ({ status: 200, body: versionManifest }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("sends Basic, not Bearer, for a basic credential", () =>
				// The probe and the publish must agree about the scheme for one registry:
				// a bearer probe against a basic-auth registry answers 401, which this
				// service reads as "not published" — a wrong answer, not an error. The
				// blob goes out verbatim, matching what npm does with an npmrc `_auth`.
				Effect.gen(function* () {
					const r = yield* registry;
					yield* r.version("pkg", "1.1.0", {
						credential: { kind: "basic", encoded: Redacted.make("dXNlcjpwYXNz") },
					});
					assert.strictEqual(client.requests[0]?.authorization, "Basic dXNlcjpwYXNz");
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: versionManifest }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("sends a bearer token when one is supplied, and none when not", () =>
				Effect.gen(function* () {
					const r = yield* registry;
					yield* r.version("pkg", "1.1.0");
					yield* r.version("pkg", "1.1.0", { credential: { kind: "token", token: Redacted.make("s3cr3t") } });
					assert.strictEqual(client.requests[0]?.authorization, undefined);
					assert.strictEqual(client.requests[1]?.authorization, "Bearer s3cr3t");
				}),
			);
		});
	}
});

describe("NpmRegistry.version — registries without the per-version endpoint", () => {
	/** A GitHub Packages packument: full version manifests under `versions`. */
	const githubPackument = {
		name: "@savvy-web/standalone-package",
		"dist-tags": { latest: "0.10.9" },
		versions: {
			"0.10.9": {
				name: "@savvy-web/standalone-package",
				version: "0.10.9",
				dist: {
					integrity: "sha512-abc123==",
					tarball: "https://npm.pkg.github.com/download/@savvy-web/standalone-package/0.10.9/deadbeef",
				},
			},
		},
	};

	/** A packument whose `versions` entries are full manifests. */
	const packumentWithManifest = {
		name: "pkg",
		"dist-tags": { latest: "1.1.0" },
		versions: { "1.1.0": versionManifest },
	};

	{
		const client = stub(() => ({ status: 200, body: githubPackument }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a github-packages target resolves through the packument, never the per-version path", () =>
				// GitHub Packages answers the per-version endpoint with 405 regardless of
				// credentials — the live failure that blocked silk-release-action's
				// publish pipeline. The kind decides the path up front: one packument
				// read, no doomed probe first.
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(registry, (r) =>
						r.version("@savvy-web/standalone-package", "0.10.9", {
							registry: "https://npm.pkg.github.com",
							credential: { kind: "token", token: Redacted.make("ghp_token") },
						}),
					);
					assertSome(found, O.getOrThrow(found));
					assert.strictEqual(found.value.name, "@savvy-web/standalone-package");
					assert.strictEqual(found.value.version, "0.10.9");
					assert.strictEqual(found.value.integrity, "sha512-abc123==");
					assert.strictEqual(client.requests.length, 1);
					// The builder's full-name encoding (`%40scope%2Fname`) — probed live:
					// GitHub Packages answers 401 (auth wall, path recognized) for both
					// this form and the literal-`@` form.
					assert.strictEqual(client.requests[0]?.url, "https://npm.pkg.github.com/%40savvy-web%2Fstandalone-package");
					assert.isFalse(client.requests.some((request) => request.url.includes("0.10.9")));
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: githubPackument }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a github-packages version absent from the packument is Option.none", () =>
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(registry, (r) =>
						r.version("@savvy-web/standalone-package", "9.9.9", { registry: "https://npm.pkg.github.com" }),
					);
					assertNone(found);
				}),
			);
		});
	}

	{
		const client = stub((url) =>
			url.includes(encodeURIComponent("1.1.0")) ? { status: 405 } : { status: 200, body: packumentWithManifest },
		);
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("any other registry answering 405 on the per-version path retries through the packument", () =>
				// The generic fallback for custom registries with the same limitation:
				// the per-version probe is attempted first, and only a 405 reroutes.
				Effect.gen(function* () {
					const found = yield* Effect.flatMap(registry, (r) =>
						r.version("pkg", "1.1.0", { registry: "https://registry.example.com" }),
					);
					assertSome(found, O.getOrThrow(found));
					assert.strictEqual(found.value.version, "1.1.0");
					assert.strictEqual(client.requests.length, 2);
					assert.include(client.requests[0]?.url ?? "", "1.1.0");
					assert.strictEqual(client.requests[1]?.url, "https://registry.example.com/pkg");
				}),
			);
		});
	}

	{
		const client = stub(() => ({
			status: 200,
			body: { versions: { "0.10.9": "not a manifest" } },
		}));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a packument entry that is not a version manifest fails with kind 'decode'", () =>
				Effect.gen(function* () {
					const error = yield* Effect.flip(
						Effect.flatMap(registry, (r) => r.version("pkg", "0.10.9", { registry: "https://npm.pkg.github.com" })),
					);
					assert.instanceOf(error, RegistryReadError);
					if (S.is(RegistryReadError)(error)) {
						assert.strictEqual(error.kind, "decode");
					}
				}),
			);
		});
	}
});

describe("NpmRegistry.versions / distTags", () => {
	{
		const client = stub(() => ({ status: 200, body: packument }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("versions lists every published version", () =>
				Effect.gen(function* () {
					const versions = yield* Effect.flatMap(registry, (r) => r.versions("pkg"));
					assert.deepStrictEqual([...versions], ["1.0.0", "1.1.0", "2.0.0-beta.1"]);
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: packument }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("distTags returns the tag map", () =>
				Effect.gen(function* () {
					const tags = yield* Effect.flatMap(registry, (r) => r.distTags("pkg"));
					assert.deepStrictEqual(tags, { latest: "1.1.0", next: "2.0.0-beta.1" });
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 404, body: {} }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("an unpublished package is Option.none for versions too", () =>
				Effect.gen(function* () {
					const versions = yield* Effect.flatMap(registry, (r) => r.versions("nope"));
					assert.deepStrictEqual([...versions], []);
				}),
			);
		});
	}
});

describe("NpmRegistry.publishTimes", () => {
	{
		const client = stub(() => ({ status: 200, body: packument }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("returns per-version timestamps and DROPS created/modified", () =>
				// The registry's `time` object mixes per-version timestamps with two
				// non-version keys. Every consumer that reads it raw re-derives this
				// exclusion; here it is the schema's job.
				Effect.gen(function* () {
					const times = yield* Effect.flatMap(registry, (r) => r.publishTimes("pkg"));
					assert.deepStrictEqual(
						times.map((t) => t.version),
						["1.0.0", "1.1.0"],
					);
					const found = times.find((t) => t.version === "1.1.0");
					assert.strictEqual(
						found === undefined ? "" : DateTime.formatIso(found.publishedAt),
						"2022-06-01T12:00:00.000Z",
					);
				}),
			);
		});
	}

	{
		const client = stub(() => ({
			status: 200,
			body: { ...packument, time: { "1.0.0": "not-a-date", "1.1.0": "2022-06-01T12:00:00.000Z" } },
		}));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("drops a version whose timestamp does not parse rather than failing", () =>
				Effect.gen(function* () {
					const times = yield* Effect.flatMap(registry, (r) => r.publishTimes("pkg"));
					assert.deepStrictEqual(
						times.map((t) => t.version),
						["1.1.0"],
					);
				}),
			);
		});
	}

	{
		const client = stub(() => ({ status: 200, body: { name: "pkg", "dist-tags": {}, versions: {} } }));
		it.layer(NpmRegistry.layer.pipe(Layer.provide(client.layer)), { timeout: "30 seconds" })((it) => {
			it.effect("a package with no time block yields no timestamps", () =>
				Effect.gen(function* () {
					const times = yield* Effect.flatMap(registry, (r) => r.publishTimes("pkg"));
					assert.lengthOf(times, 0);
				}),
			);
		});
	}
});

describe("NpmRegistry test doubles", () => {
	it.layer(NpmRegistry.layerTest({ distTags: () => Effect.succeed({ latest: "9.9.9" }) }), { timeout: "30 seconds" })(
		(it) => {
			it.effect("layerTest answers a stubbed member", () =>
				Effect.gen(function* () {
					const r = yield* NpmRegistry;
					const tags = yield* r.distTags("pkg");
					assert.deepStrictEqual(tags, { latest: "9.9.9" });
				}),
			);
		},
	);

	it.layer(NpmRegistry.layerTest(), { timeout: "30 seconds" })((it) => {
		it.effect("an unstubbed member dies loudly rather than lying", () =>
			Effect.gen(function* () {
				const r = yield* NpmRegistry;
				const exit = yield* Effect.exit(r.versions("pkg"));
				assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.die(undefined));
				assert.isTrue(exit.cause.reasons.some((reason) => reason._tag === "Die"));
			}),
		);
	});

	it.layer(
		NpmRegistry.layerSeeded({
			registries: {
				"https://registry.npmjs.org": {
					pkg: {
						"1.0.0": { integrity: "sha512-old==", tarball: "https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz" },
						"1.1.0": { integrity: "sha512-new==", tarball: "https://registry.npmjs.org/pkg/-/pkg-1.1.0.tgz" },
					},
				},
			},
		}),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layerSeeded keys by (registry, package, version) — the shape that broke twice", () =>
			// One package, two registries, two versions: the old double could express
			// none of these three distinctions.
			Effect.gen(function* () {
				const r = yield* NpmRegistry;
				const onNpm = yield* r.version("pkg", "1.1.0", { registry: "https://registry.npmjs.org" });
				const onGitHub = yield* r.version("pkg", "1.1.0", { registry: "https://npm.pkg.github.com" });
				const otherVersion = yield* r.version("pkg", "1.0.0", { registry: "https://registry.npmjs.org" });

				assertSome(onNpm, O.getOrThrow(onNpm));
				assertNone(onGitHub);
				assertSome(otherVersion, O.getOrThrow(otherVersion));
				assert.notStrictEqual(onNpm.value.tarball, otherVersion.value.tarball, "distinct tarballs per version");
			}),
		);
	});

	it.layer(
		NpmRegistry.layerSeeded({
			registries: {
				"https://registry.npmjs.org": {
					pkg: {
						"1.0.0": { publishedAt: "2021-01-01T00:00:00.000Z" },
						"1.1.0": {},
					},
				},
			},
			distTags: { pkg: { latest: "1.1.0" } },
		}),
		{ timeout: "30 seconds" },
	)((it) => {
		it.effect("layerSeeded derives versions, distTags and publishTimes from the same seed", () =>
			Effect.gen(function* () {
				const r = yield* NpmRegistry;
				assert.deepStrictEqual([...(yield* r.versions("pkg"))], ["1.0.0", "1.1.0"]);
				assert.deepStrictEqual(yield* r.distTags("pkg"), { latest: "1.1.0" });
				const times = yield* r.publishTimes("pkg");
				assert.deepStrictEqual(
					times.map((t) => t.version),
					["1.0.0"],
				);
			}),
		);
	});
});

describe("RegistryReadError encoding", () => {
	it.effect("preserves the originating cause stack", () =>
		Effect.gen(function* () {
			const cause = new Error("registry encode probe");
			const encoded = yield* S.encodeEffect(RegistryReadError)(
				RegistryReadError.make({ kind: "transport", package: "pkg", registry: "https://registry.npmjs.org", cause }),
			);
			const wireCause = yield* S.decodeUnknownEffect(WireCause)(encoded.cause);
			assert.strictEqual(wireCause.name, cause.name);
			assert.strictEqual(wireCause.message, cause.message);
			assert.strictEqual(wireCause.stack, cause.stack);
		}),
	);
});
