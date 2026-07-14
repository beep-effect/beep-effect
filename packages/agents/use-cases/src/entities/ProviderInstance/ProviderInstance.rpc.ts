/** Provider-instance RPC contracts. @packageDocumentation @since 0.0.0 */
import { ProviderInstance } from "@beep/agents-domain/entities/ProviderInstance";
import * as S from "effect/Schema";
import * as Rpc from "effect/unstable/rpc/Rpc";
import * as RpcGroup from "effect/unstable/rpc/RpcGroup";
import {
  AddProviderInstanceCommand,
  GetProviderInstanceQuery,
  ListProviderInstancesQuery,
  ProbeProviderInstanceCommand,
  RemoveProviderInstanceCommand,
  UpdateProviderInstanceCommand,
} from "./ProviderInstance.commands.js";
import { ProviderActionError } from "./ProviderInstance.errors.js";

/** RPC for adding an instance.
 * @example
 * ```ts
 * import { AddProviderInstanceRpc, ProviderInstanceRpcs } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.get("AddProviderInstance") === AddProviderInstanceRpc)
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const AddProviderInstanceRpc = Rpc.make("AddProviderInstance", {
  payload: AddProviderInstanceCommand,
  success: ProviderInstance,
  error: ProviderActionError,
});
/** RPC for updating an instance.
 * @example
 * ```ts
 * import { ProviderInstanceRpcs, UpdateProviderInstanceRpc } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.get("UpdateProviderInstance") === UpdateProviderInstanceRpc)
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const UpdateProviderInstanceRpc = Rpc.make("UpdateProviderInstance", {
  payload: UpdateProviderInstanceCommand,
  success: ProviderInstance,
  error: ProviderActionError,
});
/** RPC for removing an instance.
 * @example
 * ```ts
 * import { ProviderInstanceRpcs, RemoveProviderInstanceRpc } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.get("RemoveProviderInstance") === RemoveProviderInstanceRpc)
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const RemoveProviderInstanceRpc = Rpc.make("RemoveProviderInstance", {
  payload: RemoveProviderInstanceCommand,
  success: S.Void,
  error: ProviderActionError,
});
/** RPC for probing an instance.
 * @example
 * ```ts
 * import { ProbeProviderInstanceRpc, ProviderInstanceRpcs } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.get("ProbeProviderInstance") === ProbeProviderInstanceRpc)
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const ProbeProviderInstanceRpc = Rpc.make("ProbeProviderInstance", {
  payload: ProbeProviderInstanceCommand,
  success: ProviderInstance,
  error: ProviderActionError,
});
/** RPC for loading an instance.
 * @example
 * ```ts
 * import { GetProviderInstanceRpc, ProviderInstanceRpcs } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.get("GetProviderInstance") === GetProviderInstanceRpc)
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const GetProviderInstanceRpc = Rpc.make("GetProviderInstance", {
  payload: GetProviderInstanceQuery,
  success: ProviderInstance,
  error: ProviderActionError,
});
/** RPC for listing instances.
 * @example
 * ```ts
 * import { ListProviderInstancesRpc, ProviderInstanceRpcs } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.get("ListProviderInstances") === ListProviderInstancesRpc)
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const ListProviderInstancesRpc = Rpc.make("ListProviderInstances", {
  payload: ListProviderInstancesQuery,
  success: S.Array(ProviderInstance),
  error: ProviderActionError,
});

/** Client-safe provider-instance RPC group.
 * @example
 * ```ts
 * import { ProviderInstanceRpcs } from "@beep/agents-use-cases/public"
 * console.log(ProviderInstanceRpcs.requests.has("ProbeProviderInstance")) // true
 * ```
 * @category protocols
 * @since 0.0.0
 */
export const ProviderInstanceRpcs = RpcGroup.make(
  AddProviderInstanceRpc,
  UpdateProviderInstanceRpc,
  RemoveProviderInstanceRpc,
  ProbeProviderInstanceRpc,
  GetProviderInstanceRpc,
  ListProviderInstancesRpc
);
