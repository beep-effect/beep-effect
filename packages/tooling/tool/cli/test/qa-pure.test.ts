import { Exiftool } from "@beep/exiftool";
import { FFmpeg } from "@beep/ffmpeg";
import {
  ArtifactBudget,
  BeaconEvent,
  CaptureSession,
  ClockCorrelator,
  ClockSync,
  CssAnimationEvent,
  CssTransitionEvent,
  DroppedWindow,
  ExtractionPlan,
  ExtractionWindow,
  encodeActionEventJson,
  FocusInEvent,
  FocusOutEvent,
  GifSpec,
  KeyDownEvent,
  MarkerEvent,
  PointerDownEvent,
  PointerEnterEvent,
  PointerLeaveEvent,
  PointerMoveEvent,
  PointerUpEvent,
  RoundLayout,
  RoundNumber,
  ScrollEvent,
  SessionManifest,
  SessionStore,
  Viewport,
} from "@beep/qa-capture";
import {
  AppHostTarget,
  artifactBudgetPath,
  CaptureTargetRequest,
  citedEventIds,
  citedPaths,
  discoverRecordedVideo,
  EvidenceCrossCheck,
  extractionPlanPath,
  formatMib,
  HarnessEnvOptions,
  harnessEnv,
  inventoryJsonPath,
  isBlockingProbe,
  JUDGE_PER_FILE_BUDGET_BYTES,
  JudgeEvidenceFile,
  makeSessionId,
  PORTLESS_PORT,
  parseJudgeOutput,
  portlessUrlForApp,
  QaEventLog,
  QaExtractOptions,
  QaFindingId,
  QaInventory,
  QaJudgeRef,
  QaProbe,
  qaRootPath,
  RenderTimelineOptions,
  raiseCrossCheckFailure,
  readArtifactBudget,
  readCommitProvenance,
  readEventLog,
  readExtractionPlan,
  readLegacyManifest,
  readRecordStartHint,
  recordHintPath,
  renderDoctorReport,
  renderExtractionPlanTable,
  renderInventoryMarkdown,
  renderRoundReport,
  renderTimeline,
  resolveAppHostTarget,
  resolveCaptureTarget,
  runQaExtract,
  selectJudgeEvidence,
  windowSeqsForLabel,
  writeArtifactBudget,
  writeRecordStartHint,
} from "@beep/repo-cli/commands/Qa";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { thunk } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import type { ActionEvent } from "@beep/qa-capture";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const SpawnerLayer = NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(PlatformLayer));

