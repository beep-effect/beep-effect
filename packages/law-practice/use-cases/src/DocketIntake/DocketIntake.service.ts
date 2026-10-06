/**
 * The docket intake pipeline: classify, enter, review in a bounded loop,
 * resolve the date, look the matter up, and make sure the tentative calendar
 * entries exist.
 *
 * **Details**
 *
 * The pipeline never guesses a date, puts an entry on the earlier of two
 * differing dates, and prefers a needs-review entry to silence. An item the
 * review loop does not accept is flagged for the attorney, never entered as
 * an accepted deadline and never dropped. Re-processing a message is
 * harmless: every entry is looked up by its idempotency key before it is
 * created, and completed review rounds are read back from the ledger.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  DOCKET_REMINDER_OFFSETS,
  DocketDueDateCandidates,
  docketDatesDiffer,
  docketReminderLadder,
  resolveDocketDueDate,
} from "@beep/law-practice-domain/values/DocketDeadline";
import {
  addDays,
  isAfter,
  isBefore,
  LocalDateFromString,
  Order as LocalDateOrder,
  equals as sameDate,
} from "@beep/schema/LocalDate";
import { Context, DateTime, Effect, HashSet, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import * as Num from "effect/Number";
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
  DocketNeedsReviewReason,
  DocketReviewProgress,
  DocketSourceFolder,
  IntakeFailed,
  MatterLookupResult,
  NotDocketItem,
  ParalegalEntry,
} from "./DocketIntake.schemas.ts";
import {
  assessReviewRound,
  criticComputedDueDate,
  extractorDueDate,
  mergeRereading,
  RereadMerge,
  ReviewDecisionInput,
  ReviewRoundDraft,
  rereadFields,
  reviewDisputes,
  reviewGatePassed,
  terminalStatus,
} from "./DocketReview.policy.ts";
import { DocketReviewConfig, ReviewSourceText, ReviewVerdict } from "./DocketReview.schemas.ts";
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
  DocketSourceDocument,
  DocketWrittenEntry,
  ParalegalDocketEntry,
  ReviewRound,
  SecretaryReview,
} from "./DocketIntake.schemas.ts";
import type { ReviewFinding, ReviewTerminalStatus } from "./DocketReview.schemas.ts";

const $I = $LawPracticeUseCasesId.create("DocketIntake/DocketIntake.service");

const PositiveAttempts = S.Int.check(S.isBetween({ maximum: 20, minimum: 1 }));

const docketIntakeConfigMaxAttemptsDefault = 3;
const docketIntakeConfigOverlapMinutesDefault = 120;
const docketIntakeConfigReviewDefault = DocketReviewConfig.make({});

/**
 * Settings of the docket intake pipeline.
 *
 * **Example** (Make a config)
 *
 * ```ts
 * import { DocketIntakeConfig } from "@beep/law-practice-use-cases/DocketIntake";
 *
 * const config = DocketIntakeConfig.make({ mailbox: "mailbox-id" });
 * console.log(config.reviewNegatives, config.review.maxRounds); // true 3
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
    review: DocketReviewConfig.pipe(
      S.withConstructorDefault(Effect.succeed(docketIntakeConfigReviewDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(docketIntakeConfigReviewDefault))
    ).annotateKey({ description: "Round limit and acceptance threshold of the review loop." }),
    reviewNegatives: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    ).annotateKey({ description: "Whether agent 2 also reviews messages agent 1 found nothing to docket in." }),
  },
  $I.annote("DocketIntakeConfig", { description: "Settings of the docket intake pipeline." })
) {}

const PositiveMessageCount = S.Int.check(S.isGreaterThan(0));

/**
 * Options of one poll cycle. With no `maxMessages` the cycle processes every
 * pending message, as it always has.
 *
 * **Details**
 *
 * `maxMessages` bounds a cycle to the oldest pending messages. The rest stay
 * pending for a later cycle, and the cursor never moves past a message that
 * was not processed, because it only advances over settled messages.
 *
 * **Example** (Bound a cycle to five messages)
 *
 * ```ts
 * import { DocketPollOptions } from "@beep/law-practice-use-cases/DocketIntake";
 * import * as O from "effect/Option";
 *
 * const options = DocketPollOptions.make({ maxMessages: O.some(5) });
 * console.log(O.getOrNull(options.maxMessages)); // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocketPollOptions extends S.Class<DocketPollOptions>($I`DocketPollOptions`)(
  {
    maxMessages: S.OptionFromOptionalKey(PositiveMessageCount)
      .pipe(S.withConstructorDefault(Effect.succeedNone))
      .annotateKey({ description: "Most pending messages one cycle processes, oldest first; all when absent." }),
  },
  $I.annote("DocketPollOptions", { description: "Options of one docket intake poll cycle." })
) {}

const unboundedPoll = DocketPollOptions.make({});

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
  /**
   * Run one complete poll cycle. The cursor is saved only at its end. The options may bound the
   * cycle to the oldest pending messages; without them every pending message is processed.
   */
  readonly pollOnce: (
    today: LocalDate,
    options?: DocketPollOptions
  ) => Effect.Effect<DocketPollReport, DocketIntakeError>;
  /**
   * Process one message to its typed outcome. A failed step becomes `IntakeFailed`, never a thrown error.
   * Each completed review round is saved in the message's ledger record as it goes, and rounds already
   * there are read back instead of asking the agents again.
   */
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

