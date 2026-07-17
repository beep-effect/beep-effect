/**
 * HTTP API telemetry descriptors, metrics, and middleware helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { NonNegativeInt, SchemaUtils } from "@beep/schema";
import { HttpMethod } from "@beep/schema/HttpMethod";
import { A } from "@beep/utils";
import { Cause, Clock, Duration, Effect, Exit, Layer, Metric, pipe, SchemaAST } from "effect";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { HttpApiMiddleware, HttpApiSchema } from "effect/unstable/httpapi";
import { observeHttpRequest, statusClass } from "../Metric.ts";
import type * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import type { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const $I = $ObservabilityId.create("server/HttpApiTelemetry");
const resolveHttpApiStatus = SchemaAST.resolveAt<number>("httpApiStatus");

/**
 * HTTP status code in the standard 100-599 range.
 *
 * @example
 * ```typescript
 * import { HttpStatusCode } from "@beep/observability/server"
 * import * as S from "effect/Schema"
 *
 * const status = S.decodeUnknownSync(HttpStatusCode)(404)
 * console.log(status)
 * // 404
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HttpStatusCode = NonNegativeInt.check(S.isBetween({ minimum: 100, maximum: 599 })).pipe(
  $I.annoteSchema("HttpStatusCode", {
    description: "HTTP status code in the standard 100-599 range.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * HTTP status code in the standard 100-599 range.
 *
 * @example
 * ```typescript
 * import { HttpStatusCode } from "@beep/observability/server"
 * import * as S from "effect/Schema"
 *
 * const status: HttpStatusCode = S.decodeUnknownSync(HttpStatusCode)(404)
 * console.log(status)
 * // 404
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type HttpStatusCode = typeof HttpStatusCode.Type;

class HttpApiStatusField extends S.Class<HttpApiStatusField>($I`HttpApiStatusField`)(
  { status: HttpStatusCode },
  $I.annote("HttpApiStatusField", {
    description: "Internal helper schema for decoding runtime HTTP status fields.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(HttpApiStatusField);
}

/**
 * Shared HTTP API telemetry descriptor.
 *
 * @example
 * ```typescript
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import { HttpApiTelemetryDescriptor } from "@beep/observability/server"
 *
 * const successStatus = S.decodeUnknownSync(NonNegativeInt)(201)
 * const descriptor = HttpApiTelemetryDescriptor.make({
 *   apiName: "TodoApi",
 *   endpointName: "createTodo",
 *   groupName: "todos",
 *   method: "POST",
 *   route: "/todos",
 *   successStatus
 * })
 * console.log(descriptor.route)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class HttpApiTelemetryDescriptor extends S.Class<HttpApiTelemetryDescriptor>($I`HttpApiTelemetryDescriptor`)(
  {
    apiName: S.NonEmptyString,
    groupName: S.NonEmptyString,
    endpointName: S.NonEmptyString,
    method: HttpMethod,
    route: S.NonEmptyString,
    successStatus: HttpStatusCode,
  },
  $I.annote("HttpApiTelemetryDescriptor", {
    description: "Shared HTTP API telemetry descriptor.",
  })
) {}

/**
 * Shared metric bundle for HTTP API request observation.
 *
 * @since 0.0.0
 * @category models
 */
interface HttpApiMetricSet {
  readonly requestDuration: Metric.Metric<import("effect/Duration").Duration, unknown>;
  readonly requestsTotal: Metric.Counter<number>;
}

/**
 * Options for the shared HTTP API telemetry middleware layer.
 *
 * @since 0.0.0
 * @category models
 */
interface HttpApiTelemetryMiddlewareOptions {
  readonly apiName: string;
  readonly metrics: HttpApiMetricSet;
}

interface HttpApiEndpointMetadata extends HttpApiEndpoint.Constraint {
  readonly error: Iterable<S.Top>;
  readonly identifier: string;
  readonly method: HttpMethod;
  readonly middlewares: Iterable<unknown>;
  readonly path: string;
  readonly success: Iterable<S.Top>;
}

