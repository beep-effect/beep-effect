/**
 * Poll cycle proofs: the real pipeline over in-memory ports and an in-memory
 * file system. The test clock stands at the Unix epoch, so in the fixture time
 * zone today is 1969-12-31 and yesterday is 1969-12-30.
 */
import { DocketIntakeState, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Layer, Ref, Schedule } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { pollCycle, pollOnSchedule, seedCursor } from "@/Cycle";
import { fixtureConfig, STATE_DIRECTORY } from "./support/Config.ts";
import { FilesLayer, PipelineHarness, PipelineLayer } from "./support/Pipeline.ts";

const CycleLayer = Layer.merge(PipelineLayer, FilesLayer);
const YESTERDAY_DIGEST = `${STATE_DIRECTORY}/digests/1969-12-30.md`;

const iso = O.map((day: { readonly toISOString: () => string }) => day.toISOString());

describe("@beep/docket-intake poll cycle", () => {
  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "seeds the cursor on a first run and leaves a saved cursor alone",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;

        yield* seedCursor("2030-01-01T06:00:00.000Z");
        const seeded = yield* store.load;
        yield* seedCursor("2031-06-01T00:00:00.000Z");
        const again = yield* store.load;

        assertSome(seeded.cursor, "2030-01-01T06:00:00.000Z");
        assertSome(again.cursor, "2030-01-01T06:00:00.000Z");
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "keeps the digest day and the ledger when it seeds a cursor into existing state",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const harness = yield* PipelineHarness;
        yield* pollCycle(fixtureConfig);
        const polled = yield* store.load;
        yield* Ref.set(
          harness.state,
          DocketIntakeState.make({ digestedThrough: polled.digestedThrough, ledger: polled.ledger })
        );

        yield* seedCursor("2030-01-01T06:00:00.000Z");
        const seeded = yield* store.load;

        assertSome(seeded.cursor, "2030-01-01T06:00:00.000Z");
        assertSome(iso(seeded.digestedThrough), "1969-12-30");
        expect(R.keys(seeded.ledger)).toStrictEqual(["m1"]);
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "polls end to end, enters the message, and writes yesterday's digest once",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* DocketIntakeStore;
        const harness = yield* PipelineHarness;

        const first = yield* pollCycle(fixtureConfig);
        const afterFirst = yield* store.load;
        const digestText = yield* fs.readFileString(YESTERDAY_DIGEST);
        const entries = A.fromIterable(HashMap.values(yield* Ref.get(harness.entries)));

        expect([first.seen, first.processed, first.entered, first.failed]).toStrictEqual([1, 1, 1, 0]);
        expect(
          A.map(
            A.filter(entries, (entry) => entry.kind === "due"),
            (entry) => entry.date.toISOString()
          )
        ).toStrictEqual(["2030-04-08"]);
        expect(A.filter(entries, (entry) => entry.kind === "reminder")).toHaveLength(4);
        expect(digestText).toContain("Docket intake digest for 1969-12-30.");
        assertSome(iso(afterFirst.digestedThrough), "1969-12-30");
        assertSome(afterFirst.cursor, "2030-01-09T10:00:00.000Z");

        // The day is digested now: a second cycle owes no digest and does not write the file again.
        yield* fs.remove(YESTERDAY_DIGEST);
        const second = yield* pollCycle(fixtureConfig);

        expect([second.seen, second.processed]).toStrictEqual([1, 0]);
        expect(yield* fs.exists(YESTERDAY_DIGEST)).toBe(false);
        expect(yield* Ref.get(harness.listings)).toBe(2);
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "logs a failed cycle and goes on to the next one",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const harness = yield* PipelineHarness;
        yield* Ref.set(harness.failingListings, 1);

        yield* pollOnSchedule({ config: fixtureConfig, schedule: Schedule.recurs(1) });
        const state = yield* store.load;

        expect(yield* Ref.get(harness.listings)).toBe(2);
        expect(R.keys(state.ledger)).toStrictEqual(["m1"]);
        assertNone(O.filter(state.cursor, (cursor) => cursor !== "2030-01-09T10:00:00.000Z"));
      })
    );
  });
});
