/**
 * Package-local verification workflow for the Quality command group.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import { LiteralKit, normalizePath } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Clock, Console, Effect, FileSystem, HashMap, Order, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { collectText } from "../../../internal/process/index.ts";
import { QualityScriptCommandError } from "../Quality.errors.ts";
import type { DomainError, FsUtils, NoSuchFileError } from "@beep/repo-utils";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Quality/internal/PackageVerify");

const PACKAGE_TARGET_DIFF_FILTER = ["A", "C", "D", "M", "R", "T", "U", "X", "B"].join("");
const PACKAGE_VERIFY_STEP_CONCURRENCY = 3;
const VERIFY_STEP_NAMES = ["lint", "check", "test"] as const;

/**
 * Verification step names run by `quality package-verify`.
 *
 * @example
 * ```ts
 * import { PackageVerifyStepName } from "@beep/repo-cli/test/Quality"
 *
 * const isLint = PackageVerifyStepName.is.lint("lint")
 * console.log(isLint) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export const PackageVerifyStepName = LiteralKit(VERIFY_STEP_NAMES).pipe(
  $I.annoteSchema("PackageVerifyStepName", {
    description: "Verification step names run by quality package-verify.",
  })
);

/**
 * Verification step names run by `quality package-verify`.
 *
 * @example
 * ```ts
 * import type { PackageVerifyStepName } from "@beep/repo-cli/test/Quality"
 *
 * const step: PackageVerifyStepName = "check"
 * console.log(step) // example value
 * ```
 * @category models
 * @since 0.0.0
 */
export type PackageVerifyStepName = typeof PackageVerifyStepName.Type;

/**
 * Workspace package candidate used by package verification.
 *
 * @example
 * ```ts
 * import { PackageVerifyWorkspace } from "@beep/repo-cli/test/Quality"
 *
 * const workspace = PackageVerifyWorkspace.make({
 *   name: "@beep/demo",
 *   dir: "/repo/packages/demo",
 *   scripts: { "beep:lint": "biome check ." }
 * })
 * console.log(workspace.name)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageVerifyWorkspace extends S.Class<PackageVerifyWorkspace>($I`PackageVerifyWorkspace`)(
  {
    name: S.String,
    dir: S.String,
    scripts: S.Record(S.String, S.String),
  },
  $I.annote("PackageVerifyWorkspace", {
    description: "Workspace package candidate used by package verification.",
  })
) {}

/**
 * Package verification step specification.
 *
 * @example
 * ```ts
 * import { PackageVerifyStepSpec } from "@beep/repo-cli/test/Quality"
 *
 * const spec = PackageVerifyStepSpec.make({
 *   step: "lint",
 *   script: "beep:lint"
 * })
 * console.log(spec.script)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageVerifyStepSpec extends S.Class<PackageVerifyStepSpec>($I`PackageVerifyStepSpec`)(
  {
    step: PackageVerifyStepName,
    script: S.String,
  },
  $I.annote("PackageVerifyStepSpec", {
    description: "Package verification step specification.",
  })
) {}

/**
 * Package verification subprocess result.
 *
 * @example
 * ```ts
 * import { PackageVerifyStepResult } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const result = PackageVerifyStepResult.make({
 *   step: "lint",
 *   script: "beep:lint",
 *   skipped: false,
 *   ok: true,
 *   durationMillis: 12,
 *   exitCode: O.some(0),
 *   output: ""
 * })
 * console.log(result.ok)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageVerifyStepResult extends S.Class<PackageVerifyStepResult>($I`PackageVerifyStepResult`)(
  {
    step: PackageVerifyStepName,
    script: S.String,
    skipped: S.Boolean,
    ok: S.Boolean,
    durationMillis: S.Finite,
    exitCode: S.Option(S.Finite),
    output: S.String,
  },
  $I.annote("PackageVerifyStepResult", {
    description: "Package verification subprocess result.",
  })
) {}

/**
 * Package verification report.
 *
 * @example
 * ```ts
 * import { PackageVerifyReport } from "@beep/repo-cli/test/Quality"
 *
 * const report = PackageVerifyReport.make({
 *   packageName: "@beep/demo",
 *   packageDir: "/repo/packages/demo",
 *   quick: true,
 *   results: []
 * })
 * console.log(report.quick)
 * ```
 * @category models
 * @since 0.0.0
 */
