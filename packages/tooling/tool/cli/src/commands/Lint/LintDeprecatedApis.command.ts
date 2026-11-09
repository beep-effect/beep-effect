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
import * as HashSet from "effect/HashSet";
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
import {
  deprecatedApiPartitionArgs,
  deprecatedApiSweepPartitions,
  deprecatedApiSweepRoots,
} from "./LintDeprecatedApis.schemas.ts";
import type { DeprecatedApiPartition } from "./LintDeprecatedApis.schemas.ts";

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

const deprecatedApiInventory = Effect.fn("Lint.deprecatedApiInventory")(function* (
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
  return pipe(inventory.output, Str.split(/\r?\n/), A.map(Str.trim), A.filter(Str.isNonEmpty));
});

const validateRustAssignmentEvidence = Effect.fn("Lint.validateRustAssignmentEvidence")(function* (
  root: string,
  args: ReadonlyArray<string>
) {
  const files = yield* deprecatedApiInventory(root, args);
  yield* validateLintProgramAssignment(root, files).pipe(Effect.scoped);
});

// The partitioned full sweep proves its cover before the ownership proof: every partition selects
// files, no file is selected twice, and the partitions' union is exactly the single-run inventory.
const validateRustPartitionEvidence = Effect.fn("Lint.validateRustPartitionEvidence")(function* (
  root: string,
  options: ReadonlyArray<string>,
  partitions: A.NonEmptyReadonlyArray<DeprecatedApiPartition>
) {
  const [full, selections] = yield* Effect.all(
    [
      deprecatedApiInventory(root, [...options, ...deprecatedApiSweepRoots]),
      Effect.forEach(partitions, (partition) =>
        Effect.map(deprecatedApiInventory(root, [...options, ...deprecatedApiPartitionArgs(partition)]), (files) => ({
          name: partition.name,
          files,
        }))
      ),
    ],
    { concurrency: "unbounded" }
  );
  const empty = A.filter(selections, (selection) => A.isReadonlyArrayEmpty(selection.files));
  if (A.isReadonlyArrayNonEmpty(empty)) {
    return yield* LintProgramAssignmentError.make({
      files: [],
      message: `lint deprecated-apis: partitions select no files: ${A.join(
        A.map(empty, (selection) => selection.name),
        ", "
      )}.`,
    });
  }
  const selected = A.flatMap(selections, (selection) => selection.files);
  const union = HashSet.fromIterable(selected);
  const expected = HashSet.fromIterable(full);
  const duplicated = HashSet.size(union) !== A.length(selected);
  const drift = pipe(
    HashSet.difference(expected, union),
    HashSet.union(HashSet.difference(union, expected)),
    A.fromIterable,
    A.sort(Order.String)
  );
  if (duplicated || A.isReadonlyArrayNonEmpty(drift)) {
    return yield* LintProgramAssignmentError.make({
      files: drift,
      message: duplicated
        ? "lint deprecated-apis: sweep partitions overlap; a file would be linted twice."
        : `lint deprecated-apis: sweep partitions do not cover the full inventory exactly:\n${A.join(drift, "\n")}`,
    });
  }
  yield* validateLintProgramAssignment(root, full).pipe(Effect.scoped);
});

// One oxlint invocation of the sweep: a log label and its path arguments.
interface DeprecatedApiInvocation {
  readonly label: string;
  readonly paths: ReadonlyArray<string>;
}

const runDeprecatedApiInvocations = Effect.fn("Lint.deprecatedApiWorker")(function* (
  root: string,
  invocations: A.NonEmptyReadonlyArray<DeprecatedApiInvocation>,
  partitions: O.Option<A.NonEmptyReadonlyArray<DeprecatedApiPartition>>
) {
  const path = yield* Path.Path;
  // Type-aware oxlint takes its worker count from the concurrency plan: four on
  // the hosted profile, the profile's thread budget locally.
  const plan = yield* qualityConcurrencyPlan;
  const options = [
    "--config",
    path.join(root, OXLINT_DEPRECATED_APIS_CONFIG),
    "--disable-nested-config",
    `--threads=${plan.oxlintThreads}`,
  ];
  const argsOf = (paths: ReadonlyArray<string>) => [
    ...options,
    // A labs package may match nothing, as its own per-package run always allowed; a changed-scope
    // union keeps that allowance when it names one.
    ...(A.some(paths, isLabsWorkspaceDir) ? ["--no-error-on-unmatched-pattern"] : []),
    ...paths,
  ];
  const useGo = yield* Config.Boolean("BEEP_LINT_TSGOLINT").pipe(Config.withDefault(false));
  const backend = useGo ? "tsgolint" : "tsrs";
  // Partitions run one after another so the peak is the largest partition, and every partition
  // runs even after a red one so the full set of findings is reported.
  const sweep = Effect.forEach(
    invocations,
    Effect.fnUntraced(function* (invocation) {
      const args = argsOf(invocation.paths);
      yield* Console.log(`[lint:deprecated-apis] ${invocation.label}oxlint (${backend}) ${A.join(args, " ")}`);
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
      return { invocation, result };
    }),
    { concurrency: 1 }
  );
  // The Rust ownership proof runs beside the sweep instead of ahead of it. The proof's failure
  // fails fast and interrupts the sweep; the spawner's scoped release reaps its process group.
  // A finished sweep's exit codes are read only once the proof has passed, so a proof failure
  // still outranks a lint failure.
  const proof = useGo
    ? Effect.void
    : O.match(partitions, {
        onNone: () => validateRustAssignmentEvidence(root, argsOf(invocations[0].paths)),
        onSome: (planned) => validateRustPartitionEvidence(root, options, planned),
      });
  const [results] = yield* Effect.all([sweep, proof], { concurrency: 2 });
  if (useGo) {
    yield* Effect.forEach(results, ({ result }) => validateAssignmentEvidence(root, result.output, result.truncated), {
      discard: true,
    });
  }
  const failed = A.findFirst(results, ({ result }) => result.exitCode !== 0);
  if (O.isSome(failed)) {
    const { invocation, result } = failed.value;
    return yield* failWithReportedExit(
      `lint deprecated-apis: ${invocation.label}failed with exit code ${result.exitCode}.`,
      result.exitCode
    );
  }
  yield* Console.log("[lint:deprecated-apis] assignment coverage: zero unmatched TypeScript files.");
  yield* Console.log("[lint:deprecated-apis] OK: no deprecated vendor API usage found.");
});

const runDeprecatedApiLint = Effect.fn("Lint.deprecatedApiScope")(function* (
  root: string,
  targets: ReadonlyArray<string>
) {
  if (A.isReadonlyArrayNonEmpty(targets)) {
    yield* runDeprecatedApiInvocations(root, [{ label: "", paths: targets }], O.none());
  }
});

// The full sweep: one oxlint process per partition instead of one over every root.
const runDeprecatedApiFullSweep = Effect.fn("Lint.deprecatedApiFullSweep")(function* (root: string) {
  yield* runDeprecatedApiInvocations(
    root,
    A.map(deprecatedApiSweepPartitions, (partition) => ({
      label: `partition ${partition.name}: `,
      paths: deprecatedApiPartitionArgs(partition),
    })),
    O.some(deprecatedApiSweepPartitions)
  );
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
      ? yield* Effect.map(findRepoRoot(), runDeprecatedApiFullSweep)
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
