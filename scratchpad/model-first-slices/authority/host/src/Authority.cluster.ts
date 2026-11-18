import { AuthorityApi } from "@proto/authority-model/AuthorityApi.api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { AuthorityGatewayLive } from "./AuthorityGateway.adapter.ts";
import { controlRoute } from "./Control.route.ts";
import { hostAuthority } from "./Host.ts";
import { SessionLive } from "./Session.adapter.ts";

/**
 * The authority context on a cluster (D13, D39): its model hosted on the
 * pool's platform, the gateway other contexts call through the pool's own
 * dispatch, the Session boundary, and its Apis for the front.
 *
 * **Details**
 *
 * `control` is the conformance-only route of `Control.route.ts`.
 *
 * @category cluster
 * @since 0.0.0
 */
export const AuthorityCluster = <ROut, E, R>(platform: Layer.Layer<ROut, E, R>) => {
  const hosted = hostAuthority(platform);
  return {
    parts: {
      AuthorityGateway: AuthorityGatewayLive.pipe(Layer.provide(hosted)),
      Session: SessionLive.pipe(Layer.provide(hosted)),
    },
    // Built into the caller's scope, not with `Effect.provide`: the Apis serve requests long after
    // this effect returns, so the hosted model's scope must stay open with the caller's (D39).
    apis: Effect.gen(function* () {
      const context = yield* Layer.build(Layer.merge(hosted, SessionLive.pipe(Layer.provide(hosted))));
      return yield* Effect.gen(function* () {
        const authority = (yield* AuthorityApi).fetch;
        const control = yield* controlRoute;
        return { authority, control };
      }).pipe(Effect.provideContext(context));
    }),
  };
};
