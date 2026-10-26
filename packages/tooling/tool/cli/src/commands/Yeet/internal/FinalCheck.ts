/**
 * `yeet final-check`: replay, scoped to the diff, every hosted gate that the
 * push-first cheap tier skips, before a lane may call its pull request final.
 *
 * **Details**
 *
 * Push-first publish proves only the cheap tier locally and leaves the rest to
 * hosted CI. On 2026-10-23/24 that let lanes call PRs final that then redded
 * `main` on gates only hosted CI ran: a GritQL law (#2187), a deprecated
 * TypeScript API (#2189), root docs oxlint (#2186), schema-first and the
 * schema catalog (#2207), Fallow health (#2215), a dropped `Crypto`
 * requirement (#2208), Effect diagnostics (#2197, #2221), and a test rewritten
 * to match broken output (#2215). Each gate below replays the hosted body
 * through the same command hosted CI runs (`beep ci lane <id>` via
 * {@link ciLaneDispatchStep}, the single argv source `beep ci local` shares),
 * narrowed to the merge base with Turbo's `--affected`, or a repo-wide sweep
 * where that sweep is cheap (root docs oxlint ~10 s, deprecated APIs ~1 min).
 * Steps run one at a time and every lane body carries its own Turbo
 * concurrency cap (2-4), so the whole run fits a 4-core worker.
 *
 * The run writes a head-pinned receipt under `.beep/yeet/final-check/`.
 * `yeet ready` refuses to flip a draft whose head has no complete passing
 * receipt. A gate that cannot run locally is skipped only with a recorded
 * reason (`--skip <gate>=<reason>`), which the receipt and the flip both show.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { QualityTaskStep, runToExit } from "../../../internal/process/index.ts";
import { CiLocalStepPlan, ciLaneDispatchStep } from "../../Ci/CiLane.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { collectExpectationRewrites, verifyExpectationRewrites } from "./ExpectationRewrite.ts";
import {
  FinalCheckGate,
  FinalCheckPlannedStep,
  FinalCheckReceipt,
  FinalCheckSkip,
  FinalCheckStepResult,
} from "./FinalCheck.schemas.ts";
import { runGitOutput, runGitPathList } from "./GitExec.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CiLaneId } from "../../Ci/CiLane.ts";
import type { ExpectationRewriteVerdict, YeetFinalCheckOptions } from "./FinalCheck.schemas.ts";

/**
 * The command a lane runs to produce a final-check receipt.
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_FINAL_CHECK_COMMAND = "bun run beep yeet final-check";

/**
 * Repo-relative directory holding head-pinned final-check receipts.
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_RECEIPT_DIR = ".beep/yeet/final-check";

const EXPECTATION_REWRITE_CONTEXT = "Test Unit (expectations edited to match new output)";

/**
 * Plan the subprocess steps for every subprocess-backed final-check gate.
 *
 * **Details**
 *
 * `expectation-rewrite` is evaluated in process and has no step here. Hosted
 * lanes dispatch through {@link ciLaneDispatchStep} with the pull-request
 * `--affected --base <merge-base>` shape, so the argv cannot drift from what
 * `beep ci local` and hosted CI run. Lint Policy keeps its affected law tasks
 * (`beep lint policy --base`) and adds the two repo-wide sweeps that the
 * affected local scope omits but the hosted `--full` lane runs: root docs
 * oxlint and the deprecated-API oxlint sweep. Lint adds the pre-commit Biome
 * pass over the diff's changed files, because package `lint` tasks never see
 * paths outside a workspace package (#2187 landed an EF-40 GritQL violation in
 * `goals/` that no hosted lane flagged and lefthook then rejected on every
 * later commit staging the file). Coverage runs the per-file
 * ratchet (`beep-cli coverage --affected`), which also runs the affected
 * packages' unit tests.
 *
 * **Example** (Plan the final-check steps)
 *
 * ```ts
 * import { planFinalCheckSteps } from "@beep/repo-cli/test/Yeet"
 *
 * const steps = planFinalCheckSteps("/repo", "abc123", ["goals/x/ops/check.ts"])
 * console.log(steps.map((step) => step.gate).includes("check")) // true
 * ```
 *
 * @param repoRoot - Checkout root used as every subprocess working directory.
 * @param mergeBase - Merge base of the branch with its base ref.
 * @param changedFiles - Files the diff adds or modifies, repo-relative.
 * @returns Planned steps in gate order.
 * @category planning
 * @since 0.0.0
 */
