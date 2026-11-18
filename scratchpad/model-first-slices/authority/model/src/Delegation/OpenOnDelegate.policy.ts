import * as Domain from "@alchemy.run/domain";
import { DelegationExtended } from "@proto/authority-contract/Delegation/DelegateFurther.command";
import { GrantDelegated } from "@proto/authority-contract/Grant/DelegateGrant.command";
import { Grant } from "../Grant/Grant.aggregate.ts";
import { Delegation } from "./Delegation.aggregate.ts";

/**
 * When a holder delegates a grant, or a run delegates its delegation
 * further, open the new delegation for the receiving run.
 *
 * @category policies
 * @since 0.0.0
 */
export class OpenOnDelegate extends Domain.Policy(
  "OpenOnDelegate",
  { from: [Grant, Delegation], on: [GrantDelegated, DelegationExtended] },
  { description: "Open the Delegation a GrantDelegated or DelegationExtended names, with the terms its parent checked." },
) {}