interface ObserveHttpApiEffectOptions {
  readonly descriptor: HttpApiTelemetryDescriptor;
  readonly endpoint: HttpApiEndpointMetadata;
  readonly metrics: HttpApiMetricSet;
}

interface ObserveHttpApiHandlerOptions {
  readonly descriptor: HttpApiTelemetryDescriptor;
  readonly metrics: HttpApiMetricSet;
}

const isHttpApiMetricSet = (value: unknown): value is HttpApiMetricSet =>
  P.hasProperty(value, "requestDuration") && P.hasProperty(value, "requestsTotal");

const isObserveHttpApiEffectOptions = (value: unknown): value is ObserveHttpApiEffectOptions =>
  P.hasProperty(value, "descriptor") && P.hasProperty(value, "endpoint") && P.hasProperty(value, "metrics");

const isObserveHttpApiEffectDataFirst = (args: IArguments): boolean => Effect.isEffect(args[0]) || args.length >= 4;

const isHttpServerResponseEffect = <E, R>(
  value: unknown
): value is Effect.Effect<HttpServerResponse.HttpServerResponse, E, R> => Effect.isEffect(value);

const isHttpApiSuccessStatusDataFirst = (args: IArguments): boolean => args.length >= 2 || S.isSchema(args[0]);

/**
 * Resolve the declared success status from an HttpApiSchema value.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { httpApiSuccessStatus } from "@beep/observability/server"
 *
 * const status = httpApiSuccessStatus(S.String, 200)
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const httpApiSuccessStatus: {
  (schema: S.Top, fallback?: number): NonNegativeInt;
  (fallback: number): (schema: S.Top) => NonNegativeInt;
} = dual(
  isHttpApiSuccessStatusDataFirst,
  (schema: S.Top, fallback = 200): NonNegativeInt =>
    HttpStatusCode.fromUnknown(resolveHttpApiStatus(schema.ast) ?? fallback)
);

const httpApiErrorStatus = (schema: S.Top, fallback = 500): NonNegativeInt =>
  HttpStatusCode.fromUnknown(resolveHttpApiStatus(schema.ast) ?? fallback);

const endpointSuccessSchemas = (endpoint: HttpApiEndpointMetadata): ReadonlyArray<S.Top> => {
  const schemas = A.fromIterable(endpoint.success);
  return A.isReadonlyArrayNonEmpty(schemas) ? schemas : A.make(HttpApiSchema.NoContent);
};

const endpointErrorSchemas = (endpoint: HttpApiEndpointMetadata): ReadonlyArray<S.Top> => {
  let schemas = A.fromIterable(endpoint.error);
  const containsSchema = A.containsWith<S.Top>(Eq.equals);

  for (const middleware of endpoint.middlewares) {
    const service = middleware as unknown as HttpApiMiddleware.AnyService;

    for (const schema of service.error) {
      if (!containsSchema(schemas, schema)) {
        schemas = A.append(schemas, schema);
      }
    }
  }

  return schemas;
};

/**
 * Create a reusable HTTP API metric set for one metric prefix.
 *
 * @example
 * ```typescript
 * import { makeHttpApiMetrics } from "@beep/observability/server"
 *
 * const metrics = makeHttpApiMetrics("todox_api")
 * console.log(metrics.requestsTotal)
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const makeHttpApiMetrics = (prefix: string, descriptionPrefix = "HTTP API request"): HttpApiMetricSet => ({
  requestsTotal: Metric.counter(`${prefix}_requests_total`, {
    description: `${descriptionPrefix} count.`,
    incremental: true,
  }),
  requestDuration: Metric.timer(`${prefix}_request_duration_ms`, {
    description: `${descriptionPrefix} duration.`,
  }),
});

const descriptorAnnotations = (descriptor: HttpApiTelemetryDescriptor) => ({
  http_api: descriptor.apiName,
  http_group: descriptor.groupName,
  http_endpoint: descriptor.endpointName,
  http_method: descriptor.method,
  http_route: descriptor.route,
});

const telemetryAttributes = (descriptor: HttpApiTelemetryDescriptor, statusLabel: string): Record<string, string> => ({
  method: descriptor.method,
  route: descriptor.route,
  status_class: statusLabel,
});

const updateHttpApiMetrics = (
  descriptor: HttpApiTelemetryDescriptor,
  metrics: HttpApiMetricSet,
  statusLabel: string,
  durationMs: number
): Effect.Effect<void> => {
  const attributes = telemetryAttributes(descriptor, statusLabel);
  return Metric.update(Metric.withAttributes(metrics.requestsTotal, attributes), 1).pipe(
    Effect.andThen(
      Metric.update(Metric.withAttributes(metrics.requestDuration, attributes), Duration.millis(durationMs))
    )
  );
};

const annotateHttpApiOutcome = Effect.fn("annotateHttpApiOutcome")(function* (
  descriptor: HttpApiTelemetryDescriptor,
  options: {
    readonly durationMs: number;
    readonly failureKind?: "failure" | "defect" | "interrupted" | undefined;
    readonly status: O.Option<number>;
  }
): Effect.fn.Return<void> {
  const statusLabel = O.match(options.status, {
    onNone: () => "unknown",
    onSome: statusClass,
  });
  return yield* Effect.annotateCurrentSpan({
    ...descriptorAnnotations(descriptor),
    ...(P.isUndefined(options.failureKind) ? {} : { http_failure_kind: options.failureKind }),
    ...(O.isNone(options.status)
      ? {
          http_status_class: statusLabel,
        }
      : {
          http_status: options.status.value,
          http_status_class: statusLabel,
        }),
    http_request_duration_ms: options.durationMs,
  });
});

/**
 * Create a telemetry descriptor directly from Effect HttpApi metadata.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { makeHttpApiTelemetryDescriptor } from "@beep/observability/server"
 * import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
 *
 * const group = HttpApiGroup.make("todos")
 * const endpoint = HttpApiEndpoint.post("createTodo", "/todos", {
 *   success: S.Struct({ id: S.String }).pipe(HttpApiSchema.status(201))
 * })
 * const descriptor = makeHttpApiTelemetryDescriptor("TodoApi", group, endpoint)
 * console.log(descriptor.successStatus) // 201
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const makeHttpApiTelemetryDescriptor: {
  (apiName: string, group: HttpApiGroup.Constraint, endpoint: HttpApiEndpointMetadata): HttpApiTelemetryDescriptor;
  (group: HttpApiGroup.Constraint, endpoint: HttpApiEndpointMetadata): (apiName: string) => HttpApiTelemetryDescriptor;
} = dual(3, (apiName: string, group: HttpApiGroup.Constraint, endpoint: HttpApiEndpointMetadata) =>
  HttpApiTelemetryDescriptor.make({
    apiName,
    groupName: group.identifier,
    endpointName: endpoint.identifier,
    method: endpoint.method,
    route: endpoint.path,
    successStatus: httpApiSuccessStatus(endpointSuccessSchemas(endpoint)[0]),
  })
);

/**
 * Resolve the concrete status of a failed HTTP API effect from the runtime
 * error first, then from matching endpoint error schemas.
 *
 * @example
 * ```typescript
 * import * as S from "effect/Schema"
 * import { httpApiFailureStatus } from "@beep/observability/server"
 * import { HttpApiEndpoint, HttpApiSchema } from "effect/unstable/httpapi"
 *
 * const endpoint = HttpApiEndpoint.get("health", "/health", {
 *   error: S.Struct({ message: S.String }).pipe(HttpApiSchema.status(503))
 * })
 * const status = httpApiFailureStatus(endpoint, new Error("not found"))
 * console.log(status) // Option.none()
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
export const httpApiFailureStatus: {
  (endpoint: HttpApiEndpointMetadata, error: unknown): O.Option<NonNegativeInt>;
  (error: unknown): (endpoint: HttpApiEndpointMetadata) => O.Option<NonNegativeInt>;
} = dual(
  2,
  (endpoint: HttpApiEndpointMetadata, error: unknown): O.Option<NonNegativeInt> =>
    HttpApiStatusField.decodeOption(error).pipe(
      O.map(({ status }) => status),
      O.orElse(() => (S.isSchemaError(error) ? O.some(HttpStatusCode.fromUnknown(400)) : O.none())),
      O.orElse(() => {
        for (const schema of endpointErrorSchemas(endpoint)) {
          if (S.is(schema)(error)) {
            const status = schema.pipe(httpApiErrorStatus);
            return O.some(status);
          }
        }

        return O.none();
      })
    )
);

/**
 * Observe one encoded HTTP API effect where the success value is an
 * `HttpServerResponse`.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   makeHttpApiMetrics,
 *   makeHttpApiTelemetryDescriptor,
 *   observeHttpApiEffect
 * } from "@beep/observability/server"
 * import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
 * import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
 *
 * const endpoint = HttpApiEndpoint.get("health", "/health", { success: S.String })
 * const descriptor = makeHttpApiTelemetryDescriptor("TodoApi", HttpApiGroup.make("system"), endpoint)
 * const metrics = makeHttpApiMetrics("todox_api")
 * const handler = Effect.succeed(HttpServerResponse.empty({ status: 200 }))
 * const observed = observeHttpApiEffect(descriptor, endpoint, metrics, handler)
 * const status = Effect.runSync(observed.pipe(Effect.map((response) => response.status)))
 * console.log(status) // 200
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
const observeHttpApiEffectImpl = <E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
  options: ObserveHttpApiEffectOptions
): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R> =>
  Clock.currentTimeMillis.pipe(
    Effect.flatMap(
      Effect.fnUntraced(function* (startedAt) {
        return yield* Effect.annotateCurrentSpan({
          ...descriptorAnnotations(options.descriptor),
          http_success_status: HttpStatusCode.fromUnknown(options.descriptor.successStatus),
        }).pipe(
          Effect.andThen(effect.pipe(Effect.annotateLogs(descriptorAnnotations(options.descriptor)))),
          Effect.exit,
          Effect.flatMap(
            Effect.fnUntraced(function* (exit) {
              return yield* Clock.currentTimeMillis.pipe(
                Effect.flatMap(
                  Effect.fnUntraced(function* (endedAt) {
                    const durationMs = Math.max(0, endedAt - startedAt);
                    if (Exit.isSuccess(exit)) {
                      return yield* annotateHttpApiOutcome(options.descriptor, {
                        durationMs,
                        status: O.some(exit.value.status),
                      }).pipe(
                        Effect.andThen(
                          updateHttpApiMetrics(
                            options.descriptor,
                            options.metrics,
                            statusClass(exit.value.status),
                            durationMs
                          )
                        ),
                        Effect.as(exit.value)
                      );
                    }

                    const failure = Cause.findErrorOption(exit.cause);
                    const status = O.flatMap(failure, (error) => httpApiFailureStatus(options.endpoint, error));
                    const failureKind = pipe(
                      [
                        pipe(Cause.hasInterruptsOnly(exit.cause), O.liftPredicate(P.isTruthy), O.as("interrupted")),
                        pipe(failure, O.as("failure")),
                      ] satisfies ReadonlyArray<O.Option<"defect" | "failure" | "interrupted">>,
                      O.firstSomeOf,
                      O.getOrElse(() => "defect" as const)
                    );
                    const statusLabel = O.match(status, {
                      onNone: () => "unknown",
                      onSome: statusClass,
                    });

                    return yield* annotateHttpApiOutcome(options.descriptor, {
                      durationMs,
                      failureKind,
                      status,
                    }).pipe(
                      Effect.andThen(
                        updateHttpApiMetrics(options.descriptor, options.metrics, statusLabel, durationMs)
                      ),
                      Effect.andThen(Effect.failCause(exit.cause))
                    );
                  })
                )
              );
            })
          )
        );
      })
    )
  );

/**
 * Observes an HTTP API Effect and records request metrics.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import {
 *   HttpApiTelemetryDescriptor,
 *   makeHttpApiMetrics,
 *   observeHttpApiEffect
 * } from "@beep/observability/server"
 * import { HttpApiEndpoint } from "effect/unstable/httpapi"
 * import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
 *
 * const endpoint = HttpApiEndpoint.get("listTodos", "/todos", { success: S.String })
 * const successStatus = S.decodeUnknownSync(NonNegativeInt)(200)
 * const descriptor = HttpApiTelemetryDescriptor.make({
 *   apiName: "TodoApi",
 *   endpointName: "listTodos",
 *   groupName: "todos",
 *   method: "GET",
 *   route: "/todos",
 *   successStatus
 * })
 * const metrics = makeHttpApiMetrics("todo_api")
 * const observed = observeHttpApiEffect(
 *   Effect.succeed(HttpServerResponse.empty({ status: 200 })),
 *   { descriptor, endpoint, metrics }
 * )
 * console.log(Effect.runSync(observed).status) // 200
 * ```
 *
 * @effects Updates HTTP API request metrics, annotates spans, and preserves the wrapped response effect.
 *
 * @category observability
 * @since 0.0.0
 */