const withTempDir = <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-pure-" })),
    use,
    (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

const layoutFor = (root: string): RoundLayout =>
  RoundLayout.make({
    clipsDir: `${root}/clips`,
    eventsPath: `${root}/events.ndjson`,
    framesDir: `${root}/frames`,
    reportPath: `${root}/report.md`,
    root,
    round: 1,
    sessionPath: `${root}/session.json`,
    sheetsDir: `${root}/sheets`,
    videoDir: `${root}/video`,
  });

const encodeJson = UnknownFromJsonString.encodeUnknownEffect;

const clock = ClockSync.make({ confidence: "high", method: "beacon", offsetMs: 0, residualRmsMs: 4, slope: 1 });

const marker = (label: string, seq: number, tEpochMs: number) =>
  MarkerEvent.make({ kind: "marker", label, seq, tEpochMs });

describe("commands/Qa Qa.session pure helpers", () => {
  it("expands decoded app targets onto both portless host shapes", () => {
    expect(portlessUrlForApp(AppHostTarget.make({ name: "storybook", namespace: "apps" }))).toBe(
      `http://storybook.beep.localhost:${PORTLESS_PORT}`
    );
    expect(portlessUrlForApp(AppHostTarget.make({ name: "kg-scratch", namespace: "labs" }))).toBe(
      `http://kg-scratch.labs.beep.localhost:${PORTLESS_PORT}`
    );
    expect(PORTLESS_PORT).toBe(1355);
  });

  it("stamps a session id from the round and start time", () => {
    expect(makeSessionId(2, 1754000000000)).toBe("qa-round-2-1754000000000");
  });

  it("prefers --url over --app and derives loopback origins", () =>
    Effect.runPromise(
      Effect.map(
        resolveCaptureTarget(
          "/repo",
          CaptureTargetRequest.make({ app: O.some("storybook"), url: O.some("http://example.test:4321/page") })
        ),
        (target) => {
          expect(target.url).toBe("http://example.test:4321/page");
          expect(target.allowedOrigins).toContain("http://example.test:4321");
          expect(target.allowedOrigins).toContain("http://localhost:4321");
          expect(target.allowedOrigins).toContain("http://127.0.0.1:4321");
        }
      ).pipe(provideScopedLayer(PlatformLayer))
    ));

  it("falls back to the apps host for names that are not lab workspaces", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const target = yield* resolveCaptureTarget(
            dir,
            CaptureTargetRequest.make({ app: O.some("storybook"), url: O.none() })
          );
          expect(target.url).toBe(`http://storybook.beep.localhost:${PORTLESS_PORT}`);
        })
      )
    ));

  it("keeps the apps host for names that resolve under apps/", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory(`${dir}/apps/my-lab`, { recursive: true });
          const target = yield* resolveCaptureTarget(
            dir,
            CaptureTargetRequest.make({ app: O.some("my-lab"), url: O.none() })
          );
          expect(target.url).toBe(`http://my-lab.beep.localhost:${PORTLESS_PORT}`);
        })
      )
    ));

  it("expands --app to the labs host when the workspace lives under apps/labs", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory(`${dir}/apps/labs/my-lab`, { recursive: true });
          const target = yield* resolveCaptureTarget(
            dir,
            CaptureTargetRequest.make({ app: O.some("my-lab"), url: O.none() })
          );
          expect(target.url).toBe(`http://my-lab.labs.beep.localhost:${PORTLESS_PORT}`);
          expect(target.allowedOrigins).toContain(`http://my-lab.labs.beep.localhost:${PORTLESS_PORT}`);
          expect(target.allowedOrigins).toContain(`http://localhost:${PORTLESS_PORT}`);
          expect(target.allowedOrigins).toContain(`http://127.0.0.1:${PORTLESS_PORT}`);
        })
      )
    ));

  it("resolves apps over labs when both directories exist", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory(`${dir}/apps/shared-name`, { recursive: true });
          yield* fs.makeDirectory(`${dir}/apps/labs/shared-name`, { recursive: true });
          const target = yield* resolveAppHostTarget(dir, "shared-name");
          expect(target.namespace).toBe("apps");
          expect(portlessUrlForApp(target)).toBe(`http://shared-name.beep.localhost:${PORTLESS_PORT}`);
        })
      )
    ));

  it.effect("fails when neither --url nor --app is supplied", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        resolveCaptureTarget("/repo", CaptureTargetRequest.make({ app: O.none(), url: O.none() }))
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("fails when the supplied --url is not absolute", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        resolveCaptureTarget("/repo", CaptureTargetRequest.make({ app: O.none(), url: O.some("not-a-url") }))
      );
      expect(Exit.isFailure(exit)).toBe(true);
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});

