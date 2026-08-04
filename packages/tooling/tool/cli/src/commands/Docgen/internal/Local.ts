/**
 * Local, bounded docgen planning and execution for edit-loop quality checks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { verifyDocgenProofManifest } from "@beep/repo-docgen/ProofManifest";
import { DomainError, findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Console, Effect, flow, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../../internal/cli/Printer.ts";
import { runCaptured, runCapturedStreams, runToExit } from "../../../internal/process/StepExec.ts";
import {
  aggregateGeneratedDocs,
  analyzePackageDocumentation,
  assertNoOrphanDocgenConfigPaths,
  discoverDocgenWorkspacePackages,
  resolveDocgenWorkspacePackage,
} from "./Operations.ts";
import type { DocgenProofManifestVerification } from "@beep/repo-docgen/ProofManifest";
import type { FsUtils, NoSuchFileError } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { CliReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import type { DocgenWorkspacePackage } from "./Operations.ts";

const $I = $RepoCliId.create("commands/Docgen/internal/Local");

const DEFAULT_LOCAL_PARALLEL = 1 as const;
const DOCGEN_FULL_COMMAND = "bun run docgen" as const;
const DOCGEN_LOCAL_PACKAGE_INPUT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".md", ".mdx"] as const;
const DOCGEN_LOCAL_PACKAGE_INPUT_PREFIXES = ["src/", "docs/"] as const;
const DOCGEN_LOCAL_PACKAGE_INPUT_FILES = [
  "docgen.json",
  "package.json",
  "README.md",
  "tsconfig.json",
  "tsconfig.build.json",
] as const;
const DOCGEN_LOCAL_FULL_INPUT_FILES = [
  ".bun-version",
  "bun.lock",
  "package.json",
  "turbo.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.packages.json",
] as const;
const DOCGEN_LOCAL_FULL_INPUT_PREFIXES = [
  "packages/tooling/tool/docgen/",
  "packages/tooling/tool/cli/src/commands/Docgen/",
] as const;

class TurboDryRunTaskCache extends S.Class<TurboDryRunTaskCache>($I`TurboDryRunTaskCache`)(
  {
    source: S.optionalKey(S.String),
    status: S.optionalKey(S.String),
  },
  $I.annote("TurboDryRunTaskCache", {
    description: "Turbo dry-run cache metadata for one task.",
  })
) {}

class TurboDryRunTask extends S.Class<TurboDryRunTask>($I`TurboDryRunTask`)(
  {
    cache: S.optionalKey(TurboDryRunTaskCache),
    package: S.optionalKey(S.String),
    task: S.optionalKey(S.String),
    taskId: S.optionalKey(S.String),
  },
  $I.annote("TurboDryRunTask", {
    description: "Turbo dry-run task record decoded from JSON output.",
  })
) {}

class TurboDryRunDocument extends S.Class<TurboDryRunDocument>($I`TurboDryRunDocument`)(
  {
    tasks: S.Array(TurboDryRunTask),
  },
  $I.annote("TurboDryRunDocument", {
    description: "Turbo dry-run JSON document.",
  })
) {}

const decodeTurboDryRunDocument = S.decodeUnknownEffect(S.fromJsonString(TurboDryRunDocument));
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

type DocgenLocalEnvironment = FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner;
type DocgenLocalOptions = {
  readonly allowFull: boolean;
  readonly base: string;
  readonly full: boolean;
  readonly head: string;
  readonly json: boolean;
  readonly packageSelector: O.Option<string>;
  readonly parallel: number;
  readonly plan: boolean;
};

const byPackagePathAscending: Order.Order<DocgenWorkspacePackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenWorkspacePackage) => pkg.relativePath
);
const bySelectedPackagePathAscending: Order.Order<DocgenLocalSelectedPackage> = Order.mapInput(
  Order.String,
  (pkg: DocgenLocalSelectedPackage) => pkg.path
);
const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);
const normalizedFilePath = flow(Str.trim, normalizeSlashes);
const packagePrefix = (pkg: DocgenWorkspacePackage): string => `${pkg.relativePath}/`;
const isNonEmptyLine = flow(Str.trim, Str.isNonEmpty);
const localParallel = (parallel: number): number => Math.max(DEFAULT_LOCAL_PARALLEL, parallel);
const turboFilterForPackage = (pkg: DocgenLocalSelectedPackage): string => `--filter=...${pkg.name}`;
const hasPrefix = (prefixes: ReadonlyArray<string>, filePath: string): boolean =>
  A.some(prefixes, (prefix) => Str.startsWith(prefix)(filePath));
const hasExtension = (extensions: ReadonlyArray<string>, filePath: string): boolean =>
  A.some(extensions, (extension) => Str.endsWith(extension)(filePath));
const isExactFile = (files: ReadonlyArray<string>, filePath: string): boolean => A.contains(files, filePath);
const collectOptions = <T>(options: ReadonlyArray<O.Option<T>>): ReadonlyArray<T> => {
  const values = A.empty<T>();
  for (const option of options) {
    if (O.isSome(option)) {
      A.appendInPlace(values, option.value);
    }
  }
  return values;
};

/**
 * Local docgen execution mode selected by the planner.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { DocgenLocalMode } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * console.log(DocgenLocalMode.is.scoped("scoped"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocgenLocalMode = LiteralKit(["scoped", "full", "full-required", "noop"]).pipe(
  $I.annoteSchema("DocgenLocalMode", {
    description: "Local docgen execution mode selected by the planner.",
  })
);

/**
 * Local docgen execution mode selected by the planner.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import type { DocgenLocalMode } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const mode: DocgenLocalMode = "scoped"
 * console.log(mode) // example value
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocgenLocalMode = typeof DocgenLocalMode.Type;

/**
 * Package selected for a local docgen run.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { DocgenLocalSelectedPackage } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const selected = DocgenLocalSelectedPackage.make({
 *   name: "@beep/schema",
 *   path: "packages/foundation/modeling/schema",
 *   reasons: ["packages/foundation/modeling/schema/src/index.ts"]
 * })
 * console.log(selected.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenLocalSelectedPackage extends S.Class<DocgenLocalSelectedPackage>($I`DocgenLocalSelectedPackage`)(
  {
    name: S.String,
    path: S.String,
    reasons: S.Array(S.String),
  },
  $I.annote("DocgenLocalSelectedPackage", {
    description: "Package selected for a local docgen run.",
  })
) {}

/**
 * Reason local docgen must escalate to the full proof.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { DocgenLocalFullReason } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const reason = DocgenLocalFullReason.make({
 *   filePath: "turbo.json",
 *   message: "Global docgen input changed"
 * })
 * console.log(reason.message)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenLocalFullReason extends S.Class<DocgenLocalFullReason>($I`DocgenLocalFullReason`)(
  {
    filePath: S.String,
    message: S.String,
  },
  $I.annote("DocgenLocalFullReason", {
    description: "Reason local docgen must escalate to the full proof.",
  })
) {}

/**
 * Planned local docgen proof.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { DocgenLocalPlan } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const plan = DocgenLocalPlan.make({
 *   base: "origin/main",
 *   changedFiles: [],
 *   fallbackCommand: "bun run docgen",
 *   fullReasons: [],
 *   head: "HEAD",
 *   mode: "noop",
 *   parallel: 1,
 *   selectedPackages: [],
 *   turboArgs: []
 * })
 * console.log(plan.mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenLocalPlan extends S.Class<DocgenLocalPlan>($I`DocgenLocalPlan`)(
  {
    base: S.String,
    changedFiles: S.Array(S.String),
    fallbackCommand: S.String,
    fullReasons: S.Array(DocgenLocalFullReason),
    head: S.String,
    mode: DocgenLocalMode,
    parallel: S.Finite,
    selectedPackages: S.Array(DocgenLocalSelectedPackage),
    turboArgs: S.Array(S.String),
  },
  $I.annote("DocgenLocalPlan", {
    description: "Planned local docgen proof.",
  })
) {}

/**
 * Turbo dry-run package summary used by local docgen.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { DocgenLocalTurboTask } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const task = DocgenLocalTurboTask.make({
 *   cacheSource: "LOCAL",
 *   cacheStatus: "HIT",
 *   packageName: "@beep/schema",
 *   taskId: "@beep/schema#docgen"
 * })
 * console.log(task.packageName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenLocalTurboTask extends S.Class<DocgenLocalTurboTask>($I`DocgenLocalTurboTask`)(
  {
    cacheSource: S.optionalKey(S.String),
    cacheStatus: S.optionalKey(S.String),
    packageName: S.String,
    taskId: S.String,
  },
  $I.annote("DocgenLocalTurboTask", {
    description: "Turbo dry-run package summary used by local docgen.",
  })
) {}

const packageRelativeInput = (pkg: DocgenWorkspacePackage, filePath: string): O.Option<string> =>
  pipe(
    O.some(filePath),
    O.filter(Str.startsWith(packagePrefix(pkg))),
    O.map(Str.replace(new RegExp(`^${Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")(packagePrefix(pkg))}`), ""))
  );

const isPackageLocalDocgenInput = (relativePath: string): boolean =>
  isExactFile(DOCGEN_LOCAL_PACKAGE_INPUT_FILES, relativePath) ||
  (hasPrefix(DOCGEN_LOCAL_PACKAGE_INPUT_PREFIXES, relativePath) &&
    hasExtension(DOCGEN_LOCAL_PACKAGE_INPUT_EXTENSIONS, relativePath));

const fullReasonForFile = (filePath: string): O.Option<DocgenLocalFullReason> => {
  if (isExactFile(DOCGEN_LOCAL_FULL_INPUT_FILES, filePath)) {
    return O.some(
      DocgenLocalFullReason.make({
        filePath,
        message: "Global docgen or Turbo input changed.",
      })
    );
  }

  if (hasPrefix(DOCGEN_LOCAL_FULL_INPUT_PREFIXES, filePath)) {
    return O.some(
      DocgenLocalFullReason.make({
        filePath,
        message: "Docgen tooling changed.",
      })
    );
  }

  return O.none();
};

const selectPackage = (
  pkg: DocgenWorkspacePackage,
  changedFiles: ReadonlyArray<string>
): O.Option<DocgenLocalSelectedPackage> => {
  const reasons = pipe(
    changedFiles,
    A.map((filePath) =>
      pipe(
        packageRelativeInput(pkg, filePath),
        O.filter(isPackageLocalDocgenInput),
        O.map(() => filePath)
      )
    ),
    collectOptions,
    A.dedupe,
    A.sort(Order.String)
  );

  if (A.isReadonlyArrayEmpty(reasons)) {
    return O.none();
  }

  return O.some(
    DocgenLocalSelectedPackage.make({
      name: pkg.name,
      path: pkg.relativePath,
      reasons,
    })
  );
};

const selectedPackageFromWorkspacePackage = (
  pkg: DocgenWorkspacePackage,
  reasons: ReadonlyArray<string>
): DocgenLocalSelectedPackage =>
  DocgenLocalSelectedPackage.make({
    name: pkg.name,
    path: pkg.relativePath,
    reasons,
  });

const turboArgsForSelectedPackages = (
  selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>,
  parallel: number
): ReadonlyArray<string> => [
  "turbo",
  "run",
  "docgen",
  ...A.map(selectedPackages, turboFilterForPackage),
  `--concurrency=${localParallel(parallel)}`,
  "--summarize",
  "--ui=stream",
];

const runGitLines = Effect.fn("DocgenLocal.runGitLines")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const result = yield* runCaptured({
    command: "git",
    args,
    cwd: repoRoot,
    source: "stdout",
  });
  if (result.exitCode !== 0) {
    return yield* DomainError.make({
      message: `git ${A.join(args, " ")} failed with exit code ${result.exitCode}: ${Str.trim(result.output)}`,
    });
  }

  return pipe(Str.split(/\r?\n/)(result.output), A.map(normalizedFilePath), A.filter(isNonEmptyLine));
});

const collectChangedFiles = Effect.fn("DocgenLocal.collectChangedFiles")(function* (
  repoRoot: string,
  base: string,
  head: string
) {
  const baseChanged = yield* runGitLines(repoRoot, ["diff", "--name-only", `${base}...${head}`]).pipe(
    Effect.mapError(
      DomainError.newCause(
        `Unable to resolve local docgen base range ${base}...${head}. Pass --package, --full, or refresh ${base}.`
      )
    )
  );
  const workingTreeChanged = yield* Effect.forEach(
    [
      ["diff", "--name-only", "HEAD"] as const,
      ["diff", "--cached", "--name-only"] as const,
      ["ls-files", "--others", "--exclude-standard"] as const,
    ],
    (args) => runGitLines(repoRoot, args).pipe(Effect.option, Effect.map(O.getOrElse(A.empty<string>))),
    { concurrency: "unbounded" }
  );

  return pipe([...baseChanged, ...A.flatten(workingTreeChanged)], A.dedupe, A.sort(Order.String));
});

const discoverConfiguredPackages = Effect.fn("DocgenLocal.discoverConfiguredPackages")(function* () {
  yield* assertNoOrphanDocgenConfigPaths();
  return yield* discoverDocgenWorkspacePackages().pipe(
    Effect.map(
      flow(
        A.filter((pkg) => pkg.hasDocgenConfig),
        A.sort(byPackagePathAscending)
      )
    )
  );
});

const buildPlanFromChangedFiles = Effect.fn("DocgenLocal.buildPlanFromChangedFiles")(function* (
  options: DocgenLocalOptions,
  repoRoot: string
) {
  const changedFiles = yield* collectChangedFiles(repoRoot, options.base, options.head);
  const packages = yield* discoverConfiguredPackages();
  const selectedPackages = pipe(
    packages,
    A.map((pkg) => selectPackage(pkg, changedFiles)),
    collectOptions
  );
  const fullReasons = pipe(changedFiles, A.map(fullReasonForFile), collectOptions);
  const sortedSelectedPackages = A.sort(selectedPackages, bySelectedPackagePathAscending);
  const mode: DocgenLocalMode = pipe(
    [
      pipe(options.full, O.liftPredicate(P.isTruthy), O.as("full" as const)),
      pipe(fullReasons, O.liftPredicate(A.isReadonlyArrayNonEmpty), O.as("full-required" as const)),
      pipe(sortedSelectedPackages, O.liftPredicate(A.isReadonlyArrayEmpty), O.as("noop" as const)),
    ] satisfies ReadonlyArray<O.Option<DocgenLocalMode>>,
    O.firstSomeOf,
    O.getOrElse(() => "scoped" as const)
  );

  return DocgenLocalPlan.make({
    base: options.base,
    changedFiles,
    fallbackCommand: DOCGEN_FULL_COMMAND,
    fullReasons,
    head: options.head,
    mode,
    parallel: localParallel(options.parallel),
    selectedPackages: sortedSelectedPackages,
    turboArgs: mode === "scoped" ? [...turboArgsForSelectedPackages(sortedSelectedPackages, options.parallel)] : [],
  });
});

const buildPlanFromPackage = Effect.fn("DocgenLocal.buildPlanFromPackage")(function* (options: DocgenLocalOptions) {
  const packageSelector = O.getOrUndefined(options.packageSelector);
  if (P.isUndefined(packageSelector)) {
    return yield* DomainError.make({ message: "Expected a package selector." });
  }

  const target = yield* resolveDocgenWorkspacePackage(packageSelector);
  if (!target.hasDocgenConfig) {
    return yield* DomainError.make({
      message: `${target.relativePath} is missing docgen.json. Run "bun run beep docgen init -p ${target.relativePath}" first.`,
    });
  }

  const selectedPackages = [selectedPackageFromWorkspacePackage(target, [`--package ${packageSelector}`])] as const;
  const mode: DocgenLocalMode = options.full ? "full" : "scoped";

  return DocgenLocalPlan.make({
    base: options.base,
    changedFiles: A.empty(),
    fallbackCommand: DOCGEN_FULL_COMMAND,
    fullReasons: A.empty(),
    head: options.head,
    mode,
    parallel: localParallel(options.parallel),
    selectedPackages,
    turboArgs: mode === "scoped" ? [...turboArgsForSelectedPackages(selectedPackages, options.parallel)] : [],
  });
});

const commandText = (command: string, args: ReadonlyArray<string>): string => A.join([command, ...args], " ");

const runStep = Effect.fn("DocgenLocal.runStep")(function* (
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const cmdTxt = commandText(command, args);
  yield* Console.log(`[docgen:local] ${label}: ${cmdTxt}`);
  const exitCode = yield* runToExit({
    command,
    args,
    cwd,
    stdio: "inherit",
  }).pipe(Effect.mapError(DomainError.newCause(`Failed to spawn ${cmdTxt}.`)));

  if (exitCode !== 0) {
    return yield* DomainError.make({
      message: `${label} failed with exit code ${exitCode}.`,
    });
  }
});

const collectStepOutput = Effect.fn("DocgenLocal.collectStepOutput")(function* (
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  yield* Console.log(`[docgen:local] ${label}: ${commandText(command, args)}`);
  const result = yield* runCapturedStreams({
    command,
    args,
    cwd,
  }).pipe(Effect.mapError(DomainError.newCause(`Failed to collect ${label} output.`)));
  if (result.exitCode !== 0) {
    const details = pipe([Str.trim(result.stdout), Str.trim(result.stderr)], A.filter(Str.isNonEmpty), A.join("\n"));
    return yield* DomainError.make({
      message:
        details.length > 0
          ? `${label} failed with exit code ${result.exitCode}: ${details}`
          : `${label} failed with exit code ${result.exitCode}.`,
    });
  }
  return result.stdout;
});

const decodeTurboDryRun = Effect.fn("DocgenLocal.decodeTurboDryRun")(function* (output: string) {
  return yield* decodeTurboDryRunDocument(output).pipe(
    Effect.mapError(DomainError.newCauseMessage("Failed to decode Turbo docgen dry-run JSON"))
  );
});

const summarizeTurboTasks = (output: TurboDryRunDocument): ReadonlyArray<DocgenLocalTurboTask> =>
  pipe(
    output.tasks,
    A.map((task) => {
      if (task.task !== "docgen" || P.isUndefined(task.package)) {
        return O.none();
      }

      return O.some(
        DocgenLocalTurboTask.make({
          packageName: task.package,
          taskId: task.taskId ?? `${task.package}#docgen`,
          ...(P.isUndefined(task.cache?.source) ? {} : { cacheSource: task.cache.source }),
          ...(P.isUndefined(task.cache?.status) ? {} : { cacheStatus: task.cache.status }),
        })
      );
    }),
    collectOptions,
    A.dedupeWith((left, right) => left.packageName === right.packageName && left.taskId === right.taskId),
    A.sort(Order.mapInput(Order.String, (task: DocgenLocalTurboTask) => task.packageName))
  );

const resolveTurboTaskPackages = Effect.fn("DocgenLocal.resolveTurboTaskPackages")(function* (
  tasks: ReadonlyArray<DocgenLocalTurboTask>
) {
  const packages = yield* discoverConfiguredPackages();
  const packageNames = pipe(
    tasks,
    A.map((task) => task.packageName),
    A.dedupe
  );
  return pipe(
    packages,
    A.filter((pkg) => A.contains(packageNames, pkg.name)),
    A.sort(byPackagePathAscending)
  );
});

const renderPackageList = (packages: ReadonlyArray<DocgenLocalSelectedPackage>): string =>
  A.isReadonlyArrayEmpty(packages)
    ? "(none)"
    : A.join(
        A.map(packages, (pkg) => `${pkg.name} (${pkg.path})`),
        ", "
      );

const renderTurboTaskList = (tasks: ReadonlyArray<DocgenLocalTurboTask>): string =>
  A.isReadonlyArrayEmpty(tasks)
    ? "(none)"
    : A.join(
        A.map(
          tasks,
          (task) =>
            `${task.packageName}${P.isUndefined(task.cacheStatus) ? "" : ` [${task.cacheStatus}${P.isUndefined(task.cacheSource) ? "" : `:${task.cacheSource}`}]`}`
        ),
        ", "
      );

const renderProofStatusList = (statuses: ReadonlyArray<DocgenProofManifestVerification>): string =>
  A.isReadonlyArrayEmpty(statuses)
    ? "(none)"
    : A.join(
        A.map(
          statuses,
          (status) =>
            `${status.packageName} [${status.status}${P.isUndefined(status.reason) ? "" : `: ${status.reason}`}]`
        ),
        ", "
      );

const renderFullReasons = (reasons: ReadonlyArray<DocgenLocalFullReason>): string =>
  A.join(
    A.map(reasons, (reason) => `- ${reason.filePath}: ${reason.message}`),
    "\n"
  );

const renderPlan = Effect.fn("DocgenLocal.renderPlan")(function* (plan: DocgenLocalPlan) {
  yield* printLines([
    "docgen:local plan",
    `- mode: ${plan.mode}`,
    `- base: ${plan.base}`,
    `- head: ${plan.head}`,
    `- package concurrency: ${plan.parallel}`,
    `- selected packages: ${renderPackageList(plan.selectedPackages)}`,
  ]);
  if (A.isReadonlyArrayNonEmpty(plan.turboArgs)) {
    yield* Console.log(`- turbo command: bunx ${A.join(plan.turboArgs, " ")}`);
  }
  yield* Console.log(`- full proof: ${plan.fallbackCommand}`);
  if (A.isReadonlyArrayNonEmpty(plan.fullReasons)) {
    yield* Console.log(`- full proof required:\n${renderFullReasons(plan.fullReasons)}`);
  }
});

const renderPlanJson = Effect.fn("DocgenLocal.renderPlanJson")(function* (plan: DocgenLocalPlan) {
  const json = yield* encodeJson(plan).pipe(
    Effect.mapError(DomainError.newCauseMessage("Failed to encode docgen:local plan JSON"))
  );
  yield* Console.log(`${json}\n`);
});

const checkPackageDocumentation = Effect.fn("DocgenLocal.checkPackageDocumentation")(function* (
  packages: ReadonlyArray<DocgenWorkspacePackage>,
  parallel: number
) {
  const analyses = yield* Effect.forEach(packages, analyzePackageDocumentation, {
    concurrency: localParallel(parallel),
  });
  const failures = A.filter(analyses, (analysis) => analysis.summary.missingDocumentation > 0);

  for (const analysis of failures) {
    yield* Console.error(
      `docgen:local: ${analysis.packagePath} has ${analysis.summary.missingDocumentation} export(s) missing docgen metadata`
    );
    for (const issue of analysis.exports) {
      const issueText = A.join(
        [
          ...(issue.missingTags.length === 0 ? A.empty() : [`missing ${A.join(issue.missingTags, ", ")}`]),
          ...(issue.categoryIssues.length === 0
            ? A.empty()
            : [`invalid category: ${A.join(issue.categoryIssues, "; ")}`]),
        ],
        "; "
      );
      if (Str.isNonEmpty(issueText)) {
        yield* Console.error(`  ${issue.filePath}:${issue.line} ${issue.name} ${issueText}`);
      }
    }
  }

  if (A.isReadonlyArrayNonEmpty(failures)) {
    return yield* DomainError.make({
      message: `docgen:local JSDoc check failed for ${A.length(failures)} package(s).`,
    });
  }
});

const aggregatePackages = Effect.fn("DocgenLocal.aggregatePackages")(function* (
  packages: ReadonlyArray<DocgenWorkspacePackage>
) {
  for (const pkg of packages) {
    const results = yield* aggregateGeneratedDocs({ package: pkg.relativePath });
    for (const result of results) {
      yield* Console.log(`docgen:local: aggregated ${result.packagePath} -> docs/generated/${result.docsOutputPath}`);
    }
  }
});

const verifyPackageProofManifest = (pkg: DocgenWorkspacePackage) =>
  verifyDocgenProofManifest(pkg.absolutePath, pkg.name).pipe(
    Effect.mapError((cause) =>
      DomainError.make({
        message: `Failed to verify docgen proof manifest for ${pkg.name}.`,
        cause,
      })
    )
  );

const runFullDocgen = Effect.fn("DocgenLocal.runFullDocgen")(function* (repoRoot: string) {
  yield* runStep("full docgen", "bun", ["run", "docgen"], repoRoot);
});

const runScopedDocgen = Effect.fn("DocgenLocal.runScopedDocgen")(function* (plan: DocgenLocalPlan, repoRoot: string) {
  const dryRunOutput = yield* collectStepOutput(
    "turbo dry-run",
    "bunx",
    [...plan.turboArgs, "--dry-run=json"],
    repoRoot
  );
  const dryRun = yield* decodeTurboDryRun(dryRunOutput);
  const turboTasks = summarizeTurboTasks(dryRun);
  yield* Console.log(`docgen:local: expanded Turbo packages: ${renderTurboTaskList(turboTasks)}`);

  const packages = yield* resolveTurboTaskPackages(turboTasks);
  if (A.isReadonlyArrayEmpty(packages)) {
    yield* Console.log("docgen:local: no Turbo docgen tasks selected");
    return;
  }

  const proofStatuses = yield* Effect.forEach(packages, verifyPackageProofManifest, {
    concurrency: localParallel(plan.parallel),
  });
  yield* Console.log(`docgen:local: proof manifests: ${renderProofStatusList(proofStatuses)}`);

  if (A.every(proofStatuses, (status) => status.status === "current")) {
    yield* Console.log(`docgen:local: reused ${A.length(proofStatuses)} current package proof manifest(s)`);
  } else {
    yield* checkPackageDocumentation(packages, plan.parallel);
    yield* runStep("turbo docgen", "bunx", plan.turboArgs, repoRoot);
  }

  yield* aggregatePackages(packages);
});

/**
 * Select package-local docgen targets for changed files.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { selectDocgenLocalPackagesForTesting } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const selected = selectDocgenLocalPackagesForTesting([], [
 *   "packages/foundation/modeling/schema/src/index.ts"
 * ])
 * console.log(selected.length)
 * ```
 *
 * @param packages - Workspace packages eligible for docgen selection.
 * @param changedFiles - Repo-relative changed file paths to classify.
 * @returns Packages selected for a scoped local docgen run.
 * @category testing
 * @since 0.0.0
 */
