/**
 * Service: LLM Provider Configuration
 *
 * **Details**
 *
 * Defines types and interfaces for configuring different LLM providers
 * (Anthropic, OpenAI, Google) with specific resilience settings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { Duration, Schedule } from "effect";

/**
 * Supported LLM Providers
 *
 *
 * **Example** (Use the LlmProvider contract)
 *
 * ```ts
 * import type { LlmProvider } from "@effect-ontology/Service/LlmProvider"
 *
 * const acceptsLlmProvider = (_value: LlmProvider): void => undefined
 *
 * console.log(acceptsLlmProvider)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type LlmProvider = "anthropic" | "openai" | "google";

/**
 * Configuration parameters for an LLM provider
 *
 *
 * **Example** (Use the LlmProviderParams contract)
 *
 * ```ts
 * import type { LlmProviderParams } from "@effect-ontology/Service/LlmProvider"
 *
 * const acceptsLlmProviderParams = (_value: LlmProviderParams): void => undefined
 *
 * console.log(acceptsLlmProviderParams)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface LlmProviderParams {
  /**
   * Provider identifier
   */
  readonly provider: LlmProvider;

  /**
   * Model identifier (e.g. "claude-3-haiku", "gpt-4o")
   */
  readonly model: string;

  /**
   * Context window size in tokens
   */
  readonly contextWindow: number;

  /**
   * Maximum tokens for output generation
   */
  readonly maxOutputTokens: number;

  /**
   * Default timeout for API calls
   */
  readonly timeout: Duration.Duration;

  /**
   * Retry schedule for transient errors
   */
  readonly retrySchedule?: Schedule.Schedule<unknown, unknown, never>;

  /**
   * Circuit breaker configuration
   */
  readonly circuitBreaker?: {
    readonly failureThreshold: number;
    readonly resetTimeout: Duration.Duration;
  };
}
