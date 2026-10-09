// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { FetchHttpClient } from "effect/http";
import { ActionEnvironment, OidcClaims, OidcTokenIssuer } from "../../effected/github-actions/index.ts";

const Json = S.fromJsonString(S.Unknown);

const TOKEN_ENV = {
	ACTIONS_ID_TOKEN_REQUEST_TOKEN: "runner-bearer",
	ACTIONS_ID_TOKEN_REQUEST_URL: "https://token.actions.example/?api-version=2.0",
};

const CLAIMS = OidcClaims.make({
	iss: "https://token.actions.githubusercontent.com",
	ref: "refs/heads/main",
	sha: "0000000000000000000000000000000000000000",
	repository: "acme/example",
	event_name: "push",
	job_workflow_ref: "acme/example/.github/workflows/release.yml@refs/heads/main",
	workflow_ref: "acme/example/.github/workflows/release.yml@refs/heads/main",
	repository_id: "1",
	repository_owner_id: "2",
	runner_environment: "github-hosted",
	run_id: "3",
	run_attempt: "1",
});

/** A JWT whose payload is `claims`, built the way the runner would. */
const jwtFor = (claims: unknown, signature = "sig"): string => {
	const segment = (value: unknown): string => Buffer.from(Result.getOrThrowWith(S.encodeResult(Json)(value), (error) => error), "utf8").toString("base64url");
	return `${segment({ alg: "RS256", typ: "JWT" })}.${segment(claims)}.${signature}`;
};

const json = (body: unknown, init: ResponseInit = {}): Response =>
	new Response(Result.getOrThrowWith(S.encodeResult(Json)(body), (error) => error), { status: 200, headers: { "content-type": "application/json" }, ...init });

/**
 * The test seam: a fake `fetch` under the real client, so request construction,
 * status mapping and body decoding all actually run.
 */
const live = (fake: typeof globalThis.fetch, env: Record<string, string> = TOKEN_ENV) =>
	OidcTokenIssuer.layer.pipe(
		Layer.provide(
			Layer.mergeAll(
				ActionEnvironment.layerTest(env),
				FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.Fetch)(fake))),
			),
		),
	);

