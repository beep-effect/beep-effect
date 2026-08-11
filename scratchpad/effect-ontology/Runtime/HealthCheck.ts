/**
 * Runtime: Health Check Service
 *
 * Provides liveness and readiness probes for Kubernetes/cloud deployment.
 *
 * @since 2.0.0
 * @module Runtime/HealthCheck
 */

import {$ScratchpadId} from "@beep/identity";
import {Context, Duration, Effect, Layer, Option, Redacted} from "effect";
import {ConfigService} from "../Service/Config.ts";
import {StorageService} from "../Service/Storage.ts";

const $I = $ScratchpadId.create("effect-ontology/Runtime/HealthCheck")

/**
 * Health check result
 */
export interface HealthResult {
  readonly status: "ok" | "degraded" | "error"
  readonly timestamp: string
  readonly checks?: Record<string, "ok" | "error">
  readonly error?: string
}

/**
 * HealthCheckService - Liveness and readiness probes
 *
 * @since 2.0.0
 * @category Services
 */
export class HealthCheckService extends Context.Service<HealthCheckService>()(
  $I`HealthCheckService`,
  {
    make: Effect.gen(function*() {
      const config = yield* ConfigService
      const storage = yield* StorageService

      return {
        /**
         * Liveness check - can the service handle requests?
         * Should be fast and never fail unless service is crashed.
         */
        liveness: (): Effect.Effect<HealthResult> =>
          Effect.succeed({
            status: "ok" as const,
            timestamp: new Date().toISOString()
          }),

        /**
         * Readiness check - is the service ready to accept traffic?
         * Checks dependencies (config, LLM availability, etc.)
         */
        readiness: (): Effect.Effect<HealthResult> =>
          Effect.sync(() => {
            const checks: Record<string, "ok" | "error"> = {}

            // Check config is loaded
            if (config.llm.provider) {
              checks.config = "ok"
            } else {
              checks.config = "error"
            }

            // Check ontology path is set (not necessarily accessible yet)
            if (config.ontology.path) {
              checks.ontologyConfig = "ok"
            } else {
              checks.ontologyConfig = "error"
            }

            const hasError = Object.values(checks).some((c) => c === "error")

            return {
              status: hasError ? ("degraded" as const) : ("ok" as const),
              timestamp: new Date().toISOString(),
              checks
            }
          }),

        /**
         * Deep health check - verifies all dependencies work
         * Use for debugging, not for probes (too slow)
         */
        deepCheck: (): Effect.Effect<HealthResult> =>
          Effect.gen(function*() {
            const checks: Record<string, "ok" | "error"> = {}
            let overallStatus: "ok" | "degraded" | "error" = "ok"

            // 1. Config check - LLM provider configured
            checks.config = config.llm.provider ? "ok" : "error"

            // 2. Ontology config check - path configured
            checks.ontologyConfig = config.ontology.path ? "ok" : "error"

            // 3. Ontology file exists and readable via StorageService
            if (config.ontology.path) {
              checks.ontologyFile = yield * storage.get(config.ontology.path).pipe(
                Effect.timeout(Duration.seconds(5)),
                Effect.map((opt) => (opt !== undefined) ? "ok" as const : "error" as const),
                Effect.catch((error) =>
                  Effect.logWarning("Ontology file health check failed", {
                    path: config.ontology.path,
                    error: String(error)
                  }).pipe(Effect.as("error" as const))
                )
              )
            } else {
              checks.ontologyFile = "error"
            }

            // 4. LLM API key present check (verify apiKey is non-empty)
            const apiKeyValue = Redacted.value(config.llm.apiKey)
            checks.llmApiKey = apiKeyValue && apiKeyValue.length > 0 ? "ok" : "error"

            // 5. Storage bucket accessibility (if using GCS)
            if (Option.isSome(config.storage.bucket) && config.storage.type === "gcs") {
              // Try to list or access the bucket root to verify connectivity
              checks.storageConnectivity = yield * storage.list("").pipe(
                Effect.timeout(Duration.seconds(5)),
                Effect.map(() => "ok" as const),
                Effect.catch((error) =>
                  Effect.logWarning("Storage connectivity check failed", {
                    bucket: config.storage.bucket,
                    error: String(error)
                  }).pipe(Effect.as("error" as const))
                )
              )
            }

            // Determine overall status
            const errorCount = Object.values(checks).filter((c) => c === "error").length
            if (errorCount === 0) {
              overallStatus = "ok"
            } else if (errorCount <= 1) {
              overallStatus = "degraded"
            } else {
              overallStatus = "error"
            }

            return {
              status: overallStatus,
              timestamp: new Date().toISOString(),
              checks
            }
          })
      }
    }),
  }
) {
  static readonly Default = Layer.effect(this, this.make)
}