describe("commands/Qa path helpers", () => {
  it.effect("derives every round-relative artifact path from one layout", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const layout = layoutFor("/repo/.beep/qa/round-1");
      expect(qaRootPath(path, "/repo")).toBe("/repo/.beep/qa");
      expect(recordHintPath(path, layout)).toBe("/repo/.beep/qa/round-1/video/record-hint.json");
      expect(inventoryJsonPath(path, layout)).toContain("round-1");
      expect(extractionPlanPath(path, layout)).toContain("extraction-plan.json");
      expect(artifactBudgetPath(path, layout)).toContain("artifact-budget.json");
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});

describe("commands/Qa Qa.session filesystem helpers", () => {
  it("returns an empty log when the events file is absent", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const log = yield* readEventLog(`${dir}/missing.ndjson`);
          expect(log.events).toEqual([]);
          expect(log.rejectedCount).toBe(0);
        })
      )
    ));

  it("decodes valid witness lines and counts the rejected ones", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          const eventsPath = `${dir}/events.ndjson`;
          const good = yield* encodeActionEventJson(marker("scenario:one", 1, 1754000000000));
          yield* fs.writeFileString(eventsPath, `${good}\n{"kind":"nonsense"}\n\n`);
          const log = yield* readEventLog(eventsPath);
          expect(log.events.length).toBe(1);
          expect(log.rejectedCount).toBe(1);
        })
      )
    ));

  it("round-trips the record-start hint and reports none when absent", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const hintPath = `${dir}/record-hint.json`;
          expect(yield* readRecordStartHint(hintPath)).toEqual(O.none());
          yield* writeRecordStartHint(hintPath, 1754000000123);
          expect(yield* readRecordStartHint(hintPath)).toEqual(O.some(1754000000123));
        })
      )
    ));

  it("round-trips the artifact budget and reports none for an absent plan", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const budgetPath = `${dir}/artifact-budget.json`;
          expect(yield* readArtifactBudget(budgetPath)).toEqual(O.none());
          yield* writeArtifactBudget(budgetPath, ArtifactBudget.make({ maxTotalBytes: 4096 }));
          const budget = yield* readArtifactBudget(budgetPath);
          expect(O.isSome(budget)).toBe(true);
          expect(yield* readExtractionPlan(`${dir}/extraction-plan.json`)).toEqual(O.none());
        })
      )
    ));

  it("discovers a recorded container and reports none for an empty video directory", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          const videoDir = `${dir}/video`;
          expect(yield* discoverRecordedVideo(videoDir)).toEqual(O.none());
          yield* fs.makeDirectory(videoDir, { recursive: true });
          expect(yield* discoverRecordedVideo(videoDir)).toEqual(O.none());
          yield* fs.writeFileString(`${videoDir}/notes.txt`, "ignore me");
          yield* fs.writeFileString(`${videoDir}/capture.mkv`, "not really a container");
          const found = yield* discoverRecordedVideo(videoDir);
          expect(O.isSome(found)).toBe(true);
          expect(O.getOrElse(found, () => "")).toContain("capture.mkv");
        })
      )
    ));

  it("degrades commit provenance to unknown outside a git checkout", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const provenance = yield* readCommitProvenance(dir).pipe(provideScopedLayer(SpawnerLayer));
          expect(provenance.sha).toBe("unknown");
          expect(provenance.dirty).toBe(false);
        })
      )
    ));

  it("reports no legacy manifest when the file is absent", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          expect(yield* readLegacyManifest(`${dir}/manifest.json`)).toEqual(O.none());
        })
      )
    ));

  it("decodes a legacy screenshot manifest", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          const manifestPath = `${dir}/manifest.json`;
          yield* fs.writeFileString(
            manifestPath,
            yield* encodeJson({
              scenarios: [{ assertions: [], name: "dock drag", notes: ["watch the sash"], screenshots: [] }],
            })
          );
          const legacy = yield* readLegacyManifest(manifestPath);
          expect(O.isSome(legacy)).toBe(true);
        })
      )
    ));

  // Decoding the manifest rather than hand-building it keeps this test honest
  // about the shape `beep qa judge-pack` actually consumes.
  it("folds decoded legacy notes and failed assertions into the matching timeline section", () =>
    Effect.runPromise(
      withTempDir(
        Effect.fnUntraced(function* (dir) {
          const fs = yield* FileSystem.FileSystem;
          const manifestPath = `${dir}/manifest.json`;
          yield* fs.writeFileString(
            manifestPath,
            yield* encodeJson({
              scenarios: [
                {
                  assertions: [
                    { detail: "sash never moved", name: "sash moves", ok: false },
                    { name: "no smear", ok: true },
                  ],
                  name: "drag",
                  notes: ["watch the ghost"],
                  screenshots: [],
                },
              ],
            })
          );
          const legacy = yield* readLegacyManifest(manifestPath);
          const timeline = renderTimeline(
            RenderTimelineOptions.make({
              clockSync: clock,
              eventLog: QaEventLog.make({ events: [marker("scenario:drag", 1, 1000)], rejectedCount: 0 }),
              legacy,
              round: 5,
              videoDurationSeconds: 12,
            })
          );
          expect(timeline).toContain("> note: watch the ghost");
          expect(timeline).toContain("> FAILED ASSERTION: sash moves (sash never moved)");
          expect(timeline).not.toContain("no smear");
        })
      )
    ));
});

