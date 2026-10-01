/**
 * Effect service that forwards xstate actors to the Stately inspector.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XstateId } from "@beep/identity/packages";
import { createInspector } from "@statelyai/sdk";
import { Context, Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { StatelyInspectorConfig, StatelyInspectorConfigFromEnv } from "./StatelyInspector.config.ts";
import { StatelyInspectorError } from "./Xstate.errors.ts";
import type { CreateInspectorOptions, Inspector } from "@statelyai/sdk";
import type { EffectActor } from "@xstate/effect";
import type { ConfigError } from "effect/Config";
import type * as Scope from "effect/Scope";
import type { AnyActorLogic, AnyEventObject, InspectionEvent, Snapshot } from "xstate";

const $I = $XstateId.create("StatelyInspector.service");

/**
 * The slice of an `EffectActor` the inspector bridge reads: the root snapshot,
 * the inspection event feed, the logic (machines expose their `config` for the
 * visualizer) and the session id xstate assigned when the actor started.
 *
 * @category models
 * @since 0.0.0
 */
export type InspectableActor = Pick<EffectActor<AnyActorLogic>, "getSnapshot" | "inspect" | "logic" | "sessionId">;

/**
 * Factory for the SDK inspector, injectable for tests that supply a transport.
 *
 * @category models
 * @since 0.0.0
 */
export type CreateInspector = (options: CreateInspectorOptions) => Inspector;

/**
 * Service contract of {@link StatelyInspector}.
 *
 * @category services
 * @since 0.0.0
 */
export interface StatelyInspectorShape {
  /** Forwards an actor's inspection events until the enclosing scope closes. */
  readonly attach: (actor: InspectableActor) => Effect.Effect<void, never, Scope.Scope>;
  /** Configuration the service was built from. */
  readonly config: StatelyInspectorConfig;
  /** URL that opens the inspector UI for this session, when enabled. */
  readonly inspectorUrl: O.Option<string>;
  /** Succeeds once the relay accepted this producer; fails when registration is rejected. */
  readonly ready: Effect.Effect<void, StatelyInspectorError>;
}

const disabledService: StatelyInspectorShape = {
  config: StatelyInspectorConfig.make({}),
  inspectorUrl: O.none(),
  ready: Effect.void,
  attach: () => Effect.void,
};

const inspectorOptions = (config: StatelyInspectorConfig): CreateInspectorOptions => {
  const base: CreateInspectorOptions = { launch: config.launch };
  const withRelay = O.match(config.relayUrl, {
    onNone: () => base,
    onSome: (url): CreateInspectorOptions => ({ ...base, url }),
  });
  return O.match(config.name, {
    onNone: () => withRelay,
    onSome: (name): CreateInspectorOptions => ({ ...withRelay, name }),
  });
};

// Wire snapshots stay JSON-safe: contexts routinely hold spawned actor references.
const inspectorSnapshot = (snapshot: Snapshot<unknown>): { readonly status: unknown; readonly value?: unknown } =>
  "value" in snapshot ? { status: snapshot.status, value: snapshot.value } : { status: snapshot.status };

const machineOption = (logic: unknown): { readonly machine?: unknown } =>
  P.isObject(logic) && "config" in logic ? { machine: logic.config } : {};

const parentOption = (sessionId: string | undefined): { readonly parent?: string } =>
  P.isString(sessionId) ? { parent: sessionId } : {};

const sourceOption = (sessionId: string | undefined): { readonly source?: string } =>
  P.isString(sessionId) ? { source: sessionId } : {};

const registerRoot = (inspector: Inspector, actor: InspectableActor): void => {
  if (P.isString(actor.sessionId)) {
    inspector.actor(actor.sessionId, {
      snapshot: inspectorSnapshot(actor.getSnapshot()),
      ...machineOption(actor.logic),
    });
  }
};

// `/effect` re-materializes the root reference on every pure step, which the
// SDK's own `inspect` hook reports as a duplicate session id. Forwarding the v6
// inspection events by hand keeps session ids stable across those steps.
const forwardInspection =
  (inspector: Inspector) =>
  (event: InspectionEvent): void => {
    const id = event.actorRef.sessionId;
    if (!P.isString(id)) {
      return;
    }
    if (event.type === "@xstate.actor") {
      inspector.actor(id, { snapshot: inspectorSnapshot(event.snapshot), ...parentOption(event.parentRef?.sessionId) });
      return;
    }
    const occurred: AnyEventObject = event.event;
    inspector.event(id, occurred, sourceOption(event.sourceRef?.sessionId));
    inspector.snapshot(id, inspectorSnapshot(event.snapshot), occurred);
    if (event.snapshot.status !== "active") {
      inspector.stop(id);
    }
  };

