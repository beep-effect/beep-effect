import type { OrgId, RunId } from "@proto/kernel/Ids";
import type { ClaimAccepted } from "@proto/party-contract/Claim/AcceptClaim.command";
import type { ProposalApproved } from "@proto/party-contract/Claim/ApproveProposal.command";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import type { ClaimRetracted } from "@proto/party-contract/Claim/RetractClaim.command";
import { ClaimDecidedV1, ClaimDecidedV2 } from "@proto/party-contract/Facts/ClaimDecided.fact";
import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "@beep/utils/Option";
import { Claim, ClaimState } from "../Claim/Claim.aggregate.ts";
import { ClaimDecisions } from "./ClaimDecisions.projection.ts";
import { PartyFacts } from "./PartyFacts.stream.ts";
import { PartyFacts2 } from "./PartyFacts2.stream.ts";

type Decision = ClaimAccepted | ClaimRetracted | ProposalApproved;

type Scope = { readonly org: OrgId; readonly reviewRuns: ReadonlyArray<RunId> };

/** The version `ClaimDecisions` runs at. Bumping it rebuilds the projection, so it needs a new stream generation first (`StreamPins.ts`). */
export const ClaimDecisionsVersion = 0;

const decisionOf = Match.type<Decision>().pipe(
  Match.tagsExhaustive({
    ClaimAccepted: () => ({ decision: "accepted" as const, basis: "direct" as const, approval: O.none() }),
    ClaimRetracted: () => ({ decision: "retracted" as const, basis: "direct" as const, approval: O.none() }),
    ProposalApproved: (approved) => ({
      decision: approved.outcome,
      basis: "approval" as const,
      approval: O.some(approved.approval),
    }),
  }),
);

/** The review runs a decision event names by itself: the approved run, for an approval. */
const runsNamedBy = Match.type<Decision>().pipe(
  Match.tag("ProposalApproved", (approved): ReadonlyArray<RunId> => [approved.run]),
  Match.orElse((): ReadonlyArray<RunId> => []),
);

const orgOf = (state: ClaimState): O.Option<OrgId> =>
  ClaimState.match(state, {
    Unasserted: O.none<OrgId>,
    Pending: (pending) => O.some(pending.org),
    Accepted: (accepted) => O.some(accepted.org),
    Retracted: (retracted) => O.some(retracted.org),
  });

/**
 * The publisher at `version`. `ClaimDecisionsLive` is the deployed one; the
 * stream-pin test builds a bumped one to show the checker refuses it.
 *
 * **Details**
 *
 * Every fact is built from the decision event. A decision stored before
 * phase 9 has no scope (`DecisionScope`): its scope is what generation 1
 * published for the same fact id, which is what consumers were told. A
 * decision generation 1 never published (decided under the old code, its
 * delivery still pending when the code changed) takes its org from the
 * claim's state, which keeps the org, and only the review runs its event
 * names; that case is logged as an error, since an upgrade that drains the
 * old publisher first (D47) never reaches it.
 *
 * **Example** (The deployed publisher)
 * ```ts
 * import { claimDecisionsLive, ClaimDecisionsVersion } from "@proto/party-model/Facts/ClaimDecisions.handler";
 *
 * const layer = claimDecisionsLive(ClaimDecisionsVersion);
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const claimDecisionsLive = (version: number) =>
  ClaimDecisions.toLayer(
    Effect.gen(function* () {
      const facts = yield* PartyFacts2;
      const closed = yield* PartyFacts;
      const claims = yield* Claim;

      const legacyScope = Effect.fn("ClaimDecisions.legacyScope")(function* (claim: ClaimId, factId: string, event: Decision) {
        const published = yield* closed.list("claims", { where: { factId }, take: 1 }).pipe(Effect.map((page) => A.head(page.entries)));
        if (O.isSome(published)) {
          return { org: published.value.event.org, reviewRuns: published.value.event.reviewRuns } satisfies Scope;
        }
        const org = yield* claims.get(claim).pipe(
          Effect.map(orgOf),
          // A decision event exists, so the claim was asserted and has an org.
          Effect.flatMap(O.match({ onNone: () => Effect.die(`ClaimDecisions: ${claim} is decided but has no org`), onSome: Effect.succeed })),
        );
        // An upgrade drains the old publisher first (D47), so this is unreachable there: an error.
        yield* Effect.logError(`ClaimDecisions: ${factId} was decided before phase 9 and never published; its review runs are the ones its event names`);
        return { org, reviewRuns: runsNamedBy(event) } satisfies Scope;
      });

      return Effect.fn(function* (batch) {
        for (const input of batch) {
          const claim = ClaimId.make(input.source.id);
          const factId = `${claim}:decided`;
          const scope = yield* O.match(O.all({ org: input.event.org, reviewRuns: input.event.reviewRuns }), {
            onNone: () => legacyScope(claim, factId, input.event),
            onSome: Effect.succeed,
          });
          const decided = decisionOf(input.event);
          const common = { factId, claim, ...scope };
          yield* facts.append(
            input,
            ClaimDecidedV1.make({ ...common, outcome: decided.decision }),
            ClaimDecidedV2.make({ ...common, ...decided }),
          );
        }
      });
    }),
    { version },
  );

/**
 * Appends both published versions for each decision to generation 2. The
 * fact id is the claim's (a claim is decided once), so it is stable across
 * redelivery, rebuilds and generations.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ClaimDecisionsLive = claimDecisionsLive(ClaimDecisionsVersion);