export const observeHttpApiEffect: {
  <E, R>(
    effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
    options: ObserveHttpApiEffectOptions
  ): Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>;
  (
    options: ObserveHttpApiEffectOptions
  ): <E, R>(
    effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>
  ) => Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>;
} = dual(
  isObserveHttpApiEffectDataFirst,
  Effect.fnUntraced(function* <E, R>(
    effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R> | HttpApiTelemetryDescriptor,
    options: ObserveHttpApiEffectOptions | HttpApiEndpointMetadata
  ): Effect.fn.Return<HttpServerResponse.HttpServerResponse, E, R> {
    if (Effect.isEffect(effect) && isObserveHttpApiEffectOptions(options)) {
      return yield* observeHttpApiEffectImpl(effect, options);
    }

    const legacyMetrics: unknown = arguments[2];
    const legacyEffect: unknown = arguments[3];

    if (
      !Effect.isEffect(effect) &&
      !isObserveHttpApiEffectOptions(options) &&
      isHttpApiMetricSet(legacyMetrics) &&
      isHttpServerResponseEffect<E, R>(legacyEffect)
    ) {
      return yield* observeHttpApiEffectImpl(legacyEffect, {
        descriptor: effect,
        endpoint: options,
        metrics: legacyMetrics,
      });
    }

    return yield* Effect.die("Invalid observeHttpApiEffect arguments");
  })
);

