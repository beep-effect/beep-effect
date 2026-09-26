import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  DailySummaryDayStatsPayload,
  DailySummaryDecision,
  DailySummaryHighlight,
  DailySummaryKnowledgeNugget,
  DailySummaryPayload,
  DailySummaryQuestion,
  LearnedMemoryRef,
} from "../../beep/DailySummaryPayload.ts";

const decodeDailySummaryPayload = S.decodeEffect(DailySummaryPayload);

describe("DailySummaryPayload", () => {
  it("decodes present values and null optional fields", () => {
    const payload = Effect.runSync(
      decodeDailySummaryPayload({
        headline: "Day",
        highlights: [{ topic: "Ship", emoji: "", summary: "Left", conversationNumbers: [1] }],
        unresolvedQuestions: [{ question: "When?", conversationNumber: null }],
        decisionsMade: [],
        knowledgeNuggets: [{ insight: "Names stick" }],
        stats: null,
        // Constructor defaults are construction-only: decode still needs the defaulted keys.
        dayEmoji: "📅",
        overview: "",
      }),
    );
    expect(payload.headline).toBe("Day");
    expect(O.isNone(payload.stats)).toBe(true);
    expect(O.isNone(payload.unresolvedQuestions[0]?.conversationNumber ?? O.none())).toBe(true);
    const missing = DailySummaryPayload.make({});
    expect(missing.headline).toBe("Your Day in Review");
    expect(missing.highlights).toEqual([]);
    expect(O.isNone(missing.stats)).toBe(true);
    expect(O.isNone(LearnedMemoryRef.make({ memoryId: "m", content: "Seattle" }).capturedAt)).toBe(true);
    expect(DailySummaryDayStatsPayload.make({}).totalConversations).toBe(0);
    expect(DailySummaryDecision.make({ decision: "Ship" }).decision).toBe("Ship");
    expect(DailySummaryKnowledgeNugget.make({ insight: "Names" }).insight).toBe("Names");
    expect(DailySummaryHighlight.make({ topic: "T", summary: "S" }).emoji).toBe("");
    expect(O.isNone(DailySummaryQuestion.make({ question: "Q" }).conversationNumber)).toBe(true);
  });

  it("derives arbitraries", () => {
    for (const schema of [
      DailySummaryHighlight,
      DailySummaryQuestion,
      DailySummaryDecision,
      DailySummaryKnowledgeNugget,
      DailySummaryDayStatsPayload,
      DailySummaryPayload,
      LearnedMemoryRef,
    ]) {
      expect(Arbitrary.schema(schema)).toBeTruthy();
    }
  });
});
