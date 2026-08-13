/**
 * PermissionRequest hook event.
 *
 * Fires when Claude Code is about to show a permission dialog for a tool.
 * A handler can `allow` or `deny` the tool call directly, optionally
 * rewriting the tool input and persisting new permission rules. Supports
 * a matcher on `tool_name`.
 * See https://code.claude.com/docs/en/hooks#permissionrequest.
 *
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
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.PermissionRule)
 * ```
 *
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
 * Schema for `PermissionSuggestion`.
 *
 * **Example** (Inspect the PermissionSuggestion schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.PermissionSuggestion)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Input`.
 *
 * **Example** (Inspect the Input schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.Input)
 * ```
 *
 * @category schemas
 *
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
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.RulePermissionUpdate)
 * ```
 *
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
 * Schema for `ModePermissionUpdate`.
 *
 * **Example** (Inspect the ModePermissionUpdate schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.ModePermissionUpdate)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `DirectoryPermissionUpdate`.
 *
 * **Example** (Inspect the DirectoryPermissionUpdate schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.DirectoryPermissionUpdate)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `PermissionUpdate`.
 *
 * **Example** (Inspect the PermissionUpdate schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.PermissionUpdate)
 * ```
 *
 * @category schemas
 *
 * @since 0.0.0
 */
export const PermissionUpdate = S.Union([RulePermissionUpdate, ModePermissionUpdate, DirectoryPermissionUpdate]).pipe(
  $I.annoteSchema("PermissionUpdate", {
    description: "Permission update persisted by a PermissionRequest hook.",
  })
);

/**
 * Type-level model for `PermissionUpdate`.
 *
 * **Example** (Use PermissionUpdate as a type)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.PermissionRequest.PermissionUpdate
 * ```
 *
 * @category type-level
 *
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
 * Schema for `PermissionDecision`.
 *
 * **Example** (Inspect the PermissionDecision schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.PermissionDecision)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `HookSpecificOutput`.
 *
 * **Example** (Inspect the HookSpecificOutput schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.HookSpecificOutput)
 * ```
 *
 * @category schemas
 *
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
 * Schema for `Output`.
 *
 * **Example** (Inspect the Output schema)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.Output)
 * ```
 *
 * @category schemas
 *
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
 * Constructor for `allow`.
 *
 * **Example** (Use allow)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.allow)
 * ```
 *
 * @category constructors
 *
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
 * No-op output — Claude Code proceeds with its normal permission request flow.
 *
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.passthrough)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const passthrough = (): Output => Output.make();

/**
 * Constructor for `deny`.
 *
 * **Example** (Use deny)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.deny)
 * ```
 *
 * @category constructors
 *
 * @since 0.0.0
 */
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
 * Constructor for `define`.
 *
 * **Example** (Use define)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.define)
 * ```
 *
 * @category constructors
 *
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
 * **Example** (Inspect the documented API)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.PermissionRequest.onMatcher)
 * ```
 *
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
