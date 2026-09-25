import { describe, expect, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import {
  ActionItemsExtraction,
  ConversationStructureExtraction,
  ExtractedActionItem,
  ExtractedEvent,
  ExtractedEventWire,
  ExtractedSection,
  StructuredExtraction,
  defaultUnusableDuration,
  dropOutOfVocabularyLiterals,
  keepUsableContent,
  toActionItem,
  toActionItems,
  toEvent,
  toSection,
  toStructured,
  usableElements,
} from "../../beep/StructuredExtraction.ts";

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const record = (value: unknown): { readonly [key: string]: unknown } => (P.isObject(value) ? value : {});

describe("StructuredExtraction", () => {
  it("normalizes vocabulary, names, and unusable tokens", () => {
    const mixed = record(dropOutOfVocabularyLiterals({
      captureKind: "Explicit_Command",
      captureOwner: "Ada",
      ownerName: "",
      dueCertainty: "nope",
      candidateAction: 12,
    }));
    expect(mixed.captureKind).toBe("explicit_command");
    expect(mixed.captureOwner).toBe("other");
    expect(mixed.ownerName).toBe("Ada");
    expect(mixed.dueCertainty).toBeNull();
    expect(mixed.candidateAction).toBeNull();
    const kept = record(dropOutOfVocabularyLiterals({ captureOwner: "Ada", ownerName: "Pat" }));
    expect(kept.ownerName).toBe("Pat");
    const blank = record(dropOutOfVocabularyLiterals({ captureOwner: "   " }));
    expect(blank.captureOwner).toBeNull();
    expect(dropOutOfVocabularyLiterals("nope")).toBe("nope");
    expect(dropOutOfVocabularyLiterals({ captureKind: null })).toEqual({ captureKind: null });
  });

  it("drops bad elements and null summary text", () => {
    const kept = Effect.runSync(usableElements(
      [{ description: "Send the notes" }, { description: 1 }],
      ExtractedActionItem,
      "actionItems",
    ));
    expect(Array.isArray(kept) && kept).toHaveLength(1);
    expect(Effect.runSync(usableElements("not-a-list", ExtractedActionItem, "actionItems"))).toBe("not-a-list");
    const cleared = keepUsableContent({
      title: null,
      actionItems: [{ description: "Send the notes" }, { nope: true }],
    }, { actionItems: ExtractedActionItem }).pipe(Effect.runSync, record);
    expect(Rec.has(cleared, "title")).toBe(false);
    expect(Array.isArray(cleared.actionItems) && cleared.actionItems).toHaveLength(1);
    const removed = keepUsableContent({ sections: null }, { sections: ExtractedSection }).pipe(Effect.runSync, record);
    expect(Rec.has(removed, "sections")).toBe(false);
    expect(Effect.runSync(keepUsableContent("nope", {}))).toBe("nope");
  });

  it("replaces unusable durations and copies children onto persisted models", () => {
    expect(record(defaultUnusableDuration({ duration: 0 }))).not.toHaveProperty("duration");
    expect(record(defaultUnusableDuration({ duration: "nope" }))).not.toHaveProperty("duration");
    expect(record(defaultUnusableDuration({ duration: " 15 " })).duration).toBe(15);
    expect(record(defaultUnusableDuration({ duration: true })).duration).toBe(1);
    expect(defaultUnusableDuration("nope")).toBe("nope");
    const event = decode(ExtractedEventWire, {
      title: "Standup",
      start: "2020-01-02T03:04:05.000Z",
      duration: 0,
    });
    expect(event.duration).toBe(30);
    const fractional = decode(ExtractedEventWire, {
      title: "Standup",
      start: "2020-01-02T03:04:05.000Z",
      duration: 15.9,
    });
    expect(fractional.duration).toBe(15);
    expect(fails(ExtractedEvent, { title: "Standup", start: "2020-01-02T03:04:05.000Z", duration: 15.9 })).toBe(true);
    expect(decode(ExtractedEvent, { title: "Standup", start: "2020-01-02T03:04:05.000Z" }).duration).toBe(30);
    const copied = toEvent(ExtractedEvent.make({
      title: "Standup",
      start: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
    }));
    expect(copied.created).toBe(false);
    expect(copied.duration).toBe(30);
    const item = toActionItem(ExtractedActionItem.make({ description: "Send the notes", dueAt: O.none() }));
    expect(item.completed).toBe(false);
    expect(O.isNone(item.createdAt)).toBe(true);
    expect(toActionItems([ExtractedActionItem.make({ description: "Send the notes" })])).toHaveLength(1);
    expect(toSection(ExtractedSection.make({ heading: "Notes", bodyMarkdown: "Shipped it." })).heading).toBe("Notes");
    const summary = toStructured(StructuredExtraction.make({ title: "hello", category: "health" }));
    expect(summary.title).toBe("hello");
    expect(summary.category).toBe("health");
    expect(summary.actionItems).toHaveLength(0);
  });

  it("decodes an unknown category as other and missing optionals as None", () => {
    const structure = decode(ConversationStructureExtraction, {
      title: "hello",
      overview: "",
      emoji: "🧠",
      category: "romance",
    });
    expect(structure.category).toBe("other");
    const item = ExtractedActionItem.make({ description: "Send the notes" });
    expect(O.isNone(item.captureOwner)).toBe(true);
    const present = decode(ExtractedActionItem, {
      description: "Send the notes",
      captureOwner: "other",
      captureConfidence: 0,
      sourceSegmentIds: ["seg-1"],
    });
    expect(present.captureOwner).toEqual(O.some("other"));
    expect(fails(ExtractedActionItem, {
      description: "Send the notes",
      captureConfidence: 2,
      sourceSegmentIds: [],
    })).toBe(true);
    expect(ActionItemsExtraction.make({}).actionItems).toHaveLength(0);
  });

  it("builds an arbitrary for each extraction model", () => {
    for (const model of [
      ExtractedActionItem,
      ActionItemsExtraction,
      ConversationStructureExtraction,
      ExtractedEvent,
      ExtractedSection,
      StructuredExtraction,
    ]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});
