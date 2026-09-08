import { FFmpeg, FFmpegError, NonNegativeSeconds, VideoProbe } from "@beep/ffmpeg";
import {
  CaptureSession,
  ClockSync,
  CollectorHandle,
  END_SEEK_GUARD_SECONDS,
  encodeActionEventJson,
  MarkerEvent,
  RoundNumber,
  SessionId,
  SessionManifest,
  SessionStore,
  Viewport,
} from "@beep/qa-capture";
import {
  crossCheckAgainstRound,
  isCrossCheckClean,
  JUDGE_PROMPT_TEMPLATE,
  QaEventLog,
  QaFindingId,
  QaInventory,
  QaJudgeIngestOptions,
  QaJudgeLintOptions,
  QaJudgePackOptions,
  QaJudgeRef,
  QaReportOptions,
  readEventLog,
  renderCrossCheckFailure,
  requireCapturedEvents,
  requireLiveHandle,
  resolveExistingRound,
  resolveRound,
  runQaJudgeIngest,
  runQaJudgeLint,
  runQaJudgePack,
  runQaReport,
} from "@beep/repo-cli/commands/Qa";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, thunk } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { ProbeVideoRequest } from "@beep/ffmpeg";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const QaLayer = SessionStore.layer.pipe(Layer.provideMerge(PlatformLayer));

