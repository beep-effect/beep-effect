/**
 * Typed adapters for common Claude Code tool payloads.
 *
 * The core hook event schemas intentionally preserve Claude Code's raw wire
 * format (`tool_input` / `tool_response` as loose records). This module adds a
 * thin typed layer for the built-in tool shapes documented by Claude Code.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect } from "effect";
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
 * @see {@link definePreAdapter} to construct an adapter for {@link decodePreToolUseWith}.
 * @category models
 * @since 0.0.0
 */
export interface PreToolAdapter<TName extends string, TTool> {
  readonly toolName: TName;
  readonly inputSchema: S.Decoder<TTool>;
}

/**
 * Typed adapter for decoding both `tool_input` and `tool_response` payloads.
 *
 * @see {@link definePostAdapter} to construct an adapter for {@link decodePostToolUseWith}.
 * @category models
 * @since 0.0.0
 */
export interface PostToolAdapter<TName extends string, TTool, TResponse> extends PreToolAdapter<TName, TTool> {
  readonly responseSchema: S.Decoder<TResponse>;
}

/**
 * Define a typed pre-tool adapter from a schema.
 *
 * **Example** (Decode a custom pre-tool adapter)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const adapter = Hook.Tool.definePreAdapter({
 *   toolName: "Bash",
 *   inputSchema: Hook.Tool.BashToolInput
 * })
 * const input = Hook.PreToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PreToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePreToolUseWith(adapter, input))
 * console.log(adapter.toolName) // "Bash"
 * console.log(decoded.tool.command) // "pwd"
 * ```
 *
 * @see {@link decodePreToolUseWith} to apply the adapter to a PreToolUse payload.
 * @category constructors
 * @since 0.0.0
 */
export const definePreAdapter = <const TName extends string, TTool>(config: {
  readonly toolName: TName;
  readonly inputSchema: S.Decoder<TTool>;
}): PreToolAdapter<TName, TTool> => config;

/**
 * Define a typed post-tool adapter from input / response schemas.
 *
 * **Example** (Decode a custom post-tool adapter)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const adapter = Hook.Tool.definePostAdapter({
 *   toolName: "Bash",
 *   inputSchema: Hook.Tool.BashToolInput,
 *   responseSchema: Hook.Tool.BashToolResponse
 * })
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" },
 *   tool_response: { stdout: "/repo" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(adapter, input))
 * console.log(adapter.toolName) // "Bash"
 * console.log(O.getOrUndefined(decoded.response.stdout)) // "/repo"
 * ```
 *
 * @see {@link decodePostToolUseWith} to apply the adapter to a PostToolUse payload.
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Construct bash tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.BashToolInput.make({ command: "pwd" })
 * console.log(input.command) // "pwd"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct bash tool response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const response = Hook.Tool.BashToolResponse.make({ stdout: O.some("/repo") })
 * console.log(O.getOrUndefined(response.stdout)) // "/repo"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct read tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.ReadToolInput.make({ file_path: "/tmp/a.ts" })
 * console.log(input.file_path) // "/tmp/a.ts"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct read tool response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const response = Hook.Tool.ReadToolResponse.make({ content: O.some("export {}") })
 * console.log(O.getOrUndefined(response.content)) // "export {}"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct write tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.WriteToolInput.make({
 *   file_path: "/tmp/a.ts",
 *   content: "export {}"
 * })
 * console.log(input.file_path) // "/tmp/a.ts"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct edit tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.EditToolInput.make({
 *   file_path: "/tmp/a.ts",
 *   old_string: "a",
 *   new_string: "b"
 * })
 * console.log(input.new_string) // "b"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct glob tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.GlobToolInput.make({ pattern: "**\/*.ts" })
 * console.log(input.pattern) // "**\/*.ts"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
 */
export class GlobToolInput extends S.Class<GlobToolInput>($I`GlobToolInput`)(
  { pattern: S.String, path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault) },
  $I.annote("GlobToolInput", {
    description: "Typed input payload for Claude Code's Glob tool.",
  })
) {}