describe("commands/Qa Doctor rendering", () => {
  const probe = (name: string, status: "fail" | "pass" | "warn", required: boolean) =>
    QaProbe.make({ detail: `${name} detail`, name, required, status });

  it("classifies only required failures as blocking", () => {
    expect(isBlockingProbe(probe("ffmpeg", "fail", true))).toBe(true);
    expect(isBlockingProbe(probe("obs", "fail", false))).toBe(false);
    expect(isBlockingProbe(probe("ffmpeg", "warn", true))).toBe(false);
    expect(isBlockingProbe(probe("ffmpeg", "pass", true))).toBe(false);
  });

  it("lists every probe and names the blocking ones", () => {
    const lines = renderDoctorReport([probe("ffmpeg", "fail", true), probe("obs", "warn", false)]);
    expect(lines[0]).toBe("qa doctor");
    expect(lines.join("\n")).toContain("FAIL");
    expect(lines.join("\n")).toContain("warn");
    expect(lines[lines.length - 1]).toBe("missing required tooling: ffmpeg");
  });

  it("reports all-present when nothing required failed", () => {
    const lines = renderDoctorReport([probe("ffmpeg", "pass", true)]);
    expect(lines[lines.length - 1]).toBe("all required tooling present");
  });
});

describe("commands/Qa Qa.render extraction plan table", () => {
  const window = ExtractionWindow.make({
    endEpochMs: 1754000002000,
    frameTimesEpochMs: [1754000001000, 1754000001500],
    gif: O.some(GifSpec.make({ fps: 12, width: 640 })),
    label: "drag-w0",
    priority: "P0",
    ruleKind: "drag",
    sourceSeqs: [4, 5],
    startEpochMs: 1754000001000,
  });

  const plan = ExtractionPlan.make({
    budget: ArtifactBudget.make({}),
    dropped: [
      DroppedWindow.make({
        detail: O.none(),
        endEpochMs: 1754000004000,
        priority: "P2",
        reason: "budget-dropped",
        ruleKind: "hover",
        startEpochMs: 1754000003000,
      }),
    ],
    estimatedTotalBytes: 2048,
    schemaVersion: "beep.qa.extraction-plan.v1",
    windows: [window],
  });

  it("renders the window table, gif spec, budget line, and dropped rows", () => {
    const lines = renderExtractionPlanTable(plan, 3).join("\n");
    expect(lines).toContain("1 window(s), 3 driver request(s)");
    expect(lines).toContain("drag-w0");
    expect(lines).toContain("640px@12fps");
    expect(lines).toContain("estimated:");
    expect(lines).toContain("dropped hover P2");
  });

  it("renders a dash when a window carries no gif", () => {
    const noGif = ExtractionPlan.make({
      budget: ArtifactBudget.make({}),
      dropped: [],
      estimatedTotalBytes: 0,
      schemaVersion: "beep.qa.extraction-plan.v1",
      windows: [ExtractionWindow.make({ ...window, gif: O.none() })],
    });
    expect(renderExtractionPlanTable(noGif, 0).join("\n")).toContain("| - |");
  });

  it("formats byte counts as mebibytes", () => {
    expect(formatMib(2097152)).toBe("2.00 MiB");
    expect(formatMib(0)).toBe("0.00 MiB");
  });

  it("recovers the source sequences of a planned window from its artifact label", () => {
    expect(windowSeqsForLabel(plan, "drag-w0")).toEqual([4, 5]);
    expect(windowSeqsForLabel(plan, "drag-w9")).toEqual([]);
    expect(windowSeqsForLabel(plan, "contact-sheet")).toEqual([]);
  });
});