// A due date the message states outright has no derivation to show.
const statedDerivation: (entry: ParalegalEntry) => string = ParalegalEntry.match({
  ParalegalDocketEntry: (entry) => (O.isSome(entry.statedDueDate) ? "" : derivationText(entry)),
  ParalegalNotDocketItem: () => "",
});

const titleOf: (entry: ParalegalEntry) => string = ParalegalEntry.match({
  ParalegalDocketEntry: (entry) => entry.title,
  ParalegalNotDocketItem: () => "Possible docket item",
});

const referencesOf: (entry: ParalegalEntry) => ReadonlyArray<string> = ParalegalEntry.match({
  ParalegalDocketEntry: (entry) => entry.matterReferences,
  ParalegalNotDocketItem: A.empty<string>,
});

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

// Mail found in Junk Email or Deleted Items is docketed like any other, and every entry written
// for it says where it was found.
const folderFlags: (folder: DocketSourceFolder) => ReadonlyArray<DocketEntryFlag> = DocketSourceFolder.$match({
  deleted: (): ReadonlyArray<DocketEntryFlag> => ["deleted-folder"],
  junk: (): ReadonlyArray<DocketEntryFlag> => ["junk-folder"],
  mailbox: (): ReadonlyArray<DocketEntryFlag> => [],
});

const folderLines: (folder: DocketSourceFolder) => ReadonlyArray<string> = DocketSourceFolder.$match({
  deleted: () => ["Found in the Deleted Items folder."],
  junk: () => ["Found in the Junk Email folder."],
  mailbox: () => A.empty<string>(),
});

const NOMINAL_NOTE = "Dates are nominal: not adjusted for weekends, holidays, closures or extensions.";
const TENTATIVE_NOTE =
  "Tentative docket entry created automatically. Confirm or correct it here; this calendar is the record.";

const bodyOf = (lines: ReadonlyArray<string>): string => A.join(lines, "\n");

const whenFlag = (condition: boolean, flag: DocketEntryFlag): ReadonlyArray<DocketEntryFlag> =>
  condition ? [flag] : [];

