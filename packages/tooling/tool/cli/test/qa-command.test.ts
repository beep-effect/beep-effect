import {
  ArtifactBudget,
  CaptureArtifact,
  CaptureSession,
  ClockSync,
  DroppedWindow,
  ExtractionPlan,
  RoundLayout,
  SessionManifest,
  Viewport,
} from "@beep/qa-capture";
import {
  crossCheckEvidence,
  decodeQaInventory,
  EvidenceCrossCheck,
  extractLastJsonBlock,
  isCrossCheckClean,
  JUDGE_PER_FILE_BUDGET_BYTES,
  JUDGE_TOTAL_BUDGET_BYTES,
  JudgeEvidenceFile,
  JudgePromptValues,
  QaEventLog,
  QaInventory,
  QaJudgeRef,
  renderCrossCheckFailure,
  renderInventoryMarkdown,
  renderJudgePrompt,
  renderRoundReport,
  requiredFindingCount,
  selectJudgeEvidence,
  windowSeqsForLabel,
} from "@beep/repo-cli/commands/Qa";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";

const judge = QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" });

const finding = (id: string, severity: "P0" | "P1" | "P2", path: string, eventIds: ReadonlyArray<number>) => ({
  evidence: [{ eventIds, kind: "strip", path }],
  fix: "fix it",
  id,
  lens: "selection-smear",
  repro: "drag the sash",
  severity,
  title: `finding ${id}`,
});

const inventoryInput = (findings: ReadonlyArray<unknown>, requiredCount: number) => ({
  findings,
  judge: { effort: "high", model: "gpt-daybreak-blue-latest" },
  requiredCount,
  round: 4,
  schemaVersion: "qa-inventory/v1",
  sessionRef: "session.json",
});

