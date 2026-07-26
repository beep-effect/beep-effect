/**
 * Typed adapters for common Claude Code tool payloads.
 *
 * The core hook event schemas intentionally preserve Claude Code's raw wire
 * format (`tool_input` / `tool_response` as loose records). This module adds a
 * thin typed layer for the built-in tool shapes documented by Claude Code.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import { HookToolDecodeError } from "../Errors.ts";
import type * as PostToolUse from "./Events/PostToolUse.ts";
import type * as PreToolUse from "./Events/PreToolUse.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Tool");

// ---------------------------------------------------------------------------
// Adapter models
// ---------------------------------------------------------------------------

/**
 * Typed adapter for decoding a `tool_input` payload.
 *
 * @category models
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type BashAdapter = Hook.Tool.PreToolAdapter<"Bash", Hook.Tool.BashToolInput>
 * ```
 */
export interface PreToolAdapter<TName extends string, TTool> {
  readonly toolName: TName;
  readonly inputSchema: S.Decoder<TTool>;
}

/**
 * Typed adapter for decoding both `tool_input` and `tool_response` payloads.
 *
 * @category models
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type BashAdapter = Hook.Tool.PostToolAdapter<
 *   "Bash",
 *   Hook.Tool.BashToolInput,
 *   Hook.Tool.BashToolResponse
 * >
 * ```
 */
export interface PostToolAdapter<TName extends string, TTool, TResponse> extends PreToolAdapter<TName, TTool> {
  readonly responseSchema: S.Decoder<TResponse>;
}

/**
 * Define a typed pre-tool adapter from a schema.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.definePreAdapter)
 * ```
 */
export const definePreAdapter = <const TName extends string, TTool>(config: {
  readonly toolName: TName;
  readonly inputSchema: S.Decoder<TTool>;
}): PreToolAdapter<TName, TTool> => config;

/**
 * Define a typed post-tool adapter from input / response schemas.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.definePostAdapter)
 * ```
 */
export const definePostAdapter = <const TName extends string, TTool, TResponse>(config: {
  readonly toolName: TName;
  readonly inputSchema: S.Decoder<TTool>;
  readonly responseSchema: S.Decoder<TResponse>;
}): PostToolAdapter<TName, TTool, TResponse> => config;

// ---------------------------------------------------------------------------
// Supported tool payload schemas
// ---------------------------------------------------------------------------

/**
 * Typed `tool_input` payload for the `Bash` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.BashToolInput)
 * ```
 */
export class BashToolInput extends S.Class<BashToolInput>($I`BashToolInput`)(
  {
    command: S.String,
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    timeout: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    run_in_background: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BashToolInput", {
    description: "Typed input payload for Claude Code's Bash tool.",
  })
) {}

/**
 * Typed `tool_response` payload for the `Bash` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.BashToolResponse)
 * ```
 */
export class BashToolResponse extends S.Class<BashToolResponse>($I`BashToolResponse`)(
  {
    stdout: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    stderr: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    interrupted: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    isImage: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("BashToolResponse", {
    description: "Typed response payload from Claude Code's Bash tool.",
  })
) {}

/**
 * Typed `tool_input` payload for the `Read` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ReadToolInput)
 * ```
 */
export class ReadToolInput extends S.Class<ReadToolInput>($I`ReadToolInput`)(
  {
    file_path: S.String,
    offset: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    limit: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ReadToolInput", {
    description: "Typed input payload for Claude Code's Read tool.",
  })
) {}

/**
 * Typed `tool_response` payload for the `Read` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ReadToolResponse)
 * ```
 */
export class ReadToolResponse extends S.Class<ReadToolResponse>($I`ReadToolResponse`)(
  { content: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault) },
  $I.annote("ReadToolResponse", {
    description: "Typed response payload from Claude Code's Read tool.",
  })
) {}

/**
 * Typed `tool_input` payload for the `Write` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.WriteToolInput)
 * ```
 */
export class WriteToolInput extends S.Class<WriteToolInput>($I`WriteToolInput`)(
  { file_path: S.String, content: S.String },
  $I.annote("WriteToolInput", {
    description: "Typed input payload for Claude Code's Write tool.",
  })
) {}

/**
 * Typed `tool_input` payload for the `Edit` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.EditToolInput)
 * ```
 */
