import { makePhoenixSpanReader, PhoenixConfigInput, PhoenixSpanLookup } from "@beep/phoenix";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as UrlParams from "effect/http/UrlParams";
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
