/**
 * Tagged errors for effect-claudecode.
 *
 * All cross-module errors are declared here and re-exported from
 * `src/index.ts` at the top level so consumers can import them directly
 * (e.g. `import { HookInputDecodeError } from 'effect-claudecode'`) and
 * use them in `Effect.catchTag`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("claudecode/Errors");

const HookInputPhase = LiteralKit(["json", "schema"]).pipe(
  $I.annoteSchema("HookInputPhase", {
    description: "Runner phase in which a Claude Code hook input failed to decode.",
  })
);

const HookToolEvent = LiteralKit(["PreToolUse", "PostToolUse"]).pipe(
  $I.annoteSchema("HookToolEvent", {
    description: "Tool hook event whose typed payload failed to decode.",
  })
);

const HookToolPayload = LiteralKit(["tool_name", "tool_input", "tool_response"]).pipe(
  $I.annoteSchema("HookToolPayload", {
    description: "Tool hook payload member that failed to decode.",
  })
);

// ---------------------------------------------------------------------------
// Hook runner errors
// ---------------------------------------------------------------------------

/**
 * Raised when reading from stdin fails.
 *
 * Exit-code mapping: 1 (non-blocking).
 *
 * **Example** (Inspect a stdin failure)
 *
 * ```ts
 * import { HookStdinReadError } from "effect-claudecode"
 *
 * const error = HookStdinReadError.make({ cause: "stdin closed" })
 * console.log(error._tag) // "HookStdinReadError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookStdinReadError extends S.TaggedError<HookStdinReadError>($I`HookStdinReadError`)(
  "HookStdinReadError",
  { cause: S.Defect() },
  $I.annote("HookStdinReadError", {
    description: "Failure while reading a Claude Code hook invocation from stdin.",
  })
) {}

/**
 * Raised when decoding hook input fails. The `phase` field distinguishes
 * JSON parse failure (`'json'`) from schema validation failure (`'schema'`).
 *
 * Exit-code mapping: 2. Claude Code interprets exit 2 per event: it
 * blocks/denies some gate events and is feedback-only or ignored for
 * several observability events.
 *
 * **Example** (Inspect a schema decode failure)
 *
 * ```ts
 * import { HookInputDecodeError } from "effect-claudecode"
 *
 * const error = HookInputDecodeError.make({ cause: "invalid payload", phase: "schema" })
 * console.log(error.phase) // "schema"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookInputDecodeError extends S.TaggedError<HookInputDecodeError>($I`HookInputDecodeError`)(
  "HookInputDecodeError",
  {
    cause: S.Defect(),
    phase: HookInputPhase,
  },
  $I.annote("HookInputDecodeError", {
    description: "Failure while decoding a Claude Code hook input payload.",
  })
) {}

/**
 * Raised when the user-supplied hook handler fails.
 *
 * Exit-code mapping: 1 (non-blocking).
 *
 * **Example** (Inspect a handler failure)
 *
 * ```ts
 * import { HookHandlerError } from "effect-claudecode"
 *
 * const error = HookHandlerError.make({ cause: "handler failed" })
 * console.log(error._tag) // "HookHandlerError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookHandlerError extends S.TaggedError<HookHandlerError>($I`HookHandlerError`)(
  "HookHandlerError",
  { cause: S.Defect() },
  $I.annote("HookHandlerError", {
    description: "Failure returned by a user-supplied Claude Code hook handler.",
  })
) {}

/**
 * Raised when encoding the handler output to JSON fails.
 *
 * Exit-code mapping: 1 (non-blocking).
 *
 * **Example** (Inspect an output encode failure)
 *
 * ```ts
 * import { HookOutputEncodeError } from "effect-claudecode"
 *
 * const error = HookOutputEncodeError.make({ cause: "output was invalid" })
 * console.log(error._tag) // "HookOutputEncodeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookOutputEncodeError extends S.TaggedError<HookOutputEncodeError>($I`HookOutputEncodeError`)(
  "HookOutputEncodeError",
  { cause: S.Defect() },
  $I.annote("HookOutputEncodeError", {
    description: "Failure while encoding a Claude Code hook handler output.",
  })
) {}

/**
 * Raised when writing to stdout fails.
 *
 * Exit-code mapping: 1 (non-blocking).
 *
 * **Example** (Inspect a stdout failure)
 *
 * ```ts
 * import { HookStdoutWriteError } from "effect-claudecode"
 *
 * const error = HookStdoutWriteError.make({ cause: "stdout closed" })
 * console.log(error._tag) // "HookStdoutWriteError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookStdoutWriteError extends S.TaggedError<HookStdoutWriteError>($I`HookStdoutWriteError`)(
  "HookStdoutWriteError",
  { cause: S.Defect() },
  $I.annote("HookStdoutWriteError", {
    description: "Failure while writing a Claude Code hook response to stdio.",
  })
) {}

/**
 * Raised internally when a handler intentionally controls the command
 * process exit status (for example, an exit-2 hook response).
 *
 * **Example** (Inspect a controlled exit)
 *
 * ```ts
 * import { HookControlledExit } from "effect-claudecode"
 *
 * const error = HookControlledExit.make({ code: 2 })
 * console.log(error.code) // 2
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookControlledExit extends S.TaggedError<HookControlledExit>($I`HookControlledExit`)(
  "HookControlledExit",
  { code: S.Finite },
  $I.annote("HookControlledExit", {
    description: "Internal signal carrying a handler-requested hook process exit code.",
  })
) {}

/**
 * Raised when decoding a known tool payload from `tool_input` or
 * `tool_response` fails.
 *
 * **Example** (Inspect a tool payload failure)
 *
 * ```ts
 * import { HookToolDecodeError } from "effect-claudecode"
 *
 * const error = HookToolDecodeError.make({
 *   event: "PreToolUse",
 *   toolName: "Bash",
 *   payload: "tool_input",
 *   cause: "invalid command"
 * })
 * console.log(error.toolName) // "Bash"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookToolDecodeError extends S.TaggedError<HookToolDecodeError>($I`HookToolDecodeError`)(
  "HookToolDecodeError",
  {
    event: HookToolEvent,
    toolName: S.String,
    payload: HookToolPayload,
    cause: S.Defect(),
  },
  $I.annote("HookToolDecodeError", {
    description: "Failure while decoding a typed Claude Code tool hook payload.",
  })
) {}

// ---------------------------------------------------------------------------
// Transcript errors
// ---------------------------------------------------------------------------

/**
 * Raised when reading or parsing a transcript file fails.
 *
 * **Example** (Inspect a transcript failure)
 *
 * ```ts
 * import { TranscriptReadError } from "effect-claudecode"
 *
 * const error = TranscriptReadError.make({ path: "/tmp/session.jsonl", cause: "not found" })
 * console.log(error.path) // "/tmp/session.jsonl"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TranscriptReadError extends S.TaggedError<TranscriptReadError>($I`TranscriptReadError`)(
  "TranscriptReadError",
  { path: S.String, cause: S.Defect() },
  $I.annote("TranscriptReadError", {
    description: "Failure while reading or decoding a Claude Code transcript.",
  })
) {}

// ---------------------------------------------------------------------------
// Settings errors
// ---------------------------------------------------------------------------

/**
 * Raised when reading a settings.json file fails (I/O error, etc.).
 *
 * **Example** (Inspect a settings read failure)
 *
 * ```ts
 * import { SettingsReadError } from "effect-claudecode"
 *
 * const error = SettingsReadError.make({ path: "/repo/.claude/settings.json", cause: "not found" })
 * console.log(error.path)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SettingsReadError extends S.TaggedError<SettingsReadError>($I`SettingsReadError`)(
  "SettingsReadError",
  { path: S.String, cause: S.Defect() },
  $I.annote("SettingsReadError", {
    description: "Failure while reading a Claude Code settings file.",
  })
) {}

/**
 * Raised when a settings.json file contains invalid JSON.
 *
 * **Example** (Inspect a settings parse failure)
 *
 * ```ts
 * import { SettingsParseError } from "effect-claudecode"
 *
 * const error = SettingsParseError.make({ path: "/repo/.claude/settings.json", cause: "invalid JSON" })
 * console.log(error._tag) // "SettingsParseError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SettingsParseError extends S.TaggedError<SettingsParseError>($I`SettingsParseError`)(
  "SettingsParseError",
  { path: S.String, cause: S.Defect() },
  $I.annote("SettingsParseError", {
    description: "Failure while parsing a Claude Code settings file as JSON.",
  })
) {}

/**
 * Raised when a settings.json file parses as JSON but fails schema
 * validation.
 *
 * **Example** (Inspect a settings decode failure)
 *
 * ```ts
 * import { SettingsDecodeError } from "effect-claudecode"
 *
 * const error = SettingsDecodeError.make({ path: "/repo/.claude/settings.json", cause: "invalid settings" })
 * console.log(error._tag) // "SettingsDecodeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SettingsDecodeError extends S.TaggedError<SettingsDecodeError>($I`SettingsDecodeError`)(
  "SettingsDecodeError",
  { path: S.String, cause: S.Defect() },
  $I.annote("SettingsDecodeError", {
    description: "Failure while decoding a Claude Code settings document.",
  })
) {}

// ---------------------------------------------------------------------------
// Plugin errors
// ---------------------------------------------------------------------------

/**
 * Raised when materializing a plugin directory fails (I/O error during
 * `mkdir`, `writeFile`, or JSON encoding of the manifest).
 *
 * **Example** (Inspect a plugin write failure)
 *
 * ```ts
 * import { PluginWriteError } from "effect-claudecode"
 *
 * const error = PluginWriteError.make({ path: "/plugin", cause: "permission denied" })
 * console.log(error.path) // "/plugin"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PluginWriteError extends S.TaggedError<PluginWriteError>($I`PluginWriteError`)(
  "PluginWriteError",
  { path: S.String, cause: S.Defect() },
  $I.annote("PluginWriteError", {
    description: "Failure while materializing a Claude Code plugin directory.",
  })
) {}

/**
 * Raised when a plugin definition is internally inconsistent.
 *
 * **Example** (Inspect an inconsistent plugin entry)
 *
 * ```ts
 * import { PluginDefinitionError } from "effect-claudecode"
 *
 * const error = PluginDefinitionError.make({
 *   kind: "skill",
 *   entryName: "review",
 *   frontmatterName: "audit"
 * })
 * console.log(error.entryName) // "review"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PluginDefinitionError extends S.TaggedError<PluginDefinitionError>($I`PluginDefinitionError`)(
  "PluginDefinitionError",
  {
    kind: S.String,
    entryName: S.String,
    frontmatterName: S.String,
  },
  $I.annote("PluginDefinitionError", {
    description: "Internally inconsistent Claude Code plugin definition.",
  })
) {}

/**
 * Raised when reading, parsing, or decoding an existing plugin directory
 * fails.
 *
 * **Example** (Inspect a plugin load failure)
 *
 * ```ts
 * import { PluginLoadError } from "effect-claudecode"
 *
 * const error = PluginLoadError.make({ path: "/plugin", cause: "manifest missing" })
 * console.log(error.path) // "/plugin"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PluginLoadError extends S.TaggedError<PluginLoadError>($I`PluginLoadError`)(
  "PluginLoadError",
  { path: S.String, cause: S.Defect() },
  $I.annote("PluginLoadError", {
    description: "Failure while loading a Claude Code plugin directory.",
  })
) {}

// ---------------------------------------------------------------------------
// Frontmatter errors
// ---------------------------------------------------------------------------

/**
 * Raised when reading a markdown file with YAML frontmatter fails
 * (I/O error, etc.).
 *
 * **Example** (Inspect a frontmatter read failure)
 *
 * ```ts
 * import { FrontmatterReadError } from "effect-claudecode"
 *
 * const error = FrontmatterReadError.make({ path: "/plugin/SKILL.md", cause: "not found" })
 * console.log(error.path) // "/plugin/SKILL.md"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FrontmatterReadError extends S.TaggedError<FrontmatterReadError>($I`FrontmatterReadError`)(
  "FrontmatterReadError",
  { path: S.String, cause: S.Defect() },
  $I.annote("FrontmatterReadError", {
    description: "Failure while reading a Claude Code markdown frontmatter file.",
  })
) {}

/**
 * Raised when a markdown file's YAML frontmatter fails to parse as
 * valid YAML, or when the frontmatter delimiters (`---`) are
 * malformed.
 *
 * **Example** (Inspect a frontmatter parse failure)
 *
 * ```ts
 * import { FrontmatterParseError } from "effect-claudecode"
 *
 * const error = FrontmatterParseError.make({ path: "/plugin/SKILL.md", cause: "invalid YAML" })
 * console.log(error._tag) // "FrontmatterParseError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FrontmatterParseError extends S.TaggedError<FrontmatterParseError>($I`FrontmatterParseError`)(
  "FrontmatterParseError",
  { path: S.String, cause: S.Defect() },
  $I.annote("FrontmatterParseError", {
    description: "Failure while parsing Claude Code markdown frontmatter.",
  })
) {}

/**
 * Raised when a markdown file's frontmatter parses as YAML but fails
 * schema validation against the expected shape (Skill, Subagent,
 * Command, or OutputStyle).
 *
 * **Example** (Inspect a frontmatter decode failure)
 *
 * ```ts
 * import { FrontmatterDecodeError } from "effect-claudecode"
 *
 * const error = FrontmatterDecodeError.make({ path: "/plugin/SKILL.md", cause: "name missing" })
 * console.log(error._tag) // "FrontmatterDecodeError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FrontmatterDecodeError extends S.TaggedError<FrontmatterDecodeError>($I`FrontmatterDecodeError`)(
  "FrontmatterDecodeError",
  { path: S.String, cause: S.Defect() },
  $I.annote("FrontmatterDecodeError", {
    description: "Failure while decoding Claude Code markdown frontmatter.",
  })
) {}

// ---------------------------------------------------------------------------
// MCP errors
// ---------------------------------------------------------------------------

/**
 * Raised when a `.mcp.json` file fails to read, parse, or decode.
 *
 * **Example** (Inspect an MCP configuration failure)
 *
 * ```ts
 * import { McpConfigError } from "effect-claudecode"
 *
 * const error = McpConfigError.make({ path: "/repo/.mcp.json", cause: "invalid JSON" })
 * console.log(error.path) // "/repo/.mcp.json"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class McpConfigError extends S.TaggedError<McpConfigError>($I`McpConfigError`)(
  "McpConfigError",
  { path: S.String, cause: S.Defect() },
  $I.annote("McpConfigError", {
    description: "Failure while reading, parsing, or decoding a Claude Code MCP configuration.",
  })
) {}

/**
 * Decoded and wire-encoded companion types for {@link HookStdinReadError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookStdinReadError } from "effect-claudecode"
 *
 * type Wire = HookStdinReadError.Encoded
 * const error = HookStdinReadError.make({ cause: "stdin closed" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookStdinReadError {
  /**
   * Decoded runtime representation of {@link HookStdinReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookStdinReadError;
  /**
   * Wire-encoded representation of {@link HookStdinReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookStdinReadError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookInputDecodeError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookInputDecodeError } from "effect-claudecode"
 *
 * type Wire = HookInputDecodeError.Encoded
 * const error = HookInputDecodeError.make({ cause: "invalid payload", phase: "json" })
 * console.log(error.phase)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookInputDecodeError {
  /**
   * Decoded runtime representation of {@link HookInputDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookInputDecodeError;
  /**
   * Wire-encoded representation of {@link HookInputDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookInputDecodeError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookHandlerError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookHandlerError } from "effect-claudecode"
 *
 * type Wire = HookHandlerError.Encoded
 * const error = HookHandlerError.make({ cause: "handler failed" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookHandlerError {
  /**
   * Decoded runtime representation of {@link HookHandlerError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookHandlerError;
  /**
   * Wire-encoded representation of {@link HookHandlerError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookHandlerError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookOutputEncodeError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookOutputEncodeError } from "effect-claudecode"
 *
 * type Wire = HookOutputEncodeError.Encoded
 * const error = HookOutputEncodeError.make({ cause: "invalid output" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookOutputEncodeError {
  /**
   * Decoded runtime representation of {@link HookOutputEncodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookOutputEncodeError;
  /**
   * Wire-encoded representation of {@link HookOutputEncodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookOutputEncodeError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookStdoutWriteError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookStdoutWriteError } from "effect-claudecode"
 *
 * type Wire = HookStdoutWriteError.Encoded
 * const error = HookStdoutWriteError.make({ cause: "stdout closed" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookStdoutWriteError {
  /**
   * Decoded runtime representation of {@link HookStdoutWriteError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookStdoutWriteError;
  /**
   * Wire-encoded representation of {@link HookStdoutWriteError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookStdoutWriteError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookControlledExit}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookControlledExit } from "effect-claudecode"
 *
 * type Wire = HookControlledExit.Encoded
 * const error = HookControlledExit.make({ code: 2 })
 * console.log(error.code)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookControlledExit {
  /**
   * Decoded runtime representation of {@link HookControlledExit}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookControlledExit;
  /**
   * Wire-encoded representation of {@link HookControlledExit}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookControlledExit.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookToolDecodeError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { HookToolDecodeError } from "effect-claudecode"
 *
 * type Wire = HookToolDecodeError.Encoded
 * const error = HookToolDecodeError.make({
 *   event: "PostToolUse",
 *   toolName: "Bash",
 *   payload: "tool_response",
 *   cause: "invalid response"
 * })
 * console.log(error.payload)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookToolDecodeError {
  /**
   * Decoded runtime representation of {@link HookToolDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookToolDecodeError;
  /**
   * Wire-encoded representation of {@link HookToolDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookToolDecodeError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link TranscriptReadError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { TranscriptReadError } from "effect-claudecode"
 *
 * type Wire = TranscriptReadError.Encoded
 * const error = TranscriptReadError.make({ path: "/tmp/session.jsonl", cause: "not found" })
 * console.log(error.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TranscriptReadError {
  /**
   * Decoded runtime representation of {@link TranscriptReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = TranscriptReadError;
  /**
   * Wire-encoded representation of {@link TranscriptReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TranscriptReadError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link SettingsReadError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { SettingsReadError } from "effect-claudecode"
 *
 * type Wire = SettingsReadError.Encoded
 * const error = SettingsReadError.make({ path: "/repo/.claude/settings.json", cause: "not found" })
 * console.log(error.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SettingsReadError {
  /**
   * Decoded runtime representation of {@link SettingsReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SettingsReadError;
  /**
   * Wire-encoded representation of {@link SettingsReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SettingsReadError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link SettingsParseError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { SettingsParseError } from "effect-claudecode"
 *
 * type Wire = SettingsParseError.Encoded
 * const error = SettingsParseError.make({ path: "/repo/.claude/settings.json", cause: "invalid JSON" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SettingsParseError {
  /**
   * Decoded runtime representation of {@link SettingsParseError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SettingsParseError;
  /**
   * Wire-encoded representation of {@link SettingsParseError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SettingsParseError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link SettingsDecodeError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { SettingsDecodeError } from "effect-claudecode"
 *
 * type Wire = SettingsDecodeError.Encoded
 * const error = SettingsDecodeError.make({ path: "/repo/.claude/settings.json", cause: "invalid settings" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SettingsDecodeError {
  /**
   * Decoded runtime representation of {@link SettingsDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = SettingsDecodeError;
  /**
   * Wire-encoded representation of {@link SettingsDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SettingsDecodeError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link PluginWriteError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { PluginWriteError } from "effect-claudecode"
 *
 * type Wire = PluginWriteError.Encoded
 * const error = PluginWriteError.make({ path: "/plugin", cause: "permission denied" })
 * console.log(error.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginWriteError {
  /**
   * Decoded runtime representation of {@link PluginWriteError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginWriteError;
  /**
   * Wire-encoded representation of {@link PluginWriteError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginWriteError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link PluginDefinitionError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { PluginDefinitionError } from "effect-claudecode"
 *
 * type Wire = PluginDefinitionError.Encoded
 * const error = PluginDefinitionError.make({
 *   kind: "skill",
 *   entryName: "review",
 *   frontmatterName: "audit"
 * })
 * console.log(error.entryName)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginDefinitionError {
  /**
   * Decoded runtime representation of {@link PluginDefinitionError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginDefinitionError;
  /**
   * Wire-encoded representation of {@link PluginDefinitionError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginDefinitionError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link PluginLoadError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { PluginLoadError } from "effect-claudecode"
 *
 * type Wire = PluginLoadError.Encoded
 * const error = PluginLoadError.make({ path: "/plugin", cause: "manifest missing" })
 * console.log(error.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginLoadError {
  /**
   * Decoded runtime representation of {@link PluginLoadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginLoadError;
  /**
   * Wire-encoded representation of {@link PluginLoadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginLoadError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link FrontmatterReadError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { FrontmatterReadError } from "effect-claudecode"
 *
 * type Wire = FrontmatterReadError.Encoded
 * const error = FrontmatterReadError.make({ path: "/plugin/SKILL.md", cause: "not found" })
 * console.log(error.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FrontmatterReadError {
  /**
   * Decoded runtime representation of {@link FrontmatterReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = FrontmatterReadError;
  /**
   * Wire-encoded representation of {@link FrontmatterReadError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FrontmatterReadError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link FrontmatterParseError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { FrontmatterParseError } from "effect-claudecode"
 *
 * type Wire = FrontmatterParseError.Encoded
 * const error = FrontmatterParseError.make({ path: "/plugin/SKILL.md", cause: "invalid YAML" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FrontmatterParseError {
  /**
   * Decoded runtime representation of {@link FrontmatterParseError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = FrontmatterParseError;
  /**
   * Wire-encoded representation of {@link FrontmatterParseError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FrontmatterParseError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link FrontmatterDecodeError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { FrontmatterDecodeError } from "effect-claudecode"
 *
 * type Wire = FrontmatterDecodeError.Encoded
 * const error = FrontmatterDecodeError.make({ path: "/plugin/SKILL.md", cause: "name missing" })
 * console.log(error._tag)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FrontmatterDecodeError {
  /**
   * Decoded runtime representation of {@link FrontmatterDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = FrontmatterDecodeError;
  /**
   * Wire-encoded representation of {@link FrontmatterDecodeError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FrontmatterDecodeError.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link McpConfigError}.
 *
 * **Example** (Relate the wire type to a runtime error)
 *
 * ```ts
 * import { McpConfigError } from "effect-claudecode"
 *
 * type Wire = McpConfigError.Encoded
 * const error = McpConfigError.make({ path: "/repo/.mcp.json", cause: "invalid JSON" })
 * console.log(error.path)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace McpConfigError {
  /**
   * Decoded runtime representation of {@link McpConfigError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = McpConfigError;
  /**
   * Wire-encoded representation of {@link McpConfigError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof McpConfigError.Encoded;
}