describe("commands/Qa report warnings without a plan", () => {
  const manifest = SessionManifest.make({
    artifacts: [],
    clockSync: O.none(),
    eventsPath: "events.ndjson",
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: CaptureSession.make({
      commitDirty: false,
      commitSha: "cleansha",
      id: "qa-round-1-1754000000000",
      lane: "obs",
      round: 1,
      scenario: O.none(),
      startedAtEpochMs: 1754000000000,
      toolVersions: {},
      url: "http://storybook.beep.localhost:1355/",
      viewport: Viewport.make({ height: 1000, width: 1600 }),
    }),
    videoPath: O.none(),
  });

  it("warns about the missing clock sync and missing video, and omits dirty", () => {
    const events = [
      marker("checkpoint", 1, 1754000000001),
      BeaconEvent.make({
        flipIndex: 0,
        isWhite: false,
        kind: "beacon",
        seq: 2,
        tEpochMs: 1754000000002,
        tPaintEpochMs: 1754000000002,
      }),
    ];
    const report = renderRoundReport(manifest, QaEventLog.make({ events, rejectedCount: 0 }), O.none());
    // Two distinct kinds force the per-kind count table to actually sort.
    expect(report).toContain("| beacon | 1 |");
    expect(report).toContain("| marker | 1 |");
    expect(report).toContain("Clock sync has not been derived");
    expect(report).toContain("No recorded video was captured");
    expect(report).toContain("`cleansha`");
    expect(report).not.toContain("(dirty)");
    expect(report).toContain("_none_");
  });
});