/**
 * Output representation requested from Claude Code's Grep tool.
 *
 * **Example** (Decode a grep output mode)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const mode = S.decodeUnknownSync(Hook.Tool.GrepOutputMode)("content")
 * console.log(mode) // "content"
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const GrepOutputMode = LiteralKit(["content", "files_with_matches", "count"]).pipe(
  $I.annoteSchema("GrepOutputMode", {
    description: "Output representation requested from Claude Code's Grep tool.",
  })
);

/**
 * Decoded value produced by {@link GrepOutputMode}.
 *
 * @see {@link GrepOutputMode} for the runtime schema and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type GrepOutputMode = typeof GrepOutputMode.Type;

/**
 * Typed `tool_input` payload for the `Grep` tool.
 *
 * **Example** (Construct grep tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.GrepToolInput.make({ pattern: "TODO" })
 * console.log(input.pattern) // "TODO"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct web fetch tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.WebFetchToolInput.make({
 *   url: "https://example.com",
 *   prompt: "Summarize"
 * })
 * console.log(input.url) // "https://example.com"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct web search tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.WebSearchToolInput.make({ query: "effect schema" })
 * console.log(input.query) // "effect schema"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct agent tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.AgentToolInput.make({
 *   prompt: "Summarize the diff",
 *   description: "Summarize",
 *   subagent_type: "general-purpose"
 * })
 * console.log(input.subagent_type) // "general-purpose"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct agent tool response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const response = Hook.Tool.AgentToolResponse.make({
 *   status: O.some("completed")
 * })
 * console.log(O.getOrUndefined(response.status)) // "completed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct an ask-user-question option)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const option = Hook.Tool.AskUserQuestionOption.make({ label: "TypeScript" })
 * console.log(option.label) // "TypeScript"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct an ask-user-question prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const question = Hook.Tool.AskUserQuestionQuestion.make({
 *   question: "Which language?",
 *   header: "Language",
 *   options: [Hook.Tool.AskUserQuestionOption.make({ label: "TypeScript" })]
 * })
 * console.log(question.header) // "Language"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct ask-user-question tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const question = Hook.Tool.AskUserQuestionQuestion.make({
 *   question: "Which language?",
 *   header: "Language",
 *   options: [Hook.Tool.AskUserQuestionOption.make({ label: "TypeScript" })]
 * })
 * const input = Hook.Tool.AskUserQuestionToolInput.make({ questions: [question] })
 * console.log(input.questions.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct an exit-plan allowed prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const prompt = Hook.Tool.ExitPlanAllowedPrompt.make({
 *   tool: "Bash",
 *   prompt: "run tests"
 * })
 * console.log(prompt.tool) // "Bash"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct exit-plan-mode tool input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const input = Hook.Tool.ExitPlanModeToolInput.make({
 *   plan: "Ship the matcher docs",
 *   planFilePath: "/tmp/plan.md"
 * })
 * console.log(input.planFilePath) // "/tmp/plan.md"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Construct exit-plan-mode tool response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const response = Hook.Tool.ExitPlanModeToolResponse.make({
 *   approved: O.some(true)
 * })
 * console.log(O.getOrUndefined(response.approved)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 *
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
 * **Example** (Decode a Bash post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" },
 *   tool_response: { stdout: "/repo" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.BashAdapter, input))
 * console.log(Hook.Tool.BashAdapter.toolName) // "Bash"
 * console.log(O.getOrUndefined(decoded.response.stdout)) // "/repo"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @category adapters
 * @since 0.0.0
 */
export const BashAdapter = definePostAdapter({
  toolName: "Bash",
  inputSchema: BashToolInput,
  responseSchema: BashToolResponse,
});

/**
 * Built-in adapter for the `Read` tool.
 *
 * **Example** (Decode a Read post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Read",
 *   tool_input: { file_path: "/tmp/a.ts" },
 *   tool_response: { content: "export {}" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.ReadAdapter, input))
 * console.log(Hook.Tool.ReadAdapter.toolName) // "Read"
 * console.log(O.getOrUndefined(decoded.response.content)) // "export {}"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @category adapters
 * @since 0.0.0
 */
