import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import { CalendarMutationResult, eventTitle, formatDeletedCalendarEvents } from "../../beep/CalendarMutation.ts";

describe("CalendarMutation", () => {
  it("builds an arbitrary value", () => {
    assert.notStrictEqual(CalendarMutationResult.pipe(Arbitrary.schema), undefined);
  });

  it("names events from summary, null, numbers, and absence", () => {
    assert.strictEqual(eventTitle({}), "Untitled");
    assert.strictEqual(eventTitle({ summary: "Standup" }), "Standup");
    assert.strictEqual(eventTitle({ summary: null }), "None");
    assert.strictEqual(eventTitle({ summary: 3 }), "3");
  });

  it("formats success, failure, mixed, and empty deletion results", () => {
    assert.strictEqual(formatDeletedCalendarEvents(CalendarMutationResult.make({})), "No events were deleted.");
    const timed = formatDeletedCalendarEvents(
      CalendarMutationResult.make({
        succeeded: [{ summary: "Standup", start: { dateTime: "2020-01-02T03:04:05Z" } }],
      }),
    );
    assert.strictEqual(timed.includes("Standup (2020-01-02 03:04)"), true);
    const untimed = formatDeletedCalendarEvents(
      CalendarMutationResult.make({ succeeded: [{ summary: "All day", start: {} }] }),
    );
    assert.strictEqual(untimed.includes("All day ("), false);
    assert.strictEqual(untimed.includes("All day"), true);
    const failed = formatDeletedCalendarEvents(
      CalendarMutationResult.make({ failed: [["Standup", "denied"]] }),
    );
    assert.strictEqual(failed, "Error: Failed to delete events: Standup: denied");
    const mixed = formatDeletedCalendarEvents(
      CalendarMutationResult.make({
        succeeded: [{ summary: "Standup" }],
        failed: [["Other", "missing"]],
      }),
    );
    assert.strictEqual(mixed.includes("Successfully deleted 1"), true);
    assert.strictEqual(mixed.includes("Failed to delete 1"), true);
  });
});