const withTempCwd = <A, E, R>(use: (cwd: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-round-" })),
    use,
    (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(QaLayer));

const manifestFor = (round: number) =>
  SessionManifest.make({
    artifacts: [],
    clockSync: O.some(
      ClockSync.make({ confidence: "high", method: "beacon", offsetMs: 0, residualRmsMs: 3, slope: 1 })
    ),
    eventsPath: "events.ndjson",
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: CaptureSession.make({
      commitDirty: false,
      commitSha: "pipeline",
      id: `qa-round-${round}-1754000000000`,
      lane: "playwright",
      round,
      scenario: O.none(),
      startedAtEpochMs: 1754000000000,
      toolVersions: { bun: "1.3.14" },
      url: "http://storybook.beep.localhost:1355/",
      viewport: Viewport.make({ height: 1000, width: 1600 }),
    }),
    videoPath: O.none(),
  });

// Materialize a `.beep/qa/round-N` directory the commands can operate on, the
// same way `beep qa record` would leave it behind.
const prepareRound = Effect.fnUntraced(function* (cwd: string, round: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const store = yield* SessionStore;
  const qaRoot = path.join(cwd, ".beep", "qa");
  const layout = yield* store.prepareRound(qaRoot, RoundNumber.make(round));
  yield* store.writeSessionManifest(layout, manifestFor(round));
  const event = yield* encodeActionEventJson(
    MarkerEvent.make({ kind: "marker", label: "scenario:one", seq: 1, tEpochMs: 1754000000000 })
  );
  yield* fs.writeFileString(layout.eventsPath, `${event}\n`);
  return { layout, qaRoot };
});

const encodeJson = UnknownFromJsonString.encodeUnknownEffect;
const fence = "`".repeat(3);

const inventoryText = Effect.fnUntraced(function* (round: number) {
  const body = yield* encodeJson({
    findings: [],
    judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
    requiredCount: 0,
    round,
    schemaVersion: "qa-inventory/v1",
    sessionRef: "session.json",
  });
  return `judge narration\n${fence}json\n${body}\n${fence}\n`;
});

const probeOf = (videoPath: string, durationSeconds: O.Option<number>) =>
  VideoProbe.make({
    durationSeconds: O.map(durationSeconds, NonNegativeSeconds.make),
    fps: O.none(),
    frameCount: O.none(),
    height: O.none(),
    rFrameRate: O.none(),
    startTimeSeconds: O.none(),
    videoPath,
    width: O.none(),
  });

// Judge-pack only probes; every other driver operation must stay unreachable.
const ffmpegUnreachable = Effect.die("not implemented");
const ffmpegStub = (probeVideo: (request: ProbeVideoRequest) => Effect.Effect<VideoProbe, FFmpegError>) =>
  Layer.succeed(
    FFmpeg,
    FFmpeg.of({
      extractClip: thunk(ffmpegUnreachable),
      extractFrameAt: thunk(ffmpegUnreachable),
      extractFrames: thunk(ffmpegUnreachable),
      extractFramesAt: thunk(ffmpegUnreachable),
      probeRegionLuminance: thunk(ffmpegUnreachable),
      probeVideo,
      renderContactSheet: thunk(ffmpegUnreachable),
      renderGif: thunk(ffmpegUnreachable),
      writeContainerMetadata: thunk(ffmpegUnreachable),
    })
  );

describe("commands/Qa round resolution", () => {
  it("resolves an explicit --round without touching the filesystem", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const path = yield* Path.Path;
          const qaRoot = path.join(cwd, ".beep", "qa");
          expect(yield* resolveRound(qaRoot, O.some(3))).toBe(3);
        })
      )
    ));

  it("discovers the next free round when --round is absent", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { qaRoot } = yield* prepareRound(cwd, 1);
          expect(yield* resolveRound(qaRoot, O.none())).toBe(2);
        })
      )
    ));

  it("defaults to the highest recorded round for existing-round commands", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { qaRoot } = yield* prepareRound(cwd, 1);
          expect(yield* resolveExistingRound(qaRoot, O.none())).toBe(1);
        })
      )
    ));

  it.effect("fails an existing-round command when nothing has been recorded", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const path = yield* Path.Path;
            return yield* resolveExistingRound(path.join(cwd, ".beep", "qa"), O.none());
          })
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects a non-positive explicit round", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const path = yield* Path.Path;
            return yield* resolveRound(path.join(cwd, ".beep", "qa"), O.some(0));
          })
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("commands/Qa live-session control", () => {
  it("reads back the handle a live collector published", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const path = yield* Path.Path;
          const store = yield* SessionStore;
          const qaRoot = path.join(cwd, ".beep", "qa");
          const { layout } = yield* prepareRound(cwd, 1);
          yield* store.writeCollectorHandle(
            qaRoot,
            CollectorHandle.make({
              eventsPath: layout.eventsPath,
              pid: 4242,
              port: 43117,
              round: RoundNumber.make(1),
              sessionDir: layout.root,
              sessionId: SessionId.make("qa-round-1-1754000000000"),
              startedAtEpochMs: 1754000000000,
            })
          );
          const handle = yield* requireLiveHandle(qaRoot);
          expect(handle.port).toBe(43117);
          expect(handle.round).toBe(1);
        })
      )
    ));

  it.effect("fails when no collector handle is live", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const path = yield* Path.Path;
            return yield* requireLiveHandle(path.join(cwd, ".beep", "qa"));
          })
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("commands/Qa evidence cross-check against a round", () => {
  it("reports the cited paths and event ids the round cannot back up", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { layout } = yield* prepareRound(cwd, 1);
          const inventory = QaInventory.make({
            findings: [
              {
                evidence: [{ eventIds: [1, 999], frameRange: O.none(), kind: "strip", path: "frames/ghost.png" }],
                fix: "fix it",
                id: QaFindingId.make("R1-01"),
                lens: "selection-smear",
                repro: "drag the sash",
                resolvedInRound: O.none(),
                severity: "P0",
                title: "ghost evidence",
              },
            ],
            judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
            requiredCount: 1,
            round: 1,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          const eventLog = yield* readEventLog(layout.eventsPath);
          const check = yield* crossCheckAgainstRound(layout, inventory, eventLog);
          expect(check.missingPaths).toEqual(["frames/ghost.png"]);
          expect(check.missingEventIds).toEqual([999]);
          expect(isCrossCheckClean(check)).toBe(false);
          expect(renderCrossCheckFailure(1, check)).toContain("frames/ghost.png");
        })
      )
    ));

  it("passes an inventory whose cited artifact and event both exist", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* fs.makeDirectory(layout.framesDir, { recursive: true });
          yield* fs.writeFileString(path.join(layout.framesDir, "real.png"), "not really a png");
          const inventory = QaInventory.make({
            findings: [
              {
                evidence: [{ eventIds: [1], frameRange: O.none(), kind: "strip", path: "frames/real.png" }],
                fix: "fix it",
                id: QaFindingId.make("R1-01"),
                lens: "selection-smear",
                repro: "drag the sash",
                resolvedInRound: O.none(),
                severity: "P2",
                title: "backed evidence",
              },
            ],
            judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
            requiredCount: 0,
            round: 1,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          const eventLog = yield* readEventLog(layout.eventsPath);
          const check = yield* crossCheckAgainstRound(layout, inventory, eventLog);
          expect(isCrossCheckClean(check)).toBe(true);
        })
      )
    ));

  it("treats a citation that escapes the round directory as missing", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          // The cited artifact really exists — one round up. Containment, not
          // existence, is what must reject it.
          const round1 = yield* prepareRound(cwd, 1);
          yield* fs.makeDirectory(round1.layout.framesDir, { recursive: true });
          yield* fs.writeFileString(path.join(round1.layout.framesDir, "real.png"), "not really a png");
          const { layout } = yield* prepareRound(cwd, 2);
          const inventory = QaInventory.make({
            findings: [
              {
                evidence: [{ eventIds: [1], frameRange: O.none(), kind: "strip", path: "../round-1/frames/real.png" }],
                fix: "fix it",
                id: QaFindingId.make("R2-01"),
                lens: "selection-smear",
                repro: "drag the sash",
                resolvedInRound: O.none(),
                severity: "P1",
                title: "escaped evidence",
              },
            ],
            judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
            requiredCount: 1,
            round: 2,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          const eventLog = yield* readEventLog(layout.eventsPath);
          const check = yield* crossCheckAgainstRound(layout, inventory, eventLog);
          expect(check.missingPaths).toEqual(["../round-1/frames/real.png"]);
          expect(isCrossCheckClean(check)).toBe(false);
        })
      )
    ));
});

