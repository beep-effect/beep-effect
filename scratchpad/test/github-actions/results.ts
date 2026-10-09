// This response factory is an internal test helper with a direct-call contract.
// @effect-diagnostics asyncFunction:skip-file missingPipeableSignature:skip-file
// Shared fixtures for the three services that speak the Actions results
// backend: the cache, the artifact protocol and the GitHub-cache blob store.
//
// They exist as one file because the *protocol* is one protocol — a suite that
// hand-rolled its own runtime token would be free to hand-roll one the real
// backend-id decoder rejects, and the divergence would only show up in
// production.

import { Effect, Fiber, Schema, Result } from "effect";
import { ActionEnvironment } from "../../effected/github-actions/index.ts";

const Json = Schema.fromJsonString(Schema.Unknown);

/** A base64url segment, as a JWT carries them. */
const segment = (value: unknown): string => Buffer.from(Result.getOrThrowWith(Schema.encodeResult(Json)(value), (error) => error)).toString("base64url");

/**
 * A runtime token shaped like the one the runner injects: a three-segment JWT
 * whose `scp` claim carries the `Actions.Results:<run>:<job>` scope.
 *
 * The signature segment is nonsense on purpose — nothing verifies it, and a
 * fixture that looked signed would suggest something does.
 */
export const runtimeToken = (scope = "Actions.Results:run-1:job-1"): string =>
	`${segment({ alg: "HS256", typ: "JWT" })}.${segment({ scp: scope })}.not-a-signature`;

/** The two variables the runner injects into `uses:` steps, and nothing else. */
export const RESULTS_ENV: Readonly<Record<string, string>> = {
	ACTIONS_RESULTS_URL: "https://results.example/twirpbase",
	ACTIONS_RUNTIME_TOKEN: runtimeToken(),
};

/** An `ActionEnvironment` that knows about the results backend. */
export const resultsEnv = (overrides: Readonly<Record<string, string>> = {}) =>
	ActionEnvironment.layerTest({ ...RESULTS_ENV, ...overrides });

/** One observed RPC. */
export interface Rpc {
	readonly url: string;
	readonly method: string;
	readonly body: Record<string, unknown>;
	readonly authorization: string | null;
}

/** A JSON body, as the backend answers one. */
export const json = (value: unknown, status = 200): Response =>
	new Response(Result.getOrThrowWith(Schema.encodeResult(Json)(value), (error) => error), { status, headers: { "content-type": "application/json" } });

/**
 * A `fetch` that routes on the Twirp method — the last path segment — and
 * records every call.
 *
 * @remarks
 * The handler receives the call index *for that method*, so a test can answer
 * the first `GetCacheEntryDownloadURL` differently from the second without
 * counting calls itself. An unrouted method answers 501 rather than 200, so a
 * protocol change shows up as a failure instead of a silently skipped step.
 */
export const twirpFetch = (
	handlers: Readonly<Record<string, (body: Record<string, unknown>, index: number) => Response>>,
): { readonly calls: Array<Rpc>; readonly fetch: typeof globalThis.fetch } => {
	const calls: Array<Rpc> = [];
	const fetch: typeof globalThis.fetch = Object.assign(async (input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) => {
		const url = String(input);
		const method = url.slice(url.lastIndexOf("/") + 1);
		// Decoded through `Response` rather than `String(init.body)`: the request
		// body arrives as bytes, and stringifying a Uint8Array produces `123,34,…`,
		// which throws in `JSON.parse` — inside a fake `fetch`, that surfaces as a
		// transport fault, which the client then RETRIES, which hangs the virtual
		// clock. One misread fixture presented as ten unrelated timeouts.
		const body = JSON.parse((await new Response(init?.body ?? "{}").text()) || "{}") as Record<string, unknown>;
		const index = calls.filter((call) => call.method === method).length;
		calls.push({ url, method, body, authorization: new Headers(init?.headers).get("authorization") });
		const handler = handlers[method];
		return handler === undefined ? new Response(null, { status: 501 }) : handler(body, index);
	}, { preconnect: () => {} });
	return { calls, fetch };
};

/** Run a fiber to completion while a virtual clock drives its retry sleeps. */
export const settle = Effect.fn("settle")(function*<A, E>(effect: Effect.Effect<A, E>, adjust: Effect.Effect<void>) {
		const fiber = yield* Effect.forkChild(effect);
		// Bounded rather than `while (true)`: a fiber blocked on something that is
		// not a sleep would otherwise hang to the vitest timeout with no clue why.
		for (let attempt = 0; attempt < 12 && fiber.pollUnsafe() === undefined; attempt += 1) {
			yield* adjust;
		}
		return yield* Fiber.await(fiber);
	});
