/**
 * Pinned, bounded local Security CLI execution with explicit authentication.
 * @packageDocumentation
 * @since 0.0.0
 */
import { isResolvedPathWithinRoot } from "@beep/file-processing/PathSafety";
import { findRepoRoot } from "@beep/repo-utils";
import { O } from "@beep/utils";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command, Flag } from "effect/unstable/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { printLines } from "../../internal/cli/Printer.ts";
import { securityRepositoryFromRemote } from "./Security.bundle.ts";
import { CodexSecurityError, toCodexSecurityError } from "./Security.errors.ts";
import { runSecurityCli, securityRuntime } from "./Security.runtime.ts";
import {
  SECURITY_PACKAGE_VERSION,
  SecurityScanMode,
  SecurityScanOptions,
  SecuritySourceReceipt,
} from "./Security.schemas.ts";

const KNOWLEDGE_BASE = "docs/security/threat-model.md";
const isValidMaxCost = S.is(SecurityScanOptions.fields.maxCost);
const TARGET_MESSAGE = "--path must name an existing path inside the repository.";
const OUTPUT_SWAPPED_MESSAGE =
  "Scan output directory was replaced or linked into the repository; the scan is not usable.";

/**
 * Proves a `--path` target names an existing entry inside the repository once
 * symlinks are followed, then returns the validated relative string.
 *
 * **Example** (Composing the target check)
 * ```ts
 * import { resolveScanTarget } from "@beep/repo-cli/commands/Codex/Security.command"
 * import { Effect } from "effect"
 * const program = resolveScanTarget("/srv/repo", "packages/tooling")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @param repoRealPath - Canonical repository root.
 * @param target - Repository-relative path supplied by the operator.
 * @returns The same relative target once proven contained.
 * @category validation
 * @since 0.0.0
 */
export const resolveScanTarget = Effect.fn("CodexSecurity.resolveScanTarget")(function* (
  repoRealPath: string,
  target: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = yield* fs
    .realPath(path.resolve(repoRealPath, target))
    .pipe(Effect.mapError((cause) => CodexSecurityError.make({ message: TARGET_MESSAGE, cause })));
  if (!isResolvedPathWithinRoot(path, { root: repoRealPath, candidate: resolved })) {
    return yield* CodexSecurityError.make({ message: TARGET_MESSAGE });
  }
  return target;
});

/**
 * Re-proves that the scan output directory is still the unlinked private
 * directory the adapter created: its real path is itself and it lies outside
 * the repository. Run before spawning and again after the scanner exits so a
 * directory swapped mid-scan fails closed.
 *
 * **Example** (Composing the output-directory check)
 * ```ts
 * import { assertPrivateOutputDirectory } from "@beep/repo-cli/commands/Codex/Security.command"
 * import { Effect } from "effect"
 * const program = assertPrivateOutputDirectory("/srv/repo", "/private/scan-2026-09-16")
 * console.log(Effect.isEffect(program)) // true
 * ```
 * @param repoRealPath - Canonical repository root.
 * @param outputDir - Canonical output directory the adapter created.
 * @category validation
 * @since 0.0.0
 */
export const assertPrivateOutputDirectory = Effect.fn("CodexSecurity.assertPrivateOutputDirectory")(function* (
  repoRealPath: string,
  outputDir: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const resolved = yield* fs
    .realPath(outputDir)
    .pipe(Effect.mapError((cause) => CodexSecurityError.make({ message: OUTPUT_SWAPPED_MESSAGE, cause })));
  if (resolved !== outputDir || isResolvedPathWithinRoot(path, { root: repoRealPath, candidate: resolved })) {
    return yield* CodexSecurityError.make({ message: OUTPUT_SWAPPED_MESSAGE });
  }
});

/** Trimmed stdout of one git invocation inside the repository. */
const gitOutput = Effect.fn("CodexSecurity.gitOutput")(function* (repo: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return Str.trim(yield* spawner.string(ChildProcess.make("git", args, { cwd: repo })));
});

