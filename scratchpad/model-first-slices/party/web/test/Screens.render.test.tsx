// @vitest-environment happy-dom
import { RegistryProvider } from "@effect/atom-react";
import { expect, it } from "@effect/vitest";
import { OrgId, RunId } from "@proto/kernel/Ids";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import type { ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { PartyId } from "@proto/party-contract/Party/Party.id";
import { Proposition } from "@proto/party-contract/Proposition";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import { ClaimReviewScreen } from "@proto/party-web/Claim/ClaimReview.screen";
import { fixedCredentials } from "@proto/party-web/Credentials.context";
import { FindPartiesScreen } from "@proto/party-web/Directory/FindParties.screen";
import { partyRuntime } from "@proto/party-web/Party.runtime";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import { afterEach } from "vitest";

// Rendering only: the clients are fakes, so these prove the screens wire the atoms, not the wire.
afterEach(cleanup);

const acme = OrgId.make("org_acme");
const review = (status: ClaimReviewState["status"]): ClaimReviewState => ({
  org: acme,
  status,
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "d@acme.test" }),
  sources: 2,
  revision: 1,
  reviews: [RunId.make("review:claim_1:1")],
  proposal: { disposition: "accept", rationale: "two sources", run: RunId.make("review:claim_1:1"), evidenceRevision: 1, digest: "d1" },
  notes: [],
});

const fakeReviewer = {
  ClaimReview: {
    // Before the approval, the view is pending at revision 3; a read after the receipt sees it accepted.
    snapshot: (_key: string, options?: { readonly atLeast?: unknown }) =>
      Effect.succeed(options?.atLeast ? { state: review("accepted"), cursor: 4 } : { state: review("pending"), cursor: 3 }),
    events: () => Stream.never,
  },
  ApproveProposal: () => Effect.succeed({ stream: "Claim/claim_1", version: 4, reply: undefined }),
  FindParties: () =>
    Effect.succeed({ entries: [{ partyId: PartyId.make("party_dana"), org: acme, name: "Dana Smith", absorbed: [] }], cursor: null }),
};
const fakeIntake = { RegisterParty: () => Effect.succeed({ stream: "Party/party_new", version: 1, reply: undefined }) };
const fakes = Layer.mergeAll(
  Layer.succeed(ReviewerContract.Client, fakeReviewer as never),
  Layer.succeed(IntakeContract.Client, fakeIntake as never),
  fixedCredentials({}),
  SecureRandom.layerWebCrypto,
);
const withFakes = (node: React.ReactNode) =>
  render(<RegistryProvider initialValues={[[partyRuntime.layer, fakes]]}>{node}</RegistryProvider>);

it("the claim review screen shows the proposal, then committed, then approved", async () => {
  withFakes(<ClaimReviewScreen claim={ClaimId.make("claim_1")} />);
  expect(await screen.findByText("Status: pending")).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Approve" }));
  expect(await screen.findByText("Approved")).toBeTruthy();
  expect(await screen.findByText("Status: accepted")).toBeTruthy();
});

it("the directory screen searches and registers", async () => {
  withFakes(<FindPartiesScreen org={acme} />);
  expect(await screen.findByText("Dana Smith")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Search parties"), { target: { value: "Dana" } });
  fireEvent.click(screen.getByRole("button", { name: "Register" }));
  expect(await screen.findByText("Registration: Accepted")).toBeTruthy();
});
