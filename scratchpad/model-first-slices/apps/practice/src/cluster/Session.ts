import { SessionLive } from "@proto/authority-host/Session.adapter";
import * as Layer from "effect/Layer";
import AuthorityLive from "./Authority.ts";

/**
 * The trusted boundary over the hosted authority model. Its output is the
 * `Session` middleware alone, so the authority model's internals never meet
 * another model's in one context.
 *
 * @category entry
 * @since 0.0.0
 */
export default SessionLive.pipe(Layer.provide(AuthorityLive));