const makeEnabledService = Effect.fn("StatelyInspector.makeEnabledService")(function* (
  config: StatelyInspectorConfig,
  create: CreateInspector
) {
  const inspector = yield* Effect.acquireRelease(
    Effect.sync(() => create(inspectorOptions(config))),
    (created) => Effect.sync(() => created.destroy())
  );
  const ready = Effect.tryPromise({
    try: () => inspector.ready,
    catch: (cause) =>
      StatelyInspectorError.make({
        operation: "connect",
        message: "The Stately inspector relay rejected this producer's registration.",
        cause,
      }),
  });
  const attach = (actor: InspectableActor): Effect.Effect<void, never, Scope.Scope> =>
    pipe(
      Effect.acquireRelease(
        Effect.sync(() => {
          registerRoot(inspector, actor);
          return actor.inspect(forwardInspection(inspector));
        }),
        (subscription) => Effect.sync(() => subscription.unsubscribe())
      ),
      Effect.asVoid
    );
  return StatelyInspector.of({
    config,
    inspectorUrl: O.fromNullOr(inspector.inspectorUrl),
    ready,
    attach,
  });
});

/**
 * Effect service that forwards actor systems to the Stately inspector relay.
 *
 * **Details**
 *
 * The SDK inspector is a scoped resource: it is destroyed when the layer's
 * scope closes. Attachments are scoped too, so a workflow can attach its actor
 * for the lifetime of the request that created it.
 *
 * **Example** (Attach an Effect actor)
 *
 * ```ts
 * import { StatelyInspector } from "@beep/xstate"
 * import { Effect } from "effect"
 * import type { InspectableActor } from "@beep/xstate"
 *
 * declare const actor: InspectableActor
 * const program = Effect.gen(function* () {
 *   const inspector = yield* StatelyInspector
 *   yield* inspector.attach(actor)
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class StatelyInspector extends Context.Service<StatelyInspector, StatelyInspectorShape>()($I`StatelyInspector`) {
  /**
   * Layer whose service forwards nothing; the default for production runtimes.
   *
   * **Example** (Provide the disabled inspector)
   *
   * ```ts
   * import { StatelyInspector } from "@beep/xstate"
   *
   * console.log(StatelyInspector.layerDisabled)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerDisabled: Layer.Layer<StatelyInspector> = Layer.succeed(
    StatelyInspector,
    StatelyInspector.of(disabledService)
  );

  /**
   * Build an inspector layer from explicit configuration.
   *
   * **Details**
   *
   * A disabled configuration returns {@link StatelyInspector.layerDisabled}
   * without touching the SDK. Tests inject `create` to supply a transport.
   *
   * **Example** (Layer from explicit config)
   *
   * ```ts
   * import { StatelyInspector, StatelyInspectorConfig } from "@beep/xstate"
   *
   * const layer = StatelyInspector.makeLayer(StatelyInspectorConfig.make({ enabled: true }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (
    config: StatelyInspectorConfig,
    create: CreateInspector = createInspector
  ): Layer.Layer<StatelyInspector> =>
    config.enabled
      ? Layer.effect(StatelyInspector, makeEnabledService(config, create))
      : StatelyInspector.layerDisabled;

  /**
   * Live inspector layer driven by the `STATELY_INSPECT*` environment variables.
   *
   * **Example** (Live environment layer)
   *
   * ```ts
   * import { StatelyInspector } from "@beep/xstate"
   *
   * console.log(StatelyInspector.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<StatelyInspector, ConfigError> = Layer.unwrap(
    Effect.map(StatelyInspectorConfigFromEnv, (config) => StatelyInspector.makeLayer(config))
  );
}

/**
 * Forwards an actor to the configured inspector until the enclosing scope closes.
 *
 * **Example** (Inspect an actor inside a scoped program)
 *
 * ```ts
 * import { inspectActor } from "@beep/xstate"
 * import type { InspectableActor } from "@beep/xstate"
 *
 * declare const actor: InspectableActor
 * console.log(inspectActor(actor))
 * ```
 *
 * @param actor - Actor handle exposing `inspect`.
 * @returns Scoped Effect that detaches the actor when its scope closes.
 * @category combinators
 * @since 0.0.0
 */
export const inspectActor = (actor: InspectableActor): Effect.Effect<void, never, StatelyInspector | Scope.Scope> =>
  StatelyInspector.use((inspector) => inspector.attach(actor));