export const planFinalCheckSteps: {
  (repoRoot: string, mergeBase: string, changedFiles: ReadonlyArray<string>): ReadonlyArray<FinalCheckPlannedStep>;
  (mergeBase: string, changedFiles: ReadonlyArray<string>): (repoRoot: string) => ReadonlyArray<FinalCheckPlannedStep>;
} = dual(
  3,
  (repoRoot: string, mergeBase: string, changedFiles: ReadonlyArray<string>): ReadonlyArray<FinalCheckPlannedStep> => {
    const plan = CiLocalStepPlan.make({ affected: true, base: mergeBase, onMainBranch: false });
    const lane = (gate: FinalCheckGate, hostedContext: string, laneId: CiLaneId) =>
      FinalCheckPlannedStep.make({
        gate,
        hostedContext,
        step: ciLaneDispatchStep(repoRoot, `final-check:${gate}`, laneId, plan),
      });
    const command = (
      gate: FinalCheckGate,
      hostedContext: string,
      label: string,
      argv: readonly [string, ...Array<string>],
      env: Record<string, string> = {}
    ) =>
      FinalCheckPlannedStep.make({
        gate,
        hostedContext,
        step: QualityTaskStep.make({
          label: `final-check:${label}`,
          command: argv[0],
          args: A.drop(argv, 1),
          cwd: repoRoot,
          env,
        }),
      });
    return [
      command(
        "cheap-gates",
        "Repo Sanity, JSDoc Ratchet, Lint Policy (cheap tier: catalogs, schema-first, oxlint)",
        "cheap-gates",
        ["bun", "run", "beep", "quality", "github-checks", "cheap-gates"]
      ),
      command("lint-policy", "Heavy / Lint Policy (affected law tasks)", "lint-policy:laws", [
        "bun",
        "run",
        "beep",
        "lint",
        "policy",
        "--base",
        mergeBase,
      ]),
      command("lint-policy", "Heavy / Lint Policy (root docs oxlint)", "lint-policy:docs", [
        "bunx",
        "oxlint",
        ".",
        "--config",
        ".oxlintrc.docs.json",
        "--max-warnings=0",
      ]),
      command("lint-policy", "Heavy / Lint Policy (deprecated APIs)", "lint-policy:deprecated-apis", [
        "bun",
        "run",
        "beep",
        "lint",
        "deprecated-apis",
        "--full",
      ]),
      lane("lint", "Lint (package Biome, GritQL laws)", "lint"),
      ...(A.isReadonlyArrayEmpty(changedFiles)
        ? []
        : [
            command(
              "lint",
              "pre-commit Biome over the diff's files (goals/, scripts/ and other non-package paths)",
              "lint:changed-files",
              ["bunx", "biome", "check", "--files-ignore-unknown=true", "--no-errors-on-unmatched", ...changedFiles]
            ),
          ]),
      lane("repo-sanity", "Repo Sanity", "repo-sanity"),
      lane("effect-diagnostics", "Heavy / Effect Diagnostics", "effect-diagnostics"),
      lane("check", "Heavy / Check", "check"),
      lane("docgen", "Heavy / Docgen", "docgen"),
      lane("fallow", "Fallow Advisory Envelopes", "fallow"),
      command(
        "coverage",
        "Heavy / Coverage Regression, Test Unit (affected packages)",
        "coverage",
        ["bun", "run", "coverage", "--affected"],
        { TURBO_SCM_BASE: mergeBase }
      ),
    ];
  }
);

