/**
 * Command handler proofs: the handlers read the environment, build the wiring
 * they are given, and run the pipeline. The wiring here is the real pipeline
 * over in-memory ports, an in-memory file system and a scripted `M365`
 * service. Every value is synthetic.
 */

import { DocketRunId, makeDocketRunId, readDocketJournal } from "@beep/law-practice-server/DocketIntake";
import {
  DocketIntakeState,
  DocketLedgerRecord,
  DocketNeedsReview,
  DocketWrittenEntry,
  IntakeFailed,
  NotDocketItem,
} from "@beep/law-practice-use-cases/DocketIntake";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import {
  Cause,
  ConfigProvider,
  Context,
  DateTime,
  Deferred,
  Effect,
  Exit,
  Fiber,
  FileSystem,
  HashMap,
  Layer,
  Ref,
} from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { makeCommand, makeHandlers } from "@/Commands";
import { DocketCycleReport } from "@/Cycle";
import { DocketDryRunReport } from "@/DryRun";
import { DocketIntakeCommandError } from "@/Errors";
import { DocketRunSelector } from "@/Undo";
import { fixtureEnv, STATE_DIRECTORY } from "./support/Config.ts";
import { FakeM365, FakeM365Layer, passingScript, throttled } from "./support/FakeM365.ts";
import { dryRunPipelineLayer, FilesLayer, fixtureMessage, PipelineHarness, PipelineLayer } from "./support/Pipeline.ts";
import type { DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";

type WiringLogShape = {
  /** The listing floor each `intake` wiring was asked for. */
  readonly initialSince: Ref.Ref<ReadonlyArray<string>>;
};

class WiringLog extends Context.Service<WiringLog, WiringLogShape>()(
  "@beep/docket-intake/test/Commands.test/WiringLog"
) {}

const WiringLogLayer = Layer.effect(
  WiringLog,
  Effect.gen(function* () {
    return WiringLog.of({ initialSince: yield* Ref.make<ReadonlyArray<string>>([]) });
  })
);

// The services the fake wiring hands to the handlers are built once per test block, so the test
// body and the handler see the same harness, store, file system and scripted mailbox.
const makeTestHandlers = Effect.gen(function* () {
  const context = yield* Effect.context<
    DocketIntakeStore | FakeM365 | FileSystem.FileSystem | PipelineHarness | WiringLog
  >();
  const log = yield* WiringLog;
  const shared = Layer.succeedContext(context);
  return makeHandlers({
    dryRun: (options) => dryRunPipelineLayer(options.directory).pipe(Layer.provide(shared)),
    intake: (options) =>
      Layer.unwrap(
        Ref.update(log.initialSince, A.append(options.initialSince)).pipe(
          Effect.as(PipelineLayer.pipe(Layer.provide(shared)))
        )
      ),
    mailbox: () => Layer.merge(FakeM365Layer, BunCrypto.layer).pipe(Layer.provide(shared)),
  });
});

const commandsLayer = (env: Readonly<Record<string, string>>) =>
  Layer.mergeAll(
    PipelineLayer,
    FilesLayer,
    FakeM365Layer,
    WiringLogLayer,
    ConfigProvider.layer(ConfigProvider.fromUnknown(env))
  );

const CommandsLayer = commandsLayer(fixtureEnv);

const { DOCKET_INTAKE_START_AT: _startAt, ...envWithoutStart } = fixtureEnv;

const noFlags = { maxMessages: O.none(), since: O.none() };

// The JSON lines a command printed; log lines on the test console are left out.
const printed = Effect.map(TestConsole.logLines, (lines) =>
  A.filter(lines, (line): line is string => Str.isString(line) && Str.startsWith("{")(line))
);

// The first JSON line a command printed.
const firstLine = Effect.flatMap(printed, (lines) => Effect.fromOption(A.head(lines)));

const decodeCycleReport = S.decodeUnknownEffect(S.fromJsonString(DocketCycleReport));
const decodeDryRunReport = S.decodeUnknownEffect(S.fromJsonString(DocketDryRunReport));
const encodeState = S.encodeEffect(S.fromJsonString(DocketIntakeState));

const failureOf = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<O.Option<E>, never, R> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

const kindOf = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.map(failureOf(effect), O.flatMap(O.liftPredicate(S.is(DocketIntakeCommandError))));

const DAY = LocalDate.make({ year: 2030, month: 1, day: 9 });
const record = (outcome: DocketLedgerRecord["outcome"]) =>
  DocketLedgerRecord.make({ attempts: 1, outcome, processedOn: DAY, receivedAt: "2030-01-09T09:00:00.000Z" });

// Real saved state, as a running service would have left it: three settled or failing messages
// the mailbox no longer lists, and no cursor yet.
const savedState = DocketIntakeState.make({
  ledger: {
    "m-failing": record(IntakeFailed.make({ messageId: "m-failing", stage: "review" })),
    "m-quiet": record(NotDocketItem.make({ messageId: "m-quiet" })),
    "m-review": record(
      DocketNeedsReview.make({
        entry: DocketWrittenEntry.make({ eventId: "event-old" }),
        flags: [],
        messageId: "m-review",
        reason: "no-usable-date",
      })
    ),
  },
});

const STATE_FILE = `${STATE_DIRECTORY}/state.json`;

describe("@beep/docket-intake commands", () => {
  it.prop(
    "undo --run accepts the id of any run the service can mint, and latest",
    [Arbitrary.schema(S.DateTimeUtc)],
    ([instant]) => {
      expect(S.is(DocketRunSelector)(makeDocketRunId(instant))).toBe(true);
      expect(S.is(DocketRunSelector)("latest")).toBe(true);
      expect(S.is(DocketRunSelector)(DateTime.formatIso(instant))).toBe(false);
    },
    { arbitrary: fcRuns(100) }
  );

  it("names the service command", () => {
    const command = makeCommand({
      dryRun: (options) => dryRunPipelineLayer(options.directory),
      intake: () => PipelineLayer,
      mailbox: () => Layer.merge(FakeM365Layer, BunCrypto.layer),
    });

    expect(command.name).toBe("docket-intake");
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "poll starts from the configured start time, runs one cycle, journals its writes and prints its run",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const log = yield* WiringLog;
        const harness = yield* PipelineHarness;

        yield* handlers.poll(noFlags);
        const lines = yield* printed;
        const report = yield* decodeCycleReport(yield* firstLine);
        const journal = yield* readDocketJournal(STATE_DIRECTORY);

        expect(yield* Ref.get(log.initialSince)).toStrictEqual(["2030-01-01T06:00:00.000Z"]);
        expect(yield* Ref.get(harness.listings)).toBe(1);
        assertSome((yield* Ref.get(harness.state)).cursor, "2030-01-09T10:00:00.000Z");
        expect(lines).toHaveLength(1);
        expect([report.runId, report.processed, report.entered]).toStrictEqual(["run-19700101T000000000Z", 1, 1]);
        // One due-date entry, four reminders and the mark: exactly the writes the harness received.
        expect(A.map(journal, (line) => line.kind)).toStrictEqual([
          ...A.replicate("event-created", 5),
          "message-marked",
        ]);
        expect(HashMap.size(yield* Ref.get(harness.entries))).toBe(5);
        expect(yield* Ref.get(harness.marked)).toStrictEqual(["m1"]);
      })
    );
  });

  it.layer(commandsLayer(envWithoutStart), { timeout: "10 seconds" })((it) => {
    it.effect(
      "poll starts from the time of the first run when no start time is configured, and saves it",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const log = yield* WiringLog;
        const harness = yield* PipelineHarness;
        // No mail on this run, so the saved cursor is exactly the seeded one.
        yield* Ref.set(harness.listingFailures, [true]);

        const kind = yield* kindOf(handlers.poll(noFlags));
        const state = yield* Ref.get(harness.state);

        // The test clock stands at the Unix epoch.
        expect(yield* Ref.get(log.initialSince)).toStrictEqual(["1970-01-01T00:00:00.000Z"]);
        assertSome(state.cursor, "1970-01-01T00:00:00.000Z");
        assertSome(
          O.map(kind, (error) => [error.kind, error.message]),
          ["failed", "stage mailbox: transport"]
        );
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "--since overrides the configured start on a first run and is ignored once a cursor is saved",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const log = yield* WiringLog;
        const harness = yield* PipelineHarness;
        yield* Ref.set(harness.listingFailures, [true, true]);
        const since = { maxMessages: O.none(), since: O.some(DateTime.makeUnsafe("2029-12-01T00:00:00Z")) };

        yield* Effect.exit(handlers.poll(since));
        const seeded = (yield* Ref.get(harness.state)).cursor;
        yield* Effect.exit(handlers.poll({ ...since, since: O.some(DateTime.makeUnsafe("2029-06-01T00:00:00Z")) }));

        expect(yield* Ref.get(log.initialSince)).toStrictEqual([
          "2029-12-01T00:00:00.000Z",
          "2029-06-01T00:00:00.000Z",
        ]);
        assertSome(seeded, "2029-12-01T00:00:00.000Z");
        assertSome((yield* Ref.get(harness.state)).cursor, "2029-12-01T00:00:00.000Z");
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "--max-messages processes the oldest pending messages and keeps the cursor before the first one left",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const harness = yield* PipelineHarness;
        yield* Ref.set(harness.messages, [
          fixtureMessage({ messageId: "m3", receivedAt: "2030-01-09T10:03:00.000Z" }),
          fixtureMessage({ messageId: "m1", receivedAt: "2030-01-09T10:01:00.000Z" }),
          fixtureMessage({ messageId: "m2", receivedAt: "2030-01-09T10:02:00.000Z" }),
        ]);
        const bounded = { maxMessages: O.some(2), since: O.none() };

        yield* handlers.poll(bounded);
        const first = yield* Ref.get(harness.state);
        yield* handlers.poll(bounded);
        const second = yield* Ref.get(harness.state);

        expect(A.sort(R.keys(first.ledger), Str.Order)).toStrictEqual(["m1", "m2"]);
        assertSome(first.cursor, "2030-01-09T10:02:00.000Z");
        expect(A.sort(R.keys(second.ledger), Str.Order)).toStrictEqual(["m1", "m2", "m3"]);
        assertSome(second.cursor, "2030-01-09T10:03:00.000Z");
        expect(yield* Ref.get(harness.marked)).toStrictEqual(["m1", "m2", "m3"]);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "run keeps polling until it is stopped",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const harness = yield* PipelineHarness;

        const running = yield* Effect.forkChild(handlers.run({ intervalMinutes: 5, since: O.none() }));
        yield* Deferred.await(harness.listed);
        const stopped = yield* Fiber.interrupt(running).pipe(Effect.andThen(Fiber.await(running)));

        expect(Exit.hasInterrupts(stopped)).toBe(true);
        expect(yield* Ref.get(harness.listings)).toBe(1);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "dry-run runs the pipeline over a copy of the real state and writes nothing anywhere",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const harness = yield* PipelineHarness;
        const fs = yield* FileSystem.FileSystem;
        const encoded = yield* encodeState(savedState);
        yield* fs.makeDirectory(`${STATE_DIRECTORY}/dry-run`, { recursive: true });
        yield* fs.writeFileString(`${STATE_DIRECTORY}/dry-run/leftover.txt`, "left by an earlier dry run");
        yield* fs.writeFileString(STATE_FILE, encoded);

        yield* handlers.dryRun(noFlags);
        const report = yield* decodeDryRunReport(yield* firstLine);

        expect([report.dryRun, report.seen, report.processed, report.entered]).toStrictEqual([true, 1, 1, 1]);
        expect(
          A.map(report.entries, (entry) => [entry.kind, entry.category, O.getOrNull(entry.messageId)])
        ).toStrictEqual([
          ["due", "Docket - unverified", "m1"],
          ...A.replicate(["reminder", "Docket - reminder", "m1"], 4),
        ]);
        expect(A.map(A.take(report.entries, 1), (entry) => entry.date.toISOString())).toStrictEqual(["2030-04-08"]);
        expect(A.every(report.entries, (entry) => A.contains(entry.flags, "matter-lookup-failed"))).toBe(true);
        // Nothing reached the calendar or the mailbox, and the real state directory is as it was.
        expect(HashMap.size(yield* Ref.get(harness.entries))).toBe(0);
        expect(yield* Ref.get(harness.marked)).toStrictEqual([]);
        expect(yield* fs.readFileString(STATE_FILE)).toBe(encoded);
        expect(A.sort(yield* fs.readDirectory(STATE_DIRECTORY), Str.Order)).toStrictEqual(["dry-run", "state.json"]);
        expect(yield* fs.exists(`${STATE_DIRECTORY}/dry-run/leftover.txt`)).toBe(false);
        assertNone((yield* Ref.get(harness.state)).cursor);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "runs lists the journal's runs, and undo refuses to write without --yes",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const fake = yield* FakeM365;

        yield* handlers.runs();
        const before = yield* printed;
        yield* handlers.poll(noFlags);
        yield* handlers.runs();
        const lines = yield* printed;
        const refused = yield* kindOf(handlers.undo({ dryRun: false, run: "latest", yes: false }));

        expect(before).toStrictEqual([]);
        expect(A.drop(lines, 1)).toStrictEqual([
          '{"runId":"run-19700101T000000000Z","startedAt":"1970-01-01T00:00:00.000Z","eventsCreated":5,"messagesMarked":1,"eventsDeleted":0,"eventsKept":0,"eventsGone":0,"messagesUnmarked":0,"messagesGone":0,"eventsAdopted":0}',
        ]);
        assertSome(
          O.map(refused, (error) => error.kind),
          "refused"
        );
        expect(yield* Ref.get(fake.calls)).toStrictEqual([]);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "undo --dry-run reports without writing, and undo --yes deletes the entries and unmarks the message",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const fake = yield* FakeM365;
        yield* handlers.poll(noFlags);

        yield* handlers.undo({ dryRun: true, run: "latest", yes: false });
        const dryCalls = yield* Ref.get(fake.calls);
        yield* handlers.undo({ dryRun: false, run: DocketRunId.make("run-19700101T000000000Z"), yes: true });
        const calls = A.drop(yield* Ref.get(fake.calls), A.length(dryCalls));
        const lines = A.drop(yield* printed, 1);
        const journal = yield* readDocketJournal(STATE_DIRECTORY);

        expect(A.every(dryCalls, (call) => Str.startsWith("get")(call))).toBe(true);
        expect(lines).toStrictEqual([
          '{"runId":"run-19700101T000000000Z","dryRun":true,"deleted":5,"kept":0,"gone":0,"unmarked":1,"messagesGone":0,"ledgerCleared":0,"messagesKept":0,"alreadyUndone":0}',
          '{"runId":"run-19700101T000000000Z","dryRun":false,"deleted":5,"kept":0,"gone":0,"unmarked":1,"messagesGone":0,"ledgerCleared":0,"messagesKept":0,"alreadyUndone":0}',
        ]);
        expect(A.length(A.filter(calls, Str.startsWith("deleteEvent")))).toBe(5);
        expect(A.filter(calls, Str.startsWith("updateMessageCategories"))).toStrictEqual([
          "updateMessageCategories m1 M: FIX-0001",
        ]);
        expect(A.length(A.filter(journal, (line) => Str.startsWith("undo-")(line.kind)))).toBe(6);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "undo fails on a run the journal does not have, and ends throttled when Graph throttles",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const fake = yield* FakeM365;

        const empty = yield* kindOf(handlers.undo({ dryRun: true, run: "latest", yes: false }));
        yield* handlers.poll(noFlags);
        const unknown = yield* kindOf(
          handlers.undo({ dryRun: true, run: DocketRunId.make("run-20300101T000000000Z"), yes: false })
        );
        yield* Ref.set(fake.script, { ...passingScript, getEvent: Effect.fail(throttled) });
        const limited = yield* kindOf(handlers.undo({ dryRun: false, run: "latest", yes: true }));

        expect(A.map(A.getSomes([empty, unknown, limited]), (error) => [error.kind, error.message])).toStrictEqual([
          ["failed", "no run latest in the journal"],
          ["failed", "no run run-20300101T000000000Z in the journal"],
          ["throttled", "stage calendar: throttled"],
        ]);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "smoke checks the mailbox it is wired to, read-only unless asked to write",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const fake = yield* FakeM365;

        yield* handlers.smoke({ write: false });
        const readOnly = yield* Ref.get(fake.calls);
        yield* handlers.smoke({ write: true });

        expect(readOnly).toStrictEqual(["listMessages", "listCategories"]);
        assertSome(A.last(yield* Ref.get(fake.calls)), "deleteEvent event-1");
      })
    );
  });
});
