/**
 * Fires when Claude Code is about to show a permission dialog for a
 * tool. A handler can `allow` or `deny` the tool call directly,
 * optionally rewriting the tool input and persisting new permission
 * rules. Matcher is on `tool_name`. See
 * https://code.claude.com/docs/en/hooks#permissionrequest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

import { envelopeFields } from "../Envelope.ts";
import * as Matcher from "../Matcher.ts";
import type { HookDefinition } from "../Runner.ts";

const $I = $ScratchpadId.create("claudecode/Hook/Events/PermissionRequest");

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * A pending permission-rule change Claude Code suggests alongside the
 * prompt. The hook handler can accept these in its `updatedPermissions`.
 *
 * **Example** (Construct a suggested rule)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const rule = Hook.PermissionRequest.PermissionRule.make({ toolName: "Bash" })
 * console.log(rule.toolName) // "Bash"
 * ```
 *
 * @see {@link RulePermissionUpdate} for persisting a list of these rules.
 * @category schemas
 * @since 0.0.0
 */
export class PermissionRule extends S.Class<PermissionRule>($I`PermissionRule`)(
  {
    toolName: S.String,
    ruleContent: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionRule", {
    description: "Permission rule suggested or persisted by Claude Code.",
  })
) {}

const PermissionRules = PermissionRule.pipe(
  S.Array,
  $I.annoteSchema("PermissionRules", {
    description: "Permission rules attached to a suggested permission update.",
  })
);

const PermissionBehavior = LiteralKit(["allow", "deny", "ask"]).pipe(
  $I.annoteSchema("PermissionBehavior", {
    description: "Behavior applied by a Claude Code permission rule.",
  })
);
const PermissionDestination = LiteralKit(["session", "localSettings", "projectSettings", "userSettings"]).pipe(
  $I.annoteSchema("PermissionDestination", {
    description: "Settings scope in which a permission change is persisted.",
  })
);
const RulePermissionUpdateType = LiteralKit(["addRules", "replaceRules", "removeRules"]).pipe(
  $I.annoteSchema("RulePermissionUpdateType", {
    description: "Operation applied to persisted permission rules.",
  })
);
const PermissionMode = LiteralKit(["default", "auto", "acceptEdits", "dontAsk", "bypassPermissions", "plan"]).pipe(
  $I.annoteSchema("PermissionMode", {
    description: "Permission mode persisted by a permission update.",
  })
);
const DirectoryPermissionUpdateType = LiteralKit(["addDirectories", "removeDirectories"]).pipe(
  $I.annoteSchema("DirectoryPermissionUpdateType", {
    description: "Operation applied to persisted permission directories.",
  })
);
const PermissionDecisionBehavior = LiteralKit(["allow", "deny"]).pipe(
  $I.annoteSchema("PermissionDecisionBehavior", {
    description: "Decision behavior returned by a PermissionRequest hook.",
  })
);

/**
 * Permission update Claude Code suggests with the pending tool request.
 *
 * **Example** (Decode a permission suggestion)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const suggestion = S.decodeUnknownSync(Hook.PermissionRequest.PermissionSuggestion)({
 *   type: "addRules",
 *   behavior: "allow",
 *   destination: "session",
 * })
 *
 * console.log(suggestion.type) // "addRules"
 * ```
 *
 * @see {@link Input} for the stdin payload that lists these suggestions.
 * @category schemas
 * @since 0.0.0
 */
export class PermissionSuggestion extends S.Class<PermissionSuggestion>($I`PermissionSuggestion`)(
  {
    type: S.String,
    rules: S.OptionFromOptionalKey(PermissionRules).pipe(SchemaUtils.withNoneDefault),
    behavior: S.OptionFromOptionalKey(PermissionBehavior).pipe(SchemaUtils.withNoneDefault),
    destination: S.OptionFromOptionalKey(PermissionDestination).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionSuggestion", {
    description: "Permission update suggested with a pending tool request.",
  })
) {}

