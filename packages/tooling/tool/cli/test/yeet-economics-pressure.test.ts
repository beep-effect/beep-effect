import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { AdmissionPressureStamp, provideRuntimeRootForTesting, RuntimeRootChoice } from "@beep/repo-cli/test/RepoRun";
import {
  AdmissionStampRead,
  AdmissionStampRow,
  decodePsiRecorderText,
  EconomicsAttempt,
  EconomicsJournal,
  EconomicsJournalDiagnostics,
  EconomicsPressure,
  EconomicsPressureRead,
  EconomicsPsiFigure,
  EconomicsPsiWindow,
  EconomicsSamplesJoined,
  FleetHostsRead,
  joinEconomicsPressure,
  PsiRecorderRead,
  PsiRecorderSample,
  renderEconomicsPressure,
  runYeetEconomics,
  YeetEconomicsOptions,
  YeetEconomicsReportJson,
  YeetEconomicsSource,
  YeetFleetHostSource,
  YeetPressureSource,
  YeetReviewLaneSource,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as TestConsole from "effect/testing/TestConsole";
import { pressureSourceOf } from "./support/EconomicsPressure.ts";

const T0 = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-11-14T12:00:00.000Z"));
const SECOND = 1000;
const iso = (offsetSeconds: number): string => DateTime.formatIso(DateTime.makeUnsafe(T0 + offsetSeconds * SECOND));
const HOST = "dankstation";

const diagnostics = EconomicsJournalDiagnostics.make({
  journalsObserved: 1,
  unreadableJournals: 0,
  invalidRows: 0,
  compactionReceipts: 0,
  duplicateStartedRowsDeduplicated: 0,
  duplicateFinishedRowsDeduplicated: 0,
  orphanVerdictFilesAdded: 0,
  unkeyedVerdictFiles: 0,
  starts: 0,
  startsWithoutFinish: 0,
  verdictsWithoutStart: 0,
});

const attempt = (
  attemptId: string,
  window: O.Option<readonly [number, number]>,
  host: O.Option<string> = O.none()
): EconomicsAttempt =>
  EconomicsAttempt.make({
    checkout: "beep-effect",
    runId: "main-0123456789ab",
    attemptId,
    branch: "main",
    mode: O.some("verify"),
    outcome: O.some("success"),
    failureKind: O.none(),
    failedStepId: O.none(),
    message: "",
    startedAt: O.map(window, ([start]) => iso(start)),
    endedAt: O.map(window, ([, end]) => iso(end)),
    elapsedMs: O.none(),
    diffFingerprint: O.none(),
    terminationReason: O.none(),
    verdictSchemaVersion: O.none(),
    host,
    lanes: [],
  });

const journal = (checkout: string, attempts: ReadonlyArray<EconomicsAttempt>): EconomicsJournal =>
  EconomicsJournal.make({ checkout, runId: "main-0123456789ab", cutoff: O.none(), attempts, diagnostics });

const sample = (
  offsetSeconds: number,
  bootId: string,
  figures: { readonly cpu: number; readonly io: O.Option<number>; readonly mem: O.Option<number> }
): PsiRecorderSample =>
  PsiRecorderSample.make({
    atMillis: T0 + offsetSeconds * SECOND,
    bootId,
    cpuSome10: O.some(figures.cpu),
    memorySome10: O.some(0),
    ioSome10: figures.io,
    memAvailableGib: figures.mem,
  });

const SAMPLES = [
  sample(0, "boot-1", { cpu: 1, io: O.some(4), mem: O.some(80) }),
  sample(30, "boot-1", { cpu: 2, io: O.some(5), mem: O.some(79.5) }),
  sample(60, "boot-2", { cpu: 3, io: O.some(6), mem: O.some(81) }),
  sample(90, "boot-2", { cpu: 4, io: O.none(), mem: O.none() }),
];

const stamp = (activeTokens: number): AdmissionPressureStamp =>
  AdmissionPressureStamp.make({
    capacityTokens: 8,
    activeTokens,
    queuedTokens: 0,
    queuedTickets: 0,
    memAvailableGib: 50,
  });

const STAMPS = [
  AdmissionStampRow.make({ nonce: "n-1", attemptId: "a-1", transition: "admitted", pressure: O.some(stamp(3)) }),
  AdmissionStampRow.make({ nonce: "n-2", attemptId: "a-1", transition: "released", pressure: O.some(stamp(5)) }),
  AdmissionStampRow.make({ nonce: "n-1", attemptId: "a-1", transition: "released", pressure: O.none() }),
];

const READ = EconomicsPressureRead.make({
  host: O.some(HOST),
  recorder: PsiRecorderRead.make({ status: "read", lines: 5, invalidLines: 1, samples: SAMPLES }),
  admissions: AdmissionStampRead.make({ status: "read", rows: 4, opaqueRows: 0, stamps: STAMPS }),
});

const LOCAL = [
  journal("beep-effect", [
    attempt("a-1", O.some([0, 60]), O.some(HOST)),
    attempt("a-2", O.some([85, 95])),
    attempt("a-3", O.some([31, 40])),
    attempt("a-4", O.some([-600, -500])),
    attempt("a-5", O.none()),
    attempt("a-6", O.some([60, 0])),
    attempt("a-7", O.some([0, 60]), O.some("tbk-worker")),
  ]),
];
const REMOTE = [journal("tbk-worker:beep-effect", [attempt("r-1", O.some([0, 60]))])];

const tagOf = (pressure: EconomicsPressure) =>
  A.map(pressure.attempts, (row) => [row.attemptId, row.samples, row.admissions] as const);

describe("joinEconomicsPressure", () => {
  it("joins samples by window and stamps by attempt id, every gap absent with its reason", () => {
    const pressure = joinEconomicsPressure(READ, LOCAL, REMOTE);
    const [joinedWindow, shortWindow, ...rest] = tagOf(pressure);
    deepStrictEqual(
      joinedWindow?.[1],
      EconomicsSamplesJoined.make({
        window: EconomicsPsiWindow.make({
          samples: 3,
          boots: 2,
          cpuSome10: EconomicsPsiFigure.makeOption({ mean: 2, max: 3 }),
          memorySome10: EconomicsPsiFigure.makeOption({ mean: 0, max: 0 }),
          ioSome10: EconomicsPsiFigure.makeOption({ mean: 5, max: 6 }),
          memAvailableGibMin: O.some(79.5),
        }),
      })
    );
    // One sample without io or MemAvailable: those figures are absent, never summarised over fewer samples.
    deepStrictEqual(
      shortWindow?.[1],
      EconomicsSamplesJoined.make({
        window: EconomicsPsiWindow.make({
          samples: 1,
          boots: 1,
          cpuSome10: EconomicsPsiFigure.makeOption({ mean: 4, max: 4 }),
          memorySome10: EconomicsPsiFigure.makeOption({ mean: 0, max: 0 }),
          ioSome10: O.none(),
          memAvailableGibMin: O.none(),
        }),
      })
    );
    expect(A.map(rest, ([id, samples]) => [id, samples._tag === "absent" ? samples.reason : "joined"])).toEqual([
      ["a-3", "no-samples"],
      ["a-4", "outside-recorder"],
      ["a-5", "untimed"],
      ["a-6", "untimed"],
      ["a-7", "remote-host"],
    ]);
    expect(joinedWindow?.[2]).toMatchObject({
      _tag: "joined",
      leases: [
        { nonce: "n-1", admitted: { _tag: "joined" }, released: { _tag: "absent", reason: "unstamped" } },
        { nonce: "n-2", admitted: { _tag: "absent", reason: "no-row" }, released: { _tag: "joined" } },
      ],
    });
    expect(
      A.map(rest, ([id, , admissions]) => [id, admissions._tag === "absent" ? admissions.reason : "joined"])
    ).toEqual([
      ["a-3", "no-admission-row"],
      ["a-4", "no-admission-row"],
      ["a-5", "no-admission-row"],
      ["a-6", "no-admission-row"],
      ["a-7", "remote-host"],
    ]);
    // The fleet host's attempt counts as remote-host in the source rows and is never listed.
    expect(A.map(pressure.attempts, (row) => row.attemptId)).not.toContain("r-1");
    expect(pressure.sources).toMatchObject([
      {
        source: "psi-recorder",
        status: "partial",
        joined: 2,
        absent: [
          { reason: "no-samples", count: 1 },
          { reason: "outside-recorder", count: 1 },
          { reason: "remote-host", count: 2 },
          { reason: "untimed", count: 2 },
        ],
      },
      {
        source: "admission-journal",
        status: "present",
        joined: 1,
        absent: [
          { reason: "no-admission-row", count: 5 },
          { reason: "remote-host", count: 2 },
        ],
      },
    ]);
    expect(pressure.sources[0]?.note).toContain("; 5 lines; missing: 1 of 5 lines did not decode");
    expect(pressure.sources[1]?.note).toContain("; 4 rows");
    expect(pressure.sources[1]?.note).not.toContain("missing");
  });

  it("marks every field source-unread and both sources absent when nothing was read", () => {
    const read = (recorder: PsiRecorderRead["status"], admissions: AdmissionStampRead["status"]) =>
      EconomicsPressureRead.make({
        host: O.none(),
        recorder: PsiRecorderRead.make({ status: recorder, lines: 0, invalidLines: 0, samples: [] }),
        admissions: AdmissionStampRead.make({ status: admissions, rows: 0, opaqueRows: 0, stamps: [] }),
      });
    const unread = joinEconomicsPressure(LOCAL, [])(read("missing", "unreadable"));
    expect(A.dedupe(A.map(unread.attempts, (row) => [row.samples, row.admissions]))).toEqual([
      [
        { _tag: "absent", reason: "source-unread" },
        { _tag: "absent", reason: "source-unread" },
      ],
    ]);
    expect(A.map(unread.sources, (row) => [row.status, row.note])).toEqual([
      [
        "absent",
        "PSI recorder lines (safe-pressure.jsonl), time-joined onto local attempt windows; missing: the source does not exist",
      ],
      [
        "absent",
        "admission history rows (archive and live journal), joined by attempt id; missing: the source could not be read",
      ],
    ]);
    const skipped = joinEconomicsPressure(read("not-read", "read"), [], []);
    expect(A.map(skipped.sources, (row) => row.status)).toEqual(["absent", "absent"]);
    expect(skipped.sources[0]?.note).toContain("; not read on this path");
    // An empty history was read, but holds no part: still absent, its note says 0 rows.
    expect(skipped.sources[1]?.note).toContain("; 0 rows");
    // An empty recorder: every window lies outside its (empty) span.
    const empty = joinEconomicsPressure(
      read("read", "read"),
      [journal("beep-effect", [attempt("a-1", O.some([0, 1]))])],
      []
    );
    expect(empty.attempts[0]?.samples).toEqual({ _tag: "absent", reason: "outside-recorder" });
  });

  it("renders one line per source, the source notes and the joined leases' stamps", () => {
    const lines = renderEconomicsPressure(joinEconomicsPressure(READ, LOCAL, REMOTE));
    expect(lines).toEqual([
      "pressure (MEAS-08 time join; context, not attribution): psi-recorder partial, 2 of 8 joined (absent: no-samples 1, outside-recorder 1, remote-host 2, untimed 2); admission-journal present, 1 of 8 joined (absent: no-admission-row 5, remote-host 2)",
      "  psi-recorder: PSI recorder lines (safe-pressure.jsonl), time-joined onto local attempt windows; 5 lines; missing: 1 of 5 lines did not decode",
      "  admission-journal: admission history rows (archive and live journal), joined by attempt id; 4 rows",
      "  stamps: 1 admitted and 1 released of 2 joined lease(s)",
    ]);
    const defaults = renderEconomicsPressure(EconomicsPressure.make({}));
    expect(defaults[0]).toBe(
      "pressure (MEAS-08 time join; context, not attribution): psi-recorder absent, 0 of 0 joined; admission-journal absent, 0 of 0 joined"
    );
  });
});

describe("decodePsiRecorderText", () => {
  const line = (time: string, extra = "") =>
    `{"time": "${time}", "boot_id": "b-1", "taint": 0, "memory": {"MemAvailable": "94312740 kB"}, "pressure": {"cpu": "some avg10=0.61 avg60=2.01 avg300=1.25 total=1\\nfull avg10=0.00 avg60=0.00 avg300=0.00 total=0", "memory": "some avg10=0.00 avg60=0.00 avg300=0.00 total=3", "io": "some avg10=10.52 avg60=3.05 avg300=1.47 total=6"}${extra}}`;

  it("decodes recorder lines, counts the ones that do not decode, and skips a torn tail", () => {
    const text = A.join(
      [
        line("2026-11-14T12:00:30.000000+00:00"),
        line("2026-11-14T12:00:00.364735+00:00", ', "cpu_tctl_c": 60.375'),
        '{"time": "not a time", "boot_id": "b-1"}',
        '{"time": "2026-11-14T12:01:00+00:00", "boot_id": "b-2"}',
        "{}",
        '{"time": "2026-11-14T12:0',
      ],
      "\n"
    );
    const read = decodePsiRecorderText(text);
    expect([read.status, read.lines, read.invalidLines]).toEqual(["read", 5, 2]);
    expect(A.map(read.samples, (each) => each.atMillis)).toEqual([T0 + 364, T0 + 30_000, T0 + 60_000]);
    deepStrictEqual(
      read.samples[0],
      PsiRecorderSample.make({
        atMillis: T0 + 364,
        bootId: "b-1",
        cpuSome10: O.some(0.61),
        memorySome10: O.some(0),
        ioSome10: O.some(10.52),
        memAvailableGib: O.some(89.944),
      })
    );
    deepStrictEqual(
      read.samples[2],
      PsiRecorderSample.make({
        atMillis: T0 + 60_000,
        bootId: "b-2",
        cpuSome10: O.none(),
        memorySome10: O.none(),
        ioSome10: O.none(),
        memAvailableGib: O.none(),
      })
    );
    // A terminated bad last line is a whole line that did not decode, not an append in flight.
    expect(decodePsiRecorderText("{}\n").invalidLines).toBe(1);
    expect(decodePsiRecorderText(`${line("2026-11-14T12:00:00+00:00")}`).lines).toBe(1);
  });
});

const PlatformLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

const ADMISSION_LINES = [
  '{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"n-1","pid":1,"procStart":"1","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"o","enqueuedAtMillis":0,"admittedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059","pressure":{"capacityTokens":8,"activeTokens":3,"queuedTokens":0,"queuedTickets":0,"memAvailableGib":50,"psiCpuSome10":1.5}}',
  '{"_tag":"admission-admitted","schemaVersion":"yeet-admission-journal/v1","nonce":"n-0","pid":1,"procStart":"1","kind":"full-proof","weightTokens":3,"priority":"verify","originKey":"o","enqueuedAtMillis":0,"admittedAtMillis":0}',
  '{"_tag":"admission-released","schemaVersion":"yeet-admission-journal/v1","nonce":"n-2","pid":1,"releasedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059"}',
  '{"checkoutRoot":"/repo","branch":"main","_tag":"admission-released","schemaVersion":"yeet-admission-journal/v3","nonce":"n-1","pid":1,"releasedAtMillis":0,"attemptId":"550e8400-e29b-41d4-a716-446655440059","pressure":{"capacityTokens":8,"activeTokens":2,"queuedTokens":0,"queuedTickets":0,"memAvailableGib":49}}',
  '{"attemptId":"550e8400-e29b-41d4-a716-446655440059","pid":1,"procStart":"1","kind":"full-proof","priority":"verify","originKey":"o","checkoutRoot":"/repo","branch":"main","enqueuedAtMillis":0,"nonce":"n-1","schemaVersion":"yeet-admission-journal/v3","_tag":"admission-enqueued","weightTokens":3}',
  '{"_tag":"admission-from-the-future"}',
];

const readWith = (home: O.Option<string>, runtimeRoot: string) =>
  Effect.gen(function* () {
    const source = yield* YeetPressureSource.make;
    return yield* source.read;
  }).pipe(
    provideRuntimeRootForTesting(RuntimeRootChoice.make({ kind: "test-override", root: runtimeRoot })),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({ env: O.match(home, { onNone: () => ({}), onSome: (HOME) => ({ HOME }) }) })
    )
  );

