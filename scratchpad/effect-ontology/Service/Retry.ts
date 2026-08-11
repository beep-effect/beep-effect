/**
 * Service: Retry Policy Factory
 *
 * Provides shared retry policy with exponential backoff, jitter, and logging.
 * Used by all LLM-calling services for consistent retry behavior.
 *
 * @since 2.0.0
 * @module Service/Retry
 */

import { Duration, Effect, Schedule } from "effect"

/**
 * Options for creating a retry policy
 *
 * @since 2.0.0
 */
export interface RetryPolicyOptions {
  /**
   * Initial delay before first retry (milliseconds)
   */
  readonly initialDelayMs: number
  /**
   * Maximum delay between retries (milliseconds).
   * Caps exponential growth to prevent excessively long waits.
   * Defaults to 30000ms (30s) if not specified.
   */
  readonly maxDelayMs?: number
  /**
   * Maximum number of retry attempts
   */
  readonly maxAttempts: number
  /**
   * Service name for logging
   */
  readonly serviceName: string
}

/**
 * Default maximum delay between retries (30 seconds)
 */
const DEFAULT_MAX_DELAY_MS = 30_000

/**
 * Determine if an error is retryable
 *
 * Retryable errors:
 * - Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND)
 * - Rate limit errors (HTTP 429)
 * - Server errors (HTTP 5xx)
 * - Circuit breaker open (CircuitBreakerOpenError)
 *
 * Non-retryable errors:
 * - Client errors (HTTP 4xx except 429)
 * - Authentication errors (401, 403)
 * - Request too large (413)
 *
 * @param error - The error to check
 * @returns true if the error should be retried
 *
 * @since 2.0.0
 */
export const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return true // Unknown errors default to retryable
  }

  // Circuit breaker errors are always retryable
  if (
    error &&
    typeof error === "object" &&
    "_tag" in error &&
    error._tag === "CircuitBreakerOpenError"
  ) {
    return true
  }

  // Check for HTTP status codes
  // Use type guard to safely access .status property (HTTP errors have numeric status codes)
  const status = "status" in error && typeof (error as { status?: unknown }).status === "number"
    ? (error as { status: number }).status
    : undefined
  if (status !== undefined) {
    // 429 Too Many Requests is retryable
    if (status === 429) return true

    // 5xx server errors are retryable
    if (status >= 500 && status < 600) return true

    // 4xx client errors (except 429) are NOT retryable
    if (status >= 400 && status < 500) return false
  }

  // Check for network error codes
  // Use type guard to safely access .code property (network errors have string codes)
  const code = "code" in error && typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined
  if (code !== undefined) {
    const retryableCodes = ["ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "ECONNRESET", "EPIPE"]
    if (retryableCodes.includes(code)) return true
  }

  // Check error message patterns
  const message = error.message.toLowerCase()
  const nonRetryablePatterns = [
    "invalid api key",
    "unauthorized",
    "forbidden",
    "authentication failed",
    "request too large"
  ]

  if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
    return false
  }

  // Default: retry unknown errors
  return true
}

/**
 * Create a retry policy with exponential backoff, jitter, and logging
 *
 * Features:
 * - Exponential backoff starting from initialDelayMs
 * - Maximum delay cap to prevent excessively long waits (default 30s)
 * - Jitter to avoid thundering herd
 * - Logs each retry attempt with service name and attempt number
 * - Respects maxAttempts limit
 *
 * @param opts - Retry policy options
 * @returns Schedule for use with Effect.retry
 *
 * @example
 * ```typescript
 * const retryPolicy = makeRetryPolicy({
 *   initialDelayMs: 2000,
 *   maxDelayMs: 30000,
 *   maxAttempts: 5,
 *   serviceName: "EntityExtractor"
 * })
 *
 * yield* myEffect.pipe(Effect.retry(retryPolicy))
 * ```
 *
 * @since 2.0.0
 */
export const makeRetryPolicy = (opts: RetryPolicyOptions) => {
  const maxDelayMs = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const maxDelay = Duration.millis(maxDelayMs)

  const schedule = Schedule.max([
    Schedule.exponential(Duration.millis(opts.initialDelayMs)),
    Schedule.recurs(opts.maxAttempts - 1)
  ]).pipe(
    // Cap max delay to prevent excessively long waits (e.g. 192s → 30s)
    Schedule.modifyDelay(({ duration }) => Effect.succeed(Duration.min(duration, maxDelay))),
    Schedule.jittered,
    Schedule.tap(({ attempt }) => {
      // Calculate actual delay (capped)
      const rawDelayMs = 2 ** attempt * opts.initialDelayMs
      const cappedDelayMs = Math.min(rawDelayMs, maxDelayMs)
      return Effect.logWarning("LLM retry attempt", {
        service: opts.serviceName,
        attempt,
        maxAttempts: opts.maxAttempts,
        nextDelayMs: cappedDelayMs,
        delayCapped: rawDelayMs > maxDelayMs
      })
    })
  )

  return { schedule, while: isRetryableError }
}
