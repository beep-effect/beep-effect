import * as Domain from "@alchemy.run/domain";
import "@proto/kernel/Audience";
import { OrgId } from "@proto/kernel/Ids";
import { NotAMember } from "@proto/kernel/NotAMember.rejection";
import { Session } from "@proto/kernel/Session.middleware";
import * as S from "effect/Schema";
import { Proposition } from "../Proposition.ts";
import { Claim, Proposal } from "./Claim.aggregate.ts";

/**
 * One claim as a reviewer sees it: its proposition, the agent's proposal if
 * any, and where it stands. Readable only inside the claim's org.
 *
 * @category views
 * @since 0.0.0
 */
export class ClaimReview extends Domain.View(
  "ClaimReview",
  {
    from: [Claim],
    key: Claim,
    middleware: [Session],
    rejects: [NotAMember],
    state: S.Struct({
      org: S.NullOr(OrgId),
      status: S.Literals(["unasserted", "pending", "accepted", "retracted"]),
      proposition: S.NullOr(Proposition),
      sources: S.Int,
      proposal: S.NullOr(Proposal),
    }),
    initial: { org: null, status: "unasserted", proposition: null, sources: 0, proposal: null },
    evolve: {
      ClaimAsserted: (view, event) => ({
        ...view,
        org: event.by.org,
        status: "pending" as const,
        proposition: event.proposition,
        sources: event.signals.length,
      }),
      DispositionProposed: (view, event) => ({
        ...view,
        proposal: { disposition: event.disposition, rationale: event.rationale, by: event.by },
      }),
      ClaimAccepted: (view) => ({ ...view, status: "accepted" as const }),
      ClaimRetracted: (view) => ({ ...view, status: "retracted" as const }),
    },
  },
  { description: "One claim as a reviewer sees it: the proposition, the agent's proposal, and its status.", audience: "reviewer" },
) {}
