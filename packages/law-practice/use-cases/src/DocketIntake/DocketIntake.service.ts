/**
 * The docket intake pipeline: classify, enter, review, resolve the date, look
 * the matter up, and make sure the tentative calendar entries exist.
 *
 * The pipeline never guesses a date, puts an entry on the earlier of two
 * differing dates, and prefers a needs-review entry to silence. Re-processing
 * a message is harmless: every entry is looked up by its idempotency key
 * before it is created.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  addDocketResponsePeriod,
  DOCKET_REMINDER_OFFSETS,
  DocketDueDateCandidates,
  docketDatesDiffer,
  docketReminderLadder,
  resolveDocketDueDate,
} from "@beep/law-practice-domain/values/DocketDeadline";
import { addDays, isAfter, isBefore, LocalDateFromString, equals as sameDate } from "@beep/schema/LocalDate";
import { Context, DateTime, Effect, HashSet, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  DocketCalendar,
  DocketIntakeError,
  DocketIntakeStore,
  DocketMailbox,
  DocketMatterLookup,
  DocketParalegal,
  DocketSecretary,
} from "./DocketIntake.ports.ts";
import {
  DocketCalendarEntry,
  DocketEntered,
  DocketIntakeOutcome,
  DocketIntakeState,
  DocketLedgerRecord,
  DocketNeedsReview,
  IntakeFailed,
  MatterLookupResult,
  NotDocketItem,
  ParalegalEntry,
} from "./DocketIntake.schemas.ts";
import type {
  DocketDueDate,
  DocketReminderRung,
  DocketResponsePeriod,
} from "@beep/law-practice-domain/values/DocketDeadline";
import type { LocalDate } from "@beep/schema/LocalDate";
import type {
  DocketCalendarShape,
  DocketIntakeStoreShape,
  DocketMailboxShape,
  DocketMatterLookupShape,
  DocketParalegalShape,
  DocketSecretaryShape,
} from "./DocketIntake.ports.ts";
import type {
  DocketEntryFlag,
  DocketEntryKind,
  DocketMessage,
  DocketNeedsReviewReason,
  DocketWrittenEntry,
  ParalegalDocketEntry,
  SecretaryReview,
} from "./DocketIntake.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketIntake.service");

const PositiveAttempts = S.Int.check(S.isBetween({ maximum: 20, minimum: 1 }));

const docketIntakeConfigMaxAttemptsDefault = 3;
const docketIntakeConfigOverlapMinutesDefault = 120;

/**
 * Settings of the docket intake pipeline.
 *
 * **Example** (Make a config)
 *
 * ```ts
 * import { DocketIntakeConfig } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const config = DocketIntakeConfig.make({ mailbox: "mailbox-id" });
 * console.log(config.reviewNegatives); // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketIntakeConfig extends S.Class<DocketIntakeConfig>($I`DocketIntakeConfig`)(
  {
    mailbox: S.NonEmptyString.annotateKey({
      description: "Mailbox identity; part of every idempotency key and never logged.",
    }),
    maxAttempts: PositiveAttempts.pipe(
      S.withConstructorDefault(Effect.succeed(docketIntakeConfigMaxAttemptsDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketIntakeConfigMaxAttemptsDefault))
    ).annotateKey({
      description: "Attempts after which a message that keeps failing gets a needs-review entry instead.",
    }),
    overlapMinutes: S.Natural.pipe(
      S.withConstructorDefault(Effect.succeed(docketIntakeConfigOverlapMinutesDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketIntakeConfigOverlapMinutesDefault))
    ).annotateKey({ description: "How far behind the cursor each poll re-reads, to catch late-arriving mail." }),
    reviewNegatives: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ).annotateKey({ description: "Whether agent 2 also reviews messages agent 1 found nothing to docket in." }),
  },
  $I.annote("DocketIntakeConfig", { description: "Settings of the docket intake pipeline." })
) {}

/**
 * Counts of one poll cycle. It carries no message content.
 *
 * **Example** (Make a poll report)
 *
 * ```ts
 * import { DocketPollReport } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const report = DocketPollReport.make({ entered: 0, failed: 0, needsReview: 0, notDocket: 0, processed: 0, seen: 0 });
 * console.log(report.seen);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketPollReport extends S.Class<DocketPollReport>($I`DocketPollReport`)(
  {
    entered: S.Natural.annotateKey({ description: "Messages that got a dated entry this cycle." }),
    failed: S.Natural.annotateKey({ description: "Messages that failed this cycle and will be retried." }),
    needsReview: S.Natural.annotateKey({ description: "Messages that got a needs-review entry this cycle." }),
    notDocket: S.Natural.annotateKey({ description: "Messages found to need no entry this cycle." }),
    processed: S.Natural.annotateKey({ description: "Messages processed this cycle." }),
    seen: S.Natural.annotateKey({ description: "Messages the mailbox returned for the poll window." }),
  },
  $I.annote("DocketPollReport", { description: "Counts of one docket intake poll cycle." })
) {}

/**
 * The digest of one day: counts, and the calendar entry written for it when
 * there was something to report.
 *
 * **Example** (Read a digest count)
 *
 * ```ts
 * import type { DocketDigest } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const entered = (digest: DocketDigest) => digest.entered;
 * console.log(entered);
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketDigest extends S.Class<DocketDigest>($I`DocketDigest`)(
  {
    bodyText: S.String.annotateKey({ description: "Digest text: dates, flags and links, no message content." }),
    day: LocalDateFromString.annotateKey({ description: "The day the digest covers." }),
    entered: S.Natural.annotateKey({ description: "Dated entries created that day." }),
    failed: S.Natural.annotateKey({ description: "Messages still failing at the end of that day." }),
    needsReview: S.Natural.annotateKey({ description: "Needs-review entries created that day." }),
    notDocket: S.Natural.annotateKey({ description: "Messages found to need no entry that day." }),
    written: S.Option(S.NonEmptyString).annotateKey({
      description: "Event id of the digest entry, when one was written.",
    }),
  },
  $I.annote("DocketDigest", { description: "The docket intake digest of one day." })
) {}

/**
 * Service shape of the docket intake pipeline.
 *
 * **Example** (Name a pipeline method)
 *
 * ```ts
 * import type { DocketIntakeShape } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const method: keyof DocketIntakeShape = "pollOnce";
 * console.log(method);
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface DocketIntakeShape {
  /** Run one complete poll cycle. The cursor is saved only at its end. */
  readonly pollOnce: (today: LocalDate) => Effect.Effect<DocketPollReport, DocketIntakeError>;
  /** Process one message to its typed outcome. A failed step becomes `IntakeFailed`, never a thrown error. */
  readonly processMessage: (message: DocketMessage, today: LocalDate) => Effect.Effect<DocketIntakeOutcome>;
  /** Write the digest entry for one day and record that the day is digested. */
  readonly writeDigest: (day: LocalDate) => Effect.Effect<DocketDigest, DocketIntakeError>;
}