/**
 * Shared server-side HttpApi middleware service for request metrics, span
 * annotations, and log correlation.
 *
 * @example
 * ```typescript
 * import { Layer } from "effect"
 * import {
 *   HttpApiTelemetryMiddleware,
 *   layerHttpApiTelemetryMiddleware,
 *   makeHttpApiMetrics
 * } from "@beep/observability/server"
 *
 * const middlewareLayer: Layer.Layer<HttpApiTelemetryMiddleware> =
 *   layerHttpApiTelemetryMiddleware({
 *     apiName: "TodoApi",
 *     metrics: makeHttpApiMetrics("todo_api")
 *   })
 * console.log(middlewareLayer)
 * ```
 *
 * @since 0.0.0
 * @category services
 */
export class HttpApiTelemetryMiddleware extends HttpApiMiddleware.Service<HttpApiTelemetryMiddleware>()(
  $I`HttpApiTelemetryMiddleware`
) {}

/**
 * Build a layer that instruments all endpoints where the middleware is
 * applied.
 *
 * @example
 * ```typescript
 * import { makeHttpApiMetrics, layerHttpApiTelemetryMiddleware } from "@beep/observability/server"
 *
 * const metrics = makeHttpApiMetrics("todox_api")
 * const TelemetryLive = layerHttpApiTelemetryMiddleware({
 *   apiName: "TodoApi",
 *   metrics,
 * })
 * console.log(TelemetryLive)
 * ```
 *
 * @since 0.0.0
 * @category layers
 */
