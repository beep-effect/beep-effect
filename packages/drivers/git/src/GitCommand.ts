/**
 * Pure `git` argv constructors: each builds a spawnable command plus the
 * redacted diagnostic argv the error taxonomy may persist.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const $I = $GitId.create("GitCommand");

const StandardCommandSchema = S.declare(
  (u: unknown): u is ChildProcess.StandardCommand => ChildProcess.isCommand(u) && ChildProcess.isStandardCommand(u)
).pipe($I.annoteSchema("StandardCommand", { description: "A single spawnable (non-piped) child-process command." }));

/**
 * A pure `git` invocation: the spawnable command plus the diagnostic argv the
 * error taxonomy is allowed to persist.
 *
 * **Details**
 *
 * `command.args` holds the raw argv git actually receives; `redactedArgs` is
 * the same argv with every sensitive positional masked — a config value
 * replaced by `<redacted>` entirely, and a URL's embedded userinfo (an
 * `https://user:token@host/...` credential) replaced by `<redacted>@`. The
 * redaction mask lives here, on the pure constructor, because the
 * constructor is the one place that knows which positionals are sensitive;
 * the `Git` service's `classify` step persists ONLY `redactedArgs` into
 * `GitCommandError.args` and `GitCommandError.message`, so raw argv never
 * survives into an error value. For a constructor with no sensitive
 * positionals the two argvs are element-wise identical.
 *
 * **Example** (Read a constructed invocation's redacted argv)
 *
 * ```ts
 * import { GitCommand } from "@beep/git/GitCommand";
 *
 * const invocation = GitCommand.revParse("HEAD");
 * console.log(invocation.redactedArgs); // ["rev-parse", "--verify", "HEAD"]
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class GitInvocation extends S.Opaque<GitInvocation, { readonly brand: unique symbol }>()(
  S.Struct({
    command: StandardCommandSchema.pipe(
      $I.annoteKey("GitInvocation.command", {
        description: "The spawnable, cwd-less command carrying the raw argv.",
      })
    ),
    redactedArgs: S.Array(S.String).pipe(
      $I.annoteKey("GitInvocation.redactedArgs", {
        description: "The argv with sensitive positionals masked — the only argv diagnostics may persist.",
      })
    ),
  }).pipe(
    $I.annoteSchema("GitInvocation", {
      description: "A pure `git` invocation: the spawnable command plus the diagnostic argv it may persist.",
    })
  )
) {}

/** The mask every whole-value sensitive positional is replaced with. */
const REDACTED = "<redacted>";

const GitArgRedaction = LiteralKit(["value", "url"]).pipe(
  $I.annoteSchema("GitArgRedaction", { description: "The mask applied to a sensitive Git argv segment." })
);

/**
 * One argv segment: a plain string, or a sensitive positional tagged with the
 * mask to apply in `redactedArgs` — `"value"` replaces the whole segment,
 * `"url"` masks only an embedded `scheme://userinfo@` credential.
 */
const GitArg = S.Union([
  S.String,
  S.Struct({
    redact: GitArgRedaction.pipe(
      $I.annoteKey("SensitiveGitArg.redact", { description: "The redaction policy for this segment." })
    ),
    value: S.String.pipe($I.annoteKey("SensitiveGitArg.value", { description: "The raw argv segment passed to Git." })),
  }).pipe($I.annoteSchema("SensitiveGitArg", { description: "A private sensitive Git argv carrier." })),
]).pipe($I.annoteSchema("GitArg", { description: "A plain or sensitive Git argv segment." }));
type GitArg = typeof GitArg.Type;

// Tags a whole-value sensitive positional (a config value that may be a secret).
const secretValue = (value: string): GitArg => ({ redact: GitArgRedaction.Enum.value, value });

// Tags a URL positional whose embedded userinfo (if any) must be masked.
const secretUrl = (value: string): GitArg => ({ redact: GitArgRedaction.Enum.url, value });

/**
 * Masks the userinfo component of a URL (`scheme://user:token@host/...` →
 * `scheme://<redacted>@host/...`). A value carrying no embedded userinfo — a
 * remote name, a credential-free URL, an scp-style `host:path` — passes
 * through untouched, so the common case stays fully debuggable.
 *
 * **Details**
 *
 * The userinfo match is greedy (`[^/]*@` — everything through the LAST `@`
 * before the first path slash): URL authorities split at the last `@`, so a
 * password containing a literal `@` (`user:p\@ss\@host/...`) must be
 * consumed whole or its tail would survive into `redactedArgs`.
 */
const redactUrlUserinfo = (value: string): string =>
  Str.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/]*@/i, `$1${REDACTED}@`)(value);

/**
 * Builds a `git` {@link GitInvocation} with the argv this package classifies
 * against.
 *
 * **Details**
 *
 * The returned command carries neither `cwd` NOR any environment pin — every
 * `GitCommand` constructor produces a pure, context-free value. The caller
 * (the `Git` service) applies both per invocation, via `ChildProcess.setCwd`
 * and `ChildProcess.setEnv`, each of which returns a new command and leaves
 * this one unchanged. The environment pins that make git's stderr
 * classifiable and keep it from blocking on a prompt live in `Git.ts`
 * alongside the classifier and the timeout they exist to serve; one of them
 * is conditional on the caller's own environment, which a pure constructor
 * must not read.
 *
 * `extendEnv: true` is the one spawn option set here, and it is deliberately
 * NOT one of those pins: it declares that a git invocation inherits the
 * parent environment at all (git needs `PATH`, `HOME`, `SSH_AUTH_SOCK` and
 * the rest to function), rather than forcing any particular value. It must
 * be set at construction because core exposes no run-time combinator for it
 * — only `setCwd` and `setEnv` — and its default is owned by whichever
 * platform backend implements `ChildProcessSpawner`, not by core, so a
 * command that needs the merge must request it explicitly rather than rely
 * on an implementation-specific default.
 *
 * A consumer running one of these values directly gets a plain inherited
 * environment and no pins. That is the honest shape: such a caller is
 * running a custom command, and `Git`'s classification guarantees do not
 * travel with the argv.
 */
const git: {
  (args: ReadonlyArray<GitArg>, stdin?: string): GitInvocation;
  (stdin?: string): (args: ReadonlyArray<GitArg>) => GitInvocation;
} = dual(
  (args) => A.isArray(args[0]),
  (args: ReadonlyArray<GitArg>, stdin?: string): GitInvocation => {
    const raw = A.map(args, (arg) => (P.isString(arg) ? arg : arg.value));
    const redactedArgs = A.map(args, (arg) =>
      P.isString(arg) ? arg : arg.redact === GitArgRedaction.Enum.value ? REDACTED : redactUrlUserinfo(arg.value)
    );
    return GitInvocation.make({
      command: ChildProcess.make("git", raw, {
        extendEnv: true,
        // stdin is baked into the pure command value (check-ignore's --stdin
        // form): a single UTF-8 chunk, closed when done. Constructors without
        // stdin leave the option unset entirely.
        ...O.getSomesStruct({
          stdin: O.map(O.fromUndefinedOr(stdin), (input) => Stream.make(new TextEncoder().encode(input))),
        }),
      }),
      redactedArgs,
    });
  }
);

// Implementation of GitCommand.show; the public contract lives on the static.
const show: {
  (ref: string, path: string): GitInvocation;
  (path: string): (ref: string) => GitInvocation;
} = dual(2, (ref: string, path: string): GitInvocation => git(["show", `${ref}:${path}`]));