const PermissionSuggestions = PermissionSuggestion.pipe(
  S.Array,
  $I.annoteSchema("PermissionSuggestions", {
    description: "Permission updates suggested with a pending tool request.",
  })
);

/**
 * Stdin payload for a PermissionRequest hook, including the pending
 * `tool_name`, `tool_input`, and optional permission suggestions.
 *
 * **Example** (Decode a pending Bash prompt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(Hook.PermissionRequest.Input)({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "PermissionRequest",
 *   tool_name: "Bash",
 *   tool_input: { command: "ls" },
 * })
 *
 * console.log(input.tool_name) // "Bash"
 * ```
 *
 * @see {@link allow} for answering before the dialog.
 * @see {@link deny} for refusing before the dialog.
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`PermissionRequestInput`)(
  {
    ...envelopeFields,
    hook_event_name: S.Literal("PermissionRequest"),
    tool_name: S.String,
    tool_input: S.Record(S.String, S.Unknown),
    permission_suggestions: S.OptionFromOptionalKey(PermissionSuggestions).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionRequestInput", {
    description: "Input for the PermissionRequest hook event.",
  })
) {}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * A permission rule update the hook may persist. Mirrors the shape of
 * `permission_suggestions` on the input side.
 *
 * **Example** (Persist an allow rule)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const update = Hook.PermissionRequest.RulePermissionUpdate.make({
 *   type: "addRules",
 *   rules: [Hook.PermissionRequest.PermissionRule.make({ toolName: "Read" })],
 *   behavior: "allow",
 *   destination: "session",
 * })
 *
 * console.log(update.type) // "addRules"
 * ```
 *
 * @see {@link PermissionUpdate} for the union that includes this variant.
 * @see {@link ModePermissionUpdate} for persisting a permission mode.
 * @see {@link DirectoryPermissionUpdate} for persisting directories.
 * @category schemas
 * @since 0.0.0
 */
export class RulePermissionUpdate extends S.Class<RulePermissionUpdate>($I`RulePermissionUpdate`)(
  {
    type: RulePermissionUpdateType,
    rules: S.Array(PermissionRule),
    behavior: PermissionBehavior,
    destination: PermissionDestination,
  },
  $I.annote("RulePermissionUpdate", {
    description: "Rule-list permission update returned by a hook.",
  })
) {}

/**
 * Persist a permission mode (`setMode`) in a settings destination.
 *
 * **Example** (Set acceptEdits for this session)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const update = Hook.PermissionRequest.ModePermissionUpdate.make({
 *   type: "setMode",
 *   mode: "acceptEdits",
 *   destination: "session",
 * })
 *
 * console.log(update.mode) // "acceptEdits"
 * ```
 *
 * @see {@link PermissionUpdate} for the union that includes this variant.
 * @see {@link RulePermissionUpdate} for persisting rule lists.
 * @category schemas
 * @since 0.0.0
 */
export class ModePermissionUpdate extends S.Class<ModePermissionUpdate>($I`ModePermissionUpdate`)(
  {
    type: S.Literal("setMode"),
    mode: PermissionMode,
    destination: PermissionDestination,
  },
  $I.annote("ModePermissionUpdate", {
    description: "Permission-mode update returned by a hook.",
  })
) {}

/**
 * Persist allowed or removed directories in a settings destination.
 *
 * **Example** (Add a writable directory)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const update = Hook.PermissionRequest.DirectoryPermissionUpdate.make({
 *   type: "addDirectories",
 *   directories: ["/tmp/build"],
 *   destination: "session",
 * })
 *
 * console.log(update.directories) // ["/tmp/build"]
 * ```
 *
 * @see {@link PermissionUpdate} for the union that includes this variant.
 * @see {@link RulePermissionUpdate} for persisting rule lists.
 * @category schemas
 * @since 0.0.0
 */
