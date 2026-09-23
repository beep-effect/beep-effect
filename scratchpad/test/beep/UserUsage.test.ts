import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { toWire } from "../../beep/Port.ts";
import {
  HourlyUsage,
  UsageHistoryPoint,
  UsagePeriod,
  UsageStats,
  UserUsageResponse,
  utcNow,
} from "../../beep/UserUsage.ts";

const decode = <A extends S.Top>(schema: A & S.Codec<unknown, unknown, never, never>, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const stats = {
  transcriptionSeconds: 1,
  wordsTranscribed: 2,
  insightsGained: 3,
  memoriesCreated: 4,
  speechSeconds: 5,
};

describe("UserUsage", () => {
  it("constructs zero counters and decodes a history point", () => {
    const made = UsageStats.make({});
    assert.strictEqual(made.transcriptionSeconds, 0);
    assert.strictEqual(made.speechSeconds, 0);
    const point = decode(toWire(UsageHistoryPoint), {
      date: "2020-01-02",
      transcription_seconds: 1,
      words_transcribed: 2,
      insights_gained: 3,
      memories_created: 4,
      speech_seconds: 5,
    });
    assert.strictEqual(point.date, "2020-01-02");
    assert.strictEqual(point.memoriesCreated, 4);
  });

  it("decodes present, missing, and null usage slots", () => {
    const present = decode(toWire(UserUsageResponse), {
      today: stats,
      monthly: stats,
      yearly: stats,
      all_time: stats,
      history: [{ ...stats, date: "2020-01-02" }],
    });
    assert.strictEqual(O.isSome(present.today), true);
    assert.strictEqual(O.isSome(present.allTime), true);
    assert.strictEqual(O.getOrElse(present.history, () => []).length, 1);
    const missing = decode(toWire(UserUsageResponse), {});
    assert.strictEqual(O.isNone(missing.today), true);
    assert.strictEqual(O.isNone(missing.yearly), true);
    assert.strictEqual(O.isNone(missing.history), true);
    const nulled = decode(toWire(UserUsageResponse), {
      today: null,
      monthly: null,
      yearly: null,
      all_time: null,
      history: null,
    });
    assert.strictEqual(O.isNone(nulled.monthly), true);
    assert.strictEqual(O.isNone(nulled.allTime), true);
    assert.strictEqual(O.isNone(nulled.history), true);
  });

  it("stamps hourly usage with a UTC instant and reads naive strings as UTC", () => {
    const made = HourlyUsage.make({ uid: "user-1", year: 2020, month: 1, day: 2, hour: 3 });
    assert.strictEqual(DateTime.isUtc(made.lastUpdated), true);
    assert.strictEqual(made.wordsTranscribed, 0);
    const decoded = decode(toWire(HourlyUsage), {
      transcription_seconds: 1,
      words_transcribed: 2,
      insights_gained: 3,
      memories_created: 4,
      speech_seconds: 5,
      uid: "user-1",
      year: 2020,
      month: 1,
      day: 2,
      hour: 4,
      last_updated: "2020-01-02T03:04:05",
    });
    assert.strictEqual(DateTime.formatIso(decoded.lastUpdated), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(utcNow().pipe(Effect.runSync, DateTime.isUtc), true);
    assert.strictEqual(decode(UsagePeriod, "monthly"), "monthly");
  });

  it("derives an arbitrary for every exported model", () => {
    for (const schema of [UsagePeriod, UsageStats, UsageHistoryPoint, UserUsageResponse, HourlyUsage]) {
      assert.strictEqual(schema.pipe(Arbitrary.schema, Arbitrary.isArbitrary), true);
    }
  });
});
