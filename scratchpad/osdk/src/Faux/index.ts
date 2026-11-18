/**
 * An in-memory platform: a world of objects and links, a reference interpreter over it, and the transport built on both.
 *
 * **Details**
 *
 * For tests and local development. It evaluates filters, object sets,
 * ordering, paging and aggregations exactly and refuses what it does not
 * model with a typed error. It is not a model of the platform's performance
 * or of its search-engine tokenisation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * @category queries
 * @since 0.0.0
 */
export * from "./Faux.behavior.ts";
/**
 * @category layers
 * @since 0.0.0
 */
export * from "./Faux.layer.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./Faux.model.ts";
