/**
 * Hook module hub — re-exports the runner, context service, envelope,
 * matcher helpers, transcript reader, and every hook event namespace.
 *
 * Users import this as a namespace: `import { Hook } from 'effect-claudecode'`
 * and access members as `Hook.PreToolUse`, `Hook.runMain`, `Hook.dispatch`,
 * `Hook.Context`, `Hook.matchTool`, `Hook.readTranscript`, etc.
 *
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 */

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

export {
  type DispatchMap,
  dispatch,
  type HookDefinition,
  hookTeardown,
  runDispatchProgram,
  runHookProgram,
  runMain,
} from "./Hook/Runner.ts";

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Context.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export * as Context from "./Hook/Context.ts";
/**
 * Re-exports the ./Hook/Context.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export {
  agentId,
  agentType,
  cwd,
  effort,
  hookEventName,
  permissionMode,
  promptId,
  sessionId,
  transcriptPath,
} from "./Hook/Context.ts";

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Envelope.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export {
  EffortLevel,
  envelopeFields,
  HookEffort,
  HookEnvelope,
  HookPermissionMode,
} from "./Hook/Envelope.ts";

// ---------------------------------------------------------------------------
// Matcher
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Matcher.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export { matchTool, testTool } from "./Hook/Matcher.ts";

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Transcript.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export { readTranscript } from "./Hook/Transcript.ts";

// ---------------------------------------------------------------------------
// Event bus
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Bus.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export * as Bus from "./Hook/Bus.ts";
/**
 * Re-exports the ./Hook/Bus.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export { bus, publish } from "./Hook/Bus.ts";

// ---------------------------------------------------------------------------
// Tool adapters
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Tool.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export * as Tool from "./Hook/Tool.ts";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/**
 * Re-exports the ./Hook/Events/index.ts public surface.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook)
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export {
  // Tier 2
  ConfigChange,
  CwdChanged,
  // Tier 3
  Elicitation,
  ElicitationResult,
  FileChanged,
  type HookEventName,
  // Unions
  HookInput,
  InstructionsLoaded,
  // Tier 1
  MessageDisplay,
  Notification,
  PermissionDenied,
  PermissionRequest,
  PostCompact,
  PostToolBatch,
  PostToolUse,
  PostToolUseFailure,
  PreCompact,
  PreToolUse,
  SessionEnd,
  SessionStart,
  Setup,
  Stop,
  StopFailure,
  SubagentStart,
  SubagentStop,
  TaskCompleted,
  TaskCreated,
  TeammateIdle,
  UserPromptExpansion,
  UserPromptSubmit,
  WorktreeCreate,
  WorktreeRemove,
} from "./Hook/Events/index.ts";
