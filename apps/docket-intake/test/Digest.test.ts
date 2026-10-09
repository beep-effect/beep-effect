/**
 * Proofs of which day the service owes a digest for.
 */
import { addDays, isBefore, LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { DigestProgress, digestDayDue } from "@/Digest";

const today = LocalDate.make({ year: 2030, month: 3, day: 1 });
const yesterday = LocalDate.make({ year: 2030, month: 2, day: 28 });

const progress = (digestedThrough: O.Option<LocalDate>, earliestProcessed: O.Option<LocalDate>) =>
  DigestProgress.make({ digestedThrough, earliestProcessed });

const iso = O.map((day: LocalDate) => day.toISOString());

const DayOffset = S.Int.check(S.isBetween({ maximum: 400, minimum: -400 }));

describe("@beep/docket-intake digest day", () => {
  it("owes nothing before any digest when no message has been processed", () => {
    assertNone(digestDayDue(today, progress(O.none(), O.none())));
  });

  it("before any digest, owes the earliest processed day once that day is over", () => {
    const threeDaysAgo = addDays(today, -3);

    assertSome(iso(digestDayDue(today, progress(O.none(), O.some(threeDaysAgo)))), "2030-02-26");
    assertSome(iso(digestDayDue(today, progress(O.none(), O.some(yesterday)))), "2030-02-28");
    assertNone(digestDayDue(today, progress(O.none(), O.some(today))));
  });

  it("after a digest, owes the day after it and ignores the ledger", () => {
    const due = pipe(today, digestDayDue(progress(O.some(addDays(today, -4)), O.some(addDays(today, -9)))));

    assertSome(iso(due), "2030-02-26");
    assertNone(digestDayDue(today, progress(O.some(yesterday), O.none())));
    assertNone(digestDayDue(today, progress(O.some(today), O.none())));
  });

  it.prop(
    "owes the day after the last digested day exactly when that day is over, and never today or later",
    [Arbitrary.schema(DayOffset)],
    ([offset]) => {
      const digestedThrough = addDays(today, offset);
      const due = digestDayDue(today, progress(O.some(digestedThrough), O.none()));

      deepStrictEqual(
        iso(due),
        isBefore(digestedThrough, yesterday) ? O.some(addDays(digestedThrough, 1).toISOString()) : O.none()
      );
    },
    { arbitrary: fcRuns(200) }
  );

  it.prop(
    "walks a gap of any length one day at a time and ends on yesterday",
    [Arbitrary.schema(S.Int.check(S.isBetween({ maximum: 90, minimum: 1 })))],
    ([gap]) => {
      let digestedThrough = addDays(yesterday, -gap);
      let steps = 0;
      for (
        let due = digestDayDue(today, progress(O.some(digestedThrough), O.none()));
        O.isSome(due);
        due = digestDayDue(today, progress(O.some(digestedThrough), O.none()))
      ) {
        deepStrictEqual(due.value.toISOString(), addDays(digestedThrough, 1).toISOString());
        digestedThrough = due.value;
        steps += 1;
      }

      deepStrictEqual([steps, digestedThrough.toISOString()], [gap, yesterday.toISOString()]);
    },
    { arbitrary: fcRuns(50) }
  );
});
