import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeBody = S.decodeUnknownResult(S.fromJsonString(S.Unknown));
const encodeBody = S.encodeUnknownResult(S.fromJsonString(S.Unknown));

/** One request the fake GitHub API served: method, path with query, and the decoded JSON body. */
export interface GithubFetchCall {
  readonly authorization: string;
  readonly body: unknown;
  readonly method: string;
  readonly path: string;
  readonly url: URL;
}

const ReplyTag: unique symbol = Symbol.for("@beep/repo-cli/test/GithubFetch/reply");

/** What a handler answers when the status is not 200. */
export interface GithubFetchReply {
  readonly body: unknown;
  readonly status: number;
  readonly [ReplyTag]: true;
}

/** A reply with an explicit HTTP status; 204 sends no body. */
export const reply =
  (status: number) =>
  (body: unknown = {}): GithubFetchReply => ({ [ReplyTag]: true, status, body });

const isReply = (value: unknown): value is GithubFetchReply => P.hasProperty(value, ReplyTag);

const UnreachableTag: unique symbol = Symbol.for("@beep/repo-cli/test/GithubFetch/unreachable");

/** An answer that makes `fetch` reject, as a request that never reaches GitHub does. */
export const unreachable = (message: string) => ({ [UnreachableTag]: message });

const isUnreachable = (value: unknown): value is ReturnType<typeof unreachable> => P.hasProperty(value, UnreachableTag);

const headerOf = (init: RequestInit | undefined, name: string): string => new Headers(init?.headers).get(name) ?? "";

const urlOf = (input: string | URL | Request): URL =>
  new URL(P.isString(input) ? input : input instanceof URL ? input.href : input.url);

const bodyOf = (init: RequestInit | undefined): unknown =>
  P.isString(init?.body) && init.body !== "" ? Result.getOrUndefined(decodeBody(init.body)) : undefined;

const callOf = (input: string | URL | Request, init: RequestInit | undefined): GithubFetchCall => {
  const url = urlOf(input);
  return {
    method: init?.method ?? "GET",
    path: `${url.pathname}${url.search}`,
    url,
    body: bodyOf(init),
    authorization: headerOf(init, "authorization"),
  };
};

const responseOf = (url: URL, answered: unknown): Response => {
  const { status, body } = isReply(answered) ? answered : { status: 200, body: answered };
  const response =
    status === 204
      ? new Response(null, { status })
      : new Response(
          Result.getOrElse(encodeBody(body), () => "null"),
          {
            status,
            headers: { "content-type": "application/json" },
          }
        );
  // A network response carries its URL; octokit's paginator reads it back.
  return Object.defineProperty(response, "url", { value: url.href });
};

/**
 * A `fetch` replacement for the `@beep/github` transport: every request is
 * recorded and answered by `respond`, so a suite exercises the real octokit
 * routing and decoding without reaching the network. A plain value answers 200;
 * {@link reply} sets another status (204 sends no body), and {@link unreachable}
 * makes the request fail before it reaches GitHub.
 */
export const githubFetch = (respond: (call: GithubFetchCall) => unknown) => {
  const calls: Array<GithubFetchCall> = [];
  const answer = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const call = callOf(input, init);
    calls.push(call);
    const answered = respond(call);
    return isUnreachable(answered)
      ? Promise.reject(new TypeError(answered[UnreachableTag]))
      : Promise.resolve(responseOf(call.url, answered));
  };
  // Bun's `fetch` type also carries `preconnect`; the transport never calls it.
  const fetch: typeof globalThis.fetch = Object.assign(answer, { preconnect: () => undefined });
  return { calls, fetch };
};
