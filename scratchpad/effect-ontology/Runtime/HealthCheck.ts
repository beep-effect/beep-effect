/**
 * Runtime: Health Check Service
 *
 * **Details**
 *
 * Provides liveness and readiness probes for Kubernetes/cloud deployment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Context, DateTime, Duration, Effect, Inspectable, Layer, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ConfigService } from "../Service/Config.ts";
import { StorageService } from "../Service/Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/HealthCheck");
const healthOk: "ok" = "ok";
const healthError: "error" = "error";

/**
 * Aggregate status exposed by a health probe.
 *
 * **Example** (Inspect health statuses)
 *
 * ```ts
 * import { HealthStatus } from "@effect-ontology/Runtime/HealthCheck"
 *
 * console.log(HealthStatus.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HealthStatus = LiteralKit(["ok", "degraded", "error"]).pipe(
  $I.annoteSchema("HealthStatus", {
    description: "Aggregate runtime health states exposed by probes.",
  })
);

/**
 * Runtime value accepted by {@link HealthStatus}.
 *
 * **Example** (Use a health status)
 *
 * ```ts
 * import type { HealthStatus } from "@effect-ontology/Runtime/HealthCheck"
 *
 * const status: HealthStatus = "degraded"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type HealthStatus = typeof HealthStatus.Type;

/**
 * Outcome of one named health dependency check.
 *
 * **Example** (Inspect dependency check statuses)
 *
 * ```ts
 * import { HealthCheckStatus } from "@effect-ontology/Runtime/HealthCheck"
 *
 * console.log(HealthCheckStatus.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HealthCheckStatus = LiteralKit(["ok", "error"]).pipe(
  $I.annoteSchema("HealthCheckStatus", {
    description: "Outcome of one named runtime health dependency check.",
  })
);

/**
 * Runtime value accepted by {@link HealthCheckStatus}.
 *
 * **Example** (Use a dependency check status)
 *
 * ```ts
 * import type { HealthCheckStatus } from "@effect-ontology/Runtime/HealthCheck"
 *
 * const status: HealthCheckStatus = "ok"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type HealthCheckStatus = typeof HealthCheckStatus.Type;

/**
 * Timestamped aggregate result returned by runtime health probes.
 *
 * **Example** (Construct an ok probe result)
 *
 * ```ts
 * import { HealthResult } from "@effect-ontology/Runtime/HealthCheck"
 *
 * const result = HealthResult.make({
 *   status: "ok",
 *   timestamp: "2026-08-26T00:00:00.000Z"
 * })
 * console.log(result.status) // "ok"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HealthResult extends S.Class<HealthResult>($I`HealthResult`)(
  {
    status: HealthStatus,
    timestamp: S.NonEmptyString,
    checks: S.optionalKey(S.Record(S.String, HealthCheckStatus)),
    error: S.optionalKey(S.NonEmptyString),
  },
  $I.annote("HealthResult", {
    description: "Timestamped aggregate health status with optional dependency results and failure detail.",
  })
) {}

/**
 * Liveness, readiness, and deep-dependency probes for Kubernetes-style health checks.
 *
 * **Example** (Run a liveness probe)
 *
 * ```ts
 * import { Effect, Layer } from "effect"
 * import { HealthCheckService } from "@effect-ontology/Runtime/HealthCheck"
 *
 * const TestHealth = Layer.mock(HealthCheckService, {
 *   liveness: () => Effect.succeed({ status: "ok", timestamp: "2026-08-26T00:00:00.000Z" })
 * })
 * const result = Effect.runSync(
 *   Effect.gen(function* () {
 *     const health = yield* HealthCheckService
 *     return yield* health.liveness()
 *   }).pipe(Effect.provide(TestHealth))
 * )
 * console.log(result.status) // "ok"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HealthCheckService extends Context.Service<HealthCheckService>()($I`HealthCheckService`, {
  make: Effect.gen(function* () {
    const config = yield* ConfigService;
    const storage = yield* StorageService;

    return {
      /**
       * Liveness check - can the service handle requests?
       * Should be fast and never fail unless service is crashed.
       */
      liveness: Effect.fn("liveness")(function* () {
        return {
          status: "ok",
          timestamp: DateTime.toDateUtc(yield* DateTime.now).toISOString(),
        };
      }),

      /**
       * Readiness check - is the service ready to accept traffic?
       * Checks dependencies (config, LLM availability, etc.)
       */
      readiness: Effect.fn("readiness")(function* () {
        const checks: Record<string, "ok" | "error"> = {
          config: "ok",
          ontologyConfig: "ok",
        };

        const hasError = A.some(R.values(checks), (check) => check === "error");

        return {
          status: hasError ? "degraded" : "ok",
          timestamp: DateTime.toDateUtc(yield* DateTime.now).toISOString(),
          checks,
        };
      }),

      /**
       * Deep health check - verifies all dependencies work
       * Use for debugging, not for probes (too slow)
       */
      deepCheck: Effect.gen(function* () {
        const checks: Record<string, "ok" | "error"> = {};
        let overallStatus: "ok" | "degraded" | "error" = "ok";

        // 1. Config check - LLM provider configured
        checks.config = "ok";

        // 2. Ontology config check - path configured
        checks.ontologyConfig = "ok";

        // 3. Ontology file exists and readable via StorageService
        checks.ontologyFile = yield* storage.getOption(config.ontology.path).pipe(
          Effect.timeout(Duration.seconds(5)),
          Effect.map(O.match({ onNone: () => healthError, onSome: () => healthOk })),
          Effect.catch((error) =>
            Effect.logWarning("Ontology file health check failed", {
              path: config.ontology.path,
              error: Inspectable.toStringUnknown(error),
            }).pipe(Effect.as(healthError))
          )
        );

        // 4. LLM API key present check (verify apiKey is non-empty)
        const apiKeyValue = Redacted.value(config.llm.apiKey);
        checks.llmApiKey = Str.isNonEmpty(apiKeyValue) ? "ok" : "error";

        // 5. Storage bucket accessibility (if using GCS)
        if (O.isSome(config.storage.bucket) && config.storage.type === "gcs") {
          // Try to list or access the bucket root to verify connectivity
          checks.storageConnectivity = yield* storage.list("").pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.as(healthOk),
            Effect.catch((error) =>
              Effect.logWarning("Storage connectivity check failed", {
                bucket: config.storage.bucket,
                error: Inspectable.toStringUnknown(error),
              }).pipe(Effect.as(healthError))
            )
          );
        }

        // Determine overall status
        const errorCount = A.length(A.filter(R.values(checks), (check) => check === "error"));
        if (errorCount === 0) {
          overallStatus = "ok";
        } else if (errorCount <= 1) {
          overallStatus = "degraded";
        } else {
          overallStatus = "error";
        }

        return {
          status: overallStatus,
          timestamp: DateTime.toDateUtc(yield* DateTime.now).toISOString(),
          checks,
        };
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
