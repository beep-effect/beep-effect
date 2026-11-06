import * as Result from "effect/Result";
import * as S from "effect/Schema";

const encodeWireJson = S.encodeUnknownResult(S.fromJsonString(S.Unknown));

/**
 * A page or refusal returned by the recorded completion transport.
 * @category models
 * @since 0.0.0
 */
export interface CompletionReply {
  readonly body: unknown;
  readonly next?: boolean;
  readonly status?: number;
}
/**
 * Exercise the real GitHub paginator, including its Link-header handling.
 *
 * **Example** (Record an empty collection)
 * ```ts
 * import { completionFetch } from "./CompletionFetch.ts"
 * const transport = completionFetch(() => ({ body: [] }))
 * console.log(transport.calls.length) // 0 until the client reads
 * ```
 * @category testing
 * @since 0.0.0
 */
export const completionFetch = (respond: (url: URL) => CompletionReply) => {
  const calls: Array<URL> = [];
  const answer = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    calls.push(url);
    const reply = respond(url);
    const next = new URL(url);
    next.searchParams.set("page", `${Number(url.searchParams.get("page") ?? "1") + 1}`);
    const body = Result.getOrThrow(encodeWireJson(reply.body));
    const response = new Response(body, {
      status: reply.status ?? 200,
      headers: {
        "content-type": "application/json",
        ...(reply.next === true ? { link: `<${next.href}>; rel="next"` } : {}),
      },
    });
    Object.defineProperty(response, "url", { value: url.href });
    return Promise.resolve(response);
  };
  const fetch: typeof globalThis.fetch = Object.assign(answer, { preconnect: () => undefined });
  return { calls, fetch };
};