/** Binds the repository's origin slug and `HEAD` into the receipt written next to the scan. */
const resolveSourceReceipt = Effect.fn("CodexSecurity.resolveSourceReceipt")(function* (repo: string) {
  const repository = yield* securityRepositoryFromRemote(yield* gitOutput(repo, ["remote", "get-url", "origin"]));
  return yield* S.decodeEffect(SecuritySourceReceipt)({
    schemaVersion: "beep-security-source/v1",
    repository,
    revision: yield* gitOutput(repo, ["rev-parse", "HEAD"]),
  });
});

/**
 * A dirty checkout makes the scanner seal a `git_worktree` snapshot that bundle
 * ingest cannot attribute to a revision. Scans refuse before any spend;
 * preflight only warns so it stays usable mid-work.
 */
const requireCleanWorktree = Effect.fn("CodexSecurity.requireCleanWorktree")(function* (
  repo: string,
  preflight: boolean
) {
  const status = yield* gitOutput(repo, ["status", "--porcelain"]);
  if (Str.isEmpty(status)) return;
  if (!preflight) {
    return yield* CodexSecurityError.make({
      message:
        "Commit or stash local changes first: the scanner records a dirty checkout as a git_worktree target, which bundle ingest does not accept.",
    });
  }
  yield* printLines([
    "Warning: the checkout has uncommitted changes; `scan` will refuse until they are committed or stashed.",
  ]);
});

/** Canonical output path whose parent exists, lies outside the repository, and is not yet taken. */
const resolveOutputDirectory = Effect.fn("CodexSecurity.resolveOutputDirectory")(function* (
  repoRealPath: string,
  output: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const outputPath = path.resolve(output);
  const parent = yield* fs.realPath(path.dirname(outputPath));
  if (isResolvedPathWithinRoot(path, { root: repoRealPath, candidate: parent })) {
    return yield* CodexSecurityError.make({
      message: "Choose an output directory outside the repository; its parent must already exist.",
    });
  }
  if (yield* fs.exists(outputPath)) {
    return yield* CodexSecurityError.make({
      message: "Choose a new output directory. This adapter never archives or replaces prior scan evidence.",
    });
  }
  return path.join(parent, path.basename(outputPath));
});

const scanArguments = (input: {
  readonly mode: SecurityScanMode;
  readonly repo: string;
  readonly knowledgeBase: string;
  readonly outputDir: string;
  readonly options: SecurityScanOptions;
}): ReadonlyArray<string> => [
  "scan",
  input.repo,
  "--auth",
  "chatgpt",
  "--mode",
  "standard",
  "--model",
  "gpt-6-astra",
  "--effort",
  "medium",
  "--output-dir",
  input.outputDir,
  "--knowledge-base",
  input.knowledgeBase,
  "--max-cost",
  `${input.options.maxCost}`,
  "--headless",
  "--format",
  "json",
  ...O.getOrElse(
    O.map(input.options.target, (value) => ["--path", value]),
    A.empty<string>
  ),
  ...(SecurityScanMode.is.preflight(input.mode) ? ["--dry-run"] : []),
];

const writeSourceReceipt = Effect.fn("CodexSecurity.writeSourceReceipt")(function* (
  repoRealPath: string,
  outputDir: string,
  source: SecuritySourceReceipt
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* assertPrivateOutputDirectory(repoRealPath, outputDir);
  yield* fs.writeFileString(
    path.join(outputDir, "beep-source.json"),
    yield* S.encodeEffect(S.fromJsonString(SecuritySourceReceipt))(source),
    { flag: "wx", mode: 0o600 }
  );
});