export const selectDocgenLocalPackagesForTesting: {
  (
    changedFiles: ReadonlyArray<string>
  ): (packages: ReadonlyArray<DocgenWorkspacePackage>) => ReadonlyArray<DocgenLocalSelectedPackage>;
  (
    packages: ReadonlyArray<DocgenWorkspacePackage>,
    changedFiles: ReadonlyArray<string>
  ): ReadonlyArray<DocgenLocalSelectedPackage>;
} = dual(2, (packages: ReadonlyArray<DocgenWorkspacePackage>, changedFiles: ReadonlyArray<string>) =>
  pipe(
    packages,
    A.map((pkg) => selectPackage(pkg, A.map(changedFiles, normalizedFilePath))),
    collectOptions,
    A.sort(bySelectedPackagePathAscending)
  )
);

/**
 * Build Turbo argv for local docgen targets.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { docgenLocalTurboArgsForTesting } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const args = docgenLocalTurboArgsForTesting([
 *   { name: "@beep/schema", path: "packages/foundation/modeling/schema", reasons: [] }
 * ], 1)
 * console.log(args.join(" "))
 * ```
 *
 * @param selectedPackages - Packages selected for local docgen execution.
 * @param parallel - Maximum package concurrency requested by the caller.
 * @returns Turbo command arguments for the scoped local docgen run.
 * @category testing
 * @since 0.0.0
 */
