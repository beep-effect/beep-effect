/**
 * CLI tool for creating and managing packages in the beep-effect monorepo.
 *
 * ## Mental model
 *
 * - **Package creation** - Scaffold new packages following effect-smol patterns
 * - **Code generation** - Generate barrel files and exports
 * - **Topological sort** - Output packages in dependency order
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

/**
 * Agent-effectiveness evidence command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Agent-effectiveness evidence command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  agentEffectivenessCommand,
} from "./commands/AgentEffectiveness/index.ts";
/**
 * CI helper command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * CI helper command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  ciCommand,
} from "./commands/Ci/index.ts";
/**
 * Code generation command for workspace barrels and exports.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Code generation command for workspace barrels and exports.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  codegenCommand,
} from "./commands/Codegen/index.ts";
/**
 * Codex helper command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Codex helper command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  codexCommand,
} from "./commands/Codex/index.ts";
/**
 * Corpus curation command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Corpus curation command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  corpusCommand,
} from "./commands/Corpus/index.ts";
/**
 * Package scaffolding command for creating new workspace packages.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Package scaffolding command for creating new workspace packages.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  createPackageCommand,
} from "./commands/CreatePackage/index.ts";
/**
 * Complete package deletion and registration-residue doctor command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export { deletePackageCommand } from "./commands/DeletePackage/index.ts";
/**
 * Human-first docgen command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Human-first docgen command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  docgenCommand,
} from "./commands/Docgen/index.ts";
/**
 * Command-first docs discovery command tree.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Command-first docs discovery command tree.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  docsCommand,
} from "./commands/Docs/index.ts";
/**
 * Fallow quality-tooling command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Fallow quality-tooling command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  fallowCommand,
} from "./commands/Fallow/index.ts";
/**
 * Dataset file curation command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Dataset file curation command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  filesCommand,
} from "./commands/Files/index.ts";
/**
 * Image and video curation command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Image and video curation command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  imageCommand,
} from "./commands/Image/index.ts";
/**
 * Knowledge-surface verification command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Knowledge-surface verification command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  knowledgeCommand,
} from "./commands/Knowledge/index.ts";
/**
 * Lab-app lifecycle command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Lab-app lifecycle command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  labsCommand,
} from "./commands/Labs/index.ts";
/**
 * Effect laws command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Effect laws command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  lawsCommand,
} from "./commands/Laws/index.ts";
/**
 * Lint policy command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Lint policy command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  lintCommand,
} from "./commands/Lint/index.ts";
/**
 * Purge command for removing root/workspace build artifacts.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Purge command for removing root/workspace build artifacts.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  purgeCommand,
} from "./commands/Purge/index.ts";
/**
 * Recorded UI-verification command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Recorded UI-verification command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  qaCommand,
} from "./commands/Qa/index.ts";
/**
 * Repository operational quality command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Repository operational quality command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  qualityCommand,
} from "./commands/Quality/index.ts";
/**
 * Root CLI command that composes subcommands.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Root CLI command that composes subcommands.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  rootCommand,
} from "./commands/Root.ts";
/**
 * Runner AMI command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export { runnersCommand } from "./commands/Runners/index.ts";
/**
 * Official data sync command for checked-in generated TypeScript modules.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Official data sync command for checked-in generated TypeScript modules.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  syncDataToTsCommand,
} from "./commands/SyncDataToTs/index.ts";
/**
 * Dependency topological sort command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Dependency topological sort command.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  topoSortCommand,
} from "./commands/TopoSort/index.ts";
/**
 * Tsconfig sync command for workspace tsconfig references and root aliases.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Tsconfig sync command for workspace tsconfig references and root aliases.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  tsconfigSyncCommand,
} from "./commands/TsconfigSync/index.ts";
/**
 * Version sync command for detecting and fixing version drift.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Version sync command for detecting and fixing version drift.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  versionSyncCommand,
} from "./commands/VersionSync/index.ts";
/**
 * Sibling git-worktree management command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Sibling git-worktree management command.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  worktreeCommand,
} from "./commands/Worktree/index.ts";
/**
 * Yeet quality feedback and publish command.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Yeet quality feedback and publish command.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  yeetCommand,
} from "./commands/Yeet/index.ts";
