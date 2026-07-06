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
 * @example
 * ```ts
 * import { agentEffectivenessCommand } from "@beep/repo-cli"
 *
 * console.log(agentEffectivenessCommand)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Agent-effectiveness evidence command group.
   *
   * @example
   * ```ts
   * import { agentEffectivenessCommand } from "@beep/repo-cli"
   *
   * console.log(agentEffectivenessCommand)
   * ```
   * @category cli-commands
   * @since 0.0.0
   */
  agentEffectivenessCommand,
} from "./commands/AgentEffectiveness/index.js";
/**
 * CI helper command group.
 *
 * @example
 * ```ts
 * import { ciCommand } from "@beep/repo-cli"
 *
 * console.log(ciCommand)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * CI helper command group.
   *
   * @example
   * ```ts
   * import { ciCommand } from "@beep/repo-cli"
   *
   * console.log(ciCommand)
   * ```
   * @category cli-commands
   * @since 0.0.0
   */
  ciCommand,
} from "./commands/Ci/index.js";
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
} from "./commands/Codegen/index.js";
/**
 * Codex helper command group.
 *
 * @example
 * ```ts
 * import { codexCommand } from "@beep/repo-cli"
 *
 * console.log(codexCommand)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Codex helper command group.
   *
   * @example
   * ```ts
   * import { codexCommand } from "@beep/repo-cli"
   *
   * console.log(codexCommand)
   * ```
   * @category cli-commands
   * @since 0.0.0
   */
  codexCommand,
} from "./commands/Codex/index.js";
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
   * @example
   * ```ts
   * import { corpusCommand } from "@beep/repo-cli"
   *
   * console.log(corpusCommand)
   * ```
   * @category cli-commands
   * @since 0.0.0
   */
  corpusCommand,
} from "./commands/Corpus/index.js";
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
} from "./commands/CreatePackage/index.js";
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
} from "./commands/Docgen/index.js";
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
} from "./commands/Docs/index.js";
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
} from "./commands/Fallow/index.js";
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
} from "./commands/Files/index.js";
/**
 * Graphiti operational command group.
 *
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Graphiti operational command group.
   *
   * @category cli-commands
   * @since 0.0.0
   */
  graphitiCommand,
} from "./commands/Graphiti/index.js";
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
} from "./commands/Image/index.js";
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
} from "./commands/Laws/index.js";
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
} from "./commands/Lint/index.js";
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
} from "./commands/Purge/index.js";
/**
 * Repository operational quality command group.
 *
 * @example
 * ```ts
 * import { qualityCommand } from "@beep/repo-cli"
 *
 * console.log(qualityCommand)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export {
  /**
   * Repository operational quality command group.
   *
   * @example
   * ```ts
   * import { qualityCommand } from "@beep/repo-cli"
   *
   * console.log(qualityCommand)
   * ```
   * @category cli-commands
   * @since 0.0.0
   */
  qualityCommand,
} from "./commands/Quality/index.js";
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
} from "./commands/Root.js";
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
} from "./commands/SyncDataToTs/index.js";
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
} from "./commands/TopoSort/index.js";
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
} from "./commands/TsconfigSync/index.js";
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
} from "./commands/VersionSync/index.js";
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
} from "./commands/Worktree/index.js";
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
} from "./commands/Yeet/index.js";
