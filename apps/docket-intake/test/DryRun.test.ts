/**
 * Dry-run port proofs: the recording calendar and mailbox write nothing and
 * answer for what they recorded. Every value is synthetic.
 */
import {
  DocketCalendar,
  DocketCalendarEntry,
  DocketIntakeError,
  DocketMailbox,
  DocketWrittenEntry,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Cause, Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { DocketDryRunPortsLive, DocketDryRunRecorder, prepareDryRun } from "@/DryRun";
import { fixtureConfig } from "./support/Config.ts";
import { fixtureMessage } from "./support/Pipeline.ts";

const message = fixtureMessage({ messageId: "m1", receivedAt: "2030-01-09T10:00:00.000Z" });

const entry = DocketCalendarEntry.make({
  bodyText: "Synthetic fixture entry.",
  category: "Docket - unverified",
  date: LocalDate.make({ year: 2030, month: 4, day: 8 }),
  key: "docket:0f3a",
  kind: "due",
  subject: "[UNVERIFIED] Due Date: fixture response",
  tentative: true,
});

const existing = DocketWrittenEntry.make({ eventId: "event-existing" });

// The ports below only read: a write that reached them would fail the proof.
const refuseWrite = () => Effect.die("a dry run wrote through to the ports below it");

const BelowLayer = Layer.merge(
  Layer.succeed(
    DocketCalendar,
    DocketCalendar.of({
      create: refuseWrite,
      findByKey: Effect.fnUntraced(function* (key) {
        return yield* Effect.succeed(key === "docket:existing" ? O.some(existing) : O.none());
      }),
    })
  ),
  Layer.succeed(
    DocketMailbox,
    DocketMailbox.of({
      markEntered: refuseWrite,
      receivedSince: Effect.fnUntraced(function* () {
        return yield* Effect.succeed([message]);
      }),
      sourceDocuments: Effect.fnUntraced(function* () {
        return yield* Effect.succeed([]);
      }),
    })
  )
);

const failedRemoval = PlatformError.badArgument({ description: "fixture", method: "remove", module: "FileSystem" });

const UnremovableLayer = Layer.merge(
  Layer.succeed(FileSystem.FileSystem, FileSystem.makeNoop({ remove: () => Effect.fail(failedRemoval) })),
  Path.layer
);

describe("@beep/docket-intake dry run", () => {
  it.layer(DocketDryRunPortsLive.pipe(Layer.provide(BelowLayer)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "records creates, finds what it recorded, asks the calendar below otherwise, and marks nothing",
      Effect.fnUntraced(function* () {
        const calendar = yield* DocketCalendar;
        const mailbox = yield* DocketMailbox;
        const recorder = yield* DocketDryRunRecorder;

        const created = yield* calendar.create(entry);
        const recorded = yield* calendar.findByKey(entry.key);
        const below = yield* calendar.findByKey("docket:existing");
        yield* mailbox.markEntered(message);

        expect(created.eventId).toBe("docket:0f3a");
        assertSome(
          O.map(recorded, (written) => written.eventId),
          "docket:0f3a"
        );
        assertSome(below, existing);
        expect(yield* recorder.entries).toStrictEqual([entry]);
        expect(yield* mailbox.receivedSince(O.none())).toStrictEqual([message]);
        expect(yield* mailbox.sourceDocuments(message)).toStrictEqual([]);
      })
    );
  });

  it.layer(UnremovableLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails at stage store when the old dry-run directory cannot be removed",
      Effect.fnUntraced(function* () {
        const exit = yield* Effect.exit(prepareDryRun(fixtureConfig));

        assertSome(
          Exit.match(exit, {
            onFailure: (cause) =>
              O.map(O.filter(Cause.findErrorOption(cause), S.is(DocketIntakeError)), (error) => [
                error.stage,
                error.cause,
              ]),
            onSuccess: () => O.none(),
          }),
          ["store", "dry-run-directory"]
        );
      })
    );
  });
});
