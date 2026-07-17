/**
 * Browser-safe graph-3d driver entrypoint. Client packages import the driver
 * only through `@beep/graph-3d/browser`; this surface re-exports the pure
 * contracts so it is self-sufficient for client code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Lazy instanced three.js render adapter.
 *
 * @category adapters
 * @since 0.0.0
 */
export * from "./Graph3D.renderer.js";
/**
 * Node-safe contracts re-exported for browser callers.
 *
 * @category projections
 * @since 0.0.0
 */
export * from "./index.js";