describe("commands/Qa Inventory.schemas", () => {
  it.effect("accepts an inventory whose requiredCount matches its P0 and P1 findings", () =>
    Effect.gen(function* () {
      const inventory = yield* decodeQaInventory(
        inventoryInput(
          [
            finding("R4-01", "P0", "frames/a.png", [2]),
            finding("R4-02", "P1", "frames/b.png", [3]),
            finding("R4-03", "P2", "frames/c.png", []),
          ],
          2
        )
      );
      expect(inventory.requiredCount).toBe(2);
      expect(A.length(inventory.findings)).toBe(3);
    })
  );

  it.effect("rejects an inventory whose verdict disagrees with its findings", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeQaInventory(inventoryInput([finding("R4-01", "P0", "frames/a.png", [2])], 0))
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("rejects a finding id that is not R<round>-<nn>", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        decodeQaInventory(inventoryInput([finding("R4-1", "P0", "frames/a.png", [2])], 1))
      );
      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it("counts only P0 and P1 findings as required", () => {
    expect(requiredFindingCount([{ severity: "P0" }, { severity: "P1" }, { severity: "P2" }])).toBe(2);
  });
});

describe("commands/Qa JudgeCheck JSON extraction", () => {
  it("takes the last fenced json block out of noisy judge output", () => {
    const stdout = [
      "Reading the frames now.",
      "```json",
      '{ "draft": true }',
      "```",
      "On reflection, the inventory is:",
      "```json",
      '{ "final": true }',
      "```",
      "REQUIRED FINDINGS: 0",
    ].join("\n");
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "final": true }');
  });

  it("falls back to an unlabelled fence when the judge omits the json tag", () => {
    const stdout = ["chatter", "```", '{ "final": true }', "```", "REQUIRED FINDINGS: 0"].join("\n");
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "final": true }');
  });

  it("returns none when the output holds no fenced block", () => {
    expect(O.isNone(extractLastJsonBlock("no json here at all"))).toBe(true);
  });

  it("salvages a correct unfenced object when the judge omits fences entirely", () => {
    const stdout = ["REQUIRED FINDINGS: 0", 'Inventory follows: { "round": 3, "findings": [] }'].join("\n");
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "round": 3, "findings": [] }');
  });

  it("ignores an unmatched quote in prose before an unfenced object", () => {
    const stdout = 'analysis says "maybe then { "final": true }';
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "final": true }');
  });

  it("ignores an unmatched opening brace in prose before an unfenced object", () => {
    const stdout = 'analysis starts { but inventory follows: { "final": { "findings": [] } }';
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "final": { "findings": [] } }');
  });

  it("takes the last parseable unfenced object, skipping prose braces and brace-bearing strings", () => {
    const stdout = 'set {a, b} then { "draft": true } and finally { "final": { "nested": "}{" } }';
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "final": { "nested": "}{" } }');
  });

  it("handles escaped quotes and a string ending in an escaped backslash", () => {
    // The "path" value ends in a backslash, so its closing quote is preceded by
    // an even backslash run — the parity branch that decides the quote is real.
    const candidate = JSON.stringify({ message: 'escaped quote: "; braces: }{', path: "C:\\logs\\" });
    const stdout = `thinking... ${candidate} trailing prose`;
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe(candidate);
  });

  it("salvages a valid unfenced object followed by trailing prose", () => {
    const candidate = '{ "final": true }';
    expect(O.getOrElse(extractLastJsonBlock(`${candidate} REQUIRED FINDINGS: 0`), () => "")).toBe(candidate);
  });

  it("resynchronizes after an unterminated string before a later valid object", () => {
    const candidate = '{ "round": 4, "findings": [] }';
    const stdout = `{ "message": "unterminated }\n${candidate}`;
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe(candidate);
  });

  it("prefers a fenced block over later unfenced objects", () => {
    const stdout = ["```json", '{ "final": true }', "```", 'afterthought: { "not": "the inventory" }'].join("\n");
    expect(O.getOrElse(extractLastJsonBlock(stdout), () => "")).toBe('{ "final": true }');
  });

  it("returns none when braces never balance into valid JSON", () => {
    expect(O.isNone(extractLastJsonBlock("opening { and prose {still not json}"))).toBe(true);
  });

  // The bound only needs to separate linear from quadratic (quadratic on 40k
  // spans runs tens of seconds); keep it loose enough to absorb coverage
  // instrumentation overhead on loaded CI shard runners.
  it("stays bounded on pathological unmatched-opening-brace output", () => {
    const hostile = Str.repeat(40_000)("{");
    const startedAt = globalThis.performance.now();
    const extracted = extractLastJsonBlock(hostile);
    const elapsedMs = globalThis.performance.now() - startedAt;

    expect(O.isNone(extracted)).toBe(true);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it("stays bounded on pathological balanced-object output", () => {
    // Unlike unmatched braces, every repeat completes a span; accumulating
    // spans instead of retaining the latest decodable candidate is quadratic here.
    const hostile = Str.repeat(40_000)('{ "final": true } ');
    const startedAt = globalThis.performance.now();
    const extracted = extractLastJsonBlock(hostile);
    const elapsedMs = globalThis.performance.now() - startedAt;

    expect(O.getOrElse(extracted, () => "")).toBe('{ "final": true }');
    expect(elapsedMs).toBeLessThan(5000);
  });
});

describe("commands/Qa JudgeCheck evidence cross-check", () => {
  it.effect("names every artifact and event id the round cannot back up", () =>
    Effect.gen(function* () {
      const inventory = yield* decodeQaInventory(
        inventoryInput(
          [finding("R4-01", "P0", "frames/ghost.png", [2, 999]), finding("R4-02", "P1", "frames/real.png", [3])],
          2
        )
      );
      const check = crossCheckEvidence(
        inventory,
        HashSet.fromIterable(["frames/real.png"]),
        HashSet.fromIterable([2, 3])
      );
      expect(check.missingPaths).toEqual(["frames/ghost.png"]);
      expect(check.missingEventIds).toEqual([999]);
      expect(isCrossCheckClean(check)).toBe(false);
      const message = renderCrossCheckFailure(4, check);
      expect(message).toContain("frames/ghost.png");
      expect(message).toContain("999");
    })
  );

  it.effect("passes an inventory whose citations all resolve", () =>
    Effect.gen(function* () {
      const inventory = yield* decodeQaInventory(inventoryInput([finding("R4-01", "P0", "frames/real.png", [3])], 1));
      const check = crossCheckEvidence(inventory, HashSet.fromIterable(["frames/real.png"]), HashSet.fromIterable([3]));
      expect(isCrossCheckClean(check)).toBe(true);
    })
  );

  it("treats an empty cross-check as clean", () => {
    expect(isCrossCheckClean(EvidenceCrossCheck.make({ missingEventIds: [], missingPaths: [] }))).toBe(true);
  });
});

