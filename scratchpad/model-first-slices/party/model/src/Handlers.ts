import type * as Domain from "@alchemy.run/domain";
import type * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { ClaimReviewLive } from "./Claim/ClaimReview.view.live.ts";
import { FindPartiesLive } from "./Directory/FindParties.query.live.ts";
import { PartyDirectoryLive } from "./Directory/PartyDirectory.projection.live.ts";
import type { PartyDirectoryStore } from "./Directory/PartyDirectory.store.ts";
import type { ContactSource } from "./Evidence/ContactSource.external.ts";
import { PartyModel } from "./Party.model.ts";
import { EffectivePartyLive } from "./Party/EffectiveParty.view.live.ts";
import { MergeOnSamePartyLive } from "./Party/MergeOnSameParty.policy.live.ts";
import type { Reasoner } from "./Review/Reasoner.external.ts";
import { ReviewAssistLive } from "./Review/ReviewAssist.saga.live.ts";
import { ReviewOnAssertionLive } from "./Review/ReviewOnAssertion.policy.live.ts";

/**
 * Every `.live.ts` Layer of the model, as one Layer: view validators,
 * policies, the saga, the projection and the query.
 *
 * **Example** (Host the model in memory)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { MemoryPartyDirectoryStore } from "@proto/party/Directory/PartyDirectory.store";
 * import { PartyHandlers } from "@proto/party/Handlers";
 * import { PartyModel } from "@proto/party/Party.model";
 * import * as Layer from "effect/Layer";
 *
 * const hosted = PartyModel.layer(PartyHandlers).pipe(
 *   Layer.provide(Layer.mergeAll(MemoryPartyDirectoryStore, Domain.InMemory)),
 * );
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const PartyHandlers = Layer.mergeAll(
  ClaimReviewLive,
  EffectivePartyLive,
  MergeOnSamePartyLive,
  ReviewOnAssertionLive,
  ReviewAssistLive,
  PartyDirectoryLive,
  FindPartiesLive,
);

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
  | Context.Service.Identifier<typeof PartyDirectoryStore>;

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
 * The model with its handlers, on no platform yet. Its requirements are the
 * ports and the host, and nothing else; the assertion below fails to compile
 * if a handler starts requiring anything more, and the error names the service.
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
 * The design's own sketch of the same law, kept to record what it proves.
 * `Layer`'s `RIn` is covariant, so this rejects a leak too; `never` for
 * `ROut` stands in for the sketch's `any`.
 *
 * @category ports
 * @since 0.0.0
 */
export const portPuritySatisfies = PartyHosted satisfies Layer.Layer<never, unknown, PartyPorts | Host>;