const renderCommand = (step: QualityTaskStep): string =>
  A.join(
    [
      ...(step.env?.TURBO_SCM_BASE === undefined ? [] : [`TURBO_SCM_BASE=${step.env.TURBO_SCM_BASE}`]),
      step.command,
      ...step.args,
    ],
    " "
  );

const isFinalCheckGate = S.is(FinalCheckGate);

/**
 * Parse `--gates` values into a gate selection; empty means every gate.
 *
 * **Example** (Select two gates)
 *
 * ```ts
 * import { parseFinalCheckGates } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(parseFinalCheckGates(["check,docgen"]))) // true
 * ```
 *
 * @param values - Raw `--gates` values, comma separated or repeated.
 * @returns The selected gates in run order.
 * @category parsers
 * @since 0.0.0
 */
export const parseFinalCheckGates = Effect.fn("Yeet.parseFinalCheckGates")(function* (values: ReadonlyArray<string>) {
  const entries = pipe(values, A.flatMap(Str.split(",")), A.map(Str.trim), A.filter(Str.isNonEmpty));
  const unknown = A.filter(entries, (entry) => !isFinalCheckGate(entry));
  if (A.isReadonlyArrayNonEmpty(unknown)) {
    return yield* YeetCommandError.make({
      message: `Unknown final-check gate(s): ${A.join(unknown, ", ")}. Valid gates: ${A.join(FinalCheckGate.literals, ", ")}.`,
      exitCode: 2,
    });
  }
  return A.isReadonlyArrayEmpty(entries)
    ? FinalCheckGate.literals
    : A.filter(FinalCheckGate.literals, (gate) => A.contains(entries, gate));
});

/**
 * Parse `--skip <gate>=<reason>` values.
 *
 * **Example** (Skip coverage with a reason)
 *
 * ```ts
 * import { parseFinalCheckSkips } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(parseFinalCheckSkips(["coverage=admission waited 10 minutes"]))) // true
 * ```
 *
 * @param values - Raw `--skip` values.
 * @returns The recorded skips.
 * @category parsers
 * @since 0.0.0
 */
export const parseFinalCheckSkips = Effect.fn("Yeet.parseFinalCheckSkips")(function* (values: ReadonlyArray<string>) {
  return yield* Effect.forEach(values, (value) => {
    const separator = Str.indexOf("=")(value);
    const gate = O.match(separator, { onNone: () => value, onSome: (index) => Str.trim(Str.slice(0, index)(value)) });
    const reason = O.match(separator, { onNone: () => "", onSome: (index) => Str.trim(Str.slice(index + 1)(value)) });
    return isFinalCheckGate(gate) && Str.isNonEmpty(reason)
      ? Effect.succeed(FinalCheckSkip.make({ gate, reason }))
      : Effect.fail(
          YeetCommandError.make({
            message: `--skip must be "<gate>=<reason>" with a known gate and a non-empty reason; got "${value}". Valid gates: ${A.join(FinalCheckGate.literals, ", ")}.`,
            exitCode: 2,
          })
        );
  });
});

/**
 * Decide whether a receipt admits the draft-to-ready flip of a head.
 *
 * **Details**
 *
 * Returns the refusal detail, or none when the receipt is for this exact head,
 * complete (every gate ran or was skipped with a reason), and passing.
 *
 * **Example** (Refuse a missing receipt)
 *
 * ```ts
 * import { finalCheckRefusal } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(finalCheckRefusal(O.none(), "abc"))) // true
 * ```
 *
 * @param receipt - The receipt read for the head, if any.
 * @param headSha - Head the flip would mark ready.
 * @returns The refusal detail when the flip must wait.
 * @category policies
 * @since 0.0.0
 */
