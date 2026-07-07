import {
  backupDirectoryNameFromEpochMillisForTesting,
  GraphitiProxyConfig,
  GraphitiProxyOpsError,
  isFastMcpRequestBody,
  makeGraphitiProxyForwarderService,
  ProxyServiceConfig,
  readRequestBodyBytesForTesting,
  renderProxyServiceUnitForTesting,
  resolveGraphitiStackDirForTesting,
  shouldInstallProxyServiceForTesting,
  shouldRecoverGraphitiStackForTesting,
} from "@beep/repo-cli/test/Graphiti";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Config, Duration, Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  HttpClient,
  HttpClientError,
  HttpClientResponse,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";

const makeWebHandlerClient = (handler: (request: Request) => Promise<Response>) =>
  HttpClient.make((request, url) =>
    Effect.tryPromise({
      try: () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const response = yield* Effect.promise(() =>
              Promise.resolve(
                handler(
                  new Request(url.toString(), {
                    method: request.method,
                    headers: request.headers,
                  })
                )
              )
            );
            return HttpClientResponse.fromWeb(request, response);
          })
        ),
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        }),
    })
  );

const makeProxyConfig = () =>
  GraphitiProxyConfig.make({
    upstream: "http://127.0.0.1:8000/mcp",
    dependencyHealthEnabled: false,
  });

