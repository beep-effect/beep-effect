import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
import { PrincipalId } from "@proto/kernel/Ids";
import { mailboxPollerLive } from "@proto/party-host/Evidence/MailboxPoller.handler";
import { IntakeApi } from "@proto/party-model/IntakeApi.api";
import * as Layer from "effect/Layer";
import { Default } from "../Cluster.ts";
import PartyLive from "./Party.ts";
import SessionLive from "./Session.ts";

/** The org whose intake mailbox this deployment polls, and the human the poller acts for. */
const org = "org_practice";
const desk = PrincipalId.make("p_intake_desk");

/**
 * Entry module: the mailbox poller, one across the cluster. It reaches the
 * Party model only through `IntakeApi`, presenting a process credential the
 * boundary admits as acting for the intake desk's human.
 *
 * @category entry
 * @since 0.0.0
 */
export default mailboxPollerLive({
  main: import.meta.url,
  mailbox: "intake",
  org,
  credential: headersFor(Credential.cases.Process.make({ process: "MailboxPoller", principal: desk })),
}).pipe(
  // The client runs the real Session; the hosted model also gives the poller its ContactSource port.
  Layer.provide(IntakeApi.layerClientInProcess.pipe(Layer.provide(SessionLive), Layer.provideMerge(PartyLive))),
  // The pool is provided to the class's Layer, so the runners host it.
  Layer.provide(Default),
);
