/**
 * Deprecated vendor API lint: `beep lint deprecated-apis`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { normalizePath } from "@beep/schema";
import { A, Str } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import { isCi } from "../../internal/cli/EnvConfig.ts";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { isLabsWorkspaceDir } from "../../internal/cli/Labs/index.ts";
import { qualityStepOutputBound, runCaptured } from "../../internal/process/StepExec.ts";
import { readLintPolicySweeps, runRootDeprecatedApisTask } from "../Quality/Tasks.ts";
import {
  lintBaseFlag,
  lintFullFlag,
  lintPackageFlag,
  OXLINT_DEPRECATED_APIS_CONFIG,
  resolveLintPackage,
} from "./internal/LintPackage.ts";
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

const runDeprecatedApiLint = Effect.fn("Lint.deprecatedApiWorker")(function* (
  root: string,
  targets: ReadonlyArray<string>
) {
  if (A.isReadonlyArrayEmpty(targets)) return;
  const path = yield* Path.Path;
  const args = [
    "--config",
    path.join(root, OXLINT_DEPRECATED_APIS_CONFIG),
    "--disable-nested-config",
    "--threads=4",
    ...(A.every(targets, isLabsWorkspaceDir) ? ["--no-error-on-unmatched-pattern"] : []),
    ...targets,
  ];
  yield* Console.log(`[lint:deprecated-apis] oxlint ${A.join(args, " ")}`);
  const result = yield* runCaptured({
    command: path.join(root, "node_modules/.bin/oxlint"),
    args,
    cwd: root,
    env: { OXC_LOG: "debug" },
    extendEnv: true,
    bound: qualityStepOutputBound,
    tee: true,
  });
  yield* validateAssignmentEvidence(root, result.output, result.truncated);
  if (result.exitCode !== 0) {
    return yield* failWithReportedExit(
      `lint deprecated-apis: failed with exit code ${result.exitCode}.`,
      result.exitCode
    );
  }
  yield* Console.log("[lint:deprecated-apis] assignment coverage: zero unmatched TypeScript files.");
  yield* Console.log("[lint:deprecated-apis] OK: no deprecated vendor API usage found.");
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
  { package: lintPackageFlag, full: lintFullFlag, base: lintBaseFlag },
  Effect.fn("Lint.deprecatedApis")(function* ({ package: directory, full, base }) {
    if (O.isNone(directory)) {
      const ci = yield* isCi;
      const sweeps = yield* readLintPolicySweeps(yield* findRepoRoot());
      if (!full && !ci) return yield* runRootDeprecatedApisTask(base);
      return yield* sweeps.deprecatedApis === "oxlint"
        ? runDeprecatedApiLint(yield* findRepoRoot(), ["apps", "packages", "infra"])
        : runRootDeprecatedApisTask();
    }
    const root = yield* findRepoRoot();
    yield* runDeprecatedApiLint(root, [yield* resolveLintPackage(root, directory.value)]);
  })
).pipe(Command.withDescription("Check TypeScript sources for deprecated third-party API usage"));
