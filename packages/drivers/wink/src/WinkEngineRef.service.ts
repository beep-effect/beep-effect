/**
 * Compatibility service exposing the shared live wink runtime ref.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { Context, Effect, Layer, Ref } from "effect";
import {
  InstanceId as InstanceIdService,
  WinkEngine as WinkEngineService,
  WinkEngineState as WinkEngineStateService,
} from "./Wink.service.ts";
import type { WinkEntityError } from "./Wink.errors.ts";
import type { WinkEngineCustomEntities } from "./Wink.models.ts";
import type { WinkEngineRuntimeState as WinkEngineRuntimeStateType } from "./Wink.service.ts";

const $I = $WinkId.create("Wink/WinkEngineRef");

type WinkEngineRefShape = {
  readonly getRef: () => Ref.Ref<WinkEngineRuntimeStateType>;
  readonly updateWithCustomEntities: (
    customEntities: WinkEngineCustomEntities
  ) => Effect.Effect<WinkEngineRuntimeStateType, WinkEntityError>;
};

const makeWinkEngineRef = Effect.gen(function* () {
  const engine = yield* WinkEngineService;
  const stateRef = yield* engine.getRef;

  return WinkEngineRef.of({
    getRef: () => stateRef,
    updateWithCustomEntities: Effect.fn("Wink.WinkEngineRef.updateWithCustomEntities")(function* (
      customEntities: WinkEngineCustomEntities
    ) {
      yield* engine.learnCustomEntities(customEntities);
      return yield* Ref.get(stateRef);
    }),
  });
}).pipe(Effect.withSpan("Wink.WinkEngineRef.make"));

/**
 * Compatibility service for reading the live wink runtime ref and updating custom entities.
 *
 * **Details**
 *
 * Prefer {@link WinkEngineRef} when code needs stable access to the shared `Ref`
 * itself, such as cache invalidation or compatibility bridges. For normal NLP
 * operations use the higher-level `WinkEngine` service.
 *
 * **Example** (Read shared runtime ref)
 *
 * ```ts
 * import { Effect, Layer, Ref } from "effect"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkEngineRef, WinkEngineRefLive } from "@beep/wink"
 *
 * const program = Effect.gen(function* () {
 *   const ref = yield* WinkEngineRef
 *   const stateRef = ref.getRef()
 *   const state = yield* Ref.get(stateRef)
 *   return state.instanceId
 * })
 *
 * Effect.runPromise(
 *   program.pipe(Effect.provide(WinkEngineRefLive.pipe(Layer.provide(WinkEngineLive))))
 * ).then(console.log)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class WinkEngineRef extends Context.Service<WinkEngineRef, WinkEngineRefShape>()($I`WinkEngineRef`) {}

/**
 * Live compatibility layer backed by the shared wink engine runtime.
 *
 * **Example** (Provide live compatibility layer)
 *
 * ```ts
 * import { Effect, Layer, Ref } from "effect"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkEngineRef, WinkEngineRefLive } from "@beep/wink"
 *
 * const readInstance = Effect.gen(function* () {
 *   const ref = yield* WinkEngineRef
 *   const state = yield* Ref.get(ref.getRef())
 *   return state.instanceId
 * })
 *
 * Effect.runPromise(
 *   readInstance.pipe(Effect.provide(WinkEngineRefLive.pipe(Layer.provide(WinkEngineLive))))
 * ).then(console.log)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const WinkEngineRefLive = Layer.effect(WinkEngineRef, makeWinkEngineRef);

/**
 * Runtime state stored inside the shared wink engine ref.
 *
 * **Example** (Read runtime state from ref)
 *
 * ```ts
 * import { Effect, Layer, Ref } from "effect"
 * import type { WinkEngineRuntimeState } from "@beep/wink"
 * import { WinkEngineLive } from "@beep/wink"
 * import { WinkEngineRef, WinkEngineRefLive } from "@beep/wink"
 *
 * const readState = Effect.gen(function* () {
 *   const ref = yield* WinkEngineRef
 *   return yield* Ref.get(ref.getRef())
 * }).pipe(Effect.provide(WinkEngineRefLive.pipe(Layer.provide(WinkEngineLive))))
 *
 * Effect.runPromise(readState).then((state) => console.log(state.instanceId))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WinkEngineRuntimeState = WinkEngineRuntimeStateType;
/**
 * Branded schema for live wink engine instance identifiers.
 *
 * **Example** (Make branded instance identifier)
 *
 * ```ts
 * import { InstanceId } from "@beep/wink"
 *
 * const instanceId = InstanceId.make("wink-engine-example-1")
 * console.log(instanceId)
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const InstanceId = InstanceIdService;
/**
 * Serializable schema for wink engine state metadata.
 *
 * **Example** (Construct serializable engine state)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { InstanceId, WinkEngineState } from "@beep/wink"
 *
 * const state = WinkEngineState.make({
 *   customEntities: O.none(),
 *   instanceId: InstanceId.make("wink-engine-example-1")
 * })
 *
 * console.log(state.instanceId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WinkEngineState = WinkEngineStateService;
