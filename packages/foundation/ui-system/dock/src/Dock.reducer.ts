/**
 * Public reducer surface: validated command transitions and snapshot restore.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
export {
  /**
   * @category utilities
   * @since 0.0.0
   */
  reduceDockCommand,
  /**
   * @category utilities
   * @since 0.0.0
   */
  restoreDockWorkspace,
  /**
   * @category validation
   * @since 0.0.0
   */
  validateWorkspace,
} from "./internal/Reducer.ts";