export const finalCheckRefusal: {
  (receipt: O.Option<FinalCheckReceipt>, headSha: string): O.Option<string>;
  (headSha: string): (receipt: O.Option<FinalCheckReceipt>) => O.Option<string>;
} = dual(
  2,
  (receipt: O.Option<FinalCheckReceipt>, headSha: string): O.Option<string> =>
    O.match(receipt, {
      onNone: () =>
        O.some(
          `no final-check receipt for head ${Str.slice(0, 12)(headSha)}; run \`${YEET_FINAL_CHECK_COMMAND}\` on the committed head`
        ),
      onSome: (found) =>
        found.headSha !== headSha
          ? O.some(
              `the final-check receipt is for ${Str.slice(0, 12)(found.headSha)}, not head ${Str.slice(0, 12)(headSha)}`
            )
          : !found.complete
            ? O.some(
                "the final-check receipt covers a --gates subset; run every gate (skip one only with --skip <gate>=<reason>)"
              )
            : found.verdict !== "pass"
              ? O.some(
                  `final-check failed on ${A.join(
                    A.dedupe(
                      A.map(
                        A.filter(found.steps, (step) => step.status === "failed"),
                        (step) => step.gate
                      )
                    ),
                    ", "
                  )}; fix the reds and re-run \`${YEET_FINAL_CHECK_COMMAND}\``
                )
              : O.none(),
    })
);

const receiptPath = Effect.fnUntraced(function* (repoRoot: string, headSha: string) {
  const path = yield* Path.Path;
  return path.join(repoRoot, FINAL_CHECK_RECEIPT_DIR, `${headSha}.json`);
});

const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));
const encodeReceipt = S.encodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));

/**
 * Read the final-check receipt recorded for a head, if one exists and decodes.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readFinalCheckReceipt } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readFinalCheckReceipt("/repo", "abc"))) // true
 * ```
 *
 * @param repoRoot - Checkout holding `.beep/yeet/final-check/`.
 * @param headSha - Head whose receipt is read.
 * @returns The receipt, or none when absent or malformed.
 * @category io
 * @since 0.0.0
 */
export const readFinalCheckReceipt = Effect.fn("Yeet.readFinalCheckReceipt")(function* (
  repoRoot: string,
  headSha: string
): Effect.fn.Return<O.Option<FinalCheckReceipt>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* receiptPath(repoRoot, headSha);
  return yield* fs
    .readFileString(file)
    .pipe(Effect.flatMap(decodeReceipt), Effect.asSome, Effect.orElseSucceed(O.none<FinalCheckReceipt>));
});

const writeReceipt = Effect.fn("Yeet.writeFinalCheckReceipt")(
  function* (repoRoot: string, receipt: FinalCheckReceipt) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = yield* receiptPath(repoRoot, receipt.headSha);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, `${yield* encodeReceipt(receipt)}\n`);
    return file;
  },
  Effect.mapError(YeetCommandError.new("Failed to write the final-check receipt."))
);

const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

const runStep = Effect.fn("Yeet.runFinalCheckStep")(function* (planned: FinalCheckPlannedStep) {
  const command = renderCommand(planned.step);
  yield* Console.log(`[yeet] final-check ${planned.gate}: ${command}`);
  const started = yield* Clock.currentTimeMillis;
  const exitCode = yield* runToExit({
    command: planned.step.command,
    args: planned.step.args,
    cwd: planned.step.cwd,
    stdio: "inherit",
    env: planned.step.env,
    extendEnv: true,
  }).pipe(
    Effect.catch((cause) =>
      Console.error(`[yeet] final-check ${planned.gate}: could not start ${command}: ${cause.message}`).pipe(
        Effect.as(-1)
      )
    )
  );
  const durationMs = (yield* Clock.currentTimeMillis) - started;
  return FinalCheckStepResult.make({
    gate: planned.gate,
    label: planned.step.label,
    hostedContext: planned.hostedContext,
    command,
    status: exitCode === 0 ? "passed" : "failed",
    durationMs,
    ...(exitCode === 0 ? {} : { reason: exitCode === -1 ? "the step could not be started" : `exit ${exitCode}` }),
  });
});

