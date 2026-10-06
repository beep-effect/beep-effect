/**
 * Docket deadline values and the pure date policy of the docket intake
 * overlay.
 *
 * **Details**
 *
 * Nothing here derives a response period from a rule table: a period is only
 * ever one that a source document states. Dates are nominal (no weekend,
 * holiday or closure roll), which is never later than the operative date.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import {
  addDays,
  addMonths,
  isAfter,
  isBefore,
  equals as isSameDate,
  LocalDateFromString,
} from "@beep/schema/LocalDate";
import { pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { LocalDate } from "@beep/schema/LocalDate";

const $I = $LawPracticeDomainId.create("values/DocketDeadline/DocketDeadline.model");

const PositiveCount = S.Int.check(S.isBetween({ maximum: 3660, minimum: 1 })).pipe(
  $I.annoteSchema("PositiveCount", {
    description: "A positive whole number of days or months, bounded to ten years of days.",
  })
);

/**
 * Units a source document states a response period in.
 *
 * **Example** (Guard a unit)
 *
 * ```ts
 * import { DocketResponsePeriodUnit } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * console.log(DocketResponsePeriodUnit.is.months("months")); // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocketResponsePeriodUnit = LiteralKit(["days", "months"]).pipe(
  $I.annoteSchema("DocketResponsePeriodUnit", {
    description: "Unit of a response period as stated by a source document.",
  })
);

/**
 * Type for {@link DocketResponsePeriodUnit}.
 *
 * **Example** (Type a unit)
 *
 * ```ts
 * import type { DocketResponsePeriodUnit } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * const unit: DocketResponsePeriodUnit = "months";
 * console.log(unit);
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type DocketResponsePeriodUnit = typeof DocketResponsePeriodUnit.Type;

/**
 * A response period exactly as a source document states it, for example
 * "three months from the mailing date".
 *
 * **Example** (Make a three-month period)
 *
 * ```ts
 * import { DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * const period = DocketResponsePeriod.make({ amount: 3, unit: "months" });
 * console.log(period.unit); // "months"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DocketResponsePeriod extends S.Class<DocketResponsePeriod>($I`DocketResponsePeriod`)(
  {
    amount: PositiveCount.annotateKey({ description: "How many units the document allows." }),
    unit: DocketResponsePeriodUnit.annotateKey({ description: "Whether the amount counts days or months." }),
  },
  $I.annote("DocketResponsePeriod", {
    description: "A response period as stated by a source document.",
  })
) {}

/**
 * Nominal due date: the mail date plus the stated response period.
 *
 * **Details**
 *
 * Month arithmetic keeps the day of the month and clamps to the last day of a
 * shorter month (30 November plus three months is 28 or 29 February). The
 * result is not rolled past weekends, holidays or office closures.
 *
 * **Example** (Add a three-month period)
 *
 * ```ts
 * import { addDocketResponsePeriod, DocketResponsePeriod } from "@beep/law-practice-domain/values/DocketDeadline";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const due = addDocketResponsePeriod(
 *   LocalDate.make({ year: 2030, month: 11, day: 30 }),
 *   DocketResponsePeriod.make({ amount: 3, unit: "months" })
 * );
 * console.log(due.toISOString()); // "2031-02-28"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const addDocketResponsePeriod: {
  (period: DocketResponsePeriod): (mailDate: LocalDate) => LocalDate;
  (mailDate: LocalDate, period: DocketResponsePeriod): LocalDate;
} = dual(
  2,
  (mailDate: LocalDate, period: DocketResponsePeriod): LocalDate =>
    DocketResponsePeriodUnit.is.months(period.unit)
      ? addMonths(mailDate, period.amount)
      : addDays(mailDate, period.amount)
);

/**
 * How a docket due date was arrived at.
 *
 * **Details**
 *
 * - `stated`: only the message stated a date.
 * - `computed`: only the recomputation from the source document produced one.
 * - `agreed`: both exist and are the same day.
 * - `earlier-of-differing`: both exist and differ; the earlier one is used.
 *
 * **Example** (Guard a basis)
 *
 * ```ts
 * import { DocketDueDateBasis } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * console.log(DocketDueDateBasis.is.agreed("agreed")); // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocketDueDateBasis = LiteralKit(["stated", "computed", "agreed", "earlier-of-differing"]).pipe(
  $I.annoteSchema("DocketDueDateBasis", {
    description: "How a docket due date was arrived at from its two candidate dates.",
  })
);

/**
 * Type for {@link DocketDueDateBasis}.
 *
 * **Example** (Type a basis)
 *
 * ```ts
 * import type { DocketDueDateBasis } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * const basis: DocketDueDateBasis = "agreed";
 * console.log(basis);
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type DocketDueDateBasis = typeof DocketDueDateBasis.Type;

const optionalDate = (description: string) => S.OptionFromOptionalKey(LocalDateFromString).annotateKey({ description });

/**
 * The date a docket entry goes on, with both candidate dates kept for display.
 *
 * **Example** (Read the basis of a resolved date)
 *
 * ```ts
 * import { DocketDueDateCandidates, resolveDocketDueDate } from "@beep/law-practice-domain/values/DocketDeadline";
 * import { LocalDate } from "@beep/schema/LocalDate";
 * import * as O from "effect/Option";
 *
 * const resolved = resolveDocketDueDate(DocketDueDateCandidates.make({
 *   computed: O.some(LocalDate.make({ year: 2030, month: 4, day: 15 })),
 *   stated: O.some(LocalDate.make({ year: 2030, month: 4, day: 16 }))
 * }));
 * console.log(O.map(resolved, (due) => due.basis)); // Some("earlier-of-differing")
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DocketDueDate extends S.Class<DocketDueDate>($I`DocketDueDate`)(
  {
    basis: DocketDueDateBasis.annotateKey({ description: "How the date was arrived at." }),
    computed: optionalDate("Date recomputed from the source document, when it could be."),
    date: LocalDateFromString.annotateKey({ description: "The date the entry goes on." }),
    stated: optionalDate("Date the message itself stated, when it stated one."),
  },
  $I.annote("DocketDueDate", {
    description: "The date a docket entry goes on, with both candidate dates.",
  })
) {}

/**
 * The two candidate dates a docket due date is resolved from.
 *
 * **Example** (Make candidates)
 *
 * ```ts
 * import { DocketDueDateCandidates } from "@beep/law-practice-domain/values/DocketDeadline";
 * import * as O from "effect/Option";
 *
 * const candidates = DocketDueDateCandidates.make({ computed: O.none(), stated: O.none() });
 * console.log(O.isNone(candidates.stated)); // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DocketDueDateCandidates extends S.Class<DocketDueDateCandidates>($I`DocketDueDateCandidates`)(
  {
    computed: optionalDate("Date recomputed from the source document, when it could be."),
    stated: optionalDate("Date the message itself stated, when it stated one."),
  },
  $I.annote("DocketDueDateCandidates", {
    description: "The two candidate dates a docket due date is resolved from.",
  })
) {}

/**
 * Whether the stated and the recomputed date both exist and differ.
 *
 * **Example** (Detect differing dates)
 *
 * ```ts
 * import { DocketDueDate, docketDatesDiffer } from "@beep/law-practice-domain/values/DocketDeadline";
 * import { LocalDate } from "@beep/schema/LocalDate";
 * import * as O from "effect/Option";
 *
 * const due = DocketDueDate.make({
 *   basis: "stated",
 *   computed: O.none(),
 *   date: LocalDate.make({ year: 2030, month: 4, day: 15 }),
 *   stated: O.some(LocalDate.make({ year: 2030, month: 4, day: 15 }))
 * });
 * console.log(docketDatesDiffer(due)); // false
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const docketDatesDiffer = (dueDate: DocketDueDate): boolean =>
  DocketDueDateBasis.is["earlier-of-differing"](dueDate.basis);

/**
 * Resolve the date a docket entry goes on from its two candidate dates.
 *
 * **Details**
 *
 * With no candidate there is no date: the result is `None`, and nothing is
 * guessed. When both exist and differ the earlier one wins and the basis
 * records the disagreement.
 *
 * **Example** (No candidates, no date)
 *
 * ```ts
 * import { DocketDueDateCandidates, resolveDocketDueDate } from "@beep/law-practice-domain/values/DocketDeadline";
 * import * as O from "effect/Option";
 *
 * console.log(O.isNone(resolveDocketDueDate(DocketDueDateCandidates.make({ computed: O.none(), stated: O.none() })))); // true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const resolveDocketDueDate = (candidates: DocketDueDateCandidates): O.Option<DocketDueDate> => {
  const { computed, stated } = candidates;

  return pipe(
    O.all({ computed, stated }),
    O.match({
      onNone: () =>
        pipe(
          stated,
          O.map((date) => DocketDueDate.make({ basis: "stated", computed, date, stated })),
          O.orElse(() => O.map(computed, (date) => DocketDueDate.make({ basis: "computed", computed, date, stated })))
        ),
      onSome: (both) =>
        O.some(
          isSameDate(both.stated, both.computed)
            ? DocketDueDate.make({ basis: "agreed", computed, date: both.stated, stated })
            : DocketDueDate.make({
                basis: "earlier-of-differing",
                computed,
                date: isBefore(both.stated, both.computed) ? both.stated : both.computed,
                stated,
              })
        ),
    })
  );
};

/**
 * Days before the due date at which a reminder event is placed.
 *
 * **Example** (Read the ladder offsets)
 *
 * ```ts
 * import { DOCKET_REMINDER_OFFSETS } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * console.log(DOCKET_REMINDER_OFFSETS); // [30, 14, 7, 1]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DOCKET_REMINDER_OFFSETS: A.NonEmptyReadonlyArray<number> = [30, 14, 7, 1];

/**
 * One reminder of a ladder: its distance from the due date and its own date.
 *
 * **Example** (Make a rung)
 *
 * ```ts
 * import { DocketReminderRung } from "@beep/law-practice-domain/values/DocketDeadline";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const rung = DocketReminderRung.make({ date: LocalDate.make({ year: 2030, month: 4, day: 8 }), daysBefore: 7 });
 * console.log(rung.daysBefore); // 7
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DocketReminderRung extends S.Class<DocketReminderRung>($I`DocketReminderRung`)(
  {
    date: LocalDateFromString.annotateKey({ description: "The day the reminder falls on." }),
    daysBefore: PositiveCount.annotateKey({ description: "How many days before the due date it falls." }),
  },
  $I.annote("DocketReminderRung", {
    description: "One reminder of a docket reminder ladder.",
  })
) {}

/**
 * The reminders placed ahead of one due date.
 *
 * **Example** (Count the rungs)
 *
 * ```ts
 * import { docketReminderLadder } from "@beep/law-practice-domain/values/DocketDeadline";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const ladder = docketReminderLadder(
 *   LocalDate.make({ year: 2030, month: 4, day: 15 }),
 *   LocalDate.make({ year: 2030, month: 4, day: 5 })
 * );
 * console.log(ladder.rungs.length, ladder.truncated); // 2 true
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class DocketReminderLadder extends S.Class<DocketReminderLadder>($I`DocketReminderLadder`)(
  {
    rungs: S.Array(DocketReminderRung).annotateKey({
      description: "Reminders still ahead, furthest from the due date first.",
    }),
    truncated: S.Boolean.annotateKey({
      description: "Whether a reminder was left out because its day is today or already past.",
    }),
  },
  $I.annote("DocketReminderLadder", {
    description: "The reminders placed ahead of one docket due date.",
  })
) {}

/**
 * Build the reminder ladder for a due date as seen from `today`.
 *
 * **Details**
 *
 * A reminder is kept only when its day is strictly after `today`; a reminder
 * dated today or earlier would be noise, so it is dropped and the ladder is
 * marked truncated.
 *
 * **Example** (A full ladder)
 *
 * ```ts
 * import { docketReminderLadder } from "@beep/law-practice-domain/values/DocketDeadline";
 * import { LocalDate } from "@beep/schema/LocalDate";
 *
 * const ladder = docketReminderLadder(
 *   LocalDate.make({ year: 2030, month: 4, day: 15 }),
 *   LocalDate.make({ year: 2030, month: 1, day: 2 })
 * );
 * console.log(ladder.rungs.map((rung) => rung.daysBefore)); // [30, 14, 7, 1]
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const docketReminderLadder: {
  (today: LocalDate): (dueDate: LocalDate) => DocketReminderLadder;
  (dueDate: LocalDate, today: LocalDate): DocketReminderLadder;
} = dual(2, (dueDate: LocalDate, today: LocalDate): DocketReminderLadder => {
  const rungs = pipe(
    DOCKET_REMINDER_OFFSETS,
    A.map((daysBefore) => DocketReminderRung.make({ date: addDays(dueDate, -daysBefore), daysBefore })),
    A.filter((rung) => isAfter(rung.date, today))
  );

  return DocketReminderLadder.make({
    rungs,
    truncated: A.length(rungs) < A.length(DOCKET_REMINDER_OFFSETS),
  });
});

/**
 * Outlook categories the docket intake overlay owns. It adds and removes only
 * these names.
 *
 * **Details**
 *
 * - `Docket - unverified`: a tentative dated entry awaiting the attorney.
 * - `Docket - needs review`: a docket item with no usable date, or one the
 *   two agents disagree on.
 * - `Docket - reminder`: a reminder ahead of an entry.
 * - `Docket - digest`: the daily digest entry.
 * - `Docket - verified`: reserved for the attorney to mark a confirmed entry.
 * - `Docket - entered`: applied to a message once its entry exists.
 *
 * **Example** (List the category names)
 *
 * ```ts
 * import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * console.log(DocketCategory.literals.length); // 6
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocketCategory = LiteralKit([
  "Docket - unverified",
  "Docket - needs review",
  "Docket - reminder",
  "Docket - digest",
  "Docket - verified",
  "Docket - entered",
]).pipe(
  $I.annoteSchema("DocketCategory", {
    description: "Outlook category names owned by the docket intake overlay.",
  })
);

/**
 * Type for {@link DocketCategory}.
 *
 * **Example** (Type a category)
 *
 * ```ts
 * import type { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
 *
 * const category: DocketCategory = "Docket - unverified";
 * console.log(category);
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type DocketCategory = typeof DocketCategory.Type;
