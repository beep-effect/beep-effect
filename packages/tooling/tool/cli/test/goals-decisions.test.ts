import {
  GOAL_DECISION_TARGETS,
  GoalDecision,
  GoalPacketRecord,
  goalDecisionLogReport,
  goalPacketFindings,
  goalsCommand,
  makeGoalPacketFilesystemReader,
  parseGoalDecision,
  renderGoalDecisionBlock,
  spliceGoalDecisionBlock,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import {
  expectReportedExit,
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
      expect(block).toContain("Lane `feat/x` · PR #42");
      expect(block).toContain("Reverse: Undo Later.");
      assertTrue(Str.startsWith("<!-- beep:decisions:begin -->")(block));
      assertTrue(Str.endsWith("<!-- beep:decisions:end -->")(block));
      expect(renderGoalDecisionBlock("demo", SPEC_TARGET, [])).toContain("_No decision files yet._");
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
      const ok = yield* parseGoalDecision("2026-11-05-forward-only-migration.md", VALID_FILE);
      ok.pipe(Result.isSuccess, assertTrue);
      if (Result.isSuccess(ok)) {
        expect(ok.success.frontmatter.kind).toBe("decision");
        expect(ok.success.frontmatter.pullRequest).toBe(2700);
        expect(ok.success.body).toBe("Existing Decision Log bodies stay frozen above the generated block.");
      }
    })
  );
});

it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })(
  "goals decisions command",
  (it) => {
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

        // An invalid file blocks the projection and the doctor.
        yield* writeProjectFile("goals/demo/decisions/scratch.md", "no frontmatter\n");
        const invalid = yield* Effect.exit(runGoalsCommand(["decisions", "write", "--slug", "demo"]));
        expectReportedExit(invalid);
        const withInvalid = yield* goalPacketFindings(record, reader);
        expect(A.some(withInvalid.findings, (item) => item.key === "demo decision-file-invalid scratch.md")).toBe(true);
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
  }
);
