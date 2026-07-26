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
  type EffortLevelEncoded,
  GithubSourceSpec,
  GitSourceSpec,
  HostPatternSourceSpec,
  Marketplace,
  MarketplacePolicySourceSpec,
  type MarketplacePolicySourceSpecEncoded,
  MarketplaceSourceSpec,
  type MarketplaceSourceSpecEncoded,
  McpServerPolicyMatcher,
  type McpServerPolicyMatcherEncoded,
  PermissionMode,
  type PermissionModeEncoded,
  PermissionsConfig,
  PluginOptionsConfig,
  PolicyHelperConfig,
  SandboxConfig,
  SandboxFilesystemConfig,
  SandboxNetworkConfig,
  SettingsFile,
  SettingsRaw,
  type SettingsRawEncoded,
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
  type HookEntryEncoded,
  HookEntryType,
  type HookEntryTypeEncoded,
  HookMatcherGroup,
  HookShell,
  type HookShellEncoded,
  HooksSection,
  type HooksSectionEncoded,
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
