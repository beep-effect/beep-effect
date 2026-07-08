/**
 * Repo AI-agent metrics models and helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Agent-effectiveness doctor and annotation-plan helpers.
 *
 * @example
 * ```ts
 * import { makeAgentEffectivenessDoctorReport } from "@beep/repo-ai-metrics"
 * console.log(makeAgentEffectivenessDoctorReport)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./agent-effectiveness.ts";
/**
 * Encrypted raw archive helpers.
 *
 * @example
 * ```ts
 * import { writeEncryptedRawArchiveObject } from "@beep/repo-ai-metrics"
 * console.log(writeEncryptedRawArchiveObject)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./archive.ts";
/**
 * Local backend compose rendering helpers.
 *
 * @example
 * ```ts
 * import { renderAiMetricsLocalPhoenixCompose } from "@beep/repo-ai-metrics"
 * console.log(renderAiMetricsLocalPhoenixCompose)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./compose.ts";
/**
 * Repo-local configuration snapshot helpers.
 *
 * @example
 * ```ts
 * import { makeAiMetricsConfigSnapshot } from "@beep/repo-ai-metrics"
 * console.log(makeAiMetricsConfigSnapshot)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./config-snapshot.ts";
/**
 * DuckDB derived storage helpers.
 *
 * @example
 * ```ts
 * import { writeAiMetricsDerivedStorage } from "@beep/repo-ai-metrics"
 * console.log(writeAiMetricsDerivedStorage)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./derived-storage.ts";
/**
 * Derived-store path and scoped DuckDB provider helpers.
 *
 * @example
 * ```ts
 * import { aiMetricsDerivedDuckDbPath } from "@beep/repo-ai-metrics"
 * console.log(aiMetricsDerivedDuckDbPath(".beep/ai-metrics"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export * from "./duckdb.ts";
/**
 * Durable forwarder workflow.
 *
 * @example
 * ```ts
 * import { runAiMetricsForwarder } from "@beep/repo-ai-metrics"
 * console.log(runAiMetricsForwarder)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./forwarder.ts";
/**
 * Transcript ingest helpers.
 *
 * @example
 * ```ts
 * import { summarizeTranscriptText } from "@beep/repo-ai-metrics"
 * console.log(summarizeTranscriptText)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./ingest.ts";
/**
 * Install and deployment target helpers.
 *
 * @example
 * ```ts
 * import { makeAiMetricsInstallSpec } from "@beep/repo-ai-metrics"
 * console.log(makeAiMetricsInstallSpec)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./install.ts";
/**
 * P7 sanitized mirror bundle helpers.
 *
 * @example
 * ```ts
 * import { buildAiMetricsMirrorBundle } from "@beep/repo-ai-metrics"
 * console.log(buildAiMetricsMirrorBundle)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./mirror.ts";
/**
 * Canonical AI metrics models.
 *
 * @example
 * ```ts
 * import { AiMetricsDeployTarget } from "@beep/repo-ai-metrics"
 * console.log(AiMetricsDeployTarget.Enum.local)
 * ```
 * @category models
 * @since 0.0.0
 */
export * from "./models.ts";
/**
 * OTLP span projection and export helpers.
 *
 * @example
 * ```ts
 * import { runAiMetricsOtlpExport } from "@beep/repo-ai-metrics"
 * console.log(runAiMetricsOtlpExport)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./otlp.ts";
/**
 * Privacy and derived-payload proof helpers.
 *
 * @example
 * ```ts
 * import { makeAiMetricsPrivacyCheckResult } from "@beep/repo-ai-metrics"
 * console.log(makeAiMetricsPrivacyCheckResult)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./privacy.ts";
/**
 * P7 retention, restore, delete, and compaction helpers.
 *
 * @example
 * ```ts
 * import { listAiMetricsRetentionInventory } from "@beep/repo-ai-metrics"
 * console.log(listAiMetricsRetentionInventory)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./retention.ts";
/**
 * Labels, benchmarks, and weekly scorecard reports.
 *
 * @example
 * ```ts
 * import { generateAiMetricsWeeklyReport } from "@beep/repo-ai-metrics"
 * console.log(generateAiMetricsWeeklyReport)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./scorecard.ts";
/**
 * Shell rendering helpers for operator commands.
 *
 * @example
 * ```ts
 * import { shellQuote } from "@beep/repo-ai-metrics"
 * console.log(shellQuote("op://vault/item/field"))
 * ```
 * @category utilities
 * @since 0.0.0
 */
export * from "./shell.ts";
/**
 * Local AI-agent source discovery helpers.
 *
 * @example
 * ```ts
 * import { discoverAiMetricsSources } from "@beep/repo-ai-metrics"
 * console.log(discoverAiMetricsSources)
 * ```
 * @category services
 * @since 0.0.0
 */
export * from "./source-discovery.ts";
