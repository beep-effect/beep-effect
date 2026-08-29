/**
 * Typed in-process event bus for hook invocations.
 *
 * Built on `PubSub` + `Stream.fromPubSub`, this lets consumers build reactive
 * pipelines over decoded hook events without inventing their own subscription
 * plumbing.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";

import type * as Events from "./Events/index.ts";

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const $I = $ScratchpadId.create("claudecode/Hook/Bus");

/**
 * Shape of the typed in-process hook event bus.
 *
 * **Example** (Name the bus interface)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Bus.Interface
 * ```
 *
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
 * **Example** (Access the event stream)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const events = Effect.service(Hook.Bus.Service).pipe(
 *   Effect.map((bus) => bus.events)
 * )
 * console.log(events)
 * ```
 *
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
 * **Example** (Construct an event bus layer)
 *
 * ```ts
 * import { Hook } from "effect-claudecode"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(Hook.Bus.layer)) // true
 * ```
 *
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
 * @category getters
 * @since 0.0.0
 */
export const publish = Effect.fn("Hook.Bus.publishEvent")(
  (event: Events.HookInput): Effect.Effect<void, never, Service> =>
    Effect.flatMap(bus, (hookBus) => hookBus.publish(event))
);
