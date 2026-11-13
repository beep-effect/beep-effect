import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import { approveClaim, claimReviewScreen } from "./ClaimReview.controller.ts";
import { Notice, type Screen } from "./ClaimReview.machine.ts";

const noticeText = (screen: Screen): string | null =>
  screen.notice === null
    ? null
    : Notice.match(screen.notice, {
        Approved: () => "Approved",
        Refused: ({ reason }) => `Refused: ${reason}`,
        Denied: ({ reason }) => `Denied: ${reason}`,
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
      const review = screen.view?.review ?? null;
      const notice = noticeText(screen);
      return (
        <section aria-label="Claim review">
          <p>Status: {review?.status ?? "unknown"}</p>
          {review?.proposal ? <p>Proposal: {review.proposal.disposition}</p> : null}
          <button
            type="button"
            disabled={screen.pending !== null || !review?.proposal}
            onClick={() => approve()}
          >
            Approve
          </button>
          {screen.pending?.receipt ? <p role="status">Committed</p> : null}
          {notice ? <p role="status">{notice}</p> : null}
        </section>
      );
    },
  });
};
