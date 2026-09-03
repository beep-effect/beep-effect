/**
 * Source-only test kit for Knowledge command internals.
 *
 * @internal
 * @since 0.0.0
 */

export {
  applyKnowledgeRefsCheck,
  renderKnowledgeRefsCheckSection,
  renderKnowledgeSemanticDeltaHumanReport,
} from "../commands/Knowledge/Knowledge.command.ts";
export { KnowledgeCommandSurface } from "../commands/Knowledge/Knowledge.command-surface.ts";
export {
  gitRefSpanNamesForTesting,
  makeKnowledgeArchiveOracle,
} from "../commands/Knowledge/Knowledge.service.ts";
