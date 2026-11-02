import { makePhoenixSpanReader, PhoenixConfigInput, PhoenixSpanLookup } from "@beep/phoenix";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as UrlParams from "effect/http/UrlParams";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const traceId = Str.repeat(32)("1");
const spanId = Str.repeat(16)("2");
const lookup = PhoenixSpanLookup.make({
  project: "synthetic",
  traceId,
  spanId,
  attributeKeys: ["ai_metrics.event_id"],
});
const row = {
  context: { trace_id: traceId, span_id: spanId },
  parent_id: null,
  name: "agent.llm",
  span_kind: "LLM",
  start_time: "2026-10-28T00:00:00Z",
  end_time: "2026-10-28T00:00:01Z",
  status_code: "OK",
  attributes: { "ai_metrics.event_id": "synthetic-id", "input.value": "private-content" },
  events: [{ private: "event" }],
};
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

const run = Effect.fn("PhoenixSpanReadTest.run")(function* (body: unknown, status = 200) {
  const json = yield* encodeJsonValue(body);
  const client = HttpClient.make((request) =>
    Effect.sync(() => {
      expect(request.url).toBe("http://127.0.0.1:6006/v1/projects/synthetic/spans");
      expect(UrlParams.toRecord(request.urlParams)).toEqual({ limit: "2", trace_id: traceId, span_id: spanId });
      return HttpClientResponse.fromWeb(
        request,
        new Response(json, { status, headers: { "content-type": "application/json" } })
      );
    })
  );
  const reader = yield* makePhoenixSpanReader(PhoenixConfigInput.make({ baseUrl: "http://127.0.0.1:6006" })).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );
  return yield* reader.lookup(lookup);
});
it.effect("returns only requested scalar metadata for an exact unpaginated identity", () =>
  Effect.gen(function* () {
    expect(yield* run({ data: [row], next_cursor: null })).toMatchObject({
      value: { attributes: { "ai_metrics.event_id": "synthetic-id" } },
    });
    const text = yield* encodeJsonValue(yield* run({ data: [row], next_cursor: null }));
    expect(text).not.toContain("private-content");
    expect(text).not.toContain("private-content");
    assertNone(yield* run({ data: [], next_cursor: null }));
  })
);
it.effect("refuses duplicates, pagination, wrong identities and malformed requested attributes", () =>
  Effect.gen(function* () {
    for (const body of [
      { data: [row, row], next_cursor: null },
      { data: [row], next_cursor: "next" },
    ])
      expect(yield* run(body).pipe(Effect.flip)).toMatchObject({ reason: "ambiguous" });
    for (const body of [
      { data: [{ ...row, context: { trace_id: traceId, span_id: Str.repeat(16)("3") } }], next_cursor: null },
      { data: [{ ...row, attributes: { "ai_metrics.event_id": { secret: "private" } } }], next_cursor: null },
    ])
      expect(yield* run(body).pipe(Effect.flip)).toMatchObject({ reason: "invalid-response" });
    expect(yield* run({ data: [row], next_cursor: null }, 401).pipe(Effect.flip)).toMatchObject({ reason: "http" });
  })
);
it.effect("keeps an unqueryable new project distinct from an empty successful query", () =>
  Effect.gen(function* () {
    expect(yield* run({ detail: "private-server-content" }, 404).pipe(Effect.flip)).toMatchObject({
      reason: "not-found",
    });
    assertNone(yield* run({ data: [], next_cursor: null }));
  })
);
it.effect("bounds response bytes before JSON parsing", () =>
  Effect.gen(function* () {
    expect(yield* run({ private: Str.repeat(262145)("x") }).pipe(Effect.flip)).toMatchObject({ reason: "oversize" });
  })
);

it.effect("times out unavailable transport and refuses concurrent waiting work", () =>
  Effect.gen(function* () {
    const reached = yield* Deferred.make<void>();
    const client = HttpClient.make(() => Deferred.succeed(reached, undefined).pipe(Effect.andThen(Effect.never)));
    const reader = yield* makePhoenixSpanReader(PhoenixConfigInput.make({ baseUrl: "http://127.0.0.1:6006" })).pipe(
      Effect.provideService(HttpClient.HttpClient, client)
    );
    const sending = yield* Effect.forkChild(reader.lookup(lookup).pipe(Effect.flip));
    yield* Deferred.await(reached);
    expect(yield* reader.lookup(lookup).pipe(Effect.flip)).toMatchObject({ reason: "busy" });
    yield* TestClock.adjust("6 seconds");
    expect(yield* Fiber.join(sending)).toMatchObject({ reason: "timed-out" });
  })
);