const matterReferences = (entry: ParalegalEntry, review: SecretaryReview): ReadonlyArray<string> =>
  pipe(
    referencesOf(entry),
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

type ReasonText = { readonly intro: string; readonly prefix: string };

const UNDATED: ReasonText = {
  intro: "A message looks like a docket item but no dated entry could be made. Please read it.",
  prefix: "[NEEDS REVIEW]",
};

const FLAGGED_INTRO =
  "A message looks like a docket item but the automatic review did not accept it. Nothing here is confirmed: please read the message and enter it yourself.";

// What the attorney sees first: the subject prefix and the opening line say why the entry exists.
const reasonText: (reason: DocketNeedsReviewReason) => ReasonText = DocketNeedsReviewReason.$match({
  "agents-disagree": () => UNDATED,
  "deterministic-failure": (): ReasonText => ({ intro: FLAGGED_INTRO, prefix: "[CHECK FAILED]" }),
  "flagged-low-confidence": (): ReasonText => ({ intro: FLAGGED_INTRO, prefix: "[LOW CONFIDENCE]" }),
  "flagged-max-rounds": (): ReasonText => ({ intro: FLAGGED_INTRO, prefix: "[REVIEW LIMIT REACHED]" }),
  "no-usable-date": () => UNDATED,
  "processing-failed": () => UNDATED,
});

const writeNeedsReview = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  input: {
    readonly date: O.Option<LocalDate>;
    readonly flags: ReadonlyArray<DocketEntryFlag>;
    readonly lines: ReadonlyArray<string>;
    readonly reason: DocketNeedsReviewReason;
    readonly review: O.Option<ReviewVerdict>;
    readonly title: string;
  }
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const key = yield* entryKey(ports, messageIdentity(message), "needs-review", "0");
  const flags = A.appendAll(input.flags, folderFlags(message.sourceFolder));
  const text = reasonText(input.reason);
  const entry = yield* ensureEntry(
    ports,
    DocketCalendarEntry.make({
      bodyText: bodyOf([
        text.intro,
        `Reason: ${input.reason}`,
        ...input.lines,
        flagsLine(flags),
        ...folderLines(message.sourceFolder),
        sourceLine(message),
      ]),
      category: "Docket - needs review",
      date: O.getOrElse(input.date, () => needsReviewDate(message, today)),
      key,
      kind: "needs-review",
      subject: S.NonEmptyString.make(`${text.prefix} ${input.title}`),
      tentative: true,
    })
  );
  yield* Effect.ignore(ports.mailbox.markEntered(message));
  return DocketNeedsReview.make({
    entry,
    flags,
    messageId: message.messageId,
    reason: input.reason,
    review: input.review,
  });
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
        ...folderLines(message.sourceFolder),
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

// The reviewer's stated date is shown only when it read one; its computed date always has a line.
const dateLines = (entry: ParalegalEntry, reading: SecretaryReview): ReadonlyArray<string> => [
  dateLine("Date from the email (paralegal entry)", extractorDueDate(entry), statedDerivation(entry)),
  ...A.map(
    A.fromOption(reading.statedDueDate),
    (date) => `Due date the reviewer read stated in the source: ${iso(date)}`
  ),
  dateLine("Date recomputed by the reviewer", criticComputedDueDate(reading), derivationText(reading)),
];

const earliestDate = (dates: ReadonlyArray<LocalDate>): O.Option<LocalDate> =>
  O.map(O.liftPredicate(dates, A.isReadonlyArrayNonEmpty), A.min(LocalDateOrder));

// Both dates the reviewer has: the one it read stated and the one its mail date and period give.
// When they differ the earlier one is the reviewer's candidate.
const criticDates = (reading: SecretaryReview): ReadonlyArray<LocalDate> =>
  A.getSomes([reading.statedDueDate, criticComputedDueDate(reading)]);

const noteLines = (entry: ParalegalEntry, reading: SecretaryReview): ReadonlyArray<string> => [
  `Paralegal note: ${entry.rationale}`,
  `Reviewer note: ${reading.notes}`,
];

const sourceFlags = (reading: SecretaryReview, hasDocuments: boolean): ReadonlyArray<DocketEntryFlag> =>
  whenFlag(!hasDocuments || !reading.readFromSourceDocument, "source-document-missing");

const enterDocketItem = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  input: {
    readonly entry: ParalegalDocketEntry;
    readonly hasDocuments: boolean;
    readonly review: SecretaryReview;
    readonly verdict: ReviewVerdict;
  }
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const { entry, review, verdict } = input;
  const matter = yield* lookupMatter(ports, matterReferences(entry, review));
  const missingSource = sourceFlags(review, input.hasDocuments);
  const resolved = resolveDocketDueDate(
    DocketDueDateCandidates.make({ computed: earliestDate(criticDates(review)), stated: extractorDueDate(entry) })
  );

  if (O.isNone(resolved)) {
    return yield* writeNeedsReview(ports, message, today, {
      date: O.none(),
      flags: A.appendAll(matterFlags(matter), missingSource),
      lines: [...dateLines(entry, review), matterLine(matter), ...noteLines(entry, review)],
      reason: "no-usable-date",
      review: O.some(verdict),
      title: entry.title,
    });
  }

  const dueDate = resolved.value;
  const ladder = docketReminderLadder(dueDate.date, today);
  const flags = A.dedupe([
    ...whenFlag(docketDatesDiffer(dueDate), "dates-differ"),
    ...matterFlags(matter),
    ...missingSource,
    ...whenFlag(ladder.truncated, "ladder-truncated"),
    ...whenFlag(isBefore(dueDate.date, today), "due-date-past"),
    ...folderFlags(message.sourceFolder),
  ]);
  const key = yield* entryKey(ports, messageIdentity(message), "due", "0");
  const written = yield* ensureEntry(
    ports,
    DocketCalendarEntry.make({
      bodyText: bodyOf([
        TENTATIVE_NOTE,
        "",
        `Date used: ${iso(dueDate.date)} (${basisText(dueDate)})`,
        ...dateLines(entry, review),
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
        ...folderLines(message.sourceFolder),
        sourceLine(message),
        ...noteLines(entry, review),
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
  return DocketEntered.make({
    dueDate,
    entry: written,
    flags,
    messageId: message.messageId,
    reminders,
    review: O.some(verdict),
  });
});

const isDocketEntry = S.is(ParalegalEntry.cases.ParalegalDocketEntry);

const verdictText = (isDocketItem: boolean): string => (isDocketItem ? "docket item" : "not a docket item");

// The review accepted the round although the agents still disagree about whether this is a
// docket item at all. Missing one is worse than a spurious entry, so the attorney gets to decide.
const escalateDisagreement = (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate,
  round: ReviewRound,
  verdict: ReviewVerdict
): Effect.Effect<DocketIntakeOutcome, DocketIntakeError> =>
  writeNeedsReview(ports, message, today, {
    date: O.none(),
    flags: [],
    lines: [
      `Paralegal: ${verdictText(isDocketEntry(round.entry))} (${round.entry.rationale})`,
      `Reviewer: ${verdictText(round.reading.isDocketItem)} (${round.reading.notes})`,
    ],
    reason: "agents-disagree",
    review: O.some(verdict),
    title: titleOf(round.entry),
  });

// Everything one review needs: the ports, the message, and the source documents with the text
// citations are checked against. The documents are read once per processing run.
type ReviewContext = {
  readonly documents: ReadonlyArray<DocketSourceDocument>;
  readonly message: DocketMessage;
  readonly ports: Ports;
  readonly source: ReviewSourceText;
  readonly today: LocalDate;
};

// The text of the attached documents is usable only when every document has it: with part of it
// missing, a citation of the unread part would fail for no reason.
const sourceTextOf = (message: DocketMessage, documents: ReadonlyArray<DocketSourceDocument>): ReviewSourceText =>
  ReviewSourceText.make({
    documentText: O.map(O.all(A.map(documents, (document) => document.text)), A.join("\n")),
    hasDocuments: A.isReadonlyArrayNonEmpty(documents),
    messageText: `${O.getOrElse(message.subject, () => "")}\n${message.bodyText}`,
  });

const contextOf = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate
): Effect.fn.Return<ReviewContext, DocketIntakeError> {
  const documents = yield* ports.mailbox.sourceDocuments(message);
  return { documents, message, ports, source: sourceTextOf(message, documents), today };
});

const bothDismiss = (entry: ParalegalEntry, reading: SecretaryReview): boolean =>
  !isDocketEntry(entry) && !reading.isDocketItem;

// When both agents find nothing to docket there is no entry to find fault with.
const critiqueOf = (
  context: ReviewContext,
  entry: ParalegalEntry,
  reading: SecretaryReview
): Effect.Effect<ReadonlyArray<ReviewFinding>, DocketIntakeError> =>
  bothDismiss(entry, reading)
    ? Effect.succeed(A.empty<ReviewFinding>())
    : context.ports.secretary.critique({ documents: context.documents, entry, message: context.message });

// Round 1: the critic reads the message and its documents for itself, then says what is wrong
// with what it is shown of the entry.
const firstRound = Effect.fnUntraced(function* (
  context: ReviewContext,
  entry: ParalegalEntry
): Effect.fn.Return<ReviewRound, DocketIntakeError> {
  const reading = yield* context.ports.secretary.review({
    documents: context.documents,
    entry,
    message: context.message,
  });
  const findings = yield* critiqueOf(context, entry, reading);
  return assessReviewRound(ReviewRoundDraft.make({ entry, findings, index: 1, reading, source: context.source }));
});

// What the critic is shown of an entry. Its dates are deliberately not part of it.
const criticView: (entry: ParalegalEntry) => ReadonlyArray<string> = ParalegalEntry.match({
  ParalegalDocketEntry: (entry) => [entry._tag, entry.title, entry.rationale, ...entry.matterReferences],
  ParalegalNotDocketItem: (entry) => [entry._tag, entry.rationale],
});

const sameCriticView = A.makeEquivalence(Str.Equivalence);

// A later round: the extractor revises or defends the disputed fields, the critic reads the
// fields it can read again, and it is asked for findings again only when what it is shown of the
// entry changed. The same view would only get the same findings.
const nextRound = Effect.fnUntraced(function* (
  context: ReviewContext,
  previous: ReviewRound
): Effect.fn.Return<ReviewRound, DocketIntakeError> {
  const { documents, message, ports } = context;
  const disputes = reviewDisputes(previous);
  const revision = yield* ports.paralegal.revise({ disputes, message, previous: previous.entry });
  const reading = yield* A.match(rereadFields(disputes), {
    onEmpty: () => Effect.succeed(previous.reading),
    onNonEmpty: (fields) =>
      ports.secretary
        .reread({
          documents,
          extractorResponses: revision.responses,
          fields,
          findings: A.filter(previous.findings, (finding) => A.contains(fields, finding.field)),
          message,
        })
        .pipe(Effect.map((reread) => mergeRereading(RereadMerge.make({ fields, previous: previous.reading, reread })))),
  });
  const findings = yield* sameCriticView(criticView(previous.entry), criticView(revision.entry))
    ? Effect.succeed(previous.findings)
    : critiqueOf(context, revision.entry, reading);
  return assessReviewRound(
    ReviewRoundDraft.make({
      entry: revision.entry,
      extractorConfidence: revision.selfReportedConfidence,
      extractorResponse: revision.responses,
      findings,
      index: previous.index + 1,
      reading,
      source: context.source,
    })
  );
});

const storedRounds = (
  ports: Ports,
  message: DocketMessage
): Effect.Effect<ReadonlyArray<ReviewRound>, DocketIntakeError> =>
  ports.store.load.pipe(
    Effect.map((state) =>
      pipe(
        R.get(state.ledger, message.messageId),
        O.flatMap((record) => record.review),
        O.match({ onNone: A.empty<ReviewRound>, onSome: (review) => review.rounds })
      )
    )
  );

// Each completed round is written to the message's ledger record before the next one starts, so a
// restart continues from the next round. The record is a placeholder until the message settles:
// it reads as "still failing", which is what keeps the cursor behind it.
const persistRounds = Effect.fnUntraced(function* (
  context: ReviewContext,
  rounds: ReadonlyArray<ReviewRound>
): Effect.fn.Return<void, DocketIntakeError> {
  const { message, ports } = context;
  const state = yield* ports.store.load;
  yield* ports.store.save(
    DocketIntakeState.make({
      cursor: state.cursor,
      digestedThrough: state.digestedThrough,
      ledger: R.set(
        state.ledger,
        message.messageId,
        DocketLedgerRecord.make({
          attempts: O.getOrElse(
            O.map(R.get(state.ledger, message.messageId), (record) => record.attempts),
            () => 0
          ),
          outcome: IntakeFailed.make({ messageId: message.messageId, stage: "review" }),
          processedOn: context.today,
          receivedAt: message.receivedAt,
          review: O.some(DocketReviewProgress.make({ rounds })),
        })
      ),
    })
  );
});

// How a review ended: both agents dismissed the message, or the loop reached a terminal status.
type ReviewEnd = O.Option<ReviewTerminalStatus>;

const reviewEnd = (config: DocketReviewConfig, rounds: A.NonEmptyReadonlyArray<ReviewRound>): O.Option<ReviewEnd> => {
  const round = A.lastNonEmpty(rounds);
  return bothDismiss(round.entry, round.reading)
    ? O.some(O.none())
    : O.map(
        terminalStatus(
          ReviewDecisionInput.make({
            config,
            earlier: A.initNonEmpty(rounds),
            gatePassed: reviewGatePassed(round.checks),
            isLastRound: round.index >= config.maxRounds,
            round,
          })
        ),
        O.some
      );
};

const score = (value: number): string => `${Num.round(value, 2)}`;

const findingLine = (finding: ReviewFinding): string => `- ${finding.severity} ${finding.field}: ${finding.reason}`;

// What is still open after the last round: failed checks, fields the two readings differ on, and
// the critic's findings.
const openLines = (round: ReviewRound): ReadonlyArray<string> => [
  ...A.map(
    A.filter(round.checks, (check) => !check.passed),
    (check) =>
      `- failed check (${check.side}): ${check.check}${O.getOrElse(
        O.map(check.field, (field) => ` for ${field}`),
        () => ""
      )}`
  ),
  ...A.map(
    A.filter(round.agreement, (field) => !field.agreed),
    (field) => `- the two readings differ on: ${field.field}`
  ),
  ...A.map(round.findings, findingLine),
];

// A flagged item is shown to the attorney, never entered as an accepted deadline: one
// needs-review entry on the earliest date either agent read, with no reminder ladder.
const writeFlagged = Effect.fnUntraced(function* (
  context: ReviewContext,
  round: ReviewRound,
  verdict: ReviewVerdict,
  reason: DocketNeedsReviewReason
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const { message, ports, today } = context;
  const { entry, reading } = round;
  const candidates = [...A.fromOption(extractorDueDate(entry)), ...criticDates(reading)];
  const date = earliestDate(candidates);
  const matter = yield* lookupMatter(ports, matterReferences(entry, reading));
  return yield* writeNeedsReview(ports, message, today, {
    date,
    flags: [
      ...whenFlag(A.length(A.dedupeWith(candidates, sameDate)) > 1, "dates-differ"),
      ...matterFlags(matter),
      ...sourceFlags(reading, A.isReadonlyArrayNonEmpty(context.documents)),
      ...whenFlag(
        O.exists(date, (value) => isBefore(value, today)),
        "due-date-past"
      ),
    ],
    lines: [
      `Review score: ${score(verdict.finalScore)}; needed ${score(verdict.threshold)}. Rounds used: ${verdict.rounds} of ${verdict.maxRounds}.`,
      ...A.map(
        A.fromOption(round.extractorConfidence),
        (confidence) => `Paralegal's own confidence (not part of the score): ${score(confidence)}`
      ),
      "Open findings:",
      ...openLines(round),
      ...dateLines(entry, reading),
      NOMINAL_NOTE,
      matterLine(matter),
      ...noteLines(entry, reading),
    ],
    reason,
    review: O.some(verdict),
    title: titleOf(entry),
  });
});

const settleAccepted = (
  context: ReviewContext,
  round: ReviewRound,
  verdict: ReviewVerdict
): Effect.Effect<DocketIntakeOutcome, DocketIntakeError> =>
  isDocketEntry(round.entry) && round.reading.isDocketItem
    ? enterDocketItem(context.ports, context.message, context.today, {
        entry: round.entry,
        hasDocuments: A.isReadonlyArrayNonEmpty(context.documents),
        review: round.reading,
        verdict,
      })
    : escalateDisagreement(context.ports, context.message, context.today, round, verdict);

const settleReviewed = (
  context: ReviewContext,
  round: ReviewRound,
  status: ReviewTerminalStatus
): Effect.Effect<DocketIntakeOutcome, DocketIntakeError> => {
  const config = context.ports.config.review;
  const verdict = ReviewVerdict.make({
    finalScore: round.score,
    maxRounds: config.maxRounds,
    rounds: round.index,
    status,
    threshold: config.acceptThreshold,
  });
  return Effect.annotateCurrentSpan({
    docket_review_rounds: round.index,
    docket_review_score: round.score,
    docket_review_status: status,
  }).pipe(
    Effect.andThen(
      status === "accepted" ? settleAccepted(context, round, verdict) : writeFlagged(context, round, verdict, status)
    )
  );
};

const settleReview = (
  context: ReviewContext,
  rounds: A.NonEmptyReadonlyArray<ReviewRound>,
  end: ReviewEnd
): Effect.Effect<DocketIntakeOutcome, DocketIntakeError> =>
  O.match(end, {
    onNone: () => Effect.succeed<DocketIntakeOutcome>(NotDocketItem.make({ messageId: context.message.messageId })),
    onSome: (status) => settleReviewed(context, A.lastNonEmpty(rounds), status),
  });

// The bounded loop: decide after each round, and run another only while the review has not ended.
const runReview = (
  context: ReviewContext,
  rounds: A.NonEmptyReadonlyArray<ReviewRound>
): Effect.Effect<DocketIntakeOutcome, DocketIntakeError> =>
  O.match(reviewEnd(context.ports.config.review, rounds), {
    onNone: () =>
      nextRound(context, A.lastNonEmpty(rounds)).pipe(
        Effect.map((round) => A.append(rounds, round)),
        Effect.tap((extended) => persistRounds(context, extended)),
        Effect.flatMap((extended) => runReview(context, extended))
      ),
    onSome: (end) => settleReview(context, rounds, end),
  });

const startReview = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const entry = yield* ports.paralegal.enter(message);
  if (!isDocketEntry(entry) && !ports.config.reviewNegatives) {
    return NotDocketItem.make({ messageId: message.messageId });
  }
  const context = yield* contextOf(ports, message, today);
  const rounds = A.of(yield* firstRound(context, entry));
  yield* persistRounds(context, rounds);
  return yield* runReview(context, rounds);
});