const makeServerRequest = (url: string) => HttpServerRequest.fromWeb(new Request(`http://proxy.local${url}`));
const readResponseText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.promise(() => HttpServerResponse.toWeb(response).text());
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const utf8Encoder = new TextEncoder();
const provideWebHandlerClient =
  (handler: (request: Request) => Promise<Response>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, HttpClient.HttpClient>> =>
    effect.pipe(Effect.provideService(HttpClient.HttpClient, makeWebHandlerClient(handler)));

layer(NodeServices.layer)("Graphiti proxy security", (it) => {
  it.effect(
    "keeps proxy ops error optional fields at the command boundary",
    Effect.fn(function* () {
      const emptyError = GraphitiProxyOpsError.new(new Error("cause"), "failed");
      expect(emptyError.command).toBeUndefined();
      expect(emptyError.exitCode).toBeUndefined();

      const detailedError = GraphitiProxyOpsError.new(new Error("cause"), "failed", {
        command: "docker compose up",
        exitCode: 17,
      });
      expect(detailedError.command).toBe("docker compose up");
      expect(detailedError.exitCode).toBe(17);
    })
  );

  it.effect(
    "forwards the configured /mcp endpoint subtree and preserves query parameters",
    Effect.fn(function* () {
      let capturedUrl = "";
      const forwarder = makeGraphitiProxyForwarderService(makeProxyConfig());
      const response = yield* forwarder.forward(makeServerRequest("/mcp?cursor=abc")).pipe(
        provideWebHandlerClient((request) => {
          capturedUrl = request.url;
          return Promise.resolve(new Response("ok", { status: 200 }));
        })
      );

      expect(capturedUrl).toBe("http://127.0.0.1:8000/mcp?cursor=abc");
      expect(response.status).toBe(200);
      const responseText = yield* readResponseText(response);
      expect(responseText).toBe("ok");
    })
  );

  it.effect(
    "forwards nested MCP subpaths under the configured endpoint",
    Effect.fn(function* () {
      let capturedUrl = "";
      const forwarder = makeGraphitiProxyForwarderService(makeProxyConfig());
      const response = yield* forwarder.forward(makeServerRequest("/mcp/resources?cursor=abc")).pipe(
        provideWebHandlerClient((request) => {
          capturedUrl = request.url;
          return Promise.resolve(new Response("nested", { status: 200 }));
        })
      );

      expect(capturedUrl).toBe("http://127.0.0.1:8000/mcp/resources?cursor=abc");
      expect(response.status).toBe(200);
      const responseText = yield* readResponseText(response);
      expect(responseText).toBe("nested");
    })
  );

  it.effect(
    "normalizes trailing slashes on the configured upstream endpoint before forwarding",
    Effect.fn(function* () {
      let capturedUrl = "";
      const forwarder = makeGraphitiProxyForwarderService(
        GraphitiProxyConfig.make({
          upstream: "http://127.0.0.1:8000/mcp/",
          dependencyHealthEnabled: false,
        })
      );
      const response = yield* forwarder.forward(makeServerRequest("/mcp?cursor=abc")).pipe(
        provideWebHandlerClient((request) => {
          capturedUrl = request.url;
          return Promise.resolve(new Response("normalized", { status: 200 }));
        })
      );

      expect(capturedUrl).toBe("http://127.0.0.1:8000/mcp?cursor=abc");
      expect(response.status).toBe(200);
      const responseText = yield* readResponseText(response);
      expect(responseText).toBe("normalized");
    })
  );

  it.effect(
    "returns streaming upstream responses without waiting for the body to close",
    Effect.fn(function* () {
      const forwarder = makeGraphitiProxyForwarderService(makeProxyConfig());
      const result = yield* forwarder.forward(makeServerRequest("/mcp")).pipe(
        Effect.provideService(
          HttpClient.HttpClient,
          makeWebHandlerClient(() => {
            const body = new ReadableStream<Uint8Array>({
              start: (controller) => {
                controller.enqueue(new TextEncoder().encode("event: message\ndata: {}\n\n"));
              },
            });

            return Promise.resolve(
              new Response(body, {
                status: 200,
                headers: {
                  "content-type": "text/event-stream",
                },
              })
            );
          })
        ),
        Effect.timeoutOption(Duration.millis(250))
      );

      expect(O.isSome(result)).toBe(true);
      if (O.isSome(result)) {
        expect(result.value.status).toBe(200);
      }
    })
  );

  it.effect(
    "classifies startup and status MCP bodies for the fast lane",
    Effect.fn(function* () {
      const slowBody = yield* encodeJson({
        id: 1,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {
            query: "slow",
          },
          name: "search_memory_facts",
        },
      });
      const initializeBody = yield* encodeJson({
        id: 2,
        jsonrpc: "2.0",
        method: "initialize",
        params: {},
      });
      const statusBody = yield* encodeJson({
        id: 3,
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          arguments: {},
          name: "get_status",
        },
      });

      expect(isFastMcpRequestBody(O.some(utf8Encoder.encode(slowBody)))).toBe(false);
      expect(isFastMcpRequestBody(O.some(utf8Encoder.encode(initializeBody)))).toBe(true);
      expect(isFastMcpRequestBody(O.some(utf8Encoder.encode(statusBody)))).toBe(true);
      expect(isFastMcpRequestBody(O.none())).toBe(true);
    })
  );

  it.effect(
    "rejects alternate proxy paths before forwarding upstream",
    Effect.fn(function* () {
      let forwarded = false;
      const forwarder = makeGraphitiProxyForwarderService(makeProxyConfig());
      const response = yield* forwarder.forward(makeServerRequest("/other")).pipe(
        provideWebHandlerClient(() => {
          forwarded = true;
          return Promise.resolve(new Response("unexpected", { status: 200 }));
        })
      );

      expect(forwarded).toBe(false);
      expect(response.status).toBe(404);
      const responseText = yield* readResponseText(response);
      expect(responseText).toContain("only forwards /mcp");
    })
  );

  it.effect(
    "rejects absolute-form request targets that could override the upstream host",
    Effect.fn(function* () {
      let forwarded = false;
      const forwarder = makeGraphitiProxyForwarderService(makeProxyConfig());
      const request = makeServerRequest("/mcp").modify({ url: "https://evil.invalid/mcp" });
      const response = yield* forwarder.forward(request).pipe(
        provideWebHandlerClient(() => {
          forwarded = true;
          return Promise.resolve(new Response("unexpected", { status: 200 }));
        })
      );

      expect(forwarded).toBe(false);
      expect(response.status).toBe(400);
      const responseText = yield* readResponseText(response);
      expect(responseText).toContain("absolute-form request targets");
    })
  );

  it.effect(
    "rejects a streamed body exceeding maxBodyBytes without buffering the whole body when Content-Length is absent",
    Effect.fn(function* () {
      const maxBodyBytes = 1_024;
      const chunkBytes = 256;
      // Enough chunks to far exceed the cap; if the read were unbounded it would
      // pull every chunk (totalChunks * chunkBytes) before the size check.
      const totalChunks = 64;
      const chunk = utf8Encoder.encode("a".repeat(chunkBytes));

      let pulledBytes = 0;
      let enqueued = 0;
      const body = new ReadableStream<Uint8Array>({
        pull: (controller) => {
          if (enqueued >= totalChunks) {
            controller.close();
            return;
          }
          enqueued = enqueued + 1;
          pulledBytes = pulledBytes + chunk.length;
          controller.enqueue(chunk);
        },
      });

      // No content-length header: a chunked upload the cap must still bound.
      const request = HttpServerRequest.fromWeb(
        new Request("http://proxy.local/mcp", {
          method: "POST",
          body,
          // @ts-expect-error duplex is required for streaming request bodies on undici/Node.
          duplex: "half",
        })
      );

      const outcome = yield* readRequestBodyBytesForTesting(request, maxBodyBytes);

      expect(outcome._tag).toBe("Oversized");
      // Peak buffering stays bounded: the read stops as soon as the running total
      // crosses the cap, so it never pulls the full body into memory.
      expect(pulledBytes).toBeLessThan(totalChunks * chunkBytes);
      expect(pulledBytes).toBeLessThanOrEqual(maxBodyBytes + chunkBytes);
    })
  );

  it.effect(
    "rejects a streamed body that understates Content-Length without buffering past the cap",
    Effect.fn(function* () {
      const maxBodyBytes = 1_024;
      const chunkBytes = 256;
      const totalChunks = 64;
      const chunk = utf8Encoder.encode("b".repeat(chunkBytes));

      let pulledBytes = 0;
      let enqueued = 0;
      const body = new ReadableStream<Uint8Array>({
        pull: (controller) => {
          if (enqueued >= totalChunks) {
            controller.close();
            return;
          }
          enqueued = enqueued + 1;
          pulledBytes = pulledBytes + chunk.length;
          controller.enqueue(chunk);
        },
      });

      const request = HttpServerRequest.fromWeb(
        new Request("http://proxy.local/mcp", {
          method: "POST",
          // Understated Content-Length: the pre-check passes, so the bounded
          // streaming read must still reject the oversized body.
          headers: { "content-length": "10" },
          body,
          // @ts-expect-error duplex is required for streaming request bodies on undici/Node.
          duplex: "half",
        })
      );

      const outcome = yield* readRequestBodyBytesForTesting(request, maxBodyBytes);

      expect(outcome._tag).toBe("Oversized");
      expect(pulledBytes).toBeLessThan(totalChunks * chunkBytes);
      expect(pulledBytes).toBeLessThanOrEqual(maxBodyBytes + chunkBytes);
    })
  );

  it.effect(
    "buffers a streamed body within maxBodyBytes and returns it intact",
    Effect.fn(function* () {
      const maxBodyBytes = 1_024;
      const payload = utf8Encoder.encode("within-cap-payload");
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          controller.enqueue(payload);
          controller.close();
        },
      });

      const request = HttpServerRequest.fromWeb(
        new Request("http://proxy.local/mcp", {
          method: "POST",
          body,
          // @ts-expect-error duplex is required for streaming request bodies on undici/Node.
          duplex: "half",
        })
      );

      const outcome = yield* readRequestBodyBytesForTesting(request, maxBodyBytes);

      expect(outcome._tag).toBe("Body");
      if (outcome._tag === "Body") {
        expect(O.isSome(outcome.bodyBytes)).toBe(true);
        if (O.isSome(outcome.bodyBytes)) {
          expect(new TextDecoder("utf-8").decode(outcome.bodyBytes.value)).toBe("within-cap-payload");
        }
      }
    })
  );

  it("recovers the backing stack only when recovery is enabled and a container is unhealthy", () => {
    expect(
      shouldRecoverGraphitiStackForTesting({
        falkor: "unhealthy",
        force: false,
        graphiti: "healthy",
        recoverOnUnhealthy: true,
      })
    ).toBe(true);
    expect(
      shouldRecoverGraphitiStackForTesting({
        falkor: "healthy",
        force: false,
        graphiti: "healthy",
        recoverOnUnhealthy: true,
      })
    ).toBe(false);
    expect(
      shouldRecoverGraphitiStackForTesting({
        falkor: "unhealthy",
        force: false,
        graphiti: "healthy",
        recoverOnUnhealthy: false,
      })
    ).toBe(false);
    expect(
      shouldRecoverGraphitiStackForTesting({
        falkor: "healthy",
        force: true,
        graphiti: "healthy",
        recoverOnUnhealthy: false,
      })
    ).toBe(true);
  });

  it("resolves restore stack directory with CLI precedence over environment and default", () => {
    const expectedDefault = `${pipe(
      Effect.runSync(Config.option(Config.string("HOME"))),
      O.getOrElse(() => process.cwd())
    )}/graphiti-mcp`;

    expect(resolveGraphitiStackDirForTesting(O.some("/tmp/cli"), O.some("/tmp/env"))).toBe("/tmp/cli");
    expect(resolveGraphitiStackDirForTesting(O.none(), O.some("/tmp/env"))).toBe("/tmp/env");
    expect(resolveGraphitiStackDirForTesting(O.none(), O.none())).toBe(expectedDefault);
  });

  it("uses a stable timestamped backup directory name", () => {
    expect(backupDirectoryNameFromEpochMillisForTesting(0)).toBe("data-1970-01-01T000000000Z");
  });

  it("reinstalls the proxy service when the unit points at a stale checkout or upstream", () => {
    const currentUnit = [
      "[Service]",
      "WorkingDirectory=/repo",
      "ExecStart=/home/elpresidank/.bun/bin/bun run beep graphiti proxy",
      "Environment=GRAPHITI_PROXY_HOST=127.0.0.1",
      "Environment=GRAPHITI_PROXY_PORT=8123",
      "Environment=GRAPHITI_PROXY_UPSTREAM=http://127.0.0.1:8000/mcp",
    ].join("\n");

    expect(
      shouldInstallProxyServiceForTesting({
        repoRoot: "/repo",
        unitText: currentUnit,
        upstream: "http://127.0.0.1:8000/mcp",
      })
    ).toBe(false);
    expect(
      shouldInstallProxyServiceForTesting({
        repoRoot: "/new-repo",
        unitText: currentUnit,
        upstream: "http://127.0.0.1:8000/mcp",
      })
    ).toBe(true);
    expect(
      shouldInstallProxyServiceForTesting({
        repoRoot: "/repo",
        unitText: currentUnit,
        upstream: "http://127.0.0.1:9000/mcp",
      })
    ).toBe(true);
  });

  it("renders the configured upstream into the managed proxy service unit", () => {
    const unit = renderProxyServiceUnitForTesting(
      "/repo",
      "/bin/bun",
      ProxyServiceConfig.make({
        serviceFile: "/tmp/beep-graphiti-proxy.service",
        serviceName: "beep-graphiti-proxy.service",
        stateDir: "/tmp/beep",
        systemdUserDir: "/tmp/systemd/user",
        upstreamMcpUrl: "http://127.0.0.1:9000/mcp",
      })
    );

    expect(unit).toContain("Environment=GRAPHITI_PROXY_UPSTREAM=http://127.0.0.1:9000/mcp");
    expect(unit).not.toContain("Environment=GRAPHITI_PROXY_UPSTREAM=http://127.0.0.1:8000/mcp");
  });

  it("escapes percent signs in the managed proxy service upstream", () => {
    const unit = renderProxyServiceUnitForTesting(
      "/repo",
      "/bin/bun",
      ProxyServiceConfig.make({
        serviceFile: "/tmp/beep-graphiti-proxy.service",
        serviceName: "beep-graphiti-proxy.service",
        stateDir: "/tmp/beep",
        systemdUserDir: "/tmp/systemd/user",
        upstreamMcpUrl: "http://127.0.0.1:9000/mcp?redirect=%2Fgraphiti",
      })
    );

    expect(unit).toContain("Environment=GRAPHITI_PROXY_UPSTREAM=http://127.0.0.1:9000/mcp?redirect=%%2Fgraphiti");
  });
});
