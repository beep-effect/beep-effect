/**
 * Documents server test layer.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

/**
 * Deterministic DMS mirror fixture exports for tests and smoke runs.
 *
 * @category testing
 * @since 0.0.0
 */
export {
  DmsMirrorFixtureCounts,
  DmsMirrorFixtureHandle,
  type DmsMirrorFixtureHandleShape,
  DmsMirrorFixtureLayer,
  DmsMirrorFixtureNode,
  DmsMirrorFixtureVerb,
  makeDmsMirrorFixture,
} from "./aggregates/Sync/DmsMirrorFixture.js";
/**
 * Deterministic documents server test layers.
 *
 * @category testing
 * @since 0.0.0
 */
export { DocumentsServerLive as DocumentsServerTest, DocumentsSyncFixtureLive as DocumentsSyncTest } from "./Layer.js";
