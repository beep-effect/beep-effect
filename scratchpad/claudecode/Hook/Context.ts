/**
 * Effect service carrying per-invocation hook context.
 *
 * Every hook handler has access to `HookContext.Service` via `yield*`
 * (or the individual accessor effects). The service is constructed by
 * the runner from the decoded envelope of the incoming stdin payload,
 * so handlers never touch the raw JSON.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as O from "effect/Option";

import type { HookEnvelope } from "./Envelope.ts";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Context");

/**
 * Camel-case view of the envelope available to every hook handler.
 *
 * @category services
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Context.Interface
 * ```
 */
export interface Interface {
  readonly sessionId: string;
  readonly transcriptPath: string;
  readonly cwd: string;
  readonly permissionMode: HookEnvelope["permission_mode"];
  readonly promptId: O.Option<string>;
  readonly hookEventName: string;
  readonly effort: HookEnvelope["effort"];
  readonly agentId: O.Option<string>;
  readonly agentType: O.Option<string>;
}

/**
 * Per-invocation hook context service.
 *
 * @category services
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.Service)
 * ```
 */
export class Service extends Context.Service<Service, Interface>()($I`Service`) {}

/**
 * Build hook context from a decoded envelope.
 *
 * @category constructors
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.fromEnvelope)
 * ```
 */
export const fromEnvelope = (envelope: HookEnvelope): Interface => ({
  sessionId: envelope.session_id,
  transcriptPath: envelope.transcript_path,
  cwd: envelope.cwd,
  permissionMode: envelope.permission_mode,
  promptId: envelope.prompt_id,
  hookEventName: envelope.hook_event_name,
  effort: envelope.effort,
  agentId: envelope.agent_id,
  agentType: envelope.agent_type,
});

/**
 * Provide one decoded envelope as the current hook context.
 *
 * @category layers
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.layer)
 * ```
 */
export const layer = (envelope: HookEnvelope): Layer.Layer<Service> =>
  Layer.succeed(Service, Service.of(fromEnvelope(envelope)));

// ---------------------------------------------------------------------------
// Convenience accessors (yield*-able inside handlers)
// ---------------------------------------------------------------------------

/**
 * Effectful access to the current session ID.
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.sessionId)
 * ```
 */
export const sessionId: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.sessionId)
);

/**
 * Effectful access to the path of the conversation transcript file.
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.transcriptPath)
 * ```
 */
export const transcriptPath: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.transcriptPath)
);

/**
 * Effectful access to the working directory in which the hook fired.
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.cwd)
 * ```
 */
export const cwd: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.cwd)
);

/**
 * Effectful access to the active permission mode (if any).
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.permissionMode)
 * ```
 */
export const permissionMode: Effect.Effect<HookEnvelope["permission_mode"], never, Service> = Effect.service(
  Service
).pipe(Effect.map((context) => context.permissionMode));

/**
 * Effectful access to the prompt id for the current hook invocation.
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.promptId)
 * ```
 */
export const promptId: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.promptId)
);

/**
 * Effectful access to the hook event name (e.g. `"PreToolUse"`).
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.hookEventName)
 * ```
 */
export const hookEventName: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.hookEventName)
);

/**
 * Effectful access to the active effort level payload (if any).
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.effort)
 * ```
 */
export const effort: Effect.Effect<HookEnvelope["effort"], never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.effort)
);

/**
 * Effectful access to the current subagent/session agent id (if any).
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.agentId)
 * ```
 */
export const agentId: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.agentId)
);

/**
 * Effectful access to the current subagent/session agent type (if any).
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Context.agentType)
 * ```
 */
export const agentType: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.agentType)
);