const runExpectationRewriteGate = Effect.fn("Yeet.runExpectationRewriteGate")(function* (
  repoRoot: string,
  mergeBase: string
) {
  const started = yield* Clock.currentTimeMillis;
  const command = `git diff --unified=0 ${Str.slice(0, 12)(mergeBase)} HEAD -- <each modified or renamed test file>; replay rewritten tests on the merge base`;
  const rewrites = yield* collectExpectationRewrites(repoRoot, mergeBase);
  yield* Console.log(`[yeet] final-check expectation-rewrite: ${A.length(rewrites)} rewritten expectation(s)`);
  const verdicts = yield* verifyExpectationRewrites(repoRoot, mergeBase, rewrites);
  const blocking = A.filter(verdicts, (verdict) => verdict.classification !== "follows-diff");
  yield* Effect.forEach(
    verdicts,
    (verdict) =>
      Console.log(
        `[yeet] final-check expectation-rewrite ${verdict.testFile}: ${verdict.classification} (${verdict.detail})`
      ),
    { discard: true }
  );
  const step = FinalCheckStepResult.make({
    gate: "expectation-rewrite",
    label: "final-check:expectation-rewrite",
    hostedContext: EXPECTATION_REWRITE_CONTEXT,
    command,
    status: A.isReadonlyArrayEmpty(blocking) ? "passed" : "failed",
    durationMs: (yield* Clock.currentTimeMillis) - started,
    ...(A.isReadonlyArrayEmpty(blocking)
      ? {}
      : {
          reason: A.join(
            A.map(blocking, (verdict) => `${verdict.testFile}: ${verdict.classification}`),
            "; "
          ),
        }),
  });
  return { step, verdicts };
});

const skippedStep = (skip: FinalCheckSkip, hostedContext: string): FinalCheckStepResult =>
  FinalCheckStepResult.make({
    gate: skip.gate,
    label: `final-check:${skip.gate}`,
    hostedContext,
    command: "(skipped)",
    status: "skipped",
    durationMs: 0,
    reason: skip.reason,
  });

const renderSummary = (receipt: FinalCheckReceipt): string =>
  A.join(
    [
      `[yeet] final-check ${receipt.verdict} for ${Str.slice(0, 12)(receipt.headSha)} (merge base ${Str.slice(0, 12)(receipt.mergeBase)}${receipt.complete ? "" : ", gate subset"})`,
      ...A.map(
        receipt.steps,
        (step) =>
          `  ${step.status} ${step.label} (${Duration.format(Duration.millis(step.durationMs))}): ${step.hostedContext}${step.reason === undefined ? "" : ` — ${step.reason}`}`
      ),
    ],
    "\n"
  );

type FinalCheckRun = {
  readonly repoRoot: string;
  readonly mergeBase: string;
  readonly planned: ReadonlyArray<FinalCheckPlannedStep>;
  readonly skips: ReadonlyArray<FinalCheckSkip>;
};

type GateOutcome = {
  readonly steps: ReadonlyArray<FinalCheckStepResult>;
  readonly verdicts: ReadonlyArray<ExpectationRewriteVerdict>;
};

const plannedFor = (run: FinalCheckRun, gate: FinalCheckGate) => A.filter(run.planned, (entry) => entry.gate === gate);

const hostedContextFor = (run: FinalCheckRun, gate: FinalCheckGate): string =>
  gate === "expectation-rewrite"
    ? EXPECTATION_REWRITE_CONTEXT
    : A.join(
        A.map(plannedFor(run, gate), (entry) => entry.hostedContext),
        "; "
      );

