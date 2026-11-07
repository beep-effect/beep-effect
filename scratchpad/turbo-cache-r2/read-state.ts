import * as Cloudflare from "@alchemy.run/cloudflare";
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

const nonInteractive = (fallback: ConfigProvider.ConfigProvider) =>
  ConfigProvider.fromUnknown({ CI: true }).pipe(ConfigProvider.orElse(fallback));

export const withoutStateProvisioning = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.updateService(AlchemyContext, readOnlyStore),
    Effect.updateService(ConfigProvider.ConfigProvider, nonInteractive),
  );

export const DeployedCacheStateLive = (stateStoreName: string) =>
  Cloudflare.state({ workerName: stateStoreName }).pipe(
    Layer.provide(AuthProvidersLive),
    Layer.updateService(AlchemyContext, readOnlyStore),
    Layer.updateService(ConfigProvider.ConfigProvider, nonInteractive),
  );

export const deployedCacheState = Effect.fn("TurboCache.deployedCacheState")(function* deployedCacheState(
  stateStoreName: string,
) {
  const context = yield* Layer.build(DeployedCacheStateLive(stateStoreName));
  return yield* Context.get(context, State.State);
});