export const ReadAdapter = definePostAdapter({
  toolName: "Read",
  inputSchema: ReadToolInput,
  responseSchema: ReadToolResponse,
});

/**
 * Built-in adapter for the `Write` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode a Write post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Write",
 *   tool_input: { file_path: "/tmp/a.ts", content: "export {}" },
 *   tool_response: { ok: true }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.WriteAdapter, input))
 * console.log(Hook.Tool.WriteAdapter.toolName) // "Write"
 * console.log(decoded.tool.file_path) // "/tmp/a.ts"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const WriteAdapter = definePostAdapter({
  toolName: "Write",
  inputSchema: WriteToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Edit` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode an Edit post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Edit",
 *   tool_input: { file_path: "/tmp/a.ts", old_string: "a", new_string: "b" },
 *   tool_response: { ok: true }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.EditAdapter, input))
 * console.log(Hook.Tool.EditAdapter.toolName) // "Edit"
 * console.log(decoded.tool.new_string) // "b"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const EditAdapter = definePostAdapter({
  toolName: "Edit",
  inputSchema: EditToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Glob` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode a Glob post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Glob",
 *   tool_input: { pattern: "**\/*.ts" },
 *   tool_response: { files: ["src/a.ts"] }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.GlobAdapter, input))
 * console.log(Hook.Tool.GlobAdapter.toolName) // "Glob"
 * console.log(decoded.tool.pattern) // "**\/*.ts"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const GlobAdapter = definePostAdapter({
  toolName: "Glob",
  inputSchema: GlobToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Grep` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode a Grep post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Grep",
 *   tool_input: { pattern: "TODO" },
 *   tool_response: { matches: [] }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.GrepAdapter, input))
 * console.log(Hook.Tool.GrepAdapter.toolName) // "Grep"
 * console.log(decoded.tool.pattern) // "TODO"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const GrepAdapter = definePostAdapter({
  toolName: "Grep",
  inputSchema: GrepToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `WebFetch` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode a WebFetch post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "WebFetch",
 *   tool_input: { url: "https://example.com", prompt: "Summarize" },
 *   tool_response: { text: "Example Domain" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.WebFetchAdapter, input))
 * console.log(Hook.Tool.WebFetchAdapter.toolName) // "WebFetch"
 * console.log(decoded.tool.url) // "https://example.com"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const WebFetchAdapter = definePostAdapter({
  toolName: "WebFetch",
  inputSchema: WebFetchToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `WebSearch` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode a WebSearch post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "WebSearch",
 *   tool_input: { query: "effect schema" },
 *   tool_response: { results: [] }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.WebSearchAdapter, input))
 * console.log(Hook.Tool.WebSearchAdapter.toolName) // "WebSearch"
 * console.log(decoded.tool.query) // "effect schema"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const WebSearchAdapter = definePostAdapter({
  toolName: "WebSearch",
  inputSchema: WebSearchToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `Agent` tool.
 *
 * **Example** (Decode an Agent post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Agent",
 *   tool_input: {
 *     prompt: "Summarize the diff",
 *     description: "Summarize",
 *     subagent_type: "general-purpose"
 *   },
 *   tool_response: { status: "completed" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUseWith(Hook.Tool.AgentAdapter, input))
 * console.log(Hook.Tool.AgentAdapter.toolName) // "Agent"
 * console.log(O.getOrUndefined(decoded.response.status)) // "completed"
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @category adapters
 * @since 0.0.0
 */
export const AgentAdapter = definePostAdapter({
  toolName: "Agent",
  inputSchema: AgentToolInput,
  responseSchema: AgentToolResponse,
});

/**
 * Built-in adapter for the `AskUserQuestion` tool.
 *
 * **Gotchas**
 *
 * Post-tool `tool_response` is decoded as `unknown` because Claude Code does
 * not publish a stable response shape for this tool.
 *
 * **Example** (Decode an AskUserQuestion post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "AskUserQuestion",
 *   tool_input: {
 *     questions: [{
 *       question: "Which language?",
 *       header: "Language",
 *       options: [{ label: "TypeScript" }]
 *     }]
 *   },
 *   tool_response: { answers: { Language: "TypeScript" } }
 * })
 * const decoded = Effect.runSync(
 *   Hook.Tool.decodePostToolUseWith(Hook.Tool.AskUserQuestionAdapter, input)
 * )
 * console.log(Hook.Tool.AskUserQuestionAdapter.toolName) // "AskUserQuestion"
 * console.log(decoded.tool.questions.length) // 1
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @see {@link BashAdapter} for a built-in adapter with a typed response schema.
 * @category adapters
 * @since 0.0.0
 */
