import * as Domain from "@alchemy.run/domain";
import { GrantIssued } from "@proto/authority-contract/Grant/IssueGrant.command";
import { GrantNarrowed } from "@proto/authority-contract/Grant/NarrowGrant.command";
import { Grant } from "./Grant.aggregate.ts";

/**
 * Whenever a grant's terms are set, arm its expiry as a scheduled deadline.
 *
 * @category policies
 * @since 0.0.0
 */
export class ExpireAtDeadline extends Domain.Policy(
  "ExpireAtDeadline",
  { from: Grant, on: [GrantIssued, GrantNarrowed] },
  { description: "Schedule ExpireGrant at a grant's expiry, re-armed when its terms narrow." },
) {}
