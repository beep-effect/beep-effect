/**
 * Cluster Module
 *
 * Effect Cluster integration for distributed knowledge graph extraction:
 * - Entity-based sharding by idempotency key
 * - Streaming progress events with backpressure
 * - Automatic result caching
 *
 * @since 2.0.0
 * @module Cluster
 */

export * from "./BackpressureHandler.ts";
export * from "./ExtractionEntity.ts";
export * from "./ExtractionEntityHandler.ts";