const run = Effect.fn("CodexSecurity.run")(
  function* (mode: SecurityScanMode, options: SecurityScanOptions) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repo = yield* findRepoRoot();
    // Verify the pin before touching the filesystem or spawning git.
    yield* securityRuntime;
    const preflight = SecurityScanMode.is.preflight(mode);
    const repoRealPath = yield* fs.realPath(repo);
    const source = yield* resolveSourceReceipt(repo);
    yield* requireCleanWorktree(repo, preflight);
    yield* O.match(options.target, {
      onNone: () => Effect.void,
      onSome: (target) => resolveScanTarget(repoRealPath, target),
    });
    const outputDir = yield* resolveOutputDirectory(repoRealPath, options.outputDir);
    if (!preflight) {
      yield* fs.makeDirectory(outputDir, { mode: 0o700 });
      yield* assertPrivateOutputDirectory(repoRealPath, outputDir);
    }
    yield* printLines([
      `Codex Security ${SECURITY_PACKAGE_VERSION}; stored ChatGPT authentication; ${preflight ? "preflight only" : `estimated cost limit $${options.maxCost}, timeout ${options.timeoutMinutes} minutes`}.`,
    ]);
    const exitCode = yield* runSecurityCli({
      args: scanArguments({ mode, repo, knowledgeBase: path.join(repo, KNOWLEDGE_BASE), outputDir, options }),
      cwd: repo,
      stdout: "inherit",
      stderr: "inherit",
      timeout: Duration.minutes(preflight ? 1 : options.timeoutMinutes),
      timeoutMessage: "Security process timed out. Retained artifacts may be incomplete and are not a passing scan.",
    });
    // Fail closed on a swapped directory before any verdict, even a non-zero exit.
    if (!preflight) yield* writeSourceReceipt(repoRealPath, outputDir, source);
    if (exitCode !== 0) {
      return yield* CodexSecurityError.make({
        message: `Security CLI exited ${exitCode}. Findings or incomplete coverage require review; this is not a passing scan.`,
        exitCode,
      });
    }
  },
  Effect.mapError(
    toCodexSecurityError(
      "Security setup failed. Check the pinned runtime, valid bounds, existing output parent, and stored ChatGPT sign-in."
    )
  )
);

const flags = {
  output: Flag.String("output-dir"),
  maxCost: Flag.Finite("max-cost"),
  timeoutMinutes: Flag.Int("timeout-minutes").pipe(Flag.withDefault(30)),
  target: Flag.String("path").pipe(Flag.optional),
};

const boundMessage = (values: { readonly maxCost: number }): string =>
  isValidMaxCost(values.maxCost)
    ? "--timeout-minutes must be a whole number from 1 to 120."
    : "--max-cost must be greater than 0 and at most 100 USD.";

const decodeScanOptions = Effect.fn("CodexSecurity.decodeScanOptions")(function* (values: {
  readonly output: string;
  readonly maxCost: number;
  readonly timeoutMinutes: number;
  readonly target: O.Option<string>;
}) {
  return yield* S.decodeEffect(SecurityScanOptions)({
    outputDir: values.output,
    maxCost: values.maxCost,
    timeoutMinutes: values.timeoutMinutes,
    ...O.getSomesStruct({ target: values.target }),
  }).pipe(Effect.mapError((cause) => CodexSecurityError.make({ message: boundMessage(values), cause })));
});

const securitySubcommand = (mode: SecurityScanMode) =>
  Command.make(mode, flags, (values) => Effect.flatMap(decodeScanOptions(values), (options) => run(mode, options)));

/**
 * Provides non-scanning preflight and explicitly budgeted local scan commands.
 *
 * **Example** (Composing the command group)
 * ```ts
 * import { securityCommand } from "@beep/repo-cli/commands/Codex/Security.command"
 * import { Command } from "effect/unstable/cli"
 * const root = Command.make("example").pipe(Command.withSubcommands([securityCommand]))
 * console.log(securityCommand.name) // "security"
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const securityCommand = Command.make("security", {}, () =>
  printLines([
    "beep codex security preflight --output-dir <private/new-directory> --max-cost <usd>",
    "beep codex security scan --output-dir <private/new-directory> --max-cost <usd> [--path <relative-path>]",
    "beep codex findings ingest --source security-bundle --from <sealed-scan-directory> --dry-run",
  ])
).pipe(Command.withSubcommands([securitySubcommand("preflight"), securitySubcommand("scan")]));
