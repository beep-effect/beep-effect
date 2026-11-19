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
import * as O from "@beep/utils/Option";
import * as Stream from "effect/Stream";
import { afterEach } from "vitest";

// Rendering only: the clients are fakes, so these prove the screens wire the atoms, not the wire.
afterEach(cleanup);

const acme = OrgId.make("org_acme");
const review = (standing: "Pending" | "Accepted"): ClaimReviewState => ({
  _tag: standing,
  org: acme,
  proposition: Proposition.cases.HasIdentifier.make({ party: PartyId.make("party_dana"), scheme: "email", value: "d@acme.test" }),
  sources: 2,
  revision: 1,
  reviews: [RunId.make("review:claim_1:1")],
  proposal: O.some({ disposition: "accept", rationale: "two sources", run: RunId.make("review:claim_1:1"), evidenceRevision: 1, digest: "pd1" }),
  notes: [],
});

const fakeReviewer = {
  ClaimReview: {
    // Before the approval, the view is pending at revision 3; a read after the receipt sees it accepted.
    snapshot: (_key: string, options?: { readonly atLeast?: unknown }) =>
      Effect.succeed(
        options?.atLeast === undefined ? { state: review("Pending"), cursor: 3 } : { state: review("Accepted"), cursor: 4 },
      ),
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

/** Wait for the rendered text, as the person would see it. */
const shown = (text: string) => Effect.promise(() => screen.findByText(text));

it.live("the claim review screen shows the proposal, then committed, then approved", () =>
  Effect.gen(function* () {
    withFakes(<ClaimReviewScreen claim={ClaimId.make("claim_1")} />);
    const pending = yield* shown("Status: pending");
    expect(pending).toBeTruthy();
    const approve = yield* Effect.promise(() => screen.findByRole("button", { name: "Approve" }));
    fireEvent.click(approve);
    const approved = yield* shown("Approved");
    expect(approved).toBeTruthy();
    const accepted = yield* shown("Status: accepted");
    expect(accepted).toBeTruthy();
  }),
);

it.live("the directory screen searches and registers", () =>
  Effect.gen(function* () {
    withFakes(<FindPartiesScreen org={acme} />);
    const listed = yield* shown("Dana Smith");
    expect(listed).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search parties"), { target: { value: "Dana" } });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    const registered = yield* shown("Registration: Accepted");
    expect(registered).toBeTruthy();
  }),
);