export class EditToolInput extends S.Class<EditToolInput>($I`EditToolInput`)(
  {
    file_path: S.String,
    old_string: S.String,
    new_string: S.String,
    replace_all: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("EditToolInput", {
    description: "Typed input payload for Claude Code's Edit tool.",
  })
) {}

/**
 * Typed `tool_input` payload for the `Glob` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.GlobToolInput)
 * ```
 */
export class GlobToolInput extends S.Class<GlobToolInput>($I`GlobToolInput`)(
  { pattern: S.String, path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault) },
  $I.annote("GlobToolInput", {
    description: "Typed input payload for Claude Code's Glob tool.",
  })
) {}

/**
 * Tool schema for `GrepOutputMode`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.GrepOutputMode)
 * ```
 *
 * @category tool-schemas
 *
 * @since 0.0.0
 */
export const GrepOutputMode = LiteralKit(["content", "files_with_matches", "count"]).pipe(
  $I.annoteSchema("GrepOutputMode", {
    description: "Output representation requested from Claude Code's Grep tool.",
  })
);

/**
 * Type-level model for `GrepOutputMode`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.GrepOutputMode
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type GrepOutputMode = typeof GrepOutputMode.Type;

/**
 * Typed `tool_input` payload for the `Grep` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.GrepToolInput)
 * ```
 */
export class GrepToolInput extends S.Class<GrepToolInput>($I`GrepToolInput`)(
  {
    pattern: S.String,
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    glob: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    output_mode: S.OptionFromOptionalKey(GrepOutputMode).pipe(SchemaUtils.withNoneDefault),
    "-i": S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    multiline: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("GrepToolInput", {
    description: "Typed input payload for Claude Code's Grep tool.",
  })
) {}

/**
 * Typed `tool_input` payload for the `WebFetch` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.WebFetchToolInput)
 * ```
 */
export class WebFetchToolInput extends S.Class<WebFetchToolInput>($I`WebFetchToolInput`)(
  { url: S.String, prompt: S.String },
  $I.annote("WebFetchToolInput", {
    description: "Typed input payload for Claude Code's WebFetch tool.",
  })
) {}

const DomainNames = S.String.pipe(
  S.Array,
  $I.annoteSchema("DomainNames", {
    description: "Domain names allowed or blocked by the WebSearch tool.",
  })
);

/**
 * Typed `tool_input` payload for the `WebSearch` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.WebSearchToolInput)
 * ```
 */
export class WebSearchToolInput extends S.Class<WebSearchToolInput>($I`WebSearchToolInput`)(
  {
    query: S.String,
    allowed_domains: S.OptionFromOptionalKey(DomainNames).pipe(SchemaUtils.withNoneDefault),
    blocked_domains: S.OptionFromOptionalKey(DomainNames).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("WebSearchToolInput", {
    description: "Typed input payload for Claude Code's WebSearch tool.",
  })
) {}

/**
 * Typed `tool_input` payload for the `Agent` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AgentToolInput)
 * ```
 */
export class AgentToolInput extends S.Class<AgentToolInput>($I`AgentToolInput`)(
  {
    prompt: S.String,
    description: S.String,
    subagent_type: S.String,
    model: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentToolInput", {
    description: "Typed input payload for Claude Code's Agent tool.",
  })
) {}

const AgentToolStatus = LiteralKit(["completed", "async_launched"]).pipe(
  $I.annoteSchema("AgentToolStatus", {
    description: "Completion status returned by Claude Code's Agent tool.",
  })
);

const AgentToolContent = S.Unknown.pipe(
  S.Array,
  $I.annoteSchema("AgentToolContent", {
    description: "Content items returned by the Agent tool.",
  })
);

/**
 * Typed `tool_response` payload for the `Agent` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AgentToolResponse)
 * ```
 */
export class AgentToolResponse extends S.Class<AgentToolResponse>($I`AgentToolResponse`)(
  {
    status: S.OptionFromOptionalKey(AgentToolStatus).pipe(SchemaUtils.withNoneDefault),
    agentId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    content: S.OptionFromOptionalKey(AgentToolContent).pipe(SchemaUtils.withNoneDefault),
    totalTokens: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    totalDurationMs: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    totalToolUseCount: S.OptionFromOptionalKey(S.Finite).pipe(SchemaUtils.withNoneDefault),
    usage: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
    description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    prompt: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    outputFile: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AgentToolResponse", {
    description: "Typed response payload from Claude Code's Agent tool.",
  })
) {}

