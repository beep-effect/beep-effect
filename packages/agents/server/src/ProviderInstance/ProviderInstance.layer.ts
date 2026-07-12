/** ProviderInstance server and RPC layers. @packageDocumentation @since 0.0.0 */

import {
  makeProviderInstanceUseCases,
  ProviderInstanceRepository,
  ProviderInstanceRpcs,
  ProviderInstanceUseCases,
  ProviderProbe,
} from "@beep/agents-use-cases/server";
import { AiProviderCli } from "@beep/ai-provider-cli";
import { Effect, Layer } from "effect";
import { makeProviderProbe } from "./ProviderInstance.probe.js";
import { makeProviderInstanceRepository } from "./ProviderInstance.repo.js";

/** Drizzle repository port layer. @example
 * ```ts
 * import { ProviderInstanceRepositoryLive } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderInstanceRepositoryLive)
 * ```
 * @category layers @since 0.0.0
 */
export const ProviderInstanceRepositoryLive = Layer.effect(
  ProviderInstanceRepository,
  makeProviderInstanceRepository()
);

/** Provider CLI probe port layer. @example
 * ```ts
 * import { ProviderProbeLive } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderProbeLive)
 * ```
 * @category layers @since 0.0.0
 */
export const ProviderProbeLive = Layer.effect(ProviderProbe, makeProviderProbe());

/** ProviderInstance use-case layer over its two ports. @example
 * ```ts
 * import { ProviderInstanceUseCasesLive } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderInstanceUseCasesLive)
 * ```
 * @category layers @since 0.0.0
 */
export const ProviderInstanceUseCasesLive = Layer.effect(
  ProviderInstanceUseCases,
  Effect.gen(function* () {
    return makeProviderInstanceUseCases(yield* ProviderInstanceRepository, yield* ProviderProbe);
  })
);

/** RPC handler layer bound to the live ProviderInstance use cases. @example
 * ```ts
 * import { ProviderInstanceRpcHandlersLive } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderInstanceRpcHandlersLive)
 * ```
 * @category layers @since 0.0.0
 */
export const ProviderInstanceRpcHandlersLive = ProviderInstanceRpcs.toLayer(
  Effect.gen(function* () {
    const useCases = yield* ProviderInstanceUseCases;
    return ProviderInstanceRpcs.of({
      AddProviderInstance: useCases.add,
      GetProviderInstance: useCases.get,
      ListProviderInstances: useCases.list,
      ProbeProviderInstance: useCases.probe,
      RemoveProviderInstance: useCases.remove,
      UpdateProviderInstance: useCases.update,
    });
  })
);

const PortsLive = Layer.mergeAll(ProviderInstanceRepositoryLive, ProviderProbeLive);

/** Complete ProviderInstance slice layer, including driver and RPC handlers.
 * @example
 * ```ts
 * import { ProviderInstanceLive } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderInstanceLive)
 * ```
 * @category layers @since 0.0.0
 */
export const ProviderInstanceLive = ProviderInstanceRpcHandlersLive.pipe(
  Layer.provideMerge(ProviderInstanceUseCasesLive),
  Layer.provideMerge(PortsLive),
  Layer.provideMerge(AiProviderCli.makeLayer())
);
