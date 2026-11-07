/**
 * Git command facade.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Public git command exports.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export { gitCommand, regenerateMergeDriverMessage } from "./Git.command.ts";
/**
 * Public merge-driver schema exports.
 *
 * @category models
 * @since 0.0.0
 */
export {
  GoalManifestProjectionPath,
  MergeDriverProjectionFile,
  MergeDriverProjectionPath,
} from "./Git.schemas.ts";
