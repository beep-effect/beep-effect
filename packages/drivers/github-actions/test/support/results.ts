import { ActionEnvironment } from "@beep/github-actions";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Json = S.fromJsonString(S.Unknown);
const RequestBodyJson = S.fromJsonString(S.Record(S.String, S.Unknown));

const jwtSegment = (value: unknown): string =>
  Buffer.from(Result.getOrThrowWith(S.encodeResult(Json)(value), (error) => error)).toString("base64url");

/**
 * A runtime token shaped like the one the runner injects: a three-segment JWT
 * whose `scp` claim carries the `Actions.Results:<run>:<job>` scope.
 *
 * The signature segment is nonsense on purpose — nothing verifies it, and a
 * fixture that looked signed would suggest something does.
 */
export const runtimeToken = (scope = "Actions.Results:run-1:job-1"): string =>
  `${jwtSegment({ alg: "HS256", typ: "JWT" })}.${jwtSegment({ scp: scope })}.not-a-signature`;

const USES_STEP_RUNNER_ENV: Readonly<Record<string, string>> = {
  ACTIONS_RESULTS_URL: "https://results.example/twirpbase",
  ACTIONS_RUNTIME_TOKEN: runtimeToken(),
};

/** An `ActionEnvironment` that knows about the results backend. */
export const resultsEnv = (overrides: Readonly<Record<string, string>> = {}) =>
  ActionEnvironment.layerTest({ ...USES_STEP_RUNNER_ENV, ...overrides });

/** One observed RPC. */
export interface Rpc {
  readonly authorization: string | null;
  readonly body: Record<string, unknown>;
  readonly method: string;
  readonly url: string;
}

/** A JSON body with an explicit status, as the backend answers one. */
export const jsonStatus: {
  (value: unknown, status: number): Response;
  (status: number): (value: unknown) => Response;
} = dual(
  2,
  (value: unknown, status: number): Response =>
    new Response(
      Result.getOrThrowWith(S.encodeResult(Json)(value), (error) => error),
      { status, headers: { "content-type": "application/json" } }
    )
);

/** A `200` JSON body, as the backend answers one. */
export const json = (value: unknown): Response => jsonStatus(value, 200);

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
  handlers: Readonly<Record<string, (body: Record<string, unknown>, index: number) => Response>>
): { readonly calls: Array<Rpc>; readonly fetch: typeof globalThis.fetch } => {
  const calls: Array<Rpc> = [];
  const bodyBytesAsText = (init: Parameters<typeof globalThis.fetch>[1]) => new Response(init?.body ?? "{}").text();
  const fetch: typeof globalThis.fetch = Object.assign(
    (input: Parameters<typeof globalThis.fetch>[0], init: Parameters<typeof globalThis.fetch>[1]) =>
      bodyBytesAsText(init).then((text) => {
        const url = String(input);
        const method = Str.slice(O.getOrElse(Str.lastIndexOf("/")(url), () => -1) + 1)(url);
        const body = Result.getOrThrowWith(S.decodeResult(RequestBodyJson)(text || "{}"), (error) => error);
        const index = A.filter(calls, (call) => call.method === method).length;
        calls.push({ url, method, body, authorization: new Headers(init?.headers).get("authorization") });
        const handler = handlers[method];
        return handler === undefined ? new Response(null, { status: 501 }) : handler(body, index);
      }),
    { preconnect: () => {} }
  );
  return { calls, fetch };
};

const clockAdvanceLimit = 12;

/** Run a fiber to completion while a virtual clock drives its retry sleeps. */
export const settle = Effect.fn("settle")(function* <A, E>(effect: Effect.Effect<A, E>, adjust: Effect.Effect<void>) {
  const fiber = yield* Effect.forkChild(effect);
  for (let attempt = 0; attempt < clockAdvanceLimit && fiber.pollUnsafe() === undefined; attempt += 1) {
    yield* adjust;
  }
  return yield* Fiber.await(fiber);
});