describe("commands/Qa report command", () => {
  it("re-renders report.md from session.json alone", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const { layout } = yield* prepareRound(cwd, 1);
          const rendered = yield* runQaReport(cwd, QaReportOptions.make({}));
          expect(rendered).toContain("# QA round 1 — report");
          expect(rendered).toContain("method: `beacon`");
          // The command must persist exactly what it returned.
          expect(yield* fs.readFileString(layout.reportPath)).toBe(rendered);
        })
      )
    ));

  it("accepts an explicit --session round directory", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { layout } = yield* prepareRound(cwd, 2);
          const rendered = yield* runQaReport(cwd, QaReportOptions.make({ session: O.some(layout.root) }));
          expect(rendered).toContain("# QA round 2 — report");
        })
      )
    ));

  it.effect("fails when the requested --session directory is not a round directory", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            yield* prepareRound(cwd, 1);
            return yield* runQaReport(cwd, QaReportOptions.make({ session: O.some(cwd) }));
          })
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );
});

describe("commands/Qa judge ingest and lint", () => {
  it("ingests a narrated judge transcript into inventory.json and inventory.md", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));

          const inventory = yield* runQaJudgeIngest(
            cwd,
            QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })
          );
          expect(inventory.round).toBe(1);
          expect(inventory.requiredCount).toBe(0);

          const written = yield* fs.readFileString(path.join(layout.root, "inventory.json"));
          expect(written).toContain("qa-inventory/v1");
        })
      )
    ));

  it("re-validates an already-ingested inventory", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));

          yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }));
        })
      )
    ));

  it.effect("prints the detailed dirty cross-check before returning CliReportedExit(1)", () =>
    withTempCwd(
      Effect.fnUntraced(function* (cwd) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { layout } = yield* prepareRound(cwd, 1);
        const dirty = yield* encodeJson({
          findings: [
            {
              evidence: [{ eventIds: [412], kind: "strip", path: "frames/ghost.png" }],
              fix: "Capture the cited frame and witness event.",
              id: "R1-01",
              lens: "selection-smear",
              repro: "Drag the sash.",
              severity: "P0",
              title: "Ghost evidence",
            },
          ],
          judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
          requiredCount: 1,
          round: 1,
          schemaVersion: "qa-inventory/v1",
          sessionRef: "session.json",
        });
        const inventoryPath = path.join(layout.root, "inventory.json");
        yield* fs.writeFileString(inventoryPath, dirty);

        const observed = yield* Effect.gen(function* () {
          const error = yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(
            Effect.flip
          );
          const lines = A.filter(yield* TestConsole.logLines, P.isString);
          return { error, lines };
        }).pipe(provideScopedLayer(TestConsole.layer));

        expect(observed.error).toMatchObject({
          _tag: "CliReportedExit",
          exitCode: 1,
          message: "qa judge-lint: round 1 inventory is not backed by evidence",
        });
        expect(observed.lines).toEqual([
          "qa judge-lint: round 1",
          "  findings: 1 (required 1)",
          `  inventory: ${inventoryPath}`,
          "qa judge inventory for round 1 cites evidence the round cannot back up.\n" +
            "  missing artifact: frames/ghost.png\n" +
            "  missing event id: 412",
        ]);
      })
    )
  );

  it.effect("fails judge-lint with the decode-gate messages for malformed and schema-rejected inventories", () =>
    withTempCwd(
      Effect.fnUntraced(function* (cwd) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { layout } = yield* prepareRound(cwd, 1);
        const inventoryPath = path.join(layout.root, "inventory.json");
        const lint = () =>
          runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(Effect.flip);

        yield* fs.writeFileString(inventoryPath, "{");
        const malformed = yield* lint();
        yield* fs.writeFileString(inventoryPath, '{"schemaVersion":"qa-inventory/v0"}');
        const rejected = yield* lint();

        expect(malformed).toMatchObject({
          _tag: "QaCommandError",
          message: `qa judge-lint could not parse ${inventoryPath} as JSON.`,
        });
        expect(rejected).toMatchObject({
          _tag: "QaCommandError",
          message: `qa judge-lint rejected ${inventoryPath} against the qa-inventory/v1 schema.`,
        });
        expect(P.isString(malformed.cause) && malformed.cause.length > 0).toBe(true);
        expect(P.isString(rejected.cause) && rejected.cause.length > 0).toBe(true);
      })
    )
  );

  it.effect("fails judge-lint when the round has no inventory yet", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            yield* prepareRound(cwd, 1);
            return yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }));
          })
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("refuses an inventory citing evidence the round cannot back up", () =>
    withTempCwd(
      Effect.fnUntraced(function* (cwd) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { layout } = yield* prepareRound(cwd, 1);
        const dirty = yield* encodeJson({
          findings: [
            {
              evidence: [{ eventIds: [412], kind: "strip", path: "frames/ghost.png" }],
              fix: "fix it",
              id: "R1-01",
              lens: "selection-smear",
              repro: "drag the sash",
              severity: "P0",
              title: "ghost evidence",
            },
          ],
          judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
          requiredCount: 1,
          round: 1,
          schemaVersion: "qa-inventory/v1",
          sessionRef: "session.json",
        });
        const transcript = path.join(cwd, "judge-stdout.txt");
        const inventoryPath = path.join(layout.root, "inventory.json");
        const inventoryMarkdownPath = path.join(layout.root, "inventory.md");
        yield* fs.writeFileString(transcript, `${fence}json\n${dirty}\n${fence}\n`);

        const error = yield* runQaJudgeIngest(
          cwd,
          QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })
        ).pipe(Effect.flip);

        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message:
            "qa judge inventory for round 1 cites evidence the round cannot back up.\n" +
            "  missing artifact: frames/ghost.png\n" +
            "  missing event id: 412",
        });
        expect(yield* fs.exists(inventoryPath)).toBe(false);
        expect(yield* fs.exists(inventoryMarkdownPath)).toBe(false);
      })
    )
  );

  it.effect("fails ingest when the judge transcript carries no fenced inventory", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* prepareRound(cwd, 1);
            const transcript = path.join(cwd, "judge-stdout.txt");
            yield* fs.writeFileString(transcript, "the judge forgot to emit json");
            return yield* runQaJudgeIngest(
              cwd,
              QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })
            );
          })
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("preserves the ingest-specific declared-round error and writes no inventory", () =>
    withTempCwd(
      Effect.fnUntraced(function* (cwd) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { layout } = yield* prepareRound(cwd, 1);
        const transcript = path.join(cwd, "judge-stdout.txt");
        const inventoryPath = path.join(layout.root, "inventory.json");
        const inventoryMarkdownPath = path.join(layout.root, "inventory.md");
        yield* fs.writeFileString(transcript, yield* inventoryText(2));

        const error = yield* runQaJudgeIngest(
          cwd,
          QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })
        ).pipe(Effect.flip);

        expect(error.message).toBe("qa judge-ingest was asked for round 1 but the inventory declares round 2.");
        expect(yield* fs.exists(inventoryPath)).toBe(false);
        expect(yield* fs.exists(inventoryMarkdownPath)).toBe(false);
      })
    )
  );

  it("fails judge-lint when the committed inventory declares another round", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          // A copied round-2 inventory can pass round-1's evidence cross-check
          // (no findings cite anything), so only the round guard catches it.
          const foreign = yield* encodeJson({
            findings: [],
            judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
            requiredCount: 0,
            round: 2,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          yield* fs.writeFileString(path.join(layout.root, "inventory.json"), foreign);
          const error = yield* Effect.flip(
            runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }))
          );
          expect(error.message).toContain("declares round 2 but round 1 was requested");
        })
      )
    ));
});