export class DirectoryPermissionUpdate extends S.Class<DirectoryPermissionUpdate>($I`DirectoryPermissionUpdate`)(
  {
    type: DirectoryPermissionUpdateType,
    directories: S.Array(S.String),
    destination: PermissionDestination,
  },
  $I.annote("DirectoryPermissionUpdate", {
    description: "Directory-list permission update returned by a hook.",
  })
) {}

/**
 * Discriminated union of permission updates a handler may persist:
 * rules, mode, or directories.
 *
 * **Example** (Decode a mode update)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as S from "effect/Schema"
 *
 * const update = S.decodeUnknownSync(Hook.PermissionRequest.PermissionUpdate)({
 *   type: "setMode",
 *   mode: "plan",
 *   destination: "session",
 * })
 *
 * console.log(update.type) // "setMode"
 * ```
 *
 * @see {@link RulePermissionUpdate} for the rule-list variant.
 * @see {@link ModePermissionUpdate} for the setMode variant.
 * @see {@link DirectoryPermissionUpdate} for the directory-list variant.
 * @category schemas
 * @since 0.0.0
 */
export const PermissionUpdate = S.Union([RulePermissionUpdate, ModePermissionUpdate, DirectoryPermissionUpdate]).pipe(
  $I.annoteSchema("PermissionUpdate", {
    description: "Permission update persisted by a PermissionRequest hook.",
  })
);

/**
 * Decoded value produced by {@link PermissionUpdate}.
 *
 * @see {@link PermissionUpdate} for the runtime union and decoding behavior.
 * @category type-level
 * @since 0.0.0
 */
export type PermissionUpdate = typeof PermissionUpdate.Type;

const PermissionUpdates = PermissionUpdate.pipe(
  S.Array,
  $I.annoteSchema("PermissionUpdates", {
    description: "Permission updates persisted by a PermissionRequest hook.",
  })
);

/**
 * Allow or deny decision returned inside `hookSpecificOutput`,
 * including optional rewritten input and persisted permission updates.
 *
 * **Example** (Construct an allow decision)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const decision = Hook.PermissionRequest.PermissionDecision.make({
 *   behavior: "allow",
 * })
 *
 * console.log(decision.behavior) // "allow"
 * ```
 *
 * @see {@link allow} for the constructor that wraps this decision.
 * @see {@link deny} for the deny counterpart.
 * @category schemas
 * @since 0.0.0
 */
export class PermissionDecision extends S.Class<PermissionDecision>($I`PermissionRequestDecision`)(
  {
    behavior: PermissionDecisionBehavior,
    updatedInput: S.OptionFromOptionalKey(S.Record(S.String, S.Unknown)).pipe(SchemaUtils.withNoneDefault),
    updatedPermissions: S.OptionFromOptionalKey(PermissionUpdates).pipe(SchemaUtils.withNoneDefault),
    message: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    interrupt: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionRequestDecision", {
    description: "Allow or deny decision returned by a PermissionRequest hook.",
  })
) {}

/**
 * Event-specific payload that carries the {@link PermissionDecision}.
 *
 * **Example** (Inspect a deny payload)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * const specific = Hook.PermissionRequest.HookSpecificOutput.make({
 *   hookEventName: "PermissionRequest",
 *   decision: Hook.PermissionRequest.PermissionDecision.make({
 *     behavior: "deny",
 *   }),
 * })
 *
 * console.log(specific.decision.behavior) // "deny"
 * ```
 *
 * @see {@link deny} for the constructor that fills this payload.
 * @category schemas
 * @since 0.0.0
 */
export class HookSpecificOutput extends S.Class<HookSpecificOutput>($I`PermissionRequestHookSpecificOutput`)(
  {
    hookEventName: S.Literal("PermissionRequest"),
    decision: PermissionDecision,
  },
  $I.annote("PermissionRequestHookSpecificOutput", {
    description: "PermissionRequest-specific decision returned to Claude Code.",
  })
) {}