describe("commands/Qa JudgePack budget", () => {
  const file = (path: string, bytes: number, kind: "frame" | "screenshot" | "sheet") =>
    JudgeEvidenceFile.make({ bytes, kind, path });

  it("drops a file that exceeds the per-file ceiling", () => {
    const selection = selectJudgeEvidence([file("sheets/huge.jpg", JUDGE_PER_FILE_BUDGET_BYTES + 1, "sheet")], []);
    expect(selection.files).toEqual([]);
    expect(A.length(selection.dropped)).toBe(1);
    expect(selection.dropped[0]?.reason).toBe("per-file-budget");
  });

  // Exactly `fitting` max-size files fill the total budget, so adding one more
  // candidate forces the selector to sacrifice its lowest-priority entry.
  const fitting = Math.floor(JUDGE_TOTAL_BUDGET_BYTES / JUDGE_PER_FILE_BUDGET_BYTES);
  const maxFrames = A.makeBy(fitting, (index) =>
    file(`frames/drag-w0_${`${index}`.padStart(5, "0")}.png`, JUDGE_PER_FILE_BUDGET_BYTES, "frame")
  );

  it("sacrifices a green-scenario screenshot before any frame strip", () => {
    const selection = selectJudgeEvidence(
      [...maxFrames, file("green--shot.png", JUDGE_PER_FILE_BUDGET_BYTES, "screenshot")],
      ["green--shot.png"]
    );
    expect(A.length(selection.files)).toBe(fitting);
    expect(A.map(selection.dropped, (value) => value.path)).toEqual(["green--shot.png"]);
    expect(selection.dropped[0]?.reason).toBe("total-budget");
  });

  it("keeps a failing-scenario screenshot and sacrifices a frame strip instead", () => {
    const selection = selectJudgeEvidence(
      [...maxFrames, file("failing--shot.png", JUDGE_PER_FILE_BUDGET_BYTES, "screenshot")],
      []
    );
    expect(A.length(selection.files)).toBe(fitting);
    expect(A.map(selection.files, (value) => value.path)).toContain("failing--shot.png");
    expect(A.length(selection.dropped)).toBe(1);
    expect(selection.dropped[0]?.path.startsWith("frames/")).toBe(true);
  });

  it("keeps everything that fits, ordered by path", () => {
    const selection = selectJudgeEvidence(
      [file("sheets/contact-sheet.jpg", 1000, "sheet"), file("frames/a.png", 1000, "frame")],
      []
    );
    expect(A.map(selection.files, (value) => value.path)).toEqual(["frames/a.png", "sheets/contact-sheet.jpg"]);
    expect(selection.dropped).toEqual([]);
  });

  it("fills every placeholder in the judge prompt template", () => {
    const rendered = renderJudgePrompt(
      "round {{ROUND}} of {{SURFACE}} in {{ROUND_DIR}}\n{{SCENARIO_NOTES}}",
      JudgePromptValues.make({
        round: 7,
        roundDir: "/repo/.beep/qa/round-7",
        scenarioNotes: "- drag the sash",
        surface: "storybook",
      })
    );
    expect(rendered).toBe("round 7 of storybook in /repo/.beep/qa/round-7\n- drag the sash");
    expect(rendered).not.toContain("{{");
  });
});

describe("commands/Qa Extract window attribution", () => {
  const plan = ExtractionPlan.make({
    budget: ArtifactBudget.make({}),
    dropped: [],
    estimatedTotalBytes: 0,
    schemaVersion: "beep.qa.extraction-plan.v1",
    windows: [],
  });

  it("returns no sequences for a label with no matching window", () => {
    expect(windowSeqsForLabel(plan, "drag-w0")).toEqual([]);
    expect(windowSeqsForLabel(plan, "contact-sheet")).toEqual([]);
  });
});