export const layerHttpApiTelemetryMiddleware = (
  options: HttpApiTelemetryMiddlewareOptions
): Layer.Layer<HttpApiTelemetryMiddleware> =>
  Layer.succeed(
    HttpApiTelemetryMiddleware,
    Effect.fnUntraced(function* (httpEffect, middlewareOptions) {
      return yield* observeHttpApiEffect(httpEffect, {
        descriptor: makeHttpApiTelemetryDescriptor(
          options.apiName,
          middlewareOptions.group,
          middlewareOptions.endpoint
        ),
        endpoint: middlewareOptions.endpoint,
        metrics: options.metrics,
      });
    })
  );

/**
 * Observe one HTTP API handler with shared span/log annotations.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import {
 *   HttpApiTelemetryDescriptor,
 *   makeHttpApiMetrics,
 *   observeHttpApiHandler
 * } from "@beep/observability/server"
 *
 * const successStatus = S.decodeUnknownSync(NonNegativeInt)(200)
 * const descriptor = HttpApiTelemetryDescriptor.make({
 *   apiName: "TodoApi",
 *   endpointName: "listTodos",
 *   groupName: "todos",
 *   method: "GET",
 *   route: "/todos",
 *   successStatus
 * })
 * const metrics = makeHttpApiMetrics("todox_api")
 * const handler = Effect.succeed({ status: 200 })
 * const observed = observeHttpApiHandler(handler, { descriptor, metrics })
 * console.log(Effect.runSync(observed).status) // 200
 * ```
 *
 * @since 0.0.0
 * @category observability
 */
