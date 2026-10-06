/**
 * Undo of one docket intake run: delete the provisional calendar entries it
 * created, take `Docket - entered` off the messages it marked, and forget
 * those messages so a later run processes them again.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import {
  DocketIntakeError,
  DocketIntakeOutcome,
  DocketIntakeState,
  DocketIntakeStore,
} from "@beep/law-practice-use-cases/DocketIntake";
import { M365, M365DeleteEventRequest, M365GetEventRequest, M365GetMessageRequest } from "@beep/m365";
import { LiteralKit } from "@beep/schema";
import { DateTime, Effect, HashSet, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { rewriteMessageCategories } from "./DocketIntake.graph.ts";
import { DocketIntakeJournal, DocketJournalEntry, DocketJournalKind, DocketRunId } from "./DocketIntake.journal.ts";
import type { DocketIntakeStage } from "@beep/law-practice-use-cases/DocketIntake";
import type { M365Error, M365Shape } from "@beep/m365";

const $I = $LawPracticeServerId.create("DocketIntake/DocketIntake.undo");

const ENTERED_CATEGORY: DocketCategory = "Docket - entered";
const NOT_FOUND = 404;

// The categories the service puts on an entry it has not been told is right. An entry the attorney
// moved to `Docket - verified`, or to any category of their own, is theirs and is kept.
const isProvisional = S.is(
  DocketCategory.pick(["Docket - unverified", "Docket - needs review", "Docket - reminder", "Docket - digest"])
);

/**
 * What an undo does with one event a run created.
 *
 * **Details**
 *
 * `delete` when the event still carries one of the service's provisional
 * categories, `keep` when it does not, and `gone` when it no longer exists.
 *
 * **Example** (Check an event action)
 *
 * ```ts
 * import { DocketUndoEventAction } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketUndoEventAction.is.keep("keep")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketUndoEventAction = LiteralKit(["delete", "keep", "gone"]).pipe(
  $I.annoteSchema("DocketUndoEventAction", { description: "What an undo does with one event a run created." })
);

/**
 * Type of {@link DocketUndoEventAction}.
 *
 * **Example** (Type an event action)
 *
 * ```ts
 * import type { DocketUndoEventAction } from "@beep/law-practice-server/DocketIntake";
 *
 * const action: DocketUndoEventAction = "delete";
 * console.log(action);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketUndoEventAction = typeof DocketUndoEventAction.Type;

/**
 * What an undo does with one message a run marked: `unmark` it, or nothing
 * because it is `gone`.
 *
 * **Example** (Check a message action)
 *
 * ```ts
 * import { DocketUndoMessageAction } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketUndoMessageAction.is.gone("gone")); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocketUndoMessageAction = LiteralKit(["unmark", "gone"]).pipe(
  $I.annoteSchema("DocketUndoMessageAction", { description: "What an undo does with one message a run marked." })
);

/**
 * Type of {@link DocketUndoMessageAction}.
 *
 * **Example** (Type a message action)
 *
 * ```ts
 * import type { DocketUndoMessageAction } from "@beep/law-practice-server/DocketIntake";
 *
 * const action: DocketUndoMessageAction = "unmark";
 * console.log(action);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocketUndoMessageAction = typeof DocketUndoMessageAction.Type;

/**
 * One event a run created and what an undo does with it.
 *
 * **Example** (Plan to keep an event)
 *
 * ```ts
 * import { DocketUndoEvent } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(DocketUndoEvent.make({ action: "keep", eventId: "event-1" }).action);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketUndoEvent extends S.Class<DocketUndoEvent>($I`DocketUndoEvent`)(
  {
    action: DocketUndoEventAction.annotateKey({ description: "What the undo does with the event." }),
    eventId: S.NonEmptyString.annotateKey({ description: "Calendar event id." }),
  },
  $I.annote("DocketUndoEvent", { description: "One event a run created and what an undo does with it." })
) {}

/**
 * One message a run marked and what an undo does with it.
 *
 * **Example** (Plan to unmark a message)
 *
 * ```ts
 * import { DocketUndoMessage } from "@beep/law-practice-server/DocketIntake";
 * import * as O from "effect/Option";
 *
 * const target = DocketUndoMessage.make({ action: "unmark", messageId: "m1", receivedAt: O.none() });
 * console.log(target.action);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketUndoMessage extends S.Class<DocketUndoMessage>($I`DocketUndoMessage`)(
  {
    action: DocketUndoMessageAction.annotateKey({ description: "What the undo does with the message." }),
    messageId: S.NonEmptyString.annotateKey({ description: "Message id." }),
    receivedAt: S.Option(S.NonEmptyString).annotateKey({ description: "UTC receipt time, when the journal has it." }),
  },
  $I.annote("DocketUndoMessage", { description: "One message a run marked and what an undo does with it." })
) {}

/**
 * What an undo of one run will do, read from the journal and the mailbox.
 *
 * **Example** (Make an empty plan)
 *
 * ```ts
 * import { DocketRunId, DocketUndoPlan } from "@beep/law-practice-server/DocketIntake";
 *
 * const plan = DocketUndoPlan.make({ events: [], messages: [], runId: DocketRunId.make("run-20300109T100000000Z") });
 * console.log(plan.events.length);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketUndoPlan extends S.Class<DocketUndoPlan>($I`DocketUndoPlan`)(
  {
    events: S.Array(DocketUndoEvent).annotateKey({ description: "Events the run created." }),
    messages: S.Array(DocketUndoMessage).annotateKey({ description: "Messages the run marked." }),
    runId: DocketRunId.annotateKey({ description: "The run to undo." }),
  },
  $I.annote("DocketUndoPlan", { description: "What an undo of one docket intake run will do." })
) {}

/**
 * Counts of one undo, or of what it would do when it is a dry run. It
 * carries ids and counts only.
 *
 * **Example** (Read the report fields)
 *
 * ```ts
 * import { DocketUndoReport } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(Object.keys(DocketUndoReport.fields));
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketUndoReport extends S.Class<DocketUndoReport>($I`DocketUndoReport`)(
  {
    runId: DocketRunId.annotateKey({ description: "The run undone." }),
    dryRun: S.Boolean.annotateKey({ description: "Whether nothing was written." }),
    deleted: S.Natural.annotateKey({ description: "Provisional events deleted." }),
    kept: S.Natural.annotateKey({ description: "Events kept because the attorney confirmed or recategorised them." }),
    gone: S.Natural.annotateKey({ description: "Events that no longer existed." }),
    unmarked: S.Natural.annotateKey({ description: "Messages that no longer carry `Docket - entered`." }),
    messagesGone: S.Natural.annotateKey({ description: "Messages that no longer existed." }),
    ledgerCleared: S.Natural.annotateKey({ description: "Ledger records removed, so a later run reprocesses them." }),
  },
  $I.annote("DocketUndoReport", { description: "Counts of one docket intake undo." })
) {}

const isGraphStatus = (status: number) => (error: M365Error) =>
  error.reason === "response status" && O.contains(error.status, status);

const isNotFound = isGraphStatus(NOT_FOUND);

const graphError =
  (stage: DocketIntakeStage) =>
  (error: M365Error): DocketIntakeError =>
    DocketIntakeError.make({ cause: error.reason, stage });

// Succeed with `onGone` when the item no longer exists; fail on any other Graph error.
const orGone = <A, B>(effect: Effect.Effect<A, M365Error>, onGone: B, stage: DocketIntakeStage) =>
  effect.pipe(
    Effect.catchIf(isNotFound, () => Effect.succeed(onGone)),
    Effect.mapError(graphError(stage))
  );

const linesOf = (entries: ReadonlyArray<DocketJournalEntry>, runId: DocketRunId, kind: DocketJournalKind) =>
  A.filter(entries, (entry) => entry.runId === runId && entry.kind === kind);

const planEvent = Effect.fnUntraced(function* (m365: M365Shape, userId: O.Option<string>, eventId: string) {
  const action = yield* orGone(
    m365
      .getEvent(M365GetEventRequest.make({ eventId, userId }))
      .pipe(
        Effect.map(
          (event): DocketUndoEventAction =>
            A.some(O.getOrElse(event.categories, A.empty<string>), isProvisional) ? "delete" : "keep"
        )
      ),
    DocketUndoEventAction.Enum.gone,
    "calendar"
  );
  return DocketUndoEvent.make({ action, eventId });
});

type MarkedMessage = { readonly messageId: string; readonly receivedAt: O.Option<string> };

const planMessage = Effect.fnUntraced(function* (m365: M365Shape, userId: O.Option<string>, marked: MarkedMessage) {
  const action = yield* orGone(
    m365
      .getMessage(M365GetMessageRequest.make({ messageId: marked.messageId, userId }))
      .pipe(Effect.as(DocketUndoMessageAction.Enum.unmark)),
    DocketUndoMessageAction.Enum.gone,
    "mailbox"
  );
  return DocketUndoMessage.make({ action, messageId: marked.messageId, receivedAt: marked.receivedAt });
});

const markedMessage = (line: DocketJournalEntry): O.Option<MarkedMessage> =>
  O.map(line.messageId, (messageId) => ({ messageId, receivedAt: line.receivedAt }));

/**
 * Read what an undo of one run would do. It only reads: each event the run
 * created is looked up for its categories and each message it marked is
 * looked up to see that it still exists.
 *
 * **Details**
 *
 * An event or message that appears more than once in the run is planned
 * once. A run with no lines in the journal plans nothing.
 *
 * **Example** (Plan an undo)
 *
 * ```ts
 * import { DocketRunId, planDocketUndo } from "@beep/law-practice-server/DocketIntake";
 *
 * const program = planDocketUndo({
 *   entries: [],
 *   mailbox: "mailbox-id",
 *   runId: DocketRunId.make("run-20300109T100000000Z")
 * });
 * console.log(program);
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const planDocketUndo: (input: {
  readonly entries: ReadonlyArray<DocketJournalEntry>;
  readonly mailbox: string;
  readonly runId: DocketRunId;
}) => Effect.Effect<DocketUndoPlan, DocketIntakeError, M365> = Effect.fn("DocketUndo.plan")(function* (input) {
  const m365 = yield* M365;
  const userId = O.some(input.mailbox);
  const eventIds = A.dedupe(
    A.getSomes(A.map(linesOf(input.entries, input.runId, "event-created"), (line) => line.eventId))
  );
  const marked = A.dedupeWith(
    A.getSomes(A.map(linesOf(input.entries, input.runId, "message-marked"), markedMessage)),
    (left, right) => left.messageId === right.messageId
  );
  const events = yield* Effect.forEach(eventIds, (eventId) => planEvent(m365, userId, eventId));
  const messages = yield* Effect.forEach(marked, (line) => planMessage(m365, userId, line));
  return DocketUndoPlan.make({ events, messages, runId: input.runId });
});

const outcomeEventIds: (outcome: DocketIntakeOutcome) => ReadonlyArray<string> = DocketIntakeOutcome.match({
  DocketEntered: (outcome) => [outcome.entry.eventId, ...A.map(outcome.reminders, (reminder) => reminder.eventId)],
  DocketNeedsReview: (outcome) => [outcome.entry.eventId],
  IntakeFailed: A.empty<string>,
  NotDocketItem: A.empty<string>,
});

/**
 * The state left after an undone run's ledger records are removed, and how
 * many were removed.
 *
 * **Example** (Read the clearance fields)
 *
 * ```ts
 * import { DocketLedgerClearance } from "@beep/law-practice-server/DocketIntake";
 *
 * console.log(Object.keys(DocketLedgerClearance.fields));
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketLedgerClearance extends S.Class<DocketLedgerClearance>($I`DocketLedgerClearance`)(
  {
    cleared: S.Natural.annotateKey({ description: "Ledger records removed." }),
    state: DocketIntakeState.annotateKey({ description: "The state without them." }),
  },
  $I.annote("DocketLedgerClearance", { description: "State after an undone run's ledger records are removed." })
) {}

/**
 * The saved state without the ledger records of an undone run's messages.
 *
 * **Details**
 *
 * A record is removed when its message is one the run marked, or when its
 * entry is one of the events the run created (that covers a message whose
 * mark failed). The cursor moves back to the earliest receipt time among the
 * removed messages, so the next poll lists them again; it never moves
 * forward. The digest day is kept.
 *
 * **Example** (Clear an empty state)
 *
 * ```ts
 * import { clearDocketRun, DocketRunId, DocketUndoPlan } from "@beep/law-practice-server/DocketIntake";
 * import { DocketIntakeState } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const plan = DocketUndoPlan.make({ events: [], messages: [], runId: DocketRunId.make("run-20300109T100000000Z") });
 * console.log(clearDocketRun(DocketIntakeState.make({}), plan).cleared); // 0
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const clearDocketRun: {
  (plan: DocketUndoPlan): (state: DocketIntakeState) => DocketLedgerClearance;
  (state: DocketIntakeState, plan: DocketUndoPlan): DocketLedgerClearance;
} = dual(2, (state: DocketIntakeState, plan: DocketUndoPlan): DocketLedgerClearance => {
  const messageIds = HashSet.fromIterable(A.map(plan.messages, (target) => target.messageId));
  const eventIds = HashSet.fromIterable(A.map(plan.events, (target) => target.eventId));
  const undone = R.filter(
    state.ledger,
    (record, messageId) =>
      HashSet.has(messageIds, messageId) ||
      A.some(outcomeEventIds(record.outcome), (eventId) => HashSet.has(eventIds, eventId))
  );
  const receipts = A.appendAll(
    A.map(R.values(undone), (record) => record.receivedAt),
    A.getSomes(A.map(plan.messages, (target) => target.receivedAt))
  );
  const cursor = pipe(
    A.sort(A.appendAll(receipts, O.toArray(state.cursor)), Str.Order),
    A.head,
    O.filter(() => O.isSome(state.cursor))
  );
  return DocketLedgerClearance.make({
    cleared: R.size(undone),
    state: DocketIntakeState.make({
      cursor,
      digestedThrough: state.digestedThrough,
      ledger: R.filter(state.ledger, (_, messageId) => !R.has(undone, messageId)),
    }),
  });
});

const countOf = <Action extends string>(actions: ReadonlyArray<Action>, action: Action): number =>
  A.length(A.filter(actions, (value) => value === action));

const reportOf = (input: {
  readonly dryRun: boolean;
  readonly eventActions: ReadonlyArray<DocketUndoEventAction>;
  readonly ledgerCleared: number;
  readonly messageActions: ReadonlyArray<DocketUndoMessageAction>;
  readonly runId: DocketRunId;
}): DocketUndoReport =>
  DocketUndoReport.make({
    deleted: countOf(input.eventActions, "delete"),
    dryRun: input.dryRun,
    gone: countOf(input.eventActions, "gone"),
    kept: countOf(input.eventActions, "keep"),
    ledgerCleared: input.ledgerCleared,
    messagesGone: countOf(input.messageActions, "gone"),
    runId: input.runId,
    unmarked: countOf(input.messageActions, "unmark"),
  });

/**
 * The report of a dry run: what {@link applyDocketUndo} would do with the
 * plan, and how many ledger records it would remove from the given state.
 *
 * **Example** (Report a dry run)
 *
 * ```ts
 * import { DocketRunId, DocketUndoPlan, dryRunDocketUndo } from "@beep/law-practice-server/DocketIntake";
 * import { DocketIntakeState } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const plan = DocketUndoPlan.make({ events: [], messages: [], runId: DocketRunId.make("run-20300109T100000000Z") });
 * console.log(dryRunDocketUndo(plan, DocketIntakeState.make({})).dryRun); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const dryRunDocketUndo: {
  (state: DocketIntakeState): (plan: DocketUndoPlan) => DocketUndoReport;
  (plan: DocketUndoPlan, state: DocketIntakeState): DocketUndoReport;
} = dual(
  2,
  (plan: DocketUndoPlan, state: DocketIntakeState): DocketUndoReport =>
    reportOf({
      dryRun: true,
      eventActions: A.map(plan.events, (target) => target.action),
      ledgerCleared: clearDocketRun(state, plan).cleared,
      messageActions: A.map(plan.messages, (target) => target.action),
      runId: plan.runId,
    })
);

const eventLineKind = DocketUndoEventAction.$match({
  delete: () => DocketJournalKind.Enum["undo-event-deleted"],
  gone: () => DocketJournalKind.Enum["undo-event-gone"],
  keep: () => DocketJournalKind.Enum["undo-event-kept"],
});

const messageLineKind = DocketUndoMessageAction.$match({
  gone: () => DocketJournalKind.Enum["undo-message-gone"],
  unmark: () => DocketJournalKind.Enum["undo-message-unmarked"],
});

/**
 * Carry out an undo plan, then remove the run's messages from the ledger.
 *
 * **Details**
 *
 * Each event planned for deletion is deleted; one that is gone by then
 * counts as gone. Each message has `Docket - entered` removed and keeps
 * every other category; the write is conditional on the message's change
 * key and is retried once from a fresh read when the message changed in
 * between. Every event and message gets an `undo-` line in the journal,
 * under the undone run's id, as soon as it is done, so an undo that stops
 * halfway can simply be run again. The ledger is cleared last, under the
 * store the caller holds the lock of.
 *
 * **Example** (Apply an undo plan)
 *
 * ```ts
 * import { applyDocketUndo, DocketRunId, DocketUndoPlan } from "@beep/law-practice-server/DocketIntake";
 *
 * const plan = DocketUndoPlan.make({ events: [], messages: [], runId: DocketRunId.make("run-20300109T100000000Z") });
 * console.log(applyDocketUndo({ mailbox: "mailbox-id", plan }));
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const applyDocketUndo: (input: {
  readonly mailbox: string;
  readonly plan: DocketUndoPlan;
}) => Effect.Effect<DocketUndoReport, DocketIntakeError, DocketIntakeJournal | DocketIntakeStore | M365> = Effect.fn(
  "DocketUndo.apply"
)(function* (input) {
  const { plan } = input;
  const m365 = yield* M365;
  const journal = yield* DocketIntakeJournal;
  const store = yield* DocketIntakeStore;
  const userId = O.some(input.mailbox);

  const record = Effect.fnUntraced(function* (
    fields: Pick<ConstructorParameters<typeof DocketJournalEntry>[0], "eventId" | "kind" | "messageId">
  ) {
    const at = yield* DateTime.now;
    yield* journal.append([DocketJournalEntry.make({ ...fields, at, runId: plan.runId })]);
  });

  const eventActions = yield* Effect.forEach(
    plan.events,
    Effect.fnUntraced(function* (target) {
      const action =
        target.action === "delete"
          ? yield* orGone(
              m365
                .deleteEvent(M365DeleteEventRequest.make({ eventId: target.eventId, userId }))
                .pipe(Effect.as(DocketUndoEventAction.Enum.delete)),
              DocketUndoEventAction.Enum.gone,
              "calendar"
            )
          : target.action;
      yield* record({ eventId: O.some(target.eventId), kind: eventLineKind(action) });
      return action;
    })
  );
  const messageActions = yield* Effect.forEach(
    plan.messages,
    Effect.fnUntraced(function* (target) {
      const action =
        target.action === "unmark"
          ? yield* orGone(
              rewriteMessageCategories({
                edit: A.filter((category) => category !== ENTERED_CATEGORY),
                m365,
                mailbox: input.mailbox,
                messageId: target.messageId,
              }).pipe(Effect.as(DocketUndoMessageAction.Enum.unmark)),
              DocketUndoMessageAction.Enum.gone,
              "mailbox"
            )
          : target.action;
      yield* record({ kind: messageLineKind(action), messageId: O.some(target.messageId) });
      return action;
    })
  );

  const cleared = clearDocketRun(yield* store.load, plan);
  yield* store.save(cleared.state);
  return reportOf({ dryRun: false, eventActions, ledgerCleared: cleared.cleared, messageActions, runId: plan.runId });
});
