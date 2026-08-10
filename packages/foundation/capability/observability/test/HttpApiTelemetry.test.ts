import {
  HttpApiTelemetryDescriptor,
  HttpStatusCode,
  httpApiFailureStatus,
  httpApiSuccessStatus,
  makeHttpApiTelemetryDescriptor,
  observeHttpApiEffect,
  observeHttpApiHandler,
} from "@beep/observability/server";
import { fcRuns } from "@beep/test-utils";
import { Effect, Equal, Metric } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { describe, expect, it } from "vitest";

describe("HttpApiTelemetry", () => {
  it("reads explicit HttpApiSchema statuses", () => {
    expect(httpApiSuccessStatus(S.String.pipe(HttpApiSchema.status(201)))).toBe(201);
    expect(httpApiSuccessStatus(S.String)).toBe(200);
    expect(S.String.pipe(httpApiSuccessStatus(202))).toBe(202);
    expect(() => httpApiSuccessStatus(S.String.pipe(HttpApiSchema.status(99)))).toThrow();
  });

  it("round-trips schema-derived HTTP status codes", () => {
    fc.assert(
      fc.property(S.toArbitrary(HttpStatusCode)(fc), (status) => {
        const decoded = O.flatMap(S.encodeOption(HttpStatusCode)(status), S.decodeUnknownOption(HttpStatusCode));
        expect(O.exists(decoded, (value) => Equal.equals(value, status))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("tracks HTTP API request metrics", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const requestsTotal = Metric.counter("test_http_api_requests_total");
        const requestDuration = Metric.timer("test_http_api_request_duration_ms");
        const descriptor = HttpApiTelemetryDescriptor.make({
          apiName: "test-api",
          groupName: "system",
          endpointName: "health",
          method: "GET",
          route: "/health",
          successStatus: httpApiSuccessStatus(S.String),
        });

        yield* observeHttpApiHandler(Effect.succeed("ok"), {
          descriptor,
          metrics: {
            requestsTotal,
            requestDuration,
          },
        });

        const state = yield* Metric.value(
          Metric.withAttributes(requestsTotal, {
            method: "GET",
            route: "/health",
            status_class: "2xx",
          })
        );

        expect(state.count).toBe(1);
      })
    ));

  it("observes encoded HttpServerResponse values and schema-derived failure statuses", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const requestsTotal = Metric.counter("test_http_api_effect_requests_total");
        const requestDuration = Metric.timer("test_http_api_effect_request_duration_ms");
        const endpoint = HttpApiEndpoint.get("health", "/health", {
          success: S.String,
          error: S.Struct({
            message: S.String,
          }).pipe(HttpApiSchema.status(503)),
        });
        const descriptor = makeHttpApiTelemetryDescriptor("test-api", HttpApiGroup.make("system"), endpoint);

        const response = yield* observeHttpApiEffect(Effect.succeed(HttpServerResponse.text("ok", { status: 202 })), {
          descriptor,
          endpoint,
          metrics: {
            requestsTotal,
            requestDuration,
          },
        });

        expect(response.status).toBe(202);

        const successState = yield* Metric.value(
          Metric.withAttributes(requestsTotal, {
            method: "GET",
            route: "/health",
            status_class: "2xx",
          })
        );

        expect(successState.count).toBe(1);
        expect(httpApiFailureStatus(endpoint, { message: "backend unavailable" })).toStrictEqual(O.some(503));

        const failureExit = yield* Effect.exit(
          observeHttpApiEffect(
            Effect.fail({
              message: "backend unavailable",
            }),
            {
              descriptor,
              endpoint,
              metrics: {
                requestsTotal,
                requestDuration,
              },
            }
          )
        );

        expect(failureExit._tag).toBe("Failure");

        const failureState = yield* Metric.value(
          Metric.withAttributes(requestsTotal, {
            method: "GET",
            route: "/health",
            status_class: "5xx",
          })
        );

        expect(failureState.count).toBe(1);
      })
    ));
});
