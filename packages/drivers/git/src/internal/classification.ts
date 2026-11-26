/**
 * Ordered Git exit, stderr, spawn-failure and timeout classification.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitCommandError } from "../Git.errors.ts";
import { OutputTooLarge, runCollected } from "./run.ts";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GitOptions } from "../Git.models.ts";
import type { GitInvocation } from "../GitCommand.ts";
import type { Collected } from "./run.ts";

const $I = $GitId.create("Git");

const Classified = S.TaggedUnion({
  success: {
    output: S.String.pipe($I.annoteKey("Classified.success.output", { description: "The completed run's stdout." })),
  },
  differs: {
    output: S.String.pipe(
      $I.annoteKey("Classified.differs.output", { description: "The stdout of a silent exit-1 data answer." })
    ),
  },
  absent: {},
  refMissing: {},
  notARepository: {},
  unknownRef: {},
  nonFastForward: {},
  mergeConflict: {},
  dirtyWorktree: {},
  failure: {
    error: GitCommandError.pipe(
      $I.annoteKey("Classified.failure.error", { description: "The classified command failure." })
    ),
  },
}).pipe($I.annoteSchema("Classified", { description: "The private outcome of classifying a Git run." }));
type Classified = typeof Classified.Type;

/**
 * Which method-specific classification rows apply on top of the shared
 * taxonomy: `"show"` enables the absent-at-ref degrade, `"refExists"` enables
 * the exit-1-is-false degrade, `"quiet"` enables the silent-exit-1-is-absent
 * degrade, `"noSuchRemote"` enables the no-such-remote degrade, `"push"`
 * enables the rejected-non-fast-forward row, `"merge"` enables the
 * dirty-worktree and merge-conflict rows, `"log"` enables the unborn-HEAD
 * degrade, `"revParse"` enables `rev-parse --verify`'s two unknown-ref
 * shapes (`Needed a single revision`, and `--quiet`'s silent exit 1),
 * `"differs"` enables the silent-exit-1-is-data row (`merge-tree --write-tree`
 * conflicts, `diff --no-index` differences) plus merge-tree's unresolvable
 * revision shape, `"generic"` enables none of them.
 */
const ClassifyKind = LiteralKit([
  "show",
  "refExists",
  "quiet",
  "noSuchRemote",
  "push",
  "merge",
  "log",
  "revParse",
  "differs",
  "generic",
]).pipe($I.annoteSchema("ClassifyKind", { description: "The method-specific Git classification taxonomy." }));
type ClassifyKind = typeof ClassifyKind.Type;

/** Outcomes available to each classification mode. */
type ClassifiedFor<K extends ClassifyKind> = Extract<
  Classified,
  {
    readonly _tag:
      | "success"
      | "notARepository"
      | "unknownRef"
      | "failure"
      | (K extends "show" | "quiet" | "noSuchRemote" | "log" ? "absent" : never)
      | (K extends "refExists" ? "refMissing" : never)
      | (K extends "differs" ? "differs" : never)
      | (K extends "push" ? "nonFastForward" : never)
      | (K extends "merge" ? "mergeConflict" | "dirtyWorktree" : never);
  }
>;

/** A classified run with its spawner bound by the execution module. */
type RunFor = {
  <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K): Effect.Effect<ClassifiedFor<K>>;
  <K extends ClassifyKind>(cwd: string, kind: K): (invocation: GitInvocation) => Effect.Effect<ClassifiedFor<K>>;
};

const NOT_A_REPOSITORY = "not a git repository";
const MERGE_BASE_UNKNOWN_COMMIT = "Not a valid commit name";
const UNKNOWN_REF_PATTERNS = [
  "unknown revision",
  "bad revision",
  "Not a valid object name",
  MERGE_BASE_UNKNOWN_COMMIT,
  "invalid object name",
  "couldn't find remote ref",
];
const ABSENT_AT_REF_PATTERNS = ["does not exist in", "exists on disk, but not in"];
const PUSH_REJECTED_PATTERNS = ["non-fast-forward", "fetch first", "stale info"];
const MERGE_CONFLICT_PATTERNS = ["CONFLICT (", "Automatic merge failed", "could not apply"];
const DIRTY_WORKTREE_PATTERN = "would be overwritten by";
const UNBORN_HEAD_PATTERN = "does not have any commits yet";
const REV_PARSE_VERIFY_UNKNOWN_PATTERN = "Needed a single revision";
const MERGE_UNRESOLVED_PATTERN = "not something we can merge";

