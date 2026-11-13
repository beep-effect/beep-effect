import { ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import { ClaimFacts } from "./ClaimFacts.projection.ts";
import { PartyFacts } from "./PartyFacts.stream.ts";

/**
 * Appends both published versions for each decision. The fact id is the
 * claim's (a claim is decided once), so it is stable across redelivery and
 * rebuilds.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ClaimFactsLive = ClaimFacts.toLayer(
  Effect.gen(function* () {
    const facts = yield* PartyFacts;
    return Effect.fn(function* (batch) {
      for (const input of batch) {
        const org = input.state?.org ?? null;
        if (org === null) continue;
        const claim = ClaimId.make(input.source.id);
        const decided = Match.value(input.event).pipe(
          Match.tagsExhaustive({
            ClaimAccepted: () => ({ decision: "accepted" as const, basis: "direct" as const, approval: null }),
            ClaimRetracted: () => ({ decision: "retracted" as const, basis: "direct" as const, approval: null }),
            ProposalApproved: (approved) => ({
              decision: approved.outcome,
              basis: "approval" as const,
              approval: approved.approval,
            }),
          }),
        );
        const common = { factId: `${claim}:decided`, claim, org, reviewRuns: input.state?.reviews ?? [] };
        yield* facts.append(
          input,
          new ClaimDecidedV1({ ...common, outcome: decided.decision }),
          new ClaimDecidedV2({ ...common, ...decided }),
        );
      }
    });
  }),
);
