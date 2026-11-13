import { collectManifestProjectionRows } from "@beep/repo-cli/commands/Goals/Manifest";
import {
  GOAL_DECISION_TARGETS,
  GoalDecision,
  GoalDecisionAddInput,
  GoalDecisionLog,
  GoalDecisionLogLive,
  GoalOperatorRuling,
  GoalPacketRecord,
  GoalRedAttributionBlock,
  goalDecisionLogReport,
  goalPacketFindings,
  goalsCommand,
  makeGoalPacketFilesystemReader,
  parseGoalDecision,
  renderGoalDecisionBlock,
  runGoalsDecisionsAdd,
  spliceGoalDecisionBlock,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  NodeTestLayer,
  readProjectFile,
  temporaryWorkingDirectory,
  writeProjectFile,
} from "./support/CommandTest.ts";

const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
const SPEC_TARGET = GOAL_DECISION_TARGETS[0]!;
const PLAN_TARGET = GOAL_DECISION_TARGETS[1]!;

const decision = (file: string, date: string, title: string, kind: "decision" | "checkpoint" = "decision") =>
  GoalDecision.make({
    file,
    frontmatter: { title, date, kind, reversal: `Undo ${title}.`, lane: "feat/x", pullRequest: 42 },
    body: `Body of ${title}.`,
  });

const VALID_FILE = A.join(
  [
    "---",
    "title: Forward-only migration",
    "date: 2026-11-05",
    "lane: feat/goal-packet-decision-files",
    "pullRequest: 2700",
    "reversal: Move the entries back into the table.",
    "---",
    "",
    "Existing Decision Log bodies stay frozen above the generated block.",
    "",
  ],
  "\n"
);

const RED_ATTRIBUTION = [
  "redAttribution:",
  "  finalPullRequest: 2966",
  "  reds:",
  '    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2994 }',
  '    - { context: "Heavy / Test Integration", attribution: introduced, fixPullRequest: 2995 }',
];

const claimFile = (claim: ReadonlyArray<string>, extra: ReadonlyArray<string> = []) =>
  A.join(
    [
      "---",
      'title: "Final #2966 merged over two Heavy checks"',
      "date: 2026-11-14",
      'lane: "feat/goal-closeout-hosted-verification"',
      'reversal: "Delete this file; goals completion refresh reports #2966 unsatisfied again."',
      ...extra,
      ...claim,
      "---",
      "",
      "Evidence: run URLs.",
      "",
    ],
    "\n"
  );