const skipFor = (run: FinalCheckRun, gate: FinalCheckGate) => A.findFirst(run.skips, (entry) => entry.gate === gate);

const printGatePlan = (run: FinalCheckRun, gate: FinalCheckGate) =>
  O.match(skipFor(run, gate), {
    onSome: (skip) => Console.log(`  skip ${gate}: ${skip.reason}`),
    onNone: () =>
      gate === "expectation-rewrite"
        ? Console.log(`  ${gate}: scan the diff's test files and snapshots; replay rewritten tests on the merge base`)
        : Effect.forEach(plannedFor(run, gate), (entry) => Console.log(`  ${gate}: ${renderCommand(entry.step)}`), {
            discard: true,
          }),
  });

const runGate = (run: FinalCheckRun, gate: FinalCheckGate) =>
  O.match(skipFor(run, gate), {
    onSome: (skip): Effect.Effect<GateOutcome> =>
      Effect.succeed({ steps: [skippedStep(skip, hostedContextFor(run, gate))], verdicts: [] }),
    onNone: () =>
      gate === "expectation-rewrite"
        ? Effect.map(runExpectationRewriteGate(run.repoRoot, run.mergeBase), (result) => ({
            steps: [result.step],
            verdicts: result.verdicts,
          }))
        : Effect.map(Effect.forEach(plannedFor(run, gate), runStep), (steps) => ({ steps, verdicts: [] })),
  });

const hasFailure = (steps: ReadonlyArray<FinalCheckStepResult>): boolean =>
  A.some(steps, (step) => step.status === "failed");

const runGates = Effect.fn("Yeet.runFinalCheckGates")(function* (
  run: FinalCheckRun,
  gates: ReadonlyArray<FinalCheckGate>,
  failFast: boolean
) {
  let outcome: GateOutcome = { steps: [], verdicts: [] };
  for (const gate of gates) {
    if (failFast && hasFailure(outcome.steps)) break;
    const next = yield* runGate(run, gate);
    outcome = { steps: A.appendAll(outcome.steps, next.steps), verdicts: A.appendAll(outcome.verdicts, next.verdicts) };
  }
  return outcome;
});

// Untracked, non-ignored files count: the gates read them (check typechecks
// every file), so a receipt for the committed head cannot cover them.
const dirtyTree = Effect.fn("Yeet.finalCheckDirtyTree")(function* (repoRoot: string) {
  return Str.isNonEmpty(Str.trim(yield* runGitOutput(repoRoot, ["status", "--porcelain", "--untracked-files=all"])));
});

const refuseDirtyTree = Effect.fn("Yeet.refuseDirtyFinalCheckTree")(function* (repoRoot: string) {
  if (yield* dirtyTree(repoRoot)) {
    return yield* YeetCommandError.make({
      message:
        "yeet final-check refused: the tree has uncommitted changes or untracked files; commit or remove them first, the receipt pins the committed head.",
      exitCode: 2,
    });
  }
});

// The gates run for tens of minutes against the working tree. A commit or an
// uncommitted edit landing meanwhile (another session, an editor save) means
// they checked bytes the pinned head does not hold, so no receipt is written.
const refuseMovedTree = Effect.fn("Yeet.refuseMovedFinalCheckTree")(function* (repoRoot: string, headSha: string) {
  const liveHead = Str.trim(yield* runGitOutput(repoRoot, ["rev-parse", "HEAD"]));
  if (liveHead !== headSha || (yield* dirtyTree(repoRoot))) {
    return yield* YeetCommandError.make({
      message: `yeet final-check refused: the checkout changed while the gates ran (head ${Str.slice(0, 12)(headSha)} -> ${Str.slice(0, 12)(liveHead)}, or uncommitted edits or untracked files); no receipt was written. Commit, then re-run \`${YEET_FINAL_CHECK_COMMAND}\`.`,
      exitCode: 2,
    });
  }
});

