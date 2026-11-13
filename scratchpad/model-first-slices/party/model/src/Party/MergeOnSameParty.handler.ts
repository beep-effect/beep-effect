import { CurrentInvocation } from "@proto/kernel/CurrentInvocation.context";
import { byProcess, eventCause, extend } from "@proto/kernel/Invocation";
import { MergeRefusal, RecordMergeRefused } from "@proto/party-contract/Claim/RecordMergeRefused.command";
import { MergeParties } from "@proto/party-contract/Party/MergeParties.command";
import { Proposition } from "@proto/party-contract/Proposition";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { Authority } from "../Authority.external.ts";
import { Claim } from "../Claim/Claim.aggregate.ts";
import { MergeOnSameParty } from "./MergeOnSameParty.policy.ts";
import { Party } from "./Party.aggregate.ts";

/**
 * Asks the authority context to re-admit the accepting provenance for this
 * hop, then sends `MergeParties` to the survivor under the invocation it
 * gets back. A refused re-admission, a veto or a missing grant is recorded
 * on the claim as `MergeRefused`, never dropped. Sends made while handling a
 * trigger get deterministic command ids, so a redelivered event applies once.
 *
 * @category handlers
 * @since 0.0.0
 */
export const MergeOnSamePartyLive = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const parties = yield* Party;
    const claims = yield* Claim;
    const authority = yield* Authority;
    return Effect.fn(function* (trigger) {
      const { event } = trigger;
      const accepted = event._tag === "ClaimAccepted" || event.outcome === "accepted";
      if (!accepted) return;
      const hop = byProcess(MergeOnSameParty.policyName, eventCause(trigger));
      const refusal = yield* Proposition.match(event.proposition, {
        SameParty: ({ survivor, absorbed }) =>
          authority.readmit({ provenance: event.provenance, hop }).pipe(
            Effect.flatMap((invocation) =>
              parties
                .send(survivor, new MergeParties({ absorbed }))
                .pipe(Effect.provideService(CurrentInvocation, invocation)),
            ),
            Effect.as(O.none<MergeRefusal>()),
            Effect.catchTags({
              ReadmissionRefused: (refused) =>
                Effect.succeed(O.some(MergeRefusal.cases.Readmission.make({ reason: refused.reason }))),
              MergeVetoed: (vetoed) => Effect.succeed(O.some(MergeRefusal.cases.Vetoed.make({ reason: vetoed.reason }))),
              MissingGrant: (missing) =>
                Effect.succeed(O.some(MergeRefusal.cases.MissingGrant.make({ capability: missing.capability }))),
            }),
          ),
        HasIdentifier: () => Effect.succeed(O.none<MergeRefusal>()),
      });
      yield* O.match(refusal, {
        onNone: () => Effect.void,
        onSome: (reason) =>
          claims
            .send(trigger.source, new RecordMergeRefused({ reason, provenance: extend(event.provenance, hop) }))
            .pipe(Effect.asVoid),
      });
    });
  }),
);
