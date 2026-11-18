/**
 * Read a deployed cache's state without ever creating or upgrading the store.
 *
 * @internal
 * @since 0.0.0
 */
import { AlchemyContext } from "alchemy/AlchemyContext";
import { AuthProvidersLive } from "alchemy/Auth/Registry";
import * as State from "alchemy/State";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

type AlchemyContextShape = Context.Service.Shape<typeof AlchemyContext>;

const readOnlyStore = (context: AlchemyContextShape): AlchemyContextShape => ({
  ...context,
  updateStateStore: false,
});

// `CI=true` makes Alchemy's provisioning prompts fail instead of asking.
const nonInteractive = (fallback: ConfigProvider.ConfigProvider) =>
  ConfigProvider.fromUnknown({ CI: true }).pipe(ConfigProvider.orElse(fallback));

/**
 * Run an effect with state provisioning off: a missing or outdated store fails
 * instead of being created or upgraded, whatever the caller's context says.
 *
 * @internal
 * @since 0.0.0
 */
export const withoutStateProvisioning = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.updateService(AlchemyContext, readOnlyStore),
    Effect.updateService(ConfigProvider.ConfigProvider, nonInteractive)
  );

/**
 * The given state store layer with auth providers registered and provisioning
 * off, the shape `alchemy state read` uses.
 *
 * @internal
 * @since 0.0.0
 */
export const readOnlyStateLayer = <E, R>(state: Layer.Layer<State.State, E, R>) =>
  state.pipe(
    Layer.provide(AuthProvidersLive),
    Layer.updateService(AlchemyContext, readOnlyStore),
    Layer.updateService(ConfigProvider.ConfigProvider, nonInteractive)
  );

/**
 * Build the store once in the caller's scope and return its `State` service.
 *
 * @internal
 * @since 0.0.0
 */
export const deployedCacheState = Effect.fn("TurboCache.deployedCacheState")(function* <E, R>(
  state: Layer.Layer<State.State, E, R>
) {
  const context = yield* state.pipe(readOnlyStateLayer, Layer.build);
  return yield* Context.get(context, State.State);
});
