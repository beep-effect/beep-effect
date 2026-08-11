/**
 * Service: LLM Provider Configuration
 *
 * Defines types and interfaces for configuring different LLM providers
 * (Anthropic, OpenAI, Google) with specific resilience settings.
 *
 * @since 2.0.0
 * @module Service/LlmProvider
 */

import type { Duration, Schedule } from "effect"

/**
 * Supported LLM Providers
 */
export type LlmProvider = "anthropic" | "openai" | "google"

/**
 * Configuration parameters for an LLM provider
 */
export interface LlmProviderParams {
  /**
   * Provider identifier
   */
  readonly provider: LlmProvider

  /**
   * Model identifier (e.g. "claude-3-haiku", "gpt-4o")
   */
  readonly model: string

  /**
   * Context window size in tokens
   */
  readonly contextWindow: number

  /**
   * Maximum tokens for output generation
   */
  readonly maxOutputTokens: number

  /**
   * Default timeout for API calls
   */
  readonly timeout: Duration.Duration

  /**
   * Retry schedule for transient errors
   */
  readonly retrySchedule?: Schedule.Schedule<unknown, unknown, never>

  /**
   * Circuit breaker configuration
   */
  readonly circuitBreaker?: {
    readonly failureThreshold: number
    readonly resetTimeout: Duration.Duration
  }
}
