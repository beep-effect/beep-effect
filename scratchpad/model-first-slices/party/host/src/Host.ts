import { PartyHosted } from "@proto/party-model/Party.ports";
import type { PartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import { PartyAdapters } from "./Adapters.ts";

const hostPartyOn = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>, directory: Layer.Layer<PartyDirectoryStore>) =>
  PartyHosted.pipe(Layer.provideMerge(PartyAdapters), Layer.provide(directory), Layer.provide(platform));

/** The hosted Party model on a platform: what {@link hostParty} returns. */
type Hosted<ROut, E, RIn> = ReturnType<typeof hostPartyOn<ROut, E, RIn>>;

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
 * import { MemoryPartyDirectoryStore } from "@proto/party-model/Directory/PartyDirectory.store";
 * import { pipe } from "effect/Function";
 *
 * const party = hostParty(Domain.InMemory, MemoryPartyDirectoryStore);
 * const same = pipe(Domain.InMemory, hostParty(MemoryPartyDirectoryStore));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const hostParty: {
  (directory: Layer.Layer<PartyDirectoryStore>): <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) => Hosted<ROut, E, RIn>;
  <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>, directory: Layer.Layer<PartyDirectoryStore>): Hosted<ROut, E, RIn>;
} = dual(2, hostPartyOn);
