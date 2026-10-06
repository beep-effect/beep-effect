/**
 * Proofs of which day the service owes a digest for.
 */
import { addDays, isBefore, LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { digestDayDue } from "@/Digest";

const today = LocalDate.make({ year: 2030, month: 3, day: 1 });
const yesterday = LocalDate.make({ year: 2030, month: 2, day: 28 });

const DayOffset = S.Int.check(S.isBetween({ maximum: 400, minimum: -400 }));

describe("@beep/docket-intake digest day", () => {
  it("owes yesterday's digest when none has ever been written", () => {
    assertSome(
      O.map(digestDayDue(today, O.none()), (day) => day.toISOString()),
      "2030-02-28"
    );
  });

  it("owes nothing once yesterday or a later day is digested", () => {
    assertNone(digestDayDue(today, O.some(yesterday)));
    assertNone(digestDayDue(today, O.some(today)));
  });

  it.prop(
    "owes yesterday's digest exactly when the last digested day is before yesterday",
    [Arbitrary.schema(DayOffset)],
    ([offset]) => {
      const digestedThrough = addDays(today, offset);
      const due = digestDayDue(today, O.some(digestedThrough));

      deepStrictEqual(
        O.map(due, (day) => day.toISOString()),
        isBefore(digestedThrough, yesterday) ? O.some("2030-02-28") : O.none()
      );
    },
    { arbitrary: fcRuns(200) }
  );
});
