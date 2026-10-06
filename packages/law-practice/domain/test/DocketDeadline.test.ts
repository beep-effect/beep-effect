import {
  addDocketResponsePeriod,
  DOCKET_REMINDER_OFFSETS,
  DocketDueDate,
  DocketDueDateCandidates,
  DocketResponsePeriod,
  docketDatesDiffer,
  docketReminderLadder,
  resolveDocketDueDate,
} from "@beep/law-practice-domain/values/DocketDeadline";
import {
  addDays,
  daysInMonth,
  diffInDays,
  isAfter,
  isBefore,
  LocalDate,
  equals as sameDate,
} from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const EPOCH = LocalDate.make({ year: 2026, month: 1, day: 1 });

// Every generated date is a real calendar day: an offset from a fixed day, never a free year/month/day triple.
const DayOffset = S.Int.check(S.isBetween({ maximum: 20_000, minimum: -20_000 }));
const Months = S.Int.check(S.isBetween({ maximum: 60, minimum: 1 }));
const Days = S.Int.check(S.isBetween({ maximum: 3660, minimum: 1 }));
const SmallGap = S.Int.check(S.isBetween({ maximum: 400, minimum: -5 }));

const dayOffset = Arbitrary.schema(DayOffset);
const dateAt = (offset: number): LocalDate => addDays(EPOCH, offset);
const monthIndex = (date: LocalDate): number => date.year * 12 + date.month;
const notAfter = (left: LocalDate, right: LocalDate): boolean => !isAfter(left, right);

