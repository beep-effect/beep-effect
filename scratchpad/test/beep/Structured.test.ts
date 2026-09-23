import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  ActionItem,
  CategoryEnum,
  Event,
  Section,
  Structured,
  actionsToString,
  asDictCleanedDates,
  eventsToString,
  formatStructured,
  setCategoryDefaultOnError,
} from "../../beep/Structured.ts";

const isCategoryEnum = S.is(CategoryEnum);

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const instant = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z");

describe("Structured", () => {
  it("keeps romantic and maps romance, numbers, and unknown strings to other", () => {
    expect(isCategoryEnum("romantic")).toBe(true);
    expect(isCategoryEnum("romance")).toBe(false);
    expect(setCategoryDefaultOnError("romantic")).toBe("romantic");
    expect(setCategoryDefaultOnError("romance")).toBe("other");
    expect(setCategoryDefaultOnError(1)).toBe("other");
    const summary = decode(Structured, {
      title: "hello",
      overview: "world",
      emoji: "🧠",
      category: "nope",
      sections: [],
      actionItems: [],
      events: [],
    });
    expect(summary.category).toBe("other");
    expect(Structured.make({}).emoji).toBe("🧠");
  });

  it("renders pending, completed, and empty action items", () => {
    expect(actionsToString([])).toBe("None");
    const pending = ActionItem.make({ description: "Send the notes" });
    expect(actionsToString([pending])).toBe("- Send the notes (pending)");
    const completed = ActionItem.make({
      description: "File it",
      completed: true,
      createdAt: O.some(instant),
      dueAt: O.some(instant),
      completedAt: O.some(instant),
    });
    expect(actionsToString([completed])).toBe(
      "- File it (completed) [Created: 2020-01-02 03:04:05 UTC, Due: 2020-01-02 03:04:05 UTC, Completed: 2020-01-02 03:04:05 UTC]",
    );
  });

  it("renders events, formats the start, and prints a summary", () => {
    expect(eventsToString([])).toBe("None");
    const event = Event.make({ title: "Standup", description: "Notes", start: instant, duration: 15 });
    expect(eventsToString([event])).toBe("- Standup (2020-01-02 03:04:05 UTC)\n  Notes");
    expect(eventsToString([Event.make({ title: "Quiet", start: instant })])).toBe("- Quiet (2020-01-02 03:04:05 UTC)");
    expect(asDictCleanedDates(event).start).toBe("2020-01-02T03:04:05.000Z");
    expect(asDictCleanedDates(event).duration).toBe(15);
    expect(formatStructured(Structured.make({ title: "hello", overview: "world" }))).toBe("Hello (Other)\nWorld");
    const full = Structured.make({
      title: "hello",
      overview: "world",
      actionItems: [ActionItem.make({ description: "Send the notes" })],
      events: [event],
    });
    expect(formatStructured(full)).toContain("Action Items:\n- Send the notes (pending)");
    expect(formatStructured(full)).toContain("Events:\n- Standup (2020-01-02 03:04:05 UTC)");
  });

  it("decodes null and missing optional action-item fields", () => {
    const missing = ActionItem.make({ description: "Send the notes" });
    const nulled = decode(ActionItem, {
      description: "Send the notes",
      completed: false,
      createdAt: null,
      captureKind: null,
      captureConfidence: null,
      ownerName: null,
      concreteDeliverable: null,
      sourceSegmentIds: [],
    });
    expect(missing.completed).toBe(false);
    expect(O.isNone(missing.captureKind)).toBe(true);
    expect(O.isNone(nulled.captureConfidence)).toBe(true);
    expect(O.isNone(nulled.concreteDeliverable)).toBe(true);
    const present = decode(ActionItem, {
      description: "Send the notes",
      completed: false,
      captureKind: "explicit_command",
      captureConfidence: 1,
      ownershipConfidence: 0,
      captureOwner: "user",
      dueCertainty: "confirmed",
      candidateAction: "create",
      concreteDeliverable: true,
      sourceSegmentIds: ["seg-1"],
    });
    expect(present.captureKind).toEqual(O.some("explicit_command"));
    expect(present.captureConfidence).toEqual(O.some(1));
    expect(fails(ActionItem, {
      description: "Send the notes",
      captureConfidence: 1.1,
    })).toBe(true);
    expect(Section.make({ heading: "Notes", bodyMarkdown: "Shipped it." }).sourceSegmentIds).toEqual([]);
  });

  it("builds an arbitrary for each structured model", () => {
    for (const model of [ActionItem, Event, Section, Structured]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});
