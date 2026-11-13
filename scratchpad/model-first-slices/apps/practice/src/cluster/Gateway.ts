import { AuthorityGatewayLive } from "@proto/authority-host/AuthorityGateway.adapter";
import * as Layer from "effect/Layer";
import AuthorityLive from "./Authority.ts";

/**
 * The authority context's gateway over its hosted model: how the other
 * contexts' hosts re-admit a hop and grant a run. Its output is the gateway
 * alone.
 *
 * @category entry
 * @since 0.0.0
 */
export default AuthorityGatewayLive.pipe(Layer.provide(AuthorityLive));