it.layer(PlatformLayer, { timeout: "30 seconds" })("YeetPressureSource", (it) => {
  it.effect("reads the recorder under HOME and the admission history under the admission root", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("/home/a/.local/state/beep-psi", { recursive: true });
      yield* fs.writeFileString(
        "/home/a/.local/state/beep-psi/safe-pressure.jsonl",
        '{"time": "2026-11-14T12:00:00+00:00", "boot_id": "b-1"}\n'
      );
      yield* fs.makeDirectory("/runtime-a/beep/admit", { recursive: true });
      yield* fs.writeFileString("/runtime-a/beep/admit/journal.ndjson", `${A.join(ADMISSION_LINES, "\n")}\n`);
      const read = yield* readWith(O.some("/home/a"), "/runtime-a");
      assertTrue(read.host.pipe(O.isSome));
      expect([read.recorder.status, read.recorder.lines, read.recorder.samples.length]).toEqual(["read", 1, 1]);
      expect([read.admissions.status, read.admissions.rows, read.admissions.opaqueRows]).toEqual(["read", 6, 1]);
      deepStrictEqual(
        A.map(read.admissions.stamps, (row) => [
          row.nonce,
          row.transition,
          O.map(row.pressure, (each) => each.activeTokens),
        ]),
        [
          ["n-1", "admitted", O.some(3)],
          ["n-2", "released", O.none()],
          ["n-1", "released", O.some(2)],
        ]
      );
    })
  );

  it.effect("reads a missing recorder, no HOME, and unreadable sources without failing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const absent = yield* readWith(O.some("/home/alice"), "/runtime-b");
      expect([absent.recorder.status, absent.admissions.status, absent.admissions.rows]).toEqual([
        "missing",
        "read",
        0,
      ]);
      const noHome = yield* readWith(O.none(), "/runtime-b");
      expect(noHome.recorder.status).toBe("missing");
      // A directory where the recorder file belongs, and a file where the archive directory belongs.
      yield* fs.makeDirectory("/home/another/.local/state/beep-psi/safe-pressure.jsonl", { recursive: true });
      yield* fs.makeDirectory("/runtime-c/beep/admit", { recursive: true });
      yield* fs.writeFileString("/runtime-c/beep/admit/journal-archive", "not a directory");
      const unreadable = yield* readWith(O.some("/home/another"), "/runtime-c");
      expect([unreadable.recorder.status, unreadable.admissions.status]).toEqual(["unreadable", "unreadable"]);
    })
  );
});

