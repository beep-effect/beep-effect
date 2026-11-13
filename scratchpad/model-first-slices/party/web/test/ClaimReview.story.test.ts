import { it } from "@effect/vitest";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import type { ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { initial, Intent, Message, type Screen, update } from "@proto/party-web/Claim/ClaimReview.machine";
import { screenStory } from "./ScreenStory.ts";

const { intents, run: story, send, state } = screenStory(update);
const claim = ClaimId.make("claim_1");
const receipt = (version: number) => ({ stream: "Claim/claim_1", version });

const review = (status: ClaimReviewState["status"], withProposal = true): ClaimReviewState => ({
  org: OrgId.make("org_acme"),
  status,
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "d@acme.test" }),
  sources: 2,
  revision: 1,
  reviews: [RunId.make("review:claim_1:1")],
  proposal: withProposal
    ? { disposition: "accept", rationale: "two sources", run: RunId.make("review:claim_1:1"), evidenceRevision: 1, digest: "d1" }
    : null,
  notes: [],
});
const snapshot = (revision: number, epoch = 0, status: ClaimReviewState["status"] = "pending") =>
  Message.cases.Snapshot.make({ review: review(status), revision, epoch });
const approve = (commandId: string) => Intent.cases.Approve.make({ commandId, digest: "d1", evidenceRevision: 1 });
/** A screen that has seen the pending proposal at revision 3. */
const seen: Screen = { ...initial(claim), view: { review: review("pending"), revision: 3, epoch: 0 } };

it("Approve before any snapshot does nothing; after one, it sends one command with a fresh id", () => {
  story(
    initial(claim),
    send(Message.cases.ApproveClicked.make({ commandId: "c0" })),
    intents(),
    send(snapshot(3)),
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    intents(approve("c1")),
    state({ pending: { commandId: "c1", digest: "d1", evidenceRevision: 1, baseRevision: 3, attempts: 1, receipt: null } }),
  );
});

it("Astra's counterexample: a delayed snapshot after the command neither clears it nor lets a second one out", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    intents(approve("c1")),
    // The delayed first snapshot (older revision), and a reconnect's fresh one still showing pending.
    send(snapshot(1)),
    intents(),
    send(snapshot(4, 1)),
    state((screen) => {
      if (screen.pending?.commandId !== "c1") throw new Error("the approval in flight was cleared");
    }),
    send(Message.cases.ApproveClicked.make({ commandId: "c2" })),
    intents(),
    state({ pending: { commandId: "c1" } }),
  );
});

it("a late refusal for an older command does not clear a newer one", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Rejected.make({ commandId: "c1", reason: "ProposalMismatch" })),
    state({ pending: null, notice: { _tag: "Refused", commandId: "c1", reason: "ProposalMismatch" } }),
    send(Message.cases.ApproveClicked.make({ commandId: "c2" })),
    intents(approve("c2")),
    // c1's refusal delivered again, late.
    send(Message.cases.Rejected.make({ commandId: "c1", reason: "ProposalMismatch" })),
    send(Message.cases.Denied.make({ commandId: "c1", reason: "MissingGrant" })),
    state({ pending: { commandId: "c2" }, notice: null }),
  );
});

it("a duplicate reply is ignored", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Accepted.make({ commandId: "c1", receipt: receipt(7) })),
    intents(Intent.cases.ReadAfterWrite.make({ commandId: "c1", receipt: receipt(7) })),
    send(Message.cases.Accepted.make({ commandId: "c1", receipt: receipt(7) })),
    intents(),
    send(Message.cases.Unknown.make({ commandId: "c1" })),
    intents(),
    state({ pending: { commandId: "c1", attempts: 1, receipt: receipt(7) } }),
  );
});

it("a reconnect whose snapshot is not newer than the view is ignored", () => {
  story(
    seen,
    send(snapshot(5, 0)),
    send(snapshot(4, 1, "retracted")),
    state({ view: { review: review("pending"), revision: 5, epoch: 0 } }),
    send(snapshot(6, 1, "accepted")),
    state({ view: { review: review("accepted"), revision: 6, epoch: 1 } }),
  );
});

it("an accepted receipt and the view catching up are two separate moments", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Accepted.make({ commandId: "c1", receipt: receipt(7) })),
    // Committed, not yet seen: the approval is still in flight.
    state({ pending: { commandId: "c1", receipt: receipt(7) }, notice: null }),
    // The subscription shows the decision; that alone does not end the approval.
    send(snapshot(8, 0, "accepted")),
    state({ pending: { commandId: "c1" }, view: { review: review("accepted"), revision: 8, epoch: 0 } }),
    // The read that waited for the receipt returns: now the approval is done.
    send(Message.cases.CaughtUp.make({ commandId: "c1", review: review("accepted"), revision: 8 })),
    state({ pending: null, notice: { _tag: "Approved", commandId: "c1" } }),
  );
});

it("an unknown outcome retries with the same command id", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Unknown.make({ commandId: "c1" })),
    intents(approve("c1")),
    state({ pending: { commandId: "c1", attempts: 2 } }),
    send(Message.cases.Accepted.make({ commandId: "c1", receipt: receipt(7) })),
    intents(Intent.cases.ReadAfterWrite.make({ commandId: "c1", receipt: receipt(7) })),
  );
});
