import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  AccountHeadroomSource,
  AdmissionSlotsInput,
  HostMemoryInput,
  HostPressureInput,
  HostPressureSource,
  InboxRowInput,
  LaneCheckoutInput,
  LaneRedsInput,
  LaneRedsSource,
  PalantiriClient,
  PressureFile,
  PressureSourceInput,
  parcelSpecs,
  SinceLastCheckSource,
  SourceFailed,
} from "@beep/palantiri";
import {
  HOT_PARCELS_FILE,
  HOT_PARCELS_TIMEOUT,
  HotParcelLine,
  HotParcels,
  HotParcelsJson,
  hotParcels,
  layerPalantiriRuntime,
  layerPalantiriToolHandlers,
  MAX_HOT_LINE_CARRIES,
  PalantiriToolkit,
  ParcelCatalog,
  parcelToolName,
  printHotParcels,
  printParcel,
  renderHotBlock,
  servePalantiriMcp,
  stageHotParcels,
} from "@beep/repo-cli/test/Palantiri";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { identity, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import type { ParcelId } from "@beep/palantiri";

const UnknownJson = S.fromJsonString(S.Unknown);

const decodeParcelCatalogJson = S.decodeEffect(S.fromJsonString(ParcelCatalog));
const captureOutput = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
  const current = yield* Console.Console;
  let output = A.empty<string>();
  yield* effect.pipe(
    Effect.provideService(Console.Console, {
      ...current,
      log: (...values: ReadonlyArray<unknown>) => {
        output = A.appendAll(
          output,
          A.map(values, (value) => `${value}`)
        );
      },
    })
  );
  return A.join(output, "\n");
});

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const noFiles = Layer.mergeAll(FileSystem.layerNoop({}), Path.layer);

const memoryFiles = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

const offline = (parcel: "account-headroom" | "lane-reds" | "host-pressure" | "since-last-check") =>
  Effect.fail(SourceFailed.make({ parcel, detail: "not wired in this test" }));

const CPU = "some avg10=2.13 avg60=1.05 avg300=0.48 total=987654321\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0\n";

const pressureAt = (readAt: DateTime.Utc) =>
  HostPressureInput.make({
    readAt,
    pressure: PressureSourceInput.cases.Read.make({
      files: [
        PressureFile.make({ resource: "cpu", text: CPU }),
        PressureFile.make({ resource: "memory", text: CPU }),
        PressureFile.make({ resource: "io", text: CPU }),
      ],
    }),
    memory: O.some(HostMemoryInput.make({ availableGib: 40, totalGib: 62.5 })),
    admission: O.some(
      AdmissionSlotsInput.make({ capacityTokens: 3, activeTokens: 1, queued: 0, dead: 0, hardFloorEngaged: false })
    ),
  });

const lanesAt = (now: DateTime.Utc) =>
  LaneRedsInput.make({
    checkouts: [
      LaneCheckoutInput.make({
        lane: "lane-a",
        branch: O.some("feat/lane-a"),
        inboxReadable: true,
        skippedLines: 0,
        rows: [
          InboxRowInput.make({
            kind: "check-failed",
            severity: "P0",
            prNumber: O.some(1817),
            summary: "Check / Coverage failure",
            observedAt: O.some(now),
            acked: false,
            superseded: false,
          }),
        ],
        jobs: O.some([]),
      }),
    ],
  });

const sinceLastCheckOffline = Layer.succeed(SinceLastCheckSource, {
  read: Effect.fn("SinceLastCheckSource.stub.read")(() => offline("since-last-check")),
  advance: Effect.fn("SinceLastCheckSource.stub.advance")(() => offline("since-last-check")),
});

// Account headroom offline, lane reds and host pressure fresh at the clock's now.
const workingSources = Layer.mergeAll(
  Layer.succeed(AccountHeadroomSource, { snapshot: offline("account-headroom") }),
  Layer.succeed(LaneRedsSource, { snapshot: Effect.map(DateTime.now, lanesAt) }),
  Layer.succeed(HostPressureSource, { snapshot: Effect.map(DateTime.now, pressureAt) }),
  sinceLastCheckOffline
);

// Lane reds never answers.
const hangingSources = Layer.mergeAll(
  Layer.succeed(AccountHeadroomSource, { snapshot: offline("account-headroom") }),
  Layer.succeed(LaneRedsSource, { snapshot: Effect.never }),
  Layer.succeed(HostPressureSource, { snapshot: Effect.map(DateTime.now, pressureAt) }),
  sinceLastCheckOffline
);