export const docgenLocalTurboArgsForTesting: {
  (parallel: number): (selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>) => ReadonlyArray<string>;
  (selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>, parallel: number): ReadonlyArray<string>;
} = dual(2, (selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>, parallel: number) =>
  turboArgsForSelectedPackages(selectedPackages, parallel)
);

/**
 * Resolve changed files that require the full docgen proof.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { docgenLocalFullReasonsForTesting } from "@beep/repo-cli/commands/Docgen/internal/Local"
 *
 * const reasons = docgenLocalFullReasonsForTesting(["turbo.json"])
 * console.log(reasons[0]?.filePath)
 * ```
 *
 * @param changedFiles - Repo-relative changed file paths to classify.
 * @returns Reasons the changed file set requires the full docgen proof.
 * @category testing
 * @since 0.0.0
 */
export const docgenLocalFullReasonsForTesting = (
  changedFiles: ReadonlyArray<string>
): ReadonlyArray<DocgenLocalFullReason> =>
  flow(A.map(normalizedFilePath), A.map(fullReasonForFile), collectOptions)(changedFiles);

const buildDocgenLocalPlanWithRepoRoot = Effect.fn("DocgenLocal.buildDocgenLocalPlanWithRepoRoot")(function* (
  options: DocgenLocalOptions,
  repoRoot: string
) {
  return yield* O.isSome(options.packageSelector)
    ? buildPlanFromPackage(options)
    : buildPlanFromChangedFiles(options, repoRoot);
});