describe("commands/Qa record witness-event gate", () => {
  it.effect("fails a finished round whose witness log holds zero events", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(requireCapturedEvents(QaEventLog.make({ events: [], rejectedCount: 3 })));
      expect(error.exitCode).toBe(1);
      expect(error.message).toContain("0 witness events captured (3 rejected)");
    })
  );

  it.effect("passes a round that captured at least one witness event", () =>
    requireCapturedEvents(
      QaEventLog.make({
        events: [MarkerEvent.make({ kind: "marker", label: "scenario:one", seq: 1, tEpochMs: 1754000000000 })],
        rejectedCount: 0,
      })
    )
  );
});

describe("commands/Qa judge-pack video duration", () => {
  const packOptions = QaJudgePackOptions.make({ round: RoundNumber.make(1), surface: O.none() });

  it("fails packing when the round has no recorded video", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          yield* prepareRound(cwd, 1);
          const error = yield* Effect.flip(
            runQaJudgePack(cwd, packOptions).pipe(
              provideScopedLayer(ffmpegStub(() => Effect.die("probeVideo must not run without a video")))
            )
          );
          expect(error.message).toContain("found no recorded video for round 1");
        })
      )
    ));

  it("fails packing when the recorded video cannot be probed", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "not really a video");
          const error = yield* Effect.flip(
            runQaJudgePack(cwd, packOptions).pipe(
              provideScopedLayer(
                ffmpegStub(() =>
                  Effect.fail(FFmpegError.fromUnknown("probeVideo", "boom", { cause: new Error("corrupt") }))
                )
              )
            )
          );
          expect(error.message).toContain("could not probe the recorded video");
        })
      )
    ));

  it("uses the normalized clip's duration when the source container reports none", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "duration-less webm");
          const templatePath = path.join(cwd, JUDGE_PROMPT_TEMPLATE);
          yield* fs.makeDirectory(path.dirname(templatePath), { recursive: true });
          yield* fs.writeFileString(
            templatePath,
            "Round {{ROUND}} of {{SURFACE}} in {{ROUND_DIR}}: {{SCENARIO_NOTES}}"
          );
          const manifest = yield* runQaJudgePack(cwd, packOptions).pipe(
            provideScopedLayer(
              ffmpegStub((request) =>
                Effect.succeed(
                  Str.endsWith("normalized.mp4")(request.videoPath)
                    ? probeOf(request.videoPath, O.some(12))
                    : probeOf(request.videoPath, O.none())
                )
              )
            )
          );
          expect(manifest.round).toBe(1);
          // The marker's epoch maps far past the recording, so its rendered
          // time is the end-seek-guarded clamp on the normalized clip's 12s —
          // never 0.000.
          const timeline = yield* fs.readFileString(path.join(layout.root, "judge", "timeline.md"));
          expect(timeline).toContain(`t=${(12 - END_SEEK_GUARD_SECONDS).toFixed(3)}`);
        })
      )
    ));

  it("fails packing when neither the source nor the normalized clip carries a duration", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "duration-less webm");
          const error = yield* Effect.flip(
            runQaJudgePack(cwd, packOptions).pipe(
              provideScopedLayer(ffmpegStub((request) => Effect.succeed(probeOf(request.videoPath, O.none()))))
            )
          );
          expect(error.message).toContain("re-run `bun run beep qa extract --round 1`");
        })
      )
    ));

  it("rejects a concrete duration too short to carry temporal evidence", () =>
    Effect.runPromise(
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "zero-duration webm");
          // A present-but-zero duration must fail exactly like a missing one:
          // the guarded mapping interval is empty, so every event would land
          // on t=0.000.
          const error = yield* Effect.flip(
            runQaJudgePack(cwd, packOptions).pipe(
              provideScopedLayer(ffmpegStub((request) => Effect.succeed(probeOf(request.videoPath, O.some(0)))))
            )
          );
          expect(error.message).toContain(`must exceed ${END_SEEK_GUARD_SECONDS}s`);
        })
      )
    ));
});
