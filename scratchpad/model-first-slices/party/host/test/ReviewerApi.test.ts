import * as Domain from "@alchemy.run/domain";
import { expect, it } from "@effect/vitest";
import { ClaimId } from "@proto/party/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party/Evidence";
import { IntakeApi } from "@proto/party/IntakeApi.api";
import { PartyId } from "@proto/party/Party/Party.id";
import { Proposition } from "@proto/party/Proposition";
import { ReviewerApi } from "@proto/party/ReviewerApi.api";
import { hostParty } from "@proto/party-host/Host";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

// The same model and handlers the stories run, with fixture adapters, the real
// Session middleware, and memory for the platform.
const World = hostParty(Domain.InMemory);

const session = (principal: string, org: string) => ({ "x-principal": principal, "x-org": org });
const acmeIntake = session("p_intake", "org_acme");
const acmeReviewer = session("p_rev", "org_acme");
const globexReviewer = session("p_eve", "org_globex");

const claimId = ClaimId.make("claim_http_1");
const dana = PartyId.make("party_dana");
const duplicate = PartyId.make("party_dup");
const sameParty = Proposition.cases.SameParty.make({ survivor: dana, absorbed: duplicate });
const twoSources = [
  EvidenceSignal.make({ source: "mailbox:intake", excerpt: "Dana Smith is D. Smith" }),
  EvidenceSignal.make({ source: "crm", excerpt: "same phone number" }),
];

it.live("the owner org may accept a claim; another org is refused", () =>
  Effect.gen(function* () {
    const intake = yield* IntakeApi.clientInProcess;
    const reviewer = yield* ReviewerApi.clientInProcess;

    const registered = [
      yield* intake.RegisterParty(dana, { name: "Dana Smith" }, { headers: acmeIntake }),
      yield* intake.RegisterParty(duplicate, { name: "D. Smith" }, { headers: acmeIntake }),
    ];
    const asserted = yield* intake.AssertClaim(
      claimId,
      { proposition: sameParty, signals: twoSources },
      { headers: acmeIntake },
    );

    // Another org can neither decide the claim nor read it. The read waits for
    // the assertion: a view that has not caught up reads as empty, and an empty
    // view has no org to refuse on.
    const refusedAccept = yield* reviewer.AcceptClaim(claimId, {}, { headers: globexReviewer }).pipe(Effect.flip);
    expect(refusedAccept._tag).toBe("NotAMember");
    const refusedRead = yield* reviewer.ClaimReview.get(claimId, { headers: globexReviewer, atLeast: asserted })
      .pipe(Effect.flip);
    expect(refusedRead._tag).toBe("NotAMember");

    // No session at all.
    const anonymous = yield* reviewer.AcceptClaim(claimId).pipe(Effect.flip);
    expect(anonymous._tag).toBe("Unauthorized");

    // The owner org accepts; the receipt lets the read wait for that write.
    const accepted = yield* reviewer.AcceptClaim(claimId, {}, { headers: acmeReviewer });
    const review = yield* reviewer.ClaimReview.get(claimId, { headers: acmeReviewer, atLeast: accepted });
    expect(review).toMatchObject({ status: "accepted", org: "org_acme" });

    // The merge policy ran on the accept; the party view shows it once it lands.
    const merged = yield* reviewer.EffectiveParty.get(dana, { headers: acmeReviewer }).pipe(
      Effect.repeat({
        schedule: Schedule.spaced("25 millis"),
        until: (party) => (party?.absorbed.length ?? 0) > 0,
        times: 80,
      }),
    );
    expect(merged).toMatchObject({ name: "Dana Smith", absorbed: [duplicate] });

    // The directory query is scoped to the caller's org; `atLeast` waits for the projection.
    const acmeRows = yield* reviewer.FindParties({ text: "smith" }, { headers: acmeReviewer, atLeast: registered });
    expect(acmeRows.entries.map((row) => row.partyId)).toEqual([dana, duplicate]);
    const globexRows = yield* reviewer.FindParties({ text: "smith" }, { headers: globexReviewer, atLeast: registered });
    expect(globexRows.entries).toEqual([]);
  }).pipe(Effect.scoped, Effect.provide(World)),
);