const runtimeOver = <E>(
  sources: Layer.Layer<AccountHeadroomSource | LaneRedsSource | HostPressureSource | SinceLastCheckSource, E>
) => sources.pipe(layerPalantiriRuntime(Layer.empty), Layer.provide(noFiles));

const NOON = DateTime.makeUnsafe("2026-10-15T12:00:00.000Z");

const atNoon = NOON.pipe(DateTime.toEpochMillis, TestClock.setTime);

const toolText = Effect.fnUntraced(function* (name: keyof typeof PalantiriToolkit.tools) {
  const toolkit = yield* PalantiriToolkit;
  const results = yield* toolkit.handle(name, {}).pipe(Effect.flatMap(Stream.runCollect));
  const final = A.findLast(results, (result) => !result.preliminary);
  expect(O.isSome(final)).toBe(true);
  // The text content the MCP server sends: the encoded result as JSON.
  return O.match(final, {
    onNone: () => "",
    onSome: (result) => Result.getOrThrowWith(S.encodeUnknownResult(UnknownJson)(result.encodedResult), identity),
  });
});

const toolHandlers = layerPalantiriToolHandlers.pipe(Layer.provideMerge(runtimeOver(workingSources)));

describe("beep palantiri mcp", () => {
  it.layer(toolHandlers, { timeout: "30 seconds" })("over stub sources", (it) => {
    it.effect("serves byte-identical JSON to `parcel <id> --json`", () =>
      Effect.gen(function* () {
        yield* atNoon;
        const parcels: ReadonlyArray<readonly [ParcelId, keyof typeof PalantiriToolkit.tools]> = [
          ["lane-reds", "palantiri_lane_reds"],
          ["host-pressure", "palantiri_host_pressure"],
          ["app-error-classes", "palantiri_app_error_classes"],
          ["account-headroom", "palantiri_account_headroom"],
        ];
        yield* Effect.forEach(
          parcels,
          Effect.fnUntraced(function* ([id, tool]) {
            const cli = yield* captureOutput(printParcel(id, true));
            const mcp = yield* toolText(tool);
            expect(mcp).toBe(cli);
            expect(pipe(mcp, Str.includes("@"))).toBe(false);
          }),
          { discard: true }
        );
      })
    );

    it.effect("lists every parcel with the tool that reads it", () =>
      Effect.gen(function* () {
        const listing = yield* toolText("palantiri_parcels");
        const catalog = yield* decodeParcelCatalogJson(listing);
        expect(A.map(catalog.parcels, (parcel) => parcel.id)).toEqual(A.map(parcelSpecs, (spec) => spec.id));
        A.forEach(catalog.parcels, (parcel) => {
          expect(parcel.tool).toBe(parcelToolName(parcel.id));
          expect(R.keys(PalantiriToolkit.tools)).toContain(parcel.tool);
        });
      })
    );
  });

  it.effect("pins log output to stderr while it serves", () =>
    Effect.gen(function* () {
      const seen = yield* Deferred.make<boolean>();
      const probe = Layer.effectDiscard(
        Effect.gen(function* () {
          const LogToStderr1 = yield* Logger.LogToStderr;
          yield* Deferred.succeed(seen, LogToStderr1);
        })
      );
      const fiber = yield* probe.pipe(servePalantiriMcp, Effect.forkChild);
      const await2 = yield* Deferred.await(seen);
      expect(await2).toBe(true);
      yield* Fiber.interrupt(fiber);
      // Outside the host the default stays stdout.
      const LogToStderr3 = yield* Logger.LogToStderr;
      expect(LogToStderr3).toBe(false);
    })
  );
});