const failedLabels = (steps: ReadonlyArray<FinalCheckStepResult>): string =>
  A.join(
    A.map(
      A.filter(steps, (step) => step.status === "failed"),
      (step) => step.label
    ),
    ", "
  );

/**
 * Run `yeet final-check` on the committed head and write its receipt.
 *
 * **Details**
 *
 * Refuses a dirty tree, because the receipt pins the committed head, and
 * re-reads HEAD and the tree after the gates: a commit or uncommitted edit
 * that landed during the run means no receipt is written. Gates run
 * in {@link FinalCheckGate} order; every gate runs unless `--fail-fast` stops
 * after the first red. A `--gates` subset still writes a receipt, marked
 * incomplete, so it can never admit `yeet ready`. `--dry-run` prints the plan
 * and runs nothing.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetFinalCheck, YeetFinalCheckOptions } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const options = YeetFinalCheckOptions.make({ base: "origin/main", gates: [], skip: [], dryRun: true, failFast: false })
 * console.log(Effect.isEffect(runYeetFinalCheck(options))) // true
 * ```
 *
 * @param options - Base ref, gate subset, recorded skips, dry run and fail-fast flags.
 * @returns The receipt written for the head; fails when the verdict is not pass.
 * @category use-cases
 * @since 0.0.0
 */
export const runYeetFinalCheck = Effect.fn("Yeet.runYeetFinalCheck")(function* (
  options: YeetFinalCheckOptions
): Effect.fn.Return<
  O.Option<FinalCheckReceipt>,
  YeetCommandError,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));
  const gates = yield* parseFinalCheckGates(options.gates);
  const skips = yield* parseFinalCheckSkips(options.skip);
  const headSha = Str.trim(yield* runGitOutput(repoRoot, ["rev-parse", "HEAD"]));
  const mergeBase = Str.trim(yield* runGitOutput(repoRoot, ["merge-base", options.base, "HEAD"]));
  const changedFiles = yield* runGitPathList(repoRoot, [
    "diff",
    "--name-only",
    "-z",
    "--diff-filter=d",
    mergeBase,
    "HEAD",
  ]);
  const run: FinalCheckRun = {
    repoRoot,
    mergeBase,
    planned: planFinalCheckSteps(repoRoot, mergeBase, changedFiles),
    skips,
  };

  if (options.dryRun) {
    yield* Console.log(
      `[yeet] final-check plan for ${Str.slice(0, 12)(headSha)} (merge base ${Str.slice(0, 12)(mergeBase)}):`
    );
    yield* Effect.forEach(gates, (gate) => printGatePlan(run, gate), { discard: true });
    return O.none();
  }

  yield* refuseDirtyTree(repoRoot);
  const startedAt = yield* nowIso;
  const { steps, verdicts } = yield* runGates(run, gates, options.failFast);
  yield* refuseMovedTree(repoRoot, headSha);
  const ranGates = A.dedupe(A.map(steps, (step) => step.gate));
  const receipt = FinalCheckReceipt.make({
    schemaVersion: "yeet-final-check/v1",
    headSha,
    mergeBase,
    base: options.base,
    complete: A.every(FinalCheckGate.literals, (gate) => A.contains(ranGates, gate)),
    verdict: hasFailure(steps) ? "fail" : "pass",
    startedAt,
    finishedAt: yield* nowIso,
    steps,
    expectationRewrites: verdicts,
  });
  const file = yield* writeReceipt(repoRoot, receipt);
  yield* Console.log(renderSummary(receipt));
  yield* Console.log(`[yeet] final-check receipt: ${file}`);
  if (receipt.verdict === "fail") {
    return yield* YeetCommandError.make({
      message: `yeet final-check failed: ${failedLabels(steps)}. These gates red hosted CI too; fix them before calling the pull request final.`,
      exitCode: 1,
    });
  }
  return O.some(receipt);
});
