/**
 * A recorded REST transport for `GitHubClient.layerFromToken`: each request is
 * answered by URL with JSON, a zip, or plain text, and recorded.
 *
 * @packageDocumentation
 */
import { GitHubClient } from "@beep/github/GitHubClient";
import { Repo } from "@beep/github/Repo";
import { RetryPolicy } from "@beep/github/Resilience";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";

const encodeWireJson = S.encodeUnknownResult(S.fromJsonString(S.Unknown));

/**
 * One recorded answer: a JSON body (paged with `next`), a zip, or text.
 */
export type RestReply =
  | { readonly json: unknown; readonly next?: boolean; readonly status?: number }
  | { readonly zip: Uint8Array }
  | { readonly text: string };

const responseOf = (url: URL, reply: RestReply): Response => {
  if ("zip" in reply) {
    return new Response(reply.zip, { status: 200, headers: { "content-type": "application/zip" } });
  }
  if ("text" in reply) {
    return new Response(reply.text, { status: 200, headers: { "content-type": "text/plain" } });
  }
  const next = new URL(url);
  next.searchParams.set("page", `${Number(url.searchParams.get("page") ?? "1") + 1}`);
  return new Response(Result.getOrThrow(encodeWireJson(reply.json)), {
    status: reply.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(reply.next === true ? { link: `<${next.href}>; rel="next"` } : {}),
    },
  });
};

/**
 * One recorded route: when `matches` accepts a request's URL, `reply` answers it.
 */
export type RestRoute = readonly [matches: (url: URL) => boolean, reply: (url: URL) => RestReply];

const notFound: RestReply = { json: { message: "Not Found" }, status: 404 };

/**
 * Answer a request with the first route that matches its URL, else 404.
 *
 * **Example** (One route)
 *
 * ```ts
 * import { routeTable } from "./RestRoutes.ts"
 * const respond = routeTable([[(url) => url.pathname === "/a", () => ({ text: "a" })]])
 * console.log(respond(new URL("https://api.github.com/a"))) // { text: "a" }
 * ```
 */
export const routeTable =
  (routes: ReadonlyArray<RestRoute>) =>
  (url: URL): RestReply =>
    O.match(
      A.findFirst(routes, ([matches]) => matches(url)),
      { onNone: () => notFound, onSome: ([, reply]) => reply(url) }
    );

/**
 * Answer every request through `respond` and record its URL.
 *
 * **Example** (Answer every request with an empty list)
 *
 * ```ts
 * import { restRoutes } from "./RestRoutes.ts"
 * const transport = restRoutes(() => ({ json: [] }))
 * console.log(transport.calls.length) // 0
 * ```
 */
export const restRoutes = (respond: (url: URL) => RestReply) => {
  const calls: Array<URL> = [];
  const answer = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url);
    const response = responseOf(url, respond(url));
    Object.defineProperty(response, "url", { value: url.href });
    return Promise.resolve(response);
  };
  const fetch: typeof globalThis.fetch = Object.assign(answer, { preconnect: () => undefined });
  const layer = Layer.mergeAll(
    GitHubClient.layerFromToken({ token: Redacted.make("fixture"), fetch, retry: RetryPolicy.none }),
    Repo.layerFromSlug("example/repo")
  );
  return { calls, fetch, layer };
};
/**
 * Build `layer` once in its own scope and provide the built services to an
 * effect, so each test owns exactly one transport lifecycle.
 *
 * **Example** (Provide a recorded transport)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { provideBuilt, restRoutes } from "./RestRoutes.ts"
 * const transport = restRoutes(() => ({ json: [] }))
 * const program = Effect.void.pipe(provideBuilt(transport.layer))
 * ```
 */
export const provideBuilt =
  <ROut, E2>(layer: Layer.Layer<ROut, E2>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, Exclude<Exclude<R, ROut>, Scope.Scope>> =>
    layer.pipe(
      Layer.build,
      Effect.flatMap((context) => Effect.provide(effect, context)),
      Effect.scoped
    );