it.effect("refuses unsafe origins before sending credentials", () =>
  Effect.gen(function* () {
    let requests = 0;
    const client = HttpClient.make(() =>
      Effect.sync(() => {
        requests += 1;
      }).pipe(Effect.andThen(Effect.never))
    );
    for (const baseUrl of [
      "http://phoenix.example",
      "https://user:secret@phoenix.example",
      "https://phoenix.example/path",
      "https://phoenix.example?token=private",
      "https://phoenix.example#private",
    ]) {
      const result = yield* makePhoenixSpanReader(PhoenixConfigInput.make({ baseUrl })).pipe(
        Effect.provideService(HttpClient.HttpClient, client),
        Effect.flip
      );
      expect(result).toMatchObject({ reason: "configuration" });
    }
    expect(requests).toBe(0);
  })
);

it.effect("uses explicit credentials and fixed response encoding while projecting only allowed metadata", () =>
  Effect.gen(function* () {
    const json = yield* encodeJsonValue({ data: [row], next_cursor: null });
    const client = HttpClient.make((request) =>
      Effect.sync(() => {
        expect(request.headers.authorization).toBe("Bearer synthetic-test-key");
        expect(request.headers["x-synthetic"]).toBe("configured");
        expect(request.headers.accept).toBe("application/json");
        expect(request.headers["accept-encoding"]).toBe("identity");
        return HttpClientResponse.fromWeb(
          request,
          new Response(json, { headers: { "content-type": "Application/JSON; charset=utf-8" } })
        );
      })
    );
    const reader = yield* makePhoenixSpanReader(
      PhoenixConfigInput.make({
        baseUrl: "https://phoenix.example",
        apiKey: O.some(Redacted.make("synthetic-test-key")),
        headers: {
          "x-synthetic": "configured",
          authorization: "overridden",
          accept: "text/plain",
          "accept-encoding": "gzip",
        },
      })
    ).pipe(Effect.provideService(HttpClient.HttpClient, client));
    expect(yield* reader.lookup(lookup)).toMatchObject({
      value: { attributes: { "ai_metrics.event_id": "synthetic-id" } },
    });
  })
);

it.effect("keeps transport, malformed bytes and unexpected encodings content-free", () =>
  Effect.gen(function* () {
    const broken = HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause: "private-transport-detail" }),
        })
      )
    );
    const reader = yield* makePhoenixSpanReader(PhoenixConfigInput.make({ baseUrl: "http://localhost:6006" })).pipe(
      Effect.provideService(HttpClient.HttpClient, broken)
    );
    expect(yield* reader.lookup(lookup).pipe(Effect.flip)).toMatchObject({ reason: "transport" });
    for (const response of [
      new Response("private-not-json", { headers: { "content-type": "text/plain" } }),
      new Response("private-not-json", { headers: { "content-type": "application/json", "content-encoding": "gzip" } }),
      new Response(new Uint8Array([0xff]), { headers: { "content-type": "application/json" } }),
      new Response("private-not-json", { headers: { "content-type": "application/json" } }),
    ]) {
      const client = HttpClient.make((request) => Effect.succeed(HttpClientResponse.fromWeb(request, response)));
      const querying = yield* makePhoenixSpanReader(PhoenixConfigInput.make({ baseUrl: "http://localhost:6006" })).pipe(
        Effect.provideService(HttpClient.HttpClient, client)
      );
      const error = yield* querying.lookup(lookup).pipe(Effect.flip);
      expect(error).toMatchObject({ reason: "invalid-response" });
      expect(String(error)).not.toContain("private-");
    }
  })
);

it.effect("releases admission after a response stream fails without exposing its cause", () =>
  Effect.gen(function* () {
    const json = yield* encodeJsonValue({ data: [row], next_cursor: null });
    let requests = 0;
    const client = HttpClient.make((request) =>
      Effect.sync(() => {
        const body =
          requests++ === 0
            ? new ReadableStream<Uint8Array>({
                start(controller) {
                  controller.error(new Error("private-stream-detail"));
                },
              })
            : json;
        return HttpClientResponse.fromWeb(
          request,
          new Response(body, { headers: { "content-type": "application/json" } })
        );
      })
    );
    const reader = yield* makePhoenixSpanReader(PhoenixConfigInput.make({ baseUrl: "http://localhost:6006" })).pipe(
      Effect.provideService(HttpClient.HttpClient, client)
    );
    const error = yield* reader.lookup(lookup).pipe(Effect.flip);
    expect(error).toMatchObject({ reason: "transport" });
    expect(String(error)).not.toContain("private-stream-detail");
    expect(yield* reader.lookup(lookup)).toMatchObject({ value: { traceId, spanId } });
    expect(requests).toBe(2);
  })
);

it.effect("refuses a structurally valid page whose timestamp exceeds the stored metadata bound", () =>
  Effect.gen(function* () {
    const error = yield* run({ data: [{ ...row, start_time: Str.repeat(65)("x") }], next_cursor: null }).pipe(
      Effect.flip
    );
    expect(error).toMatchObject({ reason: "invalid-response" });
    expect(String(error)).not.toContain(Str.repeat(65)("x"));
  })
);