export const AskUserQuestionAdapter = definePostAdapter({
  toolName: "AskUserQuestion",
  inputSchema: AskUserQuestionToolInput,
  responseSchema: S.Unknown,
});

/**
 * Built-in adapter for the `ExitPlanMode` tool.
 *
 * **Example** (Decode an ExitPlanMode post-tool payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "ExitPlanMode",
 *   tool_input: { plan: "Ship docs", planFilePath: "/tmp/plan.md" },
 *   tool_response: { approved: true }
 * })
 * const decoded = Effect.runSync(
 *   Hook.Tool.decodePostToolUseWith(Hook.Tool.ExitPlanModeAdapter, input)
 * )
 * console.log(Hook.Tool.ExitPlanModeAdapter.toolName) // "ExitPlanMode"
 * console.log(O.getOrUndefined(decoded.response.approved)) // true
 * ```
 *
 * @see {@link decodePostToolUse} to decode a PostToolUse payload by tool name.
 * @category adapters
 * @since 0.0.0
 */
export const ExitPlanModeAdapter = definePostAdapter({
  toolName: "ExitPlanMode",
  inputSchema: ExitPlanModeToolInput,
  responseSchema: ExitPlanModeToolResponse,
});

/**
 * Claude Code tool names that have a built-in typed adapter.
 *
 * **Example** (Decode a supported tool name)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const name = S.decodeUnknownSync(Hook.Tool.SupportedToolName)("Bash")
 * console.log(name) // "Bash"
 * ```
 *
 * @category schemas
 * @since 0.0.0
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
 * Decoded value produced by {@link SupportedToolName}.
 *
 * @see {@link SupportedToolName} for the runtime schema and decoding behavior.
 * @category type-level
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
 * Typed PreToolUse view produced by {@link decodePreToolUseWith}, pairing the
 * raw event with a schema-decoded `tool` payload.
 *
 * @see {@link decodePreToolUseWith} to decode with a custom adapter.
 * @see {@link decodePreToolUse} to decode a built-in tool by name.
 * @category models
 * @since 0.0.0
 */
export type DecodedPreToolUseWith<TTool> = {
  readonly input: PreToolUse.Input;
  readonly tool: TTool;
};

/**
 * Typed PreToolUse view produced by {@link decodePreToolUse} for a built-in
 * tool name.
 *
 * @see {@link decodePreToolUse} for the built-in decoder that yields this view.
 * @see {@link decodePreToolUseWith} when supplying a custom adapter instead.
 * @category models
 * @since 0.0.0
 */
export type DecodedPreToolUse<T extends SupportedToolName> = DecodedPreToolUseWith<PreToolTypeMap[T]>;

/**
 * Typed PostToolUse view produced by {@link decodePostToolUseWith}, pairing the
 * raw event with schema-decoded `tool` and `response` payloads.
 *
 * @see {@link decodePostToolUseWith} to decode with a custom adapter.
 * @see {@link decodePostToolUse} to decode a built-in tool by name.
 * @category models
 * @since 0.0.0
 */
export type DecodedPostToolUseWith<TTool, TResponse> = {
  readonly input: PostToolUse.Input;
  readonly tool: TTool;
  readonly response: TResponse;
};