/**
 * The docket intake pipeline.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { DocketIntake } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * console.log(DocketIntake.key);
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DocketIntake extends Context.Service<DocketIntake, DocketIntakeShape>()($I`DocketIntake`) {}

type Ports = {
  readonly calendar: DocketCalendarShape;
  readonly config: DocketIntakeConfig;
  readonly crypto: Crypto.Crypto;
  readonly lookup: DocketMatterLookupShape;
  readonly mailbox: DocketMailboxShape;
  readonly paralegal: DocketParalegalShape;
  readonly secretary: DocketSecretaryShape;
  readonly store: DocketIntakeStoreShape;
};

const textEncoder = new TextEncoder();
const KEY_HEX_LENGTH = 40;

// One key per (mailbox, message, kind, rung). The date is deliberately not part of it:
// a message that is re-read with a different date must not produce a second entry.
const entryKey = Effect.fnUntraced(function* (
  ports: Ports,
  identity: string,
  kind: DocketEntryKind,
  discriminator: string
): Effect.fn.Return<string, DocketIntakeError> {
  const digest = yield* ports.crypto
    .digest("SHA-256", textEncoder.encode(A.join([ports.config.mailbox, identity, kind, discriminator], "\n")))
    .pipe(Effect.mapError(() => DocketIntakeError.make({ cause: "digest", stage: "calendar" })));
  return `docket:${Str.slice(0, KEY_HEX_LENGTH)(Hex.encode(digest))}`;
});

const messageIdentity = (message: DocketMessage): string =>
  O.getOrElse(message.internetMessageId, () => message.messageId);

const ensureEntry = Effect.fnUntraced(function* (
  ports: Ports,
  entry: DocketCalendarEntry
): Effect.fn.Return<DocketWrittenEntry, DocketIntakeError> {
  const existing = yield* ports.calendar.findByKey(entry.key);
  if (O.isSome(existing)) {
    return existing.value;
  }

  return yield* ports.calendar.create(entry).pipe(
    Effect.catchIf(
      (error) => error.ambiguousWrite,
      (error) =>
        ports.calendar.findByKey(entry.key).pipe(
          Effect.flatMap(
            O.match({
              onNone: () => Effect.fail(error),
              onSome: Effect.succeed,
            })
          )
        )
    )
  );
});

const iso = (date: LocalDate): string => date.toISOString();

const periodText = (period: DocketResponsePeriod): string => `${period.amount} ${period.unit}`;

const computedFrom = (source: {
  readonly mailDate: O.Option<LocalDate>;
  readonly responsePeriod: O.Option<DocketResponsePeriod>;
}): O.Option<LocalDate> =>
  O.map(O.all({ mailDate: source.mailDate, period: source.responsePeriod }), (both) =>
    addDocketResponsePeriod(both.mailDate, both.period)
  );

// The paralegal's date is the due date the message states, or failing that its own mail date plus period.
const paralegalDate = (entry: ParalegalDocketEntry): O.Option<LocalDate> =>
  O.orElse(entry.statedDueDate, () => computedFrom(entry));

const basisText = (dueDate: DocketDueDate): string =>
  docketDatesDiffer(dueDate) ? "the earlier of two differing dates" : `basis: ${dueDate.basis}`;

const derivationText = (source: {
  readonly mailDate: O.Option<LocalDate>;
  readonly responsePeriod: O.Option<DocketResponsePeriod>;
}): string =>
  pipe(
    O.all({ mailDate: source.mailDate, period: source.responsePeriod }),
    O.match({
      onNone: () => "",
      onSome: (both) => ` (mail date ${iso(both.mailDate)} + ${periodText(both.period)})`,
    })
  );

const dateLine = (label: string, date: O.Option<LocalDate>, derivation: string): string =>
  pipe(
    date,
    O.match({
      onNone: () => `${label}: none found`,
      onSome: (value) => `${label}: ${iso(value)}${derivation}`,
    })
  );

const matterLine: (matter: O.Option<MatterLookupResult>) => string = O.match({
  onNone: () => "Matter: lookup unavailable; needs attorney",
  onSome: MatterLookupResult.match({
    MatterAmbiguous: (matter) => `Matter: ambiguous between ${A.join(matter.familyKeys, ", ")}; needs attorney`,
    MatterNotFound: () => "Matter: not found in the practice records; needs attorney",
    MatterUnique: (matter) =>
      A.join(
        A.filter(
          [
            `Matter: family ${matter.familyKey}${matter.verified ? "" : " (unverified; needs attorney)"}`,
            O.match(matter.client, { onNone: () => "", onSome: (client) => `client ${client}` }),
            A.isReadonlyArrayNonEmpty(matter.dockets) ? `dockets ${A.join(matter.dockets, ", ")}` : "",
            A.isReadonlyArrayNonEmpty(matter.applications) ? `applications ${A.join(matter.applications, ", ")}` : "",
            A.isReadonlyArrayNonEmpty(matter.patents) ? `patents ${A.join(matter.patents, ", ")}` : "",
          ],
          Str.isNonEmpty
        ),
        " · "
      ),
  }),
});

const matterFlags: (matter: O.Option<MatterLookupResult>) => ReadonlyArray<DocketEntryFlag> = O.match({
  onNone: (): ReadonlyArray<DocketEntryFlag> => ["matter-lookup-failed"],
  onSome: MatterLookupResult.match({
    MatterAmbiguous: (): ReadonlyArray<DocketEntryFlag> => ["matter-ambiguous"],
    MatterNotFound: (): ReadonlyArray<DocketEntryFlag> => ["matter-not-found"],
    MatterUnique: (matter): ReadonlyArray<DocketEntryFlag> => (matter.verified ? [] : ["matter-unverified"]),
  }),
});

const flagsLine = (flags: ReadonlyArray<DocketEntryFlag>): string =>
  A.isReadonlyArrayNonEmpty(flags) ? `Check: ${A.join(flags, ", ")}` : "Check: nothing flagged";

const sourceLine = (message: DocketMessage): string =>
  O.match(message.webLink, {
    onNone: () => "Source email: link unavailable",
    onSome: (link) => `Source email: ${link}`,
  });

const NOMINAL_NOTE = "Dates are nominal: not adjusted for weekends, holidays, closures or extensions.";
const TENTATIVE_NOTE =
  "Tentative docket entry created automatically. Confirm or correct it here; this calendar is the record.";

const bodyOf = (lines: ReadonlyArray<string>): string => A.join(lines, "\n");

const whenFlag = (condition: boolean, flag: DocketEntryFlag): ReadonlyArray<DocketEntryFlag> =>
  condition ? [flag] : [];

const matterReferences = (entry: ParalegalEntry, review: SecretaryReview): ReadonlyArray<string> =>
  pipe(
    ParalegalEntry.match(entry, {
      ParalegalDocketEntry: (docket) => docket.matterReferences,
      ParalegalNotDocketItem: (): ReadonlyArray<string> => [],
    }),
    A.appendAll(review.matterReferences),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    HashSet.fromIterable,
    A.fromIterable
  );

// A matter lookup that fails must not cost the attorney the entry: it becomes a flag.
const lookupMatter = (ports: Ports, references: ReadonlyArray<string>): Effect.Effect<O.Option<MatterLookupResult>> =>
  ports.lookup.lookup(references).pipe(
    Effect.asSome,
    Effect.catch(() => Effect.succeedNone)
  );

const needsReviewDate = (message: DocketMessage, today: LocalDate): LocalDate => {
  const dayAfterReceipt = addDays(message.receivedDate, 1);
  return isBefore(dayAfterReceipt, today) ? today : dayAfterReceipt;
};

const writeNeedsReview = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  input: {
    readonly flags: ReadonlyArray<DocketEntryFlag>;
    readonly lines: ReadonlyArray<string>;
    readonly reason: DocketNeedsReviewReason;
    readonly title: string;
  }
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const key = yield* entryKey(ports, messageIdentity(message), "needs-review", "0");
  const entry = yield* ensureEntry(
    ports,
    DocketCalendarEntry.make({
      bodyText: bodyOf([
        "A message looks like a docket item but no dated entry could be made. Please read it.",
        `Reason: ${input.reason}`,
        ...input.lines,
        flagsLine(input.flags),
        sourceLine(message),
      ]),
      category: "Docket - needs review",
      date: needsReviewDate(message, today),
      key,
      kind: "needs-review",
      subject: S.NonEmptyString.make(`[NEEDS REVIEW] ${input.title}`),
      tentative: true,
    })
  );
  yield* Effect.ignore(ports.mailbox.markEntered(message));
  return DocketNeedsReview.make({ entry, flags: input.flags, messageId: message.messageId, reason: input.reason });
});

const reminderEntry = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  title: string,
  dueDate: LocalDate,
  rung: DocketReminderRung
): Effect.fn.Return<DocketWrittenEntry, DocketIntakeError> {
  const key = yield* entryKey(ports, messageIdentity(message), "reminder", `${rung.daysBefore}`);
  return yield* ensureEntry(
    ports,
    DocketCalendarEntry.make({
      bodyText: bodyOf([
        `Reminder: ${rung.daysBefore} day(s) before a tentative docket date of ${iso(dueDate)}.`,
        NOMINAL_NOTE,
        sourceLine(message),
      ]),
      category: "Docket - reminder",
      date: rung.date,
      key,
      kind: "reminder",
      subject: S.NonEmptyString.make(`[Docket reminder: ${rung.daysBefore}d] ${title} (due ${iso(dueDate)})`),
      tentative: false,
    })
  );
});

const enterDocketItem = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  entry: ParalegalDocketEntry,
  review: SecretaryReview,
  hasDocuments: boolean
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const stated = paralegalDate(entry);
  const computed = computedFrom(review);
  const matter = yield* lookupMatter(ports, matterReferences(entry, review));
  const sourceFlags = whenFlag(!hasDocuments || !review.readFromSourceDocument, "source-document-missing");
  const dateLines = [
    dateLine(
      "Date from the email (paralegal entry)",
      stated,
      O.isSome(entry.statedDueDate) ? "" : derivationText(entry)
    ),
    dateLine("Date recomputed by the reviewer", computed, derivationText(review)),
  ];
  const noteLines = [`Paralegal note: ${entry.rationale}`, `Reviewer note: ${review.notes}`];
  const resolved = resolveDocketDueDate(DocketDueDateCandidates.make({ computed, stated }));

  if (O.isNone(resolved)) {
    return yield* writeNeedsReview(ports, message, today, {
      flags: A.appendAll(matterFlags(matter), sourceFlags),
      lines: [...dateLines, matterLine(matter), ...noteLines],
      reason: "no-usable-date",
      title: entry.title,
    });
  }

  const dueDate = resolved.value;
  const ladder = docketReminderLadder(dueDate.date, today);
  const flags = A.dedupe([
    ...whenFlag(docketDatesDiffer(dueDate), "dates-differ"),
    ...matterFlags(matter),
    ...sourceFlags,
    ...whenFlag(ladder.truncated, "ladder-truncated"),
    ...whenFlag(isBefore(dueDate.date, today), "due-date-past"),
  ]);
  const key = yield* entryKey(ports, messageIdentity(message), "due", "0");
  const written = yield* ensureEntry(
    ports,
    DocketCalendarEntry.make({
      bodyText: bodyOf([
        TENTATIVE_NOTE,
        "",
        `Date used: ${iso(dueDate.date)} (${basisText(dueDate)})`,
        ...dateLines,
        NOMINAL_NOTE,
        "",
        matterLine(matter),
        flagsLine(flags),
        `Reminders: ${
          A.join(
            A.map(ladder.rungs, (rung) => `${rung.daysBefore}d`),
            ", "
          ) || "none ahead"
        } of ${A.join(
          A.map(DOCKET_REMINDER_OFFSETS, (offset) => `${offset}d`),
          "/"
        )}`,
        sourceLine(message),
        ...noteLines,
      ]),
      category: "Docket - unverified",
      date: dueDate.date,
      key,
      kind: "due",
      subject: S.NonEmptyString.make(`[UNVERIFIED] ${entry.title}`),
      tentative: true,
    })
  );
  const reminders = yield* Effect.forEach(ladder.rungs, (rung) =>
    reminderEntry(ports, message, entry.title, dueDate.date, rung)
  );
  yield* Effect.ignore(ports.mailbox.markEntered(message));
  return DocketEntered.make({ dueDate, entry: written, flags, messageId: message.messageId, reminders });
});

const isDocketEntry = S.is(ParalegalEntry.cases.ParalegalDocketEntry);

const verdict = (isDocketItem: boolean): string => (isDocketItem ? "docket item" : "not a docket item");

// The agents disagree about whether this is a docket item at all. Missing one is worse
// than a spurious entry, so the attorney gets to decide.
const escalateDisagreement = (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  entry: ParalegalEntry,
  review: SecretaryReview
): Effect.Effect<DocketIntakeOutcome, DocketIntakeError> =>
  writeNeedsReview(ports, message, today, {
    flags: [],
    lines: [
      `Paralegal: ${verdict(isDocketEntry(entry))} (${entry.rationale})`,
      `Reviewer: ${verdict(review.isDocketItem)} (${review.notes})`,
    ],
    reason: "agents-disagree",
    title: isDocketEntry(entry) ? entry.title : "Possible docket item",
  });

const reviewOf = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  entry: ParalegalEntry
): Effect.fn.Return<{ readonly hasDocuments: boolean; readonly review: SecretaryReview }, DocketIntakeError> {
  const documents = yield* ports.mailbox.sourceDocuments(message);
  const review = yield* ports.secretary.review({ documents, entry, message });
  return { hasDocuments: A.isReadonlyArrayNonEmpty(documents), review };
});

const reviewEntered = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  entry: ParalegalDocketEntry
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const { hasDocuments, review } = yield* reviewOf(ports, message, entry);
  return yield* review.isDocketItem
    ? enterDocketItem(ports, message, today, entry, review, hasDocuments)
    : escalateDisagreement(ports, message, today, entry, review);
});

const reviewDismissed = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  entry: ParalegalEntry
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const notDocketItem = NotDocketItem.make({ messageId: message.messageId });
  if (!ports.config.reviewNegatives) {
    return notDocketItem;
  }
  const { review } = yield* reviewOf(ports, message, entry);
  return review.isDocketItem ? yield* escalateDisagreement(ports, message, today, entry, review) : notDocketItem;
});

const processOrFail = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const entry = yield* ports.paralegal.enter(message);
  return yield* isDocketEntry(entry)
    ? reviewEntered(ports, message, today, entry)
    : reviewDismissed(ports, message, today, entry);
});

const isFailed = S.is(DocketIntakeOutcome.cases.IntakeFailed);

const isSettled = (record: O.Option<DocketLedgerRecord>): boolean =>
  O.exists(record, (value) => !isFailed(value.outcome));

// After the retry budget, a message that still cannot be read gets a needs-review entry so it
// is not silently dropped. A failing calendar cannot take that entry either, so it keeps retrying.
const settleExhausted = (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  outcome: DocketIntakeOutcome,
  attempts: number
): Effect.Effect<DocketIntakeOutcome> =>
  isFailed(outcome) && attempts >= ports.config.maxAttempts && outcome.stage !== "calendar"
    ? writeNeedsReview(ports, message, today, {
        flags: [],
        lines: [`The message could not be processed automatically (stage: ${outcome.stage}, ${attempts} attempts).`],
        reason: "processing-failed",
        title: "Message could not be processed",
      }).pipe(Effect.orElseSucceed(() => outcome))
    : Effect.succeed(outcome);

const subtractMinutes = (timestamp: string, minutes: number): string =>
  pipe(
    DateTime.make(timestamp),
    O.map((value) => DateTime.formatIso(DateTime.subtract(value, { minutes }))),
    O.getOrElse(() => timestamp)
  );

const laterTimestamp = (left: O.Option<string>, right: O.Option<string>): O.Option<string> =>
  pipe(
    O.all({ left, right }),
    O.match({
      onNone: () => O.orElse(left, () => right),
      onSome: (both) => O.some(Str.Order(both.left, both.right) >= 0 ? both.left : both.right),
    })
  );

const count = (outcomes: ReadonlyArray<DocketIntakeOutcome>, tag: DocketIntakeOutcome["_tag"]): number =>
  A.length(A.filter(outcomes, (outcome) => outcome._tag === tag));

const digestLine: (outcome: DocketIntakeOutcome) => O.Option<string> = DocketIntakeOutcome.match({
  DocketEntered: (outcome) =>
    O.some(
      A.join(
        [
          `- ${iso(outcome.dueDate.date)} tentative entry`,
          flagsLine(outcome.flags),
          O.getOrElse(outcome.entry.webLink, () => `event ${outcome.entry.eventId}`),
        ],
        " · "
      )
    ),
  DocketNeedsReview: (outcome) =>
    O.some(
      A.join(
        [
          `- NEEDS REVIEW (${outcome.reason})`,
          O.getOrElse(outcome.entry.webLink, () => `event ${outcome.entry.eventId}`),
        ],
        " · "
      )
    ),
  IntakeFailed: (outcome) => O.some(`- still failing at stage ${outcome.stage}; will be retried`),
  NotDocketItem: () => O.none(),
});

type PollProgress = {
  readonly outcomes: ReadonlyArray<DocketIntakeOutcome>;
  readonly state: DocketIntakeState;
};

const makeService = (ports: Ports): DocketIntakeShape => {
  const processMessage: DocketIntakeShape["processMessage"] = Effect.fn("DocketIntake.processMessage")(
    function* (message, today) {
      const outcome = yield* processOrFail(ports, message, today).pipe(
        Effect.catch((error) => Effect.succeed(IntakeFailed.make({ messageId: message.messageId, stage: error.stage })))
      );
      yield* Effect.annotateCurrentSpan({ docket_outcome: outcome._tag });
      return outcome;
    }
  );

  return {
    pollOnce: Effect.fn("DocketIntake.pollOnce")(function* (today) {
      const loaded = yield* ports.store.load;
      const since = O.map(loaded.cursor, (cursor) => subtractMinutes(cursor, ports.config.overlapMinutes));
      const messages = yield* ports.mailbox.receivedSince(since);
      const ordered = A.sort(messages, (left: DocketMessage, right: DocketMessage) =>
        Str.Order(left.receivedAt, right.receivedAt)
      );
      const pending = A.filter(ordered, (message) => !isSettled(R.get(loaded.ledger, message.messageId)));

      const final = yield* Effect.reduce(
        pending,
        (): PollProgress => ({ outcomes: A.empty<DocketIntakeOutcome>(), state: loaded }),
        Effect.fnUntraced(function* (accumulator: PollProgress, message: DocketMessage) {
          const attempts =
            O.match(R.get(accumulator.state.ledger, message.messageId), {
              onNone: () => 0,
              onSome: (record) => record.attempts,
            }) + 1;
          const outcome = yield* processMessage(message, today).pipe(
            Effect.flatMap((processed) => settleExhausted(ports, message, today, processed, attempts))
          );
          const state = DocketIntakeState.make({
            cursor: accumulator.state.cursor,
            digestedThrough: accumulator.state.digestedThrough,
            ledger: R.set(
              accumulator.state.ledger,
              message.messageId,
              DocketLedgerRecord.make({
                attempts,
                outcome,
                processedOn: today,
                receivedAt: message.receivedAt,
              })
            ),
          });
          // The ledger is saved as it grows; the cursor only moves at the end of the cycle.
          yield* ports.store.save(state);
          return { outcomes: A.append(accumulator.outcomes, outcome), state };
        })
      );

      // The cursor advances over the leading run of settled messages: a message still failing
      // holds it back, so the next poll reads that message again.
      const settledRun = A.takeWhile(ordered, (message) => isSettled(R.get(final.state.ledger, message.messageId)));
      const cursor = laterTimestamp(
        final.state.cursor,
        O.map(A.last(settledRun), (message) => message.receivedAt)
      );
      const horizon = O.map(cursor, (value) => subtractMinutes(value, ports.config.overlapMinutes));
      // A record is dropped once its message can no longer be listed again and its day is digested.
      const ledger = R.filter(
        final.state.ledger,
        (record) =>
          O.exists(horizon, (value) => Str.Order(record.receivedAt, value) >= 0) ||
          !O.exists(final.state.digestedThrough, (day) => !isAfter(record.processedOn, day))
      );
      yield* ports.store.save(DocketIntakeState.make({ cursor, digestedThrough: final.state.digestedThrough, ledger }));

      const report = DocketPollReport.make({
        entered: count(final.outcomes, "DocketEntered"),
        failed: count(final.outcomes, "IntakeFailed"),
        needsReview: count(final.outcomes, "DocketNeedsReview"),
        notDocket: count(final.outcomes, "NotDocketItem"),
        processed: A.length(final.outcomes),
        seen: A.length(messages),
      });
      yield* Effect.annotateCurrentSpan({
        docket_entered: report.entered,
        docket_failed: report.failed,
        docket_needs_review: report.needsReview,
        docket_processed: report.processed,
        docket_seen: report.seen,
      });
      return report;
    }),
    processMessage,
    writeDigest: Effect.fn("DocketIntake.writeDigest")(function* (day) {
      const state = yield* ports.store.load;
      const outcomes = pipe(
        R.values(state.ledger),
        A.filter((record) => sameDate(record.processedOn, day)),
        A.map((record) => record.outcome)
      );
      const entered = count(outcomes, "DocketEntered");
      const needsReview = count(outcomes, "DocketNeedsReview");
      const failed = count(outcomes, "IntakeFailed");
      const notDocket = count(outcomes, "NotDocketItem");
      const bodyText = bodyOf([
        `Docket intake digest for ${iso(day)}.`,
        `Tentative entries created: ${entered}. Needs review: ${needsReview}. Still failing: ${failed}. Not docket items: ${notDocket}.`,
        "",
        ...A.getSomes(A.map(outcomes, digestLine)),
      ]);
      const written =
        entered + needsReview + failed > 0
          ? yield* pipe(
              entryKey(ports, "digest", "digest", iso(day)),
              Effect.flatMap((key) =>
                ensureEntry(
                  ports,
                  DocketCalendarEntry.make({
                    bodyText,
                    category: "Docket - digest",
                    date: day,
                    key,
                    kind: "digest",
                    subject: S.NonEmptyString.make(
                      `[Docket digest] ${entered} entered, ${needsReview} to review, ${failed} failing`
                    ),
                    tentative: false,
                  })
                )
              ),
              Effect.map((entry) => O.some(entry.eventId))
            )
          : O.none<string>();
      yield* ports.store.save(
        DocketIntakeState.make({
          cursor: state.cursor,
          digestedThrough: O.some(day),
          ledger: state.ledger,
        })
      );
      return DocketDigest.make({ bodyText, day, entered, failed, needsReview, notDocket, written });
    }),
  };
};

/**
 * Build the docket intake pipeline over its ports.
 *
 * **Example** (Make the pipeline layer)
 *
 * ```ts
 * import { DocketIntakeConfig, makeDocketIntakeLayer } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const layer = makeDocketIntakeLayer(DocketIntakeConfig.make({ mailbox: "mailbox-id" }));
 * console.log(layer);
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const makeDocketIntakeLayer = (
  config: DocketIntakeConfig
): Layer.Layer<
  DocketIntake,
  never,
  | Crypto.Crypto
  | DocketCalendar
  | DocketIntakeStore
  | DocketMailbox
  | DocketMatterLookup
  | DocketParalegal
  | DocketSecretary
> =>
  Layer.effect(
    DocketIntake,
    Effect.gen(function* () {
      return DocketIntake.of(
        makeService({
          calendar: yield* DocketCalendar,
          config,
          crypto: yield* Crypto.Crypto,
          lookup: yield* DocketMatterLookup,
          mailbox: yield* DocketMailbox,
          paralegal: yield* DocketParalegal,
          secretary: yield* DocketSecretary,
          store: yield* DocketIntakeStore,
        })
      );
    })
  );
