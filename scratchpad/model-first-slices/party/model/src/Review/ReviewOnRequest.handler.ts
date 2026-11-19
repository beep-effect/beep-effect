import { allows, ResourceScope } from "@proto/kernel/Capability";
import { byProcess, eventCause, extend, GrantRef } from "@proto/kernel/Invocation";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { RecordReviewRefused } from "@proto/party-contract/Claim/RecordReviewRefused.command";
import { ProposeDisposition } from "@proto/party-contract/Claim/ProposeDisposition.command";
import { PartyPropose } from "@proto/party-contract/Party.capabilities";
import * as A from "@beep/utils/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import { Authority } from "../Authority.external.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { ReviewAssist } from "./ReviewAssist.saga.ts";
import { ReviewOnRequest } from "./ReviewOnRequest.policy.ts";
import { ReviewPlan } from "./ReviewPlan.ts";
import { ReviewRuns } from "./ReviewRuns.external.ts";

/**
 * Re-admits the requester for this hop and picks the grant that lets them
 * have an agent propose on this claim. The run gets a delegation of it,
 * narrowed to `ProposeDisposition` on this claim alone, and a budget; then
 * the executor starts, keyed by the run. Any refusal is recorded on the claim.
 *
 * @category handlers
 * @since 0.0.0
 */
export const ReviewOnRequestLive = ReviewOnRequest.toLayer(
  Effect.gen(function* () {
    const claims = yield* Claim;
    const runs = yield* ReviewRuns;
    const reviews = yield* ReviewAssist;
    const authority = yield* Authority;
    return Effect.fn(function* (trigger) {
      const { event } = trigger;
      const hop = byProcess(ReviewOnRequest.policyName, eventCause(trigger));
      const claim = ClaimId.make(trigger.source.id);
      const scope = ResourceScope.cases.Record.make({ org: event.org, record: trigger.envelope.stream });
      const refuse = (reason: string) =>
        claims
          .send(claim, RecordReviewRefused.make({ run: event.run, reason, provenance: extend(event.provenance, hop) }))
          .pipe(Effect.asVoid);
      const now = yield* DateTime.now;
      yield* authority.readmit({ provenance: event.provenance, hop }).pipe(
        Effect.map((invocation) =>
          A.findFirst(
            invocation.grants,
            allows({ capability: PartyPropose, operation: ProposeDisposition.tag, resource: scope, at: now }),
          ),
        ),
        Effect.flatMap(
          O.match({
            onNone: () => refuse("no-propose-grant"),
            onSome: (source) =>
              runs
                .open({
                  provenance: event.provenance,
                  hop,
                  run: event.run,
                  session: `claim-review:${claim}`,
                  purpose: `Review ${claim}`,
                  versions: ReviewPlan.versions,
                  allowance: ReviewPlan.allowance,
                  historyBound: ReviewPlan.historyBound,
                  source: GrantRef.make({ grant: source.grant, delegation: source.delegation }),
                  terms: {
                    capability: PartyPropose.id,
                    operations: O.some([ProposeDisposition.tag]),
                    resource: scope,
                    expires: O.none(),
                  },
                })
                .pipe(
                  Effect.flatMap(({ provenance }) =>
                    reviews.start(event.run, {
                      claim,
                      proposition: event.proposition,
                      signals: event.signals,
                      evidenceRevision: event.evidenceRevision,
                      provenance,
                    }),
                  ),
                  Effect.asVoid,
                  Effect.catchTag("RunRefused", (refused) => refuse(`run:${refused.reason}`)),
                ),
          }),
        ),
        Effect.catchTag("ReadmissionRefused", (refused) => refuse(`readmission:${refused.reason}`)),
      );
    });
  }),
);