describe("commands/Qa report rendering", () => {
  const manifest = SessionManifest.make({
    artifacts: [
      CaptureArtifact.make({
        eventSeqs: [2, 3],
        fileSizeBytes: O.some(48372),
        kind: "frame",
        relativePath: "frames/drag-w1_00000.png",
      }),
    ],
    clockSync: O.some(
      ClockSync.make({ confidence: "low", method: "assumed-start", offsetMs: -1000, residualRmsMs: 0, slope: 1 })
    ),
    eventsPath: "events.ndjson",
    legacyManifestPath: O.none(),
    schemaVersion: "beep.qa.capture-session.v1",
    session: CaptureSession.make({
      commitDirty: true,
      commitSha: "fixture000",
      id: "qa-round-4-1754000000000",
      lane: "playwright",
      round: 4,
      scenario: O.some(".beep/qa-capture.mjs"),
      startedAtEpochMs: 1754000000000,
      toolVersions: { bun: "1.3.14" },
      url: "http://storybook.beep.localhost:1355/",
      viewport: Viewport.make({ height: 360, width: 640 }),
    }),
    videoPath: O.some("video/capture.webm"),
  });

  const plan = ExtractionPlan.make({
    budget: ArtifactBudget.make({}),
    dropped: [
      DroppedWindow.make({
        detail: O.some("over budget"),
        endEpochMs: 1754000002000,
        priority: "P2",
        reason: "budget-priority-dropped",
        ruleKind: "hover",
        startEpochMs: 1754000001000,
      }),
    ],
    estimatedTotalBytes: 48372,
    schemaVersion: "beep.qa.extraction-plan.v1",
    windows: [],
  });

  it("renders the session header, clock, artifacts, and dropped windows", () => {
    const report = renderRoundReport(manifest, QaEventLog.make({ events: [], rejectedCount: 2 }), O.some(plan));
    expect(report).toContain("# QA round 4 — report");
    expect(report).toContain("`fixture000` (dirty)");
    expect(report).toContain("method: `assumed-start`");
    expect(report).toContain("frames/drag-w1_00000.png");
    expect(report).toContain("rejected lines: 2");
    expect(report).toContain("`hover` P2");
    expect(report).toContain("Clock confidence is low");
    expect(report).toContain("2 witness line(s) failed schema decoding.");
  });

  it("is idempotent for an unchanged round", () => {
    const first = renderRoundReport(manifest, QaEventLog.make({ events: [], rejectedCount: 0 }), O.some(plan));
    const second = renderRoundReport(manifest, QaEventLog.make({ events: [], rejectedCount: 0 }), O.some(plan));
    expect(first).toBe(second);
  });

  it.effect("ends a rendered inventory with the machine-readable verdict line", () =>
    Effect.gen(function* () {
      const inventory = yield* decodeQaInventory(
        inventoryInput([finding("R4-01", "P0", "frames/a.png", [2]), finding("R4-02", "P2", "frames/b.png", [])], 1)
      );
      const rendered = renderInventoryMarkdown(inventory);
      expect(rendered).toContain("### R4-01 — P0 —");
      expect(rendered).toContain("## Polish findings");
      expect(rendered.endsWith("REQUIRED FINDINGS: 1\n")).toBe(true);
    })
  );

  it("renders an empty inventory without findings sections collapsing", () => {
    const inventory = QaInventory.make({
      findings: [],
      judge,
      requiredCount: 0,
      round: 4,
      schemaVersion: "qa-inventory/v1",
      sessionRef: "session.json",
    });
    const rendered = renderInventoryMarkdown(inventory);
    expect(rendered).toContain("findings: 0 (0 required, 0 polish)");
    expect(rendered.endsWith("REQUIRED FINDINGS: 0\n")).toBe(true);
  });
});

describe("commands/Qa RoundLayout", () => {
  it("keeps clips and video out of the judge-visible surface", () => {
    const layout = RoundLayout.make({
      clipsDir: "/repo/.beep/qa/round-4/clips",
      eventsPath: "/repo/.beep/qa/round-4/events.ndjson",
      framesDir: "/repo/.beep/qa/round-4/frames",
      reportPath: "/repo/.beep/qa/round-4/report.md",
      root: "/repo/.beep/qa/round-4",
      round: 4,
      sessionPath: "/repo/.beep/qa/round-4/session.json",
      sheetsDir: "/repo/.beep/qa/round-4/sheets",
      videoDir: "/repo/.beep/qa/round-4/video",
    });
    const selection = selectJudgeEvidence(
      [
        JudgeEvidenceFile.make({ bytes: 100, kind: "frame", path: "frames/a.png" }),
        JudgeEvidenceFile.make({ bytes: 100, kind: "sheet", path: "sheets/contact-sheet.jpg" }),
      ],
      []
    );
    expect(A.every(selection.files, (file) => !file.path.startsWith("clips/"))).toBe(true);
    expect(A.every(selection.files, (file) => !file.path.startsWith("video/"))).toBe(true);
    expect(layout.clipsDir).toContain("clips");
  });
});
