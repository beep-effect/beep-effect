/**
 * Telemetry: Prometheus Metrics Service
 *
 * Collects and exports metrics in Prometheus text format.
 * Provides counters, gauges, and histograms for extraction observability.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Layer } from "effect";

const $I = $ScratchpadId.create("effect-ontology/Telemetry/Metrics");

import { Effect, Ref } from "effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";

/**
 * Extraction metrics input
 *
 * @since 0.0.0
 * @category type-level
 */
export interface ExtractionMetrics {
  readonly durationMs: number;
  readonly entityCount: number;
  readonly relationCount: number;
  readonly chunkCount: number;
  readonly success: boolean;
}

/**
 * LLM call metrics input
 *
 * @since 0.0.0
 * @category type-level
 */
export interface LlmCallMetrics {
  readonly provider: string;
  readonly model: string;
  readonly durationMs: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly success: boolean;
}

/**
 * Embedding cache metrics input
 *
 * @since 0.0.0
 * @category type-level
 */
export interface EmbeddingCacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly latencyMs: number;
}

/**
 * Internal metrics state
 */
interface MetricsState {
  extractions: {
    total: number;
    successful: number;
    failed: number;
    durationSum: number;
    entitySum: number;
    relationSum: number;
  };
  llmCalls: HashMap.HashMap<
    string,
    {
      total: number;
      successful: number;
      failed: number;
      durationSum: number;
      tokensInSum: number;
      tokensOutSum: number;
    }
  >;
  embeddingCache: {
    hits: number;
    misses: number;
    latencySumMs: number;
    latencyCount: number;
  };
}

const initialState: MetricsState = {
  extractions: {
    total: 0,
    successful: 0,
    failed: 0,
    durationSum: 0,
    entitySum: 0,
    relationSum: 0,
  },
  llmCalls: HashMap.empty(),
  embeddingCache: {
    hits: 0,
    misses: 0,
    latencySumMs: 0,
    latencyCount: 0,
  },
};

/**
 * MetricsService - Prometheus metrics collection
 *
 * @since 0.0.0
 * @category services
 */
