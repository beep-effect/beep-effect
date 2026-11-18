import { expect, it } from "@effect/vitest";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { thunk0, thunkTrue, thunkUndefined } from "@beep/utils/thunk";
import { Count, IdText } from "@proto/kernel/Measure";
import { ClaimId } from "@proto/party-contract/Claim/Claim.id";
import { proposalOf } from "@proto/party-contract/Claim/ClaimReview.read";
import { Receipt } from "@proto/party-web/Bindings";
import {
  Approval,
  InFlight,
  initial,
  Intent,
  Message,
  Notice,
  Screen,
  type SeenView,
  update,
} from "@proto/party-web/Claim/ClaimReview.machine";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";

// The claim review screen's law, over generated screens and messages. Each property states one rule
// of `update` for any screen it can be in; the last runs generated message sequences about a few
// commands, so replies meet the command in flight as often as they miss it. 100 runs each (the
// `effect/Arbitrary` default): `update` is pure, and the file runs in well under a second.

const isInFlight = S.is(InFlight);
/** The approval in flight on a screen, if one is. */
const inFlightOf = (screen: Screen) => O.liftPredicate(screen.approval, isInFlight);
/** Whether a revision is newer than the view the screen holds (any revision is, before the first view). */
const newerThanView = (screen: Screen, revision: number) =>
  O.match(screen.view, { onNone: thunkTrue, onSome: (view) => revision > view.revision });
/** The view the screen shows, with the proposal in it, when it shows one. */
const proposalInView = (screen: Screen) =>
  O.flatMap(screen.view, (view) => O.map(O.flatMap(view.review, proposalOf), (proposal) => ({ view, proposal })));

/** Every message that answers a command. */
const Reply = S.Union([
  Message.cases.Accepted,
  Message.cases.Rejected,
  Message.cases.Denied,
  Message.cases.Unknown,
  Message.cases.CaughtUp,
]);

/** A reply that names a command other than the one in flight: a late one, or one for a command already over. */
const StrayReply = S.Struct({ screen: Screen, reply: Reply }).check(
  S.makeFilter(({ screen, reply }) => !O.exists(inFlightOf(screen), (approval) => approval.commandId === reply.commandId), {
    identifier: "StrayReplyCheck",
    title: "Stray reply",
    description: "A reply whose command is not the one in flight.",
    message: "Expected a reply for a command other than the one in flight",
  }),
);

/** A model refusal or an authority refusal of a command. */
const Refusal = S.Union([Message.cases.Rejected, Message.cases.Denied]).pipe(S.toTaggedUnion("_tag"));

/**
 * A run of messages about a few commands: each step names its command by position in the pool,
 * so outcomes and clicks reuse the ids in play; a snapshot names none.
 */
const Run = S.Struct({
  screen: Screen,
  commands: S.NonEmptyArray(IdText).check(S.isUnique()),
  steps: S.Array(S.Struct({ message: Message, command: Count })),
});
type Run = typeof Run.Type;

const messagesOf = ({ commands, steps }: Run): ReadonlyArray<Message> =>
  A.map(steps, ({ message, command }) =>
    Message.guards.Snapshot(message)
      ? message
      : { ...message, commandId: commands[command % commands.length] ?? A.headNonEmpty(commands) },
  );

/** Each message of a run with the screen before it, and the screen and intents after it. */
const transitionsOf = (run: Run) => {
  const messages = messagesOf(run);
  const start: readonly [Screen, ReadonlyArray<Intent>] = [run.screen, A.empty()];
  const screens = A.scan(messages, start, ([screen], message) => update(screen, message));
  return A.zip(messages, A.zip(screens, A.drop(screens, 1)));
};

it.prop("Approve before any snapshot does nothing", [ClaimId, Message.cases.ApproveClicked], ([claim, click]) => {
  expect(update(initial(claim), click)).toEqual([initial(claim), []]);
});

it.prop(
  "Approve sends one command under its fresh id, only when a proposal is in view and nothing is in flight",
  [Screen, Message.cases.ApproveClicked],
  ([screen, click]) => {
    const [next, intents] = update(screen, click);
    O.match(O.filter(proposalInView(screen), () => !isInFlight(screen.approval)), {
      onNone: () => expect([next, intents]).toEqual([screen, []]),
      onSome: ({ view, proposal }) => {
        const { digest, evidenceRevision } = proposal;
        expect(intents).toEqual([Intent.cases.Approve.make({ commandId: click.commandId, digest, evidenceRevision })]);
        expect(next).toEqual({
          ...screen,
          approval: Approval.cases.Sending.make({
            commandId: click.commandId,
            digest,
            evidenceRevision,
            baseRevision: view.revision,
            attempts: 1,
          }),
        });
      },
    });
  },
);