export class PackageVerifyReport extends S.Class<PackageVerifyReport>($I`PackageVerifyReport`)(
  {
    packageName: S.String,
    packageDir: S.String,
    quick: S.Boolean,
    results: S.Array(PackageVerifyStepResult),
  },
  $I.annote("PackageVerifyReport", {
    description: "Package verification report.",
  })
) {}

class PackageVerifyPackageJson extends S.Class<PackageVerifyPackageJson>($I`PackageVerifyPackageJson`)(
  {
    name: S.String,
    scripts: S.OptionFromOptionalKey(S.Record(S.String, S.String)),
  },
  $I.annote("PackageVerifyPackageJson", {
    description: "Minimal package.json shape decoded for package verification.",
  })
) {}

const decodePackageVerifyPackageJson = S.decodeUnknownEffect(S.fromJsonString(PackageVerifyPackageJson));
const byWorkspaceNameAscending = Order.mapInput(Order.String, (workspace: PackageVerifyWorkspace) => workspace.name);
const byWorkspacePathLengthDescending = Order.flip(
  Order.mapInput(Order.Number, (workspace: PackageVerifyWorkspace) => Str.length(workspace.dir))
);

// fallow-ignore-next-line code-duplication
const commandText = (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " ");

const linesFromText = (text: string): ReadonlyArray<string> =>
  pipe(Str.split(/\r?\n/)(text), A.map(Str.trim), A.filter(Str.isNonEmpty));

const normalizedRootPath = (root: string): string => {
  const normalized = normalizePath(root);
  return Str.endsWith("/")(normalized) ? Str.slice(0, -1)(normalized) : normalized;
};

const absoluteChangedPath = (repoRoot: string, filePath: string): string => {
  const normalized = normalizePath(filePath);
  return Str.startsWith("/")(normalized) ? normalized : `${normalizedRootPath(repoRoot)}/${normalized}`;
};

const isPathInside = (parentDir: string, candidatePath: string): boolean => {
  const parent = normalizedRootPath(parentDir);
  const candidate = normalizePath(candidatePath);
  return candidate === parent || Str.startsWith(`${parent}/`)(candidate);
};

const workspaceForFile = (
  repoRoot: string,
  workspaces: ReadonlyArray<PackageVerifyWorkspace>,
  filePath: string
): O.Option<PackageVerifyWorkspace> =>
  pipe(
    workspaces,
    A.filter((workspace) => isPathInside(workspace.dir, absoluteChangedPath(repoRoot, filePath))),
    A.sort(byWorkspacePathLengthDescending),
    A.head
  );

const fail = (message: string): Effect.Effect<never, QualityScriptCommandError> =>
  Effect.fail(QualityScriptCommandError.make({ message, exitCode: 2 }));

const runGitLines = Effect.fn("PackageVerify.runGitLines")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<ReadonlyArray<string>, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make("git", [...args], {
        cwd: repoRoot,
        stderr: "ignore",
        stdout: "pipe",
      });
      const output = yield* collectText(handle.stdout);
      const exitCode = yield* handle.exitCode;
      if (exitCode !== 0) {
        return yield* QualityScriptCommandError.new(`git ${A.join(args, " ")} failed with exit code ${exitCode}.`, {
          command: commandText("git", args),
          exitCode,
        })(`git ${A.join(args, " ")} failed`);
      }
      return output;
    })
  ).pipe(
    QualityScriptCommandError.mapError(`Failed to spawn git ${A.join(args, " ")}.`, {
      command: commandText("git", args),
    })
  );

  return linesFromText(result);
});

