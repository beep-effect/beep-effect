/**
 * Aggregate re-exports for every Hook event namespace, plus the
 * `HookInput` discriminated union keyed on `hook_event_name` for
 * cross-event pattern matching and dispatch.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
// Tier 2
import * as ConfigChange from "./ConfigChange.ts";
import * as CwdChanged from "./CwdChanged.ts";
// Tier 3
import * as Elicitation from "./Elicitation.ts";
import * as ElicitationResult from "./ElicitationResult.ts";
import * as FileChanged from "./FileChanged.ts";
import * as InstructionsLoaded from "./InstructionsLoaded.ts";
// Tier 1
import * as MessageDisplay from "./MessageDisplay.ts";
import * as Notification from "./Notification.ts";
import * as PermissionDenied from "./PermissionDenied.ts";
import * as PermissionRequest from "./PermissionRequest.ts";
import * as PostCompact from "./PostCompact.ts";
import * as PostToolBatch from "./PostToolBatch.ts";
import * as PostToolUse from "./PostToolUse.ts";
import * as PostToolUseFailure from "./PostToolUseFailure.ts";
import * as PreCompact from "./PreCompact.ts";
import * as PreToolUse from "./PreToolUse.ts";
import * as SessionEnd from "./SessionEnd.ts";
import * as SessionStart from "./SessionStart.ts";
import * as Setup from "./Setup.ts";
import * as Stop from "./Stop.ts";
import * as StopFailure from "./StopFailure.ts";
import * as SubagentStart from "./SubagentStart.ts";
import * as SubagentStop from "./SubagentStop.ts";
import * as TaskCompleted from "./TaskCompleted.ts";
import * as TaskCreated from "./TaskCreated.ts";
import * as TeammateIdle from "./TeammateIdle.ts";
import * as UserPromptExpansion from "./UserPromptExpansion.ts";
import * as UserPromptSubmit from "./UserPromptSubmit.ts";
import * as WorktreeCreate from "./WorktreeCreate.ts";
import * as WorktreeRemove from "./WorktreeRemove.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events");

// ---------------------------------------------------------------------------
// Per-event namespaces
// ---------------------------------------------------------------------------

/**
 * Re-exports every hook event as a namespace.
 *
 * @category events
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
};

// ---------------------------------------------------------------------------
// Unions (all 30 events)
// ---------------------------------------------------------------------------

/**
 * Discriminated union of every hook event input supported by
 * effect-claudecode, keyed on `hook_event_name`.
 *
 * @category schemas
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.HookInput)
 * ```
 */
export const HookInput = S.Union([
  // Tier 1
  Setup.Input,
  PreToolUse.Input,
  PostToolUse.Input,
  PostToolBatch.Input,
  UserPromptSubmit.Input,
  UserPromptExpansion.Input,
  Notification.Input,
  MessageDisplay.Input,
  Stop.Input,
  SubagentStop.Input,
  SessionStart.Input,
  SessionEnd.Input,
  PreCompact.Input,
  // Tier 2
  PostCompact.Input,
  PermissionRequest.Input,
  PermissionDenied.Input,
  PostToolUseFailure.Input,
  SubagentStart.Input,
  ConfigChange.Input,
  InstructionsLoaded.Input,
  StopFailure.Input,
  CwdChanged.Input,
  FileChanged.Input,
  // Tier 3
  TaskCreated.Input,
  TaskCompleted.Input,
  TeammateIdle.Input,
  WorktreeCreate.Input,
  WorktreeRemove.Input,
  Elicitation.Input,
  ElicitationResult.Input,
]).pipe(
  S.toTaggedUnion("hook_event_name"),
  $I.annoteSchema("HookInput", {
    description: "Union of all hook event inputs, discriminated on hook_event_name.",
  })
);

/**
 * Public utility for `HookInput`.
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.HookInput
 * ```
 *
 * @category utilities
 *
 * @since 0.0.0
 */
export type HookInput = typeof HookInput.Type;

/**
 * JSON representation accepted by {@link HookInput}.
 *
 * @example
 * ```ts
 * import type { Hook } from "effect-claudecode"
 *
 * const accept = (input: Hook.HookInputEncoded) => input
 * console.log(accept)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookInputEncoded = typeof HookInput.Encoded;

/**
 * Every hook event name currently supported by the library.
 *
 * @category type-level
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.HookEventName
 * ```
 */
export type HookEventName = HookInput["hook_event_name"];
