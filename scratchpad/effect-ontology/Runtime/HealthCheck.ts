/**
 * Runtime: Health Check Service
 *
 * Provides liveness and readiness probes for Kubernetes/cloud deployment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Duration, Effect, Layer, Option, Redacted } from "effect";
import * as DateTime from "effect/DateTime";
import * as P from "effect/Predicate";
import { ConfigService } from "../Service/Config.ts";
import { StorageService } from "../Service/Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/HealthCheck");

/**
 * Health check result
 */
export interface HealthResult {
  readonly status: "ok" | "degraded" | "error";
  readonly timestamp: string;
  readonly checks?: Record<string, "ok" | "error">;
  readonly error?: string;
}

/**
 * HealthCheckService - Liveness and readiness probes
 *
 * @since 0.0.0
 * @category services
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

        const hasError = Object.values(checks).some((c) => c === "error");

        return {
          status: hasError ? ("degraded") : ("ok"),
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
            Effect.map((opt) => (opt !== undefined ? ("ok") : ("error"))),
            Effect.catch((error) =>
              Effect.logWarning("Ontology file health check failed", {
                path: config.ontology.path,
                error: String(error),
              }).pipe(Effect.as("error"))
            )
          );
        } else {
          checks.ontologyFile = "error";
        }

        // 4. LLM API key present check (verify apiKey is non-empty)
        const apiKeyValue = Redacted.value(config.llm.apiKey);
        checks.llmApiKey = P.isTruthy(apiKeyValue) && apiKeyValue.length > 0 ? "ok" : "error";

        // 5. Storage bucket accessibility (if using GCS)
        if (Option.isSome(config.storage.bucket) && config.storage.type === "gcs") {
          // Try to list or access the bucket root to verify connectivity
          checks.storageConnectivity = yield* storage.list("").pipe(
            Effect.timeout(Duration.seconds(5)),
            Effect.map(() => "ok"),
            Effect.catch((error) =>
              Effect.logWarning("Storage connectivity check failed", {
                bucket: config.storage.bucket,
                error: String(error),
              }).pipe(Effect.as("error"))
            )
          );
        }

        // Determine overall status
        const errorCount = Object.values(checks).filter((c) => c === "error").length;
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
