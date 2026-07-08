/**
 * Time-window and retention selector helpers for AI metrics commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  hasBoundedRetentionMutationWindow,
  hasOrderedRetentionMutationWindow,
  hasRetentionWindow,
  parseChecks,
  parseEpochMillisOption,
  parseOptionalEpochMillis,
  parseRetentionSelector,
  parseSinceEpochMillis,
  parseWindow,
} from "./Programs.js";
