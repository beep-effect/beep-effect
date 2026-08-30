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
import { Unknown } from "@beep/schema/Unknown";
import { A, Str } from "@beep/utils";
import { Console, Duration, Effect, flow, HashSet, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import { readTurboCacheEnvironment } from "../../../internal/cli/EnvConfig.ts";
import { failWithReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import { printLines } from "../../../internal/cli/Printer.ts";
import { resolveTurboCachePlan, turboCachePlanArgs } from "../../../internal/cli/TurboCache.ts";
import { runCapturedStreams } from "../../../internal/process/StepExec.ts";
import { collectChangedFiles } from "../../../internal/repo-run/ChangedFiles.ts";
import {
  aggregateGeneratedDocs,
  analyzePackageDocumentation,
  assertNoOrphanDocgenConfigPaths,
  discoverDocgenWorkspacePackages,
  loadDocgenConfigDocument,
  resolveDocgenWorkspacePackage,
} from "./Operations.ts";
import type { DocgenProofManifestVerification } from "@beep/repo-docgen/ProofManifest";
import type { FsUtils, NoSuchFileError } from "@beep/repo-utils";
import type { FileSystem, Path } from "effect";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import type { CliReportedExit } from "../../../internal/cli/ExitCodeError.ts";
import type { DocgenConfigDocument, DocgenPackageAnalysis, DocgenWorkspacePackage } from "./Operations.ts";

const $I = $RepoCliId.create("commands/Docgen/internal/Local");

/**
 * Render the missing-tag and category diagnostics shared by docgen checks.
 *
 * @param missingTags - Required JSDoc tags absent from the subject.
 * @param categoryIssues - Invalid category diagnostics for the subject.
 * @returns A semicolon-separated diagnostic summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderDocgenIssueText: {
  (categoryIssues: ReadonlyArray<string>): (missingTags: ReadonlyArray<string>) => string;
  (missingTags: ReadonlyArray<string>, categoryIssues: ReadonlyArray<string>): string;
} = dual(2, (missingTags: ReadonlyArray<string>, categoryIssues: ReadonlyArray<string>): string =>
  A.join(
    [
      ...(A.isReadonlyArrayEmpty(missingTags) ? A.empty() : [`missing ${A.join(missingTags, ", ")}`]),
      ...(A.isReadonlyArrayEmpty(categoryIssues) ? A.empty() : [`invalid category: ${A.join(categoryIssues, "; ")}`]),
    ],
    "; "
  )
);

const DEFAULT_LOCAL_PARALLEL = 1 as const;
const DOCGEN_FULL_COMMAND = "bun run docgen" as const;
const DOCGEN_FULL_AGGREGATE_ARGS = ["run", "docs:aggregate"] as const;
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

class DocgenProcessDiagnostic extends S.Class<DocgenProcessDiagnostic>($I`DocgenProcessDiagnostic`)(
  {
    pid: S.FiniteFromString.check(S.isInt(), S.isGreaterThan(0)),
    parentPid: S.FiniteFromString.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    elapsedSeconds: S.FiniteFromString.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    state: S.NonEmptyString,
    executable: S.NonEmptyString,
  },
  $I.annote("DocgenProcessDiagnostic", {
    description: "Sanitized process identity and state for one member of a stalled docgen child tree.",
  })
) {}

const decodeTurboDryRunDocument = S.decodeUnknownEffect(S.fromJsonString(TurboDryRunDocument));
const decodeDocgenProcessDiagnostic = S.decodeUnknownOption(DocgenProcessDiagnostic);
const encodeJson = Unknown.encodeUnknownEffectFromJsonString;

type DocgenLocalEnvironment = Crypto.Crypto | FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner;
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

const localTurboCacheArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  turboCachePlanArgs(resolveTurboCachePlan(readTurboCacheEnvironment(Bun.env), { args, ci: Bun.env.CI === "true" }));

const turboArgsForSelectedPackages = (
  selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>,
  parallel: number
): ReadonlyArray<string> => {
  const args = [
    ...A.map(selectedPackages, turboFilterForPackage),
    `--concurrency=${localParallel(parallel)}`,
    "--summarize",
    "--ui=stream",
    // No background daemon: a daemon spawned inside this child survives it and
    // holds process handles, which repeatedly kept the hosted Docgen lane's bun
    // wrapper from exiting after successful runs (hang or SIGABRT at teardown).
    // Turbo 2.10 dropped the `--daemon=false` value form (and no longer uses
    // the daemon for `turbo run` at all); `--no-daemon` remains accepted.
    "--no-daemon",
  ];
  return ["turbo", "run", "docgen", ...localTurboCacheArgs(args), ...args];
};

const fullTurboArgs = (parallel: number): ReadonlyArray<string> => {
  const args = [`--concurrency=${localParallel(parallel)}`];
  return ["run", "docgen", ...localTurboCacheArgs(args), ...args];
};

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

const buildFullPlan = (options: DocgenLocalOptions): DocgenLocalPlan =>
  DocgenLocalPlan.make({
    base: options.base,
    changedFiles: A.empty(),
    fallbackCommand: DOCGEN_FULL_COMMAND,
    fullReasons: A.empty(),
    head: options.head,
    mode: "full",
    parallel: localParallel(options.parallel),
    selectedPackages: A.empty(),
    turboArgs: A.empty(),
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

const DOCGEN_PROCESS_DIAGNOSTIC_LIMIT = 40;
const DOCGEN_PROCESS_DIAGNOSTIC_LINE = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/u;
const byDocgenProcessPidAscending: Order.Order<DocgenProcessDiagnostic> = Order.mapInput(
  Order.Number,
  (diagnostic: DocgenProcessDiagnostic) => diagnostic.pid
);

const parseDocgenProcessDiagnostics = (output: string): ReadonlyArray<DocgenProcessDiagnostic> =>
  pipe(
    A.fromIterable(Str.linesIterator(output)),
    A.map(
      flow(
        Str.match(DOCGEN_PROCESS_DIAGNOSTIC_LINE),
        O.flatMap((match) =>
          pipe(
            O.all({
              pid: O.fromUndefinedOr(match[1]),
              parentPid: O.fromUndefinedOr(match[2]),
              elapsedSeconds: O.fromUndefinedOr(match[3]),
              state: O.fromUndefinedOr(match[4]),
              executable: O.fromUndefinedOr(match[5]),
            }),
            O.flatMap(decodeDocgenProcessDiagnostic)
          )
        )
      )
    ),
    A.getSomes,
    A.sort(byDocgenProcessPidAscending)
  );

const queryDocgenProcesses = Effect.fn("DocgenLocal.queryDocgenProcesses")(function* (
  repoRoot: string,
  processIds: ReadonlyArray<number>,
  selectChildren: boolean
) {
  if (A.isReadonlyArrayEmpty(processIds)) {
    return O.some(A.empty<DocgenProcessDiagnostic>());
  }

  const result = yield* runCapturedStreams({
    command: "ps",
    args: [
      "-ww",
      "-o",
      "pid=,ppid=,etimes=,stat=,comm=",
      selectChildren ? "--ppid" : "-p",
      A.join(
        A.map(processIds, (processId) => `${processId}`),
        ","
      ),
    ],
    cwd: repoRoot,
  }).pipe(Effect.option);

  return pipe(
    result,
    O.map((captured) =>
      captured.exitCode === 0 ? parseDocgenProcessDiagnostics(captured.stdout) : A.empty<DocgenProcessDiagnostic>()
    )
  );
});

const collectDocgenProcessTree = Effect.fn("DocgenLocal.collectDocgenProcessTree")(function* (
  repoRoot: string,
  rootProcessId: number
) {
  const root = yield* queryDocgenProcesses(repoRoot, [rootProcessId], false);
  if (O.isNone(root)) {
    return O.none<ReadonlyArray<DocgenProcessDiagnostic>>();
  }

  let diagnostics = A.take(root.value, DOCGEN_PROCESS_DIAGNOSTIC_LIMIT);
  let frontier = A.map(diagnostics, (diagnostic) => diagnostic.pid);
  let seenProcessIds = HashSet.fromIterable(frontier);

  while (A.isReadonlyArrayNonEmpty(frontier) && A.length(diagnostics) < DOCGEN_PROCESS_DIAGNOSTIC_LIMIT) {
    const children = yield* queryDocgenProcesses(repoRoot, frontier, true);
    if (O.isNone(children)) {
      return O.none<ReadonlyArray<DocgenProcessDiagnostic>>();
    }

    const remaining = DOCGEN_PROCESS_DIAGNOSTIC_LIMIT - A.length(diagnostics);
    const discovered = pipe(
      children.value,
      A.filter((diagnostic) => !HashSet.has(seenProcessIds, diagnostic.pid)),
      A.take(remaining)
    );
    diagnostics = A.appendAll(diagnostics, discovered);
    seenProcessIds = A.reduce(discovered, seenProcessIds, (seen, diagnostic) => HashSet.add(seen, diagnostic.pid));
    frontier = A.map(discovered, (diagnostic) => diagnostic.pid);
  }

  return O.some(A.sort(diagnostics, byDocgenProcessPidAscending));
});

const renderDocgenProcessTree = (diagnostics: ReadonlyArray<DocgenProcessDiagnostic>): string =>
  A.isReadonlyArrayEmpty(diagnostics)
    ? "(none)"
    : A.join(
        A.map(
          diagnostics,
          (diagnostic) =>
            `pid=${diagnostic.pid} ppid=${diagnostic.parentPid} executable=${diagnostic.executable} state=${diagnostic.state} elapsed=${diagnostic.elapsedSeconds}s`
        ),
        "\n"
      );

// Inspect only the process tree rooted at the docgen child. Each ps invocation
// selects known PIDs or their direct children, and `comm` deliberately exposes
// executable identity without the raw argument values carried by `args`.
const logDocgenProcessTree = Effect.fn("DocgenLocal.logDocgenProcessTree")(function* (
  reason: string,
  repoRoot: string,
  rootProcessId: number
) {
  const diagnostics = yield* collectDocgenProcessTree(repoRoot, rootProcessId);
  yield* pipe(
    diagnostics,
    O.match({
      onNone: () => Console.log(`docgen:local: ${reason}: child process-tree diagnostics unavailable`),
      onSome: (rows) => Console.log(`docgen:local: ${reason}: child process tree:\n${renderDocgenProcessTree(rows)}`),
    })
  );
});

const runStep = Effect.fn("DocgenLocal.runStep")(function* (
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  cwd: string,
  options: {
    readonly forceKillAfter: Duration.Duration;
    readonly timeout: Duration.Duration;
    readonly timeoutReason: string;
  }
) {
  const cmdTxt = commandText(command, args);
  return yield* Effect.scoped(
    Effect.gen(function* () {
      yield* Console.log(`[docgen:local] ${label}: started: ${cmdTxt}`);
      const handle = yield* ChildProcess.make(command, args, {
        cwd,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
        forceKillAfter: options.forceKillAfter,
      }).pipe(Effect.mapError(DomainError.newCause(`Failed to spawn ${cmdTxt}.`)));
      const outcome = yield* Effect.timeoutOption(
        Effect.timed(handle.exitCode).pipe(Effect.mapError(DomainError.newCause(`Failed to await ${cmdTxt}.`))),
        options.timeout
      );
      if (O.isNone(outcome)) {
        yield* logDocgenProcessTree(options.timeoutReason, cwd, handle.pid);
        return false;
      }

      const [elapsed, exitCode] = outcome.value;
      yield* Console.log(`[docgen:local] ${label}: exited ${exitCode} after ${Duration.format(elapsed)}`);
      if (exitCode !== 0) {
        return yield* DomainError.make({
          message: `${label} failed with exit code ${exitCode}.`,
        });
      }
      return true;
    })
  );
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
  if (plan.mode === "full") {
    yield* Console.log(`- full turbo command: node_modules/.bin/turbo ${A.join(fullTurboArgs(plan.parallel), " ")}`);
    yield* Console.log(`- full aggregate command: bun ${A.join(DOCGEN_FULL_AGGREGATE_ARGS, " ")}`);
  }
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

const logDocumentationFailure = Effect.fn("DocgenLocal.logDocumentationFailure")(function* (
  analysis: DocgenPackageAnalysis
) {
  yield* Console.error(
    `docgen:local: ${analysis.packagePath} has ${analysis.summary.missingDocumentation} export(s) missing docgen metadata`
  );
  yield* Effect.forEach(
    analysis.exports,
    Effect.fnUntraced(function* (issue) {
      const issueText = renderDocgenIssueText(issue.missingTags, issue.categoryIssues);
      if (Str.isNonEmpty(issueText)) {
        yield* Console.error(`  ${issue.filePath}:${issue.line} ${issue.name} ${issueText}`);
      }
    }),
    { discard: true }
  );
});

const checkPackageDocumentation = Effect.fn("DocgenLocal.checkPackageDocumentation")(function* (
  packages: ReadonlyArray<DocgenWorkspacePackage>,
  parallel: number
) {
  const analyses = yield* Effect.forEach(packages, analyzePackageDocumentation, {
    concurrency: localParallel(parallel),
  });
  const failures = A.filter(analyses, (analysis) => analysis.summary.missingDocumentation > 0);

  yield* Effect.forEach(failures, logDocumentationFailure, { discard: true });

  if (A.isReadonlyArrayNonEmpty(failures)) {
    return yield* DomainError.make({
      message: `docgen:local JSDoc check failed for ${A.length(failures)} package(s).`,
    });
  }
});

/**
 * Decide whether a Docgen configuration emits the canonical aggregate input.
 *
 * **Example** (Exclude a focused quality-analysis output)
 *
 * ```ts
 * import { DocgenConfigDocument, isCanonicalDocgenAggregateConfigForTesting } from "@beep/repo-cli/test/Docgen"
 *
 * const config = DocgenConfigDocument.make({
 *   srcDir: ".",
 *   outDir: ".jsdoc-loop/generated-docs"
 * })
 * console.log(isCanonicalDocgenAggregateConfigForTesting(config)) // false
 * ```
 *
 * @param config - Parsed package-local Docgen configuration.
 * @returns Whether the configured output is the canonical `docs/modules` tree.
 * @category testing
 * @since 0.0.0
 */
export const isCanonicalDocgenAggregateConfigForTesting = (config: DocgenConfigDocument): boolean =>
  P.isUndefined(config.outDir) || config.outDir === "docs";

/**
 * Aggregate canonical Docgen outputs while ignoring focused auxiliary outputs.
 *
 * **Example** (Build the aggregate effect)
 *
 * ```ts
 * import { aggregateDocgenPackagesForTesting } from "@beep/repo-cli/test/Docgen"
 *
 * const aggregate = aggregateDocgenPackagesForTesting([])
 * console.log(aggregate)
 * ```
 *
 * Exposed through the test kit so the canonical and non-canonical configuration
 * branches can be exercised without spawning Turbo.
 *
 * @param packages - Resolved workspace packages emitted by the scoped Turbo plan.
 * @returns An effect yielding the number of packages that produced aggregate output.
 * @category testing
 * @since 0.0.0
 */
export const aggregateDocgenPackagesForTesting = Effect.fn("DocgenLocal.aggregatePackages")(function* (
  packages: ReadonlyArray<DocgenWorkspacePackage>
) {
  let aggregateCount = 0;
  for (const pkg of packages) {
    const config = yield* loadDocgenConfigDocument(pkg.absolutePath);
    if (!isCanonicalDocgenAggregateConfigForTesting(config)) {
      yield* Console.log(`docgen:local: skipped aggregation for ${pkg.name} (non-canonical outDir: ${config.outDir})`);
      continue;
    }

    const results = yield* aggregateGeneratedDocs({ package: pkg.relativePath });
    aggregateCount += A.length(results);
    for (const result of results) {
      yield* Console.log(`docgen:local: aggregated ${result.packagePath} -> docs/generated/${result.docsOutputPath}`);
    }
  }
  return aggregateCount;
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

const runFullDocgen = Effect.fn("DocgenLocal.runFullDocgen")(function* (repoRoot: string, parallel: number) {
  // Run Turbo directly so the typed lane concurrency setting governs full and
  // affected proofs through the same local command surface. The full budget is
  // much larger because a cold full proof legitimately runs for tens of minutes.
  yield* runStepWithStallWatchdog(
    "full turbo docgen",
    turboBinaryPath(repoRoot),
    fullTurboArgs(parallel),
    repoRoot,
    fullDocgenStepBudget
  );
  yield* runStepWithStallWatchdog(
    "full docs aggregate",
    "bun",
    DOCGEN_FULL_AGGREGATE_ARGS,
    repoRoot,
    fullDocgenStepBudget
  );
});

// Spawn the turbo binary directly: `bunx turbo` leaves a resident bun wrapper
// between the CLI and turbo, and the hosted Docgen lane showed bun processes
// on the fleet image failing to exit after successful work.
const turboBinaryPath = (repoRoot: string): string => `${repoRoot}/node_modules/.bin/turbo`;

const directTurboArgs = (turboArgs: ReadonlyArray<string>): ReadonlyArray<string> => A.drop(turboArgs, 1);

// Turbo has been observed on the hosted fleet to run every task to completion,
// print its summary, and then never exit: the Docgen lane burned its whole
// 60-minute budget after 2m8s of real work (run 31991634069, and again on the
// following push). The parent then sits in `runToExit` waiting on a child that
// is already done, so the CLI's exit-on-success teardown never gets to run --
// the stall is mid-program, not at exit, which is why the forced-exit
// teardowns in bin-main.ts and the docgen bin cannot help.
//
// By the time turbo wedges, every task has succeeded and its output is on disk
// and in .turbo/cache, so abandoning it and retrying costs seconds: the retry
// is a full cache hit. That turns an unrecoverable 60-minute stall into a
// recoverable blip. The budget is ~7x the observed CI runtime so a genuinely
// slow run is never cut short.
//
// This has NOT been reproduced off-runner -- the same command with the same
// zero-cache conditions finishes locally in 108s -- so treat it as containment
// for a fleet-specific stall, not as a root-cause fix.
type DocgenStepBudget = {
  readonly first: Duration.Duration;
  readonly retry: Duration.Duration;
};

// Scoped runs took 2m8s on the fleet before wedging, so ~7x headroom.
const scopedDocgenStepBudget: DocgenStepBudget = {
  first: Duration.minutes(15),
  retry: Duration.minutes(10),
};

// A cold full proof walks every package in the monorepo. Its budget has to
// clear a legitimately long run by a wide margin -- killing honest work would
// be far worse than the stall this guards against.
const fullDocgenStepBudget: DocgenStepBudget = {
  first: Duration.minutes(45),
  retry: Duration.minutes(30),
};

// Abandoning the step closes the child's scope, which signals the process
// group and then waits for the exit event. Without an escalation the wait is
// unbounded against a child ignoring SIGTERM, and the budgets above would not
// actually reclaim anything.
const docgenStepForceKillAfter = Duration.seconds(20);

const runStepWithStallWatchdog = Effect.fn("DocgenLocal.runStepWithStallWatchdog")(function* (
  label: string,
  command: string,
  args: ReadonlyArray<string>,
  repoRoot: string,
  budget: DocgenStepBudget
) {
  const attempt = (attemptLabel: string, timeout: Duration.Duration, timeoutReason: string) =>
    runStep(attemptLabel, command, args, repoRoot, {
      forceKillAfter: docgenStepForceKillAfter,
      timeout,
      timeoutReason,
    });

  const firstSucceeded = yield* attempt(label, budget.first, `after abandoning ${label}`);
  if (firstSucceeded) {
    return;
  }

  yield* Console.log(
    `docgen:local: ${label} never returned within ${Duration.format(budget.first)}; abandoning it and retrying once against the warm cache.`
  );

  const retrySucceeded = yield* attempt(`${label} (retry)`, budget.retry, `after the ${label} retry also stalled`);
  if (!retrySucceeded) {
    return yield* DomainError.make({
      message: `${label} never returned within ${Duration.format(budget.retry)} on retry; see the child process-tree diagnostics above.`,
    });
  }

  yield* Console.log(`docgen:local: ${label} retry succeeded after the first attempt stalled.`);
});

/**
 * Run one docgen child under the stall watchdog.
 *
 * **Details**
 *
 * Exposed so the stall path can be exercised directly. It only triggers against
 * a child that outlives its budget, which no production call reproduces on
 * demand, and the budgets the real callers use are deliberately measured in
 * tens of minutes.
 *
 * **Example** (Bound a child that exits normally)
 *
 * ```ts
 * import { runDocgenStepWithStallWatchdogForTesting } from "@beep/repo-cli/test/Docgen"
 * import { Duration } from "effect"
 *
 * const step = runDocgenStepWithStallWatchdogForTesting("probe", "true", [], "/repo", {
 *   first: Duration.seconds(5),
 *   retry: Duration.seconds(5)
 * })
 * console.log(step)
 * ```
 *
 * @param label - Operator-facing step label.
 * @param command - Executable to spawn.
 * @param args - Arguments passed to the executable.
 * @param repoRoot - Working directory for the child.
 * @param budget - First-attempt and retry ceilings.
 * @returns An effect completing when the step exits, failing if both attempts stall.
 * @category testing
 * @since 0.0.0
 */
export const runDocgenStepWithStallWatchdogForTesting = runStepWithStallWatchdog;

/**
 * Select the directly changed packages whose documentation metadata must be
 * checked during a scoped run. Turbo may expand the execution set to include
 * dependents, but the metadata ratchet applies only to the planner's direct
 * selections.
 *
 * @param packages - Packages in Turbo's expanded docgen task graph.
 * @param selectedPackages - Packages directly selected from changed files.
 * @returns Expanded packages that were directly selected by the planner.
 * @category testing
 * @since 0.0.0
 */
export const selectDirectDocgenPackagesForTesting: {
  (
    selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>
  ): (packages: ReadonlyArray<DocgenWorkspacePackage>) => ReadonlyArray<DocgenWorkspacePackage>;
  (
    packages: ReadonlyArray<DocgenWorkspacePackage>,
    selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>
  ): ReadonlyArray<DocgenWorkspacePackage>;
} = dual(
  2,
  (
    packages: ReadonlyArray<DocgenWorkspacePackage>,
    selectedPackages: ReadonlyArray<DocgenLocalSelectedPackage>
  ): ReadonlyArray<DocgenWorkspacePackage> => {
    const selectedNames = HashSet.fromIterable(A.map(selectedPackages, (selected) => selected.name));
    return A.filter(packages, (pkg) => HashSet.has(selectedNames, pkg.name));
  }
);

const runScopedDocgen = Effect.fn("DocgenLocal.runScopedDocgen")(function* (plan: DocgenLocalPlan, repoRoot: string) {
  const dryRunOutput = yield* collectStepOutput(
    "turbo dry-run",
    turboBinaryPath(repoRoot),
    [...directTurboArgs(plan.turboArgs), "--dry-run=json"],
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

  const [proofElapsed, proofStatuses] = yield* Effect.timed(
    Effect.forEach(packages, verifyPackageProofManifest, {
      concurrency: localParallel(plan.parallel),
    })
  );
  yield* Console.log(`docgen:local: proof manifests: ${renderProofStatusList(proofStatuses)}`);
  yield* Console.log(
    `docgen:local: verified ${A.length(proofStatuses)} proof manifest(s) in ${Duration.format(proofElapsed)}`
  );

  if (A.every(proofStatuses, (status) => status.status === "current")) {
    yield* Console.log(`docgen:local: reused ${A.length(proofStatuses)} current package proof manifest(s)`);
  } else {
    const selectedPackages = selectDirectDocgenPackagesForTesting(packages, plan.selectedPackages);
    yield* checkPackageDocumentation(selectedPackages, plan.parallel);
    yield* runStepWithStallWatchdog(
      "turbo docgen",
      turboBinaryPath(repoRoot),
      directTurboArgs(plan.turboArgs),
      repoRoot,
      scopedDocgenStepBudget
    );
  }

  // Previously nothing was logged between turbo's own summary and the first
  // "aggregated" line, so a stall in between was invisible.
  yield* Console.log(`docgen:local: aggregating ${A.length(packages)} package(s) into docs/generated`);
  const [aggregateElapsed, aggregateCount] = yield* Effect.timed(aggregateDocgenPackagesForTesting(packages));
  yield* Console.log(
    `docgen:local: aggregated ${aggregateCount} of ${A.length(packages)} package(s) in ${Duration.format(aggregateElapsed)}`
  );
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
  if (options.full) {
    return buildFullPlan(options);
  }
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

const executeDocgenLocalPlan = Effect.fn("DocgenLocal.executeDocgenLocalPlan")(function* (
  options: DocgenLocalOptions,
  plan: DocgenLocalPlan,
  repoRoot: string
): Effect.fn.Return<DocgenLocalPlan, CliReportedExit | DomainError | NoSuchFileError, DocgenLocalEnvironment> {
  if (options.plan) {
    return yield* plan.mode === "full-required"
      ? failWithReportedExit("docgen:local: full docgen proof required.")
      : Effect.succeed(plan);
  }
  if (plan.mode === "full-required") {
    if (!options.allowFull) {
      yield* Console.error('docgen:local: full docgen proof required; re-run with "--full" to execute it.');
      return yield* failWithReportedExit("docgen:local: full docgen proof required.");
    }
    yield* Console.log("docgen:local: full docgen proof required; executing it (--allow-full).");
    yield* runFullDocgen(repoRoot, plan.parallel);
    return plan;
  }
  if (plan.mode === "noop") {
    yield* Console.log("docgen:local: no package-local docgen inputs changed");
    return plan;
  }
  if (plan.mode === "full") {
    yield* runFullDocgen(repoRoot, plan.parallel);
    return plan;
  }
  yield* runScopedDocgen(plan, repoRoot);
  return plan;
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

    return yield* executeDocgenLocalPlan(options, plan, repoRoot);
  });