export class MetricsService extends Context.Service<MetricsService>()($I`MetricsService`, {
  make: Effect.gen(function* () {
    const stateRef = yield* Ref.make<MetricsState>({
      ...initialState,
      llmCalls: HashMap.empty(),
    });

    return {
      /**
       * Record extraction metrics
       */
      recordExtraction: (metrics: ExtractionMetrics): Effect.Effect<void> =>
        Ref.update(stateRef, (state) => ({
          ...state,
          extractions: {
            total: state.extractions.total + 1,
            successful: state.extractions.successful + (metrics.success ? 1 : 0),
            failed: state.extractions.failed + (metrics.success ? 0 : 1),
            durationSum: state.extractions.durationSum + metrics.durationMs,
            entitySum: state.extractions.entitySum + metrics.entityCount,
            relationSum: state.extractions.relationSum + metrics.relationCount,
          },
        })),

      /**
       * Record LLM call metrics
       */
      recordLlmCall: (metrics: LlmCallMetrics): Effect.Effect<void> =>
        Ref.update(stateRef, (state) => {
          const key = `${metrics.provider}:${metrics.model}`;
          const existing = O.getOrElse(HashMap.get(state.llmCalls, key), () => ({
            total: 0,
            successful: 0,
            failed: 0,
            durationSum: 0,
            tokensInSum: 0,
            tokensOutSum: 0,
          }));

          const updated = HashMap.set(state.llmCalls, key, {
            total: existing.total + 1,
            successful: existing.successful + (metrics.success ? 1 : 0),
            failed: existing.failed + (metrics.success ? 0 : 1),
            durationSum: existing.durationSum + metrics.durationMs,
            tokensInSum: existing.tokensInSum + metrics.tokensIn,
            tokensOutSum: existing.tokensOutSum + metrics.tokensOut,
          });

          return { ...state, llmCalls: updated };
        }),

      /**
       * Record embedding cache hit
       */
      recordCacheHit: (latencyMs: number): Effect.Effect<void> =>
        Ref.update(stateRef, (state) => ({
          ...state,
          embeddingCache: {
            ...state.embeddingCache,
            hits: state.embeddingCache.hits + 1,
            latencySumMs: state.embeddingCache.latencySumMs + latencyMs,
            latencyCount: state.embeddingCache.latencyCount + 1,
          },
        })),

      /**
       * Record embedding cache miss
       */
      recordCacheMiss: (latencyMs: number): Effect.Effect<void> =>
        Ref.update(stateRef, (state) => ({
          ...state,
          embeddingCache: {
            ...state.embeddingCache,
            misses: state.embeddingCache.misses + 1,
            latencySumMs: state.embeddingCache.latencySumMs + latencyMs,
            latencyCount: state.embeddingCache.latencyCount + 1,
          },
        })),

      /**
       * Get embedding cache metrics snapshot
       */
      getCacheMetrics: Ref.get(stateRef).pipe(
        Effect.map((state) => {
          const { hits, latencyCount, latencySumMs, misses } = state.embeddingCache;
          const total = hits + misses;
          return {
            hits,
            misses,
            hitRate: total > 0 ? hits / total : 0,
            avgLatencyMs: latencyCount > 0 ? latencySumMs / latencyCount : 0,
          };
        })
      ),

      /**
       * Export metrics in Prometheus text format
       */
      toPrometheus: Effect.gen(function* () {
        const state = yield* Ref.get(stateRef);
        const lines: Array<string> = [];

        // Extraction metrics
        lines.push("# HELP extraction_total Total extraction requests");
        lines.push("# TYPE extraction_total counter");
        lines.push(`extraction_total ${state.extractions.total}`);

        lines.push("# HELP extraction_successful_total Successful extractions");
        lines.push("# TYPE extraction_successful_total counter");
        lines.push(`extraction_successful_total ${state.extractions.successful}`);

        lines.push("# HELP extraction_failed_total Failed extractions");
        lines.push("# TYPE extraction_failed_total counter");
        lines.push(`extraction_failed_total ${state.extractions.failed}`);

        lines.push("# HELP extraction_duration_ms_sum Sum of extraction durations");
        lines.push("# TYPE extraction_duration_ms_sum counter");
        lines.push(`extraction_duration_ms_sum ${state.extractions.durationSum}`);

        lines.push("# HELP extraction_entity_count_sum Sum of entities extracted");
        lines.push("# TYPE extraction_entity_count_sum counter");
        lines.push(`extraction_entity_count_sum ${state.extractions.entitySum}`);

        lines.push("# HELP extraction_relation_count_sum Sum of relations extracted");
        lines.push("# TYPE extraction_relation_count_sum counter");
        lines.push(`extraction_relation_count_sum ${state.extractions.relationSum}`);

        // LLM call metrics
        lines.push("# HELP llm_call_total Total LLM API calls");
        lines.push("# TYPE llm_call_total counter");

        lines.push("# HELP llm_call_duration_ms_sum Sum of LLM call durations");
        lines.push("# TYPE llm_call_duration_ms_sum counter");

        lines.push("# HELP llm_tokens_in_sum Sum of input tokens");
        lines.push("# TYPE llm_tokens_in_sum counter");

        lines.push("# HELP llm_tokens_out_sum Sum of output tokens");
        lines.push("# TYPE llm_tokens_out_sum counter");

        for (const [key, metrics] of state.llmCalls) {
          const [provider, model] = key.split(":");
          const labels = `provider="${provider}",model="${model}"`;

          lines.push(`llm_call_total{${labels}} ${metrics.total}`);
          lines.push(`llm_call_duration_ms_sum{${labels}} ${metrics.durationSum}`);
          lines.push(`llm_tokens_in_sum{${labels}} ${metrics.tokensInSum}`);
          lines.push(`llm_tokens_out_sum{${labels}} ${metrics.tokensOutSum}`);
        }

        // Embedding cache metrics
        lines.push("# HELP embedding_cache_hits_total Total embedding cache hits");
        lines.push("# TYPE embedding_cache_hits_total counter");
        lines.push(`embedding_cache_hits_total ${state.embeddingCache.hits}`);

        lines.push("# HELP embedding_cache_misses_total Total embedding cache misses");
        lines.push("# TYPE embedding_cache_misses_total counter");
        lines.push(`embedding_cache_misses_total ${state.embeddingCache.misses}`);

        const cacheTotal = state.embeddingCache.hits + state.embeddingCache.misses;
        const hitRate = cacheTotal > 0 ? state.embeddingCache.hits / cacheTotal : 0;
        lines.push("# HELP embedding_cache_hit_rate Embedding cache hit rate (0-1)");
        lines.push("# TYPE embedding_cache_hit_rate gauge");
        lines.push(`embedding_cache_hit_rate ${hitRate.toFixed(4)}`);

        const avgLatency =
          state.embeddingCache.latencyCount > 0
            ? state.embeddingCache.latencySumMs / state.embeddingCache.latencyCount
            : 0;
        lines.push("# HELP embedding_cache_latency_ms_avg Average cache lookup latency");
        lines.push("# TYPE embedding_cache_latency_ms_avg gauge");
        lines.push(`embedding_cache_latency_ms_avg ${avgLatency.toFixed(2)}`);

        lines.push("# HELP embedding_cache_latency_ms_sum Sum of cache lookup latencies");
        lines.push("# TYPE embedding_cache_latency_ms_sum counter");
        lines.push(`embedding_cache_latency_ms_sum ${state.embeddingCache.latencySumMs}`);

        return lines.join("\n");
      }),

      /**
       * Reset all metrics (for testing)
       */
      reset: Ref.set(stateRef, {
        ...initialState,
        llmCalls: HashMap.empty(),
        embeddingCache: {
          hits: 0,
          misses: 0,
          latencySumMs: 0,
          latencyCount: 0,
        },
      }),
    };
  }),
}) {
  static readonly Default = Layer.effect(this, this.make);
}