// Rounds already in the ledger are read back, not run again: the agents are asked only for the
// rounds that are still missing.
const processOrFail = Effect.fnUntraced(function* (
  ports: Ports,
  message: DocketMessage,
  today: LocalDate
): Effect.fn.Return<DocketIntakeOutcome, DocketIntakeError> {
  const stored = yield* storedRounds(ports, message);
  return yield* A.match(stored, {
    onEmpty: () => startReview(ports, message, today),
    onNonEmpty: (rounds) =>
      contextOf(ports, message, today).pipe(Effect.flatMap((context) => runReview(context, rounds))),
  });
});

const isFailed = S.is(DocketIntakeOutcome.cases.IntakeFailed);

// A record with review rounds still in it belongs to a review that has not finished.
const isSettled = (record: O.Option<DocketLedgerRecord>): boolean =>
  O.exists(record, (value) => !isFailed(value.outcome) && O.isNone(value.review));

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
        date: O.none(),
        flags: [],
        lines: [`The message could not be processed automatically (stage: ${outcome.stage}, ${attempts} attempts).`],
        reason: "processing-failed",
        review: O.none(),
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

const entryReference = (entry: DocketWrittenEntry): string =>
  O.getOrElse(entry.webLink, () => `event ${entry.eventId}`);

const digestLine: (outcome: DocketIntakeOutcome) => O.Option<string> = DocketIntakeOutcome.match({
  DocketEntered: (outcome) =>
    O.some(
      A.join(
        [`- ${iso(outcome.dueDate.date)} tentative entry`, flagsLine(outcome.flags), entryReference(outcome.entry)],
        " · "
      )
    ),
  DocketNeedsReview: (outcome) =>
    O.some(A.join([`- NEEDS REVIEW (${outcome.reason})`, entryReference(outcome.entry)], " · ")),
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
    pollOnce: Effect.fn("DocketIntake.pollOnce")(function* (today, options = unboundedPoll) {
      const loaded = yield* ports.store.load;
      const since = O.map(loaded.cursor, (cursor) => subtractMinutes(cursor, ports.config.overlapMinutes));
      const messages = yield* ports.mailbox.receivedSince(since);
      const ordered = A.sort(messages, (left: DocketMessage, right: DocketMessage) =>
        Str.Order(left.receivedAt, right.receivedAt)
      );
      const unsettled = A.filter(ordered, (message) => !isSettled(R.get(loaded.ledger, message.messageId)));
      // A bounded cycle takes the oldest pending messages. Those it leaves are unsettled, so the
      // cursor, which only advances over the leading run of settled messages, stops before them.
      const pending = O.match(options.maxMessages, {
        onNone: () => unsettled,
        onSome: (max) => A.take(unsettled, max),
      });

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
          // The review wrote its rounds to the ledger while the message was processed. A message
          // that failed keeps them, so the next attempt continues from the next round; a settled
          // one drops them.
          const latest = yield* ports.store.load;
          const state = DocketIntakeState.make({
            cursor: latest.cursor,
            digestedThrough: latest.digestedThrough,
            ledger: R.set(
              latest.ledger,
              message.messageId,
              DocketLedgerRecord.make({
                attempts,
                outcome,
                processedOn: today,
                receivedAt: message.receivedAt,
                review: isFailed(outcome)
                  ? O.flatMap(R.get(latest.ledger, message.messageId), (record) => record.review)
                  : O.none(),
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
