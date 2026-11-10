/**
 * Source-only test kit for Knowledge command internals.
 *
 * @internal
 * @since 0.0.0
 */

export {
  applyKnowledgeRefsCheck,
  renderKnowledgeDoctorCheckReport,
  renderKnowledgeDoctorHumanReport,
  renderKnowledgeLeasesReport,
  renderKnowledgeMintOutcome,
  renderKnowledgeRefsCheckSection,
  renderKnowledgeSemanticDeltaHumanReport,
} from "../commands/Knowledge/Knowledge.command.ts";
export { KnowledgeCommandSurface } from "../commands/Knowledge/Knowledge.command-surface.ts";
export {
  gitRefSpanNamesForTesting,
  inSequenceOrderForTesting,
  knowledgeTrackedPathExistsForTesting,
  makeKnowledgeArchiveOracle,
  sharesStaticCommandSurfaceForTesting,
} from "../commands/Knowledge/Knowledge.service.ts";
export { readKnowledgeDoctorCheckSidesForTesting } from "../commands/Knowledge/KnowledgeDoctor.service.ts";
