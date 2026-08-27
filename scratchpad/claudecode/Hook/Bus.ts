/**
 * Typed in-process event bus for hook invocations.
 *
 * Built on `PubSub` + `Stream.fromPubSub`, this lets consumers build reactive
 * pipelines over decoded hook events without inventing their own subscription
 * plumbing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { Context, Effect, Layer, PubSub, Stream } from "effect";
import type * as Events from "./Events/index.ts";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Bus");

/**
 * Shape of the typed in-process hook event bus.
 *
 * @see {@link layer} for the layer that provides this service.
 * @see {@link publish} to emit events to {@link Interface.stream} subscribers.
 * @category services
 * @since 0.0.0
 */
export interface Interface {
  readonly publish: (event: Events.HookInput) => Effect.Effect<void>;
  readonly events: Stream.Stream<Events.HookInput>;
  readonly stream: <T extends Events.HookEventName>(
    eventName: T
  ) => Stream.Stream<Extract<Events.HookInput, { readonly hook_event_name: T }>>;
}

/**
 * Typed in-process hook event bus service.
 *
 * **Example** (Publish through the provided service)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const event = Hook.SessionStart.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SessionStart",
 *   source: "startup"
 * })
 * const program = Effect.gen(function* () {
 *   const bus = yield* Hook.Bus.Service
 *   yield* bus.publish(event)
 *   return event.hook_event_name
 * })
 * Effect.runPromise(program.pipe(Effect.provide(Hook.Bus.layer))).then((eventName) =>
 *   console.log(eventName)
 * ) // "SessionStart"
 * ```
 *
 * @see {@link layer} for the layer that must be provided.
 * @see {@link publish} for the accessor that publishes without yielding the service.
 * @category services
 * @since 0.0.0
 */
export class Service extends Context.Service<Service, Interface>()($I`Service`) {}

const make = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<Events.HookInput>();
  yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub));

  const events = Stream.fromPubSub(pubsub);
  const publish = Effect.fn("Hook.Bus.publish")((event: Events.HookInput) => PubSub.publish(pubsub, event));
  const stream = <T extends Events.HookEventName>(eventName: T) =>
    events.pipe(
      Stream.filter(
        (event): event is Extract<Events.HookInput, { readonly hook_event_name: T }> =>
          event.hook_event_name === eventName
      )
    );

  return Service.of({ publish, events, stream });
}).pipe(Effect.withSpan("Hook.Bus.make"));

/**
 * Construct an in-process hook bus layer.
 *
 * **Example** (Provide the bus and publish)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const event = Hook.SessionStart.Input.make({
 *   session_id: "session-1",
 *   transcript_path: "/tmp/transcript.jsonl",
 *   cwd: "/repo",
 *   hook_event_name: "SessionStart",
 *   source: "startup"
 * })
 * Effect.runPromise(Hook.Bus.publish(event).pipe(Effect.provide(Hook.Bus.layer))).then(() =>
 *   console.log(event.hook_event_name)
 * ) // "SessionStart"
 * ```
 *
 * @see {@link bus} for the accessor that requires this layer.
 * @see {@link publish} to emit events once this layer is provided.
 * @category layers
 * @since 0.0.0
 */
export const layer = Layer.effect(Service, make);

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Effectful access to the hook bus service.
 *
 * **Example** (Run the bus accessor)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runPromise(Hook.Bus.bus.pipe(Effect.provide(Hook.Bus.layer))).then(
 *   (bus) => console.log(bus.events)
 * )
 * ```
 *
 * @effects Requires {@link Service}; does not fail.
 * @see {@link publish} to emit events onto this bus.
 * @see {@link layer} for the layer that must be provided.
 * @category getters
 * @since 0.0.0
 */
export const bus: Effect.Effect<Interface, never, Service> = Effect.service(Service);

/**
 * Publish one hook event to the current bus.
 *
 * **Example** (Publish a session-start event)
 *
 * ```ts
 * import { Hook, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const event = S.decodeUnknownSync(Hook.SessionStart.Input)(
 *   JSON.parse(Testing.fixtures.SessionStart())
 * )
 * Effect.runPromise(Hook.Bus.publish(event).pipe(Effect.provide(Hook.Bus.layer))).then(
 *   () => console.log("published")
 * )
 * ```
 *
 * @effects Requires {@link Service} and publishes the event to all active subscribers.
 * @see {@link bus} for Effectful access to the same service.
 * @see {@link layer} for the layer that must be provided.
 * @category events
 * @since 0.0.0
 */
export const publish = Effect.fn("Hook.Bus.publishEvent")(
  (event: Events.HookInput): Effect.Effect<void, never, Service> =>
    Effect.flatMap(bus, (hookBus) => hookBus.publish(event))
);
