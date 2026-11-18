import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import * as A from "@beep/utils/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as S from "effect/Schema";
import type * as Scope from "effect/Scope";
import { clients, eventually, fresh, get, human, issue, registration, runState, services } from "./Stack.ts";

// Backup and restore (D16), in two halves around `pg_dump`, destroy, deploy and restore, which
// the operator runs by hand (README). RESTORE_PHASE=before seeds and records; =after checks.
const Seeded = S.Struct({
  r: S.String,
  org: S.String,
  claim: S.String,
  party: S.String,
  partyReceipt: S.Struct({ stream: S.String, version: S.Int }),
  hold: S.String,
  claimView: S.NullOr(ClaimReviewState),
});
/** Where the before phase leaves what the after phase checks (`RESTORE_FILE`). */
const restoreFile = Config.String("RESTORE_FILE").pipe(Config.withDefault("/dev/null"));
const seededJson = S.fromJsonString(Seeded);
const proposition = Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" });
const signals = [
  EvidenceSignal.make({ source: "mailbox:intake", quote: "From: Dana <dana@acme.test>" }),
  EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" }),
];
/** A case against the deployed stack, with the stack's clients built into the case's scope. */
const live = <E>(name: string, body: Effect.Effect<void, E, Layer.Success<typeof services> | Scope.Scope>) =>
  it.live(name, () => Effect.flatMap(Layer.build(services), (context) => Effect.provideContext(body, context)), 600_000);

if (O.contains(registration.restorePhase, "before")) {
  live("restore, before: a run waits for approval, a party is registered, a hold's expiry is scheduled", Effect.gen(function* () {
    const r = yield* fresh("restore");
    const org = `org_${r}`;
    yield* issue(`g_intake_${r}`, "p_intake", "party.intake", org);
    yield* issue(`g_propose_${r}`, "p_intake", "party.propose", org);
    yield* issue(`g_review_${r}`, "p_rev", "party.review", org);
    yield* issue(`g_read_${r}`, "p_rev", "party.read", org);
    yield* Effect.sleep("2 seconds");
    const { intake, reviewer } = yield* clients;
    const claim = ClaimId.make(`claim_${r}`);
    yield* intake.AssertClaim(claim, { org: OrgId.make(org), proposition, signals }, human("p_intake"));
    yield* eventually(runState(`review:${claim}:1`), P.isTagged("AwaitingApproval"));
    const party = PartyId.make(`party_${r}`);
    const partyReceipt = yield* intake.RegisterParty(party, { org: OrgId.make(org), name: `Dana ${r}` }, { ...human("p_intake"), commandId: `reg_${r}` });
    yield* eventually(reviewer.FindParties({ org: OrgId.make(org), text: r }, human("p_rev")), (page) => page.entries.length === 1);
    const claimView = yield* reviewer.ClaimReview.get(claim, human("p_rev"));
    const hold = `hold_${r}`;
    yield* get(`/place/${hold}`);
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const text = yield* S.encodeEffect(seededJson)({
      r,
      org,
      claim,
      party,
      partyReceipt: { stream: partyReceipt.stream, version: partyReceipt.version },
      hold,
      claimView,
    });
    yield* fs.writeFileString(file, text);
  }));
}

if (O.contains(registration.restorePhase, "after")) {
  live("restore, after: aggregates, views, the directory, receipts, the waiting run and scheduled work", Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const file = yield* restoreFile;
    const stored = yield* fs.readFileString(file);
    const seeded = yield* S.decodeEffect(seededJson)(stored);
    const { intake, reviewer } = yield* clients;
    const org = OrgId.make(seeded.org);
    const claim = ClaimId.make(seeded.claim);
    // Aggregates and views: the claim reads as it did.
    const view = yield* reviewer.ClaimReview.get(claim, human("p_rev"));
    expect(view).toEqual(seeded.claimView);
    // The directory read model, in Postgres.
    const page = yield* reviewer.FindParties({ org, text: seeded.r }, human("p_rev"));
    expect(A.map(page.entries, (row) => row.partyId)).toEqual([seeded.party]);
    // Receipts: a retried id returns its stored result.
    const retried = yield* intake.RegisterParty(PartyId.make(seeded.party), { org, name: `Dana ${seeded.r}` }, { ...human("p_intake"), commandId: `reg_${seeded.r}` });
    expect({ stream: retried.stream, version: retried.version }).toEqual(seeded.partyReceipt);
    // Scheduled work: the hold's expiry, due while the stack was down, runs.
    const hold = yield* eventually(get<{ readonly status: string }>(`/hold/${seeded.hold}`), (h) => h.status === "expired", 60);
    expect(hold.status).toBe("expired");
    // The waiting run: approval completes it, through Party's fact and the runs inbox.
    yield* eventually(runState(`review:${claim}:1`), P.isTagged("AwaitingApproval"), 60);
    const { digest } = O.getOrThrow(O.flatMap(O.fromNullOr(seeded.claimView), proposalOf));
    yield* reviewer.ApproveProposal(claim, { digest, evidenceRevision: 1 }, human("p_rev"));
    const run = yield* eventually(runState(`review:${claim}:1`), P.isTagged("Completed"), 120);
    expect(run.outcome).toBe("accepted");
  }));
}
