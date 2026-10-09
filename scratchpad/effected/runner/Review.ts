/**
 * The S4 review loop of goal section 12: the reviewer brief, the two external
 * read-only seats (Grok 4.7 and GPT-6.1-Sol), and the scope guard that keeps
 * reviewers from editing.
 *
 * **Details**
 *
 * The Fable seat runs inside the orchestrating session (a Workflow agent), so
 * this module only writes its brief; the two CLI seats run here, in parallel,
 * on the same commit. Grok runs with a read-only tool allowlist and write/edit
 * deny rules (its read-only sandbox profile cannot start on this host), Sol in
 * Codex's read-only sandbox, and their reports land in
 * `scratchpad/effected/<m>/.review/round-N/`.
 *
 * **Gotchas**
 *
 * Grok exits 1 with a report of narration only when it spends its
 * `--max-turns` budget before writing findings (`grok usage <session>` then
 * shows `modelCalls` equal to the cap). That is a launch limit, not a quota
 * failure: resume the session (`grok --resume <id>`) and ask for the report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import type { ModuleName } from "./Ledger.schema.ts";
import { labPaths, type RunnerConfig } from "./Paths.ts";
import { capture, captureExit, type Launch } from "./Process.ts";

/**
 * Where one round's evidence lives, repo-relative.
 *
 * **Example** (Locate round 2 of yaml)
 *
 * ```ts
 * import { roundDir } from "@beep/scratchpad/effected/runner/Review"
 *
 * console.log(roundDir("yaml", 2)) // "scratchpad/effected/yaml/.review/round-2"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const roundDir: {
  (round: number): (module: ModuleName) => string;
  (module: ModuleName, round: number): string;
} = dual(2, (module: ModuleName, round: number): string => `${labPaths(module).sourceDir}/.review/round-${round}`);

/**
 * The law surfaces every seat reviews against (goal section 3.3).
 *
 * **Example** (Count the law surfaces)
 *
 * ```ts
 * import { LAW_SURFACES } from "@beep/scratchpad/effected/runner/Review"
 *
 * console.log(LAW_SURFACES.includes(".patterns/jsdoc-documentation.md")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LAW_SURFACES = [
  "AGENTS.md",
  "standards/ARCHITECTURE.md",
  "standards/effect-laws-v1.md",
  "standards/effect-first-development.md",
  "standards/schema-first-development-prompt.md",
  ".patterns/jsdoc-documentation.md",
  ".patterns/error-handling.md",
  ".patterns/module-organization.md",
  ".patterns/testing-patterns.md",
  "goals/effect-vitest-canon/SPEC.md",
  "packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts",
  "~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md",
  "~/YeeBois/references/effect/effect-tsgo/docs/rules/",
] as const;

/**
 * The subject of one review round.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface RoundSubject {
  readonly round: number;
  readonly commit: string;
  readonly oracle: string;
  /** The module's ledger stage; below 3, S2 (JSDoc) and S3 (coverage, vitest canon) have not run. */
  readonly stage?: number;
  /** Files to review in depth when a large module is split across several briefs. */
  readonly focus?: ReadonlyArray<string>;
}

