/**
 * Settings module hub — schemas and loader for Claude Code's
 * settings.json files.
 *
 * @since 0.0.0
 */

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Re-export the settings schemas from the module hub.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  AttributionConfig,
  DirectorySourceSpec,
  EffortLevel,
  GithubSourceSpec,
  GitSourceSpec,
  HostPatternSourceSpec,
  Marketplace,
  MarketplacePolicySourceSpec,
  MarketplaceSourceSpec,
  McpServerPolicyMatcher,
  PermissionMode,
  PermissionsConfig,
  PluginOptionsConfig,
  PolicyHelperConfig,
  SandboxConfig,
  SandboxFilesystemConfig,
  SandboxNetworkConfig,
  SettingsFile,
  SettingsRaw,
  SettingsSourceSpec,
  StatusLineConfig,
  VoiceConfig,
  WorktreeConfig,
} from "./Settings/Schema.ts";

// ---------------------------------------------------------------------------
// Hooks section
// ---------------------------------------------------------------------------

/**
 * Re-export settings hook schemas from the module hub.
 *
 * @category hooks
 * @since 0.0.0
 */
export {
  AgentHookEntry,
  CommandHookEntry,
  HookEntry,
  HookEntryType,
  HookMatcherGroup,
  HookShell,
  HooksSection,
  HttpHookEntry,
  McpToolHookEntry,
  PromptHookEntry,
} from "./Settings/HooksSection.ts";

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Re-export settings loading and path operations from the module hub.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  LoadOptions,
  load,
  localSettingsPath,
  projectSettingsPath,
  userSettingsPath,
} from "./Settings/Loader.ts";
