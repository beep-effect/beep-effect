import { runGoalsHarvest } from "@beep/repo-cli/commands/Goals/Harvest";
import { HarvestLedger } from "@beep/repo-cli/commands/Goals/Harvest.schemas";
import {
  checkboxItemTexts,
  frictionReceipts,
  HarvestProjector,
  HarvestProjectorLive,
  harvestRowId,
  isTerminalPacketStatus,
  parseHarvestLedgerText,
  renderHarvestLedger,
  uncheckedPlanItems,
} from "@beep/repo-cli/commands/Goals/Harvest.service";
import { CliReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import { assertFalse, assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Str from "effect/String";
import type { HarvestRow, HarvestSource } from "@beep/repo-cli/commands/Goals/Harvest.schemas";

const GOAL_MANIFEST = A.join(
  [
    "{",
    '  "schemaVersion": "initiative-manifest/v2",',
    '  "initiative": { "id": "demo", "status": "completed-retained" },',
    '  "statusNote": "Shipped; archive pending.",',
    '  "stopConditions": [',
    '    "Required source files are missing.",',
    '    "Required source files are missing.",',
    '    "Any spend needs the operator."',
    "  ]",
    "}",
    "",
  ],
  "\n"
);

const EXPLORATION_MANIFEST = A.join(
  [
    "{",
    '  "schemaVersion": "exploration-manifest/v1",',
    '  "exploration": {',
    '    "slug": "probe",',
    '    "title": "Probe",',
    '    "status": "active",',
    '    "stage": "shape",',
    '    "updated": "2026-11-06",',
    '    "openQuestions": ["Which root owns harvest?"]',
    "  }",
    "}",
    "",
  ],
  "\n"
);

const REFLECTION = A.join(
  [
    "---",
    "goal: demo",
    "agent: codex",
    "date: 2026-11-06",
    "trigger: closeout",
    "confidence: high",
    "findings:",
    "  - category: tooling-friction",
    "    confidence: medium",
    "    instruction: Cache the slow scan.",
    "    explanation: It ran twice.",
    "todos:",
    "  - Codify the cache.",
    "  - Retire the flag.",
    "---",
    "",
    "# Reflection",
    "",
  ],
  "\n"
);

const DECISION = A.join(
  ["---", "title: Forward only", "date: 2026-11-06", "reversal: Revert the commit.", "---", "", "Body.", ""],
  "\n"
);

const LEDGER = A.join(
  [
    "# Friction",
    "",
    "## O1 — Slow scan",
    "",
    "The scan ran twice.",
    "- **Prevention:** cache the scan.",
    "",
    "## O2 — No prevention",
    "",
    "Just a note.",
    "",
  ],
  "\n"
);

const PLAN = A.join(["# Plan", "", "- [x] Done", "- [ ] Ship the harvester", ""], "\n");
const BOILERPLATE = "- [ ] No unrelated refactors or formatting churn.";
const SPEC = A.join(["# Spec", "", "## Acceptance", "", "- [ ] Ledger is committed", `${BOILERPLATE}  `, ""], "\n");
const TEMPLATE_SPEC = A.join(["# Spec", "", "## Acceptance", "", "- [ ] <criterion>", BOILERPLATE, ""], "\n");

const run = Effect.fn("HarvestTest.run")(function* (root: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make("git", args, { cwd: root, stdout: "ignore", stderr: "ignore" })
  );
  const exitCode = yield* handle.exitCode;
  assert.strictEqual(exitCode, 0, `git ${A.join(args, " ")}`);
});

const commitAll = Effect.fn("HarvestTest.commitAll")(function* (root: string, message: string) {
  yield* run(root, ["add", "-A"]);
  yield* run(root, [
    "-c",
    "user.name=harvest",
    "-c",
    "user.email=harvest@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "--no-verify",
    "--allow-empty",
    "-m",
    message,
  ]);
});

const writeFixtureFile = Effect.fn("HarvestTest.writeFixtureFile")(function* (
  root: string,
  relative: string,
  text: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(root, relative);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, text);
});

const makeFixtureRepo = Effect.fn("HarvestTest.makeFixtureRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-goals-harvest-" });
  yield* run(root, ["init", "-q"]);
  yield* Effect.forEach(
    [
      ["goals/demo/ops/manifest.json", GOAL_MANIFEST],
      ["goals/demo/PLAN.md", PLAN],
      ["goals/demo/SPEC.md", SPEC],
      ["goals/demo/decisions/2026-11-06-forward-only.md", DECISION],
      ["goals/demo/history/reflections/2026-11-06-codex.md", REFLECTION],
      ["goals/demo/research/OPPORTUNITIES.md", LEDGER],
      ["goals/_template/research/OPPORTUNITIES.md", LEDGER],
      ["goals/_template/SPEC.md", TEMPLATE_SPEC],
      ["explorations/probe/ops/manifest.json", EXPLORATION_MANIFEST],
      ["explorations/probe/research/OPPORTUNITIES.md", LEDGER],
      ["infra/cache/research/OPPORTUNITIES.md", LEDGER],
    ] as const,
    ([relative, text]) => writeFixtureFile(root, relative, text),
    { discard: true }
  );
  yield* commitAll(root, "fixture");
  return root;
});

