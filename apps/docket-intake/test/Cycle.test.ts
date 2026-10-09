/**
 * Poll cycle proofs: the real pipeline over in-memory ports and an in-memory
 * file system. The test clock stands at the Unix epoch, so in the fixture time
 * zone today is 1969-12-31 and yesterday is 1969-12-30.
 */
import { DocketIntake, DocketIntakeState, DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";
import { addDays, LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as Str from "effect/String";
import { pollCycle, pollOnSchedule, seedCursor } from "@/Cycle";
import { fixtureConfig, STATE_DIRECTORY } from "./support/Config.ts";
import { FilesLayer, PipelineHarness, PipelineLayer } from "./support/Pipeline.ts";

const CycleLayer = Layer.merge(PipelineLayer, FilesLayer);
const DIGESTS = `${STATE_DIRECTORY}/digests`;
const TODAY = LocalDate.make({ year: 1969, month: 12, day: 31 });
const DAY_ONE = addDays(TODAY, -3);

// Save state as if the last digest had been written for this day, keeping the ledger.
const setDigestedThrough = Effect.fnUntraced(function* (day: LocalDate) {
  const harness = yield* PipelineHarness;
  yield* Ref.update(harness.state, (state) =>
    DocketIntakeState.make({ cursor: state.cursor, digestedThrough: O.some(day), ledger: state.ledger })
  );
});

const failureOf = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<O.Option<E>, never, R> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

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
        yield* setDigestedThrough(DAY_ONE);
        yield* Ref.update(harness.state, (state) =>
          DocketIntakeState.make({ digestedThrough: state.digestedThrough, ledger: state.ledger })
        );

        yield* seedCursor("2030-01-01T06:00:00.000Z");
        const seeded = yield* store.load;

        assertSome(seeded.cursor, "2030-01-01T06:00:00.000Z");
        assertSome(iso(seeded.digestedThrough), "1969-12-28");
        expect(R.keys(seeded.ledger)).toStrictEqual(["m1"]);
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "polls end to end and enters the message; nothing is owed a digest while today is the only day",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* DocketIntakeStore;
        const harness = yield* PipelineHarness;

        const first = yield* pollCycle(fixtureConfig);
        const afterFirst = yield* store.load;
        const entries = A.fromIterable(HashMap.values(yield* Ref.get(harness.entries)));
        const second = yield* pollCycle(fixtureConfig);

        expect([first.seen, first.processed, first.entered, first.failed]).toStrictEqual([1, 1, 1, 0]);
        expect(
          A.map(
            A.filter(entries, (entry) => entry.kind === "due"),
            (entry) => entry.date.toISOString()
          )
        ).toStrictEqual(["2030-04-08"]);
        expect(A.filter(entries, (entry) => entry.kind === "reminder")).toHaveLength(4);
        assertSome(afterFirst.cursor, "2030-01-09T10:00:00.000Z");
        assertNone(afterFirst.digestedThrough);
        expect(yield* fs.exists(DIGESTS)).toBe(false);
        expect([second.seen, second.processed]).toStrictEqual([1, 0]);
        expect(yield* Ref.get(harness.listings)).toBe(2);
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "digests every day of a three-day gap in order, and the first day's digest lists its entry",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const intake = yield* DocketIntake;
        const store = yield* DocketIntakeStore;
        const harness = yield* PipelineHarness;
        // The message was entered three days ago, and the last digest is from the day before that.
        yield* intake.pollOnce(DAY_ONE);
        yield* setDigestedThrough(addDays(DAY_ONE, -1));

        yield* pollCycle(fixtureConfig);
        const state = yield* store.load;
        const files = A.sort(yield* fs.readDirectory(DIGESTS), Str.Order);
        const dayOne = yield* fs.readFileString(`${DIGESTS}/1969-12-28.md`);
        const dayTwo = yield* fs.readFileString(`${DIGESTS}/1969-12-29.md`);
        const digestEntries = A.filter(
          A.fromIterable(HashMap.values(yield* Ref.get(harness.entries))),
          (entry) => entry.kind === "digest"
        );

        expect(files).toStrictEqual(["1969-12-28.md", "1969-12-29.md", "1969-12-30.md"]);
        assertSome(iso(state.digestedThrough), "1969-12-30");
        expect(dayOne).toContain("Docket intake digest for 1969-12-28.");
        expect(dayOne).toContain("Tentative entries created: 1.");
        expect(dayOne).toContain("2030-04-08 tentative entry");
        expect(dayTwo).toContain("Tentative entries created: 0.");
        // Only the day with something to report gets a calendar entry.
        expect(A.map(digestEntries, (entry) => entry.date.toISOString())).toStrictEqual(["1969-12-28"]);
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "writes at most 62 digests in one cycle and picks up the rest on the next",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* DocketIntakeStore;
        yield* setDigestedThrough(addDays(TODAY, -71));

        yield* pollCycle(fixtureConfig);
        const afterFirst = yield* store.load;
        const written = yield* fs.readDirectory(DIGESTS);
        yield* pollCycle(fixtureConfig);
        const afterSecond = yield* store.load;

        expect(written).toHaveLength(62);
        assertSome(iso(afterFirst.digestedThrough), addDays(TODAY, -9).toISOString());
        assertSome(iso(afterSecond.digestedThrough), "1969-12-30");
        expect(yield* fs.readDirectory(DIGESTS)).toHaveLength(70);
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "goes on after a failed cycle, and a good cycle resets the count of failures in a row",
      Effect.fnUntraced(function* () {
        const store = yield* DocketIntakeStore;
        const harness = yield* PipelineHarness;
        // Fail, succeed, fail, succeed: never two failures in a row, so the limit of 2 is not reached.
        yield* Ref.set(harness.listingFailures, [true, false, true, false]);

        yield* pollOnSchedule({ config: fixtureConfig, schedule: Schedule.recurs(3) });
        const state = yield* store.load;

        expect(yield* Ref.get(harness.listings)).toBe(4);
        expect(R.keys(state.ledger)).toStrictEqual(["m1"]);
        assertSome(state.cursor, "2030-01-09T10:00:00.000Z");
      })
    );
  });

  it.layer(CycleLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "ends the loop with the last error once two cycles in a row have failed",
      Effect.fnUntraced(function* () {
        const harness = yield* PipelineHarness;
        yield* Ref.set(harness.listingFailures, [true, true, false]);

        const failure = yield* failureOf(pollOnSchedule({ config: fixtureConfig, schedule: Schedule.recurs(5) }));

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause]),
          ["mailbox", "transport"]
        );
        expect(yield* Ref.get(harness.listings)).toBe(2);
      })
    );
  });
});
