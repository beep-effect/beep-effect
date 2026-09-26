import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FocusDistraction, FocusSession, FocusSessionWire, FocusStats, FocusStatsWire } from "../../beep/FocusSession.ts";

const decode = <A>(schema: S.Codec<A, unknown, never, unknown>, input: unknown): A =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

describe("FocusSession", () => {
  it("decodes present, null, and missing optional session fields", () => {
    const present = decode(FocusSessionWire, {
      id: "s1",
      status: "focused",
      app_or_site: "editor",
      description: "Writing",
      message: "note",
      created_at: "2020-01-02T03:04:05.000Z",
      duration_seconds: 30,
    });
    assert.strictEqual(present.status, "focused");
    assert.strictEqual(O.getOrElse(present.durationSeconds, () => 0), 30);
    const nulled = decode(FocusSessionWire, {
      id: "s1",
      status: "distracted",
      app_or_site: "chat",
      description: "Scrolling",
      message: null,
      created_at: "2020-01-02T03:04:05.000Z",
      duration_seconds: null,
    });
    assert.strictEqual(O.isNone(nulled.message), true);
    assert.strictEqual(O.isNone(nulled.durationSeconds), true);
    const missing = decode(FocusSessionWire, {
      id: "s1",
      status: "focused",
      app_or_site: "editor",
      description: "Writing",
      created_at: "2020-01-02T03:04:05.000Z",
    });
    assert.strictEqual(O.isNone(missing.message), true);
    assert.strictEqual(fails(FocusSessionWire, { ...present, duration_seconds: -1, id: "s1", status: "focused", app_or_site: "e", description: "d", created_at: "2020-01-02T03:04:05.000Z" }), true);
  });

  it("constructs empty top distractions", () => {
    const stats = FocusStats.make({
      date: "2020-01-02",
      focusedMinutes: 1,
      distractedMinutes: 0,
      sessionCount: 1,
      focusedCount: 1,
      distractedCount: 0,
    });
    assert.strictEqual(stats.topDistractions.length, 0);
    const decoded = decode(FocusStatsWire, {
      date: "2020-01-02",
      focused_minutes: 10,
      distracted_minutes: 0,
      session_count: 1,
      focused_count: 1,
      distracted_count: 0,
      top_distractions: [],
    });
    assert.strictEqual(decoded.focusedMinutes, 10);
  });

  it("derives an arbitrary for each model", () => {
    for (const schema of [FocusSession, FocusDistraction, FocusStats]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
