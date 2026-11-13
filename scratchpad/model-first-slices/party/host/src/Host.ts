import { PartyHosted } from "@proto/party-model/Party.ports";
import * as Layer from "effect/Layer";
import { PartyAdapters } from "./Adapters.ts";

/**
 * The Party model with its handlers and its adapters, on the platform you
 * give it. The platform is the one Layer that changes: `Domain.InMemory` in
 * tests, `DomainCluster.layerEntities(...)` in a deployment. The adapters
 * are merged into the output so a host's own cluster classes reach the same
 * ports.
 *
 * **Gotchas**
 *
 * The `Session` middleware the Apis need is not here: the authority
 * context's host provides it, and the app composes the two. Its output
 * includes the library's single `Model.Internals` service, so do not merge it
 * into one context with another hosted model whose Api is called in process.
 *
 * **Example** (The model in memory, beside the authority boundary)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { hostParty } from "@proto/party-host/Host";
 *
 * const party = hostParty(Domain.InMemory);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const hostParty = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  PartyHosted.pipe(Layer.provideMerge(PartyAdapters), Layer.provide(platform));
