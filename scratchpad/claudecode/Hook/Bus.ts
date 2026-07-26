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
 * @category services
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * type Example = Hook.Bus.Interface
 * ```
 */
export interface Interface {
  readonly publish: (event: Events.HookInput.Type) => Effect.Effect<void>;
  readonly events: Stream.Stream<Events.HookInput.Type>;
  readonly stream: <T extends Events.HookEventName>(
    eventName: T
  ) => Stream.Stream<Extract<Events.HookInput.Type, { readonly hook_event_name: T }>>;
}

/**
 * Typed in-process hook event bus service.
 *
 * @category services
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Bus.Service)
 * ```
 */
export class Service extends Context.Service<Service, Interface>()($I`Service`) {}

const make = Effect.gen(function* () {
  const pubsub = yield* PubSub.unbounded<Events.HookInput.Type>();
  yield* Effect.addFinalizer(() => PubSub.shutdown(pubsub));

  const events = Stream.fromPubSub(pubsub);
  const publish = Effect.fn("Hook.Bus.publish")((event: Events.HookInput.Type) => PubSub.publish(pubsub, event));
  const stream = <T extends Events.HookEventName>(eventName: T) =>
    events.pipe(
      Stream.filter(
        (event): event is Extract<Events.HookInput.Type, { readonly hook_event_name: T }> =>
          event.hook_event_name === eventName
      )
    );

  return Service.of({ publish, events, stream });
}).pipe(Effect.withSpan("Hook.Bus.make"));

/**
 * Construct an in-process hook bus layer.
 *
 * @category layers
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Bus.layer)
 * ```
 */
export const layer = Layer.effect(Service, make);

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/**
 * Effectful access to the hook bus service.
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Bus.bus)
 * ```
 */
export const bus: Effect.Effect<Interface, never, Service> = Effect.service(Service);

/**
 * Publish one hook event to the current bus.
 *
 * @category getters
 * @since 0.0.0
 *
 * @example
 * ```ts
 * import { Hook } from "effect-claudecode"
 *
 * console.log(Hook.Bus.publish)
 * ```
 */
export const publish = Effect.fn("Hook.Bus.publishEvent")(
  (event: Events.HookInput.Type): Effect.Effect<void, never, Service> =>
    Effect.flatMap(bus, (hookBus) => hookBus.publish(event))
);
