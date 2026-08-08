/**
 * Thin reactive client atoms for provider-instance lifecycle operations.
 *
 * @packageDocumentation
 * @category atoms
 * @since 0.0.0
 */
import { Effect } from "effect";
import { Reactivity } from "effect/unstable/reactivity";
import { ProviderInstanceClient } from "./ProviderInstance.service.ts";
import type {
  AddProviderInstanceCommand,
  ProbeProviderInstanceCommand,
  RemoveProviderInstanceCommand,
  UpdateProviderInstanceCommand,
} from "@beep/agents-use-cases/public";

/** Shared reactivity key for the complete provider-instance list. @internal */
const PROVIDER_INSTANCES_KEY = "provider-instances" as const;

/**
 * All configured provider instances.
 *
 * **Example** (Log provider instances atom)
 *
 * ```ts
 * import { providerInstancesAtom } from "@beep/agents-client/ProviderInstance.atoms"
 *
 * console.log(providerInstancesAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const providerInstancesAtom = ProviderInstanceClient.query(
  "ListProviderInstances",
  {},
  { reactivityKeys: [PROVIDER_INSTANCES_KEY] }
);

/**
 * Adds a provider instance and refreshes the instance list.
 *
 * **Example** (Log add provider atom)
 *
 * ```ts
 * import { addProviderInstanceAtom } from "@beep/agents-client/ProviderInstance.atoms"
 *
 * console.log(addProviderInstanceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const addProviderInstanceAtom = ProviderInstanceClient.runtime.fn<AddProviderInstanceCommand>()(
  Effect.fn("ProviderInstance.add")(function* (command) {
    const client = yield* ProviderInstanceClient;
    return yield* Reactivity.mutation(client("AddProviderInstance", command), [PROVIDER_INSTANCES_KEY]);
  })
);

/**
 * Updates a provider instance and refreshes the instance list.
 *
 * **Example** (Log update provider atom)
 *
 * ```ts
 * import { updateProviderInstanceAtom } from "@beep/agents-client/ProviderInstance.atoms"
 *
 * console.log(updateProviderInstanceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const updateProviderInstanceAtom = ProviderInstanceClient.runtime.fn<UpdateProviderInstanceCommand>()(
  Effect.fn("ProviderInstance.update")(function* (command) {
    const client = yield* ProviderInstanceClient;
    return yield* Reactivity.mutation(client("UpdateProviderInstance", command), [PROVIDER_INSTANCES_KEY]);
  })
);

/**
 * Removes a provider instance and refreshes the instance list.
 *
 * **Example** (Log remove provider atom)
 *
 * ```ts
 * import { removeProviderInstanceAtom } from "@beep/agents-client/ProviderInstance.atoms"
 *
 * console.log(removeProviderInstanceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const removeProviderInstanceAtom = ProviderInstanceClient.runtime.fn<RemoveProviderInstanceCommand>()(
  Effect.fn("ProviderInstance.remove")(function* (command) {
    const client = yield* ProviderInstanceClient;
    return yield* Reactivity.mutation(client("RemoveProviderInstance", command), [PROVIDER_INSTANCES_KEY]);
  })
);

/**
 * Probes a provider instance and refreshes the instance list.
 *
 * **Details**
 *
 * Client-safe failures, including unauthenticated login guidance, remain in
 * the atom error channel unchanged.
 *
 * **Example** (Log probe provider atom)
 *
 * ```ts
 * import { probeProviderInstanceAtom } from "@beep/agents-client/ProviderInstance.atoms"
 *
 * console.log(probeProviderInstanceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const probeProviderInstanceAtom = ProviderInstanceClient.runtime.fn<ProbeProviderInstanceCommand>()(
  Effect.fn("ProviderInstance.probe")(function* (command) {
    const client = yield* ProviderInstanceClient;
    return yield* Reactivity.mutation(client("ProbeProviderInstance", command), [PROVIDER_INSTANCES_KEY]);
  })
);