const LOCAL_ATTEMPT = attempt("a-1", O.some([0, 60]));
const REMOTE_JOURNAL = journal("tbk-worker:beep-effect", [attempt("r-1", O.some([0, 60]))]);

const CommandLayer = Layer.mergeAll(
  PlatformLayer,
  TestConsole.layer,
  Layer.succeed(
    YeetEconomicsSource,
    YeetEconomicsSource.of({
      read: Effect.fn("YeetEconomicsSource.read")(() => Effect.succeed([journal("beep-effect", [LOCAL_ATTEMPT])])),
    })
  ),
  Layer.succeed(
    YeetReviewLaneSource,
    YeetReviewLaneSource.of({ read: Effect.fn("YeetReviewLaneSource.read")(() => Effect.succeed([])) })
  ),
  Layer.succeed(
    YeetFleetHostSource,
    YeetFleetHostSource.of({
      read: Effect.fn("YeetFleetHostSource.read")(() =>
        Effect.succeed(FleetHostsRead.make({ journals: [REMOTE_JOURNAL], receipts: [] }))
      ),
    })
  ),
  pressureSourceOf(READ)
);

it.layer(CommandLayer, { timeout: "30 seconds" })("yeet economics pressure section", (it) => {
  it.effect("joins the read onto the local attempts and marks the fleet hosts' attempts remote", () =>
    Effect.gen(function* () {
      yield* runYeetEconomics(
        YeetEconomicsOptions.make({ json: true, branch: O.none(), fleet: false, fleetHosts: true }),
        Effect.succeed("/repo")
      );
      yield* runYeetEconomics(
        YeetEconomicsOptions.make({ json: false, branch: O.none(), fleet: false }),
        Effect.succeed("/repo")
      );
      const lines = yield* TestConsole.logLines;
      const report = yield* YeetEconomicsReportJson.decode(`${lines[0]}`);
      expect(A.map(report.pressure.attempts, (row) => [row.attemptId, row.samples._tag, row.admissions._tag])).toEqual([
        ["a-1", "joined", "joined"],
      ]);
      expect(A.map(report.pressure.sources, (row) => row.absent)).toEqual([
        [{ reason: "remote-host", count: 1 }],
        [{ reason: "remote-host", count: 1 }],
      ]);
      expect(`${lines[1]}`).toContain("pressure (MEAS-08 time join; context, not attribution)");
    })
  );
});
