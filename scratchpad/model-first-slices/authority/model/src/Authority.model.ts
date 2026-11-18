import * as Domain from "@alchemy.run/domain";
import { Accountability } from "./Accountability/Accountability.aggregate.ts";
import { Delegation } from "./Delegation/Delegation.aggregate.ts";
import { OpenOnDelegate } from "./Delegation/OpenOnDelegate.policy.ts";
import { RunDelegations } from "./Delegation/RunDelegations.view.ts";
import { ExpireAtDeadline } from "./Grant/ExpireAtDeadline.policy.ts";
import { Grant } from "./Grant/Grant.aggregate.ts";
import { HolderGrants } from "./Grant/HolderGrants.view.ts";

/**
 * The authority context: who may do what, for whom, and who answers for an
 * agent. It grants capabilities by id and imports no context that declares
 * them. Its host is the trusted boundary that builds invocations.
 *
 * @category models
 * @since 0.0.0
 */
export class AuthorityModel extends Domain.Model(
  "Authority",
  {
    aggregates: [Grant, Delegation, Accountability],
    views: [HolderGrants, RunDelegations],
    policies: [ExpireAtDeadline, OpenOnDelegate],
  },
  { description: "Grants, their delegations to agent runs, and the humans accountable for those runs." },
) {}