const matchesAny: {
  (stderr: string, patterns: ReadonlyArray<string>): boolean;
  (patterns: ReadonlyArray<string>): (stderr: string) => boolean;
} = dual(2, (stderr: string, patterns: ReadonlyArray<string>): boolean =>
  A.some(patterns, (pattern) => Str.includes(pattern)(stderr))
);

const spawnFailure = (outcome: PlatformError.PlatformError, cwd: string, args: ReadonlyArray<string>): Classified => ({
  _tag: "failure",
  error: GitCommandError.make({
    kind: "failed",
    args,
    cwd,
    stderr: "",
    detail:
      outcome.reason._tag === "NotFound"
        ? "git is not installed (or the working directory does not exist)"
        : `spawn failed: ${outcome.reason._tag}: ${outcome.message}`,
  }),
});

const truncatedFailure = (outcome: OutputTooLarge, cwd: string, args: ReadonlyArray<string>): Classified => ({
  _tag: "failure",
  error: GitCommandError.make({
    kind: "truncated",
    args,
    cwd,
    stderr: "",
    detail: `${outcome.stream} exceeded the ${outcome.limit} byte output limit (maxOutputBytes)`,
  }),
});

const exitFailure = ({ exitCode, stderr }: Collected, cwd: string, args: ReadonlyArray<string>): Classified => ({
  _tag: "failure",
  error: GitCommandError.make({
    kind: "failed",
    args,
    cwd,
    exitCode,
    stderr,
  }),
});

const sharedFailureRow = (stderr: string): Classified | undefined => {
  if (Str.includes(NOT_A_REPOSITORY)(stderr)) return { _tag: "notARepository" };
  return matchesAny(stderr, UNKNOWN_REF_PATTERNS) ? { _tag: "unknownRef" } : undefined;
};

const classifyMerge = ({ stderr, stdout }: Collected): Classified | undefined => {
  if (Str.includes(DIRTY_WORKTREE_PATTERN)(stderr)) return { _tag: "dirtyWorktree" };
  return matchesAny(stdout, MERGE_CONFLICT_PATTERNS) || matchesAny(stderr, MERGE_CONFLICT_PATTERNS)
    ? { _tag: "mergeConflict" }
    : undefined;
};

const classifyDiffers = ({ exitCode, stderr, stdout }: Collected): Classified | undefined => {
  if (exitCode !== 1) return undefined;
  if (stderr === "") return { _tag: "differs", output: stdout };
  return Str.includes(MERGE_UNRESOLVED_PATTERN)(stderr) ? { _tag: "unknownRef" } : undefined;
};

const KIND_ROWS: { readonly [K in ClassifyKind]: (outcome: Collected) => Classified | undefined } = {
  show: ({ stderr }) =>
    O.exists(Str.search(stderr, /^fatal: /m), (start) => {
      const firstFatalDiagnostic = Str.slice(start)(stderr);
      return (
        Str.startsWith("fatal: path '")(firstFatalDiagnostic) &&
        matchesAny(firstFatalDiagnostic, ABSENT_AT_REF_PATTERNS)
      );
    })
      ? { _tag: "absent" }
      : undefined,
  refExists: ({ exitCode }) => (exitCode === 1 ? { _tag: "refMissing" } : undefined),
  quiet: ({ exitCode, stderr }) => (exitCode === 1 && stderr === "" ? { _tag: "absent" } : undefined),
  noSuchRemote: ({ stderr }) => (Str.includes("No such remote")(stderr) ? { _tag: "absent" } : undefined),
  push: ({ stderr }) =>
    Str.includes("[rejected]")(stderr) && matchesAny(stderr, PUSH_REJECTED_PATTERNS)
      ? { _tag: "nonFastForward" }
      : undefined,
  merge: classifyMerge,
  log: ({ stderr }) => (Str.includes(UNBORN_HEAD_PATTERN)(stderr) ? { _tag: "absent" } : undefined),
  revParse: ({ exitCode, stderr }) =>
    (exitCode === 1 && stderr === "") || Str.includes(REV_PARSE_VERIFY_UNKNOWN_PATTERN)(stderr)
      ? { _tag: "unknownRef" }
      : undefined,
  differs: classifyDiffers,
  generic: () => undefined,
};

