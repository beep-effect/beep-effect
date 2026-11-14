import { expect, it } from "@effect/vitest";
import { OrgId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { EvidenceSignal } from "@proto/party-contract/Evidence";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { clients, eventually, fresh, get, human, issue, runState, services } from "./Stack.ts";

// Backup and restore (D16), in two halves around `pg_dump`, destroy, deploy and restore, which
// the operator runs by hand (README). RESTORE_PHASE=before seeds and records; =after checks.
const Seeded = S.Struct({
  r: S.String,
  org: S.String,
  claim: S.String,
  party: S.String,
  partyReceipt: S.Struct({ stream: S.String, version: S.Int }),
  hold: S.String,
  claimView: S.Unknown,
});
const file = process.env.RESTORE_FILE ?? "/dev/null";
const proposition = Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "dana@acme.test" });
const signals = [
  EvidenceSignal.make({ source: "mailbox:intake", quote: "From: Dana <dana@acme.test>" }),
  EvidenceSignal.make({ source: "crm", quote: "dana@acme.test on file" }),
];
const live = (name: string, body: Effect.Effect<void, unknown, unknown>) =>
  it.live(name, () => body.pipe(Effect.scoped, Effect.provide(services)) as Effect.Effect<void, unknown>, 600_000);

if (process.env.RESTORE_PHASE === "before") {
  live("restore, before: a run waits for approval, a party is registered, a hold's expiry is scheduled", Effect.gen(function* () {
    const r = fresh("restore");
    const org = `org_${r}`;
    yield* issue(`g_intake_${r}`, "p_intake", "party.intake", org);
    yield* issue(`g_propose_${r}`, "p_intake", "party.propose", org);
    yield* issue(`g_review_${r}`, "p_rev", "party.review", org);
    yield* issue(`g_read_${r}`, "p_rev", "party.read", org);
    yield* Effect.sleep("2 seconds");
    const { intake, reviewer } = yield* clients;
    const claim = ClaimId.make(`claim_${r}`);
    yield* intake.AssertClaim(claim, { org: OrgId.make(org), proposition, signals }, human("p_intake"));
    yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "AwaitingApproval");
    const party = PartyId.make(`party_${r}`);
    const partyReceipt = yield* intake.RegisterParty(party, { org: OrgId.make(org), name: `Dana ${r}` }, { ...human("p_intake"), commandId: `reg_${r}` });
    yield* eventually(reviewer.FindParties({ org: OrgId.make(org), text: r }, human("p_rev")), (page) => page.entries.length === 1);
    const claimView = yield* reviewer.ClaimReview.get(claim, human("p_rev"));
    const hold = `hold_${r}`;
    yield* get(`/place/${hold}`);
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(
      file,
      JSON.stringify(S.encodeSync(Seeded)({ r, org, claim, party, partyReceipt: { stream: partyReceipt.stream, version: partyReceipt.version }, hold, claimView })),
    );
  }));
}

if (process.env.RESTORE_PHASE === "after") {
  live("restore, after: aggregates, views, the directory, receipts, the waiting run and scheduled work", Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const seeded = S.decodeUnknownSync(S.fromJsonString(Seeded))(yield* fs.readFileString(file));
    const { intake, reviewer } = yield* clients;
    const org = OrgId.make(seeded.org);
    const claim = ClaimId.make(seeded.claim);
    // Aggregates and views: the claim reads as it did.
    const view = yield* reviewer.ClaimReview.get(claim, human("p_rev"));
    expect(view).toEqual(seeded.claimView);
    // The directory read model, in Postgres.
    const page = yield* reviewer.FindParties({ org, text: seeded.r }, human("p_rev"));
    expect(page.entries.map((row) => row.partyId)).toEqual([seeded.party]);
    // Receipts: a retried id returns its stored result.
    const retried = yield* intake.RegisterParty(PartyId.make(seeded.party), { org, name: `Dana ${seeded.r}` }, { ...human("p_intake"), commandId: `reg_${seeded.r}` });
    expect({ stream: retried.stream, version: retried.version }).toEqual(seeded.partyReceipt);
    // Scheduled work: the hold's expiry, due while the stack was down, runs.
    const hold = yield* eventually(get<{ readonly status: string }>(`/hold/${seeded.hold}`), (h) => h.status === "expired", 60);
    expect(hold.status).toBe("expired");
    // The waiting run: approval completes it, through Party's fact and the runs inbox.
    yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "AwaitingApproval", 60);
    const proposal = (seeded.claimView as { readonly proposal: { readonly digest: string } }).proposal;
    yield* reviewer.ApproveProposal(claim, { digest: proposal.digest, evidenceRevision: 1 }, human("p_rev"));
    const run = yield* eventually(runState(`review:${claim}:1`), (s) => s._tag === "Completed", 120);
    expect(run.outcome).toBe("accepted");
  }));
}