const observeHttpApiHandlerImpl = Effect.fn("observeHttpApiHandlerImpl")(function* <
  A,
  E extends {
    readonly status: number;
  },
  R,
>(effect: Effect.Effect<A, E, R>, options: ObserveHttpApiHandlerOptions): Effect.fn.Return<A, E, R> {
  return yield* observeHttpRequest(
    Effect.annotateCurrentSpan({
      http_api: options.descriptor.apiName,
      http_group: options.descriptor.groupName,
      http_endpoint: options.descriptor.endpointName,
      http_method: options.descriptor.method,
      http_route: options.descriptor.route,
      http_success_status: HttpStatusCode.fromUnknown(options.descriptor.successStatus),
    }).pipe(
      Effect.andThen(
        effect.pipe(
          Effect.annotateLogs({
            http_api: options.descriptor.apiName,
            http_group: options.descriptor.groupName,
            http_endpoint: options.descriptor.endpointName,
            http_method: options.descriptor.method,
            http_route: options.descriptor.route,
          })
        )
      )
    ),
    {
      method: options.descriptor.method,
      route: options.descriptor.route,
      successStatus: options.descriptor.successStatus,
      requestsTotal: options.metrics.requestsTotal,
      requestDuration: options.metrics.requestDuration,
    }
  );
});

/**
 * Observes an HTTP API handler Effect and records request metrics.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect"
 * import { NonNegativeInt } from "@beep/schema"
 * import * as S from "effect/Schema"
 * import {
 *   HttpApiTelemetryDescriptor,
 *   makeHttpApiMetrics,
 *   observeHttpApiHandler
 * } from "@beep/observability/server"
 *
 * const successStatus = S.decodeUnknownSync(NonNegativeInt)(200)
 * const descriptor = HttpApiTelemetryDescriptor.make({
 *   apiName: "TodoApi",
 *   endpointName: "listTodos",
 *   groupName: "todos",
 *   method: "GET",
 *   route: "/todos",
 *   successStatus
 * })
 * const metrics = makeHttpApiMetrics("todo_api")
 * const observed = observeHttpApiHandler(
 *   Effect.succeed({ status: 200 }),
 *   { descriptor, metrics }
 * )
 * console.log(Effect.runPromise(observed))
 * ```
 *
 * @effects Updates HTTP API request metrics and annotates spans around the wrapped handler effect.
 *
 * @category observability
 * @since 0.0.0
 */
export const observeHttpApiHandler: {
  <
    A,
    E extends {
      readonly status: number;
    },
    R,
  >(
    effect: Effect.Effect<A, E, R>,
    options: ObserveHttpApiHandlerOptions
  ): Effect.Effect<A, E, R>;
  (
    options: ObserveHttpApiHandlerOptions
  ): <
    A,
    E extends {
      readonly status: number;
    },
    R,
  >(
    effect: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, R>;
} = dual(2, observeHttpApiHandlerImpl);