describe("goals decisions projection", () => {
  it.effect("renders entries oldest first and keeps the block deterministic", () =>
    Effect.sync(() => {
      const block = renderGoalDecisionBlock("demo", SPEC_TARGET, [
        decision("2026-11-05-b.md", "2026-11-05", "Later"),
        decision("2026-11-05-a.md", "2026-11-05", "Same day earlier file"),
        decision("2026-11-03-c.md", "2026-11-03", "Earliest"),
        decision("2026-11-04-d.md", "2026-11-04", "Plan note", "checkpoint"),
      ]);
      const headings = A.filter(Str.split(block, "\n"), Str.startsWith("### "));
      expect(headings).toEqual([
        "### Earliest, 2026-11-03",
        "### Same day earlier file, 2026-11-05",
        "### Later, 2026-11-05",
      ]);
      expect(block).toContain("Lane feat/x · PR #42");
      expect(block).toContain("Reverse: Undo Later.");
      assertTrue(Str.startsWith("<!-- beep:decisions:begin -->")(block));
      assertTrue(Str.endsWith("<!-- beep:decisions:end -->")(block));
      expect(renderGoalDecisionBlock("demo", SPEC_TARGET, [])).toContain("_No decision files yet._");
    })
  );

  it.effect("renders a decision's attributed reds and operator ruling after its body", () =>
    Effect.sync(() => {
      const claims = GoalDecision.make({
        file: "2026-11-14-final-merged-over-reds.md",
        frontmatter: {
          title: "Final #2966 merged over two Heavy checks",
          date: "2026-11-14",
          kind: "decision",
          reversal: "Delete this file.",
          lane: "feat/x",
          redAttribution: {
            finalPullRequest: 2966,
            reds: [
              { context: "Heavy / Check", attribution: "inherited", fixPullRequest: 2994 },
              { context: "Heavy / Test Integration", attribution: "introduced", fixPullRequest: 2995 },
            ],
          },
          operatorRuling: { finalPullRequest: 2966 },
        },
        body: "Evidence: run URLs.",
      });
      const rulingOnly = GoalDecision.make({
        file: "2026-11-14-operator-closes-2080.md",
        frontmatter: {
          title: "Operator closes #2080",
          date: "2026-11-14",
          kind: "decision",
          reversal: "Delete this file.",
          operatorRuling: { finalPullRequest: 2080 },
        },
        body: "",
      });
      const lines = Str.split(renderGoalDecisionBlock("demo", SPEC_TARGET, [claims, rulingOnly]), "\n");
      const at = (line: string) => O.getOrThrow(A.findFirstIndex(lines, (candidate) => candidate === line));
      const attributed =
        "Attributed reds for #2966: Heavy / Check (inherited, fix #2994); Heavy / Test Integration (introduced, fix #2995)";
      expect(at("Evidence: run URLs.")).toBeLessThan(at(attributed));
      expect(at(attributed)).toBeLessThan(at("Operator ruling closes #2966"));
      expect(at("Operator ruling closes #2966")).toBeLessThan(at("Lane feat/x"));
      expect(lines[at(attributed) + 1]).toBe("");
      // A ruling with no body and no attribution sits between the heading and the Reverse line.
      const rulingHeading = at("### Operator closes #2080, 2026-11-14");
      expect(A.drop(lines, rulingHeading)).toEqual([
        "### Operator closes #2080, 2026-11-14",
        "",
        "Operator ruling closes #2080",
        "",
        "Reverse: Delete this file.",
        "",
        "<!-- beep:decisions:end -->",
      ]);
      // A decision without claims renders no claim lines.
      const plain = renderGoalDecisionBlock("demo", SPEC_TARGET, [decision("2026-11-05-a.md", "2026-11-05", "Plain")]);
      expect(plain).not.toContain("Attributed reds");
      expect(plain).not.toContain("Operator ruling");
    })
  );

  it.effect("splices into an existing section, replaces markers, and appends a missing heading", () =>
    Effect.sync(() => {
      const spec = A.join(
        [
          "# Spec",
          "",
          "## Decision Log",
          "",
          "| Date | Decision |",
          "| 2026-10-01 | legacy |",
          "",
          "## Exception Ledger",
          "",
          "none",
          "",
        ],
        "\n"
      );
      const first = Result.getOrThrow(
        spliceGoalDecisionBlock(
          O.some(spec),
          SPEC_TARGET,
          "<!-- beep:decisions:begin -->\nv1\n<!-- beep:decisions:end -->"
        )
      );
      expect(first).toBe(
        A.join(
          [
            "# Spec",
            "",
            "## Decision Log",
            "",
            "| Date | Decision |",
            "| 2026-10-01 | legacy |",
            "",
            "<!-- beep:decisions:begin -->",
            "v1",
            "<!-- beep:decisions:end -->",
            "",
            "## Exception Ledger",
            "",
            "none",
            "",
          ],
          "\n"
        )
      );
      const second = Result.getOrThrow(
        spliceGoalDecisionBlock(
          O.some(first),
          SPEC_TARGET,
          "<!-- beep:decisions:begin -->\nv2\n<!-- beep:decisions:end -->"
        )
      );
      expect(second).toContain("\nv2\n");
      expect(second).not.toContain("\nv1\n");
      expect(second).toContain("| 2026-10-01 | legacy |");
      const appended = Result.getOrThrow(
        spliceGoalDecisionBlock(
          O.some("# Plan\n\n## Phases\n\nrows\n"),
          PLAN_TARGET,
          "<!-- beep:decisions:begin -->\n<!-- beep:decisions:end -->"
        )
      );
      expect(appended).toBe(
        "# Plan\n\n## Phases\n\nrows\n\n## Checkpoints\n\n<!-- beep:decisions:begin -->\n<!-- beep:decisions:end -->\n"
      );
      const absent = Result.getOrThrow(spliceGoalDecisionBlock(O.none(), SPEC_TARGET, "<!-- block -->"));
      expect(absent).toBe("## Decision log\n\n<!-- block -->\n");
      const lastSection = Result.getOrThrow(
        spliceGoalDecisionBlock(O.some("# Spec\n\n## Decision log\n\nrow\n\n\n"), SPEC_TARGET, "<!-- block -->")
      );
      expect(lastSection).toBe("# Spec\n\n## Decision log\n\nrow\n\n<!-- block -->\n");
      const unbalanced = spliceGoalDecisionBlock(
        O.some("## Decision log\n\n<!-- beep:decisions:begin -->\n"),
        SPEC_TARGET,
        "x"
      );
      unbalanced.pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects files outside the grammar and accepts a valid one", () =>
    Effect.gen(function* () {
      const badName = yield* parseGoalDecision("notes.md", VALID_FILE);
      badName.pipe(Result.isFailure, assertTrue);
      const noFrontmatter = yield* parseGoalDecision("2026-11-05-x.md", "# just prose\n");
      noFrontmatter.pipe(Result.isFailure, assertTrue);
      const dateMismatch = yield* parseGoalDecision("2026-11-04-forward-only-migration.md", VALID_FILE);
      dateMismatch.pipe(Result.isFailure, assertTrue);
      const missingReversal = yield* parseGoalDecision(
        "2026-11-05-x.md",
        "---\ntitle: X\ndate: 2026-11-05\n---\nbody\n"
      );
      missingReversal.pipe(Result.isFailure, assertTrue);
      const unknownKey = yield* parseGoalDecision(
        "2026-11-05-x.md",
        "---\ntitle: X\ndate: 2026-11-05\nreversal: R.\npr: 1\n---\nbody\n"
      );
      unknownKey.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(unknownKey)) {
        expect(unknownKey.failure.message).toContain("outside GoalDecisionFrontmatter: pr ");
      }
      // A refinement failure under a declared key walks Pointer -> Filter and names no unknown key.
      const badPullRequest = yield* parseGoalDecision(
        "2026-11-05-x.md",
        "---\ntitle: X\ndate: 2026-11-05\nreversal: R.\npullRequest: 0\n---\nbody\n"
      );
      badPullRequest.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(badPullRequest)) {
        expect(badPullRequest.failure.message).toContain("does not decode as GoalDecisionFrontmatter");
        expect(badPullRequest.failure.message).not.toContain("outside GoalDecisionFrontmatter");
      }
      // Frontmatter that is not YAML fails before the schema runs and reports no unknown key.
      const notYaml = yield* parseGoalDecision("2026-11-05-x.md", "---\ntitle: [unclosed\n---\nbody\n");
      notYaml.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(notYaml)) {
        expect(notYaml.failure.message).not.toContain("outside GoalDecisionFrontmatter");
      }
      const ok = yield* parseGoalDecision("2026-11-05-forward-only-migration.md", VALID_FILE);
      ok.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(ok)) {
        expect(ok.success.frontmatter.kind).toBe("decision");
        expect(ok.success.frontmatter.pullRequest).toBe(2700);
        expect(ok.success.body).toBe("Existing Decision Log bodies stay frozen above the generated block.");
        expect(ok.success.frontmatter.redAttribution).toBeUndefined();
        expect(ok.success.frontmatter.operatorRuling).toBeUndefined();
      }
    })
  );

  it.effect("accepts redAttribution and operatorRuling blocks on a decision", () =>
    Effect.gen(function* () {
      const attributed = yield* parseGoalDecision("2026-11-14-final-merged-over-reds.md", claimFile(RED_ATTRIBUTION));
      attributed.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(attributed)) {
        expect(attributed.success.frontmatter.kind).toBe("decision");
        expect(attributed.success.frontmatter.redAttribution).toEqual(
          GoalRedAttributionBlock.make({
            finalPullRequest: 2966,
            reds: [
              { context: "Heavy / Check", attribution: "inherited", fixPullRequest: 2994 },
              { context: "Heavy / Test Integration", attribution: "introduced", fixPullRequest: 2995 },
            ],
          })
        );
        expect(attributed.success.body).toBe("Evidence: run URLs.");
      }
      const blockStyle = yield* parseGoalDecision(
        "2026-11-14-final-merged-over-reds.md",
        claimFile(
          [
            "redAttribution:",
            "  finalPullRequest: 2963",
            "  reds:",
            "    - context: Heavy / Docgen",
            "      attribution: mixed",
            "      fixPullRequest: 3001",
          ],
          ["kind: decision"]
        )
      );
      blockStyle.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(blockStyle)) {
        expect(blockStyle.success.frontmatter.redAttribution?.reds[0].attribution).toBe("mixed");
      }
      const ruling = yield* parseGoalDecision(
        "2026-11-14-final-merged-over-reds.md",
        claimFile(["operatorRuling:", "  finalPullRequest: 2080"])
      );
      ruling.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(ruling)) {
        expect(ruling.success.frontmatter.operatorRuling).toEqual(GoalOperatorRuling.make({ finalPullRequest: 2080 }));
        expect(ruling.success.frontmatter.redAttribution).toBeUndefined();
      }
      const both = yield* parseGoalDecision(
        "2026-11-14-final-merged-over-reds.md",
        claimFile([...RED_ATTRIBUTION, "operatorRuling:", "  finalPullRequest: 2966"])
      );
      both.pipe(Result.isSuccess, assertTrue);
    })
  );

  it.effect("rejects claim blocks on a checkpoint, misspelt claim keys and malformed attributions", () =>
    Effect.gen(function* () {
      const rejected = Effect.fnUntraced(function* (lines: ReadonlyArray<string>, extra: ReadonlyArray<string> = []) {
        const parsed = yield* parseGoalDecision("2026-11-14-final-merged-over-reds.md", claimFile(lines, extra));
        parsed.pipe(Result.isFailure, assertTrue);
        return Result.isFailure(parsed) ? parsed.failure.message : "";
      });
      const checkpointRed = yield* rejected(RED_ATTRIBUTION, ["kind: checkpoint"]);
      expect(checkpointRed).toContain("does not decode as GoalDecisionFrontmatter");
      expect(checkpointRed).not.toContain("outside GoalDecisionFrontmatter");
      expect(checkpointRed).toContain("allowed only on kind: decision");
      const checkpointRuling = yield* rejected(["operatorRuling:", "  finalPullRequest: 2080"], ["kind: checkpoint"]);
      expect(checkpointRuling).toContain("allowed only on kind: decision");

      const misspeltBlock = yield* rejected(["redAttributions:", "  finalPullRequest: 2966"]);
      expect(misspeltBlock).toContain("outside GoalDecisionFrontmatter: redAttributions");
      expect(misspeltBlock).toContain("redAttribution, operatorRuling");
      const misspeltNested = yield* rejected([
        "redAttribution:",
        "  finalPullRequest: 2966",
        "  reds:",
        '    - { context: "Heavy / Check", attribution: inherited, fixPR: 2994 }',
      ]);
      expect(misspeltNested).toContain("outside GoalDecisionFrontmatter: redAttribution.reds.0.fixPR");
      const misspeltRuling = yield* rejected(["operatorRuling:", "  final: 2080"]);
      expect(misspeltRuling).toContain("outside GoalDecisionFrontmatter: operatorRuling.final");

      const duplicate = yield* rejected([
        "redAttribution:",
        "  finalPullRequest: 2966",
        "  reds:",
        '    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2994 }',
        '    - { context: "Heavy / Check", attribution: mixed, fixPullRequest: 2995 }',
      ]);
      expect(duplicate).toContain("Each red context may be attributed only once per block");
      const fixIsFinal = yield* rejected([
        "redAttribution:",
        "  finalPullRequest: 2966",
        "  reds:",
        '    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2966 }',
      ]);
      expect(fixIsFinal).toContain("must differ from the block's finalPullRequest");
      for (const lines of [
        [
          "redAttribution:",
          "  finalPullRequest: 2966",
          "  reds:",
          '    - { context: "Heavy / Check", attribution: unknown, fixPullRequest: 2994 }',
        ],
        ["redAttribution:", "  finalPullRequest: 2966", "  reds: []"],
        [
          "redAttribution:",
          "  finalPullRequest: 0",
          "  reds:",
          '    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2994 }',
        ],
        [
          "redAttribution:",
          "  finalPullRequest: 2966",
          "  reds:",
          '    - { context: "", attribution: inherited, fixPullRequest: 2994 }',
        ],
        ["operatorRuling:", "  finalPullRequest: -3"],
      ]) {
        const message = yield* rejected(lines);
        expect(message).toContain("does not decode as GoalDecisionFrontmatter");
      }
    })
  );
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("goals decisions command", (it) => {
  it.effect("the manifest CLI checks an empty working tree without rewriting files", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory("goals");
      const rows = yield* collectManifestProjectionRows();
      expect(rows).toEqual([]);
      yield* runGoalsCommand(["manifest"]);
      const logs = yield* TestConsole.logLines;
      expect(A.some(A.filter(logs, P.isString), Str.includes("OK: every researchReports array matches"))).toBe(true);
    })
  );

  it.effect("add writes the file, projects SPEC.md and PLAN.md, and the doctor blocks on drift", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeProjectFile(
        "goals/demo/SPEC.md",
        "# Demo\n\n## Decision Log\n\n| Date | Decision | Reason | How to reverse |\n| --- | --- | --- | --- |\n| None | N/A | N/A | N/A |\n\n## Exception Ledger\n\nnone\n"
      );
      yield* writeProjectFile("goals/demo/PLAN.md", "# Demo Plan\n\n## Phases\n\nrows\n");
      yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `active`\n");
      yield* writeProjectFile("goals/demo/ops/manifest.json", "{}\n");

      // A packet without decisions is untouched: nothing applies, nothing drifts.
      yield* runGoalsCommand(["decisions", "check", "--slug", "demo"]);

      yield* runGoalsCommand([
        "decisions",
        "add",
        "demo",
        "--title",
        "Forward-only migration",
        "--reversal",
        "Move the entries back into the table.",
        "--body",
        "Legacy rows stay above the block.",
        "--lane",
        "feat/x",
        "--pr",
        "2700",
        "--date",
        "2026-11-05",
      ]);
      const file = yield* readProjectFile("goals/demo/decisions/2026-11-05-forward-only-migration.md");
      expect(file).toContain('title: "Forward-only migration"');
      expect(file).toContain("pullRequest: 2700");
      const spec = yield* readProjectFile("goals/demo/SPEC.md");
      expect(spec).toContain("| None | N/A | N/A | N/A |");
      expect(spec).toContain("### Forward-only migration, 2026-11-05");
      expect(spec).toContain("Legacy rows stay above the block.");
      const endAt = O.getOrThrow(Str.indexOf("<!-- beep:decisions:end -->")(spec));
      const ledgerAt = O.getOrThrow(Str.indexOf("## Exception Ledger")(spec));
      expect(endAt).toBeLessThan(ledgerAt);

      yield* runGoalsCommand([
        "decisions",
        "add",
        "demo",
        "--title",
        "Current checkpoint",
        "--reversal",
        "Delete the checkpoint file.",
        "--kind",
        "checkpoint",
        "--date",
        "2026-11-05",
      ]);
      const plan = yield* readProjectFile("goals/demo/PLAN.md");
      expect(plan).toContain("## Checkpoints");
      expect(plan).toContain("### Current checkpoint, 2026-11-05");
      const specAfterCheckpoint = yield* readProjectFile("goals/demo/SPEC.md");
      expect(specAfterCheckpoint).not.toContain("Current checkpoint");

      yield* runGoalsCommand(["decisions", "check", "--slug", "demo"]);

      // Hand-editing the generated block is drift: check fails, the doctor blocks, write repairs.
      yield* writeProjectFile(
        "goals/demo/SPEC.md",
        Str.replace("Legacy rows stay above the block.", "edited by hand")(spec)
      );
      const drifted = yield* Effect.exit(runGoalsCommand(["decisions", "check", "--slug", "demo"]));
      expectReportedExit(drifted);
      const reader = makeGoalPacketFilesystemReader();
      const record = GoalPacketRecord.make({
        slug: "demo",
        packetPath: "goals/demo",
        manifestPath: "goals/demo/ops/manifest.json",
        readmePath: "goals/demo/README.md",
        manifestText: "{}\n",
        readmeText: "# Demo\n\nLifecycle: `active`\n",
      });
      const findings = yield* goalPacketFindings(record, reader);
      expect(
        A.map(
          A.filter(findings.findings, (item) => item.kind === "decision-log-drift"),
          (item) => item.key
        )
      ).toEqual(["demo decision-log-drift SPEC.md"]);
      yield* runGoalsCommand(["decisions", "write", "--slug", "demo"]);
      yield* runGoalsCommand(["decisions", "check", "--slug", "demo"]);
      const repaired = yield* goalDecisionLogReport(record, reader);
      expect(A.every(repaired.projections, (projection) => !projection.drift)).toBe(true);

      // A misspelled frontmatter key is refused, never stripped: check fails and the report names it.
      yield* writeProjectFile(
        "goals/demo/decisions/2026-11-05-typo.md",
        "---\ntitle: Typo\ndate: 2026-11-05\nreversal: Revert.\npr: 1\n---\nbody\n"
      );
      const typo = yield* Effect.exit(runGoalsCommand(["decisions", "check", "--slug", "demo"]));
      expectReportedExit(typo);
      const withTypo = yield* goalDecisionLogReport(record, reader);
      expect(A.map(withTypo.invalid, (item) => item.file)).toEqual(["2026-11-05-typo.md"]);
      expect(withTypo.invalid[0]?.message).toContain("outside GoalDecisionFrontmatter: pr ");
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove("goals/demo/decisions/2026-11-05-typo.md");

      // An invalid file blocks the projection and the doctor.
      yield* writeProjectFile("goals/demo/decisions/scratch.md", "no frontmatter\n");
      const invalid = yield* Effect.exit(runGoalsCommand(["decisions", "write", "--slug", "demo"]));
      expectReportedExit(invalid);
      const withInvalid = yield* goalPacketFindings(record, reader);
      expect(A.some(withInvalid.findings, (item) => item.key === "demo decision-file-invalid scratch.md")).toBe(true);
    })
  );

  it.effect("add --final writes redAttribution and operatorRuling blocks that parse and project", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeProjectFile("goals/demo/SPEC.md", "# Demo\n\n## Decision log\n\nlegacy\n");
      yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `active`\n");
      yield* writeProjectFile("goals/demo/ops/manifest.json", "{}\n");
      yield* runGoalsCommand([
        "decisions",
        "add",
        "demo",
        "--title",
        "Final #2966 merged over two Heavy checks",
        "--reversal",
        "Delete this file; goals completion refresh reports #2966 unsatisfied again.",
        "--body",
        "Evidence: run URLs.",
        "--lane",
        "feat/goal-closeout-hosted-verification",
        "--final",
        "2966",
        "--attribute-red",
        "Heavy / Check=inherited#2994",
        "--attribute-red",
        "Heavy / Test Integration = introduced # 2995",
        "--operator-ruling",
        "--date",
        "2026-11-14",
      ]);
      const name = "2026-11-14-final-2966-merged-over-two-heavy-checks.md";
      const text = yield* readProjectFile(`goals/demo/decisions/${name}`);
      expect(text).toContain(
        A.join(
          [
            "redAttribution:",
            "  finalPullRequest: 2966",
            "  reds:",
            '    - { context: "Heavy / Check", attribution: inherited, fixPullRequest: 2994 }',
            '    - { context: "Heavy / Test Integration", attribution: introduced, fixPullRequest: 2995 }',
            "operatorRuling:",
            "  finalPullRequest: 2966",
            "---",
          ],
          "\n"
        )
      );
      const parsed = yield* parseGoalDecision(name, text);
      parsed.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(parsed)) {
        expect(parsed.success.frontmatter.redAttribution).toEqual(
          GoalRedAttributionBlock.make({
            finalPullRequest: 2966,
            reds: [
              { context: "Heavy / Check", attribution: "inherited", fixPullRequest: 2994 },
              { context: "Heavy / Test Integration", attribution: "introduced", fixPullRequest: 2995 },
            ],
          })
        );
        expect(parsed.success.frontmatter.operatorRuling).toEqual(GoalOperatorRuling.make({ finalPullRequest: 2966 }));
      }
      const spec = yield* readProjectFile("goals/demo/SPEC.md");
      expect(spec).toContain(
        "Attributed reds for #2966: Heavy / Check (inherited, fix #2994); Heavy / Test Integration (introduced, fix #2995)"
      );
      expect(spec).toContain("Operator ruling closes #2966");

      // The context runs to the last "=", so it may itself carry "=" and "#"; a ruling may stand alone.
      yield* runGoalsCommand([
        "decisions",
        "add",
        "demo",
        "--title",
        "Shard red",
        "--reversal",
        "Delete this file.",
        "--final",
        "3001",
        "--attribute-red",
        "Shard=a #1=mixed#3002",
        "--date",
        "2026-11-14",
      ]);
      const shard = yield* readProjectFile("goals/demo/decisions/2026-11-14-shard-red.md");
      expect(shard).toContain('    - { context: "Shard=a #1", attribution: mixed, fixPullRequest: 3002 }');
      expect(shard).not.toContain("operatorRuling");
      yield* runGoalsCommand([
        "decisions",
        "add",
        "demo",
        "--title",
        "Operator closes #2080",
        "--reversal",
        "Delete this file.",
        "--final",
        "2080",
        "--operator-ruling",
        "--date",
        "2026-11-14",
      ]);
      const closes = yield* readProjectFile("goals/demo/decisions/2026-11-14-operator-closes-2080.md");
      expect(closes).toContain("operatorRuling:\n  finalPullRequest: 2080\n---");
      expect(closes).not.toContain("redAttribution");
      yield* runGoalsCommand(["decisions", "check", "--slug", "demo"]);
    })
  );

  it.effect("add refuses malformed completion claims before writing anything", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeProjectFile("goals/demo/SPEC.md", "# Demo\n\n## Decision log\n\nlegacy\n");
      yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `active`\n");
      const services = yield* Layer.build(GoalDecisionLogLive);
      const log = Context.get(services, GoalDecisionLog);
      const refused = Effect.fnUntraced(function* (
        claims: Partial<Pick<GoalDecisionAddInput, "final" | "attributeRed" | "operatorRuling" | "kind">>
      ) {
        const error = yield* runGoalsDecisionsAdd(
          GoalDecisionAddInput.make({
            slug: "demo",
            title: "Claims",
            reversal: "Delete this file.",
            body: O.none(),
            kind: O.none(),
            lane: O.none(),
            pullRequest: O.none(),
            date: O.some("2026-11-14"),
            topic: O.none(),
            ...claims,
          })
        ).pipe(Effect.provideService(GoalDecisionLog, log), Effect.flip);
        return P.hasProperty(error, "message") ? String(error.message) : String(error);
      });
      const final = O.some("2966");
      const malformed = 'is not "<context>=<cause>#<fix PR>"';
      const cases: ReadonlyArray<readonly [Parameters<typeof refused>[0], string]> = [
        [{ attributeRed: ["Heavy / Check=inherited#2994"] }, "need --final <n>"],
        [{ operatorRuling: true }, "need --final <n>"],
        [{ final }, "--final needs --attribute-red or --operator-ruling"],
        [{ final: O.some("abc"), operatorRuling: true }, '--final "abc" is not a positive integer'],
        [{ final, attributeRed: ["Heavy / Check"] }, malformed],
        [{ final, attributeRed: ["=inherited#2994"] }, malformed],
        [{ final, attributeRed: ["Heavy / Check=inherited#0"] }, malformed],
        [
          { final, attributeRed: ["Heavy / Check=unknown#2994"] },
          'cause "unknown" must be one of: inherited, introduced, mixed',
        ],
        [{ final, attributeRed: ["Heavy / Check=inherited#2966"] }, "must differ from the block's finalPullRequest"],
        [
          { final, attributeRed: ["Heavy / Check=inherited#2994", "Heavy / Check=mixed#2995"] },
          "Each red context may be attributed only once per block",
        ],
        [{ final, operatorRuling: true, kind: O.some("checkpoint") }, "only a kind: decision file may carry"],
      ];
      for (const [claims, expected] of cases) {
        const message = yield* refused(claims);
        expect(message).toContain(expected);
      }
      const fs = yield* FileSystem.FileSystem;
      const wrote = yield* fs.exists("goals/demo/decisions");
      expect(wrote).toBe(false);
      // The command line routes the same refusal.
      const exit = yield* Effect.exit(
        runGoalsCommand([
          "decisions",
          "add",
          "demo",
          "--title",
          "Claims",
          "--reversal",
          "Delete this file.",
          "--attribute-red",
          "Heavy / Check=inherited#2994",
          "--date",
          "2026-11-14",
        ])
      );
      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("rejects bad inputs, reports JSON, and refuses a packet with an unbalanced marker pair", () =>
    Effect.gen(function* () {
      yield* temporaryWorkingDirectory;
      yield* writeProjectFile("goals/demo/SPEC.md", "# Demo\n\n## Decision log\n\nlegacy\n");
      yield* writeProjectFile("goals/demo/README.md", "# Demo\n\nLifecycle: `active`\n");
      const expectFails = Effect.fnUntraced(function* <A, E, R>(effect: Effect.Effect<A, E, R>) {
        const exit = yield* Effect.exit(effect);
        exit.pipe(Exit.isFailure, assertTrue);
      });
      const add = (...args: ReadonlyArray<string>) =>
        expectFails(runGoalsCommand(["decisions", "add", ...args, "--date", "2026-11-05"]));
      const base = ["--title", "Valid title", "--reversal", "Revert."] as const;
      yield* add("Bad_Slug", ...base);
      yield* add("missing", ...base);
      yield* add("demo", ...base, "--kind", "bogus");
      yield* add("demo", ...base, "--topic", "!!!");
      yield* add("demo", ...base, "--pr", "abc");
      yield* add("demo", "--title", "   ", "--reversal", "Revert.");
      yield* add("demo", "--title", "Valid title", "--reversal", "   ");
      yield* expectFails(runGoalsCommand(["decisions", "check", "--slug", "Bad_Slug"]));
      yield* expectFails(runGoalsCommand(["decisions", "check", "--slug", "missing"]));

      yield* runGoalsCommand(["decisions", "check", "--json"]);

      // A lone marker makes the document ambiguous: the add writes the file but refuses to project.
      yield* writeProjectFile("goals/demo/SPEC.md", "# Demo\n\n## Decision log\n\n<!-- beep:decisions:begin -->\n");
      yield* add("demo", ...base);
      yield* expectFails(runGoalsCommand(["decisions", "check", "--slug", "demo"]));
      const report = yield* goalDecisionLogReport(
        GoalPacketRecord.make({
          slug: "demo",
          packetPath: "goals/demo",
          manifestPath: "goals/demo/ops/manifest.json",
          readmePath: "goals/demo/README.md",
        }),
        makeGoalPacketFilesystemReader()
      );
      expect(A.map(report.invalid, (item) => item.file)).toEqual(["SPEC.md"]);
    })
  );
});