/** The `--` separator plus `pathspec`, or nothing when there is no pathspec to scope by. */
const pathspecArgs = (pathspec: ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
  pathspec !== undefined && pathspec.length > 0 ? ["--", ...pathspec] : [];

// Implementation of GitCommand.lsTree; the public contract lives on the static.
const lsTree: {
  (ref: string, pathspec?: ReadonlyArray<string>, fullTree?: boolean): GitInvocation;
  (pathspec?: ReadonlyArray<string>, fullTree?: boolean): (ref: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (ref: string, pathspec: ReadonlyArray<string> = [], fullTree?: boolean): GitInvocation =>
    git(["ls-tree", "-r", "-z", ...(fullTree === true ? ["--full-tree"] : []), ref, ...pathspecArgs(pathspec)])
);

// Implementation of GitCommand.refExists; the public contract lives on the static.
const refExists = (ref: string): GitInvocation => git(["cat-file", "-e", ref]);

// Implementation of GitCommand.mergeBase; the public contract lives on the static.
// One builder backs BOTH Git.mergeBase (loud on no ancestor) and
// Git.mergeBaseOption (silent exit 1 → Option.none) — the argv is identical;
// only the service's classify kind differs.
const mergeBase: {
  (a: string, b: string): GitInvocation;
  (b: string): (a: string) => GitInvocation;
} = dual(2, (a: string, b: string): GitInvocation => git(["merge-base", a, b]));

// Implementation of GitCommand.isAncestor; the public contract lives on the static.
const isAncestor: {
  (ancestor: string, descendant: string): GitInvocation;
  (descendant: string): (ancestor: string) => GitInvocation;
} = dual(
  2,
  (ancestor: string, descendant: string): GitInvocation => git(["merge-base", "--is-ancestor", ancestor, descendant])
);

/**
 * The change-selection options every `--name-only` diff constructor accepts.
 * The service validates `diffFilter` (git's `[ACDMRTUXB*]` letters, lower
 * case excluding) and the pathspec before any spawn; the constructor renders
 * them verbatim.
 */
type DiffListOptions = {
  readonly diffFilter?: string;
  readonly noRenames?: boolean;
  readonly pathspec?: ReadonlyArray<string>;
};

/** `[--no-renames] [--diff-filter=<letters>]` — the flags {@link DiffListOptions} renders before the range. */
const diffListFlags = (options: DiffListOptions): ReadonlyArray<string> => [
  ...(options.noRenames === true ? ["--no-renames"] : []),
  ...(options.diffFilter !== undefined ? [`--diff-filter=${options.diffFilter}`] : []),
];

/** The two spellings of a two-ref diff range: merge-base `base...head`, or the plain tree-to-tree pair. */
const rangeArgs = (base: string, head: string, twoDot: boolean | undefined): ReadonlyArray<string> =>
  twoDot === true ? [base, head] : [`${base}...${head}`];

/** {@link DiffListOptions} plus `twoDot`, which selects the plain `<base> <head>` pair over `<base>...<head>`. */
type ChangedFilesOptions = DiffListOptions & { readonly twoDot?: boolean };

// Implementation of GitCommand.changedFiles; the public contract lives on the static.
const changedFiles = (base: string, head: string, relative = false, options: ChangedFilesOptions = {}): GitInvocation =>
  git([
    "diff",
    "--name-only",
    "-z",
    relative ? "--relative" : "--no-relative",
    ...diffListFlags(options),
    ...rangeArgs(base, head, options.twoDot),
    ...pathspecArgs(options.pathspec),
  ]);

/** {@link DiffListOptions} plus `head`, the commit the working tree or index is compared against instead of the default. */
type WorkingDiffOptions = DiffListOptions & { readonly head?: string };

// Implementation of GitCommand.unstagedChanges; the public contract lives on the static.
const unstagedChanges = (relative = false, options: WorkingDiffOptions = {}): GitInvocation =>
  git([
    "diff",
    "--name-only",
    "-z",
    relative ? "--relative" : "--no-relative",
    ...diffListFlags(options),
    ...(options.head !== undefined ? [options.head] : []),
    ...pathspecArgs(options.pathspec),
  ]);

// Implementation of GitCommand.stagedChanges; the public contract lives on the static.
const stagedChanges = (relative = false, options: WorkingDiffOptions = {}): GitInvocation =>
  git([
    "diff",
    "--name-only",
    "-z",
    relative ? "--relative" : "--no-relative",
    "--cached",
    ...diffListFlags(options),
    ...(options.head !== undefined ? [options.head] : []),
    ...pathspecArgs(options.pathspec),
  ]);

// Implementation of GitCommand.untrackedFiles; the public contract lives on the static.
const untrackedFiles = (relative = false, pathspec: ReadonlyArray<string> = []): GitInvocation =>
  git([
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
    ...(relative ? [] : ["--full-name"]),
    ...pathspecArgs(pathspec),
  ]);

/**
 * The options {@link GitCommand.revParse} accepts: `peel` appends git's
 * `^{commit}` peel suffix to the ref, `quiet` adds `--quiet` so an unknown
 * ref exits 1 silently instead of printing `Needed a single revision`.
 */
type RevParseOptions = {
  readonly peel?: "commit";
  readonly quiet?: boolean;
};

// Implementation of GitCommand.revParse; the public contract lives on the static.
const revParse: {
  (ref: string, options?: RevParseOptions): GitInvocation;
  (options?: RevParseOptions): (ref: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (ref: string, options?: RevParseOptions): GitInvocation =>
    options === undefined
      ? git(["rev-parse", "--verify", ref])
      : git([
          "rev-parse",
          "--verify",
          ...(options.quiet === true ? ["--quiet"] : []),
          "--end-of-options",
          options.peel === undefined ? ref : `${ref}^{${options.peel}}`,
        ])
);

// Implementation of GitCommand.checkout; the public contract lives on the static.
const checkout: {
  (ref: string, detach?: boolean): GitInvocation;
  (detach?: boolean): (ref: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (ref: string, detach?: boolean): GitInvocation => git(["checkout", ...(detach === true ? ["--detach"] : []), ref])
);

// Implementation of GitCommand.fetch; the public contract lives on the static.
const fetch = (
  remote: string,
  ref: string,
  depth?: number,
  tag = false,
  unshallow = false,
  prune = false
): GitInvocation =>
  git([
    "fetch",
    ...(depth !== undefined ? ["--depth", String(depth)] : []),
    ...(unshallow ? ["--unshallow"] : []),
    ...(prune ? ["--prune"] : []),
    secretUrl(remote),
    ...(tag ? ["tag"] : []),
    ref,
  ]);

// Implementation of GitCommand.submoduleUpdate; the public contract lives on the static.
const submoduleUpdate = (
  init = false,
  depth?: number,
  paths: ReadonlyArray<string> = [],
  options: {
    readonly checkout?: boolean;
    readonly remote?: boolean;
    readonly fetch?: false;
    readonly recursive?: boolean;
    readonly force?: boolean;
  } = {}
): GitInvocation =>
  git([
    "submodule",
    "update",
    ...(init ? ["--init"] : []),
    ...(options.checkout === true ? ["--checkout"] : []),
    ...(options.remote === true ? ["--remote"] : []),
    ...(options.fetch === false ? ["--no-fetch"] : []),
    ...(options.recursive === true ? ["--recursive"] : []),
    ...(options.force === true ? ["--force"] : []),
    ...(depth !== undefined ? ["--depth", String(depth)] : []),
    ...(paths.length > 0 ? ["--", ...paths] : []),
  ]);

// Implementation of GitCommand.submoduleAdd; the public contract lives on the static.
const submoduleAdd = (url: string, path: string, depth?: number): GitInvocation =>
  git(["submodule", "add", ...(depth !== undefined ? ["--depth", String(depth)] : []), "--", secretUrl(url), path]);

// Implementation of GitCommand.sparseCheckoutSet; the public contract lives on the static.
const sparseCheckoutSet: {
  (patterns: ReadonlyArray<string>, cone: boolean): GitInvocation;
  (cone: boolean): (patterns: ReadonlyArray<string>) => GitInvocation;
} = dual(
  2,
  (patterns: ReadonlyArray<string>, cone: boolean): GitInvocation =>
    git(["sparse-checkout", "set", cone ? "--cone" : "--no-cone", ...patterns])
);

// Implementation of GitCommand.configSet; the public contract lives on the static.
const configSet = (key: string, value: string, file?: string): GitInvocation =>
  git(["config", ...(file !== undefined ? ["-f", file] : []), key, secretValue(value)]);

// Implementation of GitCommand.add; the public contract lives on the static.
const add = (paths: ReadonlyArray<string>): GitInvocation => git(["add", "--", ...paths]);

// Implementation of GitCommand.reset; the public contract lives on the static.
const reset = (mode: "soft" | "mixed" | "hard" = "mixed", ref?: string): GitInvocation =>
  git(["reset", `--${mode}`, ...(ref !== undefined ? [ref] : [])]);

// Implementation of GitCommand.clean; the public contract lives on the static.
const clean = (directories = false, ignored = false, paths: ReadonlyArray<string> = []): GitInvocation =>
  git([
    "clean",
    "--force",
    ...(directories ? ["-d"] : []),
    ...(ignored ? ["-x"] : []),
    ...(paths.length > 0 ? ["--", ...paths] : []),
  ]);

// Implementation of GitCommand.restore; the public contract lives on the static.
const restore: {
  (paths: ReadonlyArray<string>, source?: string, staged?: boolean, worktree?: boolean): GitInvocation;
  (source?: string, staged?: boolean, worktree?: boolean): (paths: ReadonlyArray<string>) => GitInvocation;
} = dual(
  (args) => A.isArray(args[0]),
  (paths: ReadonlyArray<string>, source?: string, staged?: boolean, worktree?: boolean): GitInvocation =>
    git([
      "restore",
      ...(source !== undefined ? ["--source", source] : []),
      ...(staged === true ? ["--staged"] : []),
      ...(worktree === true ? ["--worktree"] : []),
      "--",
      ...paths,
    ])
);

// Implementation of GitCommand.branchCreate; the public contract lives on the static.
const branchCreate = (name: string, startPoint?: string, checkout = false, force = false): GitInvocation => {
  const target = startPoint === undefined ? [name] : [name, startPoint];
  if (checkout) return git(["checkout", force ? "-B" : "-b", ...target]);
  return git(force ? ["branch", "-f", ...target] : ["branch", ...target]);
};

// Implementation of GitCommand.branchDelete; the public contract lives on the static.
const branchDelete: {
  (name: string, force?: boolean): GitInvocation;
  (force?: boolean): (name: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (name: string, force?: boolean): GitInvocation => git(["branch", force === true ? "-D" : "-d", name])
);

// Implementation of GitCommand.isShallow; the public contract lives on the static.
const isShallow = (): GitInvocation => git(["rev-parse", "--is-shallow-repository"]);

// Implementation of GitCommand.fetchUnshallow; the public contract lives on the static.
const fetchUnshallow = (remote = "origin"): GitInvocation => git(["fetch", "--unshallow", secretUrl(remote)]);

/**
 * The detection and scoping options {@link GitCommand.nameStatus} accepts
 * beyond the range itself. The service validates `findRenames` (an integer
 * percent 1..100) and `diffFilter` (git's `[ACDMRTUXB*]` letters, lower-case
 * excluding) before any spawn; the constructor renders them verbatim.
 */
type NameStatusOptions = {
  readonly findRenames?: number;
  readonly diffFilter?: string;
  readonly pathspec?: ReadonlyArray<string>;
  readonly twoDot?: boolean;
};

// Implementation of GitCommand.nameStatus; the public contract lives on the static.
const nameStatus = (
  base: string,
  head: string | undefined,
  relative = false,
  options: NameStatusOptions = {}
): GitInvocation =>
  git([
    "diff",
    "--name-status",
    "-z",
    relative ? "--relative" : "--no-relative",
    ...(options.findRenames !== undefined ? [`--find-renames=${options.findRenames}%`] : []),
    ...(options.diffFilter !== undefined ? [`--diff-filter=${options.diffFilter}`] : []),
    ...(head === undefined ? [base] : rangeArgs(base, head, options.twoDot)),
    ...pathspecArgs(options.pathspec),
  ]);

// Implementation of GitCommand.defaultBranch; the public contract lives on the static.
const defaultBranch = (remote = "origin"): GitInvocation =>
  git(["symbolic-ref", "--quiet", "--short", `refs/remotes/${remote}/HEAD`]);

/**
 * How {@link GitCommand.currentBranch} asks for the branch name.
 *
 * **Details**
 *
 * `abbrev-ref` runs `rev-parse --abbrev-ref HEAD`, which answers the literal
 * `HEAD` on a detached head and fails on an unborn branch; `show-current`
 * runs `branch --show-current`, which prints NOTHING on a detached head and
 * names an unborn branch. The `Git` service maps both detached spellings to
 * `Option.none`.
 *
 * **Example** (Validate a current-branch mode)
 *
 * ```ts
 * import { CurrentBranchMode } from "@beep/git/GitCommand";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CurrentBranchMode)("show-current")) // true
 * console.log(S.is(CurrentBranchMode)("symbolic")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CurrentBranchMode = LiteralKit(["abbrev-ref", "show-current"]).pipe(
  $I.annoteSchema("CurrentBranchMode", { description: "Which git question answers the current branch name." })
);
/**
 * Selects the git question {@link GitCommand.currentBranch} asks.
 *
 * @see {@link CurrentBranchMode} for the runtime schema of accepted modes.
 * @category type-level
 * @since 0.0.0
 */
export type CurrentBranchMode = typeof CurrentBranchMode.Type;

// Implementation of GitCommand.currentBranch; the public contract lives on the static.
const currentBranch = (mode: CurrentBranchMode = "abbrev-ref"): GitInvocation =>
  mode === "show-current" ? git(["branch", "--show-current"]) : git(["rev-parse", "--abbrev-ref", "HEAD"]);

// Implementation of GitCommand.repoRoot; the public contract lives on the static.
const repoRoot = (): GitInvocation => git(["rev-parse", "--show-toplevel"]);

// Implementation of GitCommand.commonDir; the public contract lives on the static.
const commonDir = (): GitInvocation => git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);

// Implementation of GitCommand.commitInfo; the public contract lives on the static.
const commitInfo = (ref = "HEAD"): GitInvocation =>
  git(["log", "--no-show-signature", "-1", "--format=%H%x00%G?%x00%B", ref]);

/**
 * The `git log` record format: a NUL record opener followed by the six
 * NUL-joined header fields the log listing decodes — `%H`, `%aI`, `%cI`,
 * `%an`, `%ae` and the subject `%s`.
 *
 * **Details**
 *
 * Paths and name-status codes are nonempty and cannot contain NUL, so the
 * empty token emitted before a header is an unambiguous boundary outside the
 * body space. The six header tokens are read by position before parsing the
 * body; `%s` is the message's first paragraph folded onto one line, so it
 * cannot carry a newline and, like every commit-message byte, cannot carry a
 * NUL.
 */
const LOG_FORMAT = "--format=%x00%H%x00%aI%x00%cI%x00%an%x00%ae%x00%s";

/**
 * The body-shape options {@link GitCommand.log} accepts beyond the walk
 * itself. `nameStatus` swaps `--name-only` for `--name-status`; `diffFilter`
 * and `findRenames` select and detect changes in either body mode (the
 * service validates both pre-spawn); `quotePath: false` prepends the global
 * `-c core.quotePath=false`.
 */
type LogOptions = {
  readonly nameStatus?: boolean;
  readonly diffFilter?: string;
  readonly findRenames?: number;
  readonly quotePath?: false;
};

// Implementation of GitCommand.log; the public contract lives on the static.
const log = (
  paths: ReadonlyArray<string> = [],
  follow = false,
  limit?: number,
  firstParentDiffMerges = false,
  options: LogOptions = {}
): GitInvocation =>
  git([
    ...(options.quotePath === false ? ["-c", "core.quotePath=false"] : []),
    "log",
    "--no-show-signature",
    "-z",
    LOG_FORMAT,
    options.nameStatus === true ? "--name-status" : "--name-only",
    ...(options.diffFilter !== undefined ? [`--diff-filter=${options.diffFilter}`] : []),
    ...(options.findRenames !== undefined ? [`--find-renames=${options.findRenames}%`] : []),
    ...(follow ? ["--follow"] : []),
    ...(firstParentDiffMerges ? ["--diff-merges=first-parent"] : []),
    ...(limit !== undefined ? [`--max-count=${limit}`] : []),
    ...pathspecArgs(paths),
  ]);

/**
 * Which configuration file a read is scoped to.
 *
 * **Gotchas**
 *
 * Omitted, git reads the MERGED configuration — repository-local plus global
 * plus system — which is what a consumer wants for "what is the effective
 * value" and precisely wrong for "what does THIS checkout declare". A globally
 * set key otherwise shadows a decision that is really about one repository, and
 * an enumerate-then-remove flow reads at a different scope than
 * `configRemoveSection` writes at.
 *
 * **Example** (Validate a configuration read scope)
 *
 * ```ts
 * import { GitConfigScope } from "@beep/git/GitCommand";
 * import * as S from "effect/Schema";
 *
 * const isScope = S.is(GitConfigScope);
 *
 * console.log(isScope("local")) // true
 * console.log(isScope("merged")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const GitConfigScope = LiteralKit(["local", "global", "system", "worktree"]).pipe(
  $I.annoteSchema("GitConfigScope", { description: "Which Git configuration file a read is scoped to." })
);
/**
 * Selects the configuration file used by scoped configuration reads.
 *
 * @see {@link GitConfigScope} for the runtime schema of accepted scope names.
 * @category type-level
 * @since 0.0.0
 */
export type GitConfigScope = typeof GitConfigScope.Type;

/** The scope flag, or nothing for the merged read. */
const scopeArgs = (scope: GitConfigScope | undefined): ReadonlyArray<string> =>
  scope === undefined ? [] : [`--${scope}`];

// Implementation of GitCommand.configGet; the public contract lives on the static.
const configGet = (key: string, scope?: GitConfigScope): GitInvocation =>
  git(["config", ...scopeArgs(scope), "--get", key]);

// Implementation of GitCommand.remoteUrl; the public contract lives on the static.
const remoteUrl = (remote = "origin", push = false): GitInvocation =>
  git(["remote", "get-url", ...(push ? ["--push"] : []), remote]);

/**
 * `--untracked-files=<mode>`'s domain: `all` lists every file inside an
 * untracked directory, `normal` (git's default) collapses the directory to
 * one `dir/` entry, `no` omits untracked paths entirely.
 *
 * **Example** (Validate an untracked-files mode)
 *
 * ```ts
 * import { StatusUntrackedFiles } from "@beep/git/GitCommand";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(StatusUntrackedFiles)("all")) // true
 * console.log(S.is(StatusUntrackedFiles)("-uall")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StatusUntrackedFiles = LiteralKit(["all", "normal", "no"]).pipe(
  $I.annoteSchema("StatusUntrackedFiles", { description: "How `git status` reports untracked paths." })
);
/**
 * Selects how `git status` reports untracked paths.
 *
 * @see {@link StatusUntrackedFiles} for the runtime schema of accepted modes.
 * @category type-level
 * @since 0.0.0
 */
export type StatusUntrackedFiles = typeof StatusUntrackedFiles.Type;

/**
 * `--ignore-submodules=<when>`'s domain: `none` reports a submodule as
 * changed when it has untracked or modified files or its HEAD moved,
 * `untracked` ignores untracked content, `dirty` ignores all working-tree
 * changes, `all` hides submodule changes entirely.
 *
 * **Example** (Validate an ignore-submodules mode)
 *
 * ```ts
 * import { StatusIgnoreSubmodules } from "@beep/git/GitCommand";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(StatusIgnoreSubmodules)("none")) // true
 * console.log(S.is(StatusIgnoreSubmodules)("never")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const StatusIgnoreSubmodules = LiteralKit(["none", "untracked", "dirty", "all"]).pipe(
  $I.annoteSchema("StatusIgnoreSubmodules", { description: "Which submodule changes `git status` ignores." })
);
/**
 * Selects which submodule changes `git status` ignores.
 *
 * @see {@link StatusIgnoreSubmodules} for the runtime schema of accepted modes.
 * @category type-level
 * @since 0.0.0
 */
export type StatusIgnoreSubmodules = typeof StatusIgnoreSubmodules.Type;

/**
 * The options {@link GitCommand.status} accepts. `noOptionalLocks` is the one
 * GLOBAL flag (`git --no-optional-locks status ...`), rendered before the
 * subcommand; the rest follow `--porcelain -z`, and the pathspec sits behind
 * `--`.
 */
type StatusOptions = {
  readonly ignoreSubmodules?: StatusIgnoreSubmodules;
  readonly noOptionalLocks?: boolean;
  readonly noRenames?: boolean;
  readonly pathspec?: ReadonlyArray<string>;
  readonly untrackedFiles?: StatusUntrackedFiles;
};

// Implementation of GitCommand.status; the public contract lives on the static.
const status = (options: StatusOptions = {}): GitInvocation =>
  git([
    ...(options.noOptionalLocks === true ? ["--no-optional-locks"] : []),
    "status",
    "--porcelain",
    "-z",
    ...(options.untrackedFiles !== undefined ? [`--untracked-files=${options.untrackedFiles}`] : []),
    ...(options.ignoreSubmodules !== undefined ? [`--ignore-submodules=${options.ignoreSubmodules}`] : []),
    ...(options.noRenames === true ? ["--no-renames"] : []),
    ...pathspecArgs(options.pathspec),
  ]);

// Implementation of GitCommand.submoduleStatus; the public contract lives on the static.
const submoduleStatus = (paths: ReadonlyArray<string> = [], recursive = false): GitInvocation =>
  git(["submodule", "status", ...(recursive ? ["--recursive"] : []), ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleInit; the public contract lives on the static.
const submoduleInit = (paths: ReadonlyArray<string> = []): GitInvocation =>
  git(["submodule", "init", ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleDeinit; the public contract lives on the static.
const submoduleDeinit: {
  (paths: ReadonlyArray<string>, all?: boolean, force?: boolean): GitInvocation;
  (all?: boolean, force?: boolean): (paths: ReadonlyArray<string>) => GitInvocation;
} = dual(
  (args) => A.isArray(args[0]),
  (paths: ReadonlyArray<string>, all?: boolean, force?: boolean): GitInvocation =>
    git([
      "submodule",
      "deinit",
      ...(force === true ? ["--force"] : []),
      ...(all === true ? ["--all"] : ["--", ...paths]),
    ])
);

// Implementation of GitCommand.submoduleSync; the public contract lives on the static.
const submoduleSync = (paths: ReadonlyArray<string> = [], recursive = false): GitInvocation =>
  git(["submodule", "sync", ...(recursive ? ["--recursive"] : []), ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleSetUrl; the public contract lives on the static.
const submoduleSetUrl: {
  (path: string, url: string): GitInvocation;
  (url: string): (path: string) => GitInvocation;
} = dual(2, (path: string, url: string): GitInvocation => git(["submodule", "set-url", "--", path, secretUrl(url)]));

// Implementation of GitCommand.submoduleSetBranch; the public contract lives on the static.
const submoduleSetBranch = (path: string, branch?: string): GitInvocation =>
  git(["submodule", "set-branch", ...(branch === undefined ? ["--default"] : ["--branch", branch]), "--", path]);

// Implementation of GitCommand.submoduleAbsorbgitdirs; the public contract lives on the static.
const submoduleAbsorbgitdirs = (paths: ReadonlyArray<string> = []): GitInvocation =>
  git(["submodule", "absorbgitdirs", ...(paths.length > 0 ? ["--", ...paths] : [])]);

// Implementation of GitCommand.submoduleForeach; the public contract lives on the static.
const submoduleForeach: {
  (command: string, recursive?: boolean): GitInvocation;
  (recursive?: boolean): (command: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (command: string, recursive?: boolean): GitInvocation =>
    git(["submodule", "foreach", ...(recursive === true ? ["--recursive"] : []), command])
);

// Implementation of GitCommand.lsRemote; the public contract lives on the static.
const lsRemote: {
  (remote: string, heads?: boolean, tags?: boolean, patterns?: ReadonlyArray<string>): GitInvocation;
  (heads?: boolean, tags?: boolean, patterns?: ReadonlyArray<string>): (remote: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (remote: string, heads?: boolean, tags?: boolean, patterns: ReadonlyArray<string> = []): GitInvocation =>
    git([
      "ls-remote",
      ...(heads === true ? ["--heads"] : []),
      ...(tags === true ? ["--tags"] : []),
      secretUrl(remote),
      ...patterns,
    ])
);

// Implementation of GitCommand.remoteAdd; the public contract lives on the static.
const remoteAdd: {
  (name: string, url: string): GitInvocation;
  (url: string): (name: string) => GitInvocation;
} = dual(2, (name: string, url: string): GitInvocation => git(["remote", "add", name, secretUrl(url)]));

// Implementation of GitCommand.remoteRemove; the public contract lives on the static.
const remoteRemove = (name: string): GitInvocation => git(["remote", "remove", name]);

// Implementation of GitCommand.remoteSetUrl; the public contract lives on the static.
const remoteSetUrl: {
  (name: string, url: string): GitInvocation;
  (url: string): (name: string) => GitInvocation;
} = dual(2, (name: string, url: string): GitInvocation => git(["remote", "set-url", name, secretUrl(url)]));

// Renders a stash index into git's reflog-style stash ref. The interpolation is
// injection-safe by construction: the service refuses a non-integer index
// before any spawn, and an integer cannot begin with `-`... a negative integer
// can, which is exactly why the service guard requires a NON-NEGATIVE integer.
const stashRef = (index: number): string => `stash@{${index}}`;

// Implementation of GitCommand.stashPush; the public contract lives on the static.
const stashPush = (message?: string, includeUntracked = false, paths: ReadonlyArray<string> = []): GitInvocation =>
  git([
    "stash",
    "push",
    ...(includeUntracked ? ["--include-untracked"] : []),
    ...(message !== undefined ? ["-m", message] : []),
    ...(paths.length > 0 ? ["--", ...paths] : []),
  ]);

// Implementation of GitCommand.stashPop; the public contract lives on the static.
const stashPop = (index?: number): GitInvocation =>
  git(["stash", "pop", ...(index !== undefined ? [stashRef(index)] : [])]);

// Implementation of GitCommand.stashApply; the public contract lives on the static.
const stashApply = (index?: number): GitInvocation =>
  git(["stash", "apply", ...(index !== undefined ? [stashRef(index)] : [])]);

// Implementation of GitCommand.stashDrop; the public contract lives on the static.
const stashDrop = (index?: number): GitInvocation =>
  git(["stash", "drop", ...(index !== undefined ? [stashRef(index)] : [])]);

// Implementation of GitCommand.stashList; the public contract lives on the static.
const stashList = (): GitInvocation => git(["stash", "list", "-z", "--format=%gd%x1f%H%x1f%gs"]);

// Implementation of GitCommand.branchList; the public contract lives on the static.
const branchList = (remotes = false, all = false): GitInvocation =>
  git([
    "branch",
    "--list",
    ...(all ? ["--all"] : remotes ? ["--remotes"] : []),
    "--format=%(HEAD)%00%(refname:short)%00%(objectname)",
  ]);

// Implementation of GitCommand.tagCreate; the public contract lives on the static.
const tagCreate = (name: string, ref?: string, message?: string, force = false): GitInvocation =>
  git([
    "tag",
    ...(force ? ["--force"] : []),
    ...(message !== undefined ? ["-m", message] : []),
    name,
    ...(ref !== undefined ? [ref] : []),
  ]);

// Implementation of GitCommand.tagDelete; the public contract lives on the static.
const tagDelete = (name: string): GitInvocation => git(["tag", "--delete", name]);

// Implementation of GitCommand.tagList; the public contract lives on the static.
const tagList = (pattern?: string): GitInvocation =>
  git(["tag", "--list", ...(pattern !== undefined ? [pattern] : [])]);

// Implementation of GitCommand.forEachRef; the public contract lives on the static.
const forEachRef = (patterns: ReadonlyArray<string> = []): GitInvocation =>
  git(["for-each-ref", "--format=%(refname)%00%(objectname)%00%(objecttype)", ...patterns]);

// Implementation of GitCommand.revList; the public contract lives on the static.
const revList: {
  (ref: string, limit?: number, firstParent?: boolean): GitInvocation;
  (limit?: number, firstParent?: boolean): (ref: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (ref: string, limit?: number, firstParent?: boolean): GitInvocation =>
    git([
      "rev-list",
      ...(limit !== undefined ? [`--max-count=${limit}`] : []),
      ...(firstParent === true ? ["--first-parent"] : []),
      ref,
    ])
);

// Implementation of GitCommand.commit; the public contract lives on the static.
const commit: {
  (
    message: string,
    all?: boolean,
    allowEmpty?: boolean,
    amend?: boolean,
    author?: string,
    only?: boolean,
    noVerify?: boolean
  ): GitInvocation;
  (
    all?: boolean,
    allowEmpty?: boolean,
    amend?: boolean,
    author?: string,
    only?: boolean,
    noVerify?: boolean
  ): (message: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (
    message: string,
    all?: boolean,
    allowEmpty?: boolean,
    amend?: boolean,
    author?: string,
    only?: boolean,
    noVerify?: boolean
  ): GitInvocation =>
    git([
      "commit",
      ...(all === true ? ["--all"] : []),
      ...(allowEmpty === true ? ["--allow-empty"] : []),
      ...(amend === true ? ["--amend"] : []),
      ...(only === true ? ["--only"] : []),
      ...(noVerify === true ? ["--no-verify"] : []),
      ...(author !== undefined ? [`--author=${author}`] : []),
      "-m",
      message,
    ])
);

// Implementation of GitCommand.push; the public contract lives on the static.
const push = (
  remote: string,
  refspec?: string,
  force = false,
  forceWithLease = false,
  tags = false,
  setUpstream = false
): GitInvocation =>
  git([
    "push",
    ...(force ? ["--force"] : []),
    ...(forceWithLease ? ["--force-with-lease"] : []),
    ...(tags ? ["--tags"] : []),
    ...(setUpstream ? ["--set-upstream"] : []),
    secretUrl(remote),
    ...(refspec !== undefined ? [refspec] : []),
  ]);

// Implementation of GitCommand.pull; the public contract lives on the static.
const pull = (remote: string, ref?: string, rebase = false, ffOnly = false): GitInvocation =>
  git([
    "pull",
    ...(rebase ? ["--rebase"] : []),
    ...(ffOnly ? ["--ff-only"] : []),
    secretUrl(remote),
    ...(ref !== undefined ? [ref] : []),
  ]);

// Implementation of GitCommand.configList; the public contract lives on the static.
const configList = (file?: string, scope?: GitConfigScope): GitInvocation =>
  git(["config", ...(file !== undefined ? ["-f", file] : []), ...scopeArgs(scope), "--list", "-z"]);

// Implementation of GitCommand.configGetAll; the public contract lives on the static.
const configGetAll = (key: string, file?: string): GitInvocation =>
  git(["config", ...(file !== undefined ? ["-f", file] : []), "--get-all", "-z", key]);

// Implementation of GitCommand.configUnset; the public contract lives on the static.
const configUnset = (key: string, file?: string, all = false): GitInvocation =>
  git(["config", ...(file !== undefined ? ["-f", file] : []), all ? "--unset-all" : "--unset", key]);

// Implementation of GitCommand.configRemoveSection; the public contract lives on the static.
const configRemoveSection = (section: string, file?: string): GitInvocation =>
  git(["config", ...(file !== undefined ? ["-f", file] : []), "--remove-section", section]);

// Implementation of GitCommand.configRenameSection; the public contract lives on the static.
const configRenameSection = (oldName: string, newName: string, file?: string): GitInvocation =>
  git(["config", ...(file !== undefined ? ["-f", file] : []), "--rename-section", oldName, newName]);

// Implementation of GitCommand.rm; the public contract lives on the static.
const rm: {
  (paths: ReadonlyArray<string>, cached?: boolean, recursive?: boolean, force?: boolean): GitInvocation;
  (cached?: boolean, recursive?: boolean, force?: boolean): (paths: ReadonlyArray<string>) => GitInvocation;
} = dual(
  (args) => A.isArray(args[0]),
  (paths: ReadonlyArray<string>, cached?: boolean, recursive?: boolean, force?: boolean): GitInvocation =>
    git([
      "rm",
      ...(cached === true ? ["--cached"] : []),
      ...(recursive === true ? ["-r"] : []),
      ...(force === true ? ["--force"] : []),
      "--",
      ...paths,
    ])
);

// Implementation of GitCommand.mv; the public contract lives on the static.
const mv = (source: string, destination: string, force = false): GitInvocation =>
  git(["mv", ...(force ? ["--force"] : []), "--", source, destination]);

// Implementation of GitCommand.checkIgnore; the public contract lives on the static.
const checkIgnore = (paths: ReadonlyArray<string>): GitInvocation =>
  git(
    ["check-ignore", "-z", "--stdin"],
    pipe(
      paths,
      A.map((path) => `${path}\0`),
      A.join("")
    )
  );

// Implementation of GitCommand.worktreeAdd; the public contract lives on the static.
const worktreeAdd = (path: string, ref?: string, detach = false, force = false): GitInvocation =>
  git([
    "worktree",
    "add",
    ...(force ? ["--force"] : []),
    ...(detach ? ["--detach"] : []),
    path,
    ...(ref !== undefined ? [ref] : []),
  ]);

// Implementation of GitCommand.worktreeList; the public contract lives on the static.
const worktreeList = (): GitInvocation => git(["worktree", "list", "--porcelain", "-z"]);

// Implementation of GitCommand.worktreePrune; the public contract lives on the static.
const worktreePrune = (): GitInvocation => git(["worktree", "prune"]);

// Implementation of GitCommand.worktreeRemove; the public contract lives on the static.
const worktreeRemove: {
  (path: string, force?: boolean): GitInvocation;
  (force?: boolean): (path: string) => GitInvocation;
} = dual(
  (args) => P.isString(args[0]),
  (path: string, force?: boolean): GitInvocation =>
    git(["worktree", "remove", ...(force === true ? ["--force"] : []), path])
);

// Implementation of GitCommand.lsFiles; the public contract lives on the static.
const lsFiles = (pathspec: ReadonlyArray<string> = []): GitInvocation =>
  git(["ls-files", "--stage", "-z", ...(pathspec.length > 0 ? ["--", ...pathspec] : [])]);

/**
 * Pure constructors for the `git` {@link GitInvocation} values this package
 * spawns.
 *
 * **Details**
 *
 * Every constructor returns a cwd-less, argv-only {@link GitInvocation} — no
 * spawning, no working directory baked in. `Git` applies the working
 * directory per call with `ChildProcess.setCwd` on `invocation.command` and
 * owns the actual spawn, timeout, and error classification.
 *
 * **Redaction policy.** A constructor whose argv carries a sensitive
 * positional — a config value (`configSet`), or a URL that may embed
 * userinfo (the remote of `fetch`, `fetchUnshallow`, `lsRemote`, `push` and
 * `pull`, and the url of `submoduleAdd`, `submoduleSetUrl`, `remoteAdd` and
 * `remoteSetUrl`) —
 * masks it in {@link GitInvocation.redactedArgs}: a config value becomes
 * `<redacted>` wholesale, a URL keeps everything but its `userinfo@`
 * component. The `Git` service persists only the redacted argv in error
 * values, and its span annotations carry stable identifiers only (`cwd`,
 * keys, paths, remote/ref names) — never config values, never URLs.
 *
 * **Example** (Inspect a redacted configuration invocation)
 *
 * ```ts
 * import { GitCommand } from "@beep/git/GitCommand";
 *
 * const invocation = GitCommand.configSet("http.extraHeader", "Authorization: example-token");
 *
 * console.log(invocation.redactedArgs.join(" ")) // config http.extraHeader <redacted>
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export class GitCommand {
  private constructor() {}

  /**
   * Builds an invocation to read a file from a committed revision.
   *
   * **Details**
   *
   * `git show <ref>:<path>` — the contents of `path` as it existed at `ref`,
   * without checking anything out.
   *
   * **Example** (Inspect show argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.show("HEAD", "README.md");
   *
   * console.log(invocation.redactedArgs.join(" ")) // show HEAD:README.md
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly show = show;

  /**
   * Builds an invocation to list committed tree entries recursively.
   *
   * **Details**
   *
   * `git ls-tree -r -z [--full-tree] <ref> [-- <pathspec>...]` — every path in
   * the tree at `ref`, recursively, NUL-terminated, optionally scoped to
   * `pathspec`.
   *
   * **Gotchas**
   *
   * `-z` is load-bearing: git paths may themselves contain newlines, so the
   * caller must split on `"\0"`, never on `"\n"`. When `pathspec` is provided,
   * a literal `--` separator is inserted before the pathspec entries to prevent
   * git from interpreting pathspec values as options.
   *
   * Without `--full-tree`, `ls-tree` run from a subdirectory lists only that
   * subdirectory's entries, with paths relative to it. `fullTree: true` makes
   * the listing root-anchored whatever the `cwd`, so a reader need not resolve
   * the repository root first.
   *
   * **Example** (Inspect ls tree argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.lsTree("HEAD", ["src"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // ls-tree -r -z HEAD -- src
   * ```
   *
   * **Example** (List the whole tree from any cwd)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.lsTree("HEAD", [], true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // ls-tree -r -z --full-tree HEAD
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly lsTree = lsTree;

  /**
   * Builds an invocation to probe whether an object exists.
   *
   * **Details**
   *
   * `git cat-file -e <ref>` — checks whether `ref` resolves to an existing
   * object, without printing it. A non-zero exit means the ref does not exist.
   *
   * **Example** (Inspect ref exists argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.refExists("HEAD");
   *
   * console.log(invocation.redactedArgs.join(" ")) // cat-file -e HEAD
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly refExists = refExists;

  /**
   * Builds an invocation to find the best common ancestor of two revisions.
   *
   * **Details**
   *
   * `git merge-base <a> <b>` — the best common ancestor commit of `a` and `b`.
   *
   * **Gotchas**
   *
   * Two refs with NO common ancestor (disjoint histories) exit 1 with
   * silent stderr. One builder backs both service members: `Git.mergeBase`
   * surfaces that shape as a loud `GitCommandError` (absence is
   * exceptional), while `Git.mergeBaseOption` degrades it to `Option.none`
   * (a probe answer). The argv is identical either way.
   *
   * **Example** (Inspect merge base argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.mergeBase("main", "feature");
   *
   * console.log(invocation.redactedArgs.join(" ")) // merge-base main feature
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mergeBase = mergeBase;

  /**
   * Builds an invocation to ask whether one commit is an ancestor of another.
   *
   * **Details**
   *
   * `git merge-base --is-ancestor <ancestor> <descendant>` — prints nothing
   * and answers through its exit code: 0 when `ancestor` is reachable from
   * `descendant` (a commit is its own ancestor), 1 when it is not.
   *
   * **Gotchas**
   *
   * The negative answer is a SILENT exit 1, the same shape `merge-base` uses
   * for disjoint histories. `Git.isAncestor` reads it as `false`; an unknown
   * object still exits 128 with a `Not a valid object name` stderr and stays
   * an `UnknownRefError`.
   *
   * **Example** (Inspect is-ancestor argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.isAncestor("main", "feature");
   *
   * console.log(invocation.redactedArgs.join(" ")) // merge-base --is-ancestor main feature
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly isAncestor = isAncestor;

  /**
   * Builds an invocation to list paths changed since a merge base.
   *
   * **Details**
   *
   * `git diff --name-only -z (--relative | --no-relative) [--no-renames] [--diff-filter=<letters>] (<base>...<head> | <base> <head>) [-- <pathspec>...]`
   * — the paths that differ between the merge base of `base` and `head`, and
   * `head` itself, NUL-terminated.
   *
   * `options.noRenames` turns rename detection off so a moved file lists as
   * its old AND new path; `options.diffFilter` keeps only the named status
   * letters (lower case excludes them); `options.pathspec` scopes the diff
   * behind `--`; `options.twoDot` emits the plain `<base> <head>` pair — a
   * tree-to-tree comparison — instead of the merge-base `...` form. With no
   * option passed the argv is exactly the four-flag range form it always was.
   *
   * **Gotchas**
   *
   * `-z` is load-bearing here too, for the same reason as {@link GitCommand.lsTree}: split
   * the output on `"\0"`, never on `"\n"`.
   *
   * The relative flag is **explicit in both branches** — `--relative` when
   * `relative` is true, `--no-relative` when false — never omitted. git honors a
   * configured `diff.relative=true` when no flag is passed, so an omitted flag
   * would silently yield cwd-relative paths on such a machine even for
   * `relative: false`, misaligning with {@link GitCommand.untrackedFiles}'s
   * repo-root base and breaking `Git.workingChanges`' dedup in a nested workspace.
   * `--relative` scopes the report to `cwd` (a workspace nested inside a larger
   * repository); `--no-relative` overrides any `diff.relative` config and reports
   * paths from the repository top-level.
   *
   * **Example** (Inspect changed files argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.changedFiles("main", "feature", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // diff --name-only -z --relative main...feature
   * ```
   *
   * **Example** (Filter, scope and compare trees directly)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.changedFiles("main", "HEAD", false, {
   *   noRenames: true,
   *   diffFilter: "ACMR",
   *   twoDot: true,
   *   pathspec: ["src"],
   * });
   *
   * console.log(invocation.redactedArgs.join(" "));
   * // diff --name-only -z --no-relative --no-renames --diff-filter=ACMR main HEAD -- src
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly changedFiles = changedFiles;

  /**
   * Builds an invocation to list unstaged paths.
   *
   * **Details**
   *
   * `git diff --name-only -z (--relative | --no-relative) [--no-renames] [--diff-filter=<letters>] [<head>] [-- <pathspec>...]`
   * — the paths with unstaged working-tree changes (the working tree against
   * the index, or against `options.head` when one is given), NUL-terminated.
   *
   * `relative` behaves as it does for {@link GitCommand.changedFiles}, including the
   * explicit-flag-in-both-branches rule: `--no-relative` is passed for
   * `relative: false` so a configured `diff.relative=true` cannot silently make the
   * output cwd-relative. `noRenames`, `diffFilter` and `pathspec` render as
   * they do for {@link GitCommand.changedFiles}; `head` names a commit to
   * compare the working tree against instead of the index.
   *
   * **Example** (Inspect unstaged changes argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.unstagedChanges(true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // diff --name-only -z --relative
   * ```
   *
   * **Example** (Compare the working tree against HEAD under a pathspec)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.unstagedChanges(false, { diffFilter: "ACMR", head: "HEAD", pathspec: ["src"] });
   *
   * console.log(invocation.redactedArgs.join(" "));
   * // diff --name-only -z --no-relative --diff-filter=ACMR HEAD -- src
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly unstagedChanges = unstagedChanges;

  /**
   * Builds an invocation to list staged paths.
   *
   * **Details**
   *
   * `git diff --name-only -z (--relative | --no-relative) --cached [--no-renames] [--diff-filter=<letters>] [<head>] [-- <pathspec>...]`
   * — the paths staged for the next commit (the index against `HEAD`, or
   * against `options.head` when one is given), NUL-terminated.
   *
   * `relative` behaves as it does for {@link GitCommand.changedFiles}, including the
   * explicit `--no-relative` on the `relative: false` branch. `noRenames`,
   * `diffFilter`, `head` and `pathspec` render as they do for
   * {@link GitCommand.unstagedChanges}, after `--cached`.
   *
   * **Example** (Inspect staged changes argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stagedChanges();
   *
   * console.log(invocation.redactedArgs.join(" ")) // diff --name-only -z --no-relative --cached
   * ```
   *
   * **Example** (Staged additions only, renames split into delete plus add)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stagedChanges(false, { noRenames: true, diffFilter: "A" });
   *
   * console.log(invocation.redactedArgs.join(" "));
   * // diff --name-only -z --no-relative --cached --no-renames --diff-filter=A
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly stagedChanges = stagedChanges;

  /**
   * Builds an invocation to list untracked, non-ignored paths.
   *
   * **Details**
   *
   * `git ls-files --others --exclude-standard -z [--full-name] [-- <pathspec>...]`
   * — the untracked paths git is not ignoring, NUL-terminated, optionally
   * scoped to `pathspec` behind `--`.
   *
   * `ls-files` reports paths relative to `cwd` by default, matching the
   * `--relative` diffs. When `relative` is `false`, `--full-name` makes it emit
   * repo-root-relative paths instead, so the untracked half shares a base with the
   * un-`--relative` diffs — otherwise `Git.workingChanges`'s union would dedup two
   * spellings of one file from a nested `cwd`.
   *
   * **Example** (Inspect untracked files argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.untrackedFiles();
   *
   * console.log(invocation.redactedArgs.join(" ")) // ls-files --others --exclude-standard -z --full-name
   * ```
   *
   * **Example** (Scope the listing to a subtree)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.untrackedFiles(false, ["packages"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // ls-files --others --exclude-standard -z --full-name -- packages
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly untrackedFiles = untrackedFiles;

  /**
   * Builds an invocation to resolve a revision to an object id.
   *
   * **Details**
   *
   * `git rev-parse --verify <ref>` — resolves `ref` to its full object id, or
   * fails if `ref` does not resolve. With any option present the argv becomes
   * `rev-parse --verify [--quiet] --end-of-options <ref>[^{commit}]`:
   * `--end-of-options` keeps a ref that begins with `-` positional,
   * `peel: "commit"` resolves an annotated tag through to the commit it
   * points at, and `quiet` makes an unknown ref a silent exit 1 (the `Git` service
   * still classifies it as `UnknownRefError`). Without options the argv is
   * exactly the two-flag form.
   *
   * **Example** (Inspect rev parse argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.revParse("HEAD");
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-parse --verify HEAD
   * ```
   *
   * **Example** (Peel a tag quietly)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.revParse("v1.0.0", { peel: "commit", quiet: true });
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-parse --verify --quiet --end-of-options v1.0.0^{commit}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly revParse = revParse;

  /**
   * Builds an invocation to switch the working tree to a revision.
   *
   * **Details**
   *
   * Mutating: `git checkout [--detach] <ref>` — moves the working tree (and, for
   * a branch ref, `HEAD`) to `ref`. When `detach` is true, checks out the ref in
   * detached-HEAD state.
   *
   * **Example** (Inspect checkout argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.checkout("v1.0.0", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // checkout --detach v1.0.0
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly checkout = checkout;

  /**
   * Builds an invocation to fetch a ref or refspec from a remote.
   *
   * **Details**
   *
   * Mutating: `git fetch [--depth <n>] [--unshallow] [--prune] <remote> [tag] <ref>`
   * — fetches the given ref from a remote, optionally with a depth limit, the
   * `--unshallow` mode, `--prune` (drop remote-tracking refs the remote no
   * longer has), and the `tag` keyword.
   *
   * **Gotchas**
   *
   * `ref` may also be a full refspec (`src:dst`, optionally `+`-prefixed) —
   * it is passed through VERBATIM, never transformed. That matters under a
   * single-branch clone (`actions/checkout`'s default): a bare-ref fetch
   * there updates `FETCH_HEAD` only and never creates the remote-tracking
   * ref, so `+refs/heads/<b>:refs/remotes/origin/<b>` is the only spelling
   * that materializes `origin/<b>`.
   *
   * `unshallow` is a distinct MODE like {@link GitCommand.fetchUnshallow}'s:
   * git rejects it in a non-shallow repository and rejects it alongside
   * `--depth`. `remote` may be a URL as well as a remote name; an embedded
   * `userinfo@` credential is masked in {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect fetch argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.fetch("https://user:token@example.com/repo.git", "main", 1);
   *
   * console.log(invocation.redactedArgs.join(" ")) // fetch --depth 1 https://<redacted>@example.com/repo.git main
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fetch = fetch;

  /**
   * Builds an invocation to complete the history of a shallow clone.
   *
   * **Details**
   *
   * Mutating: `git fetch --unshallow <remote>` — converts a shallow clone
   * into a complete one by fetching the missing history.
   *
   * **Gotchas**
   *
   * `--unshallow` is a distinct MODE, not a depth value: git rejects it
   * outright in a repository that is not shallow, with
   * `--unshallow on a complete repository does not make sense`, so it
   * cannot be expressed as `fetch`'s `depth` option. The caller decides
   * whether to run it — probe with `Git.isShallow` first.
   *
   * `remote` may be a URL as well as a remote name; an embedded `userinfo@`
   * credential is masked in {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect fetch unshallow argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.fetchUnshallow();
   *
   * console.log(invocation.redactedArgs.join(" ")) // fetch --unshallow origin
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fetchUnshallow = fetchUnshallow;

  /**
   * Builds an invocation to probe whether the repository is shallow.
   *
   * **Details**
   *
   * `git rev-parse --is-shallow-repository` — prints `true` when the
   * repository is a shallow clone, `false` otherwise.
   *
   * A dedicated probe constructor, deliberately separate from
   * {@link GitCommand.revParse}: `revParse` takes a REF and resolves it,
   * while this takes nothing and answers a repository-shape question.
   * Folding the flag into `revParse` would make that constructor
   * sometimes-takes-a-ref, sometimes-takes-a-flag.
   *
   * **Example** (Inspect is shallow argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.isShallow();
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-parse --is-shallow-repository
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly isShallow = isShallow;

  /**
   * Builds an invocation to reset HEAD and the selected repository state.
   *
   * **Details**
   *
   * Mutating: `git reset --soft|--mixed|--hard [<ref>]` — moves `HEAD` (and,
   * per mode, the index and working tree) to `ref`.
   *
   * The mode flag is always explicit — `--mixed` is emitted for the default
   * rather than omitted — so the argv states what runs. `ref` may be any
   * commit-ish, including a gitlink sha.
   *
   * **Example** (Inspect reset argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.reset("soft", "HEAD~1");
   *
   * console.log(invocation.redactedArgs.join(" ")) // reset --soft HEAD~1
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly reset = reset;

  /**
   * Builds an invocation to remove untracked working-tree files.
   *
   * **Details**
   *
   * Mutating: `git clean --force [-d] [-x] [-- <paths>...]` — deletes
   * untracked files from the working tree.
   *
   * `--force` is unconditional: this constructor exists so a consumer can
   * restore a tree to a known state (e.g. before retrying a non-idempotent
   * operation), and without `--force` git refuses to clean at all under the
   * default `clean.requireForce` config — a clean that silently did nothing
   * would hand the retry the same dirty tree. `-d` removes untracked
   * directories too; `-x` removes ignored files as well. The literal `--`
   * separator makes the optional pathspec injection-safe by construction.
   *
   * **Example** (Inspect clean argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.clean(true, false, ["build"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // clean --force -d -- build
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly clean = clean;

  /**
   * Builds an invocation to restore selected paths.
   *
   * **Details**
   *
   * Mutating: `git restore [--source <ref>] [--staged] [--worktree] -- <paths...>`
   * — restores the given paths from the index (or from `source`), the
   * `checkout -- <paths>`-shaped operation.
   *
   * This is a separate constructor precisely because {@link GitCommand.checkout}'s
   * service guard refuses `--` and option-like refs by design — `restore` is
   * git's own verb for pathspec restoration, and its paths always sit behind
   * a literal `--`, so they are injection-safe by construction. With neither
   * `staged` nor `worktree` set, git defaults to restoring the working tree.
   *
   * **Example** (Inspect restore argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.restore(["src/main.ts"], "HEAD", true, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // restore --source HEAD --staged --worktree -- src/main.ts
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly restore = restore;

  /**
   * Builds an invocation to create or reset a branch, optionally checking it out.
   *
   * **Details**
   *
   * Mutating: `git branch [-f] <name> [<start-point>]`, or
   * `git checkout (-b | -B) <name> [<start-point>]` when `checkout` is true —
   * creates a branch, optionally from an explicit start point, optionally
   * switching to it, optionally force-resetting an existing branch.
   *
   * Branch creation is a branch-member concern, NOT a widening of
   * {@link GitCommand.checkout}: `checkout`'s contract stays "move to an
   * existing ref" and its option-like-ref refusal stays intact. The `-b` /
   * `-B` here is this constructor's own literal, never caller data.
   *
   * `force` with `checkout` exists because the delete-then-create longhand
   * (`branch -D` swallowed, then `checkout -b`) papers over a real edge:
   * `git branch -D` refuses to delete the currently checked-out branch,
   * while `checkout -B` resets it fine — one invocation handles both
   * states.
   *
   * **Example** (Inspect branch create argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.branchCreate("feature", "main", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // checkout -b feature main
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly branchCreate = branchCreate;

  /**
   * Builds an invocation to delete a local branch.
   *
   * **Details**
   *
   * Mutating: `git branch -d <name>` (or `-D` when `force` is true) —
   * deletes a local branch.
   *
   * **Gotchas**
   *
   * The default `-d` refuses to delete a branch not fully merged — a typed
   * failure, which is usually the honest answer. `force: true` emits `-D`
   * and deletes regardless.
   *
   * **Example** (Inspect branch delete argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.branchDelete("feature", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // branch -D feature
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly branchDelete = branchDelete;

  /**
   * Builds an invocation to update selected submodules.
   *
   * **Details**
   *
   * Mutating:
   * `git submodule update [--init] [--checkout] [--remote] [--no-fetch] [--recursive] [--force] [--depth <n>] [-- <paths>...]`
   * — updates registered submodules, optionally initializing them, with an
   * optional depth limit, and scoped to specific paths. The literal `--`
   * separator makes the pathspec injection-safe by construction.
   *
   * **Gotchas**
   *
   * `options.checkout` is the documented override for a
   * `submodule.<name>.update = none` configuration — without it, an update of
   * such a submodule silently skips it (git reports success and checks out
   * nothing). `options.fetch` accepts only the literal `false` (emitting
   * `--no-fetch`): git's default already fetches and offers no positive
   * `--fetch` spelling, so `true` would be an unrepresentable no-op.
   * `options.remote` tracks the remote branch's tip instead of the
   * superproject's recorded sha; `options.recursive` descends into nested
   * submodules; `options.force` discards local changes in the submodule
   * working tree (and re-checks-out even when the recorded sha is current).
   *
   * **Example** (Inspect submodule update argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleUpdate(true, 1, ["vendor/lib"], { checkout: true, recursive: true });
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule update --init --checkout --recursive --depth 1 -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleUpdate = submoduleUpdate;

  /**
   * Builds an invocation to register and initialize a submodule.
   *
   * **Details**
   *
   * Mutating: `git submodule add [--depth <n>] -- <url> <path>` — registers and
   * initializes a new submodule. The literal `--` separator makes the url and path
   * injection-safe by construction.
   *
   * An embedded `userinfo@` credential in `url` is masked in
   * {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect submodule add argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleAdd("https://user:token@example.com/lib.git", "vendor/lib", 1);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule add --depth 1 -- https://<redacted>@example.com/lib.git vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleAdd = submoduleAdd;

  /**
   * Builds an invocation to select sparse-checkout paths.
   *
   * **Details**
   *
   * Mutating: `git sparse-checkout set (--cone | --no-cone) <patterns...>` — configures
   * which paths are checked out in a sparse repository. The cone flag is explicit in both
   * branches — `--cone` when `cone` is true, `--no-cone` when false — to prevent git's
   * default from silently changing the behavior.
   *
   * **Example** (Inspect sparse checkout set argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.sparseCheckoutSet(["src", "test"], true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // sparse-checkout set --cone src test
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly sparseCheckoutSet = sparseCheckoutSet;

  /**
   * Builds an invocation to write a configuration value with redacted diagnostics.
   *
   * **Details**
   *
   * Mutating: `git config [-f <file>] <key> <value>` — writes a configuration value,
   * optionally into an explicit configuration file (e.g., `.gitmodules`).
   *
   * `value` may be a secret (a token, a credential-bearing URL), so it is
   * masked wholesale — as `<redacted>` — in
   * {@link GitInvocation.redactedArgs}. The key and file stay visible: they
   * are stable identifiers, and they are what a caller debugging a failed
   * write actually needs.
   *
   * **Example** (Inspect config set argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configSet("http.extraHeader", "Authorization: example-token");
   *
   * console.log(invocation.redactedArgs.join(" ")) // config http.extraHeader <redacted>
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configSet = configSet;

  /**
   * Builds an invocation to stage selected paths.
   *
   * **Details**
   *
   * Mutating: `git add -- <paths...>` — stages the given paths for commit. The literal
   * `--` separator makes the pathspec injection-safe by construction.
   *
   * **Example** (Inspect add argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.add(["src/main.ts"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // add -- src/main.ts
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly add = add;

  /**
   * Builds an invocation to list changed paths with their status codes.
   *
   * **Details**
   *
   * `git diff --name-status -z (--relative | --no-relative) [--find-renames=<n>%] [--diff-filter=<letters>] [<base> | <base>...<head> | <base> <head>] [-- <pathspec>...]`
   * — the changed paths WITH their one-letter status codes, NUL-terminated.
   *
   * With `head` omitted this is the single-argument diff form: the working tree
   * (staged + unstaged) against `base` — NOT a two-ref range. With `head`
   * present it is the familiar `base...head` merge-base form, matching
   * {@link GitCommand.changedFiles}, or the plain `<base> <head>` tree-to-tree
   * pair when `options.twoDot` is set. `-z` and the explicit relative flag
   * follow the same rules as {@link GitCommand.changedFiles}. In `-z` mode a
   * rename or copy entry is THREE NUL tokens: `R<score>`, the old path, the
   * new path. `options.findRenames` sets the similarity threshold rename
   * detection uses, `options.diffFilter` keeps only the named status letters
   * (lower case excludes them), and `options.pathspec` scopes the diff after
   * `--`.
   *
   * **Example** (Inspect name status argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.nameStatus("HEAD", undefined, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // diff --name-status -z --relative HEAD
   * ```
   *
   * **Example** (Detect renames at 50% within a subtree)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.nameStatus("main", "HEAD", false, {
   *   findRenames: 50,
   *   diffFilter: "ACMR",
   *   pathspec: ["src"],
   * });
   *
   * console.log(invocation.redactedArgs.join(" "));
   * // diff --name-status -z --no-relative --find-renames=50% --diff-filter=ACMR main...HEAD -- src
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly nameStatus = nameStatus;

  /**
   * Builds an invocation to look up a remote’s locally recorded default branch.
   *
   * **Details**
   *
   * `git symbolic-ref --quiet --short refs/remotes/<remote>/HEAD` — the name of
   * the default branch on the given remote, or empty string / exit 1 if unset.
   *
   * `--quiet` suppresses error messages; the exit code alone signals success
   * (0) or "symbolic-ref does not exist" (1). The contract is "does the remote
   * have a HEAD?" — an unset symbolic ref exits 1 silently, which `Git.defaultBranch`
   * degrades to `Option.none()` rather than a typed error. `symbolic-ref` is a
   * purely local ref lookup; it never touches the network.
   *
   * **Example** (Inspect default branch argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.defaultBranch();
   *
   * console.log(invocation.redactedArgs.join(" ")) // symbolic-ref --quiet --short refs/remotes/origin/HEAD
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly defaultBranch = defaultBranch;

  /**
   * Builds an invocation to identify the current branch.
   *
   * **Details**
   *
   * `git rev-parse --abbrev-ref HEAD` (the default, `"abbrev-ref"`) — the
   * name of the branch `HEAD` is pointing to — or `git branch --show-current`
   * (`"show-current"`), git's dedicated question for the same name.
   *
   * **Gotchas**
   *
   * `abbrev-ref` returns `"HEAD"` (detached state), `"<branch>"` (an attached
   * branch), or fails if the repository has no commits. `show-current` prints
   * an EMPTY line when detached and names an unborn branch instead of failing;
   * `Git.currentBranch` reads both detached spellings as `Option.none`.
   *
   * **Example** (Inspect current branch argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.currentBranch();
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-parse --abbrev-ref HEAD
   * ```
   *
   * **Example** (Ask through branch --show-current)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.currentBranch("show-current");
   *
   * console.log(invocation.redactedArgs.join(" ")) // branch --show-current
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly currentBranch = currentBranch;

  /**
   * Builds an invocation to locate the enclosing repository root.
   *
   * **Details**
   *
   * `git rev-parse --show-toplevel` — the filesystem path to the root of the
   * enclosing git repository.
   *
   * **Example** (Inspect repo root argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.repoRoot();
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-parse --show-toplevel
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly repoRoot = repoRoot;

  /**
   * Builds an invocation to locate the shared Git directory of linked worktrees.
   *
   * **Details**
   *
   * `git rev-parse --path-format=absolute --git-common-dir` — the absolute,
   * symlink-resolved path of the directory a repository and all of its linked
   * worktrees share.
   *
   * **Gotchas**
   *
   * Without `--path-format=absolute` git prints this relative to the working
   * directory in a plain checkout (`.git`) but absolute from inside a linked
   * worktree, so two answers cannot be compared as strings. The flag needs
   * git 2.31 or later.
   *
   * **Example** (Inspect common dir argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.commonDir();
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-parse --path-format=absolute --git-common-dir
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly commonDir = commonDir;

  /**
   * Builds an invocation to read a commit’s hash, signature status, and full message.
   *
   * **Details**
   *
   * `git log -1 --format=%H%x00%G?%x00%B <ref>` — a NUL-separated triple: the
   * full commit hash, the GPG trust level, and the full commit body (message),
   * all untrimmed.
   *
   * `%H` is the full object id (40-char sha1, or sha256 if configured).
   * `%x00` is a literal NUL byte (the separator). `%G?` is the GPG trust level
   * (`G` = good signature, `B` = bad, `U` = untrusted, `X` = expired, `Y` =
   * expired key, `R` = revoked key, `E` = error, or `N` = not signed).
   * `%B` is the full body, **untrimmed** — it includes leading/trailing
   * whitespace — so the caller must decide whether to trim it. Splits on the
   * two `\x00` bytes to extract all three values.
   *
   * **Example** (Inspect commit info argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.commitInfo();
   *
   * console.log(invocation.redactedArgs.join(" ")) // log -1 --format=%H%x00%G?%x00%B HEAD
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly commitInfo = commitInfo;

  /**
   * Builds an invocation to list commit metadata and changed paths.
   *
   * **Details**
   *
   * `git [-c core.quotePath=false] log --no-show-signature -z --format=%x00%H%x00%aI%x00%cI%x00%an%x00%ae%x00%s (--name-only | --name-status) [--diff-filter=<letters>] [--find-renames=<n>%]`
   * — a commit listing carrying each commit's sha, both ISO dates, its author
   * identity, its subject and the paths it touched. Three optional flags
   * follow, in this order: `--follow`, `--diff-merges=first-parent`,
   * `--max-count=N`, then the `--` separator and the pathspec.
   *
   * `-z` is unconditional and does two things at once: it terminates the
   * `--format` output with a NUL instead of a newline, and it makes
   * `--name-only` and `--name-status` emit paths RAW — no C-style quoting —
   * so a path containing a space, a quote or a newline comes back verbatim
   * and `core.quotePath` never enters the picture. `options.quotePath: false`
   * still prepends the global `-c core.quotePath=false` for a consumer whose
   * argv contract names it; under `-z` it changes no byte of the output.
   *
   * `%x00` opens every record with an empty NUL token, which neither a
   * pathname nor a status code can be. Each record is then
   * `\0<sha>\0<authoredAt>\0<committedAt>\0<authorName>\0<authorEmail>\0<subject>\0`
   * followed, when the commit touched anything, by `\n` and the body: one
   * NUL-terminated path per changed file under `--name-only`, or under
   * `--name-status` (`options.nameStatus`) the same `<code>\0<path>\0` /
   * `R<score>\0<old>\0<new>\0` tokens `GitCommand.nameStatus` emits.
   * `options.diffFilter` and `options.findRenames` apply in either body mode;
   * a commit whose diff the filter empties is omitted from the walk by git.
   *
   * `--follow` requires exactly one path — git's own restriction, enforced
   * pre-spawn by `Git.log`. Without `--diff-merges=first-parent` a merge
   * commit contributes a record with NO path lines, which is git's default
   * and not an anomaly.
   *
   * **Example** (Inspect log argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.log(["src/main.ts"], true, 5, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // log --no-show-signature -z --format=%x00%H%x00%aI%x00%cI%x00%an%x00%ae%x00%s --name-only --follow --diff-merges=first-parent --max-count=5 -- src/main.ts
   * ```
   *
   * **Example** (Deletions and renames with their status codes)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.log([], false, undefined, false, {
   *   nameStatus: true,
   *   diffFilter: "DR",
   *   findRenames: 50,
   *   quotePath: false,
   * });
   *
   * console.log(invocation.redactedArgs.join(" "));
   * // -c core.quotePath=false log --no-show-signature -z --format=%x00%H%x00%aI%x00%cI%x00%an%x00%ae%x00%s --name-status --diff-filter=DR --find-renames=50%
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly log = log;

  /**
   * Builds an invocation to read a configuration key at an optional scope.
   *
   * **Details**
   *
   * `git config --get <key>` — the value of the given git config key, or empty
   * string / exit 1 if unset.
   *
   * **Example** (Inspect config get argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configGet("core.autocrlf", "local");
   *
   * console.log(invocation.redactedArgs.join(" ")) // config --local --get core.autocrlf
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configGet = configGet;

  /**
   * Builds an invocation to read a remote’s fetch URL.
   *
   * **Details**
   *
   * `git remote get-url [--push] <remote>` — the fetch URL of the given
   * remote, or its push URL with `push`. A missing remote exits non-zero with
   * a "No such remote" stderr shape, which the `Git` service degrades to
   * `Option.none`, never a typed error.
   *
   * **Example** (Inspect remote url argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.remoteUrl();
   *
   * console.log(invocation.redactedArgs.join(" ")) // remote get-url origin
   * ```
   *
   * **Example** (Read the push URL)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.remoteUrl("upstream", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // remote get-url --push upstream
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly remoteUrl = remoteUrl;

  /**
   * Builds an invocation to read machine-readable working-tree status.
   *
   * **Details**
   *
   * `git [--no-optional-locks] status --porcelain -z [--untracked-files=<mode>] [--ignore-submodules=<when>] [--no-renames] [-- <pathspec>...]`
   * — the porcelain (stable, machine-readable) short status of every modified
   * file in the working tree, NUL-terminated.
   *
   * `options.untrackedFiles` picks how untracked paths list (`all` names
   * every file inside an untracked directory, where git's default collapses
   * it to one `dir/` entry); `options.ignoreSubmodules` picks which submodule
   * changes are hidden; `options.noRenames` reports a staged rename as a
   * delete plus an add instead of one `R` entry carrying the original path;
   * `options.pathspec` scopes the report behind `--`. With no option passed
   * the argv is exactly `status --porcelain -z`.
   *
   * **Gotchas**
   *
   * `-z` is load-bearing here too, for the same reason as
   * {@link GitCommand.lsTree}: split the output on `"\0"`, never on `"\n"`.
   * Each entry is a pair of status codes followed by a space and the path.
   *
   * `--no-optional-locks` is a GLOBAL git flag, not a `status` option: it is
   * rendered BEFORE the subcommand, so a reader that must not touch the index
   * (a monitor polling a tree another process is working in) can skip the
   * opportunistic index refresh git would otherwise write.
   *
   * **Example** (Inspect status argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.status();
   *
   * console.log(invocation.redactedArgs.join(" ")) // status --porcelain -z
   * ```
   *
   * **Example** (A lock-free, untracked-expanding, rename-free read)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.status({
   *   noOptionalLocks: true,
   *   untrackedFiles: "all",
   *   ignoreSubmodules: "none",
   *   noRenames: true,
   *   pathspec: ["packages"],
   * });
   *
   * console.log(invocation.redactedArgs.join(" "));
   * // --no-optional-locks status --porcelain -z --untracked-files=all --ignore-submodules=none --no-renames -- packages
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly status = status;

  /**
   * Builds an invocation to inspect registered submodule states.
   *
   * **Details**
   *
   * `git submodule status [--recursive] [-- <paths>...]` — one line per
   * registered submodule: a state prefix, the checked-out (or gitlink) sha,
   * the path, and — when the submodule is initialized — a `git describe`
   * suffix in parentheses.
   *
   * **Gotchas**
   *
   * `git submodule status` has no `-z` mode, so its output is line-based —
   * the one path-emitting constructor in this package that cannot follow
   * the `-z` rule. A submodule path containing a newline would corrupt the
   * parse; accepted as a git-imposed limitation.
   *
   * **Example** (Inspect submodule status argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleStatus(["vendor/lib"], true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule status --recursive -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleStatus = submoduleStatus;

  /**
   * Builds an invocation to register submodules in local configuration.
   *
   * **Details**
   *
   * Mutating: `git submodule init [-- <paths>...]` — registers the
   * submodules from `.gitmodules` into `.git/config` (all of them, or only
   * `paths`), without cloning or checking anything out.
   *
   * **Example** (Inspect submodule init argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleInit(["vendor/lib"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule init -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleInit = submoduleInit;

  /**
   * Builds an invocation to unregister submodules and clear their working trees.
   *
   * **Details**
   *
   * Mutating: `git submodule deinit [--force] (--all | -- <paths>...)` —
   * unregisters submodules: clears their working trees and removes their
   * `.git/config` registration. The literal `--` separator makes the
   * pathspec injection-safe by construction.
   *
   * **Example** (Inspect submodule deinit argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleDeinit(["vendor/lib"], false, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule deinit --force -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleDeinit = submoduleDeinit;

  /**
   * Builds an invocation to synchronize submodule URLs into live configuration.
   *
   * **Details**
   *
   * Mutating: `git submodule sync [--recursive] [-- <paths>...]` —
   * re-copies each submodule's URL from `.gitmodules` into `.git/config`
   * (and into the submodule's own `remote.origin.url`), so a `.gitmodules`
   * URL change actually reaches git's live configuration.
   *
   * **Example** (Inspect submodule sync argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleSync(["vendor/lib"], true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule sync --recursive -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleSync = submoduleSync;

  /**
   * Builds an invocation to change and synchronize a submodule URL.
   *
   * **Details**
   *
   * Mutating: `git submodule set-url -- <path> <url>` — rewrites the
   * submodule's URL in `.gitmodules` and synchronizes it into
   * `.git/config`. The literal `--` separator makes the path and url
   * injection-safe by construction.
   *
   * An embedded `userinfo@` credential in `url` is masked in
   * {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect submodule set url argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleSetUrl("vendor/lib", "https://user:token@example.com/lib.git");
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule set-url -- vendor/lib https://<redacted>@example.com/lib.git
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleSetUrl = submoduleSetUrl;

  /**
   * Builds an invocation to set or clear a submodule’s tracked branch.
   *
   * **Details**
   *
   * Mutating: `git submodule set-branch (--branch <branch> | --default) -- <path>`
   * — records (or clears, when `branch` is omitted) the branch a submodule
   * tracks in `.gitmodules`. The literal `--` separator makes the path
   * injection-safe by construction.
   *
   * **Example** (Inspect submodule set branch argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleSetBranch("vendor/lib", "main");
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule set-branch --branch main -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleSetBranch = submoduleSetBranch;

  /**
   * Builds an invocation to relocate submodule Git directories into the superproject.
   *
   * **Details**
   *
   * Mutating: `git submodule absorbgitdirs [-- <paths>...]` — moves each
   * submodule's embedded `.git` directory into the superproject's
   * `.git/modules/` and leaves a gitfile pointer behind.
   *
   * **Example** (Inspect submodule absorbgitdirs argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleAbsorbgitdirs(["vendor/lib"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule absorbgitdirs -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleAbsorbgitdirs = submoduleAbsorbgitdirs;

  /**
   * Builds an invocation to run a trusted shell command in checked-out submodules.
   *
   * **Details**
   *
   * Mutating: `git submodule foreach [--recursive] <command>` — runs a shell
   * command in every checked-out submodule. `command` is a single shell
   * string, evaluated by git in each submodule's directory; it can mutate
   * anything, which is why the constructor is marked mutating regardless of
   * what the command does.
   *
   * **Gotchas**
   *
   * This is the ONE constructor whose argument cannot be made injection-safe
   * by construction: git evaluates `command` with `sh -c`, so every character
   * of it is shell code — a `--` separator or quoting cannot help. Callers
   * must treat `command` as a trusted literal and never interpolate untrusted
   * data into it.
   *
   * **Example** (Inspect submodule foreach argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.submoduleForeach("git status --short", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // submodule foreach --recursive git status --short
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly submoduleForeach = submoduleForeach;

  /**
   * Builds an invocation to inspect refs advertised by a remote.
   *
   * **Details**
   *
   * `git ls-remote [--heads] [--tags] <remote> [<patterns>...]` — the refs a
   * remote advertises (sha + refname), optionally filtered to branch heads,
   * tags, and/or shell-glob patterns.
   *
   * A read that talks to the NETWORK, not to the local repository — the one
   * non-mutating constructor in this package that does. An embedded
   * `userinfo@` credential in `remote` is masked in
   * {@link GitInvocation.redactedArgs}. An annotated tag advertises two
   * entries: `refs/tags/<name>` (the tag object) and `refs/tags/<name>^{}`
   * (the peeled commit).
   *
   * **Example** (Inspect ls remote argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.lsRemote("origin", true, false, ["main"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // ls-remote --heads origin main
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly lsRemote = lsRemote;

  /**
   * Builds an invocation to register a remote with redacted URL diagnostics.
   *
   * **Details**
   *
   * Mutating: `git remote add <name> <url>` — registers a new remote.
   *
   * An embedded `userinfo@` credential in `url` is masked in
   * {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect remote add argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.remoteAdd("upstream", "https://user:token@example.com/repo.git");
   *
   * console.log(invocation.redactedArgs.join(" ")) // remote add upstream https://<redacted>@example.com/repo.git
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly remoteAdd = remoteAdd;

  /**
   * Builds an invocation to remove a remote and its tracking state.
   *
   * **Details**
   *
   * Mutating: `git remote remove <name>` — deletes a remote and its
   * remote-tracking refs and configuration.
   *
   * **Example** (Inspect remote remove argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.remoteRemove("upstream");
   *
   * console.log(invocation.redactedArgs.join(" ")) // remote remove upstream
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly remoteRemove = remoteRemove;

  /**
   * Builds an invocation to change a remote’s fetch URL.
   *
   * **Details**
   *
   * Mutating: `git remote set-url <name> <url>` — rewrites a remote's fetch
   * URL.
   *
   * An embedded `userinfo@` credential in `url` is masked in
   * {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect remote set url argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.remoteSetUrl("origin", "https://user:token@example.com/repo.git");
   *
   * console.log(invocation.redactedArgs.join(" ")) // remote set-url origin https://<redacted>@example.com/repo.git
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly remoteSetUrl = remoteSetUrl;

  /**
   * Builds an invocation to save working-tree and index changes on the stash stack.
   *
   * **Details**
   *
   * Mutating: `git stash push [--include-untracked] [-m <message>] [-- <paths>...]`
   * — saves the working tree (and index) state onto the stash stack. The
   * literal `--` separator makes the optional pathspec injection-safe by
   * construction; the message rides behind `-m`, which git consumes as a
   * value even when it begins with `-`.
   *
   * **Example** (Inspect stash push argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stashPush("Work in progress", true, ["src/main.ts"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // stash push --include-untracked -m Work in progress -- src/main.ts
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly stashPush = stashPush;

  /**
   * Builds an invocation to apply and remove a stash entry.
   *
   * **Details**
   *
   * Mutating: `git stash pop [stash@{n}]` — applies a stash entry and drops
   * it on success. The stash ref is rendered from an INTEGER index by this
   * package, never caller text.
   *
   * **Example** (Inspect stash pop argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stashPop(0);
   *
   * console.log(invocation.redactedArgs.join(" ")) // stash pop stash@{0}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly stashPop = stashPop;

  /**
   * Builds an invocation to apply a stash entry while retaining it.
   *
   * **Details**
   *
   * Mutating: `git stash apply [stash@{n}]` — applies a stash entry and
   * keeps it on the stack. The stash ref is rendered from an INTEGER index
   * by this package, never caller text.
   *
   * **Example** (Inspect stash apply argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stashApply(1);
   *
   * console.log(invocation.redactedArgs.join(" ")) // stash apply stash@{1}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly stashApply = stashApply;

  /**
   * Builds an invocation to remove a stash entry without applying it.
   *
   * **Details**
   *
   * Mutating: `git stash drop [stash@{n}]` — deletes a stash entry without
   * applying it. The stash ref is rendered from an INTEGER index by this
   * package, never caller text.
   *
   * **Example** (Inspect stash drop argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stashDrop(2);
   *
   * console.log(invocation.redactedArgs.join(" ")) // stash drop stash@{2}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly stashDrop = stashDrop;

  /**
   * Builds an invocation to list stash entries with split-safe fields.
   *
   * **Details**
   *
   * `git stash list -z --format=%gd%x1f%H%x1f%gs` — every stash entry as a
   * NUL-terminated record of unit-separated fields: the reflog selector
   * (`stash@{0}`), the stash commit sha, and the reflog subject.
   *
   * The `%x1f` (ASCII unit separator) field separator plus `-z` record
   * terminator keeps the parse split-safe: a stash message cannot contain
   * either byte (reflog subjects are single-line).
   *
   * **Example** (Inspect stash list argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.stashList();
   *
   * console.log(invocation.redactedArgs.join(" ")) // stash list -z --format=%gd%x1f%H%x1f%gs
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly stashList = stashList;

  /**
   * Builds an invocation to list branch names, tips, and the current-branch marker.
   *
   * **Details**
   *
   * `git branch --list [--remotes | --all] --format=%(HEAD)%00%(refname:short)%00%(objectname)`
   * — every branch as a NUL-separated triple: the current-branch marker, the
   * short name, and the tip sha.
   *
   * Records are newline-separated, which is split-safe here: git refnames
   * cannot contain a newline (or a space), so the only NUL bytes are the
   * format's own field separators. `all` wins over `remotes` when both are
   * set.
   *
   * **Example** (Inspect branch list argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.branchList(false, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // branch --list --all --format=%(HEAD)%00%(refname:short)%00%(objectname)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly branchList = branchList;

  /**
   * Builds an invocation to create a lightweight or annotated tag.
   *
   * **Details**
   *
   * Mutating: `git tag [--force] [-m <message>] <name> [<ref>]` — creates a
   * lightweight tag, or an annotated one when `message` is given (`-m`
   * implies `-a`).
   *
   * **Example** (Inspect tag create argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.tagCreate("v1.0.0", "HEAD", "Release 1.0.0");
   *
   * console.log(invocation.redactedArgs.join(" ")) // tag -m Release 1.0.0 v1.0.0 HEAD
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly tagCreate = tagCreate;

  /**
   * Builds an invocation to delete a local tag.
   *
   * **Details**
   *
   * Mutating: `git tag --delete <name>` — deletes a local tag.
   *
   * **Example** (Inspect tag delete argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.tagDelete("v1.0.0");
   *
   * console.log(invocation.redactedArgs.join(" ")) // tag --delete v1.0.0
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly tagDelete = tagDelete;

  /**
   * Builds an invocation to list tags matching an optional pattern.
   *
   * **Details**
   *
   * `git tag --list [<pattern>]` — tag names, optionally filtered by a
   * shell-glob pattern, one per line (refnames cannot contain newlines).
   *
   * **Example** (Inspect tag list argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.tagList("v*");
   *
   * console.log(invocation.redactedArgs.join(" ")) // tag --list v*
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly tagList = tagList;

  /**
   * Builds an invocation to list matching refs and their object metadata.
   *
   * **Details**
   *
   * `git for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype) [<patterns>...]`
   * — every matching ref as a NUL-separated triple: full refname, sha, and
   * object type.
   *
   * The format is this package's own fixed triple — the parse contract and
   * the argv are decided together, so the format string is a constructor
   * literal, never caller data. An annotated tag's `objecttype` is `tag`
   * (the tag object), not `commit`.
   *
   * **Example** (Inspect for each ref argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.forEachRef(["refs/heads"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype) refs/heads
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly forEachRef = forEachRef;

  /**
   * Builds an invocation to list reachable commit ids in newest-first order.
   *
   * **Details**
   *
   * `git rev-list [--max-count=<n>] [--first-parent] <ref-or-range>` — commit
   * shas reachable from the ref (or range, e.g. `main..feat`), newest first.
   *
   * **Example** (Inspect rev list argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.revList("main..feature", 5, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // rev-list --max-count=5 --first-parent main..feature
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly revList = revList;

  /**
   * Builds an invocation to record a commit with an explicit message.
   *
   * **Details**
   *
   * Mutating: `git commit [--all] [--allow-empty] [--amend] [--only] [--no-verify] [--author=<author>] -m <message>`
   * — records a commit. The message always rides argv behind `-m` (git
   * consumes it as a value even when it begins with `-`); committer identity
   * comes from the caller's environment — this constructor sets no
   * `GIT_AUTHOR_*`/`GIT_COMMITTER_*` variables, and the optional `author`
   * override is the fused `--author=` form. `only` commits exactly what is
   * staged even when `-a` would otherwise be implied; `noVerify` skips the
   * pre-commit and commit-msg hooks.
   *
   * **Example** (Inspect commit argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.commit("Update documentation", false, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // commit --allow-empty -m Update documentation
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly commit = commit;

  /**
   * Builds an invocation to update remote refs with redacted URL diagnostics.
   *
   * **Details**
   *
   * Mutating: `git push [--force | --force-with-lease] [--tags] [--set-upstream] <remote> [<refspec>]`
   * — updates remote refs.
   *
   * `remote` may be a URL as well as a remote name; an embedded `userinfo@`
   * credential is masked in {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect push argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.push("https://user:token@example.com/repo.git", "main", false, true, false, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // push --force-with-lease --set-upstream https://<redacted>@example.com/repo.git main
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly push = push;

  /**
   * Builds an invocation to fetch and integrate remote changes.
   *
   * **Details**
   *
   * Mutating: `git pull [--rebase] [--ff-only] <remote> [<ref>]` — fetches
   * and integrates.
   *
   * `remote` may be a URL as well as a remote name; an embedded `userinfo@`
   * credential is masked in {@link GitInvocation.redactedArgs}.
   *
   * **Example** (Inspect pull argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.pull("origin", "main", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // pull --rebase origin main
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly pull = pull;

  /**
   * Builds an invocation to enumerate configuration entries losslessly.
   *
   * **Details**
   *
   * `git config [-f <file>] --list -z` — every configuration entry in scope
   * (or in the given file only), NUL-terminated, the key separated from the
   * value by a newline within each record.
   *
   * **Gotchas**
   *
   * `-z` is load-bearing: a config VALUE may contain newlines; only the NUL
   * record terminator plus first-newline field split parses it losslessly.
   * A valueless key (git's boolean-true shorthand) emits no newline at all.
   *
   * **Example** (Inspect config list argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configList(".gitmodules", "local");
   *
   * console.log(invocation.redactedArgs.join(" ")) // config -f .gitmodules --local --list -z
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configList = configList;

  /**
   * Builds an invocation to read every value of a configuration key.
   *
   * **Details**
   *
   * `git config [-f <file>] --get-all -z <key>` — every value of a
   * (possibly multi-valued) key, NUL-terminated. An unset key exits 1 with
   * silent stderr.
   *
   * **Example** (Inspect config get all argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configGetAll("remote.origin.fetch");
   *
   * console.log(invocation.redactedArgs.join(" ")) // config --get-all -z remote.origin.fetch
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configGetAll = configGetAll;

  /**
   * Builds an invocation to remove one or all values of a configuration key.
   *
   * **Details**
   *
   * Mutating: `git config [-f <file>] (--unset | --unset-all) <key>` —
   * removes a key (or, with `all`, every value of a multi-valued key).
   *
   * **Gotchas**
   *
   * git exits 5, silently, when the key was not set — a loud failure by
   * this package's classification, deliberately: an unset that silently did
   * nothing is indistinguishable from one that worked.
   *
   * **Example** (Inspect config unset argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configUnset("remote.origin.fetch", undefined, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // config --unset-all remote.origin.fetch
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configUnset = configUnset;

  /**
   * Builds an invocation to remove a complete configuration section.
   *
   * **Details**
   *
   * Mutating: `git config [-f <file>] --remove-section <section>` — removes
   * a whole configuration section (every key under it, and the section
   * header itself).
   *
   * **Gotchas**
   *
   * git exits 128 (`fatal: no such section`) when the section does not
   * exist — a loud failure by this package's classification, matching
   * {@link GitCommand.configUnset}'s posture: a removal that silently did
   * nothing is indistinguishable from one that worked.
   *
   * **Example** (Inspect config remove section argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configRemoveSection("submodule.vendor/lib", ".gitmodules");
   *
   * console.log(invocation.redactedArgs.join(" ")) // config -f .gitmodules --remove-section submodule.vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configRemoveSection = configRemoveSection;

  /**
   * Builds an invocation to rename a configuration section while preserving its keys.
   *
   * **Details**
   *
   * Mutating: `git config [-f <file>] --rename-section <old> <new>` —
   * renames a configuration section, carrying every key under it across.
   *
   * **Gotchas**
   *
   * git exits 128 (`fatal: no such section`) when the old section does not
   * exist — the same loud posture as {@link GitCommand.configRemoveSection}.
   *
   * **Example** (Inspect config rename section argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.configRenameSection("remote.old", "remote.new");
   *
   * console.log(invocation.redactedArgs.join(" ")) // config --rename-section remote.old remote.new
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly configRenameSection = configRenameSection;

  /**
   * Builds an invocation to remove tracked paths from the index and optionally the working tree.
   *
   * **Details**
   *
   * Mutating: `git rm [--cached] [-r] [--force] -- <paths...>` — removes
   * paths from the index (and, without `cached`, the working tree). The
   * literal `--` separator makes the pathspec injection-safe by
   * construction.
   *
   * **Example** (Inspect rm argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.rm(["build/output.txt"], true, true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // rm --cached -r -- build/output.txt
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly rm = rm;

  /**
   * Builds an invocation to move or rename a tracked path.
   *
   * **Details**
   *
   * Mutating: `git mv [--force] -- <source> <destination>` — moves or
   * renames a tracked path. The literal `--` separator makes both positionals
   * injection-safe by construction.
   *
   * **Example** (Inspect mv argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.mv("old.ts", "new.ts");
   *
   * console.log(invocation.redactedArgs.join(" ")) // mv -- old.ts new.ts
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly mv = mv;

  /**
   * Builds an invocation to probe ignored paths using NUL-separated stdin.
   *
   * **Details**
   *
   * `git check-ignore -z --stdin` — which of the given paths git would
   * ignore, paths fed NUL-separated via stdin and answers returned
   * NUL-separated.
   *
   * **Gotchas**
   *
   * The `--stdin -z` form is the only fully robust one: `-z` without
   * `--stdin` is rejected by git outright, and the non-`-z` output C-quotes
   * special-character paths. Feeding paths via stdin also makes them
   * injection-safe by construction — nothing caller-controlled enters the
   * argv. When NO path is ignored, git exits 1 with silent stderr.
   *
   * **Example** (Inspect check ignore argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.checkIgnore(["build/output.txt"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // check-ignore -z --stdin
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly checkIgnore = checkIgnore;

  /**
   * Builds an invocation to create a linked working tree.
   *
   * **Details**
   *
   * Mutating: `git worktree add [--force] [--detach] <path> [<ref>]` —
   * creates a linked working tree at `path`, checked out at `ref` (or the
   * branch named after `path`'s basename).
   *
   * **Example** (Inspect worktree add argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.worktreeAdd("../review", "main", true);
   *
   * console.log(invocation.redactedArgs.join(" ")) // worktree add --detach ../review main
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly worktreeAdd = worktreeAdd;

  /**
   * Builds an invocation to list working trees and their attributes.
   *
   * **Details**
   *
   * `git worktree list --porcelain -z` — every working tree as a block of
   * NUL-terminated attributes (`worktree <path>`, `HEAD <sha>`,
   * `branch <ref>` / `detached`, `bare`, `locked [<reason>]`,
   * `prunable [<reason>]`), blocks separated by an empty attribute.
   *
   * **Example** (Inspect worktree list argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.worktreeList();
   *
   * console.log(invocation.redactedArgs.join(" ")) // worktree list --porcelain -z
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly worktreeList = worktreeList;

  /**
   * Builds an invocation to remove a linked working tree.
   *
   * **Details**
   *
   * Mutating: `git worktree remove [--force] <path>` — removes a linked working tree.
   *
   * **Example** (Inspect worktree remove argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.worktreeRemove("../review");
   *
   * console.log(invocation.redactedArgs.join(" ")) // worktree remove ../review
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly worktreeRemove = worktreeRemove;

  /**
   * Builds an invocation to drop worktree registrations whose directory is gone.
   *
   * **Details**
   *
   * Mutating: `git worktree prune` — removes `$GIT_DIR/worktrees` entries
   * whose working tree no longer exists on disk. It never touches a
   * directory that is still present.
   *
   * **Example** (Inspect worktree prune argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.worktreePrune();
   *
   * console.log(invocation.redactedArgs.join(" ")) // worktree prune
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly worktreePrune = worktreePrune;

  /**
   * Builds an invocation to list staged index entries.
   *
   * **Details**
   *
   * `git ls-files --stage -z [-- <pathspec>...]` — every INDEX entry (mode,
   * oid, stage number, path), NUL-terminated, optionally scoped to
   * `pathspec`.
   *
   * The index-side sibling of {@link GitCommand.lsTree}: `lsTree` reads a
   * COMMITTED tree at a ref, while this reads the staging area — the only
   * place a staged-but-uncommitted gitlink (`160000 <oid> 0 <path>`) is
   * visible. `-z` is load-bearing twice over: paths may contain newlines,
   * and the non-`-z` output C-quotes special-character paths.
   *
   * **Example** (Inspect ls files argv)
   *
   * ```ts
   * import { GitCommand } from "@beep/git/GitCommand";
   *
   * const invocation = GitCommand.lsFiles(["vendor/lib"]);
   *
   * console.log(invocation.redactedArgs.join(" ")) // ls-files --stage -z -- vendor/lib
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly lsFiles = lsFiles;
}