it.prop(
  "a snapshot never touches the approval in flight; a reconnect's snapshot not newer than the view is ignored",
  [Screen, Message.cases.Snapshot],
  ([screen, snapshot]) => {
    const seen: SeenView = Struct.omit(snapshot, ["_tag"]);
    expect(update(screen, snapshot)).toEqual([
      newerThanView(screen, snapshot.revision) ? { ...screen, view: O.some(seen) } : screen,
      [],
    ]);
  },
);

it.prop("a late or duplicate reply for another command does not touch the screen", [StrayReply], ([{ screen, reply }]) => {
  expect(update(screen, reply)).toEqual([screen, []]);
});

it.prop(
  "a refusal or a denial of the command in flight ends it with what the screen tells the person",
  [Screen, InFlight, Refusal],
  ([screen, approval, refusal]) => {
    const answer = { ...refusal, commandId: approval.commandId };
    const notice = Refusal.match(answer, {
      Rejected: ({ commandId, reason }) => Notice.cases.Refused.make({ commandId, reason }),
      Denied: ({ commandId, reason }) => Notice.cases.Denied.make({ commandId, reason }),
    });
    expect(update({ ...screen, approval }, answer)).toEqual([{ ...screen, approval: Approval.cases.Noticed.make({ notice }) }, []]);
  },
);

it.prop(
  "an accepted receipt and the view catching up are two separate moments",
  [Screen, Approval.cases.Sending, Receipt, Message.cases.Snapshot, Message.cases.CaughtUp],
  ([screen, sending, receipt, snapshot, read]) => {
    const { commandId } = sending;
    const [committed, asked] = update({ ...screen, approval: sending }, Message.cases.Accepted.make({ commandId, receipt }));
    // Committed, not yet seen: the approval is still in flight, and the controller reads after the receipt.
    expect(asked).toEqual([Intent.cases.ReadAfterWrite.make({ commandId, receipt })]);
    expect(committed).toEqual({ ...screen, approval: Approval.cases.Committed.make({ ...Struct.omit(sending, ["_tag"]), receipt }) });
    // The subscription shows the decision; that alone does not end the approval.
    const [shown] = update(committed, snapshot);
    expect(shown.approval).toEqual(committed.approval);
    // The read that waited for the receipt returns: now the approval is done, and the view keeps its epoch.
    const caughtUp = { ...read, commandId };
    const epoch = O.match(shown.view, { onNone: thunk0, onSome: (view) => view.epoch });
    expect(update(shown, caughtUp)).toEqual([
      {
        ...shown,
        approval: Approval.cases.Noticed.make({ notice: Notice.cases.Approved.make({ commandId }) }),
        view: newerThanView(shown, caughtUp.revision)
          ? O.some({ review: caughtUp.review, revision: caughtUp.revision, epoch })
          : shown.view,
      },
      [],
    ]);
  },
);

it.prop("a duplicate reply to a committed command is ignored", [Screen, Approval.cases.Committed, Receipt], ([screen, approval, receipt]) => {
  const committed = { ...screen, approval };
  const { commandId } = approval;
  A.forEach([Message.cases.Accepted.make({ commandId, receipt }), Message.cases.Unknown.make({ commandId })], (reply) =>
    expect(update(committed, reply)).toEqual([committed, []]),
  );
});

it.prop("an unknown outcome retries with the same command id", [Screen, Approval.cases.Sending], ([screen, sending]) => {
  const { commandId, digest, evidenceRevision } = sending;
  expect(update({ ...screen, approval: sending }, Message.cases.Unknown.make({ commandId }))).toEqual([
    { ...screen, approval: { ...sending, attempts: sending.attempts + 1 } },
    [Intent.cases.Approve.make({ commandId, digest, evidenceRevision })],
  ]);
});

it.prop(
  "Astra's counterexample, for any run: a delayed snapshot neither clears the command in flight nor lets a second one out",
  [Run],
  ([run]) => {
    A.forEach(transitionsOf(run), ([message, [[before], [after, intents]]]) => {
      // A snapshot, delayed or fresh, leaves the approval where it was.
      if (Message.guards.Snapshot(message)) expect(after.approval).toEqual(before.approval);
      // At most one intent per message; a command goes out only from a screen with nothing in
      // flight, or again under the id of the one in flight.
      expect(intents.length).toBeLessThanOrEqual(1);
      A.forEach(A.filter(intents, Intent.guards.Approve), (approve) =>
        expect(O.match(inFlightOf(before), { onNone: thunkTrue, onSome: (approval) => approval.commandId === approve.commandId })).toBe(true),
      );
      // The view never goes back to an older revision.
      O.match(before.view, {
        onNone: thunkUndefined,
        onSome: (view) => expect(O.exists(after.view, (next) => next.revision >= view.revision)).toBe(true),
      });
    });
  },
);
