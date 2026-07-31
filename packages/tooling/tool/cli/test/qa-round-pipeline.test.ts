import {
  CaptureSession,
  ClockSync,
  CollectorHandle,
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
  QaFindingId,
  QaInventory,
  QaJudgeIngestOptions,
  QaJudgeLintOptions,
  QaJudgeRef,
  QaReportOptions,
  readEventLog,
  renderCrossCheckFailure,
  requireLiveHandle,
  resolveExistingRound,
  resolveRound,
  runQaJudgeIngest,
  runQaJudgeLint,
  runQaReport,
} from "@beep/repo-cli/commands/Qa";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

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

const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);
const fence = "`".repeat(3);

const inventoryText = Effect.fnUntraced(function* (round: number) {
  const body = yield* encodeJson({
    findings: [],
    judge: { effort: "high", model: "gpt-5.6-sol" },
    requiredCount: 0,
    round,
    schemaVersion: "qa-inventory/v1",
    sessionRef: "session.json",
  });
  return `judge narration\n${fence}json\n${body}\n${fence}\n`;
});

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
            judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
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
            judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
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
    Effect.gen(function* () {
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
        judge: { effort: "high", model: "gpt-5.6-sol" },
        requiredCount: 1,
        round: 1,
        schemaVersion: "qa-inventory/v1",
        sessionRef: "session.json",
      });
      const exit = yield* Effect.exit(
        withTempCwd(
          Effect.fnUntraced(function* (cwd) {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            yield* prepareRound(cwd, 1);
            const transcript = path.join(cwd, "judge-stdout.txt");
            yield* fs.writeFileString(transcript, `${fence}json\n${dirty}\n${fence}\n`);
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
});