describe("beep session open hot parcels", () => {
  it.effect("prints one line per hot parcel with its freshness", () =>
    Effect.gen(function* () {
      yield* atNoon;
      const result = yield* workingSources.pipe(runtimeOver, hotParcels(HOT_PARCELS_TIMEOUT));
      const lines = renderHotBlock(result);
      expect(lines).toEqual([
        "[palantiri] hot parcels (bun run beep palantiri parcel <id>):",
        "- account-headroom: account headroom unavailable: not wired in this test (unknown (unreachable): not wired in this test)",
        expect.stringMatching(/^- lane-reds: .+ \(fresh as of 2026-10-15T12:00:00\.000Z\)$/),
        expect.stringMatching(/^- host-pressure: .+ \(fresh as of 2026-10-15T12:00:00\.000Z\)$/),
      ]);
    })
  );

  it.effect("prints Unknown for a parcel that overruns the bound", () =>
    Effect.gen(function* () {
      yield* atNoon;
      const fiber = yield* hangingSources.pipe(runtimeOver, hotParcels(HOT_PARCELS_TIMEOUT), Effect.forkChild);
      yield* TestClock.adjust("3 seconds");
      const join4 = yield* Fiber.join(fiber);
      const lines = renderHotBlock(join4);
      expect(lines).toHaveLength(4);
      expect(lines[2]).toBe("- lane-reds: Unknown (timed out after 2s)");
      expect(lines[3]).toMatch(/^- host-pressure: .+ \(fresh as of /);
    })
  );

  it.effect("prints one Unknown line when the block as a whole overruns or fails", () =>
    Effect.gen(function* () {
      const stuck = Layer.effect(PalantiriClient, Effect.never);
      const fiber = yield* stuck.pipe(hotParcels(HOT_PARCELS_TIMEOUT), Effect.forkChild);
      yield* TestClock.adjust("3 seconds");
      const join5 = yield* Fiber.join(fiber);
      expect(renderHotBlock(join5)).toEqual(["[palantiri] hot parcels: Unknown (timed out after 2s)"]);
      const broken = Layer.effect(PalantiriClient, Effect.die("no client"));
      const hotParcels6 = yield* hotParcels(broken, HOT_PARCELS_TIMEOUT);
      expect(renderHotBlock(hotParcels6)).toEqual(["[palantiri] hot parcels: Unknown (read failed)"]);
    })
  );

  it.layer(memoryFiles, { timeout: "30 seconds" })("on a memory filesystem", (it) => {
    it.effect("dates a carried line by its reading's as-of, not the read time", () =>
      Effect.gen(function* () {
        yield* atNoon;
        // Host pressure served from a reading taken ten minutes before the read.
        const tenMinutesOld = Layer.mergeAll(
          Layer.succeed(AccountHeadroomSource, { snapshot: offline("account-headroom") }),
          Layer.succeed(LaneRedsSource, { snapshot: Effect.map(DateTime.now, lanesAt) }),
          Layer.succeed(HostPressureSource, {
            snapshot: Effect.map(DateTime.now, (now) => pressureAt(DateTime.subtract(now, { minutes: 10 }))),
          }),
          sinceLastCheckOffline
        );
        const result = yield* tenMinutesOld.pipe(runtimeOver, hotParcels(HOT_PARCELS_TIMEOUT));
        const lines = yield* Result.match(result, { onFailure: Effect.die, onSuccess: Effect.succeed });
        const staged = yield* stageHotParcels(lines);
        const hostLine = (block: ReadonlyArray<HotParcelLine>) =>
          A.filter(renderHotBlock(Result.succeed(block)), (line) => pipe(line, Str.startsWith("- host-pressure: ")));
        expect(hostLine(staged)[0]).toContain("as of 2026-10-15T11:50:00.000Z");
        const carried = yield* stageHotParcels(
          A.map(lines, (line) =>
            line.parcel === "host-pressure"
              ? HotParcelLine.make({
                  parcel: "host-pressure",
                  state: "timed-out",
                  text: "Unknown (timed out after 2s)",
                })
              : line
          )
        );
        const [printed] = hostLine(carried);
        expect(printed).toContain("(stale since 2026-10-15T11:50:00.000Z; this read: Unknown (timed out after 2s))");
        expect(printed).not.toContain("2026-10-15T12:00:00.000Z");
      }).pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: "/state/palantiri-as-of", HOME: "/home/nobody" }))
    );

    it.effect("stages the hot file owner-only, and only after a finished read", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = "/state/palantiri";
        const file = path.join(root, HOT_PARCELS_FILE);
        yield* atNoon;
        const broken = Layer.effect(PalantiriClient, Effect.die("no client"));
        const pipe7 = yield* broken.pipe(printHotParcels(HOT_PARCELS_TIMEOUT), captureOutput);
        expect(pipe7).toBe("[palantiri] hot parcels: Unknown (read failed)");
        const exists8 = yield* fs.exists(file);
        expect(exists8).toBe(false);
        const printed = yield* workingSources.pipe(runtimeOver, printHotParcels(HOT_PARCELS_TIMEOUT), captureOutput);
        expect(A.length(Str.split("\n")(printed))).toBe(4);
        expect(((yield* fs.stat(file)).mode & 0o777).toString(8)).toBe("600");
        expect(((yield* fs.stat(root)).mode & 0o777).toString(8)).toBe("700");
        const argument = S.decodeEffect(HotParcelsJson);
        const readFileString1 = yield* fs.readFileString(file);
        const staged = yield* argument(readFileString1);
        expect(A.map(staged.lines, (line) => line.parcel)).toEqual(["account-headroom", "lane-reds", "host-pressure"]);
        expect(DateTime.formatIso(staged.writtenAt)).toBe("2026-10-15T12:00:00.000Z");
        // A parcel that keeps timing out carries its last read line as stale,
        // never as fresh, and only MAX_HOT_LINE_CARRIES times in a row.
        const timedOut = HotParcelLine.make({
          parcel: "lane-reds",
          state: "timed-out",
          text: "Unknown (timed out after 2s)",
        });
        const withLaneRedsTimedOut = A.map(staged.lines, (line) => (line.parcel === "lane-reds" ? timedOut : line));
        const laneRedsLine = (lines: ReadonlyArray<HotParcelLine>) =>
          A.filter(renderHotBlock(Result.succeed(lines)), (line) => pipe(line, Str.startsWith("- lane-reds: ")));
        const carried = yield* Effect.forEach(A.range(1, MAX_HOT_LINE_CARRIES), () =>
          stageHotParcels(withLaneRedsTimedOut)
        );
        A.forEach(carried, (lines, index) => {
          const line = A.findFirst(lines, (entry) => entry.parcel === "lane-reds");
          assertSome(
            O.map(line, (entry) => [entry.state, entry.carries]),
            ["carried", index + 1]
          );
          const [printedLine] = laneRedsLine(lines);
          expect(printedLine).toContain(
            "(stale since 2026-10-15T12:00:00.000Z; this read: Unknown (timed out after 2s))"
          );
          expect(printedLine).not.toContain("fresh as of");
        });
        const capped = yield* stageHotParcels(withLaneRedsTimedOut);
        expect(laneRedsLine(capped)).toEqual(["- lane-reds: Unknown (timed out after 2s)"]);
        const argument1 = S.decodeEffect(HotParcelsJson);
        const readFileString2 = yield* fs.readFileString(file);
        const restaged = yield* argument1(readFileString2);
        assertSome(
          A.findFirst(restaged.lines, (line) => line.parcel === "lane-reds"),
          timedOut
        );
        // A version 1 file carries nothing.
        yield* fs.writeFileString(
          file,
          '{"schemaVersion":"palantiri-hot/v1","writtenAt":"2026-10-15T12:00:00.000Z","lines":[{"parcel":"lane-reds","state":"read","text":"0 reds (fresh as of 2026-10-15T12:00:00.000Z)"}]}'
        );
        const stageHotParcels9 = yield* stageHotParcels(withLaneRedsTimedOut);
        expect(laneRedsLine(stageHotParcels9)).toEqual(["- lane-reds: Unknown (timed out after 2s)"]);
        // The rewrite leaves no temporary file behind.
        const readDirectory10 = yield* fs.readDirectory(root);
        expect(readDirectory10).toEqual([HOT_PARCELS_FILE]);
      }).pipe(withEnv({ BEEP_PALANTIRI_STATE_ROOT: "/state/palantiri", HOME: "/home/nobody" }))
    );
  });
});

describe("hot parcels and catalog codecs", () => {
  it.effect.prop(
    "round-trips any staged hot file through its JSON codec",
    [Arbitrary.schema(HotParcels)],
    Effect.fnUntraced(function* ([hot]) {
      const text = yield* S.encodeEffect(HotParcelsJson)(hot);
      const value11 = yield* S.decodeEffect(HotParcelsJson)(text);
      expect(value11).toEqual(hot);
    }),
    { arbitrary: fcRuns(24) }
  );

  it.effect.prop(
    "round-trips any parcel catalog listing through JSON",
    [Arbitrary.schema(ParcelCatalog)],
    Effect.fnUntraced(function* ([catalog]) {
      const codec = S.fromJsonString(ParcelCatalog);
      const argument2 = S.decodeEffect(codec);
      const value3 = yield* S.encodeEffect(codec)(catalog);
      const value12 = yield* argument2(value3);
      expect(value12).toEqual(catalog);
    }),
    { arbitrary: fcRuns(24) }
  );
});