describe("@beep/law-practice-domain DocketDeadline", () => {
  it("clamps month arithmetic to the end of a shorter month", () => {
    const threeMonths = DocketResponsePeriod.make({ amount: 3, unit: "months" });
    const due = (year: number, month: number, day: number) =>
      addDocketResponsePeriod(LocalDate.make({ day, month, year }), threeMonths).toISOString();

    expect(due(2030, 11, 30)).toBe("2031-02-28");
    expect(due(2027, 11, 30)).toBe("2028-02-29");
    expect(due(2030, 8, 31)).toBe("2030-11-30");
    expect(due(2030, 1, 15)).toBe("2030-04-15");
  });

  it.prop(
    "a period in days lands exactly that many days after the mail date",
    [dayOffset, Arbitrary.schema(Days)],
    ([offset, amount]) => {
      const mailDate = dateAt(offset);
      const due = addDocketResponsePeriod(mailDate, DocketResponsePeriod.make({ amount, unit: "days" }));

      expect(diffInDays(due, mailDate)).toBe(amount);
    },
    { arbitrary: fcRuns(200) }
  );

  it.prop(
    "a period in months advances the month by exactly that amount and never overflows it",
    [dayOffset, Arbitrary.schema(Months)],
    ([offset, amount]) => {
      const mailDate = dateAt(offset);
      const due = addDocketResponsePeriod(mailDate, DocketResponsePeriod.make({ amount, unit: "months" }));

      expect(monthIndex(due) - monthIndex(mailDate)).toBe(amount);
      expect(due.day).toBe(Math.min(mailDate.day, daysInMonth(due.year, due.month)));
      assertTrue(isAfter(due, mailDate));
    },
    { arbitrary: fcRuns(200) }
  );

  it("resolves no date when neither candidate exists", () => {
    assertNone(resolveDocketDueDate(DocketDueDateCandidates.make({ computed: O.none(), stated: O.none() })));
  });

  it.prop(
    "a single candidate is used as it is and is never reported as differing",
    [dayOffset],
    ([offset]) => {
      const date = dateAt(offset);
      const stated = resolveDocketDueDate(DocketDueDateCandidates.make({ computed: O.none(), stated: O.some(date) }));
      const computed = resolveDocketDueDate(DocketDueDateCandidates.make({ computed: O.some(date), stated: O.none() }));

      assertSome(
        O.map(stated, (due) => due.basis),
        "stated"
      );
      assertSome(
        O.map(computed, (due) => due.basis),
        "computed"
      );
      assertTrue(O.exists(stated, (due) => sameDate(due.date, date) && !docketDatesDiffer(due)));
      assertTrue(O.exists(computed, (due) => sameDate(due.date, date) && !docketDatesDiffer(due)));
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "two candidates resolve to the earlier one, keep both, and flag a difference only when they differ",
    [dayOffset, dayOffset],
    ([statedOffset, computedOffset]) => {
      const stated = dateAt(statedOffset);
      const computed = dateAt(computedOffset);
      const resolved = resolveDocketDueDate(
        DocketDueDateCandidates.make({ computed: O.some(computed), stated: O.some(stated) })
      );
      const swapped = resolveDocketDueDate(
        DocketDueDateCandidates.make({ computed: O.some(stated), stated: O.some(computed) })
      );

      assertTrue(
        O.exists(
          resolved,
          (due) =>
            notAfter(due.date, stated) &&
            notAfter(due.date, computed) &&
            (sameDate(due.date, stated) || sameDate(due.date, computed)) &&
            docketDatesDiffer(due) === (statedOffset !== computedOffset) &&
            O.exists(due.stated, (date) => sameDate(date, stated)) &&
            O.exists(due.computed, (date) => sameDate(date, computed))
        )
      );
      assertSome(
        O.map(resolved, (due) => due.basis),
        statedOffset === computedOffset ? "agreed" : "earlier-of-differing"
      );
      assertTrue(O.exists(O.all({ resolved, swapped }), (both) => sameDate(both.resolved.date, both.swapped.date)));
    },
    { arbitrary: fcRuns(200) }
  );

  it.prop(
    "a resolved due date survives its encoded form",
    [dayOffset, dayOffset],
    ([statedOffset, computedOffset]) => {
      const resolved = resolveDocketDueDate(
        DocketDueDateCandidates.make({
          computed: O.some(dateAt(computedOffset)),
          stated: O.some(dateAt(statedOffset)),
        })
      );
      const decoded = O.map(resolved, (due) =>
        Result.getOrThrow(S.decodeResult(DocketDueDate)(Result.getOrThrow(S.encodeResult(DocketDueDate)(due))))
      );

      assertTrue(
        O.exists(
          O.all({ decoded, resolved }),
          (both) => sameDate(both.decoded.date, both.resolved.date) && both.decoded.basis === both.resolved.basis
        )
      );
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "every reminder is after today, before the due date, at its stated distance, and in order",
    [dayOffset, Arbitrary.schema(SmallGap)],
    ([todayOffset, gap]) => {
      const today = dateAt(todayOffset);
      const dueDate = addDays(today, gap);
      const ladder = docketReminderLadder(dueDate, today);
      const distances = A.map(ladder.rungs, (rung) => rung.daysBefore);
      const expected = A.filter(DOCKET_REMINDER_OFFSETS, (daysBefore) => gap - daysBefore > 0);

      expect(distances).toStrictEqual(expected);
      expect(ladder.truncated).toBe(A.length(expected) < A.length(DOCKET_REMINDER_OFFSETS));
      for (const rung of ladder.rungs) {
        assertTrue(isAfter(rung.date, today));
        assertTrue(isBefore(rung.date, dueDate));
        expect(diffInDays(dueDate, rung.date)).toBe(rung.daysBefore);
      }
    },
    { arbitrary: fcRuns(300) }
  );

  it("places no reminder for a due date that is tomorrow or already past", () => {
    const today = dateAt(0);

    expect(docketReminderLadder(addDays(today, 1), today).rungs).toHaveLength(0);
    expect(docketReminderLadder(addDays(today, -3), today).rungs).toHaveLength(0);
    expect(docketReminderLadder(addDays(today, 31), today).truncated).toBe(false);
  });
});
