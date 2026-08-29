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
 * **Example** (Name the context interface)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Context.Interface
 * ```
 *
 * @category services
 * @since 0.0.0
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
 * **Example** (Access the context service)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const cwd = Effect.service(Hook.Context.Service).pipe(
 *   Effect.map((context) => context.cwd)
 * )
 * console.log(cwd)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Service extends Context.Service<Service, Interface>()($I`Service`) {}

/**
 * Build hook context from a decoded envelope.
 *
 * **Example** (Convert an envelope)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 *
 * const context = Hook.Context.fromEnvelope(Testing.makeMockEnvelope())
 * console.log(context.sessionId) // "test-session"
 * ```
 *
 * @category constructors
 * @since 0.0.0
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
 * **Example** (Build a context layer)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Layer from "effect/Layer"
 *
 * const layer = Hook.Context.layer(Testing.makeMockEnvelope())
 * console.log(Layer.isLayer(layer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = (envelope: HookEnvelope): Layer.Layer<Service> =>
  Layer.succeed(Service, Service.of(fromEnvelope(envelope)));

// ---------------------------------------------------------------------------
// Convenience accessors (yield*-able inside handlers)
// ---------------------------------------------------------------------------

/**
 * Effectful access to the current session ID.
 *
 * **Example** (Read the session ID)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.sessionId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log) // "test-session"
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const sessionId: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.sessionId)
);

/**
 * Effectful access to the path of the conversation transcript file.
 *
 * **Example** (Read the transcript path)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.transcriptPath.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const transcriptPath: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.transcriptPath)
);

/**
 * Effectful access to the working directory in which the hook fired.
 *
 * **Example** (Read the working directory)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.cwd.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const cwd: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.cwd)
);

/**
 * Effectful access to the active permission mode (if any).
 *
 * **Example** (Read the permission mode)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.permissionMode.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const permissionMode: Effect.Effect<HookEnvelope["permission_mode"], never, Service> = Effect.service(
  Service
).pipe(Effect.map((context) => context.permissionMode));

/**
 * Effectful access to the prompt id for the current hook invocation.
 *
 * **Example** (Read the prompt ID)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.promptId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const promptId: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.promptId)
);

/**
 * Effectful access to the hook event name (e.g. `"PreToolUse"`).
 *
 * **Example** (Read the event name)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.hookEventName.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const hookEventName: Effect.Effect<string, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.hookEventName)
);

/**
 * Effectful access to the active effort level payload (if any).
 *
 * **Example** (Read the effort level)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.effort.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const effort: Effect.Effect<HookEnvelope["effort"], never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.effort)
);

/**
 * Effectful access to the current subagent/session agent id (if any).
 *
 * **Example** (Read the agent ID)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.agentId.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const agentId: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.agentId)
);

/**
 * Effectful access to the current subagent/session agent type (if any).
 *
 * **Example** (Read the agent type)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const program = Hook.Context.agentType.pipe(
 *   Effect.provide(Hook.Context.layer(Testing.makeMockEnvelope()))
 * )
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @category getters
 * @since 0.0.0
 */
export const agentType: Effect.Effect<O.Option<string>, never, Service> = Effect.service(Service).pipe(
  Effect.map((context) => context.agentType)
);
