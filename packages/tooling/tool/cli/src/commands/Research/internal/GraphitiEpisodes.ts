/**
 * Best-effort Graphiti episode posting for research pipeline events.
 *
 * Talks to the local graphiti-mcp streamable-HTTP endpoint managed by
 * `beep graphiti proxy`. Episodes are events ("captured N cards"), not
 * content; if the proxy or its upstream is down the pipeline logs and moves
 * on — the vault and catalog remain the sources of truth.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Config, Console, Effect } from "effect";
import * as O from "effect/Option";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

const DEFAULT_GRAPHITI_MCP_URL = "http://127.0.0.1:8123/mcp";

const jsonRpc = (method: string, params: Record<string, unknown>, id: number): Record<string, unknown> => ({
  id,
  jsonrpc: "2.0",
  method,
  params,
});

/**
 * Post one research pipeline event as a Graphiti episode; never fails.
 *
 * @internal
 * @category utilities
 */
export const postResearchEpisode = Effect.fn("GraphitiEpisodes.postResearchEpisode")(function* (
  name: string,
  episodeBody: string
): Effect.fn.Return<void, never, HttpClient.HttpClient> {
  const attempt = Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const endpoint = yield* Config.string("GRAPHITI_MCP_URL").pipe(Config.withDefault(DEFAULT_GRAPHITI_MCP_URL));
    const post = (body: Record<string, unknown>, sessionId: O.Option<string>) =>
      client.execute(
        HttpClientRequest.post(endpoint).pipe(
          HttpClientRequest.setHeader("Accept", "application/json, text/event-stream"),
          O.match(sessionId, {
            onNone: () => (request: HttpClientRequest.HttpClientRequest) => request,
            onSome: (value) => HttpClientRequest.setHeader("Mcp-Session-Id", value),
          }),
          HttpClientRequest.bodyJsonUnsafe(body)
        )
      );

    const initResponse = yield* post(
      jsonRpc(
        "initialize",
        {
          capabilities: {},
          clientInfo: { name: "beep-research", version: "0.0.0" },
          protocolVersion: "2025-03-26",
        },
        1
      ),
      O.none()
    );
    const sessionId = O.fromNullishOr(initResponse.headers["mcp-session-id"]);
    yield* post({ jsonrpc: "2.0", method: "notifications/initialized" }, sessionId);
    yield* post(
      jsonRpc(
        "tools/call",
        {
          arguments: {
            episode_body: episodeBody,
            name,
            source: "text",
            source_description: "beep research pipeline",
          },
          name: "add_memory",
        },
        3
      ),
      sessionId
    );
  });

  yield* attempt.pipe(
    Effect.timeout("5 seconds"),
    Effect.catchCause(() => Console.log("research: graphiti episode skipped (proxy unreachable)."))
  );
});
