import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import * as O from "@beep/utils/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { approveClaim, claimReviewScreen } from "./ClaimReview.controller.ts";
import { Approval, Notice, type Screen } from "./ClaimReview.machine.ts";
import { Button } from "@beep/ui/components/button"
import { thunkNull } from "@beep/utils/thunk"

/** What the screen last told the person, once an approval is over. */
const noticeText = (screen: Screen): O.Option<string> =>
  O.map(
    O.liftPredicate(screen.approval, Approval.guards.Noticed),
    ({ notice }) =>
      Notice.match(notice, {
        Approved: () => "Approved",
        Refused: ({ reason }) => `Refused: ${reason}`,
        Denied: ({ reason }) => `Denied: ${reason}`,
      }),
  );

/** Where the claim stands, in the reviewer's words. */
const standing = ClaimReviewState.match({
  Unasserted: () => "unasserted",
  Pending: () => "pending",
  Accepted: () => "accepted",
  Retracted: () => "retracted",
});

/**
 * Claim review and approval, rendered from the machine's screen state. The
 * Approve button is disabled while an approval is in flight; "Committed"
 * shows between the receipt and the view catching up.
 *
 * **Example** (Rendering a claim's review)
 * ```tsx
 * import { ClaimReviewScreen } from "@proto/party-web/Claim/ClaimReview.screen";
 * import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
 *
 * const page = <ClaimReviewScreen claim={ClaimId.make("claim_1")} />;
 * ```
 *
 * @category screens
 * @since 0.0.0
 */
export const ClaimReviewScreen = ({ claim }: { readonly claim: ClaimId }) => {
  const result = useAtomValue(claimReviewScreen(claim));
  const approve = useAtomSet(approveClaim(claim));
  return AsyncResult.match(result, {
    onInitial: () => <p>Loading the review</p>,
    onFailure: () => <p role="alert">The review could not be read.</p>,
    onSuccess: ({ value: screen }) => {
      const review = O.flatMap(screen.view, (view) => view.review);
      const proposal = O.flatMap(review, proposalOf);
      const inFlight = Approval.guards.Sending(screen.approval) || Approval.guards.Committed(screen.approval);
      return (
        <section aria-label="Claim review">
          <p>Status: {O.match(review, { onNone: () => "unknown", onSome: standing })}</p>
          {O.match(proposal, { onNone: thunkNull, onSome: ({ disposition }) => <p>Proposal: {disposition}</p> })}
          <Button type="button" disabled={inFlight || O.isNone(proposal)} onClick={() => approve()}>
            Approve
          </Button>
          {Approval.guards.Committed(screen.approval) ? <p role="status">Committed</p> : null}
          {O.match(noticeText(screen), { onNone: thunkNull, onSome: (text) => <p role="status">{text}</p> })}
        </section>
      );
    },
  });
};
