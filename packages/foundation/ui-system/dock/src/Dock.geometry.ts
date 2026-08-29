/**
 * Public geometry projection surface: pixel boxes, sash rects, and
 * reactive geometry atoms derived from the dock workspace tree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export {
  /**
   * @category models
   * @since 0.0.0
   */
  DockBox,
  /**
   * @category models
   * @since 0.0.0
   */
  DockGeometry,
  /**
   * @category models
   * @since 0.0.0
   */
  FloatingGeometry,
  /**
   * @category models
   * @since 0.0.0
   */
  GeometryOptions,
  /**
   * @category models
   * @since 0.0.0
   */
  GroupGeometry,
  /**
   * @category models
   * @since 0.0.0
   */
  type GroupMinimaRecord,
  /**
   * @category models
   * @since 0.0.0
   */
  type GroupMinimumLookup,
  /**
   * @category projections
   * @since 0.0.0
   */
  resolveAnchoredBox,
  /**
   * @category models
   * @since 0.0.0
   */
  SashGeometry,
} from "./Geometry.models.ts";
export {
  /**
   * @category projections
   * @since 0.0.0
   */
  makeDockGeometryAtoms,
  /**
   * @category projections
   * @since 0.0.0
   */
  project,
  /**
   * @category projections
   * @since 0.0.0
   */
  projectWorkspace,
} from "./internal/Geometry.projection.ts";