const bySource = (rows: ReadonlyArray<HarvestRow>, source: HarvestSource): ReadonlyArray<HarvestRow> =>
  A.filter(rows, (row) => row.source === source);

const lineTexts = (rows: ReadonlyArray<HarvestRow>): ReadonlyArray<readonly [number, string]> =>
  A.map(rows, (row) => [row.line, row.text] as const);

const TestLayer = Layer.provideMerge(HarvestProjectorLive, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));

describe("goals harvest", () => {
  it("parses unchecked plan items and friction receipts with their 1-based lines", () => {
    assert.deepStrictEqual(
      A.map(uncheckedPlanItems("goals/demo/PLAN.md", PLAN), (draft) => [draft.line, draft.text] as const),
      [[4, "Ship the harvester"]]
    );
    assert.deepStrictEqual(
      A.map(
        frictionReceipts("goals/demo/research/OPPORTUNITIES.md", LEDGER),
        (draft) => [draft.line, draft.text] as const
      ),
      [
        [3, "## O1 — Slow scan\n- **Prevention:** cache the scan."],
        [8, "## O2 — No prevention"],
      ]
    );
  });

  it("classifies terminal statuses per root", () => {
    assertTrue(isTerminalPacketStatus("goals", "completed-retained"));
    assertTrue(isTerminalPacketStatus("explorations", "killed"));
    assertFalse(isTerminalPacketStatus("goals", "graduated"));
    assertFalse(isTerminalPacketStatus("explorations", "active"));
  });

  it.layer(NodeCrypto.layer)((it) => {
    it.effect("row ids are stable, key-order free, and change with location or text", () =>
      Effect.gen(function* () {
        const base = {
          root: "goals",
          slug: "demo",
          source: "plan-unchecked",
          file: "goals/demo/PLAN.md",
          line: 4,
          text: "Ship",
        } as const;
        const first = yield* harvestRowId(base);
        const again = yield* harvestRowId({ ...base });
        const reordered = yield* harvestRowId({
          text: "Ship",
          line: 4,
          file: "goals/demo/PLAN.md",
          source: "plan-unchecked",
          slug: "demo",
          root: "goals",
        });
        const moved = yield* harvestRowId({ ...base, line: 5 });
        const unpacked = yield* harvestRowId({ ...base, root: null, slug: null });
        assert.strictEqual(first, again);
        assert.strictEqual(first, reordered);
        assert.notStrictEqual(first, moved);
        assert.notStrictEqual(first, unpacked);
        assert.match(first, /^[0-9a-f]{64}$/);
      })
    );
  });

  it.layer(TestLayer, { timeout: "60 seconds" })((it) => {
    it.effect("collects every source type from a fixture checkout", () =>
      Effect.gen(function* () {
        const root = yield* makeFixtureRepo();
        const projector = yield* HarvestProjector;
        const ledger = yield* projector.collect({ kinds: ["goals", "explorations"], repoRoot: root });
        const rows = ledger.rows;
        assert.strictEqual(ledger.rowCount, A.length(rows));
        assert.match(ledger.sourceCommit, /^[0-9a-f]{40}$/);
        assertTrue(A.every(rows, (row) => row.commit === ledger.sourceCommit));
        assert.strictEqual(A.length(A.dedupe(A.map(rows, (row) => row.id))), A.length(rows));

        const findings = bySource(rows, "reflection-finding");
        assert.deepStrictEqual(lineTexts(findings), [[10, "Cache the slow scan."]]);
        assert.strictEqual(findings[0]?.category, "tooling-friction");
        assert.strictEqual(findings[0]?.confidence, "medium");
        assert.deepStrictEqual(lineTexts(bySource(rows, "reflection-todo")), [
          [13, "Codify the cache."],
          [14, "Retire the flag."],
        ]);
        assert.deepStrictEqual(lineTexts(bySource(rows, "status-note")), [[4, "Shipped; archive pending."]]);
        assert.deepStrictEqual(lineTexts(bySource(rows, "stop-condition")), [
          [6, "Required source files are missing."],
          [7, "Required source files are missing."],
          [8, "Any spend needs the operator."],
        ]);
        assert.deepStrictEqual(
          A.map(bySource(rows, "plan-unchecked"), (row) => [row.file, row.line, row.text] as const),
          [
            ["goals/demo/PLAN.md", 4, "Ship the harvester"],
            ["goals/demo/SPEC.md", 5, "Ledger is committed"],
          ]
        );
        assert.deepStrictEqual(lineTexts(bySource(rows, "decision-file")), [[2, "Forward only"]]);
        assert.deepStrictEqual(lineTexts(bySource(rows, "open-question")), [[9, "Which root owns harvest?"]]);

        const receipts = bySource(rows, "friction-receipt");
        assert.deepStrictEqual(A.dedupe(A.map(receipts, (row) => row.file)), [
          "explorations/probe/research/OPPORTUNITIES.md",
          "goals/demo/research/OPPORTUNITIES.md",
          "infra/cache/research/OPPORTUNITIES.md",
        ]);
        const infra = A.filter(receipts, (row) => Str.startsWith("infra/")(row.file));
        assertTrue(A.every(infra, (row) => row.packet === null && row.status === null && !row.terminal));

        const goalRows = A.filter(rows, (row) => row.packet?.root === "goals");
        assertTrue(A.every(goalRows, (row) => row.terminal && row.status === "completed-retained"));
        const explorationRows = A.filter(rows, (row) => row.packet?.root === "explorations");
        assertTrue(A.every(explorationRows, (row) => !row.terminal && row.status === "active"));

        const goalsOnly = yield* projector.collect({ kinds: ["goals"], repoRoot: root });
        assertTrue(A.every(goalsOnly.rows, (row) => row.packet?.root === "goals"));
        assert.strictEqual(A.length(bySource(goalsOnly.rows, "open-question")), 0);
      })
    );

    it.effect("skips plan items whose text matches a template checkbox line", () =>
      Effect.gen(function* () {
        assert.deepStrictEqual(checkboxItemTexts(TEMPLATE_SPEC), [
          "<criterion>",
          "No unrelated refactors or formatting churn.",
        ]);
        const root = yield* makeFixtureRepo();
        const projector = yield* HarvestProjector;
        const ledger = yield* projector.collect({ kinds: ["goals"], repoRoot: root });
        const planTexts = A.map(bySource(ledger.rows, "plan-unchecked"), (row) => row.text);
        assert.deepStrictEqual(planTexts, ["Ship the harvester", "Ledger is committed"]);
        assertFalse(A.some(ledger.rows, (row) => Str.startsWith("goals/_template/")(row.file)));
      })
    );

    it.effect("round-trips the header plus rows JSON Lines file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeFixtureRepo();
        const projector = yield* HarvestProjector;
        const ledger = yield* projector.collect({ kinds: ["goals", "explorations"], repoRoot: root });
        const target = path.join(root, "out", "ledger.jsonl");
        yield* projector.write(ledger, target);
        const text = yield* fs.readFileString(target);
        const lines = A.filter(Str.split(text, "\n"), Str.isNonEmpty);
        assert.strictEqual(A.length(lines), ledger.rowCount + 1);
        assertFalse(Str.includes('"rows"')(lines[0] ?? ""));
        const parsed = yield* parseHarvestLedgerText(target, text);
        assertInstanceOf(parsed, HarvestLedger);
        const rendered = yield* renderHarvestLedger(parsed);
        assert.strictEqual(rendered, text);
        const read = yield* projector.read(target);
        assertSome(
          O.map(read, (value) => value.rowCount),
          ledger.rowCount
        );
        const missing = yield* projector.read(path.join(root, "absent.jsonl"));
        assertNone(missing);
        const truncated = yield* parseHarvestLedgerText(target, lines[0] ?? "").pipe(Effect.flip);
        assert.strictEqual(truncated.reason, "harvest-parse-failed");
      })
    );

    it.effect("--check passes on an unchanged tree across commits and fails on drift", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeFixtureRepo();
        const options = { kind: "all", out: "research/ledger.jsonl", check: false } as const;
        const missing = yield* runGoalsHarvest({ ...options, check: true }, root).pipe(Effect.flip);
        assertInstanceOf(missing, CliReportedExit);
        yield* runGoalsHarvest(options, root);
        yield* runGoalsHarvest({ ...options, check: true }, root);
        // Committing the ledger moves HEAD; the check ignores the read commit and timestamp.
        yield* commitAll(root, "ledger");
        yield* runGoalsHarvest({ ...options, check: true }, root);
        yield* fs.writeFileString(path.join(root, "goals", "demo", "PLAN.md"), `${PLAN}- [ ] Another item\n`);
        const drift = yield* runGoalsHarvest({ ...options, check: true }, root).pipe(Effect.flip);
        assertInstanceOf(drift, CliReportedExit);
        assertTrue(Str.includes("ledger drift")(drift.message));
      })
    );
  });
});
