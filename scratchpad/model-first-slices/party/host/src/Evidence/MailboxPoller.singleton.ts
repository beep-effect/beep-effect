import * as Cluster from "@alchemy.run/effect-cluster";

/**
 * One poller across the whole cluster, however many runners there are. This
 * file is the name only; `MailboxPoller.handler.ts` implements it.
 *
 * @category cluster
 * @since 0.0.0
 */
export class MailboxPoller extends Cluster.Singleton<MailboxPoller>()("PartyMailboxPoller") {}
