import { AuthorityGateway } from "@proto/authority-contract/Authority.gateway";
import { Authority } from "@proto/party-model/Authority.external";
import * as Effect from "effect/Effect";

/**
 * Party's authority port over the authority context's gateway: re-admission
 * for every hop a policy or saga makes.
 *
 * @category adapters
 * @since 0.0.0
 */
export const PartyAuthority = Authority.toLayer(
  Effect.map(Effect.service(AuthorityGateway), (gateway) => ({ readmit: gateway.readmit })),
);
