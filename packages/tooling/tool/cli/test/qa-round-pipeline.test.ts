import { FFmpeg, FFmpegError, NonNegativeSeconds, VideoProbe } from "@beep/ffmpeg";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
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
  applyQaJudgeCertificatePlan,
  crossCheckAgainstRound,
  GATE_CERTIFICATE_FILE,
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
  requireInventoryRound,
  requireLiveHandle,
  resolveExistingRound,
  resolveRound,
  runQaJudgeIngest,
  runQaJudgeLint,
  runQaJudgePack,
  runQaReport,
} from "@beep/repo-cli/commands/Qa";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import {
  EvidenceDigest,
  EvidenceSubject,
  GateCertificateApplyPlan,
  GateCertificateReceipt,
  GateId,
} from "@beep/skill-contract";
import { it } from "@beep/test-runner";
import { A, thunk } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as Console from "effect/Console";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type { ProbeVideoRequest } from "@beep/ffmpeg";

const PlatformLayer = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer);
const QaLayer = Layer.merge(SessionStore.layer.pipe(Layer.provideMerge(PlatformLayer)), BunCrypto.layer);

const withTempCwd = <A, E, R>(use: (cwd: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-round-" })),
    use,
    (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
  );

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

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeCertificate = S.decodeEffect(S.fromJsonString(GateCertificateReceipt));
const sha256 = S.decodeEffect(Sha256HexFromBytes);
const fence = Str.repeat(3)("`");

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

it.layer(QaLayer, { timeout: "10 seconds" })("QA round pipeline", (it) => {
  describe("commands/Qa round resolution", () => {
    it.effect("resolves an explicit --round without touching the filesystem", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const path = yield* Path.Path;
          const qaRoot = path.join(cwd, ".beep", "qa");
          expect(yield* resolveRound(qaRoot, O.some(3))).toBe(3);
        })
      )
    );

    it.effect("discovers the next free round when --round is absent", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { qaRoot } = yield* prepareRound(cwd, 1);
          expect(yield* resolveRound(qaRoot, O.none())).toBe(2);
        })
      )
    );

    it.effect("defaults to the highest recorded round for existing-round commands", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { qaRoot } = yield* prepareRound(cwd, 1);
          expect(yield* resolveExistingRound(qaRoot, O.none())).toBe(1);
        })
      )
    );

    it.effect("fails an existing-round command when nothing has been recorded", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          withTempCwd(
            Effect.fnUntraced(function* (cwd) {
              const path = yield* Path.Path;
              return yield* resolveExistingRound(path.join(cwd, ".beep", "qa"), O.none());
            })
          )
        );
        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message: "qa found no recorded rounds under .beep/qa; run `bun run beep qa record` first.",
        });
      })
    );

    it.effect("rejects a non-positive explicit round", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          withTempCwd(
            Effect.fnUntraced(function* (cwd) {
              const path = yield* Path.Path;
              return yield* resolveRound(path.join(cwd, ".beep", "qa"), O.some(0));
            })
          )
        );
        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message: "qa --round 0 is not a positive round number.",
        });
      })
    );
  });

  describe("commands/Qa live-session control", () => {
    it.effect("reads back the handle a live collector published", () =>
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
    );

    it.effect("fails when no collector handle is live", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          withTempCwd(
            Effect.fnUntraced(function* (cwd) {
              const path = yield* Path.Path;
              return yield* requireLiveHandle(path.join(cwd, ".beep", "qa"));
            })
          )
        );
        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message:
            "No live QA session: .beep/qa/current.json is absent. Start one with `bun run beep qa record` first.",
        });
      })
    );
  });

  describe("commands/Qa evidence cross-check against a round", () => {
    it.effect("reports the cited paths and event ids the round cannot back up", () =>
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
    );

    it.effect("passes an inventory whose cited artifact and event both exist", () =>
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
    );

    it.effect("treats a citation that escapes the round directory as missing", () =>
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
    );
  });

  describe("commands/Qa report command", () => {
    it.effect("re-renders report.md from session.json alone", () =>
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
    );

    it.effect("accepts an explicit --session round directory", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const { layout } = yield* prepareRound(cwd, 2);
          const rendered = yield* runQaReport(cwd, QaReportOptions.make({ session: O.some(layout.root) }));
          expect(rendered).toContain("# QA round 2 — report");
        })
      )
    );

    it.effect("fails when the requested --session directory is not a round directory", () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          withTempCwd(
            Effect.fnUntraced(function* (cwd) {
              yield* prepareRound(cwd, 1);
              return yield* runQaReport(cwd, QaReportOptions.make({ session: O.some(cwd) }));
            })
          )
        );
        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message: expect.stringContaining("qa --session expects a round-N directory under .beep/qa; got "),
        });
      })
    );
  });

  describe("commands/Qa judge ingest and lint", () => {
    it.effect("ingests a narrated judge transcript into inventory.json and inventory.md", () =>
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
    );

    it.effect("re-validates an already-ingested inventory", () =>
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
    );

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
          }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

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
        const error = yield* Effect.flip(
          withTempCwd(
            Effect.fnUntraced(function* (cwd) {
              yield* prepareRound(cwd, 1);
              return yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }));
            })
          )
        );
        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message: expect.stringContaining("run `bun run beep qa judge-ingest --round 1 --from <file>` first."),
        });
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
        const error = yield* Effect.flip(
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
        expect(error).toMatchObject({
          _tag: "QaCommandError",
          message: "qa judge-ingest found no parseable JSON inventory object (fenced or unfenced) in the judge output.",
        });
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

    it.effect("fails judge-lint when the committed inventory declares another round", () =>
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
    );
  });

  describe("commands/Qa judge runs emit one gate certificate", () => {
    const utf8 = new TextDecoder();
    // Independent of the producer: hashes the bytes on disk with the shared schema helper.
    const subjectOf = Effect.fnUntraced(function* (name: string, bytes: Uint8Array) {
      return EvidenceSubject.make({ digest: EvidenceDigest.make({ sha256: yield* sha256(bytes) }), name });
    });
    const certificateOf = Effect.fnUntraced(function* (root: string) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const bytes = yield* fs.readFile(path.join(root, GATE_CERTIFICATE_FILE));
      const receipt = yield* decodeCertificate(utf8.decode(bytes));
      return { bytes, receipt };
    });
    const outcomesOf = (receipt: GateCertificateReceipt) =>
      A.map(receipt.predicate.checks, (check) => `${check.checkId}:${check.outcome}`);
    const inventoryBody = (round: number, path: string, eventIds: ReadonlyArray<number>) =>
      encodeJson({
        findings: [
          {
            evidence: [{ eventIds, kind: "strip", path }],
            fix: "Fix it.",
            id: `R${round}-01`,
            lens: "selection-smear",
            repro: "Drag the sash.",
            severity: "P1",
            title: "Selection smear",
          },
        ],
        judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
        requiredCount: 1,
        round,
        schemaVersion: "qa-inventory/v1",
        sessionRef: "session.json",
      });
    const lintRound1 = Effect.fn("lintRound1")(
      function* (cwd: string) {
        const failure = yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(
          Effect.flip,
          Effect.map((error) => error.message),
          Effect.option
        );
        const lines = A.filter(yield* TestConsole.logLines, P.isString);
        return { failure, lines };
      },
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    );

    // Frozen legacy expectations: the lines and failures judge-lint produced
    // before certificates existed, plus the certificate each run must write.
    const lintCases = [
      {
        name: "clean",
        cite: { eventIds: [1], path: "frames/a.png" },
        legacy: { lines: ["  cross-check: ok"], failure: O.none<string>() },
        outcomes: ["passed", "passed", "passed", "passed", "passed"],
        aggregate: "passed",
      },
      {
        name: "missing artifact",
        cite: { eventIds: [1], path: "frames/ghost.png" },
        legacy: {
          lines: [
            "qa judge inventory for round 1 cites evidence the round cannot back up.\n  missing artifact: frames/ghost.png",
          ],
          failure: O.some("qa judge-lint: round 1 inventory is not backed by evidence"),
        },
        outcomes: ["passed", "passed", "failed", "passed", "failed"],
        aggregate: "failed",
      },
      {
        name: "missing event id",
        cite: { eventIds: [412], path: "frames/a.png" },
        legacy: {
          lines: ["qa judge inventory for round 1 cites evidence the round cannot back up.\n  missing event id: 412"],
          failure: O.some("qa judge-lint: round 1 inventory is not backed by evidence"),
        },
        outcomes: ["passed", "passed", "passed", "failed", "failed"],
        aggregate: "failed",
      },
    ] as const;
    const gateIds = [
      "judge-output-inventory-decodes",
      "declared-round-coherent",
      "cited-artifact-exists",
      "cited-event-id-exists",
      "evidence-cross-check-clean",
    ] as const;
    const expectedOutcomes = (outcomes: ReadonlyArray<string>) =>
      A.map(gateIds, (id, index) => `${id}:${outcomes[index] ?? "missing"}`);

    it.effect("judge-lint keeps its legacy output and writes a certificate bound to the exact inventory bytes", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* fs.makeDirectory(path.join(layout.root, "frames"), { recursive: true });
          yield* fs.writeFileString(path.join(layout.root, "frames", "a.png"), "frame");
          const inventoryPath = path.join(layout.root, "inventory.json");

          for (const testCase of lintCases) {
            yield* fs.writeFileString(
              inventoryPath,
              yield* inventoryBody(1, testCase.cite.path, testCase.cite.eventIds)
            );
            const { failure, lines } = yield* lintRound1(cwd);
            const { receipt } = yield* certificateOf(layout.root);
            const inventoryBytes = yield* fs.readFile(inventoryPath);

            expect(lines, testCase.name).toEqual([
              "qa judge-lint: round 1",
              "  findings: 1 (required 1)",
              `  inventory: ${inventoryPath}`,
              ...testCase.legacy.lines,
            ]);
            expect(failure, testCase.name).toEqual(testCase.legacy.failure);
            expect(outcomesOf(receipt), testCase.name).toEqual(expectedOutcomes(testCase.outcomes));
            expect(receipt.predicate.outcome, testCase.name).toBe(testCase.aggregate);
            expect(receipt.subject, testCase.name).toEqual([yield* subjectOf("inventory.json", inventoryBytes)]);
          }
        })
      )
    );

    it.effect("judge-lint certifies gates after the first denial as untested and keeps the legacy errors", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const inventoryPath = path.join(layout.root, "inventory.json");
          const lint = () =>
            runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(Effect.flip);

          yield* fs.writeFileString(inventoryPath, yield* inventoryBody(2, "frames/a.png", [1]));
          const copied = yield* lint();
          const afterRound = (yield* certificateOf(layout.root)).receipt;

          yield* fs.writeFileString(inventoryPath, "{");
          const malformed = yield* lint();
          const afterDecode = (yield* certificateOf(layout.root)).receipt;

          expect(copied).toMatchObject({
            _tag: "QaCommandError",
            message: "qa judge inventory declares round 2 but round 1 was requested.",
          });
          expect(outcomesOf(afterRound)).toEqual(
            expectedOutcomes(["passed", "failed", "untested", "untested", "untested"])
          );
          expect(afterRound.predicate.outcome).toBe("failed");
          expect(malformed).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-lint could not parse ${inventoryPath} as JSON.`,
          });
          expect(outcomesOf(afterDecode)).toEqual(
            expectedOutcomes(["failed", "untested", "untested", "untested", "untested"])
          );
          expect(
            A.every(afterDecode.predicate.checks, (check) =>
              check.outcome === "untested" ? A.isReadonlyArrayEmpty(check.evidenceSubjects) : true
            )
          ).toBe(true);
          expect(afterDecode.subject).toEqual([yield* subjectOf("inventory.json", new TextEncoder().encode("{"))]);
        })
      )
    );

    it.effect("judge-lint writes no certificate when the round has no inventory", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(Effect.flip);
          expect(yield* fs.exists(path.join(layout.root, GATE_CERTIFICATE_FILE))).toBe(false);
        })
      )
    );

    it.effect("judge-ingest certifies the written inventory bytes and writes nothing when it refuses", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          const certificatePath = path.join(layout.root, GATE_CERTIFICATE_FILE);

          yield* fs.writeFileString(
            transcript,
            `${fence}json\n${yield* inventoryBody(1, "frames/ghost.png", [1])}\n${fence}\n`
          );
          const refused = yield* runQaJudgeIngest(
            cwd,
            QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })
          ).pipe(Effect.flip);
          expect(refused).toMatchObject({
            _tag: "QaCommandError",
            message:
              "qa judge inventory for round 1 cites evidence the round cannot back up.\n  missing artifact: frames/ghost.png",
          });
          expect(yield* fs.exists(certificatePath)).toBe(false);

          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const { receipt } = yield* certificateOf(layout.root);
          const inventoryBytes = yield* fs.readFile(path.join(layout.root, "inventory.json"));

          expect(outcomesOf(receipt)).toEqual(expectedOutcomes(["passed", "passed", "passed", "passed", "passed"]));
          expect(receipt.predicate.outcome).toBe("passed");
          expect(receipt.subject).toEqual([yield* subjectOf("inventory.json", inventoryBytes)]);
        })
      )
    );

    it.effect("applies a plan only to the exact certificate bytes it was made against", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const inventoryPath = path.join(layout.root, "inventory.json");
          yield* fs.writeFileString(inventoryPath, yield* inventoryBody(1, "frames/ghost.png", [1]));
          yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(Effect.flip);
          const first = yield* certificateOf(layout.root);
          const plan = (ids: A.NonEmptyReadonlyArray<string>) =>
            Effect.map(subjectOf(GATE_CERTIFICATE_FILE, first.bytes), (certificate) =>
              GateCertificateApplyPlan.make({ certificate, checkIds: A.map(ids, (id) => GateId.make(id)) })
            );

          const applied = yield* applyQaJudgeCertificatePlan(yield* plan(["cited-artifact-exists"]), first.bytes);
          const unknown = yield* applyQaJudgeCertificatePlan(yield* plan(["not-a-qa-gate"]), first.bytes);

          // A changed receipt: the same run re-certified after the inventory was fixed.
          yield* fs.makeDirectory(path.join(layout.root, "frames"), { recursive: true });
          yield* fs.writeFileString(path.join(layout.root, "frames", "ghost.png"), "frame");
          yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }));
          const second = yield* certificateOf(layout.root);
          const stale = yield* applyQaJudgeCertificatePlan(yield* plan(["cited-artifact-exists"]), second.bytes);

          expect(applied).toMatchObject({
            checks: [{ checkId: "cited-artifact-exists", outcome: "failed" }],
            verdict: "applied",
          });
          expect(unknown).toMatchObject({ reason: "unknown-id", unknownIds: ["not-a-qa-gate"], verdict: "refused" });
          expect(second.receipt.predicate.outcome).toBe("passed");
          expect(stale).toMatchObject({ reason: "stale-digest", verdict: "refused" });
        })
      )
    );
  });

  describe("commands/Qa gate certificate write failures", () => {
    // Fails only writes and renames onto gate-certificate.json; every other file operation is real.
    // The rename failure is one-shot, like a transient fault, so a rollback that
    // restores the previous certificate can succeed.
    const withFailingCertificateWrites = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      Effect.flatMap(FileSystem.FileSystem, (fs) => {
        const renameFault = { pending: true };
        return Effect.provideService(
          effect,
          FileSystem.FileSystem,
          FileSystem.FileSystem.of({
            ...fs,
            writeFile: Effect.fn("failingCertificateWriteFile")(function* (
              path: string,
              data: Uint8Array,
              options?: Parameters<FileSystem.FileSystem["writeFile"]>[2]
            ) {
              if (Str.endsWith(GATE_CERTIFICATE_FILE)(path)) {
                return yield* PlatformError.systemError({
                  _tag: "PermissionDenied",
                  method: "writeFile",
                  module: "FileSystem",
                  pathOrDescriptor: path,
                });
              }
              return yield* fs.writeFile(path, data, options);
            }),
            rename: Effect.fn("failingCertificateRename")(function* (from: string, to: string) {
              if (Str.endsWith(GATE_CERTIFICATE_FILE)(to) && renameFault.pending) {
                renameFault.pending = false;
                return yield* PlatformError.systemError({
                  _tag: "PermissionDenied",
                  method: "rename",
                  module: "FileSystem",
                  pathOrDescriptor: to,
                });
              }
              return yield* fs.rename(from, to);
            }),
          })
        );
      });
    const lintWithConsole = Effect.fn("lintWithConsole")(
      function* (cwd: string) {
        const failure = yield* withFailingCertificateWrites(
          runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }))
        ).pipe(Effect.flip, Effect.option);
        return {
          errorLines: A.filter(yield* TestConsole.errorLines, P.isString),
          failure,
          lines: A.filter(yield* TestConsole.logLines, P.isString),
        };
      },
      Effect.provideServiceEffect(Console.Console, TestConsole.make)
    );

    it.effect("keeps judge-lint's own failure and reports the certificate write failure on stderr", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const copied = yield* encodeJson({
            findings: [],
            judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
            requiredCount: 0,
            round: 2,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          yield* fs.writeFileString(path.join(layout.root, "inventory.json"), copied);

          const { errorLines, failure } = yield* lintWithConsole(cwd);

          assertSome(
            O.map(failure, (error) => error.message),
            "qa judge inventory declares round 2 but round 1 was requested."
          );
          expect(errorLines).toEqual([
            `qa judge-lint warning: qa judge could not write ${GATE_CERTIFICATE_FILE} into ${layout.root}. The run's own failure is reported instead.`,
          ]);
          expect(yield* fs.exists(path.join(layout.root, GATE_CERTIFICATE_FILE))).toBe(false);
        })
      )
    );

    it.effect("keeps the legacy cross-check output and exit when a dirty run cannot write its certificate", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const inventoryPath = path.join(layout.root, "inventory.json");
          const dirty = yield* encodeJson({
            findings: [
              {
                evidence: [{ eventIds: [412], kind: "strip", path: "frames/ghost.png" }],
                fix: "Fix it.",
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
          yield* fs.writeFileString(inventoryPath, dirty);

          const observed = yield* Effect.gen(function* () {
            const error = yield* withFailingCertificateWrites(
              runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }))
            ).pipe(Effect.flip);
            return {
              error,
              errorLines: A.filter(yield* TestConsole.errorLines, P.isString),
              lines: A.filter(yield* TestConsole.logLines, P.isString),
            };
          }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make));

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
          expect(observed.errorLines).toEqual([
            `qa judge-lint warning: qa judge could not write ${GATE_CERTIFICATE_FILE} into ${layout.root}. The run's own failure is reported instead.`,
          ]);
        })
      )
    );

    it.effect("fails a clean judge-lint run whose certificate cannot be written", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const priorCertificate = yield* fs.readFileString(path.join(layout.root, GATE_CERTIFICATE_FILE));

          const { errorLines, failure, lines } = yield* lintWithConsole(cwd);
          // The atomic writer leaves the certificate already on disk intact.
          expect(yield* fs.readFileString(path.join(layout.root, GATE_CERTIFICATE_FILE))).toBe(priorCertificate);

          assertSome(
            O.map(failure, (error) => error.message),
            `qa judge could not write ${GATE_CERTIFICATE_FILE} into ${layout.root}.`
          );
          expect(errorLines).toEqual([]);
          // The documented verdict is printed before the persistence failure.
          expect(lines).toEqual([
            "qa judge-lint: round 1",
            "  findings: 0 (required 0)",
            `  inventory: ${path.join(layout.root, "inventory.json")}`,
            "  cross-check: ok",
          ]);
        })
      )
    );

    it.effect("rolls an empty round back when the ingest certificate cannot be committed", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));

          const failed = yield* withFailingCertificateWrites(
            runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }))
          ).pipe(Effect.flip);

          expect(failed).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-ingest could not write into ${layout.root}; the previous inventory and gate certificate were restored.`,
          });
          for (const name of ["inventory.json", "inventory.md", GATE_CERTIFICATE_FILE]) {
            expect(yield* fs.exists(path.join(layout.root, name)), name).toBe(false);
          }
        })
      )
    );

    it.effect("restores the previous inventory and certificate pair when a replacement cannot be committed", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          const names = ["inventory.json", "inventory.md", GATE_CERTIFICATE_FILE];
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const before = yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)));

          const replacement = yield* encodeJson({
            findings: [
              {
                evidence: [{ eventIds: [1], kind: "strip", path: "events.ndjson" }],
                fix: "Fix it.",
                id: "R1-01",
                lens: "selection-smear",
                repro: "Drag the sash.",
                severity: "P2",
                title: "Replacement",
              },
            ],
            judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
            requiredCount: 0,
            round: 1,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          yield* fs.writeFileString(transcript, `${fence}json\n${replacement}\n${fence}\n`);
          const failed = yield* withFailingCertificateWrites(
            runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }))
          ).pipe(Effect.flip);
          const after = yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)));

          expect(failed).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-ingest could not write into ${layout.root}; the previous inventory and gate certificate were restored.`,
          });
          expect(after).toEqual(before);
          const receipt = yield* decodeCertificate(after[2] ?? "");
          const digest = yield* sha256(yield* fs.readFile(path.join(layout.root, "inventory.json")));
          expect(receipt.subject).toEqual([
            EvidenceSubject.make({ digest: EvidenceDigest.make({ sha256: digest }), name: "inventory.json" }),
          ]);
        })
      )
    );
  });

  describe("commands/Qa gate certificate fault paths", () => {
    it.effect("certifies an unreadable witness log as untested evidence and keeps the read error", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          yield* fs.remove(layout.eventsPath);
          yield* fs.makeDirectory(layout.eventsPath);

          const error = yield* runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(
            Effect.flip
          );
          const receipt = yield* decodeCertificate(
            yield* fs.readFileString(path.join(layout.root, GATE_CERTIFICATE_FILE))
          );

          expect(error).toMatchObject({
            _tag: "QaCommandError",
            message: `qa could not read the witness log at ${layout.eventsPath}.`,
          });
          expect(A.map(receipt.predicate.checks, (check) => check.outcome)).toEqual([
            "passed",
            "passed",
            "untested",
            "untested",
            "untested",
          ]);
          expect(receipt.predicate.outcome).toBe("untested");
        })
      )
    );

    it.effect("rolls back only committed targets and leaves an uncommitted certificate untouched", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const names = ["inventory.json", "inventory.md", GATE_CERTIFICATE_FILE];
          const before = yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)));

          const failed = yield* Effect.flatMap(FileSystem.FileSystem, (base) =>
            runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })).pipe(
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.FileSystem.of({
                  ...base,
                  rename: Effect.fn("alwaysFailingCertificateRename")(function* (from: string, to: string) {
                    if (Str.endsWith(GATE_CERTIFICATE_FILE)(to)) {
                      return yield* PlatformError.systemError({
                        _tag: "PermissionDenied",
                        method: "rename",
                        module: "FileSystem",
                        pathOrDescriptor: to,
                      });
                    }
                    return yield* base.rename(from, to);
                  }),
                })
              )
            )
          ).pipe(Effect.flip);

          expect(failed).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-ingest could not write into ${layout.root}; the previous inventory and gate certificate were restored.`,
          });
          expect(yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)))).toEqual(
            before
          );
        })
      )
    );

    it.effect("reports that nothing changed when the first artifact write fails", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          const names = ["inventory.json", "inventory.md", GATE_CERTIFICATE_FILE];
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const before = yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)));

          const failed = yield* Effect.flatMap(FileSystem.FileSystem, (base) =>
            runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })).pipe(
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.FileSystem.of({
                  ...base,
                  rename: Effect.fn("failingInventoryRename")(function* (from: string, to: string) {
                    if (Str.endsWith("inventory.json")(to)) {
                      return yield* PlatformError.systemError({
                        _tag: "PermissionDenied",
                        method: "rename",
                        module: "FileSystem",
                        pathOrDescriptor: to,
                      });
                    }
                    return yield* base.rename(from, to);
                  }),
                })
              )
            )
          ).pipe(Effect.flip);

          expect(failed).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-ingest could not write into ${layout.root}; no file was changed.`,
          });
          expect(yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)))).toEqual(
            before
          );
        })
      )
    );

    it.effect("restores later targets when restoring the first one fails", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          const names = ["inventory.json", "inventory.md", GATE_CERTIFICATE_FILE];
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const before = yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)));
          const replacement = yield* encodeJson({
            findings: [],
            judge: { effort: "low", model: "gpt-daybreak-blue-latest" },
            requiredCount: 0,
            round: 1,
            schemaVersion: "qa-inventory/v1",
            sessionRef: "session.json",
          });
          yield* fs.writeFileString(transcript, `${fence}json\n${replacement}\n${fence}\n`);
          // Commit: inventory.json and inventory.md land, the certificate rename fails.
          // Rollback: restoring inventory.json fails; inventory.md and the certificate must still be restored.
          const renames = { inventory: 0 };

          const failed = yield* Effect.flatMap(FileSystem.FileSystem, (base) =>
            runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })).pipe(
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.FileSystem.of({
                  ...base,
                  rename: Effect.fn("firstRestoreFailingRename")(function* (from: string, to: string) {
                    const certificate = Str.endsWith(GATE_CERTIFICATE_FILE)(to);
                    const inventory = Str.endsWith("inventory.json")(to);
                    if (inventory) {
                      renames.inventory += 1;
                    }
                    if ((certificate && renames.inventory === 1) || (inventory && renames.inventory === 2)) {
                      return yield* PlatformError.systemError({
                        _tag: "PermissionDenied",
                        method: "rename",
                        module: "FileSystem",
                        pathOrDescriptor: to,
                      });
                    }
                    return yield* base.rename(from, to);
                  }),
                })
              )
            )
          ).pipe(Effect.flip);
          const after = yield* Effect.forEach(names, (name) => fs.readFileString(path.join(layout.root, name)));

          expect(failed).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-ingest could not write into ${layout.root}, and restoring inventory.json also failed; the other files were restored. Check ${layout.root} by hand.`,
          });
          expect(after[0]).not.toBe(before[0]);
          expect(after[1]).toBe(before[1]);
          expect(after[2]).toBe(before[2]);
        })
      )
    );

    it.effect("finishes the artifact commit before an interruption that arrives mid-commit takes effect", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          const committedFirst = yield* Deferred.make<void>();
          const proceed = yield* Deferred.make<void>();

          const fiber = yield* Effect.flatMap(FileSystem.FileSystem, (base) =>
            runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) })).pipe(
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.FileSystem.of({
                  ...base,
                  rename: Effect.fn("pausingRename")(function* (from: string, to: string) {
                    yield* base.rename(from, to);
                    if (Str.endsWith("inventory.json")(to)) {
                      yield* Deferred.succeed(committedFirst, undefined);
                      yield* Deferred.await(proceed);
                    }
                  }),
                })
              )
            )
          ).pipe(Effect.forkChild);
          yield* Deferred.await(committedFirst);
          const interrupter = yield* Fiber.interrupt(fiber).pipe(Effect.forkChild);
          yield* Deferred.succeed(proceed, undefined);
          yield* Fiber.join(interrupter);
          const exit = yield* Fiber.await(fiber);

          const inventoryBytes = yield* fs.readFile(path.join(layout.root, "inventory.json"));
          const receipt = yield* decodeCertificate(
            yield* fs.readFileString(path.join(layout.root, GATE_CERTIFICATE_FILE))
          );
          expect(Exit.hasInterrupts(exit)).toBe(true);
          expect(yield* fs.exists(path.join(layout.root, "inventory.md"))).toBe(true);
          expect(receipt.subject).toEqual([
            EvidenceSubject.make({
              digest: EvidenceDigest.make({ sha256: yield* sha256(inventoryBytes) }),
              name: "inventory.json",
            }),
          ]);
        })
      )
    );

    it.effect("removes a stale certificate once the inventory is gone, and warns if it cannot", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          const certificatePath = path.join(layout.root, GATE_CERTIFICATE_FILE);
          const inventoryPath = path.join(layout.root, "inventory.json");
          const lint = () => runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) }));
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          yield* lint();
          expect(yield* fs.exists(certificatePath)).toBe(true);

          yield* fs.remove(inventoryPath);
          const missing = yield* lint().pipe(Effect.flip);
          expect(missing.message).toContain("first.");
          expect(yield* fs.exists(certificatePath)).toBe(false);

          // An unremovable stale certificate is reported on stderr; the missing-inventory error stays.
          yield* fs.writeFileString(certificatePath, "{}");
          const observed = yield* Effect.flatMap(FileSystem.FileSystem, (base) =>
            Effect.gen(function* () {
              const error = yield* lint().pipe(Effect.flip);
              return { error, errorLines: A.filter(yield* TestConsole.errorLines, P.isString) };
            }).pipe(
              Effect.provideServiceEffect(Console.Console, TestConsole.make),
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.FileSystem.of({
                  ...base,
                  remove: Effect.fn("failingCertificateRemove")(function* (
                    target: string,
                    options?: Parameters<FileSystem.FileSystem["remove"]>[1]
                  ) {
                    if (Str.endsWith(GATE_CERTIFICATE_FILE)(target)) {
                      return yield* PlatformError.systemError({
                        _tag: "PermissionDenied",
                        method: "remove",
                        module: "FileSystem",
                        pathOrDescriptor: target,
                      });
                    }
                    return yield* base.remove(target, options);
                  }),
                })
              )
            )
          );
          expect(observed.error.message).toContain("first.");
          expect(observed.errorLines).toHaveLength(1);
          expect(observed.errorLines[0]).toContain(`could not remove the stale ${GATE_CERTIFICATE_FILE}`);
        })
      )
    );

    it.effect("keeps a valid certificate when the inventory read fails for any reason but absence", () =>
      withTempCwd(
        Effect.fnUntraced(function* (cwd) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { layout } = yield* prepareRound(cwd, 1);
          const transcript = path.join(cwd, "judge-stdout.txt");
          const certificatePath = path.join(layout.root, GATE_CERTIFICATE_FILE);
          const inventoryPath = path.join(layout.root, "inventory.json");
          yield* fs.writeFileString(transcript, yield* inventoryText(1));
          yield* runQaJudgeIngest(cwd, QaJudgeIngestOptions.make({ from: transcript, round: RoundNumber.make(1) }));
          const before = yield* fs.readFileString(certificatePath);

          const error = yield* Effect.flatMap(FileSystem.FileSystem, (base) =>
            runQaJudgeLint(cwd, QaJudgeLintOptions.make({ round: RoundNumber.make(1) })).pipe(
              Effect.provideService(
                FileSystem.FileSystem,
                FileSystem.FileSystem.of({
                  ...base,
                  readFile: Effect.fn("deniedInventoryRead")(function* (target: string) {
                    if (Str.endsWith("inventory.json")(target)) {
                      return yield* PlatformError.systemError({
                        _tag: "PermissionDenied",
                        method: "readFile",
                        module: "FileSystem",
                        pathOrDescriptor: target,
                      });
                    }
                    return yield* base.readFile(target);
                  }),
                })
              )
            )
          ).pipe(Effect.flip);

          expect(error).toMatchObject({
            _tag: "QaCommandError",
            message: `qa judge-lint could not read ${inventoryPath}; run \`bun run beep qa judge-ingest --round 1 --from <file>\` first.`,
          });
          expect(yield* fs.readFileString(certificatePath)).toBe(before);
        })
      )
    );

    it.effect("keeps the exported requireInventoryRound failure for a copied round", () =>
      Effect.gen(function* () {
        const inventory = QaInventory.make({
          findings: [],
          judge: QaJudgeRef.make({ effort: "inherited", model: "claude-opus-5-5" }),
          requiredCount: 0,
          round: 2,
          schemaVersion: "qa-inventory/v1",
          sessionRef: "session.json",
        });
        const error = yield* requireInventoryRound(1, inventory).pipe(Effect.flip);
        yield* requireInventoryRound(2, inventory);

        expect(error.message).toBe("qa judge inventory declares round 2 but round 1 was requested.");
      })
    );
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

    it.layer(
      ffmpegStub(() => Effect.die("probeVideo must not run without a video")),
      { timeout: "10 seconds" }
    )((it) => {
      it.effect("fails packing when the round has no recorded video", () =>
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            yield* prepareRound(cwd, 1);
            const error = yield* Effect.flip(runQaJudgePack(cwd, packOptions));
            expect(error.message).toContain("found no recorded video for round 1");
          })
        )
      );
    });

    it.layer(
      ffmpegStub(() => Effect.fail(FFmpegError.fromUnknown("probeVideo", "boom", { cause: new Error("corrupt") }))),
      { timeout: "10 seconds" }
    )((it) => {
      it.effect("fails packing when the recorded video cannot be probed", () =>
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const { layout } = yield* prepareRound(cwd, 1);
            yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "not really a video");
            const error = yield* Effect.flip(runQaJudgePack(cwd, packOptions));
            expect(error.message).toContain("could not probe the recorded video");
          })
        )
      );
    });

    it.layer(
      ffmpegStub((request) =>
        Effect.succeed(
          Str.endsWith("normalized.mp4")(request.videoPath)
            ? probeOf(request.videoPath, O.some(12))
            : probeOf(request.videoPath, O.none())
        )
      ),
      { timeout: "10 seconds" }
    )((it) => {
      it.effect("uses the normalized clip's duration when the source container reports none", () =>
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
            const manifest = yield* runQaJudgePack(cwd, packOptions);
            expect(manifest.round).toBe(1);
            // The marker's epoch maps far past the recording, so its rendered
            // time is the end-seek-guarded clamp on the normalized clip's 12s —
            // never 0.000.
            const timeline = yield* fs.readFileString(path.join(layout.root, "judge", "timeline.md"));
            expect(timeline).toContain(`t=${(12 - END_SEEK_GUARD_SECONDS).toFixed(3)}`);
          })
        )
      );
    });

    it.layer(
      ffmpegStub((request) => Effect.succeed(probeOf(request.videoPath, O.none()))),
      { timeout: "10 seconds" }
    )((it) => {
      it.effect("fails packing when neither the source nor the normalized clip carries a duration", () =>
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const { layout } = yield* prepareRound(cwd, 1);
            yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "duration-less webm");
            const error = yield* Effect.flip(runQaJudgePack(cwd, packOptions));
            expect(error.message).toContain("re-run `bun run beep qa extract --round 1`");
          })
        )
      );
    });

    it.layer(
      ffmpegStub((request) => Effect.succeed(probeOf(request.videoPath, O.some(0)))),
      { timeout: "10 seconds" }
    )((it) => {
      it.effect("rejects a concrete duration too short to carry temporal evidence", () =>
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const { layout } = yield* prepareRound(cwd, 1);
            yield* fs.writeFileString(path.join(layout.videoDir, "capture.webm"), "zero-duration webm");
            // A present-but-zero duration must fail exactly like a missing one:
            // the guarded mapping interval is empty, so every event would land
            // on t=0.000.
            const error = yield* Effect.flip(runQaJudgePack(cwd, packOptions));
            expect(error.message).toContain(`must exceed ${END_SEEK_GUARD_SECONDS}s`);
          })
        )
      );
    });
  });
});
