import { PartyHandlers } from "@proto/party/Handlers";
import { PartyModel } from "@proto/party/Party.model";
import * as Layer from "effect/Layer";
import { PartyAdapters } from "./Adapters.ts";
import { SessionLive } from "./Session.middleware.live.ts";

/**
 * The Party model with its handlers, its adapters and the Session middleware
 * its Apis need, on the platform you give it. The platform is the one Layer
 * that changes: `Domain.InMemory` in tests, `DomainCluster.layerEntities(...)`
 * in a deployment. The adapters are merged into the output so a host's own
 * cluster classes reach the same ports.
 *
 * **Example** (The model in memory, for an Api test)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { hostParty } from "@proto/party-host/Host";
 *
 * const World = hostParty(Domain.InMemory);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const hostParty = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  SessionLive.pipe(
    Layer.provideMerge(PartyModel.layer(PartyHandlers)),
    Layer.provideMerge(PartyAdapters),
    Layer.provide(platform),
  );
