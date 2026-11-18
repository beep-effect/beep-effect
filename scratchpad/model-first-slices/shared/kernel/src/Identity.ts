import { $ScratchpadId } from "@beep/identity/packages";

// Every service key the prototype mints comes from these composers (owner review, phase 7): one
// root under the monorepo's scratchpad identity, one composer per prototype package. A module
// takes its own with `create("<path from src>")` and keys a service with the tagged template.

const $PrototypeId = $ScratchpadId.create("model-first-slices");

/**
 * The composer for `shared/kernel`.
 *
 * **Example** (A service key in a kernel module)
 * ```ts
 * import { $KernelId } from "@proto/kernel/Identity";
 * import * as Context from "effect/Context";
 *
 * const $I = $KernelId.create("Clock.service");
 * export class Ticks extends Context.Service<Ticks, { readonly now: number }>()($I`Ticks`) {}
 * ```
 *
 * @category identity
 * @since 0.0.0
 */
export const $KernelId = $PrototypeId.create("kernel");

/**
 * The composer for `party/contract`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $PartyContractId = $PrototypeId.create("party-contract");

/**
 * The composer for `party/model`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $PartyModelId = $PrototypeId.create("party-model");

/**
 * The composer for `party/host`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $PartyHostId = $PrototypeId.create("party-host");

/**
 * The composer for `party/web`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $PartyWebId = $PrototypeId.create("party-web");

/**
 * The composer for `authority/contract`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $AuthorityContractId = $PrototypeId.create("authority-contract");

/**
 * The composer for `authority/host`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $AuthorityHostId = $PrototypeId.create("authority-host");

/**
 * The composer for `runs/contract`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $RunsContractId = $PrototypeId.create("runs-contract");

/**
 * The composer for `runs/host`.
 *
 * @category identity
 * @since 0.0.0
 */
export const $RunsHostId = $PrototypeId.create("runs-host");