/**
 * A single option for the `AskUserQuestion` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AskUserQuestionOption)
 * ```
 */
export class AskUserQuestionOption extends S.Class<AskUserQuestionOption>($I`AskUserQuestionOption`)(
  { label: S.String, description: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault) },
  $I.annote("AskUserQuestionOption", {
    description: "One selectable answer for an AskUserQuestion prompt.",
  })
) {}

/**
 * A single question for the `AskUserQuestion` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AskUserQuestionQuestion)
 * ```
 */
export class AskUserQuestionQuestion extends S.Class<AskUserQuestionQuestion>($I`AskUserQuestionQuestion`)(
  {
    question: S.String,
    header: S.String,
    options: S.Array(AskUserQuestionOption),
    multiSelect: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AskUserQuestionQuestion", {
    description: "One question in an AskUserQuestion tool request.",
  })
) {}

/**
 * Typed `tool_input` payload for the `AskUserQuestion` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AskUserQuestionToolInput)
 * ```
 */
export class AskUserQuestionToolInput extends S.Class<AskUserQuestionToolInput>($I`AskUserQuestionToolInput`)(
  {
    questions: S.Array(AskUserQuestionQuestion),
    answers: S.OptionFromOptionalKey(S.Record(S.String, S.String)).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("AskUserQuestionToolInput", {
    description: "Typed input payload for Claude Code's AskUserQuestion tool.",
  })
) {}

/**
 * A prompt-based permission request in `ExitPlanMode`.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ExitPlanAllowedPrompt)
 * ```
 */
export class ExitPlanAllowedPrompt extends S.Class<ExitPlanAllowedPrompt>($I`ExitPlanAllowedPrompt`)(
  { tool: S.String, prompt: S.String },
  $I.annote("ExitPlanAllowedPrompt", {
    description: "Prompt-based permission request attached to ExitPlanMode.",
  })
) {}

const ExitPlanAllowedPrompts = ExitPlanAllowedPrompt.pipe(
  S.Array,
  $I.annoteSchema("ExitPlanAllowedPrompts", {
    description: "Prompt-based permission requests attached to ExitPlanMode.",
  })
);

/**
 * Typed `tool_input` payload for the `ExitPlanMode` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ExitPlanModeToolInput)
 * ```
 */
export class ExitPlanModeToolInput extends S.Class<ExitPlanModeToolInput>($I`ExitPlanModeToolInput`)(
  {
    plan: S.String,
    planFilePath: S.String,
    allowedPrompts: S.OptionFromOptionalKey(ExitPlanAllowedPrompts).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExitPlanModeToolInput", {
    description: "Typed input payload for Claude Code's ExitPlanMode tool.",
  })
) {}

/**
 * Typed `tool_response` payload for the `ExitPlanMode` tool.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ExitPlanModeToolResponse)
 * ```
 */
export class ExitPlanModeToolResponse extends S.Class<ExitPlanModeToolResponse>($I`ExitPlanModeToolResponse`)(
  {
    plan: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    filePath: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    approved: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ExitPlanModeToolResponse", {
    description: "Typed response payload from Claude Code's ExitPlanMode tool.",
  })
) {}

// ---------------------------------------------------------------------------
// Built-in adapters
// ---------------------------------------------------------------------------

/**
 * Built-in adapter for the `Bash` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.BashAdapter)
 * ```
 */
export const BashAdapter = definePostAdapter({
  toolName: "Bash",
  inputSchema: BashToolInput,
  responseSchema: BashToolResponse,
});

/**
 * Built-in adapter for the `Read` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ReadAdapter)
 * ```
 */
export const ReadAdapter = definePostAdapter({
  toolName: "Read",
  inputSchema: ReadToolInput,
  responseSchema: ReadToolResponse,
});

/**
 * Built-in adapter for the `Write` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.WriteAdapter)
 * ```
 */
