/**
 * Cluster Module
 *
 * Effect Cluster integration for distributed knowledge graph extraction:
 * - Entity-based sharding by idempotency key
 * - Streaming progress events with backpressure
 * - Automatic result caching
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export * from "./BackpressureHandler.ts";
export * from "./ExtractionEntity.ts";
export * from "./ExtractionEntityHandler.ts";
