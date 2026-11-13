import { type Actor, human } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { Session, Unauthorized } from "@proto/kernel/Session.middleware";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

/**
 * The live half of the kernel's `Session`: the actor a request is from, by
 * its `x-principal` and `x-org` headers.
 *
 * **Gotchas**
 *
 * Fixture only: anyone may claim any principal. A real host verifies a
 * signed session (a cookie, a bearer token) here before trusting it.
 *
 * **Example** (Serve an Api with header sessions)
 * ```ts
 * import { SessionLive } from "@proto/party-host/Session.middleware.live";
 *
 * const layer = SessionLive;
 * ```
 *
 * @category middleware
 * @since 0.0.0
 */
export const SessionLive = Layer.succeed(Session, (effect, { headers }) =>
  O.match(
    O.all({ principal: Headers.get(headers, "x-principal"), org: Headers.get(headers, "x-org") }),
    {
      onNone: () => Effect.fail(new Unauthorized()),
      onSome: ({ principal, org }) => Effect.provideService(effect, CurrentActor, human(principal, org)),
    },
  ),
);

/**
 * A `Session` that trusts its caller and acts as the given actor. For
 * in-process callers that already know who they are (a poller acting as the
 * system); provide it to that caller's client only.
 *
 * **Example** (A poller's client, acting as the system)
 * ```ts
 * import { system } from "@proto/kernel/Actor";
 * import { sessionAs } from "@proto/party-host/Session.middleware.live";
 *
 * const asPoller = sessionAs(system("MailboxPoller", "org_acme"));
 * ```
 *
 * @category middleware
 * @since 0.0.0
 */
export const sessionAs = (actor: Actor) =>
  Layer.succeed(Session, (effect) => Effect.provideService(effect, CurrentActor, actor));
