/**
 * Provider-instance RPC client wiring.
 *
 * @packageDocumentation
 * @category clients
 * @since 0.0.0
 */
import { ProviderInstanceRpcs } from "@beep/agents-use-cases/public";
import { $AgentsClientId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as RpcClient from "effect/rpc/RpcClient";
import { chatProtocolLayerAtom } from "./Chat.atoms.ts";

const $I = $AgentsClientId.create("ProviderInstance.service");

/**
 * Injectable flattened ProviderInstance RPC transport used by the atom client.
 *
 * **Example** (Log transport key)
 *
 * ```ts
 * import { ProviderInstanceTransport } from "@beep/agents-client/ProviderInstance.service"
 *
 * console.log(ProviderInstanceTransport.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProviderInstanceTransport extends Context.Service<ProviderInstanceTransport>()(
  $I`ProviderInstanceTransport`,
  {
    make: RpcClient.make(ProviderInstanceRpcs, { flatten: true }),
  }
) {}

const ProviderInstanceTransportLive = (get: Atom.AtomContext): Layer.Layer<ProviderInstanceTransport> =>
  Layer.effect(ProviderInstanceTransport, ProviderInstanceTransport.make).pipe(
    Layer.provide(get(chatProtocolLayerAtom))
  );

/**
 * Writable ProviderInstance transport layer selector.
 *
 * **Details**
 *
 * Apps normally retain the HTTP-backed default. Tests and alternate hosts may
 * replace it before mounting provider-instance atoms.
 *
 * **Example** (Get atom from registry)
 *
 * ```ts
 * import { providerInstanceTransportLayerAtom } from "@beep/agents-client/ProviderInstance.service"
 * import * as AtomRegistry from "effect/reactivity/AtomRegistry";
 * const registry = AtomRegistry.make()
 * console.log(registry.get(providerInstanceTransportLayerAtom))
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const providerInstanceTransportLayerAtom = Atom.make<O.Option<Layer.Layer<ProviderInstanceTransport>>>(O.none());

/**
 * Flattened client for the client-safe {@link ProviderInstanceRpcs} group.
 *
 * **Example** (Create list query atom)
 *
 * ```ts
 * import { ProviderInstanceClient } from "@beep/agents-client/ProviderInstance.service"
 *
 * const atom = ProviderInstanceClient.query("ListProviderInstances", {})
 * console.log(atom)
 * ```
 *
 * @category clients
 * @since 0.0.0
 */
export class ProviderInstanceClient extends AtomRpc.Service<ProviderInstanceClient>()("ProviderInstanceClient", {
  group: ProviderInstanceRpcs,
  protocol: (get) => O.getOrElse(get(providerInstanceTransportLayerAtom), () => ProviderInstanceTransportLive(get)),
  makeEffect: ProviderInstanceTransport,
}) {}