const collectPackageVerifyChangedFiles = Effect.fn("PackageVerify.collectPackageVerifyChangedFiles")(function* (
  repoRoot: string
) {
  const gitArgs: ReadonlyArray<ReadonlyArray<string>> = [
    ["diff", "--name-only", `--diff-filter=${PACKAGE_TARGET_DIFF_FILTER}`, "HEAD", "--"],
    ["diff", "--cached", "--name-only", `--diff-filter=${PACKAGE_TARGET_DIFF_FILTER}`, "--"],
    ["ls-files", "--others", "--exclude-standard"],
  ];
  const files = yield* Effect.forEach(
    gitArgs,
    (args) => runGitLines(repoRoot, args).pipe(Effect.option, Effect.map(O.getOrElse(A.empty<string>))),
    { concurrency: 3 }
  );

  return pipe(A.flatten(files), A.dedupe, A.sort(Order.String));
});

const packageVerifyStepSpecs = (quick: boolean): ReadonlyArray<PackageVerifyStepSpec> =>
  quick
    ? [
        PackageVerifyStepSpec.make({ step: "lint", script: "beep:lint" }),
        PackageVerifyStepSpec.make({ step: "check", script: "beep:check" }),
      ]
    : [
        PackageVerifyStepSpec.make({ step: "lint", script: "beep:lint" }),
        PackageVerifyStepSpec.make({ step: "check", script: "beep:check" }),
        PackageVerifyStepSpec.make({ step: "test", script: "beep:test" }),
      ];

