/**
 * Wink NLP driver package.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Package version constant.
 *
 * **Example** (Create versioned InstanceId)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { InstanceId, VERSION } from "@beep/wink"
 *
 * const versionedInstance = InstanceId.make(`wink-engine-${VERSION}`)
 *
 * strictEqual(versionedInstance, "wink-engine-0.0.0")
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;

/**
 * @since 0.0.0
 * @category errors
 */
export * from "./Wink.errors.ts";
/**
 * @since 0.0.0
 * @category layers
 */
export { WinkLayerAllLive, WinkLayerLive } from "./Wink.layer.ts";
/**
 * @since 0.0.0
 * @category models
 */
export * from "./Wink.models.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./Wink.service.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WinkBackend.service.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WinkCorpus.service.ts";
/**
 * @since 0.0.0
 * @category services
 */
export { WinkEngineRef, WinkEngineRefLive } from "./WinkEngineRef.service.ts";
/**
 * @since 0.0.0
 * @category observability
 */
export * from "./WinkObservability.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WinkSimilarity.service.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WinkTokenization.service.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WinkTools.service.ts";
/**
 * @since 0.0.0
 * @category utilities
 */
export * from "./WinkUtils.service.ts";
/**
 * @since 0.0.0
 * @category services
 */
export * from "./WinkVectorizer.service.ts";
