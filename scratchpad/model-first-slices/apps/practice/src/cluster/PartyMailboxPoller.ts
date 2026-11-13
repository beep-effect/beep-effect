import { intakeAsPoller, mailboxPollerLive } from "@proto/party-host/Evidence/MailboxPoller.singleton.live";
import * as Layer from "effect/Layer";
import { Default } from "../Cluster.ts";
import PartyLive from "./Party.ts";

/** The org whose intake mailbox this deployment polls. */
const org = "org_practice";

/**
 * Entry module: the mailbox poller, one across the cluster. It reaches the
 * Party model only through `IntakeApi`, acting as the system, over the same
 * hosted Layer the Party entry module exports.
 *
 * @category entry
 * @since 0.0.0
 */
export default mailboxPollerLive({ main: import.meta.url, mailbox: "intake", org }).pipe(
  Layer.provide(intakeAsPoller(org).pipe(Layer.provideMerge(PartyLive))),
  // The pool is provided to the class's Layer, so the runners host it.
  Layer.provide(Default),
);