describe("commands/Qa JudgePack timeline rendering", () => {
  const options = (events: ReadonlyArray<ActionEvent>) =>
    RenderTimelineOptions.make({
      clockSync: clock,
      eventLog: QaEventLog.make({ events, rejectedCount: 0 }),
      legacy: O.none(),
      round: 2,
      videoDurationSeconds: 30,
    });

  it("segments the timeline on scenario markers", () => {
    const timeline = renderTimeline(
      options([marker("scenario:drag the sash", 1, 1000), marker("checkpoint", 2, 2000)])
    );
    expect(timeline).toContain("# Round 2 timeline");
    expect(timeline).toContain("## scenario: drag the sash");
    expect(timeline).toContain("seq=2");
  });

  it("falls back to a single section when no scenario marker exists", () => {
    const timeline = renderTimeline(options([marker("checkpoint", 1, 1000)]));
    expect(timeline).toContain("## all events");
    expect(timeline).toContain("Clock: `beacon`");
  });

  // The timeline's per-event detail is an exhaustive match over the whole
  // ActionEvent union, so one event of every kind keeps that match honest.
  it("renders a detail line for every witness event kind", () => {
    const at = (seq: number) => ({ seq, tEpochMs: 1754000000000 + seq });
    const events = [
      MarkerEvent.make({ kind: "marker", label: "scenario:all kinds", ...at(1) }),
      BeaconEvent.make({ flipIndex: 0, isWhite: true, kind: "beacon", tPaintEpochMs: 1754000000002, ...at(2) }),
      PointerDownEvent.make({
        button: 0,
        kind: "pointer-down",
        pointerId: 1,
        selectorPath: "div.sash",
        x: 10.4,
        y: 20.6,
        ...at(3),
      }),
      PointerMoveEvent.make({ kind: "pointer-move", pointerId: 1, x: 30.2, y: 40.8, ...at(4) }),
      PointerUpEvent.make({
        button: 0,
        kind: "pointer-up",
        pointerId: 1,
        selectorPath: "div.sash",
        x: 50.1,
        y: 60.9,
        ...at(5),
      }),
      PointerEnterEvent.make({ kind: "pointer-enter", selectorPath: "div.pane", ...at(6) }),
      PointerLeaveEvent.make({ kind: "pointer-leave", selectorPath: "div.pane", ...at(7) }),
      FocusInEvent.make({ kind: "focus-in", selectorPath: "input.name", ...at(8) }),
      FocusOutEvent.make({ kind: "focus-out", selectorPath: "input.name", ...at(9) }),
      KeyDownEvent.make({ key: "Escape", kind: "key-down", modifiers: [], ...at(10) }),
      ScrollEvent.make({ kind: "scroll", scrollLeft: 0, scrollTop: 120, ...at(11) }),
      CssTransitionEvent.make({
        durationMs: 200,
        kind: "transition",
        phase: "start",
        property: "opacity",
        selectorPath: "div.pane",
        ...at(12),
      }),
      CssAnimationEvent.make({
        animationName: "fade",
        durationMs: 300,
        kind: "animation",
        phase: "end",
        selectorPath: "div.pane",
        ...at(13),
      }),
    ];
    const timeline = renderTimeline(options(events));
    expect(timeline).toContain("## scenario: all kinds");
    expect(timeline).toContain("flip 0 white");
    expect(timeline).toContain("div.sash @10,21");
    expect(timeline).toContain("@30,41");
    expect(timeline).toContain("Escape");
    expect(timeline).toContain("start div.pane");
    expect(timeline).toContain("end div.pane");
    for (const seq of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
      expect(timeline).toContain(`seq=${seq}`);
    }
  });
});

describe("commands/Qa evidence selection budget", () => {
  const file = (path: string, bytes: number, kind: "frame" | "screenshot" | "sheet") =>
    JudgeEvidenceFile.make({ bytes, kind, path });

  it("sacrifices green screenshots before frame strips", () => {
    const selection = selectJudgeEvidence(
      [file("screenshots/green.png", 10, "screenshot"), file("frames/motion.png", 10, "frame")],
      ["green.png"]
    );
    expect(selection.dropped).toEqual([]);
    expect(selection.files.length).toBe(2);
  });

  it("drops files above the per-file budget with that reason", () => {
    const selection = selectJudgeEvidence([file("sheets/huge.jpg", JUDGE_PER_FILE_BUDGET_BYTES + 1, "sheet")], []);
    expect(selection.files).toEqual([]);
    expect(selection.dropped[0]?.reason).toBe("per-file-budget");
  });
});

