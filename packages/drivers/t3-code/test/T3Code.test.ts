import { JsonRpcMessage } from "@beep/mcp-kit/client";
import { T3Code, T3CodeConfig } from "@beep/t3-code";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { T3CodeError } from "@beep/t3-code";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";

const json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(json);
const decodeFrame = S.decodeEffect(S.fromJsonString(JsonRpcMessage));
const config = T3CodeConfig.make({
  url: "http://127.0.0.1:3773/mcp",
  bearer: Redacted.make("synthetic-credential"),
  timeoutMs: 1000,
});
const configuration = {
  threadId: "owned",
  modelSelection: { instanceId: "codex", model: "gpt-6.1-sol", options: [{ id: "reasoningEffort", value: "medium" }] },
  runtimeMode: "full-access",
  interactionMode: "default",
};
const sent = { threadId: "owned", messageId: "message", runId: "run", status: "queued", delivery: "queued" };
const waited = { threadId: "owned", runId: "run", status: "completed", timedOut: false };
const interrupted = { threadId: "owned", runId: "run", status: "interrupt_requested" };

const response = Effect.fn("T3CodeTest.response")(function* (
  request: HttpClientRequest.HttpClientRequest,
  body: unknown,
  status: number,
  sse: boolean
) {
  const encoded = yield* encodeJson(body).pipe(Effect.orDie);
  return HttpClientResponse.fromWeb(
    request,
    new Response(sse ? `data: ${encoded}\n\n` : encoded, {
      status,
      headers: {
        "content-type": sse ? "text/event-stream" : "application/json",
        "mcp-session-id": "owned-fixture-session",
      },
    })
  );
});

const fixture = Effect.fn("T3CodeTest.fixture")(function* (
  tool: (
    frame: JsonRpcMessage,
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<HttpClientResponse.HttpClientResponse>
) {
  const frames = yield* Ref.make<ReadonlyArray<JsonRpcMessage>>([]);
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      expect(request.url).toBe(config.url);
      expect(request.headers.authorization).toBe("Bearer synthetic-credential");
      expect(request.headers["mcp-protocol-version"]).toBe("2025-06-18");
      if (request.body._tag !== "Uint8Array") return yield* Effect.die("fixture expected encoded request");
      const frame = yield* decodeFrame(new TextDecoder().decode(request.body.body)).pipe(Effect.orDie);
      yield* Ref.update(frames, A.append(frame));
      if (frame.method === "initialize")
        return yield* response(
          request,
          { jsonrpc: "2.0", id: frame.id, result: { protocolVersion: "2025-06-18" } },
          200,
          false
        );
      expect(request.headers["mcp-session-id"]).toBe("owned-fixture-session");
      if (frame.method === "notifications/initialized")
        return HttpClientResponse.fromWeb(request, new Response(null, { status: 202 }));
      return yield* tool(frame, request);
    }).pipe(Effect.orDie)
  );
  const layer = T3Code.layer(config).pipe(Layer.provide(Layer.succeed(HttpClient.HttpClient, client)));
  const context = yield* Layer.build(layer);
  return { frames, t3: Context.get(context, T3Code) };
});
const goodTool =
  (value: unknown, sse = false) =>
  (frame: JsonRpcMessage, request: HttpClientRequest.HttpClientRequest) =>
    response(request, { jsonrpc: "2.0", id: frame.id, result: { structuredContent: value, content: [] } }, 200, sse);
const errorOf = Effect.fn("T3CodeTest.errorOf")(<Value>(effect: Effect.Effect<Value, T3CodeError>) =>
  effect.pipe(Effect.flip, Effect.orDie)
);

