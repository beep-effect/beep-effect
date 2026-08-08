/**
 * Prometheus metrics sanitization and HTTP route helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, Str } from "@beep/utils";
import { Effect, flow, Layer } from "effect";
import * as P from "effect/Predicate";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as PrometheusMetrics from "effect/unstable/observability/PrometheusMetrics";

/**
 * Strip duplicate terminal histogram buckets from Prometheus exposition text.
 *
 * **Example** (Strip duplicate histogram buckets)
 *
 * ```typescript
 * import { sanitizePrometheusMetrics } from "@beep/observability/server"
 *
 * const raw = 'my_metric_bucket{le="Infinity"} 5\nmy_metric_bucket{le="1"} 3'
 * const clean = sanitizePrometheusMetrics(raw)
 * console.log(clean)
 * ```
 *
 * @category observability
 * @since 0.0.0
 */
export const sanitizePrometheusMetrics: (text: string) => string = flow(
  Str.split("\n"),
  A.filter(P.not(Str.includes('le="Infinity"'))),
  A.join("\n")
);

/**
 * Create a sanitized Prometheus metrics route.
 *
 * **Example** (Create metrics HTTP layer)
 *
 * ```typescript
 * import { layerPrometheusMetricsHttp } from "@beep/observability/server"
 *
 * const PrometheusLive = layerPrometheusMetricsHttp({ path: "/metrics" })
 * console.log(PrometheusLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerPrometheusMetricsHttp = (
  options?: PrometheusMetrics.HttpOptions | undefined
): Layer.Layer<never, never, HttpRouter.HttpRouter> => {
  const { path: routePath, ...formatOptions } = options ?? {};

  return Layer.effectDiscard(
    Effect.gen(function* () {
      const router = yield* HttpRouter.HttpRouter;

      const handler = Effect.gen(function* () {
        const raw = yield* PrometheusMetrics.format(formatOptions);
        const body = sanitizePrometheusMetrics(raw);
        return HttpServerResponse.text(body, {
          contentType: "text/plain; version=0.0.4; charset=utf-8",
        });
      });

      yield* router.add("GET", routePath ?? "/metrics", handler);
    })
  );
};
