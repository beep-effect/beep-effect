import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ClaimReviewState } from "@proto/party-contract/Claim/ClaimReview.read";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { Receipt } from "../Bindings.ts";

/**
 * The approval in flight: its command id, what it approves, the view
 * revision it was made from, how many times it was sent, and its receipt
 * once the command committed.
 *
 * @category models
 * @since 0.0.0
 */
export const Pending = S.Struct({
  commandId: S.String,
  digest: S.String,
  evidenceRevision: S.Int,
  baseRevision: S.Int,
  attempts: S.Int,
  receipt: S.NullOr(Receipt),
});
/**
 * @category models
 * @since 0.0.0
 */
export type Pending = typeof Pending.Type;

/**
 * What the screen last told the person about an approval.
 *
 * @category models
 * @since 0.0.0
 */
export const Notice = S.TaggedUnion({
  Approved: { commandId: S.String },
  Refused: { commandId: S.String, reason: S.String },
  Denied: { commandId: S.String, reason: S.String },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Notice = typeof Notice.Type;

/**
 * The claim review screen: the latest view with its revision and epoch, the
 * approval in flight, and the last notice.
 *
 * @category models
 * @since 0.0.0
 */
export const Screen = S.Struct({
  claim: ClaimId,
  view: S.NullOr(S.Struct({ review: S.NullOr(ClaimReviewState), revision: S.Int, epoch: S.Int })),
  pending: S.NullOr(Pending),
  notice: S.NullOr(Notice),
});
/**
 * @category models
 * @since 0.0.0
 */
export type Screen = typeof Screen.Type;

/**
 * What can happen to the screen. Every message about a command names its
 * command id; every view message carries its revision and epoch.
 *
 * @category models
 * @since 0.0.0
 */
export const Message = S.TaggedUnion({
  /** A state from the subscription. */
  Snapshot: { review: S.NullOr(ClaimReviewState), revision: S.Int, epoch: S.Int },
  /** The person pressed Approve; the controller minted the command id. */
  ApproveClicked: { commandId: S.String },
  /** The command committed. */
  Accepted: { commandId: S.String, receipt: Receipt },
  /** The model refused it with a declared rejection. */
  Rejected: { commandId: S.String, reason: S.String },
  /** Authority refused it. */
  Denied: { commandId: S.String, reason: S.String },
  /** Nobody knows whether it committed. */
  Unknown: { commandId: S.String },
  /** A read that waited for the command's receipt returned. */
  CaughtUp: { commandId: S.String, review: S.NullOr(ClaimReviewState), revision: S.Int },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Message = typeof Message.Type;

/**
 * What `update` asks the controller to do.
 *
 * @category models
 * @since 0.0.0
 */
export const Intent = S.TaggedUnion({
  /** Send `ApproveProposal` under this command id (a retry reuses it). */
  Approve: { commandId: S.String, digest: S.String, evidenceRevision: S.Int },
  /** Read the view once it has applied this receipt. */
  ReadAfterWrite: { commandId: S.String, receipt: Receipt },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Intent = typeof Intent.Type;

/**
 * The screen before anything arrived.
 *
 * @category constructors
 * @since 0.0.0
 */
export const initial = (claim: ClaimId): Screen => ({ claim, view: null, pending: null, notice: null });

const emit = (screen: Screen, ...intents: ReadonlyArray<Intent>): readonly [Screen, ReadonlyArray<Intent>] => [
  screen,
  intents,
];
const unchanged = (screen: Screen) => emit(screen);
const isCurrent = (screen: Screen, commandId: string) => screen.pending?.commandId === commandId;
const newer = (screen: Screen, revision: number) => screen.view === null || revision > screen.view.revision;

/**
 * The screen's law, pure: the next screen and the intents to run.
 *
 * **Details**
 *
 * - A snapshot never touches the approval in flight (Astra's counterexample:
 *   a delayed snapshot used to clear it and let a second command out), and
 *   one not newer than the view's revision is dropped (a reconnect's stale
 *   snapshot).
 * - While an approval is in flight, Approve does nothing.
 * - Outcomes count only for the command in flight: a late or duplicate
 *   reply for another command id, or a second `Accepted`, is ignored.
 * - `Accepted` records the receipt and asks for a read after it; the
 *   approval ends only when that read returns (`CaughtUp`). Committing and
 *   the view catching up are two moments.
 * - `Unknown` resends under the same command id.
 *
 * **Example** (Pressing Approve on a proposal)
 * ```ts
 * import { initial, update } from "@proto/party-web/Claim/ClaimReview.machine";
 * import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
 *
 * const [screen, intents] = update(initial(ClaimId.make("claim_1")), { _tag: "ApproveClicked", commandId: "c1" });
 * ```
 *
 * @category transitions
 * @since 0.0.0
 */
export const update = (screen: Screen, message: Message): readonly [Screen, ReadonlyArray<Intent>] =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      Snapshot: ({ review, revision, epoch }) =>
        newer(screen, revision) ? unchanged({ ...screen, view: { review, revision, epoch } }) : unchanged(screen),
      ApproveClicked: ({ commandId }) => {
        const proposal = screen.view?.review?.proposal ?? null;
        if (screen.pending !== null || screen.view === null || proposal === null) return unchanged(screen);
        const pending: Pending = {
          commandId,
          digest: proposal.digest,
          evidenceRevision: proposal.evidenceRevision,
          baseRevision: screen.view.revision,
          attempts: 1,
          receipt: null,
        };
        return emit(
          { ...screen, pending, notice: null },
          Intent.cases.Approve.make({ commandId, digest: pending.digest, evidenceRevision: pending.evidenceRevision }),
        );
      },
      Accepted: ({ commandId, receipt }) =>
        screen.pending === null || !isCurrent(screen, commandId) || screen.pending.receipt !== null
          ? unchanged(screen)
          : emit(
              { ...screen, pending: { ...screen.pending, receipt } },
              Intent.cases.ReadAfterWrite.make({ commandId, receipt }),
            ),
      Rejected: ({ commandId, reason }) =>
        isCurrent(screen, commandId)
          ? unchanged({ ...screen, pending: null, notice: Notice.cases.Refused.make({ commandId, reason }) })
          : unchanged(screen),
      Denied: ({ commandId, reason }) =>
        isCurrent(screen, commandId)
          ? unchanged({ ...screen, pending: null, notice: Notice.cases.Denied.make({ commandId, reason }) })
          : unchanged(screen),
      Unknown: ({ commandId }) =>
        screen.pending === null || !isCurrent(screen, commandId) || screen.pending.receipt !== null
          ? unchanged(screen)
          : emit(
              { ...screen, pending: { ...screen.pending, attempts: screen.pending.attempts + 1 } },
              Intent.cases.Approve.make({
                commandId,
                digest: screen.pending.digest,
                evidenceRevision: screen.pending.evidenceRevision,
              }),
            ),
      CaughtUp: ({ commandId, review, revision }) =>
        screen.pending === null || !isCurrent(screen, commandId) || screen.pending.receipt === null
          ? unchanged(screen)
          : unchanged({
              ...screen,
              pending: null,
              notice: Notice.cases.Approved.make({ commandId }),
              view: newer(screen, revision) ? { review, revision, epoch: screen.view?.epoch ?? 0 } : screen.view,
            }),
    }),
  );