/**
 * JSON response a PermissionRequest handler returns. The allow/deny
 * decision lives on `hookSpecificOutput.decision`.
 *
 * **Example** (Inspect empty output)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionRequest.Output.make()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link passthrough} for showing the permission dialog.
 * @see {@link allow} for answering before the dialog.
 * @category schemas
 * @since 0.0.0
 */
export class Output extends S.Class<Output>($I`PermissionRequestOutput`)(
  {
    continue: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    stopReason: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    suppressOutput: S.OptionFromOptionalKey(S.Boolean).pipe(SchemaUtils.withNoneDefault),
    systemMessage: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    terminalSequence: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    hookSpecificOutput: S.OptionFromOptionalKey(HookSpecificOutput).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PermissionRequestOutput", {
    description: "Output returned by a PermissionRequest hook handler.",
  })
) {}

// ---------------------------------------------------------------------------
// Decision helpers
// ---------------------------------------------------------------------------

/**
 * Allow the tool call before the dialog. Optionally rewrite `updatedInput`
 * and persist `updatedPermissions` — the reason to pick this over
 * {@link passthrough}.
 *
 * **Example** (Allow and persist a session mode)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionRequest.allow({
 *   updatedPermissions: [
 *     Hook.PermissionRequest.ModePermissionUpdate.make({
 *       type: "setMode",
 *       mode: "acceptEdits",
 *       destination: "session",
 *     }),
 *   ],
 * })
 *
 * console.log(O.getOrUndefined(output.hookSpecificOutput)?.decision.behavior) // "allow"
 * ```
 *
 * @see {@link passthrough} for showing the dialog instead.
 * @see {@link deny} for refusing the tool call.
 * @category constructors
 * @since 0.0.0
 */
export const allow = (options?: {
  readonly updatedInput?: Readonly<Record<string, unknown>>;
  readonly updatedPermissions?: ReadonlyArray<PermissionUpdate>;
}): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PermissionRequest",
        decision: PermissionDecision.make({
          behavior: "allow",
          updatedInput: O.fromNullishOr(options?.updatedInput),
          updatedPermissions: O.fromNullishOr(options?.updatedPermissions),
        }),
      })
    ),
  });

/**
 * No-op output — Claude Code proceeds with its normal permission request
 * flow and shows the dialog.
 *
 * **Example** (Show the permission dialog)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionRequest.passthrough()
 * console.log(O.isNone(output.hookSpecificOutput)) // true
 * ```
 *
 * @see {@link allow} for answering before the dialog.
 * @see {@link deny} for refusing before the dialog.
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Deny the tool call before the dialog. Optional `interrupt: true`
 * cancels the rest of the turn.
 *
 * **Example** (Deny and interrupt)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const output = Hook.PermissionRequest.deny("network is disabled", { interrupt: true })
 * const decision = O.getOrUndefined(output.hookSpecificOutput)?.decision
 * console.log(decision?.behavior) // "deny"
 * console.log(O.getOrUndefined(decision?.interrupt ?? O.none())) // true
 * ```
 *
 * @see {@link allow} for answering before the dialog.
 * @see {@link passthrough} for showing the dialog instead.
 * @category constructors
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- Scratchpad prototype API preserves its established call shape.
export const deny = (message: string, options?: { readonly interrupt?: boolean }): Output =>
  Output.make({
    hookSpecificOutput: O.some(
      HookSpecificOutput.make({
        hookEventName: "PermissionRequest",
        decision: PermissionDecision.make({
          behavior: "deny",
          message: O.some(message),
          interrupt: O.fromNullishOr(options?.interrupt),
        }),
      })
    ),
  });

// ---------------------------------------------------------------------------
// define
// ---------------------------------------------------------------------------

/**
 * Build a runnable PermissionRequest hook from a handler effect.
 *
 * **Example** (Define a PermissionRequest hook)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PermissionRequest.define({
 *   handler: () => Effect.succeed(Hook.PermissionRequest.passthrough()),
 * })
 *
 * console.log(hook.event) // "PermissionRequest"
 * ```
 *
 * @see {@link onMatcher} for filtering on `tool_name`.
 * @category constructors
 * @since 0.0.0
 */
