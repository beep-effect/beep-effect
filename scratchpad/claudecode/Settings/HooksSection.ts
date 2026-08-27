/**
 * Schema for the `hooks` subtree of a Claude Code settings.json file.
 *
 * Claude Code's hooks wire-up format looks like:
 *
 * ```jsonc
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Bash|Edit",
 *         "hooks": [
 *           { "type": "command", "command": "bun hook.ts", "timeout": 30 }
 *         ]
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * Claude Code supports five hook types: `command`, `http`, `mcp_tool`,
 * `prompt`, and `agent`. This module schematizes all five.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("claudecode/Settings/HooksSection");

// ---------------------------------------------------------------------------
// Hook entry types
// ---------------------------------------------------------------------------

/**
 * Hook transports accepted in a settings hook definition.
 *
 * **Example** (Use a hook transport)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * console.log(Settings.HookEntryType.is.command("command"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HookEntryType = LiteralKit(["command", "http", "mcp_tool", "prompt", "agent"]).pipe(
  $I.annoteSchema("HookEntryType", {
    description: "Transport used to execute a Claude Code hook.",
  })
);

/**
 * Companion types for {@link HookEntryType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookEntryType = typeof HookEntryType.Type;

/**
 * JSON representation accepted by {@link HookEntryType}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookEntryTypeEncoded = typeof HookEntryType.Encoded;

/**
 * Shell implementations supported by command hooks.
 *
 * **Example** (Inspect hook shell)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * console.log(Settings.HookShell.is.powershell("powershell"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HookShell = LiteralKit(["bash", "powershell"]).pipe(
  $I.annoteSchema("HookShell", {
    description: "Shell implementation used by a command hook.",
  })
);

/**
 * Companion types for {@link HookShell}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookShell = typeof HookShell.Type;

/**
 * JSON representation accepted by {@link HookShell}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookShellEncoded = typeof HookShell.Encoded;

const commonHookFields = {
  if: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  timeout: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  statusMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
};

/**
 * Hook executed as a local shell command or direct process.
 *
 * **Example** (Create a command hook)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const hook = Settings.CommandHookEntry.make({ command: "bun hook.ts" })
 *
 * console.log(hook.command) // "bun hook.ts"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CommandHookEntry extends S.Class<CommandHookEntry>($I`CommandHookEntry`)(
  {
    ...commonHookFields,
    type: S.tag("command"),
    command: S.String,
    args: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
    async: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    asyncRewake: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    shell: S.OptionFromOptionalKey(HookShell).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CommandHookEntry", {
    description: "A Claude Code hook executed as a local command.",
  })
) {}

/**
 * Companion types for {@link CommandHookEntry}.
 *
 * **Example** (Inspect encoded command hook input)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const input: Settings.CommandHookEntry.Encoded = {
 *   type: "command",
 *   command: "bun hook.ts"
 * }
 * console.log(input.command)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CommandHookEntry {
  /**
   * Runtime type represented by {@link CommandHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = CommandHookEntry;
  /**
   * JSON representation accepted by {@link CommandHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CommandHookEntry.Encoded;
}

/**
 * Hook executed by posting JSON to an HTTP endpoint.
 *
 * **Example** (Create an HTTP hook)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const hook = Settings.HttpHookEntry.make({ url: "https://hooks.example.com" })
 *
 * console.log(hook.url) // "https://hooks.example.com"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HttpHookEntry extends S.Class<HttpHookEntry>($I`HttpHookEntry`)(
  {
    ...commonHookFields,
    type: S.tag("http"),
    url: S.String,
    headers: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
    allowedEnvVars: S.OptionFromOptionalKey(S.String.pipe(S.Array)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("HttpHookEntry", {
    description: "A Claude Code hook executed by an HTTP endpoint.",
  })
) {}

/**
 * Companion types for {@link HttpHookEntry}.
 *
 * **Example** (Inspect encoded HTTP hook input)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const input: Settings.HttpHookEntry.Encoded = {
 *   type: "http",
 *   url: "https://hooks.example.com"
 * }
 * console.log(input.url)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HttpHookEntry {
  /**
   * Runtime type represented by {@link HttpHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HttpHookEntry;
  /**
   * JSON representation accepted by {@link HttpHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HttpHookEntry.Encoded;
}

/**
 * Hook executed by an already-connected MCP tool.
 *
 * **Example** (Create an MCP tool hook)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const hook = Settings.McpToolHookEntry.make({
 *   server: "policy",
 *   tool: "check"
 * })
 *
 * console.log(hook.tool) // "check"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class McpToolHookEntry extends S.Class<McpToolHookEntry>($I`McpToolHookEntry`)(
  {
    ...commonHookFields,
    type: S.tag("mcp_tool"),
    server: S.String,
    tool: S.String,
    input: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("McpToolHookEntry", {
    description: "A Claude Code hook executed by an MCP tool.",
  })
) {}

/**
 * Companion types for {@link McpToolHookEntry}.
 *
 * **Example** (Inspect encoded MCP tool hook input)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const input: Settings.McpToolHookEntry.Encoded = {
 *   type: "mcp_tool",
 *   server: "policy",
 *   tool: "check"
 * }
 * console.log(input.tool)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpToolHookEntry {
  /**
   * Runtime type represented by {@link McpToolHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = McpToolHookEntry;
  /**
   * JSON representation accepted by {@link McpToolHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof McpToolHookEntry.Encoded;
}

/**
 * Hook evaluated by a single model prompt.
 *
 * **Example** (Create a prompt hook)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const hook = Settings.PromptHookEntry.make({ prompt: "Review $ARGUMENTS" })
 *
 * console.log(hook.prompt) // "Review $ARGUMENTS"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class PromptHookEntry extends S.Class<PromptHookEntry>($I`PromptHookEntry`)(
  {
    ...commonHookFields,
    type: S.tag("prompt"),
    prompt: S.String,
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    continueOnBlock: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PromptHookEntry", {
    description: "A Claude Code hook evaluated by a single model prompt.",
  })
) {}

/**
 * Companion types for {@link PromptHookEntry}.
 *
 * **Example** (Inspect encoded prompt hook input)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const input: Settings.PromptHookEntry.Encoded = {
 *   type: "prompt",
 *   prompt: "Review $ARGUMENTS"
 * }
 * console.log(input.prompt)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PromptHookEntry {
  /**
   * Runtime type represented by {@link PromptHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PromptHookEntry;
  /**
   * JSON representation accepted by {@link PromptHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PromptHookEntry.Encoded;
}

/**
 * Hook evaluated by a tool-capable subagent.
 *
 * **Example** (Create an agent hook)
 *
 * ```ts
 * import { Settings } from "effect-claudecode"
 *
 * const hook = Settings.AgentHookEntry.make({ prompt: "Verify $ARGUMENTS" })
 *
 * console.log(hook.prompt) // "Verify $ARGUMENTS"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class AgentHookEntry extends S.Class<AgentHookEntry>($I`AgentHookEntry`)(
  {
    ...commonHookFields,
    type: S.tag("agent"),
    prompt: S.String,
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentHookEntry", {
    description: "A Claude Code hook evaluated by a tool-capable subagent.",
  })
) {}

/**
 * Companion types for {@link AgentHookEntry}.
 *
 * **Example** (Describe encoded agent hook input)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const input: Settings.AgentHookEntry.Encoded = {
 *   type: "agent",
 *   prompt: "Verify $ARGUMENTS"
 * }
 * console.log(input.prompt)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AgentHookEntry {
  /**
   * Runtime type represented by {@link AgentHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AgentHookEntry;
  /**
   * JSON representation accepted by {@link AgentHookEntry}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AgentHookEntry.Encoded;
}

/**
 * A single hook entry in settings.json — a discriminated union of the
 * five supported types keyed on `type`.
 *
 * **Example** (Inspect hook entry)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const hook = S.decodeSync(Settings.HookEntry)({
 *   type: "command",
 *   command: "bun hook.ts"
 * })
 * console.log(hook.type)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HookEntry = S.Union([
  CommandHookEntry,
  HttpHookEntry,
  McpToolHookEntry,
  PromptHookEntry,
  AgentHookEntry,
]).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("HookEntry", {
    description: "Claude Code hook definitions discriminated by transport type.",
  })
);

/**
 * Companion types for {@link HookEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookEntry = typeof HookEntry.Type;

/**
 * JSON representation accepted by {@link HookEntry}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookEntryEncoded = typeof HookEntry.Encoded;

// ---------------------------------------------------------------------------
// Matcher group
// ---------------------------------------------------------------------------

/**
 * A group of hook entries sharing a common matcher.
 *
 * **Example** (Inspect hook matcher group)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const group = S.decodeSync(Settings.HookMatcherGroup)({
 *   matcher: "Bash",
 *   hooks: [{ type: "command", command: "bun hook.ts" }]
 * })
 * console.log(group.hooks.length)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class HookMatcherGroup extends S.Class<HookMatcherGroup>($I`HookMatcherGroup`)(
  {
    matcher: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hooks: HookEntry.pipe(S.Array),
  },
  $I.annote("HookMatcherGroup", {
    description: "A matcher and the hook definitions that share it.",
  })
) {}

/**
 * Companion types for {@link HookMatcherGroup}.
 *
 * **Example** (Describe encoded matcher group)
 *
 * ```ts
 * import type { Settings } from "effect-claudecode"
 *
 * const input: Settings.HookMatcherGroup.Encoded = {
 *   matcher: "Bash",
 *   hooks: [{ type: "command", command: "bun hook.ts" }]
 * }
 * console.log(input.hooks.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookMatcherGroup {
  /**
   * Runtime type represented by {@link HookMatcherGroup}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookMatcherGroup;
  /**
   * JSON representation accepted by {@link HookMatcherGroup}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookMatcherGroup.Encoded;
}

// ---------------------------------------------------------------------------
// Hooks section (top-level)
// ---------------------------------------------------------------------------

/**
 * The full `hooks` subtree of settings.json — a record keyed by event
 * name, each holding an array of matcher groups.
 *
 * **Example** (Inspect hooks section)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Settings } from "effect-claudecode"
 *
 * const hooks = S.decodeSync(Settings.HooksSection)({
 *   PreToolUse: [{ matcher: "Bash", hooks: [] }]
 * })
 * console.log(hooks.PreToolUse)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HooksSection = S.Record(S.String, HookMatcherGroup.pipe(S.Array)).pipe(
  $I.annoteSchema("HooksSection", {
    description: "The hooks subtree of a Claude Code settings file.",
  })
);

/**
 * Companion types for {@link HooksSection}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HooksSection = typeof HooksSection.Type;

/**
 * JSON representation accepted by {@link HooksSection}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HooksSectionEncoded = typeof HooksSection.Encoded;
