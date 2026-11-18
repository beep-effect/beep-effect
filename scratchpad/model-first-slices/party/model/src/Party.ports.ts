import type * as Domain from "@alchemy.run/domain";
import type * as Context from "effect/Context";
import type * as Layer from "effect/Layer";
import type { PartyDirectoryStore } from "./Directory/PartyDirectory.store.ts";
import type { ContactSource } from "./Evidence/ContactSource.external.ts";
import { PartyHandlers } from "./Party.handlers.ts";
import { PartyModel } from "./Party.model.ts";
import type { Reasoner } from "./Review/Reasoner.external.ts";
import type { ReviewRuns } from "./Review/ReviewRuns.external.ts";
import type { Authority } from "./Authority.external.ts";

/**
 * Everything the model needs from outside itself. Growing this union is an
 * architecture event.
 *
 * **Gotchas**
 *
 * A `Domain.ExternalSystem` class is not its own service identifier (the
 * Layer requires `ExternalSystemKey<"Reasoner">`), so the union is built from
 * `Context.Service.Identifier`, not from the class names.
 *
 * @category ports
 * @since 0.0.0
 */
export type PartyPorts =
  | Context.Service.Identifier<typeof ContactSource>
  | Context.Service.Identifier<typeof Reasoner>
  | Context.Service.Identifier<typeof PartyDirectoryStore>
  | Context.Service.Identifier<typeof Authority>
  | Context.Service.Identifier<typeof ReviewRuns>;

/**
 * What every platform gives a hosted model, read off `Domain.InMemory`:
 * `Platform | WorkflowEngine | SecureRandom`. `DomainCluster.layerEntities(...)`
 * provides the same three, so the in-memory platform's output is the contract.
 *
 * @category ports
 * @since 0.0.0
 */
export type Host = Layer.Success<typeof Domain.InMemory>;

/**
 * The model with its generated handler registry, on no platform yet. Its
 * requirements are the ports and the host, and nothing else.
 *
 * **Example** (Host the model in memory)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
 * import { PartyHosted } from "@proto/party-model/Party.ports";
 * import * as Layer from "effect/Layer";
 *
 * const hosted = PartyHosted.pipe(Layer.provide(Layer.mergeAll(MemoryPartyDirectoryStore, Domain.InMemory)));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PartyHosted = PartyModel.layer(PartyHandlers);

/**
 * Services a handler requires that the model never declared: `never` while
 * the model is pure.
 *
 * @category ports
 * @since 0.0.0
 */
export type LeakedServices = Exclude<Layer.Services<typeof PartyHosted>, PartyPorts | Host>;

/**
 * The purity law as a type. `true` only when nothing leaked; otherwise its
 * type is the leaked service, and `true` is not assignable to it.
 *
 * @category ports
 * @since 0.0.0
 */
export const portPurity: [LeakedServices] extends [never] ? true : LeakedServices = true;

/**
 * The same law as the design writes it. `Layer`'s `RIn` is covariant, so
 * this rejects a leak too.
 *
 * @category ports
 * @since 0.0.0
 */
export const portPuritySatisfies = PartyHosted satisfies Layer.Layer<never, unknown, PartyPorts | Host>;