describe("T3 owned legacy MCP driver", () => {
  it.effect(
    "negotiates session headers and decodes SSE configuration",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture(goodTool(configuration, true));
      const actual = yield* fake.t3.readConfiguration("owned");
      expect(actual.modelSelection.options).toEqual(configuration.modelSelection.options);
      expect((yield* Ref.get(fake.frames)).length).toBe(3);
    })
  );
  it.effect(
    "sends explicit queue mode and retains request key without replay",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture(goodTool(sent));
      const result = yield* fake.t3.sendQueued("owned", "synthetic peer message", "stable-key");
      expect(result.delivery).toBe("queued");
      const last = A.last(yield* Ref.get(fake.frames));
      assertSome(
        O.map(last, (frame) => frame.params),
        {
          name: "t3_thread_send",
          arguments: {
            threadId: "owned",
            message: "synthetic peer message",
            clientRequestId: "stable-key",
            mode: "queue",
          },
        }
      );
    })
  );
  it.effect(
    "correlates an exact wait and does not interpret interrupt acceptance as terminal",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture(goodTool(waited));
      expect((yield* fake.t3.waitExactRun("owned", "run", 1000)).status).toBe("completed");
      const other = yield* fixture(goodTool(interrupted));
      expect((yield* other.t3.interruptExactRun("owned", "run", "cancel-key")).status).toBe("interrupt_requested");
    })
  );
  it.effect(
    "reads exact project binding and textual tool JSON",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture((frame, request) =>
        encodeJson({ id: "project", workspaceRoot: "/owned/work" }).pipe(
          Effect.orDie,
          Effect.flatMap((text) =>
            response(
              request,
              { jsonrpc: "2.0", id: frame.id, result: { content: [{ type: "text", text }] } },
              200,
              false
            )
          )
        )
      );
      expect((yield* fake.t3.readProject("project")).workspaceRoot).toBe("/owned/work");
    })
  );
  it.effect(
    "rejects mismatched RPC and owned thread identities as ambiguous sends",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture((_frame, request) =>
        response(request, { jsonrpc: "2.0", id: 999, result: { structuredContent: sent } }, 200, false)
      );
      const error = yield* fake.t3.sendQueued("owned", "nonce", "key").pipe(errorOf);
      expect(error.reason).toBe("protocol");
      expect(error.submission).toBe("possibly-submitted");
      const foreign = yield* fixture(goodTool({ ...sent, threadId: "foreign" }));
      expect((yield* foreign.t3.sendQueued("owned", "nonce", "key").pipe(errorOf)).reason).toBe("identity-mismatch");
    })
  );
  it.effect(
    "rejects stale exact-run observations",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture(goodTool({ ...waited, runId: "stale" }));
      expect((yield* fake.t3.waitExactRun("owned", "run", 1000).pipe(errorOf)).reason).toBe("identity-mismatch");
    })
  );
  it.effect(
    "sanitizes HTTP and tool failures without bodies or credentials",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture((_frame, request) => response(request, { secret: "must-not-escape" }, 401, false));
      const error = yield* fake.t3.sendQueued("owned", "nonce", "key").pipe(errorOf);
      expect(error.reason).toBe("http");
      expect(error.submission).toBe("possibly-submitted");
      expect(error).not.toHaveProperty("secret");
      const tool = yield* fixture((frame, request) =>
        response(
          request,
          {
            jsonrpc: "2.0",
            id: frame.id,
            result: { isError: true, content: [{ type: "text", text: "private provider failure" }] },
          },
          200,
          false
        )
      );
      expect((yield* tool.t3.readConfiguration("owned").pipe(errorOf)).reason).toBe("tool-error");
    })
  );
  it.effect(
    "rejects oversized unterminated bodies before JSON decoding",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture((_frame, request) =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response(Str.repeat(2097153)("x"))))
      );
      expect((yield* fake.t3.sendQueued("owned", "nonce", "key").pipe(errorOf)).reason).toBe("body-limit");
    })
  );
  it.effect(
    "bounds a stalled send and never retries",
    Effect.fnUntraced(function* () {
      const fake = yield* fixture(() => Effect.never);
      const fiber = yield* fake.t3.sendQueued("owned", "nonce", "key").pipe(errorOf, Effect.forkChild);
      yield* TestClock.adjust("2 seconds");
      const error = yield* Fiber.join(fiber);
      expect(error.reason).toBe("timeout");
      expect(error.submission).toBe("possibly-submitted");
      expect((yield* Ref.get(fake.frames)).length).toBe(3);
    })
  );
});
