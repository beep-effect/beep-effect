import {
  HttpApiTelemetryDescriptor,
  HttpStatusCode,
  httpApiFailureStatus,
  httpApiSuccessStatus,
  makeHttpApiTelemetryDescriptor,
  observeHttpApiEffect,
  observeHttpApiHandler,
} from "@beep/observability/server";
import { NonNegativeInt } from "@beep/schema";
import { HttpStatusCode as CanonicalHttpStatusCode } from "@beep/schema/HttpStatus";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import { Cause, Effect, Equal, Metric } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownHttpStatusCodeOption = S.decodeUnknownOption(HttpStatusCode);
const encodeHttpStatusCodeOption = S.encodeOption(HttpStatusCode);

describe("HttpApiTelemetry", () => {
  it("preserves the schema package's canonical HTTP status export", () => {
    expect(HttpStatusCode).toBe(CanonicalHttpStatusCode);
  });

  it("reads explicit HttpApiSchema statuses", () => {
    expect(httpApiSuccessStatus(S.String.pipe(HttpApiSchema.status(201)))).toBe(201);
    expect(httpApiSuccessStatus(S.String)).toBe(200);
    expect(S.String.pipe(httpApiSuccessStatus(202))).toBe(202);
    expect(() => httpApiSuccessStatus(S.String.pipe(HttpApiSchema.status(99)))).toThrow();
  });

  it.prop(
    "round-trips schema-derived HTTP status codes",
    [Arbitrary.schema(HttpStatusCode)],
    ([status]) => {
      const decoded = O.flatMap(encodeHttpStatusCodeOption(status), decodeUnknownHttpStatusCodeOption);
      expect(O.exists(decoded, (value) => Equal.equals(value, status))).toBe(true);

      return true;
    },
    { arbitrary: fcRuns(50) }
  );

  it.effect("tracks HTTP API request metrics", () =>
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
  );

  it.effect("observes encoded HttpServerResponse values and schema-derived failure statuses", () =>
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
      assertSome(httpApiFailureStatus(endpoint, { message: "backend unavailable" }), NonNegativeInt.make(503));

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
      assertExitFailure(failureExit, Cause.fail({ message: "backend unavailable" }));

      const failureState = yield* Metric.value(
        Metric.withAttributes(requestsTotal, {
          method: "GET",
          route: "/health",
          status_class: "5xx",
        })
      );

      expect(failureState.count).toBe(1);
    })
  );
});
