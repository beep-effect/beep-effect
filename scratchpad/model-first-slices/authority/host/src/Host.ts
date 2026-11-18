import { AuthorityHosted } from "@proto/authority-model/Authority.ports";
import * as Layer from "effect/Layer";

/**
 * The authority model with its handlers, on the platform you give it:
 * `Domain.InMemory` in tests, `DomainCluster.layerEntities(...)` in a
 * deployment.
 *
 * **Gotchas**
 *
 * Its output includes the library's single `Model.Internals` service. Do not
 * merge it into one context with another hosted model whose Api you call in
 * process: the later model's internals win. Provide it to the `Session`
 * Layer instead, whose output is `Session` alone.
 *
 * **Example** (The boundary over an in-memory authority model)
 * ```ts
 * import * as Domain from "@alchemy.run/domain";
 * import { hostAuthority } from "@proto/authority-host/Host";
 * import { SessionLive } from "@proto/authority-host/Session.adapter";
 * import * as Layer from "effect/Layer";
 *
 * const session = SessionLive.pipe(Layer.provide(hostAuthority(Domain.InMemory)));
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const hostAuthority = <ROut, E, RIn>(platform: Layer.Layer<ROut, E, RIn>) =>
  AuthorityHosted.pipe(Layer.provide(platform));