export const WriteAdapter = definePostAdapter({
  toolName: "Write",
  inputSchema: WriteToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Edit` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.EditAdapter)
 * ```
 */
export const EditAdapter = definePostAdapter({
  toolName: "Edit",
  inputSchema: EditToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Glob` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.GlobAdapter)
 * ```
 */
export const GlobAdapter = definePostAdapter({
  toolName: "Glob",
  inputSchema: GlobToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Grep` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.GrepAdapter)
 * ```
 */
export const GrepAdapter = definePostAdapter({
  toolName: "Grep",
  inputSchema: GrepToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `WebFetch` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.WebFetchAdapter)
 * ```
 */
export const WebFetchAdapter = definePostAdapter({
  toolName: "WebFetch",
  inputSchema: WebFetchToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `WebSearch` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.WebSearchAdapter)
 * ```
 */
export const WebSearchAdapter = definePostAdapter({
  toolName: "WebSearch",
  inputSchema: WebSearchToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Agent` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AgentAdapter)
 * ```
 */
export const AgentAdapter = definePostAdapter({
  toolName: "Agent",
  inputSchema: AgentToolInput,
  responseSchema: AgentToolResponse,
});

/**
 * Built-in adapter for the `AskUserQuestion` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.AskUserQuestionAdapter)
 * ```
 */
export const AskUserQuestionAdapter = definePostAdapter({
  toolName: "AskUserQuestion",
  inputSchema: AskUserQuestionToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `ExitPlanMode` tool.
 *
 * @category adapters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.ExitPlanModeAdapter)
 * ```
 */
export const ExitPlanModeAdapter = definePostAdapter({
  toolName: "ExitPlanMode",
  inputSchema: ExitPlanModeToolInput,
  responseSchema: ExitPlanModeToolResponse,
});

/**
 * Tool names with built-in typed adapters.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.SupportedToolName)
 * ```
 */
export const SupportedToolName = LiteralKit([
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Agent",
  "AskUserQuestion",
  "ExitPlanMode",
]).pipe(
  $I.annoteSchema("SupportedToolName", {
    description: "Claude Code tool name with a built-in typed adapter.",
  })
);

/**
 * Type-level model for `SupportedToolName`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.SupportedToolName
 * ```
 *
 * @category type-level
 *
 * @since 0.0.0
 */
export type SupportedToolName = typeof SupportedToolName.Type;

interface PreToolTypeMap {
  readonly Bash: BashToolInput;
  readonly Read: ReadToolInput;
  readonly Write: WriteToolInput;
  readonly Edit: EditToolInput;
  readonly Glob: GlobToolInput;
  readonly Grep: GrepToolInput;
  readonly WebFetch: WebFetchToolInput;
  readonly WebSearch: WebSearchToolInput;
  readonly Agent: AgentToolInput;
  readonly AskUserQuestion: AskUserQuestionToolInput;
  readonly ExitPlanMode: ExitPlanModeToolInput;
}

interface PostToolTypeMap {
  readonly Bash: {
    readonly tool: BashToolInput;
    readonly response: BashToolResponse;
  };
  readonly Read: {
    readonly tool: ReadToolInput;
    readonly response: ReadToolResponse;
  };
  readonly Write: {
    readonly tool: WriteToolInput;
    readonly response: unknown;
  };
  readonly Edit: {
    readonly tool: EditToolInput;
    readonly response: unknown;
  };
  readonly Glob: {
    readonly tool: GlobToolInput;
    readonly response: unknown;
  };
  readonly Grep: {
    readonly tool: GrepToolInput;
    readonly response: unknown;
  };
  readonly WebFetch: {
    readonly tool: WebFetchToolInput;
    readonly response: unknown;
  };
  readonly WebSearch: {
    readonly tool: WebSearchToolInput;
    readonly response: unknown;
  };
  readonly Agent: {
    readonly tool: AgentToolInput;
    readonly response: AgentToolResponse;
  };
  readonly AskUserQuestion: {
    readonly tool: AskUserQuestionToolInput;
    readonly response: unknown;
  };
  readonly ExitPlanMode: {
    readonly tool: ExitPlanModeToolInput;
    readonly response: ExitPlanModeToolResponse;
  };
}

const preToolAdapters: {
  readonly [K in SupportedToolName]: PreToolAdapter<K, PreToolTypeMap[K]>;
} = {
  Bash: BashAdapter,
  Read: ReadAdapter,
  Write: WriteAdapter,
  Edit: EditAdapter,
  Glob: GlobAdapter,
  Grep: GrepAdapter,
  WebFetch: WebFetchAdapter,
  WebSearch: WebSearchAdapter,
  Agent: AgentAdapter,
  AskUserQuestion: AskUserQuestionAdapter,
  ExitPlanMode: ExitPlanModeAdapter,
};

const postToolAdapters: {
  readonly [K in SupportedToolName]: PostToolAdapter<K, PostToolTypeMap[K]["tool"], PostToolTypeMap[K]["response"]>;
} = {
  Bash: BashAdapter,
  Read: ReadAdapter,
  Write: WriteAdapter,
  Edit: EditAdapter,
  Glob: GlobAdapter,
  Grep: GrepAdapter,
  WebFetch: WebFetchAdapter,
  WebSearch: WebSearchAdapter,
  Agent: AgentAdapter,
  AskUserQuestion: AskUserQuestionAdapter,
  ExitPlanMode: ExitPlanModeAdapter,
};

/**
 * Decoded typed view over a `PreToolUse` payload.
 *
 * @category models
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type DecodedBash = Hook.Tool.DecodedPreToolUseWith<Hook.Tool.BashToolInput>
 * ```
 */
export type DecodedPreToolUseWith<TTool> = {
  readonly input: PreToolUse.Input;
  readonly tool: TTool;
};

/**
 * Decoded typed view over a built-in `PreToolUse` payload.
 *
 * @category models
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type DecodedBash = Hook.Tool.DecodedPreToolUse<"Bash">
 * ```
 */
export type DecodedPreToolUse<T extends SupportedToolName> = DecodedPreToolUseWith<PreToolTypeMap[T]>;

/**
 * Decoded typed view over a `PostToolUse` payload.
 *
 * @category models
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type DecodedBash = Hook.Tool.DecodedPostToolUseWith<
 *   Hook.Tool.BashToolInput,
 *   Hook.Tool.BashToolResponse
 * >
 * ```
 */
export type DecodedPostToolUseWith<TTool, TResponse> = {
  readonly input: PostToolUse.Input;
  readonly tool: TTool;
  readonly response: TResponse;
};

/**
 * Decoded typed view over a built-in `PostToolUse` payload.
 *
 * @category models
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type DecodedBash = Hook.Tool.DecodedPostToolUse<"Bash">
 * ```
 */
export type DecodedPostToolUse<T extends SupportedToolName> = DecodedPostToolUseWith<
  PostToolTypeMap[T]["tool"],
  PostToolTypeMap[T]["response"]
>;

const decodeToolInput = Effect.fn("Hook.Tool.decodeToolInput")(function* <A>(options: {
  readonly event: "PreToolUse" | "PostToolUse";
  readonly toolName: string;
  readonly payload: "tool_name" | "tool_input" | "tool_response";
  readonly value: unknown;
  readonly decoder: S.Decoder<A>;
}) {
  return yield* S.decodeUnknownEffect(options.decoder)(options.value).pipe(
    Effect.mapError((cause) =>
      HookToolDecodeError.make({
        event: options.event,
        toolName: options.toolName,
        payload: options.payload,
        cause,
      })
    )
  );
});

const ensureToolName = Effect.fn("Hook.Tool.ensureToolName")(function* (options: {
  readonly event: "PreToolUse" | "PostToolUse";
  readonly expected: string;
  readonly actual: string;
}) {
  if (options.actual === options.expected) {
    return;
  }
  return yield* HookToolDecodeError.make({
    event: options.event,
    toolName: options.expected,
    payload: "tool_name",
    cause: `Expected tool_name ${options.expected}, received ${options.actual}`,
  });
});

/**
 * Decode a `PreToolUse` payload with a custom adapter.
 *
 * @category decoding
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.decodePreToolUseWith)
 * ```
 */
export const decodePreToolUseWith = Effect.fn("Hook.Tool.decodePreToolUseWith")(function* <TName extends string, TTool>(
  adapter: PreToolAdapter<TName, TTool>,
  input: PreToolUse.Input
): Effect.fn.Return<DecodedPreToolUseWith<TTool>, HookToolDecodeError> {
  yield* ensureToolName({
    event: "PreToolUse",
    expected: adapter.toolName,
    actual: input.tool_name,
  });
  const tool = yield* decodeToolInput({
    event: "PreToolUse",
    toolName: adapter.toolName,
    payload: "tool_input",
    value: input.tool_input,
    decoder: adapter.inputSchema,
  });
  return { input, tool };
});

/**
 * Decode a `PostToolUse` payload with a custom adapter.
 *
 * @category decoding
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.decodePostToolUseWith)
 * ```
 */
export const decodePostToolUseWith = Effect.fn("Hook.Tool.decodePostToolUseWith")(function* <
  TName extends string,
  TTool,
  TResponse,
>(
  adapter: PostToolAdapter<TName, TTool, TResponse>,
  input: PostToolUse.Input
): Effect.fn.Return<DecodedPostToolUseWith<TTool, TResponse>, HookToolDecodeError> {
  yield* ensureToolName({
    event: "PostToolUse",
    expected: adapter.toolName,
    actual: input.tool_name,
  });
  const { tool, response } = yield* Effect.all(
    {
      tool: decodeToolInput({
        event: "PostToolUse",
        toolName: adapter.toolName,
        payload: "tool_input",
        value: input.tool_input,
        decoder: adapter.inputSchema,
      }),
      response: decodeToolInput({
        event: "PostToolUse",
        toolName: adapter.toolName,
        payload: "tool_response",
        value: input.tool_response,
        decoder: adapter.responseSchema,
      }),
    },
    { concurrency: 1 }
  );
  return { input, tool, response };
});

/**
 * Decode the typed payload for a supported `PreToolUse` tool event.
 *
 * @category decoding
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.decodePreToolUse)
 * ```
 */
export const decodePreToolUse = Effect.fn("Hook.Tool.decodePreToolUse")(
  <T extends SupportedToolName>(
    toolName: T,
    input: PreToolUse.Input
  ): Effect.Effect<DecodedPreToolUse<T>, HookToolDecodeError> => decodePreToolUseWith(preToolAdapters[toolName], input)
);

/**
 * Decode the typed payload for a supported `PostToolUse` tool event.
 *
 * @category decoding
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Tool.decodePostToolUse)
 * ```
 */
export const decodePostToolUse = Effect.fn("Hook.Tool.decodePostToolUse")(
  <T extends SupportedToolName>(
    toolName: T,
    input: PostToolUse.Input
  ): Effect.Effect<DecodedPostToolUse<T>, HookToolDecodeError> =>
    decodePostToolUseWith(postToolAdapters[toolName], input)
);

/**
 * Decoded and wire-encoded companion types for {@link BashToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.BashToolInput.Encoded
 * ```
 */
export declare namespace BashToolInput {
  /**
   * Decoded runtime representation of {@link BashToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = BashToolInput;
  /**
   * Wire-encoded representation of {@link BashToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BashToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link BashToolResponse}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.BashToolResponse.Encoded
 * ```
 */
export declare namespace BashToolResponse {
  /**
   * Decoded runtime representation of {@link BashToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = BashToolResponse;
  /**
   * Wire-encoded representation of {@link BashToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof BashToolResponse.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link ReadToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.ReadToolInput.Encoded
 * ```
 */
export declare namespace ReadToolInput {
  /**
   * Decoded runtime representation of {@link ReadToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ReadToolInput;
  /**
   * Wire-encoded representation of {@link ReadToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ReadToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link ReadToolResponse}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.ReadToolResponse.Encoded
 * ```
 */
export declare namespace ReadToolResponse {
  /**
   * Decoded runtime representation of {@link ReadToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ReadToolResponse;
  /**
   * Wire-encoded representation of {@link ReadToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ReadToolResponse.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link WriteToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.WriteToolInput.Encoded
 * ```
 */
export declare namespace WriteToolInput {
  /**
   * Decoded runtime representation of {@link WriteToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = WriteToolInput;
  /**
   * Wire-encoded representation of {@link WriteToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WriteToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link EditToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.EditToolInput.Encoded
 * ```
 */
export declare namespace EditToolInput {
  /**
   * Decoded runtime representation of {@link EditToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = EditToolInput;
  /**
   * Wire-encoded representation of {@link EditToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof EditToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link GlobToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.GlobToolInput.Encoded
 * ```
 */
export declare namespace GlobToolInput {
  /**
   * Decoded runtime representation of {@link GlobToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GlobToolInput;
  /**
   * Wire-encoded representation of {@link GlobToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GlobToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link GrepToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.GrepToolInput.Encoded
 * ```
 */
export declare namespace GrepToolInput {
  /**
   * Decoded runtime representation of {@link GrepToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = GrepToolInput;
  /**
   * Wire-encoded representation of {@link GrepToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GrepToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link WebFetchToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.WebFetchToolInput.Encoded
 * ```
 */
export declare namespace WebFetchToolInput {
  /**
   * Decoded runtime representation of {@link WebFetchToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = WebFetchToolInput;
  /**
   * Wire-encoded representation of {@link WebFetchToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WebFetchToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link WebSearchToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.WebSearchToolInput.Encoded
 * ```
 */
export declare namespace WebSearchToolInput {
  /**
   * Decoded runtime representation of {@link WebSearchToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = WebSearchToolInput;
  /**
   * Wire-encoded representation of {@link WebSearchToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof WebSearchToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link AgentToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.AgentToolInput.Encoded
 * ```
 */
export declare namespace AgentToolInput {
  /**
   * Decoded runtime representation of {@link AgentToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AgentToolInput;
  /**
   * Wire-encoded representation of {@link AgentToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AgentToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link AgentToolResponse}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.AgentToolResponse.Encoded
 * ```
 */
export declare namespace AgentToolResponse {
  /**
   * Decoded runtime representation of {@link AgentToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AgentToolResponse;
  /**
   * Wire-encoded representation of {@link AgentToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AgentToolResponse.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link AskUserQuestionOption}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.AskUserQuestionOption.Encoded
 * ```
 */
export declare namespace AskUserQuestionOption {
  /**
   * Decoded runtime representation of {@link AskUserQuestionOption}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AskUserQuestionOption;
  /**
   * Wire-encoded representation of {@link AskUserQuestionOption}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AskUserQuestionOption.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link AskUserQuestionQuestion}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.AskUserQuestionQuestion.Encoded
 * ```
 */
export declare namespace AskUserQuestionQuestion {
  /**
   * Decoded runtime representation of {@link AskUserQuestionQuestion}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AskUserQuestionQuestion;
  /**
   * Wire-encoded representation of {@link AskUserQuestionQuestion}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AskUserQuestionQuestion.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link AskUserQuestionToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.AskUserQuestionToolInput.Encoded
 * ```
 */
export declare namespace AskUserQuestionToolInput {
  /**
   * Decoded runtime representation of {@link AskUserQuestionToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = AskUserQuestionToolInput;
  /**
   * Wire-encoded representation of {@link AskUserQuestionToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AskUserQuestionToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link ExitPlanAllowedPrompt}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.ExitPlanAllowedPrompt.Encoded
 * ```
 */
export declare namespace ExitPlanAllowedPrompt {
  /**
   * Decoded runtime representation of {@link ExitPlanAllowedPrompt}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ExitPlanAllowedPrompt;
  /**
   * Wire-encoded representation of {@link ExitPlanAllowedPrompt}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ExitPlanAllowedPrompt.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link ExitPlanModeToolInput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.ExitPlanModeToolInput.Encoded
 * ```
 */
export declare namespace ExitPlanModeToolInput {
  /**
   * Decoded runtime representation of {@link ExitPlanModeToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ExitPlanModeToolInput;
  /**
   * Wire-encoded representation of {@link ExitPlanModeToolInput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ExitPlanModeToolInput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link ExitPlanModeToolResponse}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Tool.ExitPlanModeToolResponse.Encoded
 * ```
 */
export declare namespace ExitPlanModeToolResponse {
  /**
   * Decoded runtime representation of {@link ExitPlanModeToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ExitPlanModeToolResponse;
  /**
   * Wire-encoded representation of {@link ExitPlanModeToolResponse}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ExitPlanModeToolResponse.Encoded;
}