describe("commands/Qa JudgeCheck citation collection", () => {
  const inventory = QaInventory.make({
    findings: [
      {
        evidence: [
          { eventIds: [1, 2], frameRange: O.none(), kind: "strip", path: "frames/a.png" },
          { eventIds: [2], frameRange: O.none(), kind: "strip", path: "frames/a.png" },
        ],
        fix: "fix it",
        id: QaFindingId.make("R1-01"),
        lens: "selection-smear",
        repro: "drag",
        resolvedInRound: O.none(),
        severity: "P0",
        title: "smear",
      },
    ],
    judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
    requiredCount: 1,
    round: 1,
    schemaVersion: "qa-inventory/v1",
    sessionRef: "session.json",
  });

  it("deduplicates cited paths and event ids", () => {
    expect(citedPaths(inventory)).toEqual(["frames/a.png"]);
    expect(citedEventIds(inventory)).toEqual([1, 2]);
  });

  it("renders a frame range and cited events onto each evidence line", () => {
    const withRange = QaInventory.make({
      findings: [
        {
          evidence: [{ eventIds: [11, 12], frameRange: O.some([3, 7]), kind: "strip", path: "frames/drag.png" }],
          fix: "clamp the ghost",
          id: QaFindingId.make("R2-01"),
          lens: "drag-ghost",
          repro: "drag the sash",
          resolvedInRound: O.some(3),
          severity: "P1",
          title: "ghost lags",
        },
      ],
      judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
      requiredCount: 1,
      round: 2,
      schemaVersion: "qa-inventory/v1",
      sessionRef: "session.json",
    });
    const markdown = renderInventoryMarkdown(withRange);
    expect(markdown).toContain("frames 3–7");
    expect(markdown).toContain("events 11, 12");
    expect(markdown).toContain("frames/drag.png");
  });

  it.effect("passes a clean cross-check and fails a dirty one", () =>
    Effect.gen(function* () {
      const clean = yield* Effect.exit(
        raiseCrossCheckFailure(1, EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] }))
      );
      expect(Exit.isSuccess(clean)).toBe(true);
      const dirty = yield* Effect.exit(
        raiseCrossCheckFailure(1, EvidenceCrossCheck.make({ missingEventIds: [9], missingPaths: [] }))
      );
      expect(Exit.isFailure(dirty)).toBe(true);
    })
  );
});

describe("commands/Qa judge output parsing", () => {
  const fence = "`".repeat(3);
  const inventoryBody = {
    findings: [],
    judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
    requiredCount: 0,
    round: 3,
    schemaVersion: "qa-inventory/v1",
    sessionRef: "session.json",
  };

  it.effect("parses the last fenced block out of narrated judge output", () =>
    Effect.gen(function* () {
      const body = yield* encodeJson(inventoryBody);
      const inventory = yield* parseJudgeOutput(`thinking out loud\n${fence}json\n${body}\n${fence}\n`);
      expect(inventory.round).toBe(3);
      expect(inventory.requiredCount).toBe(0);
    })
  );

  it.effect("reports when the output carries no parseable JSON object", () =>
    Effect.gen(function* () {
      const missing = yield* Effect.flip(parseJudgeOutput("no json here"));
      const malformed = yield* Effect.flip(parseJudgeOutput('noise { "message": "unterminated }'));

      expect(missing.message).toContain("no parseable JSON inventory object (fenced or unfenced)");
      expect(malformed.message).toContain("no parseable JSON inventory object (fenced or unfenced)");
    })
  );

  it.effect("preserves malformed-JSON and schema-rejection adapter messages", () =>
    Effect.gen(function* () {
      const invalidInventory = yield* encodeJson({});
      const malformed = yield* Effect.flip(parseJudgeOutput(`${fence}json\n{\n${fence}\n`));
      const rejected = yield* Effect.flip(parseJudgeOutput(`${fence}json\n${invalidInventory}\n${fence}\n`));

      expect(malformed.message).toBe("qa judge-ingest could not parse the judge's final JSON block.");
      expect(rejected.message).toBe(
        "qa judge-ingest rejected the judge inventory. Check schemaVersion, finding ids (R<round>-<nn>), lens values, and that requiredCount equals the P0+P1 count."
      );
    })
  );
});