const classify: {
  (
    outcome: Collected | PlatformError.PlatformError | OutputTooLarge,
    cwd: string,
    args: ReadonlyArray<string>,
    kind: ClassifyKind
  ): Classified;
  (
    cwd: string,
    args: ReadonlyArray<string>,
    kind: ClassifyKind
  ): (outcome: Collected | PlatformError.PlatformError | OutputTooLarge) => Classified;
} = dual(
  4,
  (
    outcome: Collected | PlatformError.PlatformError | OutputTooLarge,
    cwd: string,
    args: ReadonlyArray<string>,
    kind: ClassifyKind
  ): Classified => {
    if (outcome instanceof PlatformError.PlatformError) return spawnFailure(outcome, cwd, args);
    if (S.is(OutputTooLarge)(outcome)) return truncatedFailure(outcome, cwd, args);
    if (outcome.exitCode === 0) return { _tag: "success", output: outcome.stdout };
    const specific = KIND_ROWS[kind](outcome);
    if (kind === "show" && specific?._tag === "absent") return specific;
    return sharedFailureRow(outcome.stderr) ?? specific ?? exitFailure(outcome, cwd, args);
  }
);

/**
 * Runs an invocation's command in `cwd`, classifies the outcome, and never
 * fails: a spawn-level `PlatformError`, an over-limit output stream and a
 * per-run timeout are all absorbed into the `"failure"` classification
 * rather than escaping the effect's error channel.
 *
 * **Details**
 *
 * The argv handed to `classify` — and therefore persisted into any
 * `GitCommandError` — is the invocation's REDACTED argv, never the raw one:
 * the redaction mask the pure constructor carries is applied here, at the
 * single classification choke point (the redaction policy).
 *
 * The supplied `env` is applied here alongside `cwd`. The execution module
 * uses fixed base pins for local commands. Network commands combine those
 * pins with ambient SSH settings captured at service construction and
 * repository configuration resolved for each call. `options` carries the
 * per-stream byte ceiling handed to the collector and the wall-clock
 * timeout applied around the whole run.
 *
 * **Example** (Construct a classified repository query)
 *
 * ```ts import.meta.vitest name="Construct a classified repository query"
 * import { GitOptions } from "@beep/git/Git"
 * import { GitCommand } from "@beep/git/GitCommand"
 * import { runClassified } from "@beep/git/internal/classification"
 * import * as Effect from "effect/Effect"
 *
 * const program = runClassified(GitCommand.revParse("HEAD"), "/repo", "generic", {}, GitOptions.make({}))
 * Effect.isEffect(program) // => true
 * ```
 *
 * @category processes
 * @since 0.0.0
 */
export const runClassified: {
  <K extends ClassifyKind>(
    invocation: GitInvocation,
    cwd: string,
    kind: K,
    env: Record<string, string>,
    options: GitOptions
  ): Effect.Effect<ClassifiedFor<K>, never, ChildProcessSpawner.ChildProcessSpawner>;
  <K extends ClassifyKind>(
    cwd: string,
    kind: K,
    env: Record<string, string>,
    options: GitOptions
  ): (invocation: GitInvocation) => Effect.Effect<ClassifiedFor<K>, never, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  5,
  (
    invocation: GitInvocation,
    cwd: string,
    kind: ClassifyKind,
    env: Record<string, string>,
    options: GitOptions
  ): Effect.Effect<Classified, never, ChildProcessSpawner.ChildProcessSpawner> => {
    const args = invocation.redactedArgs;
    const command = ChildProcess.setEnv(ChildProcess.setCwd(invocation.command, cwd), env);
    return runCollected(command, options.maxOutputBytes).pipe(
      Effect.map(classify(cwd, args, kind)),
      Effect.catch((failure) => Effect.succeed(classify(failure, cwd, args, kind))),
      Effect.timeoutOrElse({
        duration: options.timeout,
        orElse: () =>
          Effect.succeed<Classified>({
            _tag: "failure",
            error: GitCommandError.make({
              kind: "failed",
              args,
              cwd,
              stderr: "",
              detail: `timed out after ${Duration.format(options.timeout)}`,
            }),
          }),
      })
    );
  }
);

/**
 * Mode-specific classification types used by the service implementation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type { ClassifiedFor, ClassifyKind, RunFor };
