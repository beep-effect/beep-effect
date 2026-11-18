import { it } from "@effect/vitest";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import type { ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { Approval, initial, Intent, Message, type Screen, update } from "@proto/party-web/Claim/ClaimReview.machine";
import * as O from "@beep/utils/Option";
import { screenStory } from "./ScreenStory.ts";

const { intents, run: story, send, state } = screenStory(update);
const claim = ClaimId.make("claim_1");
const receipt = (version: number) => ({ stream: "Claim/claim_1", version });

type Standing = "Pending" | "Accepted" | "Retracted";
const review = (standing: Standing, withProposal = true): ClaimReviewState => ({
  _tag: standing,
  org: OrgId.make("org_acme"),
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "d@acme.test" }),
  sources: 2,
  revision: 1,
  reviews: [RunId.make("review:claim_1:1")],
  proposal: withProposal
    ? O.some({ disposition: "accept", rationale: "two sources", run: RunId.make("review:claim_1:1"), evidenceRevision: 1, digest: "d1" })
    : O.none(),
  notes: [],
});
const snapshot = (revision: number, epoch = 0, standing: Standing = "Pending") =>
  Message.cases.Snapshot.make({ review: O.some(review(standing)), revision, epoch });
const approve = (commandId: string) => Intent.cases.Approve.make({ commandId, digest: "d1", evidenceRevision: 1 });
/** A screen that has seen the pending proposal at revision 3. */
const seen: Screen = { ...initial(claim), view: O.some({ review: O.some(review("Pending")), revision: 3, epoch: 0 }) };

it("Approve before any snapshot does nothing; after one, it sends one command with a fresh id", () => {
  story(
    initial(claim),
    send(Message.cases.ApproveClicked.make({ commandId: "c0" })),
    intents(),
    send(snapshot(3)),
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    intents(approve("c1")),
    state({ approval: { _tag: "Sending", commandId: "c1", digest: "d1", evidenceRevision: 1, baseRevision: 3, attempts: 1 } }),
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
      if (!Approval.guards.Sending(screen.approval) || screen.approval.commandId !== "c1") {
        throw new Error("the approval in flight was cleared");
      }
    }),
    send(Message.cases.ApproveClicked.make({ commandId: "c2" })),
    intents(),
    state({ approval: { _tag: "Sending", commandId: "c1" } }),
  );
});

it("a late refusal for an older command does not clear a newer one", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Rejected.make({ commandId: "c1", reason: "ProposalMismatch" })),
    state({ approval: { _tag: "Noticed", notice: { _tag: "Refused", commandId: "c1", reason: "ProposalMismatch" } } }),
    send(Message.cases.ApproveClicked.make({ commandId: "c2" })),
    intents(approve("c2")),
    // c1's refusal delivered again, late.
    send(Message.cases.Rejected.make({ commandId: "c1", reason: "ProposalMismatch" })),
    send(Message.cases.Denied.make({ commandId: "c1", reason: "MissingGrant" })),
    state({ approval: { _tag: "Sending", commandId: "c2" } }),
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
    state({ approval: { _tag: "Committed", commandId: "c1", attempts: 1, receipt: receipt(7) } }),
  );
});

it("a reconnect whose snapshot is not newer than the view is ignored", () => {
  story(
    seen,
    send(snapshot(5, 0)),
    send(snapshot(4, 1, "Retracted")),
    state({ view: O.some({ review: O.some(review("Pending")), revision: 5, epoch: 0 }) }),
    send(snapshot(6, 1, "Accepted")),
    state({ view: O.some({ review: O.some(review("Accepted")), revision: 6, epoch: 1 }) }),
  );
});

it("an accepted receipt and the view catching up are two separate moments", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Accepted.make({ commandId: "c1", receipt: receipt(7) })),
    // Committed, not yet seen: the approval is still in flight.
    state({ approval: { _tag: "Committed", commandId: "c1", receipt: receipt(7) } }),
    // The subscription shows the decision; that alone does not end the approval.
    send(snapshot(8, 0, "Accepted")),
    state({ approval: { _tag: "Committed", commandId: "c1" }, view: O.some({ review: O.some(review("Accepted")), revision: 8, epoch: 0 }) }),
    // The read that waited for the receipt returns: now the approval is done.
    send(Message.cases.CaughtUp.make({ commandId: "c1", review: O.some(review("Accepted")), revision: 8 })),
    state({ approval: { _tag: "Noticed", notice: { _tag: "Approved", commandId: "c1" } } }),
  );
});

it("an unknown outcome retries with the same command id", () => {
  story(
    seen,
    send(Message.cases.ApproveClicked.make({ commandId: "c1" })),
    send(Message.cases.Unknown.make({ commandId: "c1" })),
    intents(approve("c1")),
    state({ approval: { _tag: "Sending", commandId: "c1", attempts: 2 } }),
    send(Message.cases.Accepted.make({ commandId: "c1", receipt: receipt(7) })),
    intents(Intent.cases.ReadAfterWrite.make({ commandId: "c1", receipt: receipt(7) })),
  );
});