describe("commands/Qa extract --dry-run driver isolation", () => {
  // Every method dies: the dry-run contract is "persist the plan without
  // running any driver", so reaching ffmpeg or exiftool at all is the bug.
  const ffmpegUnreachable = Effect.die("qa extract --dry-run must not invoke ffmpeg");
  const exiftoolUnreachable = Effect.die("qa extract --dry-run must not invoke exiftool");
  const dieFfmpeg = Layer.succeed(FFmpeg)(
    FFmpeg.of({
      extractClip: thunk(ffmpegUnreachable),
      extractFrameAt: thunk(ffmpegUnreachable),
      extractFrames: thunk(ffmpegUnreachable),
      extractFramesAt: thunk(ffmpegUnreachable),
      probeRegionLuminance: thunk(ffmpegUnreachable),
      probeVideo: thunk(ffmpegUnreachable),
      renderContactSheet: thunk(ffmpegUnreachable),
      renderGif: thunk(ffmpegUnreachable),
      writeContainerMetadata: thunk(ffmpegUnreachable),
    })
  );
  const dieExiftool = Layer.succeed(Exiftool)(
    Exiftool.of({
      readTags: thunk(exiftoolUnreachable),
      version: exiftoolUnreachable,
      writeTags: thunk(exiftoolUnreachable),
      writeXmpPacket: thunk(exiftoolUnreachable),
    })
  );
  const DryRunLayer = Layer.mergeAll(
    SessionStore.layer,
    ClockCorrelator.layer.pipe(Layer.provide(dieFfmpeg)),
    dieFfmpeg,
    dieExiftool,
    NodeChildProcessSpawner.layer
  ).pipe(Layer.provideMerge(PlatformLayer));

  const dryRunManifest = SessionManifest.make({
    artifacts: [],
    clockSync: O.none(),
    eventsPath: "events.ndjson",
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: CaptureSession.make({
      commitDirty: false,
      commitSha: "drysha",
      id: "qa-round-1-1754000000000",
      lane: "playwright",
      round: 1,
      scenario: O.none(),
      startedAtEpochMs: 1754000000000,
      toolVersions: {},
      url: "http://storybook.beep.localhost:1355/",
      viewport: Viewport.make({ height: 1000, width: 1600 }),
    }),
    videoPath: O.none(),
  });

  it("persists the plan and returns before video discovery, probing, or correlation", () =>
    Effect.runPromise(
      Effect.acquireUseRelease(
        Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-dry-run-" })),
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const store = yield* SessionStore;
          const layout = yield* store.prepareRound(path.join(cwd, ".beep", "qa"), RoundNumber.make(1));
          yield* store.writeSessionManifest(layout, dryRunManifest);
          const line = yield* encodeActionEventJson(marker("scenario:dry-run", 1, 1754000000000));
          yield* fs.writeFileString(layout.eventsPath, `${line}\n`);

          // No recorded video exists at all: the dry run must not need one.
          const outcome = yield* runQaExtract(
            cwd,
            QaExtractOptions.make({ budgetMb: O.none(), dryRun: true, rules: O.none(), session: O.none() })
          );
          expect(outcome.artifacts).toEqual([]);
          expect(outcome.failures).toEqual([]);
          expect(yield* fs.exists(path.join(layout.root, "extraction-plan.json"))).toBe(true);
          expect(yield* fs.exists(path.join(layout.videoDir, "normalized.mp4"))).toBe(false);
        }),
        (cwd) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(cwd, { recursive: true }).pipe(Effect.orDie))
      ).pipe(provideScopedLayer(DryRunLayer))
    ));
});

describe("commands/Qa harness environment", () => {
  it("maps witness flags onto the harness contract variables", () => {
    const env = harnessEnv(
      HarnessEnvOptions.make({
        beacon: true,
        collectorUrl: "http://127.0.0.1:43117",
        cursor: false,
        round: 2,
        sessionId: "qa-round-2-1754000000000",
        url: "http://storybook.beep.localhost:1355/",
        videoDir: "/repo/.beep/qa/round-2/video",
      })
    );
    expect(env.QA_BEACON).toBe("1");
    expect(env.QA_CURSOR).toBe("0");
    expect(env.QA_ROUND).toBe("2");
    expect(env.QA_SESSION_ID).toBe("qa-round-2-1754000000000");
    expect(env.QA_VIDEO_DIR).toBe("/repo/.beep/qa/round-2/video");
  });
});
