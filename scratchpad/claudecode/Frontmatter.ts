/**
 * Effectful YAML frontmatter parsing, rendering, and runtime models for Claude
 * Code skills, subagents, commands, and output styles.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Re-exports the generic decoded-frontmatter result type.
 *
 * @category models
 * @since 0.0.0
 */
export type { DecodedFrontmatter } from "./Frontmatter/Parser.ts";
/**
 * Re-exports the parsed frontmatter model and file-decoding operations.
 *
 * @category parsing
 * @since 0.0.0
 */
export {
  ParsedFrontmatter,
  parse,
  parseCommandFile,
  parseFile,
  parseOutputStyleFile,
  parseSkillFile,
  parseSubagentFile,
} from "./Frontmatter/Parser.ts";
/**
 * Re-exports the rendered frontmatter model and formatting operations.
 *
 * @category formatting
 * @since 0.0.0
 */
export {
  FrontmatterDocument,
  render,
  renderCommand,
  renderOutputStyle,
  renderSkill,
  renderSubagent,
} from "./Frontmatter/Render.ts";

// ---------------------------------------------------------------------------
// Per-file-type schemas
// ---------------------------------------------------------------------------

/**
 * Re-exports the command frontmatter model.
 *
 * @category models
 * @since 0.0.0
 */
export { CommandFrontmatter } from "./Frontmatter/Command.ts";

/**
 * Re-exports the output-style frontmatter model.
 *
 * @category models
 * @since 0.0.0
 */
export { OutputStyleFrontmatter } from "./Frontmatter/OutputStyle.ts";

/**
 * Re-exports skill frontmatter schemas and shared domain vocabulary.
 *
 * @category models
 * @since 0.0.0
 */
export {
  EffortLevel,
  FrontmatterShell,
  SkillFrontmatter,
  StringOrStringArray,
} from "./Frontmatter/Skill.ts";

/**
 * Re-exports the subagent frontmatter model and its color vocabulary.
 *
 * @category models
 * @since 0.0.0
 */
export { SubagentColor, SubagentFrontmatter } from "./Frontmatter/Subagent.ts";