/**
 * Build a local docgen plan from repository state and command options.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { buildDocgenLocalPlan } from "@beep/repo-cli/commands/Docgen/internal/Local"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = buildDocgenLocalPlan({
 *   allowFull: false,
 *   base: "origin/main",
 *   full: false,
 *   head: "HEAD",
 *   json: false,
 *   packageSelector: O.none(),
 *   parallel: 1,
 *   plan: true
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const buildDocgenLocalPlan: (
  options: DocgenLocalOptions
) => Effect.Effect<
  DocgenLocalPlan,
  DomainError | NoSuchFileError,
  FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner
> = Effect.fn("DocgenLocal.buildDocgenLocalPlan")(function* (options) {
  const repoRoot = yield* findRepoRoot();
  return yield* buildDocgenLocalPlanWithRepoRoot(options, repoRoot);
});

/**
 * Run the bounded local docgen proof.
 *
 * **Example** (Plan local docgen work)
 *
 * ```ts
 * import { runDocgenLocal } from "@beep/repo-cli/commands/Docgen/internal/Local"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = runDocgenLocal({
 *   base: "origin/main",
 *   full: false,
 *   head: "HEAD",
 *   json: false,
 *   packageSelector: O.none(),
 *   parallel: 1,
 *   plan: true
 * })
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @category workflows
 * @since 0.0.0
 */