/**
 * Typed PostToolUse view produced by {@link decodePostToolUse} for a built-in
 * tool name.
 *
 * @see {@link decodePostToolUse} for the built-in decoder that yields this view.
 * @see {@link decodePostToolUseWith} when supplying a custom adapter instead.
 * @category models
 * @since 0.0.0
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
 * **Example** (Decode Bash input with an adapter)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PreToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PreToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" }
 * })
 * const decoded = Effect.runSync(
 *   Hook.Tool.decodePreToolUseWith(Hook.Tool.BashAdapter, input)
 * )
 *
 * console.log(decoded.tool.command) // "pwd"
 * ```
 *
 * @effects Validates the tool name and input schema, failing with `HookToolDecodeError` when either payload is invalid.
 * @category decoding
 * @since 0.0.0
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
 * **Example** (Decode Bash input and output with an adapter)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" },
 *   tool_response: { stdout: "/repo" }
 * })
 * const decoded = Effect.runSync(
 *   Hook.Tool.decodePostToolUseWith(Hook.Tool.BashAdapter, input)
 * )
 *
 * console.log(decoded.response.stdout)
 * ```
 *
 * @effects Validates the tool name, input, and response schemas, failing with `HookToolDecodeError` for invalid payloads.
 * @category decoding
 * @since 0.0.0
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
 * **Example** (Decode a supported Bash event)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PreToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PreToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePreToolUse("Bash", input))
 *
 * console.log(decoded.tool.command) // "pwd"
 * ```
 *
 * @effects Decodes the selected built-in tool schema and fails with `HookToolDecodeError` when the event does not match it.
 * @category decoding
 * @since 0.0.0
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
 * **Example** (Decode a supported Bash result)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const input = Hook.PostToolUse.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PostToolUse",
 *   tool_name: "Bash",
 *   tool_input: { command: "pwd" },
 *   tool_response: { stdout: "/repo" }
 * })
 * const decoded = Effect.runSync(Hook.Tool.decodePostToolUse("Bash", input))
 *
 * console.log(decoded.response.stdout)
 * ```
 *
 * @effects Decodes the selected built-in tool input and response schemas, failing with `HookToolDecodeError` for invalid events.
 * @category decoding
 * @since 0.0.0
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
 * **Example** (Encode constructed Bash input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.BashToolInput.make({ command: "pwd" })
 * const encoded = S.encodeSync(Hook.Tool.BashToolInput)(input)
 * console.log(encoded.command) // "pwd"
 * ```
 *
 * @see {@link BashToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Bash response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const response = Hook.Tool.BashToolResponse.make({ stdout: O.some("/repo") })
 * const encoded = S.encodeSync(Hook.Tool.BashToolResponse)(response)
 * console.log(encoded.stdout) // "/repo"
 * ```
 *
 * @see {@link BashToolResponse} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Read input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.ReadToolInput.make({ file_path: "/tmp/a.ts" })
 * const encoded = S.encodeSync(Hook.Tool.ReadToolInput)(input)
 * console.log(encoded.file_path) // "/tmp/a.ts"
 * ```
 *
 * @see {@link ReadToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Read response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const response = Hook.Tool.ReadToolResponse.make({ content: O.some("export {}") })
 * const encoded = S.encodeSync(Hook.Tool.ReadToolResponse)(response)
 * console.log(encoded.content) // "export {}"
 * ```
 *
 * @see {@link ReadToolResponse} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Write input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.WriteToolInput.make({
 *   file_path: "/tmp/a.ts",
 *   content: "export {}"
 * })
 * const encoded = S.encodeSync(Hook.Tool.WriteToolInput)(input)
 * console.log(encoded.file_path) // "/tmp/a.ts"
 * ```
 *
 * @see {@link WriteToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Edit input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.EditToolInput.make({
 *   file_path: "/tmp/a.ts",
 *   old_string: "a",
 *   new_string: "b"
 * })
 * const encoded = S.encodeSync(Hook.Tool.EditToolInput)(input)
 * console.log(encoded.new_string) // "b"
 * ```
 *
 * @see {@link EditToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Glob input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.GlobToolInput.make({ pattern: "**\/*.ts" })
 * const encoded = S.encodeSync(Hook.Tool.GlobToolInput)(input)
 * console.log(encoded.pattern) // "**\/*.ts"
 * ```
 *
 * @see {@link GlobToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Grep input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.GrepToolInput.make({ pattern: "TODO" })
 * const encoded = S.encodeSync(Hook.Tool.GrepToolInput)(input)
 * console.log(encoded.pattern) // "TODO"
 * ```
 *
 * @see {@link GrepToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed WebFetch input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.WebFetchToolInput.make({
 *   url: "https://example.com",
 *   prompt: "Summarize"
 * })
 * const encoded = S.encodeSync(Hook.Tool.WebFetchToolInput)(input)
 * console.log(encoded.url) // "https://example.com"
 * ```
 *
 * @see {@link WebFetchToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed WebSearch input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.WebSearchToolInput.make({ query: "effect schema" })
 * const encoded = S.encodeSync(Hook.Tool.WebSearchToolInput)(input)
 * console.log(encoded.query) // "effect schema"
 * ```
 *
 * @see {@link WebSearchToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Agent input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.AgentToolInput.make({
 *   prompt: "Summarize the diff",
 *   description: "Summarize",
 *   subagent_type: "general-purpose"
 * })
 * const encoded = S.encodeSync(Hook.Tool.AgentToolInput)(input)
 * console.log(encoded.subagent_type) // "general-purpose"
 * ```
 *
 * @see {@link AgentToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed Agent response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const response = Hook.Tool.AgentToolResponse.make({
 *   status: O.some("completed")
 * })
 * const encoded = S.encodeSync(Hook.Tool.AgentToolResponse)(response)
 * console.log(encoded.status) // "completed"
 * ```
 *
 * @see {@link AgentToolResponse} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode a constructed question option)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const option = Hook.Tool.AskUserQuestionOption.make({ label: "TypeScript" })
 * const encoded = S.encodeSync(Hook.Tool.AskUserQuestionOption)(option)
 * console.log(encoded.label) // "TypeScript"
 * ```
 *
 * @see {@link AskUserQuestionOption} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode a constructed question)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const question = Hook.Tool.AskUserQuestionQuestion.make({
 *   question: "Which language?",
 *   header: "Language",
 *   options: [Hook.Tool.AskUserQuestionOption.make({ label: "TypeScript" })]
 * })
 * const encoded = S.encodeSync(Hook.Tool.AskUserQuestionQuestion)(question)
 * console.log(encoded.header) // "Language"
 * ```
 *
 * @see {@link AskUserQuestionQuestion} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed AskUserQuestion input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const question = Hook.Tool.AskUserQuestionQuestion.make({
 *   question: "Which language?",
 *   header: "Language",
 *   options: [Hook.Tool.AskUserQuestionOption.make({ label: "TypeScript" })]
 * })
 * const input = Hook.Tool.AskUserQuestionToolInput.make({ questions: [question] })
 * const encoded = S.encodeSync(Hook.Tool.AskUserQuestionToolInput)(input)
 * console.log(encoded.questions.length) // 1
 * ```
 *
 * @see {@link AskUserQuestionToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode a constructed allowed prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const prompt = Hook.Tool.ExitPlanAllowedPrompt.make({
 *   tool: "Bash",
 *   prompt: "run tests"
 * })
 * const encoded = S.encodeSync(Hook.Tool.ExitPlanAllowedPrompt)(prompt)
 * console.log(encoded.tool) // "Bash"
 * ```
 *
 * @see {@link ExitPlanAllowedPrompt} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed ExitPlanMode input)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = Hook.Tool.ExitPlanModeToolInput.make({
 *   plan: "Ship the matcher docs",
 *   planFilePath: "/tmp/plan.md"
 * })
 * const encoded = S.encodeSync(Hook.Tool.ExitPlanModeToolInput)(input)
 * console.log(encoded.planFilePath) // "/tmp/plan.md"
 * ```
 *
 * @see {@link ExitPlanModeToolInput} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
 * **Example** (Encode constructed ExitPlanMode response)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const response = Hook.Tool.ExitPlanModeToolResponse.make({
 *   approved: O.some(true)
 * })
 * const encoded = S.encodeSync(Hook.Tool.ExitPlanModeToolResponse)(response)
 * console.log(encoded.approved) // true
 * ```
 *
 * @see {@link ExitPlanModeToolResponse} for the runtime schema, `.make`, and decoded fields.
 * @category type-level
 * @since 0.0.0
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