export const define = <E, R>(config: {
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> => ({
  event: "PermissionRequest",
  inputSchema: Input,
  outputSchema: Output,
  handler: config.handler,
});

/**
 * Build a PermissionRequest hook that only handles matching `tool_name`
 * values.
 *
 * **Example** (Allow matching Read calls)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { Hook } from "effect-claudecode"
 *
 * const hook = Hook.PermissionRequest.onMatcher({
 *   matcher: "Read",
 *   handler: () => Effect.succeed(Hook.PermissionRequest.allow()),
 * })
 *
 * console.log(hook.event) // "PermissionRequest"
 * ```
 *
 * @see {@link passthrough} for the default mismatch output.
 * @see {@link allow} for the matched-handler decision used here.
 * @category constructors
 * @since 0.0.0
 */
export const onMatcher = <E, R>(config: {
  readonly matcher: string | RegExp;
  readonly handler: (input: Input) => Effect.Effect<Output, E, R>;
  readonly onMismatch?: (input: Input) => Effect.Effect<Output, E, R>;
}): HookDefinition<Input, Output, E, R> =>
  define({
    handler: Matcher.handleMatcher({
      matcher: config.matcher,
      select: (input) => input.tool_name,
      onMatch: config.handler,
      onMismatch: config.onMismatch ?? (() => Effect.succeed(passthrough())),
    }),
  });

/**
 * Decoded and wire-encoded companion types for {@link PermissionRule}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace PermissionRule {
  /**
   * Decoded runtime representation of {@link PermissionRule}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PermissionRule;
  /**
   * Wire-encoded representation of {@link PermissionRule}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PermissionRule.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link PermissionSuggestion}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace PermissionSuggestion {
  /**
   * Decoded runtime representation of {@link PermissionSuggestion}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PermissionSuggestion;
  /**
   * Wire-encoded representation of {@link PermissionSuggestion}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PermissionSuggestion.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link Input}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace Input {
  /**
   * Decoded runtime representation of {@link Input}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = Input;
  /**
   * Wire-encoded representation of {@link Input}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Input.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link RulePermissionUpdate}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace RulePermissionUpdate {
  /**
   * Decoded runtime representation of {@link RulePermissionUpdate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = RulePermissionUpdate;
  /**
   * Wire-encoded representation of {@link RulePermissionUpdate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RulePermissionUpdate.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link ModePermissionUpdate}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace ModePermissionUpdate {
  /**
   * Decoded runtime representation of {@link ModePermissionUpdate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = ModePermissionUpdate;
  /**
   * Wire-encoded representation of {@link ModePermissionUpdate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ModePermissionUpdate.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link DirectoryPermissionUpdate}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace DirectoryPermissionUpdate {
  /**
   * Decoded runtime representation of {@link DirectoryPermissionUpdate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = DirectoryPermissionUpdate;
  /**
   * Wire-encoded representation of {@link DirectoryPermissionUpdate}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DirectoryPermissionUpdate.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link PermissionDecision}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace PermissionDecision {
  /**
   * Decoded runtime representation of {@link PermissionDecision}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PermissionDecision;
  /**
   * Wire-encoded representation of {@link PermissionDecision}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PermissionDecision.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link HookSpecificOutput}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace HookSpecificOutput {
  /**
   * Decoded runtime representation of {@link HookSpecificOutput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = HookSpecificOutput;
  /**
   * Wire-encoded representation of {@link HookSpecificOutput}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookSpecificOutput.Encoded;
}

/**
 * Decoded and wire-encoded companion types for {@link Output}.
 *
 * @category type-level
 * @since 0.0.0
 *
 */
export declare namespace Output {
  /**
   * Decoded runtime representation of {@link Output}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = Output;
  /**
   * Wire-encoded representation of {@link Output}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Output.Encoded;
}
