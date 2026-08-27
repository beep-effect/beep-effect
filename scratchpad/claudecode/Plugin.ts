/**
 * Plugin module hub — schemas and materializer for Claude Code plugin
 * manifests, marketplaces, and directory layouts.
 *
 * Users import this as a namespace:
 * `import { Plugin } from 'effect-claudecode'`
 * and access members as `Plugin.define`, `Plugin.write`,
 * `Plugin.PluginManifest`, etc.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

// ---------------------------------------------------------------------------
// Manifest schemas
// ---------------------------------------------------------------------------

/**
 * Re-exports plugin manifest schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  AuthorInfo,
  ChannelSpec,
  ComponentPathSpec,
  DependencySpec,
  ExperimentalSpec,
  HooksSpec,
  PluginDependency,
  PluginManifest,
  ServerConfigSpec,
  UserConfigEntry,
  UserConfigRecord,
  UserConfigType,
} from "./Plugin/Manifest.ts";

// ---------------------------------------------------------------------------
// Marketplace schemas
// ---------------------------------------------------------------------------

/**
 * Re-exports marketplace catalog schemas.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  GithubPluginSource,
  GitSubdirPluginSource,
  MarketplaceFile,
  MarketplaceMetadata,
  MarketplacePluginEntry,
  MarketplacePluginSourceSpec,
  NpmPluginSource,
  UrlPluginSource,
} from "./Plugin/Marketplace.ts";

// ---------------------------------------------------------------------------
// Builder + writer
// ---------------------------------------------------------------------------

/**
 * Re-exports encoded constructor configuration and materialized component models.
 *
 * @category models
 * @since 0.0.0
 */
export type {
  PluginAgentConfig,
  PluginCommandConfig,
  PluginOutputStyleConfig,
  PluginSkillConfig,
} from "./Plugin/Define.ts";
/**
 * Re-exports plugin constructors and filesystem serialization.
 *
 * @category serialization
 * @since 0.0.0
 */
export {
  agent,
  command,
  define,
  outputStyle,
  PluginAgentEntry,
  PluginCommandEntry,
  PluginConfig,
  PluginDefinition,
  PluginOutputStyleEntry,
  PluginSkillEntry,
  skill,
  write,
} from "./Plugin/Define.ts";

/**
 * Plugin path, file-kind, and manifest-layout operations.
 *
 * @category normalization
 * @since 0.0.0
 */
export * as Layout from "./Plugin/Layout.ts";

/**
 * Re-exports loaded plugin directory models.
 *
 * @category models
 * @since 0.0.0
 */
export { LoadedPlugin, load, PluginScan, scan, sync } from "./Plugin/Load.ts";

/**
 * Re-exports the on-disk plugin diagnostic report model.
 *
 * @category diagnostics
 * @since 0.0.0
 */
export {
  doctor,
  lint,
  PluginDoctorReport,
  PluginIssue,
  PluginIssueSeverity,
  PluginLintReport,
  PluginValidationError,
  validate,
} from "./Plugin/Validate.ts";
