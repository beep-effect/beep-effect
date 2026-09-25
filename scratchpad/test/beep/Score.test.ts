import { toPgTable } from "@beep/effect-drizzle/pg";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/Arbitrary";
import { DailyScore, ScorePeriod, Scores } from "../../beep/Score.ts";

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("Score", () => {
  it("decodes a full day and rejects scores outside 0..100", () => {
    const day = decode(DailyScore, { date: "2020-01-02", score: 100, completedTasks: 2, totalTasks: 2 });
    expect(day.score).toBe(100);
    expect(day.completedTasks).toBe(2);
    expect(fails(DailyScore, { date: "2020-01-02", score: 101, completedTasks: 0, totalTasks: 0 })).toBe(true);
    expect(fails(DailyScore, { date: "2020-01-02", score: -1, completedTasks: 0, totalTasks: 0 })).toBe(true);
    expect(fails(DailyScore, { date: "2020-01-02", score: 1, completedTasks: -1, totalTasks: 0 })).toBe(true);
  });

  it("decodes a float window and an open default tab", () => {
    const period = decode(ScorePeriod, { score: 50.5, completedTasks: 1, totalTasks: 2 });
    expect(period.score).toBe(50.5);
    expect(fails(ScorePeriod, { score: 100.1, completedTasks: 0, totalTasks: 0 })).toBe(true);
    const scores = decode(Scores, {
      daily: { score: 0, completedTasks: 0, totalTasks: 1 },
      weekly: { score: 100, completedTasks: 4, totalTasks: 4 },
      overall: { score: 1, completedTasks: 1, totalTasks: 9 },
      defaultTab: "custom",
      date: "not-a-date",
    });
    expect(scores.defaultTab).toBe("custom");
    expect(scores.date).toBe("not-a-date");
  });

  it("builds the score tables and arbitrary generators", () => {
    expect(DailyScore.pipe(toPgTable)).toBeDefined();
    expect(ScorePeriod.pipe(toPgTable)).toBeDefined();
    for (const model of [DailyScore, ScorePeriod, Scores]) {
      expect(Arbitrary.isArbitrary(model.pipe(Arbitrary.schema))).toBe(true);
    }
  });
});