/**
 * The section 12.3 reviewer brief for one module, round and commit.
 *
 * **Example** (Render a brief)
 *
 * ```ts
 * import { reviewBrief } from "@beep/scratchpad/effected/runner/Review"
 *
 * const brief = reviewBrief("jsonl", { round: 1, commit: "abc123", oracle: "/up" })
 * console.log(brief.includes("Module: jsonl. Commit: abc123. Round: 1.")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const reviewBrief: {
  (subject: RoundSubject): (module: ModuleName) => string;
  (module: ModuleName, subject: RoundSubject): string;
} = dual(2, (module: ModuleName, subject: RoundSubject): string => {
  const previous =
    subject.round > 1
      ? `${roundDir(module, subject.round - 1)}/INVENTORY.md (do not repeat closed items)`
      : "none (first round)";
  return `${A.join(
    [
      `You are a read-only reviewer. Module: ${module}. Commit: ${subject.commit}. Round: ${subject.round}.`,
      `Surface: ${A.join([`scratchpad/effected/${module}/**`, `scratchpad/test/${module}/**`, ...labPaths(module).extraTests], ", ")} (and nothing else).`,
      `Upstream oracle: ${subject.oracle}/packages/${module} (read-only; upstream at the commit the ledger pins).`,
      "The live checkout ~/YeeBois/references/effect/effected may have moved past that commit: compare against the",
      "oracle path only. Its node_modules links effect, @effect and every @effected package, so a read-only probe",
      "can import upstream source from it.",
      `Law surfaces: ${A.join(LAW_SURFACES, ", ")}.`,
      "Decisions D1-D20 in scratchpad/EFFECTED_PORT_GOAL.md bind you; D9 (behaviour-preserving), D11 (what is",
      "required), D15 (no unsafe assertions) and section 14 (deviation protocol) decide severity.",
      `Previous rounds: ${previous}.`,
      "Port notes: scratchpad/effected/<module>/README.md (Port notes) and scratchpad/effected/PORT_LEDGER.json",
      "record accepted deviations and backlog; do not re-raise a recorded deviation without new evidence.",
      ...((subject.stage ?? 5) >= 3
        ? [
            "The gates are already green on this commit (tsgo with every Effect rule at error, oxlint, the four",
            "beep laws, vitest with 100 percent coverage from S3, docgen); do not report what a gate already enforces",
            "unless you can show the gate missed it.",
          ]
        : [
            "The gates are already green on this commit (tsgo with every Effect rule at error, oxlint, the four",
            "beep laws, the upstream tests); do not report what a gate already enforces unless you can show the gate",
            "missed it. S2 (JSDoc conversion) and S3 (coverage, vitest canon, property floor) have not run yet, by",
            "operator order: report docs, JSDoc, coverage and test-canon findings as backlog only, never required.",
          ]),
      ...(subject.focus === undefined || subject.focus.length === 0
        ? []
        : [
            "Focus: this brief is one part of a large module. Review these files in depth and read the rest of",
            `the module only as context: ${A.join(subject.focus, ", ")}.`,
          ]),
      "",
      "Report findings only. Do not edit any file. Do not run commands that write.",
      "For each finding give: id, file:line, class (law|bug|type-safety|tsgo|jsdoc|schema|effect-idiom|perf|test|docs),",
      "severity (required|backlog) under D11, the standard or evidence you cite, the observable failure,",
      "and the smallest fix. Mark perf findings required only with a measurement or an algorithmic-class argument.",
      "Use this record shape for every finding:",
      "",
      "### <seat>-<round>-<n>",
      "- file: scratchpad/effected/<m>/<file>.ts:<line>",
      "- class: <class>   severity: required|backlog",
      "- standard: <doc or rule id>   evidence: <command/output or reasoning>",
      "- failure: <what breaks or diverges>",
      "- fix: <smallest change>",
      "",
      "End with a line `REQUIRED: <n>` and a line `BACKLOG: <n>`. If both are zero, say `NO FINDINGS`.",
    ],
    "\n"
  )}\n`;
});

/**
 * Writes `BRIEF.md` for a round on the current HEAD and returns the round
 * directory and commit.
 *
 * **Example** (Write a brief)
 *
 * ```ts
 * import { writeBrief } from "@beep/scratchpad/effected/runner/Review"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(writeBrief(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "jsonl", 1, 3))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const writeBrief = Effect.fn("Review.writeBrief")(function* (
  config: RunnerConfig,
  module: ModuleName,
  round: number,
  stage: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commit = yield* capture({ command: "git", args: ["rev-parse", "HEAD"], cwd: config.repoRoot });
  const directory = roundDir(module, round);
  yield* fs.makeDirectory(path.join(config.repoRoot, directory), { recursive: true });
  yield* fs.writeFileString(
    path.join(config.repoRoot, directory, "BRIEF.md"),
    reviewBrief(module, { round, commit, oracle: config.upstreamRoot, stage })
  );
  return { directory, commit, brief: `${directory}/BRIEF.md` };
});

/**
 * The two CLI seat launches of section 12.2 for a brief, reading the brief
 * from disk and writing each report next to it.
 *
 * **Example** (Plan the CLI seats)
 *
 * ```ts
 * import { seatLaunches } from "@beep/scratchpad/effected/runner/Review"
 *
 * const seats = seatLaunches("/repo", "scratchpad/effected/jsonl/.review/round-1")
 * console.log(seats.map((seat) => seat.seat)) // ["grok", "sol"]
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const seatLaunches: {
  (directory: string): (repoRoot: string) => ReadonlyArray<{ readonly seat: "grok" | "sol"; readonly launch: Launch }>;
  (repoRoot: string, directory: string): ReadonlyArray<{ readonly seat: "grok" | "sol"; readonly launch: Launch }>;
} = dual(2, (repoRoot: string, directory: string) => [
  {
    seat: "grok" as const,
    launch: {
      command: "bash",
      args: [
        "-c",
        `grok -m grok-4.7 --reasoning-effort xhigh --tools "read_file,grep,list_dir" --deny "Write(**)" --deny "Edit(**)" --always-approve --prompt-file "${directory}/BRIEF.md" --output-format plain --max-turns 200 > "${directory}/grok.md"`,
      ],
      cwd: repoRoot,
    },
  },
  {
    seat: "sol" as const,
    launch: {
      command: "bash",
      args: [
        "-c",
        `"$HOME/.local/bin/codex" exec --model gpt-6.1-sol -c 'model_reasoning_effort="high"' -s read-only --skip-git-repo-check --ephemeral --cd "${repoRoot}" -o "${directory}/sol.md" "$(cat "${directory}/BRIEF.md")" </dev/null > "${directory}/sol.log" 2>&1`,
      ],
      cwd: repoRoot,
    },
  },
]);

const REVIEW_EVIDENCE = /^scratchpad\/effected\/[^/]+\/\.review\//;
const PORCELAIN_LINE = /^[ MADRCUT?!]{1,2} (?:.* -> )?(.+)$/;

/**
 * Working-tree paths changed outside every round's evidence directory, from
 * `git status --porcelain` output.
 *
 * **Details**
 *
 * The status letters are matched instead of sliced by column, so output whose
 * first line lost its leading space to trimming still parses, and a rename
 * reports its new path. Evidence of any module's round is exempt because two
 * modules may be in review at once.
 *
 * **Example** (Find a reviewer edit)
 *
 * ```ts
 * import { outOfScopeChanges } from "@beep/scratchpad/effected/runner/Review"
 *
 * const status = "M scratchpad/effected/jsonl/Line.ts\n?? scratchpad/effected/jsonc/.review/round-2/grok.md\n"
 * console.log(outOfScopeChanges(status)) // ["scratchpad/effected/jsonl/Line.ts"]
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const outOfScopeChanges = (porcelain: string): ReadonlyArray<string> =>
  A.filter(
    A.flatMap(Str.split("\n")(porcelain), (line) => {
      const match = PORCELAIN_LINE.exec(line);
      return match === null ? [] : [Str.trim(match[1] ?? "")];
    }),
    (file) => file.length > 0 && !REVIEW_EVIDENCE.test(file)
  );

/**
 * Runs the Grok and Sol seats in parallel on the brief of a round, then
 * reports any working-tree change outside the review evidence directories
 * (reviewers never edit; the caller reverts and files a receipt).
 *
 * **Example** (Run the CLI seats)
 *
 * ```ts
 * import { runCliSeats } from "@beep/scratchpad/effected/runner/Review"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runCliSeats(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up", upstreamCheckout: "/up", home: "/home/me" }), "jsonl", 1))) // true
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const runCliSeats = Effect.fn("Review.runCliSeats")(function* (
  config: RunnerConfig,
  module: ModuleName,
  round: number
) {
  const directory = roundDir(module, round);
  const before = yield* capture({ command: "git", args: ["status", "--porcelain"], cwd: config.repoRoot });
  const results = yield* Effect.forEach(
    seatLaunches(config.repoRoot, directory),
    (seat) =>
      Effect.map(captureExit(seat.launch), (result) => ({ seat: seat.seat, exitCode: result.exitCode, output: result.output })),
    { concurrency: "unbounded" }
  );
  const after = yield* capture({ command: "git", args: ["status", "--porcelain"], cwd: config.repoRoot });
  const preexisting = outOfScopeChanges(before);
  const edits = A.filter(outOfScopeChanges(after), (file) => !A.contains(preexisting, file));
  const lab = labPaths(module);
  const surface = [`${lab.sourceDir}/`, `${lab.testDir}/`, ...lab.extraTests];
  for (const result of results) {
    yield* Console.log(`[effected] ${module} review round ${round}: seat ${result.seat} exited ${result.exitCode}`);
  }
  for (const file of edits) {
    const label = A.some(surface, (prefix) => Str.startsWith(prefix)(file))
      ? "OUT-OF-SCOPE CHANGE"
      : "CHANGE OUTSIDE THE REVIEWED MODULE (another lane, or a reviewer)";
    yield* Console.log(`[effected] ${module} review round ${round}: ${label} ${file}`);
  }
  return { directory, results, edits };
});
