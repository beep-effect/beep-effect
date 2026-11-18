// Temporary: the design's sketch forms, verbatim where possible, to record what the library rejects.
import { Story } from "@alchemy.run/domain/Story";
import { system } from "@proto/kernel/Actor";
import { CurrentActor } from "@proto/kernel/CurrentActor.context";
import { AcceptClaim } from "@proto/party/Claim/AcceptClaim.command";
import { Claim } from "@proto/party/Claim/Claim.aggregate";
import { ProposeDisposition } from "@proto/party/Claim/ProposeDisposition.command";
import { MergeParties } from "@proto/party/Party/MergeParties.command";
import { MergeOnSameParty } from "@proto/party/Party/MergeOnSameParty.policy";
import { Party } from "@proto/party/Party/Party.aggregate";
import { Reasoner } from "@proto/party/Review/Reasoner.external";
import { ReviewAssist } from "@proto/party/Review/ReviewAssist.saga";
import { MailboxPoller } from "@proto/party-host/Evidence/MailboxPoller.singleton";
import * as Effect from "effect/Effect";
import * as Activity from "effect/workflow/Activity";

// (a) policy handler sends a Session-guarded command without providing CurrentActor
export const PolicyNoActor = MergeOnSameParty.toLayer(
  Effect.gen(function* () {
    const parties = yield* Party;
    return Effect.fn(function* ({ event }) {
      if (event.proposition._tag !== "SameParty") return;
      yield* parties
        .send(event.proposition.survivor, new MergeParties({ absorbed: event.proposition.absorbed }))
        .pipe(Effect.catchTag("MergeVetoed", () => Effect.void));
    });
  }),
);

// (d) saga "propose" step with no error schema and the receipt as its value
export const SagaNoErrorSchema = Effect.gen(function* () {
  const claims = yield* Claim;
  return yield* Activity.make({
    name: "propose",
    execute: claims
      .send("claim_1" as never, new ProposeDisposition({ disposition: "accept", rationale: "x" }))
      .pipe(Effect.provideService(CurrentActor, system("x", "org"))),
  });
});

// (f) Completed status without `result`
export const completed = Story.saga(ReviewAssist, Claim.ref("claim_1").id, { _tag: "Completed" });

// (u) yield a name-only singleton in a stack
export const yieldSingleton = Effect.gen(function* () {
  yield* MailboxPoller;
});

// (b) the design's PartyPorts with class names as types
type SketchPorts = Reasoner;
export const reasonerKeyIsClass: SketchPorts = null as never as import("effect/Context").Service.Identifier<typeof Reasoner>;
export const _unused = AcceptClaim;