/**
 * Resolve the package target for package verification.
 *
 * @example
 * ```ts
 * import { PackageVerifyWorkspace, selectPackageVerifyTargetForTesting } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const selected = selectPackageVerifyTargetForTesting({
 *   repoRoot: "/repo",
 *   packageName: O.some("@beep/demo"),
 *   changedFiles: [],
 *   workspaces: [
 *     PackageVerifyWorkspace.make({ name: "@beep/demo", dir: "/repo/packages/demo", scripts: {} })
 *   ]
 * })
 * console.log(selected) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const selectPackageVerifyTargetForTesting = Effect.fn("PackageVerify.selectPackageVerifyTarget")(function* ({
  changedFiles,
  packageName,
  repoRoot,
  workspaces,
}: {
  readonly changedFiles: ReadonlyArray<string>;
  readonly packageName: O.Option<string>;
  readonly repoRoot: string;
  readonly workspaces: ReadonlyArray<PackageVerifyWorkspace>;
}): Effect.fn.Return<PackageVerifyWorkspace, QualityScriptCommandError> {
  if (O.isSome(packageName)) {
    const selected = pipe(
      workspaces,
      A.findFirst((workspace) => workspace.name === packageName.value)
    );
    if (O.isSome(selected)) {
      return selected.value;
    }
    return yield* fail(`pkg-verify: unknown package "${packageName.value}".`);
  }

  const changedPackageNames = pipe(
    changedFiles,
    A.map((file) => workspaceForFile(repoRoot, workspaces, file)),
    A.getSomes,
    A.map((workspace) => workspace.name),
    A.dedupe,
    A.sort(Order.String)
  );

  return yield* A.match(changedPackageNames, {
    onEmpty: () =>
      fail(
        "pkg-verify: no package specified and could not auto-detect a unique changed package.\n" +
          "  usage: bun run pkg:verify <@beep/pkg-name>"
      ),
    onNonEmpty: (names) =>
      A.length(names) === 1
        ? pipe(
            workspaces,
            A.findFirst((workspace) => workspace.name === names[0]),
            O.match({
              onNone: () => fail(`pkg-verify: unknown package "${names[0]}".`),
              onSome: Effect.succeed,
            })
          )
        : fail(`pkg-verify: changed files span multiple packages: ${A.join(names, ", ")}.`),
  });
});

const readPackageWorkspace = Effect.fn("PackageVerify.readPackageWorkspace")(function* (
  name: string,
  dir: string
): Effect.fn.Return<PackageVerifyWorkspace, QualityScriptCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageJsonPath = path.join(dir, "package.json");
  const content = yield* fs
    .readFileString(packageJsonPath)
    .pipe(QualityScriptCommandError.mapError(`Failed to read ${packageJsonPath}.`));
  const packageJson = yield* decodePackageVerifyPackageJson(content).pipe(
    QualityScriptCommandError.mapError(`Failed to decode ${packageJsonPath}.`)
  );

  return PackageVerifyWorkspace.make({
    name,
    dir,
    scripts: pipe(
      packageJson.scripts,
      O.getOrElse(() => R.empty<string>())
    ),
  });
});

const collectWorkspaces = Effect.fn("PackageVerify.collectWorkspaces")(function* (
  repoRoot: string
): Effect.fn.Return<
  ReadonlyArray<PackageVerifyWorkspace>,
  QualityScriptCommandError,
  FsUtils | FileSystem.FileSystem | Path.Path
> {
  const workspaceDirs = yield* resolveWorkspaceDirs(repoRoot).pipe(
    Effect.mapError((error: DomainError | NoSuchFileError) =>
      QualityScriptCommandError.make({
        cause: error,
        message: "Failed to resolve workspace package directories.",
        exitCode: 2,
      })
    )
  );

  const entries = HashMap.toEntries(workspaceDirs);
  const workspaces = yield* Effect.forEach(entries, ([name, dir]) => readPackageWorkspace(name, dir), {
    concurrency: 8,
  });
  return pipe(workspaces, A.sort(byWorkspaceNameAscending));
});

const collectStepOutput = Effect.fn("PackageVerify.collectStepOutput")(function* (
  cwd: string,
  command: string,
  args: ReadonlyArray<string>
): Effect.fn.Return<
  { readonly exitCode: number; readonly output: string },
  QualityScriptCommandError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(command, [...args], {
        cwd,
        extendEnv: true,
        stdout: "pipe",
        stderr: "pipe",
      });
      const output = yield* collectText(handle.all);
      const exitCode = yield* handle.exitCode;
      return {
        exitCode,
        output,
      };
    })
  ).pipe(
    QualityScriptCommandError.mapError(`Failed to spawn ${commandText(command, args)}.`, {
      command: commandText(command, args),
    })
  );
});

const runPackageVerifyStep = Effect.fn("PackageVerify.runPackageVerifyStep")(function* (
  workspace: PackageVerifyWorkspace,
  spec: PackageVerifyStepSpec
): Effect.fn.Return<PackageVerifyStepResult, QualityScriptCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  if (O.isNone(R.get(workspace.scripts, spec.script))) {
    return PackageVerifyStepResult.make({
      step: spec.step,
      script: spec.script,
      skipped: true,
      ok: true,
      durationMillis: 0,
      exitCode: O.none(),
      output: `(no ${spec.script} script)`,
    });
  }

  const startedAt = yield* Clock.currentTimeMillis;
  const result = yield* collectStepOutput(workspace.dir, "bun", ["run", spec.script]);
  const completedAt = yield* Clock.currentTimeMillis;

  return PackageVerifyStepResult.make({
    step: spec.step,
    script: spec.script,
    skipped: false,
    ok: result.exitCode === 0,
    durationMillis: completedAt - startedAt,
    exitCode: O.some(result.exitCode),
    output: result.output,
  });
});

/**
 * Run package-local verification for a workspace package.
 *
 * @example
 * ```ts
 * import { runPackageVerify } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * const program = runPackageVerify({
 *   packageName: O.some("@beep/repo-cli"),
 *   quick: true
 * })
 * console.log(program) // example value
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runPackageVerify = Effect.fn("PackageVerify.runPackageVerify")(function* ({
  packageName,
  quick,
}: {
  readonly packageName: O.Option<string>;
  readonly quick: boolean;
}): Effect.fn.Return<
  PackageVerifyReport,
  QualityScriptCommandError,
  FsUtils | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot(path.resolve(process.cwd())).pipe(
    QualityScriptCommandError.mapError("Failed to locate repository root.")
  );
  const workspaces = yield* collectWorkspaces(repoRoot);
  const changedFiles = O.isSome(packageName) ? A.empty<string>() : yield* collectPackageVerifyChangedFiles(repoRoot);
  const workspace = yield* selectPackageVerifyTargetForTesting({ changedFiles, packageName, repoRoot, workspaces });
  const results = yield* Effect.forEach(
    packageVerifyStepSpecs(quick),
    (spec) => runPackageVerifyStep(workspace, spec),
    {
      concurrency: PACKAGE_VERIFY_STEP_CONCURRENCY,
    }
  );

  return PackageVerifyReport.make({
    packageName: workspace.name,
    packageDir: workspace.dir,
    quick,
    results,
  });
});

const fmtSecs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/**
 * Render a package verification report for terminal output.
 *
 * @param report - Verification results to summarize in the same order they ran.
 * @returns Terminal-ready lines with the header, step summary, and failed output blocks.
 * @example
 * ```ts
 * import { PackageVerifyReport, renderPackageVerifyReportForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const lines = renderPackageVerifyReportForTesting(
 *   PackageVerifyReport.make({
 *     packageName: "@beep/demo",
 *     packageDir: "/repo/packages/demo",
 *     quick: true,
 *     results: []
 *   })
 * )
 * console.log(lines) // example value
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderPackageVerifyReportForTesting = (report: PackageVerifyReport): ReadonlyArray<string> => {
  const header = `pkg-verify ${report.packageName} (${report.packageDir})${report.quick ? " [quick]" : ""}`;
  const summary = pipe(
    report.results,
    A.map((result) => {
      const mark = result.skipped ? "skip" : result.ok ? "ok" : "fail";
      const time = result.skipped ? "" : ` ${fmtSecs(result.durationMillis)}`;
      return `${mark} ${result.step}${time}`;
    }),
    A.join("   ")
  );
  const failedOutput = pipe(
    report.results,
    A.filter((result) => !result.ok && !result.skipped),
    A.flatMap((result) => [
      "",
      `-------- ${result.step} (failed) --------`,
      Str.endsWith("\n")(result.output) ? result.output : `${result.output}\n`,
    ])
  );

  return [header, `  ${summary}`, ...failedOutput];
};

/**
 * Run package verification and render the CLI result.
 *
 * @example
 * ```ts
 * import { runPackageVerifyCli } from "@beep/repo-cli/test/Quality"
 *
 * const program = runPackageVerifyCli({
 *   packageArgs: ["@beep/repo-cli"],
 *   quick: true
 * })
 * console.log(program) // example value
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runPackageVerifyCli = Effect.fn("PackageVerify.runPackageVerifyCli")(function* ({
  packageArgs,
  quick,
}: {
  readonly packageArgs: ReadonlyArray<string>;
  readonly quick: boolean;
}): Effect.fn.Return<
  void,
  QualityScriptCommandError,
  FsUtils | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (A.length(packageArgs) > 1) {
    return yield* fail(`pkg-verify: expected at most one package argument, received ${A.length(packageArgs)}.`);
  }

  const report = yield* runPackageVerify({
    packageName: pipe(A.head(packageArgs), O.map(Str.trim), O.filter(Str.isNonEmpty)),
    quick,
  });

  yield* Effect.forEach(renderPackageVerifyReportForTesting(report), (line) => Console.log(line), { discard: true });

  const failed = A.filter(report.results, (result) => !result.ok && !result.skipped);
  if (A.isReadonlyArrayNonEmpty(failed)) {
    return yield* QualityScriptCommandError.make({ message: "pkg-verify failed.", exitCode: 1 });
  }
});

/**
 * Build package verification step specs. Exposed for focused tests.
 *
 * @example
 * ```ts
 * import { packageVerifyStepSpecsForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const specs = packageVerifyStepSpecsForTesting(true)
 * console.log(specs) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const packageVerifyStepSpecsForTesting = packageVerifyStepSpecs;

/**
 * Collect changed paths used for package verification auto-detection.
 *
 * @example
 * ```ts
 * import { collectPackageVerifyChangedFilesForTesting } from "@beep/repo-cli/test/Quality"
 *
 * const program = collectPackageVerifyChangedFilesForTesting("/repo")
 * console.log(program) // example value
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const collectPackageVerifyChangedFilesForTesting = collectPackageVerifyChangedFiles;