describe("OidcTokenIssuer", () => {
	describe("requesting a token", () => {
		it.effect("authenticates with the runner's bearer token", () =>
			Effect.gen(function* () {
				const seen: Array<{ url: string; authorization: string | null }> = [];
				const fake: typeof globalThis.fetch = Object.assign(async (input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
					seen.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
					return json({ value: jwtFor(CLAIMS) });
				}, { preconnect: () => {} });
				const token = yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).token();
				}).pipe(Effect.provide(live(fake)));

				assert.strictEqual(seen[0]?.authorization, "Bearer runner-bearer");
				assert.strictEqual(seen[0]?.url, TOKEN_ENV.ACTIONS_ID_TOKEN_REQUEST_URL);
				assert.include(Redacted.value(token), ".");
			}),
		);

		it.effect("appends the audience with & because the runner's url already has a query", () =>
			Effect.gen(function* () {
				const seen: Array<string> = [];
				const fake: typeof globalThis.fetch = Object.assign(async (input: Parameters<typeof globalThis.fetch>[0]) => {
					seen.push(String(input));
					return json({ value: jwtFor(CLAIMS) });
				}, { preconnect: () => {} });
				yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).token("sigstore");
				}).pipe(Effect.provide(live(fake)));

				// A "?" here would produce a second query string and the runner would
				// hand back a token bound to the wrong audience — or none at all.
				assert.strictEqual(seen[0], `${TOKEN_ENV.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sigstore`);
			}),
		);

		it.effect("url-encodes an audience that needs it", () =>
			Effect.gen(function* () {
				const seen: Array<string> = [];
				const fake: typeof globalThis.fetch = Object.assign(async (input: Parameters<typeof globalThis.fetch>[0]) => {
					seen.push(String(input));
					return json({ value: jwtFor(CLAIMS) });
				}, { preconnect: () => {} });
				yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).token("https://example.test/a b");
				}).pipe(Effect.provide(live(fake)));
				assert.include(seen[0] ?? "", "audience=https%3A%2F%2Fexample.test%2Fa%20b");
			}),
		);

		it.effect("sends no audience parameter at all when none is asked for", () =>
			Effect.gen(function* () {
				const seen: Array<string> = [];
				const fake: typeof globalThis.fetch = Object.assign(async (input: Parameters<typeof globalThis.fetch>[0]) => {
					seen.push(String(input));
					return json({ value: jwtFor(CLAIMS) });
				}, { preconnect: () => {} });
				yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).token();
				}).pipe(Effect.provide(live(fake)));
				// The runner's default audience is not the empty string, so an
				// `audience=` parameter would change which token comes back.
				assert.notInclude(seen[0] ?? "", "audience");
			}),
		);
	});

	describe("failure paths", () => {
		const failing = <A, E>(program: Effect.Effect<A, E, OidcTokenIssuer>, layer: Layer.Layer<OidcTokenIssuer>) =>
			Effect.flip(program.pipe(Effect.provide(layer)));

		it.effect("fails typed when the workflow did not grant id-token: write", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: jwtFor(CLAIMS) }), { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
					live(fake, {}),
				);
				assert.strictEqual(error.reason, "unavailable");
				assert.include(error.message, "id-token: write");
			}),
		);

		it.effect("fails typed on a non-2xx status, carrying it", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => new Response("nope", { status: 403 }), { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
					live(fake),
				);
				assert.strictEqual(error.reason, "requestFailed");
				assert.strictEqual(error.status, 403);
			}),
		);

		it.effect("fails typed when the transport itself fails", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => {
					throw new Error("connection reset");
				}, { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
					live(fake),
				);
				assert.strictEqual(error.reason, "requestFailed");
			}),
		);

		it.effect("fails typed when the envelope is the wrong shape", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ token: "wrong-key" }), { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
					live(fake),
				);
				assert.strictEqual(error.reason, "malformedResponse");
			}),
		);

		it.effect("fails typed when the token is not a three-segment JWT", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: "not-a-jwt" }), { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()),
					live(fake),
				);
				assert.strictEqual(error.reason, "malformedToken");
				assert.include(error.message, "three segments");
			}),
		);

		it.effect("fails typed when the payload is not base64url JSON", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: "aaa.!!!not-base64!!!.ccc" }), { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()),
					live(fake),
				);
				assert.strictEqual(error.reason, "malformedToken");
			}),
		);

		it.effect("fails typed when the claims a provenance statement needs are absent", () =>
			Effect.gen(function* () {
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: jwtFor({ iss: "https://x", ref: "main" }) }), { preconnect: () => {} });
				const error = yield* failing(
					Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()),
					live(fake),
				);
				assert.strictEqual(error.reason, "missingClaims");
			}),
		);
	});

	describe("claims", () => {
		it.effect("decodes the runner's claims without verifying the signature", () =>
			Effect.gen(function* () {
				// The signature here is deliberate nonsense. Decoding it anyway is the
				// documented choice: the token came from the runner's own endpoint over
				// TLS, and the claims populate a provenance predicate rather than a
				// trust decision.
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: jwtFor(CLAIMS, "not-a-real-signature") }), { preconnect: () => {} });
				const claims = yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).claims();
				}).pipe(Effect.provide(live(fake)));
				assert.deepStrictEqual(claims, CLAIMS);
			}),
		);

		it.effect("decodes a payload whose base64url alphabet differs from base64", () =>
			Effect.gen(function* () {
				// `~~~??>>>` encodes to segments containing `-` and `_`, the two
				// characters base64url swaps. A real GitHub token hits them constantly;
				// a corpus that never does would keep passing under a decoder that
				// rejects them.
				const urlSafe = OidcClaims.make({ ...CLAIMS, ref: "refs/heads/~~~??>>>" });
				const token = jwtFor(urlSafe);
				assert.match(token.split(".")[1] ?? "", /[-_]/, "the fixture must actually exercise the url alphabet");
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: token }), { preconnect: () => {} });
				const claims = yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).claims();
				}).pipe(Effect.provide(live(fake)));
				assert.strictEqual(claims.ref, "refs/heads/~~~??>>>");
			}),
		);

		it.effect("decodes a payload whose base64url needs padding", () =>
			Effect.gen(function* () {
				// Segment lengths that are not a multiple of four are the common case,
				// and a decoder that demands padding fails on most real tokens.
				const padded = OidcClaims.make({ ...CLAIMS, run_id: "31415926535" });
				const fake: typeof globalThis.fetch = Object.assign(async () => json({ value: jwtFor(padded) }), { preconnect: () => {} });
				const claims = yield* Effect.gen(function* () {
					return yield* (yield* OidcTokenIssuer).claims();
				}).pipe(Effect.provide(live(fake)));
				assert.strictEqual(claims.run_id, "31415926535");
			}),
		);
	});

	describe("test doubles", () => {
		it.effect("layerFor makes the provenance path reachable: the token really decodes", () =>
			Effect.gen(function* () {
				const issuer = yield* OidcTokenIssuer;
				const token = yield* issuer.token();
				// This is the whole point of the double. A consumer that decodes the
				// token ITSELF — which is what a provenance builder does — must get the
				// same claims the service reports, or the path stays untested while
				// looking tested.
				const payload = Redacted.value(token).split(".")[1] ?? "";
				const decoded = Result.getOrThrowWith(S.decodeResult(Json)(Buffer.from(payload, "base64url").toString("utf8")), (error) => error) as {
					job_workflow_ref?: string;
				};
				assert.strictEqual(decoded.job_workflow_ref, CLAIMS.job_workflow_ref);
				assert.deepStrictEqual(yield* issuer.claims(), CLAIMS);
			}).pipe(Effect.provide(OidcTokenIssuer.layerFor(CLAIMS))),
		);

		it.effect("an unstubbed member dies loudly", () =>
			Effect.gen(function* () {
				const exit = yield* Effect.exit(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
				assert.strictEqual(exit._tag, "Failure");
			}).pipe(Effect.provide(OidcTokenIssuer.layerTest())),
		);
	});
});
