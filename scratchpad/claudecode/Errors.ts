/**
 * Tagged errors for effect-claudecode.
 *
 * All cross-module errors are declared here and re-exported from
 * `src/index.ts` at the top level so consumers can import them directly
 * (e.g. `import { HookInputDecodeError } from 'effect-claudecode'`) and
 * use them in `Effect.catchTag`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, TaggedErrorClass } from "@beep/schema";
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookStdinReadError } from "effect-claudecode"
 *
 * console.log(HookStdinReadError)
 * ```
 */
export class HookStdinReadError extends TaggedErrorClass<HookStdinReadError>($I`HookStdinReadError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookInputDecodeError } from "effect-claudecode"
 *
 * console.log(HookInputDecodeError)
 * ```
 */
export class HookInputDecodeError extends TaggedErrorClass<HookInputDecodeError>($I`HookInputDecodeError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookHandlerError } from "effect-claudecode"
 *
 * console.log(HookHandlerError)
 * ```
 */
export class HookHandlerError extends TaggedErrorClass<HookHandlerError>($I`HookHandlerError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookOutputEncodeError } from "effect-claudecode"
 *
 * console.log(HookOutputEncodeError)
 * ```
 */
export class HookOutputEncodeError extends TaggedErrorClass<HookOutputEncodeError>($I`HookOutputEncodeError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookStdoutWriteError } from "effect-claudecode"
 *
 * console.log(HookStdoutWriteError)
 * ```
 */
export class HookStdoutWriteError extends TaggedErrorClass<HookStdoutWriteError>($I`HookStdoutWriteError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookControlledExit } from "effect-claudecode"
 *
 * console.log(HookControlledExit)
 * ```
 */
export class HookControlledExit extends TaggedErrorClass<HookControlledExit>($I`HookControlledExit`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookToolDecodeError } from "effect-claudecode"
 *
 * console.log(HookToolDecodeError)
 * ```
 */
export class HookToolDecodeError extends TaggedErrorClass<HookToolDecodeError>($I`HookToolDecodeError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { TranscriptReadError } from "effect-claudecode"
 *
 * console.log(TranscriptReadError)
 * ```
 */
export class TranscriptReadError extends TaggedErrorClass<TranscriptReadError>($I`TranscriptReadError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { SettingsReadError } from "effect-claudecode"
 *
 * console.log(SettingsReadError)
 * ```
 */
export class SettingsReadError extends TaggedErrorClass<SettingsReadError>($I`SettingsReadError`)(
  "SettingsReadError",
  { path: S.String, cause: S.Defect() },
  $I.annote("SettingsReadError", {
    description: "Failure while reading a Claude Code settings file.",
  })
) {}

/**
 * Raised when a settings.json file contains invalid JSON.
 *
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { SettingsParseError } from "effect-claudecode"
 *
 * console.log(SettingsParseError)
 * ```
 */
export class SettingsParseError extends TaggedErrorClass<SettingsParseError>($I`SettingsParseError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { SettingsDecodeError } from "effect-claudecode"
 *
 * console.log(SettingsDecodeError)
 * ```
 */
export class SettingsDecodeError extends TaggedErrorClass<SettingsDecodeError>($I`SettingsDecodeError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { PluginWriteError } from "effect-claudecode"
 *
 * console.log(PluginWriteError)
 * ```
 */
export class PluginWriteError extends TaggedErrorClass<PluginWriteError>($I`PluginWriteError`)(
  "PluginWriteError",
  { path: S.String, cause: S.Defect() },
  $I.annote("PluginWriteError", {
    description: "Failure while materializing a Claude Code plugin directory.",
  })
) {}

/**
 * Raised when a plugin definition is internally inconsistent.
 *
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { PluginDefinitionError } from "effect-claudecode"
 *
 * console.log(PluginDefinitionError)
 * ```
 */
export class PluginDefinitionError extends TaggedErrorClass<PluginDefinitionError>($I`PluginDefinitionError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { PluginLoadError } from "effect-claudecode"
 *
 * console.log(PluginLoadError)
 * ```
 */
export class PluginLoadError extends TaggedErrorClass<PluginLoadError>($I`PluginLoadError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { FrontmatterReadError } from "effect-claudecode"
 *
 * console.log(FrontmatterReadError)
 * ```
 */
export class FrontmatterReadError extends TaggedErrorClass<FrontmatterReadError>($I`FrontmatterReadError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { FrontmatterParseError } from "effect-claudecode"
 *
 * console.log(FrontmatterParseError)
 * ```
 */
export class FrontmatterParseError extends TaggedErrorClass<FrontmatterParseError>($I`FrontmatterParseError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { FrontmatterDecodeError } from "effect-claudecode"
 *
 * console.log(FrontmatterDecodeError)
 * ```
 */
export class FrontmatterDecodeError extends TaggedErrorClass<FrontmatterDecodeError>($I`FrontmatterDecodeError`)(
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
 * @category errors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { McpConfigError } from "effect-claudecode"
 *
 * console.log(McpConfigError)
 * ```
 */
export class McpConfigError extends TaggedErrorClass<McpConfigError>($I`McpConfigError`)(
  "McpConfigError",
  { path: S.String, cause: S.Defect() },
  $I.annote("McpConfigError", {
    description: "Failure while reading, parsing, or decoding a Claude Code MCP configuration.",
  })
) {}

/**
 * Decoded and wire-encoded companion types for {@link HookStdinReadError}.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookStdinReadError } from "effect-claudecode"
 *
 * type Wire = HookStdinReadError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookInputDecodeError } from "effect-claudecode"
 *
 * type Wire = HookInputDecodeError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookHandlerError } from "effect-claudecode"
 *
 * type Wire = HookHandlerError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookOutputEncodeError } from "effect-claudecode"
 *
 * type Wire = HookOutputEncodeError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookStdoutWriteError } from "effect-claudecode"
 *
 * type Wire = HookStdoutWriteError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookControlledExit } from "effect-claudecode"
 *
 * type Example = HookControlledExit.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { HookToolDecodeError } from "effect-claudecode"
 *
 * type Wire = HookToolDecodeError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { TranscriptReadError } from "effect-claudecode"
 *
 * type Wire = TranscriptReadError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { SettingsReadError } from "effect-claudecode"
 *
 * type Wire = SettingsReadError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { SettingsParseError } from "effect-claudecode"
 *
 * type Wire = SettingsParseError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { SettingsDecodeError } from "effect-claudecode"
 *
 * type Wire = SettingsDecodeError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { PluginWriteError } from "effect-claudecode"
 *
 * type Wire = PluginWriteError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { PluginDefinitionError } from "effect-claudecode"
 *
 * type Wire = PluginDefinitionError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { PluginLoadError } from "effect-claudecode"
 *
 * type Wire = PluginLoadError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { FrontmatterReadError } from "effect-claudecode"
 *
 * type Wire = FrontmatterReadError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { FrontmatterParseError } from "effect-claudecode"
 *
 * type Wire = FrontmatterParseError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { FrontmatterDecodeError } from "effect-claudecode"
 *
 * type Wire = FrontmatterDecodeError.Encoded
 * ```
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
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { McpConfigError } from "effect-claudecode"
 *
 * type Wire = McpConfigError.Encoded
 * ```
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
