import { assert, describe, it } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { FetchHttpClient } from "effect/http";
import { ActionEnvironment, OidcClaims, OidcTokenIssuer } from "../../effected/github-actions/index.ts";
import { UnstubbedMemberError } from "../../effected/github-actions/internal/unstubbed.ts";

const Json = S.fromJsonString(S.Unknown);
const WorkflowClaim = S.Struct({ job_workflow_ref: S.optionalKey(S.String) });

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
		{
			const seen: Array<{ url: string; authorization: string | null }> = [];
			const fake: typeof globalThis.fetch = Object.assign((input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
				seen.push({ url: String(input), authorization: new Headers(init?.headers).get("authorization") });
				return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
			}, { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("authenticates with the runner's bearer token", () =>
					Effect.gen(function* () {
						const token = yield* (yield* OidcTokenIssuer).token();

						assert.strictEqual(seen[0]?.authorization, "Bearer runner-bearer");
						assert.strictEqual(seen[0]?.url, TOKEN_ENV.ACTIONS_ID_TOKEN_REQUEST_URL);
						assert.include(Redacted.value(token), ".");
					}),
				);
			});
		}

		{
			const seen: Array<string> = [];
			const fake: typeof globalThis.fetch = Object.assign((input: Parameters<typeof globalThis.fetch>[0]) => {
				seen.push(String(input));
				return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
			}, { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("appends the audience with & because the runner's url already has a query", () =>
					Effect.gen(function* () {
						yield* (yield* OidcTokenIssuer).token("sigstore");

						// A "?" here would produce a second query string and the runner would
						// hand back a token bound to the wrong audience — or none at all.
						assert.strictEqual(seen[0], `${TOKEN_ENV.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sigstore`);
					}),
				);
			});
		}

		{
			const seen: Array<string> = [];
			const fake: typeof globalThis.fetch = Object.assign((input: Parameters<typeof globalThis.fetch>[0]) => {
				seen.push(String(input));
				return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
			}, { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("url-encodes an audience that needs it", () =>
					Effect.gen(function* () {
						yield* (yield* OidcTokenIssuer).token("https://example.test/a b");
						assert.include(seen[0] ?? "", "audience=https%3A%2F%2Fexample.test%2Fa%20b");
					}),
				);
			});
		}

		{
			const seen: Array<string> = [];
			const fake: typeof globalThis.fetch = Object.assign((input: Parameters<typeof globalThis.fetch>[0]) => {
				seen.push(String(input));
				return Promise.resolve(json({ value: jwtFor(CLAIMS) }));
			}, { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("sends no audience parameter at all when none is asked for", () =>
					Effect.gen(function* () {
						yield* (yield* OidcTokenIssuer).token();
						// The runner's default audience is not the empty string, so an
						// `audience=` parameter would change which token comes back.
						assert.notInclude(seen[0] ?? "", "audience");
					}),
				);
			});
		}
	});

	describe("failure paths", () => {
		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: jwtFor(CLAIMS) })), { preconnect: () => {} });

			it.layer(live(fake, {}), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the workflow did not grant id-token: write", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
						);
						assert.strictEqual(error.reason, "unavailable");
						assert.include(error.message, "id-token: write");
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(new Response("nope", { status: 403 })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed on a non-2xx status, carrying it", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
						);
						assert.strictEqual(error.reason, "requestFailed");
						assert.strictEqual(error.status, 403);
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.reject(new Error("connection reset")), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the transport itself fails", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
						);
						assert.strictEqual(error.reason, "requestFailed");
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ token: "wrong-key" })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the envelope is the wrong shape", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()),
						);
						assert.strictEqual(error.reason, "malformedResponse");
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: "not-a-jwt" })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the token is not a three-segment JWT", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()),
						);
						assert.strictEqual(error.reason, "malformedToken");
						assert.include(error.message, "three segments");
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: "aaa.!!!not-base64!!!.ccc" })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the payload is not base64url JSON", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()),
						);
						assert.strictEqual(error.reason, "malformedToken");
					}),
				);
			});
		}

		{
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: jwtFor({ iss: "https://x", ref: "main" }) })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("fails typed when the claims a provenance statement needs are absent", () =>
					Effect.gen(function* () {
						const error = yield* Effect.flip(
							Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.claims()),
						);
						assert.strictEqual(error.reason, "missingClaims");
					}),
				);
			});
		}
	});

	describe("claims", () => {
		{
			// The signature here is deliberate nonsense. Decoding it anyway is the
			// documented choice: the token came from the runner's own endpoint over
			// TLS, and the claims populate a provenance predicate rather than a
			// trust decision.
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: jwtFor(CLAIMS, "not-a-real-signature") })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("decodes the runner's claims without verifying the signature", () =>
					Effect.gen(function* () {
						const claims = yield* (yield* OidcTokenIssuer).claims();
						assert.deepStrictEqual(claims, CLAIMS);
					}),
				);
			});
		}

		{
			// `~~~??>>>` encodes to segments containing `-` and `_`, the two
			// characters base64url swaps. A real GitHub token hits them constantly;
			// a corpus that never does would keep passing under a decoder that
			// rejects them.
			const urlSafe = OidcClaims.make({ ...CLAIMS, ref: "refs/heads/~~~??>>>" });
			const token = jwtFor(urlSafe);
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: token })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("decodes a payload whose base64url alphabet differs from base64", () =>
					Effect.gen(function* () {
						assert.match(token.split(".")[1] ?? "", /[-_]/, "the fixture must actually exercise the url alphabet");
						const claims = yield* (yield* OidcTokenIssuer).claims();
						assert.strictEqual(claims.ref, "refs/heads/~~~??>>>");
					}),
				);
			});
		}

		{
			// Segment lengths that are not a multiple of four are the common case,
			// and a decoder that demands padding fails on most real tokens.
			const padded = OidcClaims.make({ ...CLAIMS, run_id: "31415926535" });
			const fake: typeof globalThis.fetch = Object.assign(() => Promise.resolve(json({ value: jwtFor(padded) })), { preconnect: () => {} });

			it.layer(live(fake), { timeout: "30 seconds" })((it) => {
				it.effect("decodes a payload whose base64url needs padding", () =>
					Effect.gen(function* () {
						const claims = yield* (yield* OidcTokenIssuer).claims();
						assert.strictEqual(claims.run_id, "31415926535");
					}),
				);
			});
		}
	});

	describe("test doubles", () => {
		{
			it.layer(OidcTokenIssuer.layerFor(CLAIMS), { timeout: "30 seconds" })((it) => {
				it.effect("layerFor makes the provenance path reachable: the token really decodes", () =>
					Effect.gen(function* () {
						const issuer = yield* OidcTokenIssuer;
						const token = yield* issuer.token();
						// This is the whole point of the double. A consumer that decodes the
						// token ITSELF — which is what a provenance builder does — must get the
						// same claims the service reports, or the path stays untested while
						// looking tested.
						const payload = Redacted.value(token).split(".")[1] ?? "";
						const decoded = Result.getOrThrowWith(S.decodeResult(Json)(Buffer.from(payload, "base64url").toString("utf8")), (error) => error);
						if (!S.is(WorkflowClaim)(decoded)) {
							assert.fail("expected workflow claims");
						}
						assert.strictEqual(decoded.job_workflow_ref, CLAIMS.job_workflow_ref);
						assert.deepStrictEqual(yield* issuer.claims(), CLAIMS);
					}),
				);
			});
		}

		{
			it.layer(OidcTokenIssuer.layerTest(), { timeout: "30 seconds" })((it) => {
				it.effect("an unstubbed member dies loudly", () =>
					Effect.gen(function* () {
						const exit = yield* Effect.exit(Effect.flatMap(OidcTokenIssuer, (issuer) => issuer.token()));
						assertExitFailure(exit, Cause.die(UnstubbedMemberError.make({
							message: "OidcTokenIssuer.makeTest: token() was called but not stubbed — pass a `token` override.",
						})));
					}),
				);
			});
		}
	});
});