export const runDocgenLocal: (
  options: DocgenLocalOptions
) => Effect.Effect<DocgenLocalPlan, CliReportedExit | DomainError | NoSuchFileError, DocgenLocalEnvironment> =
  Effect.fn("DocgenLocal.runDocgenLocal")(function* (options) {
    if (options.json && !options.plan) {
      return yield* DomainError.make({
        message: "--json requires --plan for docgen:local so stdout remains machine-readable.",
      });
    }

    const repoRoot = yield* findRepoRoot();
    const plan = yield* buildDocgenLocalPlanWithRepoRoot(options, repoRoot);

    if (options.json) {
      yield* renderPlanJson(plan);
    } else {
      yield* renderPlan(plan);
    }

    if (options.plan) {
      if (plan.mode === "full-required") {
        return yield* failWithReportedExit("docgen:local: full docgen proof required.");
      }
      return plan;
    }

    if (plan.mode === "full-required") {
      if (options.allowFull) {
        yield* Console.log("docgen:local: full docgen proof required; executing it (--allow-full).");
        yield* runFullDocgen(repoRoot);
        return plan;
      }
      yield* Console.error('docgen:local: full docgen proof required; re-run with "--full" to execute it.');
      return yield* failWithReportedExit("docgen:local: full docgen proof required.");
    }

    if (plan.mode === "noop") {
      yield* Console.log("docgen:local: no package-local docgen inputs changed");
      return plan;
    }

    if (plan.mode === "full") {
      yield* runFullDocgen(repoRoot);
      return plan;
    }

    yield* runScopedDocgen(plan, repoRoot);
    return plan;
  });
