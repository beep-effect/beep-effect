/**
 * Deprecated vendor API lint: `beep lint deprecated-apis`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isCi } from "@beep/repo-cli-kit/cli/EnvConfig";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { isLabsWorkspaceDir } from "@beep/repo-cli-kit/cli/Labs/index";
import { qualityStepOutputBound, runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import { findRepoRoot } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import { provideQualityConcurrency, qualityConcurrencyPlan } from "../Quality/Quality.plan.ts";
import { readLintPolicySweeps, runRootDeprecatedApisTask } from "../Quality/Tasks.ts";
import {
  lintBaseFlag,
  lintFullFlag,
  lintPackageFlag,
  OXLINT_DEPRECATED_APIS_CONFIG,
  resolveLintPackage,
} from "./internal/LintPackage.ts";
import { validateLintProgramAssignment } from "./internal/LintProgramAssignment.ts";
import { LintProgramAssignmentError } from "./Lint.errors.ts";

const validateAssignmentEvidence = Effect.fn("Lint.validateAssignmentEvidence")(function* (
  root: string,
  output: string,
  truncated: boolean
) {
  const path = yield* Path.Path;
  // oxlint 1.88.0 / tsgolint 7.0.2004 emits absolute paths, one per line,
  // after "Total programs: N. Unmatched files: N". Non-TS inputs are not law subjects.
  const listedFiles = pipe(
    output,
    Str.matchAll(/Unmatched file: ([^\r\n]+)/g),
    A.fromIterable,
    A.map((match) => O.fromUndefinedOr(match[1])),
    A.getSomes,
    A.map(Str.trim)
  );
  const summary = Str.match(
    /Done assigning files to programs\. Total programs: (\d+)\. Unmatched files: (\d+)(?:\r?\n|$)/
  )(output);
  if (O.isNone(summary) || summary.value[2] !== `${listedFiles.length}`) {
    return yield* LintProgramAssignmentError.make({
      files: [],
      message: O.isNone(summary)
        ? "lint deprecated-apis: assignment summary missing; cannot prove TypeScript coverage."
        : "lint deprecated-apis: assignment summary disagrees with listed unmatched files.",
    });
  }
  const unmatchedFiles = pipe(
    listedFiles,
    A.filter((file) => /\.(?:ts|tsx|mts|cts)$/.test(file)),
    A.map((file) => normalizePath(path.relative(root, path.resolve(root, file)))),
    A.dedupe,
    A.sort(Order.String)
  );
  if (truncated || A.isReadonlyArrayNonEmpty(unmatchedFiles)) {
    return yield* LintProgramAssignmentError.make({
      files: unmatchedFiles,
      message: truncated
        ? "lint deprecated-apis: assignment output truncated; cannot prove TypeScript coverage."
        : `lint deprecated-apis: TypeScript files have no tsconfig owner:\n${A.join(unmatchedFiles, "\n")}`,
    });
  }
});

const validateRustAssignmentEvidence = Effect.fn("Lint.validateRustAssignmentEvidence")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const path = yield* Path.Path;
  const inventory = yield* runCaptured({
    command: path.join(root, "node_modules/.bin/oxlint"),
    args: ["--debug=files", ...args],
    cwd: root,
    env: { OXC_LOG: "off" },
    extendEnv: true,
    bound: qualityStepOutputBound,
  });
  if (inventory.exitCode !== 0 || inventory.truncated) {
    return yield* LintProgramAssignmentError.make({
      files: [],
      message: "lint deprecated-apis: file inventory failed or was truncated; cannot prove TypeScript coverage.",
    });
  }
  const files = pipe(inventory.output, Str.split(/\r?\n/), A.map(Str.trim), A.filter(Str.isNonEmpty));
  yield* validateLintProgramAssignment(root, files).pipe(Effect.scoped);
});

const runDeprecatedApiLint = Effect.fn("Lint.deprecatedApiWorker")(function* (
  root: string,
  targets: ReadonlyArray<string>
) {
  if (A.isReadonlyArrayEmpty(targets)) return;
  const path = yield* Path.Path;
  // Type-aware oxlint takes its worker count from the concurrency plan: four on
  // the hosted profile, the profile's thread budget locally.
  const plan = yield* qualityConcurrencyPlan;
  const args = [
    "--config",
    path.join(root, OXLINT_DEPRECATED_APIS_CONFIG),
    "--disable-nested-config",
    `--threads=${plan.oxlintThreads}`,
    // A labs package may match nothing, as its own per-package run always allowed; a changed-scope
    // union keeps that allowance when it names one.
    ...(A.some(targets, isLabsWorkspaceDir) ? ["--no-error-on-unmatched-pattern"] : []),
    ...targets,
  ];
  const useGo = yield* Config.Boolean("BEEP_LINT_TSGOLINT").pipe(Config.withDefault(false));
  if (!useGo) yield* validateRustAssignmentEvidence(root, args);
  yield* Console.log(`[lint:deprecated-apis] oxlint (${useGo ? "tsgolint" : "tsrs"}) ${A.join(args, " ")}`);
  const result = yield* runCaptured({
    command: path.join(root, "node_modules/.bin/oxlint"),
    args,
    cwd: root,
    env: useGo
      ? { OXC_LOG: "debug" }
      : {
          OXLINT_TSGOLINT_PATH: path.join(root, "node_modules/.bin/tsrs-lint"),
          RAYON_NUM_THREADS: `${plan.oxlintThreads}`,
          TSRS_FAST: "0",
        },
    extendEnv: true,
    bound: qualityStepOutputBound,
    tee: true,
  });
  if (useGo) yield* validateAssignmentEvidence(root, result.output, result.truncated);
  if (result.exitCode !== 0) {
    return yield* failWithReportedExit(
      `lint deprecated-apis: failed with exit code ${result.exitCode}.`,
      result.exitCode
    );
  }
  yield* Console.log("[lint:deprecated-apis] assignment coverage: zero unmatched TypeScript files.");
  yield* Console.log("[lint:deprecated-apis] OK: no deprecated vendor API usage found.");
});

// The changed-scope policy plan's union: every Turbo-selected package directory in one process.
const runDeprecatedApiLintTargets = Effect.fn("Lint.deprecatedApiTargets")(function* (
  targets: A.NonEmptyReadonlyArray<string>,
  scoped: boolean
) {
  if (scoped) {
    return yield* failWithReportedExit("lint deprecated-apis: --target cannot be combined with --package or --full.");
  }
  const root = yield* findRepoRoot();
  const resolved = yield* Effect.forEach(targets, (entry) => resolveLintPackage(root, entry));
  return yield* runDeprecatedApiLint(root, A.dedupe(resolved));
});

const runLintDeprecatedApis = Effect.fn("Lint.deprecatedApis")(function* (options: {
  readonly package: O.Option<string>;
  readonly full: boolean;
  readonly base: string;
  readonly target: ReadonlyArray<string>;
}) {
  const { package: directory, full, base, target } = options;
  if (A.isReadonlyArrayNonEmpty(target)) {
    return yield* runDeprecatedApiLintTargets(target, O.isSome(directory) || full);
  }
  if (O.isNone(directory)) {
    const ci = yield* isCi;
    const foundRepoRoot = yield* findRepoRoot();
    const sweeps = yield* readLintPolicySweeps(foundRepoRoot);
    if (!full && !ci) {
      return yield* runRootDeprecatedApisTask(base);
    }
    return yield* sweeps.deprecatedApis === "oxlint"
      ? yield* Effect.map(findRepoRoot(), (value) => runDeprecatedApiLint(value, ["apps", "packages", "infra"]))
      : runRootDeprecatedApisTask();
  }
  const root = yield* findRepoRoot();
  yield* runDeprecatedApiLint(root, [yield* resolveLintPackage(root, directory.value)]);
});

/**
 * Lint command for deprecated vendor API usage.
 *
 * **Example** (Show the deprecated-apis invocation)
 *
 * ```ts
 * console.log("bun run beep lint deprecated-apis")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lintDeprecatedApisCommand = Command.make(
  "deprecated-apis",
  {
    package: lintPackageFlag,
    full: lintFullFlag,
    base: lintBaseFlag,
    // The changed-scope policy plan passes every package directory Turbo selected, so one
    // type-aware oxlint process checks them instead of one repo-cli boot per package.
    target: Flag.String("target").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Lint these package directories in one oxlint process; repeat for each directory")
    ),
  },
  (options) => provideQualityConcurrency(runLintDeprecatedApis(options))
).pipe(Command.withDescription("Check TypeScript sources for deprecated third-party API usage"));
