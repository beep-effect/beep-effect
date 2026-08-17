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
import { Context, DateTime, Duration, Effect, Layer, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ConfigService } from "../Service/Config.ts";
import { StorageService } from "../Service/Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/HealthCheck");
const healthOk: "ok" = "ok";
const healthError: "error" = "error";

/**
 * Health check result
 *
 *
 * **Example** (Use the HealthResult contract)
 *
 * ```ts
 * import type { HealthResult } from "@effect-ontology/Runtime/HealthCheck"
 *
 * const acceptsHealthResult = (_value: HealthResult): void => undefined
 *
 * console.log(acceptsHealthResult)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
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
 * **Example** (Inspect the health result schema)
 *
 * ```ts
 * import { HealthResult } from "@effect-ontology/Runtime/HealthCheck"
 *
 * console.log(HealthResult)
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
 * HealthCheckService - Liveness and readiness probes
 *
 * **Example** (Inspect health check service)
 *
 * ```ts
 * import { HealthCheckService } from "@effect-ontology/Runtime/HealthCheck"
 *
 * console.log(HealthCheckService)
 * ```
 *
 * @category layers
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
        const checks: Record<string, "ok" | "error"> = {};

        // Check config is loaded
        if (P.isTruthy(config.llm.provider)) {
          checks.config = "ok";
        } else {
          checks.config = "error";
        }

        // Check ontology path is set (not necessarily accessible yet)
        if (P.isTruthy(config.ontology.path)) {
          checks.ontologyConfig = "ok";
        } else {
          checks.ontologyConfig = "error";
        }

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
        checks.config = P.isTruthy(config.llm.provider) ? "ok" : "error";

        // 2. Ontology config check - path configured
        checks.ontologyConfig = P.isTruthy(config.ontology.path) ? "ok" : "error";

        // 3. Ontology file exists and readable via StorageService
        if (P.isTruthy(config.ontology.path)) {
          checks.ontologyFile = yield* storage.get(config.ontology.path).pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.map((opt): "ok" | "error" => (opt !== undefined ? healthOk : healthError)),
            Effect.catch((error) =>
              Effect.logWarning("Ontology file health check failed", {
                path: config.ontology.path,
                error: String(error),
              }).pipe(Effect.as(healthError))
            )
          );
        } else {
          checks.ontologyFile = "error";
        }

        // 4. LLM API key present check (verify apiKey is non-empty)
        const apiKeyValue = Redacted.value(config.llm.apiKey);
        checks.llmApiKey = P.isTruthy(apiKeyValue) && apiKeyValue.length > 0 ? "ok" : "error";

        // 5. Storage bucket accessibility (if using GCS)
        if (O.isSome(config.storage.bucket) && config.storage.type === "gcs") {
          // Try to list or access the bucket root to verify connectivity
          checks.storageConnectivity = yield* storage.list("").pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.as(healthOk),
            Effect.catch((error) =>
              Effect.logWarning("Storage connectivity check failed", {
                bucket: config.storage.bucket,
                error: String(error),
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
