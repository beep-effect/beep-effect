import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CalendarMeetingContext,
  MeetingParticipant,
  calendarMeetingContextsFromRecords,
} from "../../beep/CalendarContext.ts";

const meeting = {
  calendarEventId: "evt-1",
  title: "Standup",
  startTime: "2020-01-02T03:04:05.000Z",
  durationMinutes: 15,
  participants: [],
};

describe("CalendarContext", () => {
  it("builds arbitrary values", () => {
    assert.notStrictEqual(MeetingParticipant.pipe(Arbitrary.schema), undefined);
    assert.notStrictEqual(CalendarMeetingContext.pipe(Arbitrary.schema), undefined);
  });

  it("defaults the calendar source and keeps a present null", () => {
    const decoded = Effect.runSync(S.decodeUnknownEffect(CalendarMeetingContext)(meeting));
    assert.strictEqual(O.getOrNull(decoded.calendarSource), "system_calendar");
    const cleared: unknown = { ...meeting, calendarSource: null, platform: null };
    const none = Effect.runSync(S.decodeUnknownEffect(CalendarMeetingContext)(cleared));
    assert.strictEqual(O.isNone(none.calendarSource), true);
    assert.strictEqual(O.isNone(none.platform), true);
    const google: unknown = { ...meeting, calendarSource: "google" };
    const named = Effect.runSync(S.decodeUnknownEffect(CalendarMeetingContext)(google));
    assert.strictEqual(O.getOrNull(named.calendarSource), "google");
  });

  it("accepts a participant with neither name nor email", () => {
    const missing = Effect.runSync(S.decodeUnknownEffect(MeetingParticipant)({}));
    assert.strictEqual(O.isNone(missing.name), true);
    const cleared = Effect.runSync(S.decodeUnknownEffect(MeetingParticipant)({ name: null, email: null }));
    assert.strictEqual(O.isNone(cleared.email), true);
    const present = Effect.runSync(S.decodeUnknownEffect(MeetingParticipant)({ name: "Ada", email: "ada@example.com" }));
    assert.strictEqual(O.getOrNull(present.name), "Ada");
  });

  it("skips one bad meeting and keeps the rest", () => {
    let skipped = 0;
    const parsed = Effect.runSync(
      calendarMeetingContextsFromRecords([{ title: "missing" }, meeting], () => {
        skipped = skipped + 1;
      }),
    );
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(skipped, 1);
    const quiet = Effect.runSync(calendarMeetingContextsFromRecords([{ title: "missing" }]));
    assert.strictEqual(quiet.length, 0);
  });
});
