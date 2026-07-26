/**
 * Schema-backed model of Claude Code 2.1.220 `settings.json`.
 *
 * The official settings reference is the primary contract. The published
 * SchemaStore schema supplies additional structural detail where it agrees
 * with that reference. Unknown top-level keys are retained separately by the
 * loader through {@link SettingsRaw}.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

import { HooksSection } from "./HooksSection.ts";

const $I = $ScratchpadId.create("claudecode/Settings/Schema");

// ---------------------------------------------------------------------------
// Literal domains
// ---------------------------------------------------------------------------

/**
 * Permission modes accepted by Claude Code 2.1.220.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * console.log(Settings.PermissionMode.is.manual("manual"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PermissionMode = LiteralKit([
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
  // Claude Code >=2.1.200 accepts this as an alias for `default`.
  "manual",
]).pipe(
  $I.annoteSchema("PermissionMode", {
    description: "Permission policy selected for a Claude Code session.",
  })
);

/**
 * Companion types for {@link PermissionMode}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.PermissionMode.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PermissionMode {
  /**
   * Runtime type represented by {@link PermissionMode}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof PermissionMode.Type;
  /**
   * JSON representation accepted by {@link PermissionMode}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PermissionMode.Encoded;
}

/**
 * Persisted reasoning-effort levels.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * console.log(Settings.EffortLevel.is.xhigh("xhigh"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const EffortLevel = LiteralKit(["low", "medium", "high", "xhigh"]).pipe(
  $I.annoteSchema("EffortLevel", {
    description: "Current Claude Code reasoning-effort setting.",
  })
);

/**
 * Companion types for {@link EffortLevel}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.EffortLevel.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EffortLevel {
  /**
   * Runtime type represented by {@link EffortLevel}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof EffortLevel.Type;
  /**
   * JSON representation accepted by {@link EffortLevel}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof EffortLevel.Encoded;
}

const AskUserQuestionTimeout = LiteralKit(["60s", "5m", "10m", "never"]).pipe(
  $I.annoteSchema("AskUserQuestionTimeout", {
    description: "Idle timeout for an unanswered AskUserQuestion dialog.",
  })
);

const AutoUpdatesChannel = LiteralKit(["stable", "latest"]).pipe(
  $I.annoteSchema("AutoUpdatesChannel", {
    description: "Claude Code update channel.",
  })
);

const DefaultShell = LiteralKit(["bash", "powershell"]).pipe(
  $I.annoteSchema("DefaultShell", {
    description: "Shell used for input-box shell commands.",
  })
);

const EditorMode = LiteralKit(["normal", "vim"]).pipe(
  $I.annoteSchema("EditorMode", {
    description: "Interactive prompt key-binding mode.",
  })
);

const ForceLoginMethod = LiteralKit(["claudeai", "console", "gateway"]).pipe(
  $I.annoteSchema("ForceLoginMethod", {
    description: "Authentication surface permitted by managed settings.",
  })
);

const NotificationChannel = LiteralKit([
  "auto",
  "terminal_bell",
  "iterm2",
  "iterm2_with_bell",
  "kitty",
  "ghostty",
  "notifications_disabled",
]).pipe(
  $I.annoteSchema("NotificationChannel", {
    description: "Delivery channel for Claude Code notifications.",
  })
);

const ParentSettingsBehavior = LiteralKit(["first-wins", "merge"]).pipe(
  $I.annoteSchema("ParentSettingsBehavior", {
    description: "Managed parent-settings composition behavior.",
  })
);

const SkillVisibility = LiteralKit(["on", "name-only", "user-invocable-only", "off"]).pipe(
  $I.annoteSchema("SkillVisibility", {
    description: "Visibility policy for a named skill.",
  })
);

const StrictCustomizationSurface = LiteralKit(["skills", "agents", "hooks", "mcp"]).pipe(
  $I.annoteSchema("StrictCustomizationSurface", {
    description: "Customization surface restricted to plugins and managed settings.",
  })
);

const TeammateMode = LiteralKit(["in-process", "auto", "tmux", "iterm2"]).pipe(
  $I.annoteSchema("TeammateMode", {
    description: "Display strategy for agent-team teammates.",
  })
);

const TuiMode = LiteralKit(["fullscreen", "default"]).pipe(
  $I.annoteSchema("TuiMode", {
    description: "Terminal renderer selected for Claude Code.",
  })
);

const BuiltInTheme = LiteralKit([
  "auto",
  "dark",
  "light",
  "dark-daltonized",
  "light-daltonized",
  "dark-ansi",
  "light-ansi",
]).pipe(
  $I.annoteSchema("BuiltInTheme", {
    description: "Built-in Claude Code terminal color theme.",
  })
);

const CustomTheme = S.String.check(S.isPattern(/^custom:.+$/u)).pipe(
  $I.annoteSchema("CustomTheme", {
    description: "Reference to a custom Claude Code theme.",
  })
);

const Theme = S.Union([BuiltInTheme, CustomTheme]).pipe(
  $I.annoteSchema("Theme", {
    description: "Built-in or custom Claude Code color theme.",
  })
);

const ViewMode = LiteralKit(["default", "verbose", "focus"]).pipe(
  $I.annoteSchema("ViewMode", {
    description: "Default transcript presentation mode.",
  })
);

const VoiceMode = LiteralKit(["hold", "tap"]).pipe(
  $I.annoteSchema("VoiceMode", {
    description: "Voice-dictation recording mode.",
  })
);

const WorktreeBaseRef = LiteralKit(["fresh", "head"]).pipe(
  $I.annoteSchema("WorktreeBaseRef", {
    description: "Reference from which Claude Code creates worktrees.",
  })
);

const WorktreeBgIsolation = LiteralKit(["worktree", "none"]).pipe(
  $I.annoteSchema("WorktreeBgIsolation", {
    description: "Filesystem isolation strategy for background sessions.",
  })
);

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/**
 * Tool-use permission rules for a settings source.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const permissions = Settings.PermissionsConfig.make({
 *   allow: O.some(["Read(./src/**)"])
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PermissionsConfig extends S.Class<PermissionsConfig>($I`PermissionsConfig`)(
  {
    allow: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    ask: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    deny: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    additionalDirectories: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    defaultMode: S.OptionFromOptionalKey(PermissionMode).pipe(SchemaUtils.withNoneDefault),
    disableBypassPermissionsMode: S.OptionFromOptionalKey(S.Literal("disable")).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionsConfig", {
    description: "Tool-use permissions from a Claude Code settings file.",
  })
) {}

/**
 * Companion types for {@link PermissionsConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.PermissionsConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PermissionsConfig {
  /**
   * Runtime type represented by {@link PermissionsConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PermissionsConfig;
  /**
   * JSON representation accepted by {@link PermissionsConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PermissionsConfig.Encoded;
}

// ---------------------------------------------------------------------------
// Sandbox
// ---------------------------------------------------------------------------

/**
 * Filesystem isolation rules for sandboxed commands.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const filesystem = Settings.SandboxFilesystemConfig.make({
 *   allowWrite: O.some(["/tmp/build"])
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SandboxFilesystemConfig extends S.Class<SandboxFilesystemConfig>($I`SandboxFilesystemConfig`)(
  {
    allowWrite: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    denyWrite: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    denyRead: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowRead: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowManagedReadPathsOnly: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SandboxFilesystemConfig", {
    description: "Filesystem restrictions for Claude Code's command sandbox.",
  })
) {}

/**
 * Companion types for {@link SandboxFilesystemConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.SandboxFilesystemConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SandboxFilesystemConfig {
  /**
   * Runtime type represented by {@link SandboxFilesystemConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SandboxFilesystemConfig;
  /**
   * JSON representation accepted by {@link SandboxFilesystemConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SandboxFilesystemConfig.Encoded;
}

class SandboxTlsTerminateConfig extends S.Class<SandboxTlsTerminateConfig>($I`SandboxTlsTerminateConfig`)(
  {
    caCertPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    caKeyPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SandboxTlsTerminateConfig", {
    description: "TLS termination certificate configuration for the sandbox proxy.",
  })
) {}

/**
 * Network isolation rules for sandboxed commands.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const network = Settings.SandboxNetworkConfig.make({
 *   allowedDomains: O.some(["api.example.com"])
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SandboxNetworkConfig extends S.Class<SandboxNetworkConfig>($I`SandboxNetworkConfig`)(
  {
    allowUnixSockets: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowAllUnixSockets: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowLocalBinding: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowMachLookup: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowedDomains: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    deniedDomains: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowManagedDomainsOnly: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    httpProxyPort: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    socksProxyPort: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    tlsTerminate: S.OptionFromOptionalKey(SandboxTlsTerminateConfig).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SandboxNetworkConfig", {
    description: "Network restrictions for Claude Code's command sandbox.",
  })
) {}

/**
 * Companion types for {@link SandboxNetworkConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.SandboxNetworkConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SandboxNetworkConfig {
  /**
   * Runtime type represented by {@link SandboxNetworkConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SandboxNetworkConfig;
  /**
   * JSON representation accepted by {@link SandboxNetworkConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SandboxNetworkConfig.Encoded;
}

class SandboxCredentialFile extends S.Class<SandboxCredentialFile>($I`SandboxCredentialFile`)(
  {
    path: S.String,
    mode: S.tag("deny"),
  },
  $I.annote("SandboxCredentialFile", {
    description: "Credential path hidden from sandboxed commands.",
  })
) {}

class SandboxCredentialEnvVar extends S.Class<SandboxCredentialEnvVar>($I`SandboxCredentialEnvVar`)(
  {
    name: S.String,
    mode: LiteralKit(["deny", "mask"]).pipe(
      $I.annoteSchema("SandboxCredentialEnvVarMode", {
        description: "Protection applied to a credential environment variable.",
      })
    ),
    injectHosts: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SandboxCredentialEnvVar", {
    description: "Credential environment variable protected inside the sandbox.",
  })
) {}

class SandboxCredentialsConfig extends S.Class<SandboxCredentialsConfig>($I`SandboxCredentialsConfig`)(
  {
    files: S.OptionFromOptionalKey(SandboxCredentialFile.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    envVars: S.OptionFromOptionalKey(SandboxCredentialEnvVar.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowPlaintextInject: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SandboxCredentialsConfig", {
    description: "Credential protections enforced for sandboxed commands.",
  })
) {}

/**
 * Claude Code command-sandbox configuration.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const sandbox = Settings.SandboxConfig.make({ enabled: O.some(true) })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SandboxConfig extends S.Class<SandboxConfig>($I`SandboxConfig`)(
  {
    enabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    failIfUnavailable: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    autoAllowBashIfSandboxed: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    excludedCommands: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowUnsandboxedCommands: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    filesystem: S.OptionFromOptionalKey(SandboxFilesystemConfig).pipe(SchemaUtils.withNoneDefault),
    credentials: S.OptionFromOptionalKey(SandboxCredentialsConfig).pipe(SchemaUtils.withNoneDefault),
    network: S.OptionFromOptionalKey(SandboxNetworkConfig).pipe(SchemaUtils.withNoneDefault),
    enableWeakerNestedSandbox: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    enableWeakerNetworkIsolation: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowAppleEvents: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    bwrapPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    socatPath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SandboxConfig", {
    description: "Command-sandbox policy from Claude Code settings.",
  })
) {}

/**
 * Companion types for {@link SandboxConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.SandboxConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SandboxConfig {
  /**
   * Runtime type represented by {@link SandboxConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SandboxConfig;
  /**
   * JSON representation accepted by {@link SandboxConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SandboxConfig.Encoded;
}

// ---------------------------------------------------------------------------
// UI and command integrations
// ---------------------------------------------------------------------------

/**
 * Command-backed status-line configuration.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const statusLine = Settings.StatusLineConfig.make({
 *   command: "~/.claude/statusline.sh"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class StatusLineConfig extends S.Class<StatusLineConfig>($I`StatusLineConfig`)(
  {
    type: S.tag("command"),
    command: S.String,
    padding: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    refreshInterval: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    hideVimModeIndicator: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("StatusLineConfig", {
    description: "Custom command used to render Claude Code's status line.",
  })
) {}

/**
 * Companion types for {@link StatusLineConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.StatusLineConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StatusLineConfig {
  /**
   * Runtime type represented by {@link StatusLineConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = StatusLineConfig;
  /**
   * JSON representation accepted by {@link StatusLineConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof StatusLineConfig.Encoded;
}

class FileSuggestionConfig extends S.Class<FileSuggestionConfig>($I`FileSuggestionConfig`)(
  {
    type: S.tag("command"),
    command: S.String,
  },
  $I.annote("FileSuggestionConfig", {
    description: "Command used for at-sign file suggestions.",
  })
) {}

class FooterLinkRegex extends S.Class<FooterLinkRegex>($I`FooterLinkRegex`)(
  {
    type: S.OptionFromOptionalKey(S.Literal("regex")).pipe(SchemaUtils.withNoneDefault),
    pattern: S.String,
    url: S.String,
    label: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("FooterLinkRegex", {
    description: "Regex-driven footer badge and URL template.",
  })
) {}

class SpinnerTipsConfig extends S.Class<SpinnerTipsConfig>($I`SpinnerTipsConfig`)(
  {
    tips: S.String.pipe(S.Array),
    excludeDefault: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SpinnerTipsConfig", {
    description: "Custom tips displayed while Claude Code is working.",
  })
) {}

class SpinnerVerbsConfig extends S.Class<SpinnerVerbsConfig>($I`SpinnerVerbsConfig`)(
  {
    verbs: S.String.pipe(S.Array),
    mode: S.OptionFromOptionalKey(
      LiteralKit(["append", "replace"]).pipe(
        $I.annoteSchema("SpinnerVerbMode", {
          description: "How custom spinner verbs combine with defaults.",
        })
      )
    ).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SpinnerVerbsConfig", {
    description: "Custom action verbs displayed during a turn.",
  })
) {}

class SshConfig extends S.Class<SshConfig>($I`SshConfig`)(
  {
    id: S.String,
    name: S.String,
    sshHost: S.String,
    sshPort: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    sshIdentityFile: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    startDirectory: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SshConfig", {
    description: "Managed SSH connection offered by Claude Desktop.",
  })
) {}

/**
 * Voice-dictation preferences.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const voice = Settings.VoiceConfig.make({
 *   enabled: O.some(true),
 *   mode: O.some("tap")
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class VoiceConfig extends S.Class<VoiceConfig>($I`VoiceConfig`)(
  {
    enabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    mode: S.OptionFromOptionalKey(VoiceMode).pipe(SchemaUtils.withNoneDefault),
    autoSubmit: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("VoiceConfig", {
    description: "Voice-dictation behavior persisted by Claude Code.",
  })
) {}

/**
 * Companion types for {@link VoiceConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.VoiceConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace VoiceConfig {
  /**
   * Runtime type represented by {@link VoiceConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = VoiceConfig;
  /**
   * JSON representation accepted by {@link VoiceConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof VoiceConfig.Encoded;
}

// ---------------------------------------------------------------------------
// MCP policy
// ---------------------------------------------------------------------------

class McpServerNameMatcher extends S.Class<McpServerNameMatcher>($I`McpServerNameMatcher`)(
  { serverName: S.String },
  $I.annote("McpServerNameMatcher", {
    description: "MCP policy matcher selecting a configured server name.",
  })
) {}

class McpServerCommandMatcher extends S.Class<McpServerCommandMatcher>($I`McpServerCommandMatcher`)(
  { serverCommand: S.String.pipe(S.Array) },
  $I.annote("McpServerCommandMatcher", {
    description: "MCP policy matcher selecting an exact command and argument list.",
  })
) {}

class McpServerUrlMatcher extends S.Class<McpServerUrlMatcher>($I`McpServerUrlMatcher`)(
  { serverUrl: S.String },
  $I.annote("McpServerUrlMatcher", {
    description: "MCP policy matcher selecting a remote server URL pattern.",
  })
) {}

/**
 * Managed allow/deny matcher for an MCP server.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const matcher = S.decodeSync(Settings.McpServerPolicyMatcher)({
 *   serverName: "github"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const McpServerPolicyMatcher = S.Union([
  McpServerNameMatcher,
  McpServerCommandMatcher,
  McpServerUrlMatcher,
]).pipe(
  $I.annoteSchema("McpServerPolicyMatcher", {
    description: "Managed MCP server policy matcher.",
  })
);

/**
 * Companion types for {@link McpServerPolicyMatcher}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.McpServerPolicyMatcher.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpServerPolicyMatcher {
  /**
   * Runtime type represented by {@link McpServerPolicyMatcher}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof McpServerPolicyMatcher.Type;
  /**
   * JSON representation accepted by {@link McpServerPolicyMatcher}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof McpServerPolicyMatcher.Encoded;
}

// ---------------------------------------------------------------------------
// Plugin marketplaces
// ---------------------------------------------------------------------------

/**
 * Local-directory marketplace source.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const source = Settings.DirectorySourceSpec.make({ path: "./plugins" })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class DirectorySourceSpec extends S.Class<DirectorySourceSpec>($I`DirectorySourceSpec`)(
  {
    source: S.tag("directory"),
    path: S.String,
  },
  $I.annote("DirectorySourceSpec", {
    description: "Marketplace loaded from a local directory.",
  })
) {}

/**
 * Companion types for {@link DirectorySourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.DirectorySourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DirectorySourceSpec {
  /**
   * Runtime type represented by {@link DirectorySourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = DirectorySourceSpec;
  /**
   * JSON representation accepted by {@link DirectorySourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DirectorySourceSpec.Encoded;
}

/**
 * GitHub-hosted marketplace source.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const source = Settings.GithubSourceSpec.make({ repo: "acme/plugins" })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GithubSourceSpec extends S.Class<GithubSourceSpec>($I`GithubSourceSpec`)(
  {
    source: S.tag("github"),
    repo: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    skipLfs: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GithubSourceSpec", {
    description: "Marketplace loaded from a GitHub repository.",
  })
) {}

/**
 * Companion types for {@link GithubSourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.GithubSourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GithubSourceSpec {
  /**
   * Runtime type represented by {@link GithubSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GithubSourceSpec;
  /**
   * JSON representation accepted by {@link GithubSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GithubSourceSpec.Encoded;
}

/**
 * Generic Git marketplace source.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const source = Settings.GitSourceSpec.make({
 *   url: "https://git.example.com/plugins.git"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GitSourceSpec extends S.Class<GitSourceSpec>($I`GitSourceSpec`)(
  {
    source: S.tag("git"),
    url: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    skipLfs: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GitSourceSpec", {
    description: "Marketplace loaded from a Git repository.",
  })
) {}

/**
 * Companion types for {@link GitSourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.GitSourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GitSourceSpec {
  /**
   * Runtime type represented by {@link GitSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GitSourceSpec;
  /**
   * JSON representation accepted by {@link GitSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GitSourceSpec.Encoded;
}

/**
 * Marketplace trust rule selected by host pattern.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const source = Settings.HostPatternSourceSpec.make({
 *   hostPattern: "^git\\.example\\.com$"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HostPatternSourceSpec extends S.Class<HostPatternSourceSpec>($I`HostPatternSourceSpec`)(
  {
    source: S.tag("hostPattern"),
    hostPattern: S.String,
  },
  $I.annote("HostPatternSourceSpec", {
    description: "Marketplace source selected by a host regular expression.",
  })
) {}

/**
 * Companion types for {@link HostPatternSourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.HostPatternSourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HostPatternSourceSpec {
  /**
   * Runtime type represented by {@link HostPatternSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HostPatternSourceSpec;
  /**
   * JSON representation accepted by {@link HostPatternSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HostPatternSourceSpec.Encoded;
}

/**
 * Inline marketplace declared directly in settings.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const source = Settings.SettingsSourceSpec.make({
 *   name: "team-tools",
 *   plugins: []
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SettingsSourceSpec extends S.Class<SettingsSourceSpec>($I`SettingsSourceSpec`)(
  {
    source: S.tag("settings"),
    name: S.String,
    plugins: S.Record(S.String, S.Unknown).pipe(S.Array),
  },
  $I.annote("SettingsSourceSpec", {
    description: "Inline marketplace and plugin definitions embedded in settings.",
  })
) {}

/**
 * Companion types for {@link SettingsSourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.SettingsSourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SettingsSourceSpec {
  /**
   * Runtime type represented by {@link SettingsSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SettingsSourceSpec;
  /**
   * JSON representation accepted by {@link SettingsSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SettingsSourceSpec.Encoded;
}

/**
 * Source accepted by `extraKnownMarketplaces`.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const source = S.decodeSync(Settings.MarketplaceSourceSpec)({
 *   source: "github",
 *   repo: "acme/plugins"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarketplaceSourceSpec = S.Union([
  DirectorySourceSpec,
  GithubSourceSpec,
  GitSourceSpec,
  HostPatternSourceSpec,
  SettingsSourceSpec,
]).pipe(
  S.toTaggedUnion("source"),
  $I.annoteSchema("MarketplaceSourceSpec", {
    description: "Source from which Claude Code installs a known marketplace.",
  })
);

/**
 * Companion types for {@link MarketplaceSourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.MarketplaceSourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarketplaceSourceSpec {
  /**
   * Runtime type represented by {@link MarketplaceSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof MarketplaceSourceSpec.Type;
  /**
   * JSON representation accepted by {@link MarketplaceSourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MarketplaceSourceSpec.Encoded;
}

/**
 * Named marketplace configuration.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const marketplace = S.decodeSync(Settings.Marketplace)({
 *   source: { source: "directory", path: "./plugins" },
 *   autoUpdate: false
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Marketplace extends S.Class<Marketplace>($I`Marketplace`)(
  {
    source: MarketplaceSourceSpec,
    autoUpdate: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Marketplace", {
    description: "A marketplace registered through Claude Code settings.",
  })
) {}

/**
 * Companion types for {@link Marketplace}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.Marketplace.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Marketplace {
  /**
   * Runtime type represented by {@link Marketplace}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = Marketplace;
  /**
   * JSON representation accepted by {@link Marketplace}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Marketplace.Encoded;
}

class PolicyGithubSourceSpec extends S.Class<PolicyGithubSourceSpec>($I`PolicyGithubSourceSpec`)(
  {
    source: S.tag("github"),
    repo: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PolicyGithubSourceSpec", {
    description: "GitHub source matched by marketplace policy.",
  })
) {}

class PolicyGitSourceSpec extends S.Class<PolicyGitSourceSpec>($I`PolicyGitSourceSpec`)(
  {
    source: S.tag("git"),
    url: S.String,
    ref: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PolicyGitSourceSpec", {
    description: "Git source matched by marketplace policy.",
  })
) {}

class PolicyUrlSourceSpec extends S.Class<PolicyUrlSourceSpec>($I`PolicyUrlSourceSpec`)(
  {
    source: S.tag("url"),
    url: S.String,
    headers: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PolicyUrlSourceSpec", {
    description: "URL source matched by marketplace policy.",
  })
) {}

class PolicyNpmSourceSpec extends S.Class<PolicyNpmSourceSpec>($I`PolicyNpmSourceSpec`)(
  {
    source: S.tag("npm"),
    package: S.String,
  },
  $I.annote("PolicyNpmSourceSpec", {
    description: "NPM package source matched by marketplace policy.",
  })
) {}

class PolicyFileSourceSpec extends S.Class<PolicyFileSourceSpec>($I`PolicyFileSourceSpec`)(
  {
    source: S.tag("file"),
    path: S.String,
  },
  $I.annote("PolicyFileSourceSpec", {
    description: "Marketplace file matched by marketplace policy.",
  })
) {}

class PolicyPathPatternSourceSpec extends S.Class<PolicyPathPatternSourceSpec>($I`PolicyPathPatternSourceSpec`)(
  {
    source: S.tag("pathPattern"),
    pathPattern: S.String,
  },
  $I.annote("PolicyPathPatternSourceSpec", {
    description: "Marketplace filesystem source selected by path pattern.",
  })
) {}

/**
 * Direct marketplace source accepted by managed allow/block policies.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const source = S.decodeSync(Settings.MarketplacePolicySourceSpec)({
 *   source: "npm",
 *   package: "@acme/plugins"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MarketplacePolicySourceSpec = S.Union([
  PolicyGithubSourceSpec,
  PolicyGitSourceSpec,
  PolicyUrlSourceSpec,
  PolicyNpmSourceSpec,
  PolicyFileSourceSpec,
  DirectorySourceSpec,
  HostPatternSourceSpec,
  PolicyPathPatternSourceSpec,
]).pipe(
  S.toTaggedUnion("source"),
  $I.annoteSchema("MarketplacePolicySourceSpec", {
    description: "Direct marketplace source used by managed marketplace policy.",
  })
);

/**
 * Companion types for {@link MarketplacePolicySourceSpec}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.MarketplacePolicySourceSpec.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MarketplacePolicySourceSpec {
  /**
   * Runtime type represented by {@link MarketplacePolicySourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof MarketplacePolicySourceSpec.Type;
  /**
   * JSON representation accepted by {@link MarketplacePolicySourceSpec}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof MarketplacePolicySourceSpec.Encoded;
}

// ---------------------------------------------------------------------------
// Other structured settings
// ---------------------------------------------------------------------------

/**
 * Git commit and pull-request attribution.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const attribution = Settings.AttributionConfig.make({
 *   commit: O.some("Generated with Claude Code")
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AttributionConfig extends S.Class<AttributionConfig>($I`AttributionConfig`)(
  {
    commit: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    pr: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    sessionUrl: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AttributionConfig", {
    description: "Attribution appended to commits and pull requests.",
  })
) {}

/**
 * Companion types for {@link AttributionConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.AttributionConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AttributionConfig {
  /**
   * Runtime type represented by {@link AttributionConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AttributionConfig;
  /**
   * JSON representation accepted by {@link AttributionConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AttributionConfig.Encoded;
}

class AutoModeConfig extends S.Class<AutoModeConfig>($I`AutoModeConfig`)(
  {
    allow: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    soft_deny: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    hard_deny: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    environment: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    classifyAllShell: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AutoModeConfig", {
    description: "Custom classifier rules used by auto permission mode.",
  })
) {}

const PluginConfigValue = S.Union([S.String, S.Finite, S.Boolean, S.String.pipe(S.Array)]).pipe(
  $I.annoteSchema("PluginConfigValue", {
    description: "Non-sensitive plugin option value stored in settings.",
  })
);

/**
 * Non-sensitive configuration collected for a plugin.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const config = Settings.PluginOptionsConfig.make({
 *   options: O.some({ endpoint: "https://api.example.com" })
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PluginOptionsConfig extends S.Class<PluginOptionsConfig>($I`PluginOptionsConfig`)(
  {
    options: S.OptionFromOptionalKey(S.Record(S.String, PluginConfigValue)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PluginOptionsConfig", {
    description: "Non-sensitive options collected for a Claude Code plugin.",
  })
) {}

/**
 * Companion types for {@link PluginOptionsConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.PluginOptionsConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginOptionsConfig {
  /**
   * Runtime type represented by {@link PluginOptionsConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginOptionsConfig;
  /**
   * JSON representation accepted by {@link PluginOptionsConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginOptionsConfig.Encoded;
}

/**
 * Worktree creation and background-isolation settings.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const worktree = Settings.WorktreeConfig.make({
 *   bgIsolation: O.some("worktree")
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class WorktreeConfig extends S.Class<WorktreeConfig>($I`WorktreeConfig`)(
  {
    baseRef: S.OptionFromOptionalKey(WorktreeBaseRef).pipe(SchemaUtils.withNoneDefault),
    symlinkDirectories: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    sparsePaths: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    bgIsolation: S.OptionFromOptionalKey(WorktreeBgIsolation).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WorktreeConfig", {
    description: "Configuration used by Claude Code worktree sessions.",
  })
) {}

/**
 * Companion types for {@link WorktreeConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.WorktreeConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorktreeConfig {
  /**
   * Runtime type represented by {@link WorktreeConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = WorktreeConfig;
  /**
   * JSON representation accepted by {@link WorktreeConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WorktreeConfig.Encoded;
}

/**
 * Executable that dynamically supplies managed policy.
 *
 * @example
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const helper = Settings.PolicyHelperConfig.make({
 *   path: "/usr/local/bin/claude-policy"
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PolicyHelperConfig extends S.Class<PolicyHelperConfig>($I`PolicyHelperConfig`)(
  {
    path: S.String,
    timeoutMs: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    refreshIntervalMs: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PolicyHelperConfig", {
    description: "Managed executable that computes Claude Code policy.",
  })
) {}

/**
 * Companion types for {@link PolicyHelperConfig}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.PolicyHelperConfig.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PolicyHelperConfig {
  /**
   * Runtime type represented by {@link PolicyHelperConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PolicyHelperConfig;
  /**
   * JSON representation accepted by {@link PolicyHelperConfig}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PolicyHelperConfig.Encoded;
}

/**
 * Unmodeled settings retained from a decoded source.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const raw = S.decodeSync(Settings.SettingsRaw)({ futureSetting: true })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SettingsRaw = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("SettingsRaw", {
    description: "Raw keys retained from a decoded Claude Code settings file.",
  })
);

/**
 * Companion types for {@link SettingsRaw}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.SettingsRaw.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SettingsRaw {
  /**
   * Runtime type represented by {@link SettingsRaw}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = typeof SettingsRaw.Type;
  /**
   * JSON representation accepted by {@link SettingsRaw}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SettingsRaw.Encoded;
}

const ForceLoginOrganization = S.Union([S.String, S.String.pipe(S.Array)]).pipe(
  $I.annoteSchema("ForceLoginOrganization", {
    description: "One organization UUID or an allowlist of organization UUIDs.",
  })
);

const StrictPluginOnlyCustomization = S.Union([S.Boolean, StrictCustomizationSurface.pipe(S.Array)]).pipe(
  $I.annoteSchema("StrictPluginOnlyCustomization", {
    description: "Customization surfaces restricted to plugins and managed settings.",
  })
);

const AllowedChannelPlugin = S.Struct({
  marketplace: S.String,
  plugin: S.String,
}).pipe(
  $I.annoteSchema("AllowedChannelPlugin", {
    description: "Managed channel plugin allowlist entry.",
  })
);

// ---------------------------------------------------------------------------
// Top-level settings
// ---------------------------------------------------------------------------

/**
 * A Claude Code 2.1.220 `settings.json` file.
 *
 * Every wire key is optional and decodes to `Option`; this preserves the
 * distinction between an absent lower-priority value and an explicit
 * higher-priority value. {@link SettingsRaw} is populated by
 * `Settings.load` so callers can inspect newer, unmodeled top-level keys.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { Settings } from "effect-claudecode"
 *
 * const settings = Settings.SettingsFile.make({
 *   model: O.some("claude-sonnet-5"),
 *   theme: O.some("dark")
 * })
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class SettingsFile extends S.Class<SettingsFile>($I`SettingsFile`)(
  {
    raw: S.OptionFromOptionalKey(SettingsRaw).pipe(SchemaUtils.withNoneDefault),
    $schema: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    advisorModel: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agent: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    agentPushNotifEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowAllClaudeAiMcps: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowedChannelPlugins: S.OptionFromOptionalKey(AllowedChannelPlugin.pipe(S.Array)).pipe(
      SchemaUtils.withNoneDefault
    ),
    allowedHttpHookUrls: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowedMcpServers: S.OptionFromOptionalKey(McpServerPolicyMatcher.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    allowManagedHooksOnly: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowManagedMcpServersOnly: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    allowManagedPermissionRulesOnly: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    alwaysThinkingEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    apiKeyHelper: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    askUserQuestionTimeout: S.OptionFromOptionalKey(AskUserQuestionTimeout).pipe(SchemaUtils.withNoneDefault),
    attribution: S.OptionFromOptionalKey(AttributionConfig).pipe(SchemaUtils.withNoneDefault),
    autoCompactEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    autoMemoryDirectory: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    autoMemoryEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    autoMode: S.OptionFromOptionalKey(AutoModeConfig).pipe(SchemaUtils.withNoneDefault),
    autoScrollEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    autoUpdatesChannel: S.OptionFromOptionalKey(AutoUpdatesChannel).pipe(SchemaUtils.withNoneDefault),
    availableModels: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    awaySummaryEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    awsAuthRefresh: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    awsCredentialExport: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    axScreenReader: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    blockedMarketplaces: S.OptionFromOptionalKey(MarketplacePolicySourceSpec.pipe(S.Array)).pipe(
      SchemaUtils.withNoneDefault
    ),
    browserExternalPageTools: S.OptionFromOptionalKey(S.Literal("disabled")).pipe(SchemaUtils.withNoneDefault),
    channelsEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    claudeMd: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    claudeMdExcludes: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    cleanupPeriodDays: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    companyAnnouncements: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    defaultShell: S.OptionFromOptionalKey(DefaultShell).pipe(SchemaUtils.withNoneDefault),
    deniedMcpServers: S.OptionFromOptionalKey(McpServerPolicyMatcher.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    disableAgentView: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableAllHooks: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableArtifact: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableAutoMode: S.OptionFromOptionalKey(S.Literal("disable")).pipe(SchemaUtils.withNoneDefault),
    disableBrowserExternalNavigation: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableBundledSkills: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableClaudeAiConnectors: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableDeepLinkRegistration: S.OptionFromOptionalKey(S.Literal("disable")).pipe(SchemaUtils.withNoneDefault),
    disabledMcpjsonServers: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    disableMobileSimulatorTools: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableRemoteControl: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableSideloadFlags: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableSkillShellExecution: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    disableWorkflows: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    editorMode: S.OptionFromOptionalKey(EditorMode).pipe(SchemaUtils.withNoneDefault),
    effortLevel: S.OptionFromOptionalKey(EffortLevel).pipe(SchemaUtils.withNoneDefault),
    emojiCompletionEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    enableAllProjectMcpServers: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    enableArtifact: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    enabledMcpjsonServers: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    enabledPlugins: S.OptionFromOptionalKey(S.Record(S.String, S.Boolean)).pipe(SchemaUtils.withNoneDefault),
    enforceAvailableModels: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    env: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
    extraKnownMarketplaces: S.OptionFromOptionalKey(S.Record(S.String, Marketplace)).pipe(SchemaUtils.withNoneDefault),
    fallbackModel: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    fastMode: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    fastModePerSessionOptIn: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    feedbackSurveyRate: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    fileCheckpointingEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    fileSuggestion: S.OptionFromOptionalKey(FileSuggestionConfig).pipe(SchemaUtils.withNoneDefault),
    footerLinksRegexes: S.OptionFromOptionalKey(FooterLinkRegex.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    forceLoginMethod: S.OptionFromOptionalKey(ForceLoginMethod).pipe(SchemaUtils.withNoneDefault),
    forceLoginGatewayUrl: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    forceLoginOrgUUID: S.OptionFromOptionalKey(ForceLoginOrganization).pipe(SchemaUtils.withNoneDefault),
    forceRemoteSettingsRefresh: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    gcpAuthRefresh: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hooks: S.OptionFromOptionalKey(HooksSection).pipe(SchemaUtils.withNoneDefault),
    httpHookAllowedEnvVars: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    includeGitInstructions: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    inputNeededNotifEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    language: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    minimumVersion: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    modelOverrides: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
    otelHeadersHelper: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    outputStyle: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    parentSettingsBehavior: S.OptionFromOptionalKey(ParentSettingsBehavior).pipe(SchemaUtils.withNoneDefault),
    permissions: S.OptionFromOptionalKey(PermissionsConfig).pipe(SchemaUtils.withNoneDefault),
    plansDirectory: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    pluginConfigs: S.OptionFromOptionalKey(S.Record(S.String, PluginOptionsConfig)).pipe(SchemaUtils.withNoneDefault),
    pluginSuggestionMarketplaces: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    pluginTrustMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    policyHelper: S.OptionFromOptionalKey(PolicyHelperConfig).pipe(SchemaUtils.withNoneDefault),
    preferredNotifChannel: S.OptionFromOptionalKey(NotificationChannel).pipe(SchemaUtils.withNoneDefault),
    prefersReducedMotion: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    processWrapper: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    prUrlTemplate: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    remoteControlAtStartup: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    requiredMaximumVersion: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    requiredMinimumVersion: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    respectGitignore: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    respondToBashCommands: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    sandbox: S.OptionFromOptionalKey(SandboxConfig).pipe(SchemaUtils.withNoneDefault),
    showClearContextOnPlanAccept: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    showThinkingSummaries: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    showTurnDuration: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    skillListingBudgetFraction: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    skillListingMaxDescChars: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    skillOverrides: S.OptionFromOptionalKey(S.Record(S.String, SkillVisibility)).pipe(SchemaUtils.withNoneDefault),
    skipDangerousModePermissionPrompt: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    skipWebFetchPreflight: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    spinnerTipsEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    spinnerTipsOverride: S.OptionFromOptionalKey(SpinnerTipsConfig).pipe(SchemaUtils.withNoneDefault),
    spinnerVerbs: S.OptionFromOptionalKey(SpinnerVerbsConfig).pipe(SchemaUtils.withNoneDefault),
    sshConfigs: S.OptionFromOptionalKey(SshConfig.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    statusLine: S.OptionFromOptionalKey(StatusLineConfig).pipe(SchemaUtils.withNoneDefault),
    strictKnownMarketplaces: S.OptionFromOptionalKey(MarketplacePolicySourceSpec.pipe(S.Array)).pipe(
      SchemaUtils.withNoneDefault
    ),
    strictPluginOnlyCustomization: S.OptionFromOptionalKey(StrictPluginOnlyCustomization).pipe(
      SchemaUtils.withNoneDefault
    ),
    syntaxHighlightingDisabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    teammateMode: S.OptionFromOptionalKey(TeammateMode).pipe(SchemaUtils.withNoneDefault),
    terminalProgressBarEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    theme: S.OptionFromOptionalKey(Theme).pipe(SchemaUtils.withNoneDefault),
    tui: S.OptionFromOptionalKey(TuiMode).pipe(SchemaUtils.withNoneDefault),
    ultracode: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    useAutoModeDuringPlan: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    verbose: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    viewMode: S.OptionFromOptionalKey(ViewMode).pipe(SchemaUtils.withNoneDefault),
    vimInsertModeRemaps: S.OptionFromOptionalKey(S.Record(S.String, S.Literal("<Esc>"))).pipe(
      SchemaUtils.withNoneDefault
    ),
    voice: S.OptionFromOptionalKey(VoiceConfig).pipe(SchemaUtils.withNoneDefault),
    wheelScrollAccelerationEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    workflowKeywordTriggerEnabled: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    worktree: S.OptionFromOptionalKey(WorktreeConfig).pipe(SchemaUtils.withNoneDefault),
    wslInheritsWindowsSettings: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SettingsFile", {
    description: "Claude Code 2.1.220 settings with Option-backed absent keys.",
  })
) {}

/**
 * Companion types for {@link SettingsFile}.
 *
 * @example
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const accept = (input: Settings.SettingsFile.Encoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SettingsFile {
  /**
   * Runtime type represented by {@link SettingsFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SettingsFile;
  /**
   * JSON representation accepted by {@link SettingsFile}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SettingsFile.Encoded;
}
