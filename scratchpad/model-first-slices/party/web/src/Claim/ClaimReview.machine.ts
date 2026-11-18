import { Count, IdText, Name, Sequence } from "@proto/kernel/Measure";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { ProposalDigest } from "@proto/party-contract/Claim/ProposalDigest";
import { ClaimReviewState, proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { dual } from "effect/Function";
import * as Match from "effect/Match";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { Receipt } from "../Bindings.ts";
import { thunk0, thunkTrue } from "@beep/utils/thunk"

/** What every approval in flight carries: its command id, what it approves, the view revision it was made from, and how many times it was sent. */
const inFlight = {
  commandId: IdText,
  digest: ProposalDigest,
  evidenceRevision: Sequence,
  baseRevision: Count,
  attempts: Sequence,
};

/**
 * What the screen last told the person about an approval.
 *
 * @category models
 * @since 0.0.0
 */
export const Notice = S.TaggedUnion({
  Approved: { commandId: IdText },
  Refused: { commandId: IdText, reason: Name },
  Denied: { commandId: IdText, reason: Name },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Notice = typeof Notice.Type;

/**
 * Where the person's approval stands: nothing asked, sent and waiting for
 * its outcome, committed with its receipt and waiting for the view to catch
 * up, or over, with what the screen told the person.
 *
 * @category models
 * @since 0.0.0
 */
export const Approval = S.TaggedUnion({
  Idle: {},
  Sending: inFlight,
  Committed: { ...inFlight, receipt: Receipt },
  Noticed: { notice: Notice },
});
/**
 * @category models
 * @since 0.0.0
 */
export type Approval = typeof Approval.Type;
/**
 * An approval in flight: sent, or committed and waiting for the view.
 *
 * @category models
 * @since 0.0.0
 */
export const InFlight = S.Union([Approval.cases.Sending, Approval.cases.Committed]);
/**
 * @category models
 * @since 0.0.0
 */
export type InFlight = typeof InFlight.Type;

/**
 * The latest view the screen saw: the claim's review once it has one, with
 * the view's revision and epoch.
 *
 * @category models
 * @since 0.0.0
 */
export const SeenView = S.Struct({ review: S.Option(ClaimReviewState), revision: Count, epoch: Count });
/**
 * @category models
 * @since 0.0.0
 */
export type SeenView = typeof SeenView.Type;

/**
 * The claim review screen: the latest view, once one arrived, and where the
 * approval stands.
 *
 * @category models
 * @since 0.0.0
 */
export const Screen = S.Struct({
  claim: ClaimId,
  view: S.Option(SeenView).pipe(
    S.annotateKey({ description: "What the screen last saw of the claim; nothing until the first snapshot." }),
    S.withConstructorDefault(Effect.succeedNone),
  ),
  approval: Approval.pipe(
    S.annotateKey({ description: "Where the reviewer's approval stands; idle at first." }),
    S.withConstructorDefault(Effect.succeed(Approval.cases.Idle.make({}))),
  ),
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
  Snapshot: { review: S.Option(ClaimReviewState), revision: Count, epoch: Count },
  /** The person pressed Approve; the controller minted the command id. */
  ApproveClicked: { commandId: IdText },
  /** The command committed. */
  Accepted: { commandId: IdText, receipt: Receipt },
  /** The model refused it with a declared rejection. */
  Rejected: { commandId: IdText, reason: Name },
  /** Authority refused it. */
  Denied: { commandId: IdText, reason: Name },
  /** Nobody knows whether it committed. */
  Unknown: { commandId: IdText },
  /** A read that waited for the command's receipt returned. */
  CaughtUp: { commandId: IdText, review: S.Option(ClaimReviewState), revision: Count },
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
  Approve: { commandId: IdText, digest: ProposalDigest, evidenceRevision: Sequence },
  /** Read the view once it has applied this receipt. */
  ReadAfterWrite: { commandId: IdText, receipt: Receipt },
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
export const initial = (claim: ClaimId): Screen => Screen.make({ claim });

const emit = (screen: Screen, ...intents: ReadonlyArray<Intent>): readonly [Screen, ReadonlyArray<Intent>] => [
  screen,
  intents,
];
const unchanged = (screen: Screen) => emit(screen);
const isInFlight = S.is(InFlight);
/** The approval in flight under this command id, if that is the one in flight. */
const current = (screen: Screen, commandId: string): O.Option<InFlight> =>
  O.filter(O.liftPredicate(screen.approval, isInFlight), (approval) => approval.commandId === commandId);
const newer = (screen: Screen, revision: number) =>
  O.match(screen.view, { onNone: thunkTrue, onSome: (view) => revision > view.revision });
const noticed = (screen: Screen, notice: Notice): Screen => ({ ...screen, approval: Approval.cases.Noticed.make({ notice }) });

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
export const update: {
  (message: Message): (screen: Screen) => readonly [Screen, ReadonlyArray<Intent>];
  (screen: Screen, message: Message): readonly [Screen, ReadonlyArray<Intent>];
} = dual(2, (screen: Screen, message: Message): readonly [Screen, ReadonlyArray<Intent>] =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      Snapshot: ({ review, revision, epoch }) =>
        newer(screen, revision) ? unchanged({ ...screen, view: O.some({ review, revision, epoch }) }) : unchanged(screen),
      ApproveClicked: ({ commandId }) => {
        if (isInFlight(screen.approval) || O.isNone(screen.view)) return unchanged(screen);
        const view = screen.view.value;
        return O.match(O.flatMap(view.review, proposalOf), {
          onNone: () => unchanged(screen),
          onSome: (proposal) =>
            emit(
              {
                ...screen,
                approval: Approval.cases.Sending.make({
                  commandId,
                  digest: proposal.digest,
                  evidenceRevision: proposal.evidenceRevision,
                  baseRevision: view.revision,
                  attempts: 1,
                }),
              },
              Intent.cases.Approve.make({ commandId, digest: proposal.digest, evidenceRevision: proposal.evidenceRevision }),
            ),
        });
      },
      Accepted: ({ commandId, receipt }) =>
        O.match(O.filter(current(screen, commandId), Approval.guards.Sending), {
          onNone: () => unchanged(screen),
          onSome: (sending) =>
            emit(
              { ...screen, approval: Approval.cases.Committed.make({ ...Struct.omit(sending, ["_tag"]), receipt }) },
              Intent.cases.ReadAfterWrite.make({ commandId, receipt }),
            ),
        }),
      Rejected: ({ commandId, reason }) =>
        O.isSome(current(screen, commandId))
          ? unchanged(noticed(screen, Notice.cases.Refused.make({ commandId, reason })))
          : unchanged(screen),
      Denied: ({ commandId, reason }) =>
        O.isSome(current(screen, commandId))
          ? unchanged(noticed(screen, Notice.cases.Denied.make({ commandId, reason })))
          : unchanged(screen),
      Unknown: ({ commandId }) =>
        O.match(O.filter(current(screen, commandId), Approval.guards.Sending), {
          onNone: () => unchanged(screen),
          onSome: (sending) =>
            emit(
              { ...screen, approval: { ...sending, attempts: sending.attempts + 1 } },
              Intent.cases.Approve.make({ commandId, digest: sending.digest, evidenceRevision: sending.evidenceRevision }),
            ),
        }),
      CaughtUp: ({ commandId, review, revision }) =>
        O.isNone(O.filter(current(screen, commandId), Approval.guards.Committed))
          ? unchanged(screen)
          : unchanged({
              ...noticed(screen, Notice.cases.Approved.make({ commandId })),
              view: newer(screen, revision)
                ? O.some({ review, revision, epoch: O.match(screen.view, { onNone: thunk0, onSome: (view) => view.epoch }) })
                : screen.view,
            }),
    }),
  ),
);
