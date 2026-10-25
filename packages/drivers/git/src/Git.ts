/**
 * The `Git` service: typed repository introspection plus a clearly-marked
 * mutating tier, run through Effect's `ChildProcessSpawner`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { constant, dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GitCommand } from "./GitCommand.ts";
import { runCollected } from "./internal/run.ts";
import type { GitConfigScope, GitInvocation } from "./GitCommand.ts";
import type { Collected } from "./internal/run.ts";

const $I = $GitId.create("Git");

/** git's own ceiling: a run that has not answered in 30s is not going to. */
const GIT_TIMEOUT = Duration.seconds(30);
const encodeJsonString = S.encodeEffect(S.fromJsonString(S.String));
const NonNegativeInteger = S.Finite.check(S.isMultipleOf(1), S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativeInteger", {
    description: "A finite non-negative integer, including values beyond the safe-integer range.",
  })
);
const isNonNegativeInteger = S.is(NonNegativeInteger);

/**
 * `dual` dispatch for a member whose subject is a string (`cwd`, or a
 * method label) and whose data-last argument list never starts with one:
 * a string first argument marks the data-first call. Used instead of an
 * arity count wherever trailing parameters are optional.
 */
const hasStringSubject = (args: IArguments): boolean => P.isString(args[0]);

/**
 * `dual` dispatch for a member shaped `(cwd, ...strings, options?)`: the call
 * is data-first when the LAST required positional (at `index`) is a string.
 * In a data-last call that slot holds the optional options object or nothing,
 * so omitting the trailing options never flips the dispatch.
 */
const stringAt =
  (index: number) =>
  (args: IArguments): boolean =>
    P.isString(args[index]);

/**
 * The environment EVERY `Git` invocation is spawned with. A network-touching
 * member adds one more key on top, resolved per call — see {@link sshEnv}.
 *
 * **Details**
 *
 * These live here, next to `classify` and `GIT_TIMEOUT`, because they exist
 * to serve them — not on the pure `GitCommand` constructors, which carry no
 * run-time context at all.
 *
 * - `LC_ALL=C` — `classify` matches untranslated stderr text
 *   (`"not a git repository"`, `"unknown revision"`). A localized message silently
 *   misclassifies into `GitCommandError` instead of the typed domain error.
 * - `GIT_TERMINAL_PROMPT=0` — git's own credential prompt. Without it a
 *   network-touching member against a credential-requiring remote blocks
 *   until `GIT_TIMEOUT` fires.
 * - `GIT_ASKPASS=""` — the askpass chain, which `GIT_TERMINAL_PROMPT=0` does
 *   NOT close. Probed against git 2.55: an empty `GIT_ASKPASS` is a hard
 *   stop, not a fall-through — it suppresses a configured `core.askPass` and
 *   `SSH_ASKPASS` too, so this single key closes all three routes to a
 *   blocking credential dialog.
 * - `SSH_ASKPASS_REQUIRE="never"` — defense in depth for the ssh path. With
 *   `BatchMode=yes` below, `ssh` never asks and never reaches an askpass
 *   helper; this still matters for an ssh command {@link withBatchMode}
 *   declines to touch.
 */
const BASE_ENV = {
  LC_ALL: "C",
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  SSH_ASKPASS_REQUIRE: "never",
} as const;

/**
 * `ssh` reads a key passphrase and a host-key confirmation from `/dev/tty`
 * DIRECTLY, so neither `GIT_TERMINAL_PROMPT` nor any askpass pin reaches
 * them; `-o BatchMode=yes` is the only lever that makes `ssh` fail instead of
 * block. Probed against OpenSSH under a real pty: with the askpass chain
 * closed but no `BatchMode`, a first-contact host key hangs indefinitely;
 * with `BatchMode=yes` the same call fails immediately with
 * `"Host key verification failed."`.
 */
const BATCH_MODE = "-o BatchMode=yes";

/**
 * Matches an ssh command this package is willing to append an option to: the
 * program's basename is `ssh`, mirroring git's own basename-driven variant
 * detection.
 */
const OPENSSH_PROGRAM = /(?:^|[\\/])ssh(?:\.exe)?$/i;

/**
 * `ssh.variant` / `GIT_SSH_VARIANT` values under which this package is willing
 * to treat the command as OpenSSH. `auto` means "infer from the basename",
 * which is the inference {@link OPENSSH_PROGRAM} performs.
 *
 * **Gotchas**
 *
 * This exists because the basename inference is OVERRIDABLE, and the override
 * silently changes the argument grammar. Verified against git 2.55: a program
 * literally named `ssh` with `ssh.variant=plink` set is invoked with plink's
 * `-P` rather than OpenSSH's `-p`, and without `-o SendEnv=...`. Appending
 * `-o BatchMode=yes` to that would break an invocation that worked before.
 *
 * It is an allow-list, and so **deliberately narrower than git**, which
 * resolves any UNRECOGNIZED value to OpenSSH rather than rejecting it — also
 * verified against git 2.55, where `ssh.variant=openssh` and an outright typo
 * both produce the OpenSSH grammar. Two divergences follow, and both forgo
 * the pin rather than corrupt a command, which is the direction to err in:
 * a misspelled variant declines here where git would have accepted it, and a
 * set-but-empty `GIT_SSH_VARIANT` — which git reads as "OpenSSH, and skip the
 * config entirely" — is treated here as absent, so a `plink` in the config
 * can still decline it. Widening this to a deny-list of the known non-OpenSSH
 * variants would match git exactly today, at the cost of appending blindly to
 * whatever variant git adds next.
 */
const OPENSSH_VARIANTS = HashSet.make("", "auto", "ssh");

/**
 * Whether an ssh command line already decides `BatchMode` for itself.
 *
 * **Details**
 *
 * Deliberately matches `BatchMode` only where it is an OPTION — after a `-o`,
 * with or without intervening space or quoting, and taking either the
 * `Key=value` or the `"Key value"` spelling `ssh -o` accepts. A bare
 * occurrence of the word does not count: `ssh -F /tmp/BatchMode` names a
 * config file and decides nothing, and treating it as a decision would skip
 * the pin for a caller who never asked to be prompted.
 *
 * A miss in the other direction is harmless, which is why this errs toward
 * matching less: because OpenSSH honors the first value obtained, appending
 * after a spelling this does not recognize is inert rather than overriding —
 * the caller's own value still wins.
 */
const DECIDES_BATCH_MODE = /(?:^|\s)-o\s*["']?\s*BatchMode\s*[=\s]/i;

/**
 * The program an ssh command line invokes, as git's shell would see it.
 *
 * **Details**
 *
 * `GIT_SSH_COMMAND` is interpreted by the shell, so the program may be
 * QUOTED to carry spaces — `"/opt/my tools/ssh" -i key` is a working setup
 * (verified against git 2.55). Splitting on whitespace alone would read that
 * as `"/opt/my`, fail to recognize ssh, and silently skip the pin.
 *
 * This is quote-aware, not shell-aware: it does not expand variables, honor
 * escapes, or handle a command built by shell operators. Anything it cannot
 * read confidently comes back `undefined` and the caller's command is left
 * strictly alone — the safe direction, since declining only forgoes the new
 * protection where mangling would break a working remote.
 */
/** A leading quoted program: the opening quote, then everything up to the first matching quote. */
const QUOTED_PROGRAM = /^(["'])([\s\S]*?)\1/;

const sshProgram = (command: string): string | undefined => {
  const quote = command[0];
  if (quote === '"' || quote === "'") {
    const quoted = QUOTED_PROGRAM.exec(command);
    return quoted === null ? undefined : quoted[2];
  }
  return Str.split(/\s+/)(command)[0];
};

/**
 * Appends `-o BatchMode=yes` to an ssh command line, or declines.
 *
 * **Gotchas**
 *
 * Declining is the important half, and it covers two cases where appending
 * would do harm rather than good:
 *
 * - **The program is not OpenSSH.** `plink` (PuTTY) has no `-o KEY=VALUE`
 *   form at all — its non-interactive switch is `-batch` — so appending two
 *   tokens breaks a previously working setup outright instead of degrading.
 *   The same goes for a wrapper script taking positional arguments. git
 *   itself dispatches on the program's basename; this mirrors that, and
 *   anything unrecognized is left strictly alone.
 * - **The caller already decides `BatchMode`.** OpenSSH takes the FIRST value
 *   obtained for a repeated option (`ssh_config(5)`; verified against
 *   OpenSSH 10.3 with `ssh -G`), so an append after the caller's own
 *   `-o BatchMode=no` is silently inert. Rather than pretend otherwise, the
 *   caller's decision stands and no pin is applied — a caller who explicitly
 *   asked to be prompted owns the resulting wait.
 */
const withBatchMode = (command: string): O.Option<string> => {
  const trimmed = Str.trim(command);
  const program = sshProgram(trimmed);
  if (program === undefined || !OPENSSH_PROGRAM.test(program) || DECIDES_BATCH_MODE.test(trimmed)) {
    return O.none();
  }
  return O.some(`${trimmed} ${BATCH_MODE}`);
};

/**
 * The spawn environment for a network-touching member: {@link BASE_ENV} plus
 * a `GIT_SSH_COMMAND` carrying `BatchMode`, when there is an ssh command
 * worth pinning.
 *
 * **Details**
 *
 * `resolved` is the ssh COMMAND git would have used if this package pinned
 * nothing. Resolving it first is what makes the pin additive rather than
 * destructive: a pinned environment key wins over the merged parent
 * environment AND over `core.sshCommand` and `GIT_SSH` in git's own
 * precedence order, so pinning a bare `ssh` would silently discard a
 * configured identity file and turn "prompts for a passphrase" into "cannot
 * reach the remote at all" — a worse failure than the one being fixed, and
 * the one this design set out to avoid.
 *
 * `GIT_SSH` never reaches here, deliberately. It is the third rung of that
 * precedence order (`GIT_SSH_COMMAND` \> `core.sshCommand` \> `GIT_SSH` \> plain
 * `ssh`, verified against git 2.55), but it names a PROGRAM and supports no
 * arguments — appending to it would have git invoke a program of that literal
 * name. So when `GIT_SSH` is the deciding rung, {@link Git.layer}'s resolution
 * declines to pin at all rather than displace it, exactly as it declines for
 * plink. `GIT_TERMINAL_PROMPT` and `GIT_ASKPASS` still apply to those callers;
 * only the ssh-level pin is skipped.
 */
const sshEnv = (resolved: string): Record<string, string> =>
  O.match(withBatchMode(resolved), {
    onNone: () => ({ ...BASE_ENV }),
    onSome: (pinned) => ({ ...BASE_ENV, GIT_SSH_COMMAND: pinned }),
  });

/**
 * git ran and failed in a way that is not one of the recognized domain cases
 * ({@link NotARepositoryError} / {@link UnknownRefError}), or the spawn itself
 * failed before git could run at all.
 *
 * **Details**
 *
 * `exitCode` and `stderr` are populated when git actually ran. `detail`
 * carries a human-readable explanation whenever the failure is not summed up
 * by an exit code: an absorbed spawn-level `PlatformError`, a per-run timeout,
 * a pre-spawn guard refusal, or output git produced that the member could not
 * parse. `kind` discriminates a pre-spawn guard rejection (`"refused"`) from a
 * genuine git failure (`"failed"`) structurally, so composed retry/fallback
 * logic never has to parse the prose in `message` or `detail`.
 *
 * **`message` is the rendering; `detail` is the datum.** `message` composes a
 * one-line prose from the redacted argv, the cwd, and — whenever `detail` is
 * set — `detail` itself. A consumer forwarding the underlying reason should map
 * `detail` through only when it is set: falling back to `message` nests one
 * rendered message inside another
 * (`git … in cwd: git … in cwd failed (exit N): …`). When `detail` is absent,
 * git ran and failed — `exitCode` and `stderr` are the data to forward. Note
 * that `detail` may be set after git ran
 * and exited successfully (e.g. `Git.log` sets `detail: "unparseable log output: …"`
 * with `kind: "failed"`), so routing on `detail !== undefined` rather than
 * assuming git never started is the correct consumer boundary.
 *
 * **Example** (Inspect a failed invocation)
 *
 * ```ts
 * import { GitCommandError } from "@beep/git/Git";
 *
 * const error = GitCommandError.make({ kind: "failed", args: ["status"], cwd: "/repo", exitCode: 1, stderr: "failure" });
 * console.log(error.message); // git status in /repo failed (exit 1): failure
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class GitCommandError extends S.TaggedError<GitCommandError, { readonly brand: unique symbol }>(
  $I`GitCommandError`
)(
  "GitCommandError",
  {
    /**
     * Discriminates a pre-spawn guard rejection from a genuine git failure.
     * `"refused"` — a pre-spawn guard (an option-like ref) rejected the
     * invocation and no process was ever spawned. `"failed"` — git actually ran
     * and exited non-zero, or the spawn/IO itself failed. Composed retry/fallback
     * logic routes on this instead of matching `detail` prose.
     */
    kind: S.Literals(["refused", "failed"]).pipe(
      $I.annoteKey("GitCommandError.kind", {
        description:
          'Discriminates a pre-spawn guard rejection from a genuine git failure. `"refused"` — a pre-spawn guard (an option-like ref) rejected the invocation and no process was ever spawned. `"failed"` — git actually ran and exited non-zero, or the spawn/IO itself failed. Composed retry/fallback logic routes on this instead of matching `detail` prose.',
      })
    ),
    /**
     * The REDACTED argument vector, without the leading `git`.
     *
     * **Details**
     *
     * Sensitive positionals — config values, a URL's embedded userinfo — are
     * already masked by the constructor's redaction mask before this error is
     * constructed (`configSet`'s value reads `<redacted>`; a
     * `https://user:token@host/...` remote keeps everything but its
     * `userinfo@`). The raw argv is never persisted in an error value, and
     * `message` renders this redacted vector.
     */
    args: S.Array(S.String).pipe(
      $I.annoteKey("GitCommandError.args", { description: "The REDACTED argument vector, without the leading `git`." })
    ),
    /** The working directory the command ran in. */
    cwd: S.String.pipe(
      $I.annoteKey("GitCommandError.cwd", { description: "The working directory the command ran in." })
    ),
    /** git's exit code, when it produced one. */
    exitCode: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("GitCommandError.exitCode", { description: "git's exit code, when it produced one." })
    ),
    /** git's stderr, captured under `LC_ALL=C`. */
    stderr: S.String.pipe(
      $I.annoteKey("GitCommandError.stderr", { description: "git's stderr, captured under `LC_ALL=C`." })
    ),
    /**
     * A human-readable reason, set whenever an exit code does not sum up the
     * failure: an absorbed spawn failure, a timeout, a pre-spawn guard refusal,
     * or output git produced that the member could not parse. `message` renders
     * it verbatim when present.
     */
    detail: S.optionalKey(S.String).pipe(
      $I.annoteKey("GitCommandError.detail", {
        description:
          "A human-readable reason, set whenever an exit code does not sum up the failure: an absorbed spawn failure, a timeout, a pre-spawn guard refusal, or output git produced that the member could not parse. `message` renders it verbatim when present.",
      })
    ),
  },
  $I.annoteError<GitCommandError>("GitCommandError", {
    description:
      "git ran and failed in a way that is not one of the recognized domain cases (NotARepositoryError / UnknownRefError), or the spawn itself failed before git could run at all.",
  })
) {
  /**
   * Renders the invocation and its failure into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { GitCommandError } from "@beep/git/Git";
   *
   * const error = GitCommandError.make({ kind: "failed", args: ["status"], cwd: "/repo", exitCode: 1, stderr: "failure" });
   * console.log(error.message); // git status in /repo failed (exit 1): failure
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return this.detail !== undefined
      ? `git ${A.join(this.args, " ")} in ${this.cwd}: ${this.detail}`
      : `git ${A.join(this.args, " ")} in ${this.cwd} failed (exit ${this.exitCode ?? "?"}): ${this.stderr}`;
  }
}

/**
 * `cwd` is not inside a git work tree.
 *
 * **Example** (Identify a directory outside a repository)
 *
 * ```ts
 * import { NotARepositoryError } from "@beep/git/Git";
 *
 * const error = NotARepositoryError.make({ cwd: "/outside" });
 * console.log(error.message); // not a git repository: /outside
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class NotARepositoryError extends S.TaggedError<NotARepositoryError, { readonly brand: unique symbol }>(
  $I`NotARepositoryError`
)(
  "NotARepositoryError",
  {
    /** The working directory that is not a git repository. */
    cwd: S.String.pipe(
      $I.annoteKey("NotARepositoryError.cwd", { description: "The working directory that is not a git repository." })
    ),
  },
  $I.annoteError<NotARepositoryError>("NotARepositoryError", { description: "`cwd` is not inside a git work tree." })
) {
  /**
   * Renders the failing directory into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { NotARepositoryError } from "@beep/git/Git";
   *
   * const error = NotARepositoryError.make({ cwd: "/outside" });
   * console.log(error.message); // not a git repository: /outside
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `not a git repository: ${this.cwd}`;
  }
}

/**
 * `ref` does not resolve to an object in the repository at `cwd`.
 *
 * **Example** (Identify an unresolved ref)
 *
 * ```ts
 * import { UnknownRefError } from "@beep/git/Git";
 *
 * const error = UnknownRefError.make({ cwd: "/repo", ref: "missing" });
 * console.log(error.message); // unknown ref 'missing' in /repo
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class UnknownRefError extends S.TaggedError<UnknownRefError, { readonly brand: unique symbol }>(
  $I`UnknownRefError`
)(
  "UnknownRefError",
  {
    /** The ref (or ref range) that failed to resolve. */
    ref: S.String.pipe(
      $I.annoteKey("UnknownRefError.ref", { description: "The ref (or ref range) that failed to resolve." })
    ),
    /** The working directory the ref was resolved against. */
    cwd: S.String.pipe(
      $I.annoteKey("UnknownRefError.cwd", { description: "The working directory the ref was resolved against." })
    ),
  },
  $I.annoteError<UnknownRefError>("UnknownRefError", {
    description: "`ref` does not resolve to an object in the repository at `cwd`.",
  })
) {
  /**
   * Renders the unresolvable ref into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { UnknownRefError } from "@beep/git/Git";
   *
   * const error = UnknownRefError.make({ cwd: "/repo", ref: "missing" });
   * console.log(error.message); // unknown ref 'missing' in /repo
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `unknown ref '${this.ref}' in ${this.cwd}`;
  }
}

/**
 * A `git push` was rejected because the remote ref has moved: the classic
 * non-fast-forward rejection (`fetch first` / `non-fast-forward`), or a
 * `--force-with-lease` lease failure (`stale info`).
 *
 * **Details**
 *
 * The typed signal a fetch-then-retry (or rebase-then-retry) fallback
 * branches on — every other push failure stays a {@link GitCommandError}.
 * Only `Git.push` can fail with this error.
 *
 * **Example** (Inspect a rejected refspec)
 *
 * ```ts
 * import { NonFastForwardError } from "@beep/git/Git";
 *
 * const error = NonFastForwardError.make({ cwd: "/repo", refspec: "main" });
 * console.log(error.message); // push of 'main' rejected as non-fast-forward in /repo
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class NonFastForwardError extends S.TaggedError<NonFastForwardError, { readonly brand: unique symbol }>(
  $I`NonFastForwardError`
)(
  "NonFastForwardError",
  {
    /** The working directory the push ran in. */
    cwd: S.String.pipe(
      $I.annoteKey("NonFastForwardError.cwd", { description: "The working directory the push ran in." })
    ),
    /** The refspec that was rejected, when the caller passed one. */
    refspec: S.optionalKey(S.String).pipe(
      $I.annoteKey("NonFastForwardError.refspec", {
        description: "The refspec that was rejected, when the caller passed one.",
      })
    ),
  },
  $I.annoteError<NonFastForwardError>("NonFastForwardError", {
    description:
      "A `git push` was rejected because the remote ref has moved: the classic non-fast-forward rejection (`fetch first` / `non-fast-forward`), or a `--force-with-lease` lease failure (`stale info`).",
  })
) {
  /**
   * Renders the rejected push into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { NonFastForwardError } from "@beep/git/Git";
   *
   * const error = NonFastForwardError.make({ cwd: "/repo", refspec: "main" });
   * console.log(error.message); // push of 'main' rejected as non-fast-forward in /repo
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return this.refspec !== undefined
      ? `push of '${this.refspec}' rejected as non-fast-forward in ${this.cwd}`
      : `push rejected as non-fast-forward in ${this.cwd}`;
  }
}

/**
 * A merge-shaped operation (`pull`, `stash pop`, `stash apply`) stopped with
 * conflict markers in the working tree.
 *
 * **Gotchas**
 *
 * The typed signal a resolve-or-abort recovery branches on. The conflicted
 * state is REAL: git has already written conflict markers, and (for `pull`)
 * `MERGE_HEAD` is set — the caller owns resolving or aborting. Detection
 * matches git's conflict report, which lands on STDOUT for a merge and on
 * stderr for a rebase-mode pull; both streams are inspected.
 *
 * **Example** (Inspect a conflicted merge)
 *
 * ```ts
 * import { MergeConflictError } from "@beep/git/Git";
 *
 * const error = MergeConflictError.make({ cwd: "/repo" });
 * console.log(error.message); // merge conflict in /repo: fix conflicts (or abort) before continuing
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class MergeConflictError extends S.TaggedError<MergeConflictError, { readonly brand: unique symbol }>(
  $I`MergeConflictError`
)(
  "MergeConflictError",
  {
    /** The working directory the merge ran in. */
    cwd: S.String.pipe(
      $I.annoteKey("MergeConflictError.cwd", { description: "The working directory the merge ran in." })
    ),
  },
  $I.annoteError<MergeConflictError>("MergeConflictError", {
    description:
      "A merge-shaped operation (`pull`, `stash pop`, `stash apply`) stopped with conflict markers in the working tree.",
  })
) {
  /**
   * Renders the conflicted merge into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { MergeConflictError } from "@beep/git/Git";
   *
   * const error = MergeConflictError.make({ cwd: "/repo" });
   * console.log(error.message); // merge conflict in /repo: fix conflicts (or abort) before continuing
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `merge conflict in ${this.cwd}: fix conflicts (or abort) before continuing`;
  }
}

/**
 * A merge-shaped operation refused to start because local modifications would
 * be overwritten — git's refusal reads
 * `Your local changes ... would be overwritten by merge`.
 *
 * **Details**
 *
 * The typed "commit or stash first" signal. Unlike {@link MergeConflictError}
 * the working tree is UNTOUCHED — git aborted before changing anything.
 * Only the merge-shaped methods (`pull`, `stashPop`, `stashApply`) can fail
 * with this error.
 *
 * **Example** (Inspect a blocked merge)
 *
 * ```ts
 * import { DirtyWorktreeError } from "@beep/git/Git";
 *
 * const error = DirtyWorktreeError.make({ cwd: "/repo" });
 * console.log(error.message); // local changes would be overwritten in /repo: commit or stash them first
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class DirtyWorktreeError extends S.TaggedError<DirtyWorktreeError, { readonly brand: unique symbol }>(
  $I`DirtyWorktreeError`
)(
  "DirtyWorktreeError",
  {
    /** The working directory whose local changes blocked the operation. */
    cwd: S.String.pipe(
      $I.annoteKey("DirtyWorktreeError.cwd", {
        description: "The working directory whose local changes blocked the operation.",
      })
    ),
  },
  $I.annoteError<DirtyWorktreeError>("DirtyWorktreeError", {
    description:
      "A merge-shaped operation refused to start because local modifications would be overwritten — git's refusal reads `Your local changes ... would be overwritten by merge`.",
  })
) {
  /**
   * Renders the blocked operation into a one-line message.
   *
   * **Example** (Render the failure message)
   *
   * ```ts
   * import { DirtyWorktreeError } from "@beep/git/Git";
   *
   * const error = DirtyWorktreeError.make({ cwd: "/repo" });
   * console.log(error.message); // local changes would be overwritten in /repo: commit or stash them first
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `local changes would be overwritten in ${this.cwd}: commit or stash them first`;
  }
}

/**
 * One entry of a `git ls-tree` listing.
 *
 * **Example** (Represent a tracked blob)
 *
 * ```ts
 * import { LsTreeEntry } from "@beep/git/Git";
 *
 * const entry = LsTreeEntry.make({ mode: "100644", type: "blob", oid: "abc", path: "src/index.ts" });
 * console.log(entry.path); // src/index.ts
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LsTreeEntry extends S.Opaque<LsTreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The entry's file mode, e.g. `100644`. */
    mode: S.String.pipe($I.annoteKey("LsTreeEntry.mode", { description: "The entry's file mode, e.g. `100644`." })),
    /** The kind of object the entry points at. */
    type: S.Literals(["blob", "tree", "commit"]).pipe(
      $I.annoteKey("LsTreeEntry.type", { description: "The kind of object the entry points at." })
    ),
    /** The object id the entry points at. */
    oid: S.String.pipe($I.annoteKey("LsTreeEntry.oid", { description: "The object id the entry points at." })),
    /** The entry's path, relative to the tree root. May contain spaces or newlines. */
    path: S.String.pipe(
      $I.annoteKey("LsTreeEntry.path", {
        description: "The entry's path, relative to the tree root. May contain spaces or newlines.",
      })
    ),
  }).pipe($I.annoteSchema("LsTreeEntry", { description: "One entry of a `git ls-tree` listing." }))
) {}

const NameStatusCode = LiteralKit([
  "added",
  "modified",
  "deleted",
  "renamed",
  "copied",
  "typeChanged",
  "unmerged",
  "unknown",
  "broken",
]).pipe($I.annoteSchema("NameStatusCode", { description: "The decoded change kinds in a name-status listing." }));
type NameStatusCode = typeof NameStatusCode.Type;

/**
 * One entry of a `git diff --name-status` listing.
 *
 * **Gotchas**
 *
 * The `status` vocabulary is this package's own decoded spelling:
 * `"typeChanged"` and `"broken"` — deliberately NOT git porcelain's
 * `"typechange"` word. A consumer mapping these values onto an existing
 * enum that follows porcelain's spelling must translate.
 *
 * **Example** (Represent a renamed path)
 *
 * ```ts
 * import { NameStatusEntry } from "@beep/git/Git";
 *
 * const entry = NameStatusEntry.make({ status: "renamed", oldPath: "old.ts", path: "new.ts" });
 * console.log(entry.status, entry.oldPath, entry.path); // renamed old.ts new.ts
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class NameStatusEntry extends S.Opaque<NameStatusEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The change kind, decoded from git's one-letter status code. `T` decodes
     * to `"typeChanged"` and `B` to `"broken"` — this package's spelling, not
     * porcelain's `"typechange"`.
     */
    status: NameStatusCode.pipe(
      $I.annoteKey("NameStatusEntry.status", {
        description:
          'The change kind, decoded from git\'s one-letter status code. `T` decodes to `"typeChanged"` and `B` to `"broken"` — this package\'s spelling, not porcelain\'s `"typechange"`.',
      })
    ),
    /** The entry's path — for a rename or copy, the NEW path. */
    path: S.String.pipe(
      $I.annoteKey("NameStatusEntry.path", { description: "The entry's path — for a rename or copy, the NEW path." })
    ),
    /** The pre-rename/pre-copy path; present only for renamed/copied entries. */
    oldPath: S.optionalKey(S.String).pipe(
      $I.annoteKey("NameStatusEntry.oldPath", {
        description: "The pre-rename/pre-copy path; present only for renamed/copied entries.",
      })
    ),
  }).pipe($I.annoteSchema("NameStatusEntry", { description: "One entry of a `git diff --name-status` listing." }))
) {}

/**
 * The outcome of classifying one completed run (or spawn failure) against
 * git's stderr taxonomy. Never leaked outside this module — every `Git`
 * method maps it to its own public return type.
 */
const Classified = S.TaggedUnion({
  success: {
    output: S.String.pipe($I.annoteKey("Classified.success.output", { description: "The completed run's stdout." })),
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
 * degrade, `"generic"` enables none of them.
 */
const ClassifyKind = LiteralKit(["show", "refExists", "quiet", "noSuchRemote", "push", "merge", "log", "generic"]).pipe(
  $I.annoteSchema("ClassifyKind", { description: "The method-specific Git classification taxonomy." })
);
type ClassifyKind = typeof ClassifyKind.Type;

/** Outcomes available to each classification mode. */
// classify only emits mode-specific outcomes after checking that exact mode.
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
      | (K extends "push" ? "nonFastForward" : never)
      | (K extends "merge" ? "mergeConflict" | "dirtyWorktree" : never);
  }
>;

/** A classified run with the spawner already provided: `make`'s `runFor` and `runForNetwork`. */
type RunFor = {
  <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K): Effect.Effect<ClassifiedFor<K>>;
  <K extends ClassifyKind>(cwd: string, kind: K): (invocation: GitInvocation) => Effect.Effect<ClassifiedFor<K>>;
};

const NOT_A_REPOSITORY = "not a git repository";
// Unanchored substring matching against LC_ALL=C-pinned phrases: a path or ref
// name that happens to literally contain one of these phrases could misclassify.
// Accepted for now; anchoring is deliberately deferred until a real collision
// is observed.
const UNKNOWN_REF_PATTERNS = [
  "unknown revision",
  "bad revision",
  "Not a valid object name",
  "invalid object name",
  // fetch's missing-remote-ref shape — the typed signal a tag-then-branch
  // fetch fallback (Effect.orElse) branches on.
  "couldn't find remote ref",
];
const ABSENT_AT_REF_PATTERNS = ["does not exist in", "exists on disk, but not in"];
// Push-rejection shapes (probed against git 2.54 under LC_ALL=C): the remote
// moved (`fetch first`), the classic wording (`non-fast-forward`), and a
// --force-with-lease lease failure (`stale info`). All ride the `! [rejected]`
// line, which is required alongside one of these so an unrelated stderr
// mention cannot misclassify.
const PUSH_REJECTED_PATTERNS = ["non-fast-forward", "fetch first", "stale info"];
// Merge-conflict shapes: git's merge machinery reports `CONFLICT (` and
// `Automatic merge failed` on STDOUT (probed: pull and stash pop alike), while
// a rebase-mode pull reports `could not apply` on stderr — both streams are
// matched.
const MERGE_CONFLICT_PATTERNS = ["CONFLICT (", "Automatic merge failed", "could not apply"];
// The dirty-worktree refusal (`error: Your local changes to the following
// files would be overwritten by merge`) arrives on stderr, before git touches
// anything.
const DIRTY_WORKTREE_PATTERN = "would be overwritten by";
// An unborn HEAD: `git log` in a repository whose current branch carries no
// commits exits 128 with `fatal: your current branch '<name>' does not have
// any commits yet` (probed against git 2.54 under LC_ALL=C). A history that
// does not exist yet is the EMPTY history, so this degrades rather than
// failing — scoped to the `"log"` kind, because for every other member an
// unborn HEAD is a genuine failure to report.
const UNBORN_HEAD_PATTERN = "does not have any commits yet";

const matchesAny: {
  (stderr: string, patterns: ReadonlyArray<string>): boolean;
  (patterns: ReadonlyArray<string>): (stderr: string) => boolean;
} = dual(2, (stderr: string, patterns: ReadonlyArray<string>): boolean =>
  A.some(patterns, (pattern) => Str.includes(pattern)(stderr))
);

/**
 * A spawn-level failure. The non-NotFound arms keep the underlying diagnostic:
 * flattening the PlatformError to its reason tag alone drops module/method/cause
 * detail a caller debugging a PermissionDenied or TimedOut spawn genuinely needs.
 */
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

/** A non-zero exit no classification row claimed. */
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

/** The rows every kind shares, checked before the kind-specific ones. */
const sharedFailureRow = (stderr: string): Classified | undefined => {
  if (Str.includes(NOT_A_REPOSITORY)(stderr)) return { _tag: "notARepository" };
  return matchesAny(stderr, UNKNOWN_REF_PATTERNS) ? { _tag: "unknownRef" } : undefined;
};

const classifyMerge = ({ stderr, stdout }: Collected): Classified | undefined => {
  // The dirty refusal is checked FIRST: it aborts before any merge starts,
  // so its stderr can never carry conflict text — but checking it first
  // keeps the ordering explicit rather than incidental.
  if (Str.includes(DIRTY_WORKTREE_PATTERN)(stderr)) return { _tag: "dirtyWorktree" };
  return matchesAny(stdout, MERGE_CONFLICT_PATTERNS) || matchesAny(stderr, MERGE_CONFLICT_PATTERNS)
    ? { _tag: "mergeConflict" }
    : undefined;
};

/** The method-specific classification rows; `undefined` falls through to the generic failure. */
const KIND_ROWS: { readonly [K in ClassifyKind]: (outcome: Collected) => Classified | undefined } = {
  show: ({ stderr }) => (matchesAny(stderr, ABSENT_AT_REF_PATTERNS) ? { _tag: "absent" } : undefined),
  refExists: ({ exitCode }) => (exitCode === 1 ? { _tag: "refMissing" } : undefined),
  // --quiet probes (symbolic-ref) and config --get signal "unset" as a
  // silent exit 1; any stderr text means a real failure instead.
  quiet: ({ exitCode, stderr }) => (exitCode === 1 && stderr === "" ? { _tag: "absent" } : undefined),
  noSuchRemote: ({ stderr }) => (Str.includes("No such remote")(stderr) ? { _tag: "absent" } : undefined),
  push: ({ stderr }) =>
    Str.includes("[rejected]")(stderr) && matchesAny(stderr, PUSH_REJECTED_PATTERNS)
      ? { _tag: "nonFastForward" }
      : undefined,
  merge: classifyMerge,
  log: ({ stderr }) => (Str.includes(UNBORN_HEAD_PATTERN)(stderr) ? { _tag: "absent" } : undefined),
  generic: () => undefined,
};

/**
 * Classifies one completed run (or spawn-level `PlatformError`) against
 * git's stderr taxonomy. Written once — every `Git` method funnels through
 * this before deciding its own return value.
 *
 * **Details**
 *
 * `args` is the invocation's REDACTED argv: it is the only argv this
 * function may persist into a `GitCommandError`, per the redaction policy.
 */
const classify: {
  (
    outcome: Collected | PlatformError.PlatformError,
    cwd: string,
    args: ReadonlyArray<string>,
    kind: ClassifyKind
  ): Classified;
  (
    cwd: string,
    args: ReadonlyArray<string>,
    kind: ClassifyKind
  ): (outcome: Collected | PlatformError.PlatformError) => Classified;
} = dual(
  4,
  (
    outcome: Collected | PlatformError.PlatformError,
    cwd: string,
    args: ReadonlyArray<string>,
    kind: ClassifyKind
  ): Classified => {
    if (outcome instanceof PlatformError.PlatformError) return spawnFailure(outcome, cwd, args);
    if (outcome.exitCode === 0) return { _tag: "success", output: outcome.stdout };
    return sharedFailureRow(outcome.stderr) ?? KIND_ROWS[kind](outcome) ?? exitFailure(outcome, cwd, args);
  }
);

/**
 * Runs an invocation's command in `cwd`, classifies the outcome, and never
 * fails: a spawn-level `PlatformError` and a per-run timeout are both
 * absorbed into the `"failure"` classification rather than escaping the
 * effect's error channel.
 *
 * **Details**
 *
 * The argv handed to `classify` — and therefore persisted into any
 * `GitCommandError` — is the invocation's REDACTED argv, never the raw one:
 * the redaction mask the pure constructor carries is applied here, at the
 * single classification choke point (the redaction policy).
 *
 * This is also the single ENVIRONMENT choke point: `env` (computed once in
 * {@link Git.layer}) is applied here the same way `cwd` is, so every one of
 * the service's members is spawned with the pins and nothing else in the
 * package needs to know they exist.
 */
const runClassified: {
  <K extends ClassifyKind>(
    invocation: GitInvocation,
    cwd: string,
    kind: K,
    env: Record<string, string>
  ): Effect.Effect<ClassifiedFor<K>, never, ChildProcessSpawner.ChildProcessSpawner>;
  <K extends ClassifyKind>(
    cwd: string,
    kind: K,
    env: Record<string, string>
  ): (invocation: GitInvocation) => Effect.Effect<ClassifiedFor<K>, never, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  4,
  (
    invocation: GitInvocation,
    cwd: string,
    kind: ClassifyKind,
    env: Record<string, string>
  ): Effect.Effect<Classified, never, ChildProcessSpawner.ChildProcessSpawner> => {
    const args = invocation.redactedArgs;
    const command = ChildProcess.setEnv(ChildProcess.setCwd(invocation.command, cwd), env);
    return runCollected(command).pipe(
      Effect.map(classify(cwd, args, kind)),
      Effect.catch((platformError) => Effect.succeed(classify(platformError, cwd, args, kind))),
      Effect.timeoutOrElse({
        duration: GIT_TIMEOUT,
        orElse: () =>
          Effect.succeed<Classified>({
            _tag: "failure",
            error: GitCommandError.make({
              kind: "failed",
              args,
              cwd,
              stderr: "",
              detail: "timed out after 30s",
            }),
          }),
      })
    );
  }
);

/** Splits `-z` (NUL-terminated) output into its constituent entries. */
const parseNulSeparated = (output: string): ReadonlyArray<string> =>
  A.filter(Str.split("\0")(output), (entry) => entry.length > 0);

/** Config values may be empty; only the final NUL terminator is discarded. */
const parseConfigGetAll = (output: string): ReadonlyArray<string> => {
  if (output === "") return [];
  const tokens = Str.split(output, "\0");
  return Str.endsWith("\0")(output) ? A.dropRight(tokens, 1) : tokens;
};

const lsTreeInput = S.Struct(LsTreeEntry.fields);

/**
 * Parses `git ls-tree -r -z` output: each NUL-terminated entry is
 * `<mode> <type> <oid>\t<path>`. `path` is everything after the first tab,
 * so a path containing spaces or newlines is preserved intact.
 */
const parseLsTree = (output: string): ReadonlyArray<LsTreeEntry> =>
  A.map(parseNulSeparated(output), (entry) => {
    const tabIndex = pipe(entry, Str.indexOf("\t"), O.getOrElse(constant(-1)));
    const header = Str.split(Str.slice(0, tabIndex)(entry), " ");
    const path = Str.slice(tabIndex + 1)(entry);
    const parsed = {
      mode: header[0],
      // git's own tree-entry format only ever emits these three kinds.
      type: header[1] ?? "blob",
      oid: header[2] ?? "",
      path,
    };
    S.asserts(lsTreeInput, parsed);
    return LsTreeEntry.make(parsed);
  });

/** git's one-letter name-status codes, score digits stripped (`R100` → `R`). */
const NAME_STATUS_CODES: Record<string, NameStatusCode | undefined> = {
  A: "added",
  B: "broken",
  C: "copied",
  D: "deleted",
  M: "modified",
  R: "renamed",
  T: "typeChanged",
  U: "unmerged",
  X: "unknown",
};

/** Decodes the name-status entry whose code token sits at `index`, plus how many tokens it spans. */
const nameStatusEntryAt = (
  tokens: ReadonlyArray<string>,
  index: number,
  code: string
): { readonly entry: NameStatusEntry; readonly width: number } => {
  const letter = Str.slice(0, 1)(code);
  const status = NAME_STATUS_CODES[letter] ?? "unknown";
  return letter === "R" || letter === "C"
    ? {
        entry: NameStatusEntry.make({ status, path: tokens[index + 2] ?? "", oldPath: tokens[index + 1] ?? "" }),
        width: 3,
      }
    : { entry: NameStatusEntry.make({ status, path: tokens[index + 1] ?? "" }), width: 2 };
};

/**
 * Parses `git diff --name-status -z` output. A plain entry is two NUL tokens
 * (`<code>`, `<path>`); a rename/copy entry is three (`<R|C><score>`,
 * `<oldPath>`, `<newPath>`), and only the code's first character carries the
 * status — the similarity score digits are dropped.
 */
const parseNameStatus = (output: string): ReadonlyArray<NameStatusEntry> => {
  const tokens = Str.split("\0")(output);
  const entries: Array<NameStatusEntry> = [];
  let index = 0;
  while (index < tokens.length) {
    const code = A.getUnsafe(tokens, index);
    if (code === "") {
      index += 1;
      continue;
    }
    const { entry, width } = nameStatusEntryAt(tokens, index, code);
    entries.push(entry);
    index += width;
  }
  return entries;
};

/**
 * The metadata of a single commit, read via `git log -1` with NUL-separated
 * `%H` / `%G?` / `%B` placeholders.
 *
 * **Example** (Retain a raw commit message)
 *
 * ```ts
 * import { CommitInfo } from "@beep/git/Git";
 *
 * const entry = CommitInfo.make({ sha: "abc", signatureStatus: "N", message: "Initial commit\n" });
 * console.log(entry.message.endsWith("\n")); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitInfo extends S.Opaque<CommitInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The commit's full object id (`%H`). */
    sha: S.String.pipe($I.annoteKey("CommitInfo.sha", { description: "The commit's full object id (`%H`)." })),
    /** git's `%G?` signature verdict: Good, Bad, Unknown validity, eXpired, expired-key (Y), Revoked, cannot-check (E), None. */
    signatureStatus: S.Literals(["G", "B", "U", "X", "Y", "R", "E", "N"]).pipe(
      $I.annoteKey("CommitInfo.signatureStatus", {
        description:
          "git's `%G?` signature verdict: Good, Bad, Unknown validity, eXpired, expired-key (Y), Revoked, cannot-check (E), None.",
      })
    ),
    /** The raw commit message (`%B`), untrimmed — includes git's trailing format newline. */
    message: S.String.pipe(
      $I.annoteKey("CommitInfo.message", {
        description: "The raw commit message (`%B`), untrimmed — includes git's trailing format newline.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CommitInfo", {
      description:
        "The metadata of a single commit, read via `git log -1` with NUL-separated `%H` / `%G?` / `%B` placeholders.",
    })
  )
) {}

/**
 * One commit of a `git log` listing, with the paths that commit touched.
 *
 * **Gotchas**
 *
 * Both dates are decoded from git's strict-ISO `%aI` / `%cI` into
 * `DateTime.Utc` — the instant, comparable and orderable across commits made
 * in different timezones. **The committer's local UTC offset is not
 * preserved**: git records it, `DateTime.Utc` does not carry it, and encoding
 * a `CommitLogEntry` therefore renders both dates as `Z`-suffixed UTC rather
 * than the offset git printed. Nothing in the kit needs the offset; a consumer
 * that does wants a different member, not a wider entry.
 *
 * `paths` is the commit's `--name-only` listing, **repository-root-relative
 * regardless of the `cwd` the log ran in**, and raw (`-z` disables git's
 * C-style path quoting, so a path containing a space, a quote or a newline
 * arrives verbatim). It is EMPTY for a commit that touched nothing under the
 * requested pathspec — most commonly a merge commit, whose diff git omits by
 * default (see `Git.log`'s `firstParentDiffMerges`).
 *
 * **Example** (Decode a commit timestamp)
 *
 * ```ts
 * import { CommitLogEntry } from "@beep/git/Git";
 * import * as S from "effect/Schema";
 * import * as DateTime from "effect/DateTime";
 *
 * const entry = S.decodeUnknownSync(CommitLogEntry)({
 *   sha: "abc", authoredAt: "2026-01-01T01:00:00+01:00", committedAt: "2026-01-01T00:00:00Z",
 *   authorName: "Ada", authorEmail: "ada@example.com", paths: ["src/index.ts"],
 * });
 * console.log(DateTime.formatIso(entry.authoredAt)); // 2026-01-01T00:00:00.000Z
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CommitLogEntry extends S.Opaque<CommitLogEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The commit's full object id (`%H`). */
    sha: S.String.pipe($I.annoteKey("CommitLogEntry.sha", { description: "The commit's full object id (`%H`)." })),
    /** When the change was authored (`%aI`), as a UTC instant. */
    authoredAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("CommitLogEntry.authoredAt", {
        description: "When the change was authored (`%aI`), as a UTC instant.",
      })
    ),
    /** When the commit object was written (`%cI`), as a UTC instant. */
    committedAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("CommitLogEntry.committedAt", {
        description: "When the commit object was written (`%cI`), as a UTC instant.",
      })
    ),
    /** The author's name (`%an`). */
    authorName: S.String.pipe($I.annoteKey("CommitLogEntry.authorName", { description: "The author's name (`%an`)." })),
    /** The author's email address (`%ae`). */
    authorEmail: S.String.pipe(
      $I.annoteKey("CommitLogEntry.authorEmail", { description: "The author's email address (`%ae`)." })
    ),
    /** The paths this commit touched, root-relative and raw; empty when it touched none. */
    paths: S.Array(S.String).pipe(
      $I.annoteKey("CommitLogEntry.paths", {
        description: "The paths this commit touched, root-relative and raw; empty when it touched none.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CommitLogEntry", {
      description: "One commit of a `git log` listing, with the paths that commit touched.",
    })
  )
) {}

/** A record opens with an empty NUL token, which cannot be a pathname. */
const LOG_RECORD_SEPARATOR = "\0";

/**
 * Reads a log record's NUL-terminated paths starting at `from`. Only the first
 * path loses git's one separator newline. `next` also consumes the next
 * record's opener or the final terminator token.
 */
const readLogPaths = (
  tokens: ReadonlyArray<string>,
  from: number
): { readonly next: number; readonly paths: Array<string> } => {
  const paths: Array<string> = [];
  let index = from;
  while (index < tokens.length) {
    const path = A.getUnsafe(tokens, index);
    if (path === "") break;
    paths.push(paths.length === 0 && Str.startsWith("\n")(path) ? Str.slice(1)(path) : path);
    index += 1;
  }
  return { paths, next: index + 1 };
};

/** Parses the log record whose sha token sits at `index`, plus the index of the record after it. */
const parseLogRecord = (
  tokens: ReadonlyArray<string>,
  index: number
): Result.Result<{ readonly entry: CommitLogEntry; readonly next: number }, string> => {
  const sha = A.getUnsafe(tokens, index);
  const authoredAtIso = tokens[index + 1];
  const committedAtIso = tokens[index + 2];
  const authorName = tokens[index + 3];
  const authorEmail = tokens[index + 4];
  if (
    authoredAtIso === undefined ||
    committedAtIso === undefined ||
    authorName === undefined ||
    authorEmail === undefined
  ) {
    return Result.fail("a log record carried fewer fields than the format declares");
  }
  const authoredAt = DateTime.make(authoredAtIso);
  const committedAt = DateTime.make(committedAtIso);
  if (O.isNone(authoredAt) || O.isNone(committedAt)) {
    return Result.fail(`a log record carried an undecodable date ("${authoredAtIso}", "${committedAtIso}")`);
  }
  const { next, paths } = readLogPaths(tokens, index + 5);
  return Result.succeed({
    entry: CommitLogEntry.make({
      sha,
      authoredAt: authoredAt.value,
      committedAt: committedAt.value,
      authorName,
      authorEmail,
      paths,
    }),
    next,
  });
};

/**
 * Parses `GitCommand.log`'s output. Unlike this package's other parsers this
 * one can FAIL: the two dates have to decode, and a header that does not carry
 * its five fields cannot be answered with a plausible-looking entry.
 *
 * **Details**
 *
 * Each record opens with NUL, followed by five NUL-terminated header fields.
 * Only when the commit touched something, git adds `\n` and one
 * NUL-terminated path each. The next empty token opens the next record;
 * pathnames cannot be empty or contain NUL. Header fields are read by position
 * so empty author fields are preserved. Only the first path loses git's one
 * separator newline; every other pathname byte, including `\x1e`, survives.
 * Empty stdout is an empty log, as for a pathspec no commit touched.
 */
const parseLog = (output: string): Result.Result<ReadonlyArray<CommitLogEntry>, string> => {
  if (output === "") return Result.succeed([]);
  if (!Str.startsWith(LOG_RECORD_SEPARATOR)(output)) {
    return Result.fail("log output did not open with a record separator");
  }
  const tokens = Str.split(output, "\0");
  const entries: Array<CommitLogEntry> = [];
  let index = 1;
  while (index < tokens.length) {
    const record = parseLogRecord(tokens, index);
    if (Result.isFailure(record)) return Result.fail(record.failure);
    entries.push(record.success.entry);
    index = record.success.next;
  }
  return Result.succeed(entries);
};

/** One two-letter porcelain v1 status axis code. */
const porcelainCode = LiteralKit([" ", "M", "T", "A", "D", "R", "C", "U", "?", "!"]).pipe(
  $I.annoteSchema("PorcelainCode", { description: "One porcelain v1 status axis code." })
);

/**
 * Options for {@link StatusEntry.toLine} / {@link StatusEntry.format}: how a
 * rename/copy entry's path field renders.
 *
 * **Details**
 *
 * The renderers accept the plain {@link StatusRenderOptions.Encoded} shape,
 * so callers pass an object literal such as `{ renames: "arrow" }`.
 *
 * **Example** (Decode render options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { StatusRenderOptions } from "@beep/git/Git";
 *
 * const options = S.decodeUnknownSync(StatusRenderOptions)({ renames: "arrow" });
 * console.log(options.renames); // arrow
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StatusRenderOptions extends S.Opaque<StatusRenderOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    renames: S.optionalKey(S.Literals(["new", "arrow"])).pipe(
      $I.annoteKey("StatusRenderOptions.renames", {
        description:
          '`"new"` (the default) renders only the NEW path — the entry\'s current path, the one that exists on disk. `"arrow"` renders git\'s own non-`-z` porcelain form, `<origPath> -> <path>`. Non-rename entries are unaffected either way.',
      })
    ),
  }).pipe(
    $I.annoteSchema("StatusRenderOptions", {
      description: "How a rename/copy status entry's path field renders.",
    })
  )
) {}

/**
 * Companion namespace for {@link StatusRenderOptions}.
 *
 * **Example** (Type plain render options)
 *
 * ```ts
 * import type { StatusRenderOptions } from "@beep/git/Git";
 *
 * const options: StatusRenderOptions.Encoded = { renames: "arrow" };
 * console.log(options.renames); // arrow
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export declare namespace StatusRenderOptions {
  /**
   * The plain options object the status renderers accept.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof StatusRenderOptions.Encoded;
}

/**
 * One entry of a `git status --porcelain -z` listing.
 *
 * **Example** (Render a renamed entry)
 *
 * ```ts
 * import { StatusEntry } from "@beep/git/Git";
 *
 * const entry = StatusEntry.make({ x: "R", y: " ", origPath: "old.ts", path: "new.ts" });
 * console.log(entry.toLine()); // R  new.ts
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StatusEntry extends S.Class<StatusEntry, { readonly brand: unique symbol }>($I`StatusEntry`)(
  {
    /** The index-side status code (first porcelain column). */
    x: porcelainCode.pipe(
      $I.annoteKey("StatusEntry.x", { description: "The index-side status code (first porcelain column)." })
    ),
    /** The working-tree-side status code (second porcelain column). */
    y: porcelainCode.pipe(
      $I.annoteKey("StatusEntry.y", { description: "The working-tree-side status code (second porcelain column)." })
    ),
    /** The entry's path — for a rename or copy, the NEW path. */
    path: S.String.pipe(
      $I.annoteKey("StatusEntry.path", { description: "The entry's path — for a rename or copy, the NEW path." })
    ),
    /** The original path; present only on rename/copy entries. */
    origPath: S.optionalKey(S.String).pipe(
      $I.annoteKey("StatusEntry.origPath", { description: "The original path; present only on rename/copy entries." })
    ),
  },
  $I.annote("StatusEntry", { description: "One entry of a `git status --porcelain -z` listing." })
) {
  /**
   * Renders this entry back to one porcelain-shaped line: `XY <path>`.
   *
   * **Gotchas**
   *
   * **The rename convention is decided here, once, for every consumer.** By
   * default a rename/copy entry renders its NEW path only — `path` IS the
   * entry's current path, the one a line-oriented downstream can actually
   * open — which is a deliberate divergence from git's own non-`-z`
   * rendering (`orig -> new`). The arrow form is ambiguous to naive
   * line/whitespace splitters (paths may contain spaces, or a literal
   * `" -> "`), so it is opt-in via `renames: "arrow"` for consumers that
   * want git parity.
   *
   * A second recorded divergence: git's non-`-z` porcelain C-quotes paths
   * containing special characters; this renderer emits paths raw. It exists
   * for whitespace-insensitive text consumers — a machine parser should
   * consume the decoded {@link StatusEntry} values (or `-z` output)
   * directly, never re-parse this rendering.
   *
   * **Example** (Choose the arrow rename rendering)
   *
   * ```ts
   * import { StatusEntry } from "@beep/git/Git";
   *
   * const entry = StatusEntry.make({ x: "R", y: " ", origPath: "old.ts", path: "new.ts" });
   * console.log(entry.toLine({ renames: "arrow" })); // R  old.ts -> new.ts
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  toLine(options?: StatusRenderOptions.Encoded): string {
    const rendered =
      options?.renames === "arrow" && this.origPath !== undefined ? `${this.origPath} -> ${this.path}` : this.path;
    return `${this.x}${this.y} ${rendered}`;
  }

  /**
   * Renders entries back to porcelain-shaped text: one {@link StatusEntry.toLine}
   * line per entry, newline-joined, no trailing newline.
   *
   * **Details**
   *
   * The route back from `Git.status`'s parsed entries to line-oriented text,
   * so a consumer whose downstream contract is porcelain-shaped text does
   * not hand-roll its own renderer (and re-decide the rename convention —
   * see {@link StatusEntry.toLine} for that decision). An empty array
   * renders as the empty string.
   *
   * **Example** (Join status entries without a trailing newline)
   *
   * ```ts
   * import { StatusEntry } from "@beep/git/Git";
   *
   * const entries = [StatusEntry.make({ x: "M", y: " ", path: "file.ts" })];
   * console.log(StatusEntry.format(entries)); // M  file.ts
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  static readonly format: {
    (entries: ReadonlyArray<StatusEntry>, options?: StatusRenderOptions.Encoded): string;
    (options?: StatusRenderOptions.Encoded): (entries: ReadonlyArray<StatusEntry>) => string;
  } = dual(
    (args) => A.isArray(args[0]),
    (entries: ReadonlyArray<StatusEntry>, options?: StatusRenderOptions.Encoded): string =>
      pipe(
        entries,
        A.map((entry) => entry.toLine(options)),
        A.join("\n")
      )
  );
}

const commitInfoInput = S.Struct(CommitInfo.fields);
const statusInput = S.Struct(StatusEntry.fields);

/**
 * Parses `git log -1 --format=%H%x00%G?%x00%B` output: exactly two NUL
 * separators, everything after the second is the raw message, untrimmed.
 * A successful invocation can select no commits; missing separators or an
 * invalid signature verdict return None instead of escaping as a defect.
 */
const parseCommitInfo = (output: string): O.Option<CommitInfo> => {
  const first = pipe(output, Str.indexOf("\0"), O.getOrElse(constant(-1)));
  if (first < 0) return O.none();
  const separator = /\0/g;
  separator.lastIndex = first + 1;
  const second = separator.exec(output);
  if (second === null) return O.none();
  const parsed = {
    sha: Str.slice(0, first)(output),
    signatureStatus: Str.slice(first + 1, second.index)(output),
    message: Str.slice(second.index + 1)(output),
  };
  return O.map(S.decodeUnknownOption(commitInfoInput)(parsed), (input) => CommitInfo.make(input));
};

/**
 * Parses `git status --porcelain -z` output: each entry is `XY <path>`, and a
 * rename/copy entry appends the ORIGINAL path as one extra NUL token AFTER
 * the new path — the opposite order from `diff --name-status`.
 */
const parseStatus = (output: string): ReadonlyArray<StatusEntry> => {
  const tokens = Str.split("\0")(output);
  const entries: Array<StatusEntry> = [];
  let index = 0;
  while (index < tokens.length) {
    const token = A.getUnsafe(tokens, index);
    if (token === "") {
      index += 1;
      continue;
    }
    // Porcelain v1 only ever emits these axis codes.
    const x = Str.slice(0, 1)(token);
    const y = Str.slice(1, 2)(token);
    const path = Str.slice(3)(token);
    if (x === "R" || x === "C" || y === "R" || y === "C") {
      const parsed = {
        x,
        y,
        path,
        origPath: tokens[index + 1] ?? "",
      };
      S.asserts(statusInput, parsed);
      entries.push(StatusEntry.make(parsed));
      index += 2;
    } else {
      const parsed = { x, y, path };
      S.asserts(statusInput, parsed);
      entries.push(StatusEntry.make(parsed));
      index += 1;
    }
  }
  return entries;
};

/**
 * One line of a `git submodule status` listing.
 *
 * **Details**
 *
 * The `state` decodes git's one-character prefix: `" "` → `"current"` (the
 * checked-out commit matches the index gitlink), `"-"` → `"uninitialized"`,
 * `"+"` → `"outOfSync"` (the checked-out commit differs from the gitlink),
 * `"U"` → `"conflict"` (merge conflicts). `describe` carries the
 * parenthesized `git describe` suffix git appends for initialized
 * submodules.
 *
 * **Example** (Represent an uninitialized submodule)
 *
 * ```ts
 * import { SubmoduleStatusEntry } from "@beep/git/Git";
 *
 * const entry = SubmoduleStatusEntry.make({ state: "uninitialized", sha: "abc", path: "vendor/lib" });
 * console.log(entry.state); // uninitialized
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SubmoduleStatusEntry extends S.Opaque<SubmoduleStatusEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The decoded state prefix. */
    state: S.Literals(["current", "uninitialized", "outOfSync", "conflict"]).pipe(
      $I.annoteKey("SubmoduleStatusEntry.state", { description: "The decoded state prefix." })
    ),
    /** The submodule's checked-out (or, uninitialized, gitlink) commit sha. */
    sha: S.String.pipe(
      $I.annoteKey("SubmoduleStatusEntry.sha", {
        description: "The submodule's checked-out (or, uninitialized, gitlink) commit sha.",
      })
    ),
    /** The submodule's path relative to the superproject root. */
    path: S.String.pipe(
      $I.annoteKey("SubmoduleStatusEntry.path", {
        description: "The submodule's path relative to the superproject root.",
      })
    ),
    /** The `git describe` suffix, present only for initialized submodules. */
    describe: S.optionalKey(S.String).pipe(
      $I.annoteKey("SubmoduleStatusEntry.describe", {
        description: "The `git describe` suffix, present only for initialized submodules.",
      })
    ),
  }).pipe($I.annoteSchema("SubmoduleStatusEntry", { description: "One line of a `git submodule status` listing." }))
) {}

/** `git submodule status`'s one-character state prefixes; any other first character is part of the sha. */
const SUBMODULE_STATE_PREFIXES: Record<string, SubmoduleStatusEntry["state"] | undefined> = {
  " ": "current",
  "-": "uninitialized",
  "+": "outOfSync",
  U: "conflict",
};

/** Parses one non-empty `git submodule status` line: `<state><sha> <path>[ (<describe>)]`. */
const parseSubmoduleStatusLine = (line: string): SubmoduleStatusEntry => {
  const prefixed = SUBMODULE_STATE_PREFIXES[Str.slice(0, 1)(line)];
  const state = prefixed ?? "current";
  const rest = prefixed === undefined ? line : Str.slice(1)(line);
  const shaEnd = pipe(rest, Str.indexOf(" "), O.getOrElse(constant(-1)));
  const sha = shaEnd === -1 ? rest : Str.slice(0, shaEnd)(rest);
  const remainder = shaEnd === -1 ? "" : Str.slice(shaEnd + 1)(rest);
  const describeStart = Str.endsWith(")")(remainder)
    ? pipe(remainder, Str.lastIndexOf(" ("), O.getOrElse(constant(-1)))
    : -1;
  return describeStart === -1
    ? SubmoduleStatusEntry.make({ state, sha, path: remainder })
    : SubmoduleStatusEntry.make({
        state,
        sha,
        path: Str.slice(0, describeStart)(remainder),
        describe: Str.slice(describeStart + 2, -1)(remainder),
      });
};

/**
 * Parses `git submodule status` output. Line-based — the one parser in this
 * package without a `-z` mode to lean on, because git does not offer one for
 * `submodule status`; a submodule path containing a newline (or a literal
 * ` (` suffix mimicking the describe parenthesis) would corrupt the parse.
 * Accepted as a git-imposed limitation.
 */
const parseSubmoduleStatus = (output: string): ReadonlyArray<SubmoduleStatusEntry> =>
  A.filterMap(Str.split("\n")(output), (line) => {
    const trimmedEnd = Str.endsWith("\r")(line) ? Str.slice(0, -1)(line) : line;
    return trimmedEnd === "" ? Result.failVoid : Result.succeed(parseSubmoduleStatusLine(trimmedEnd));
  });

/**
 * One ref a remote advertises, from `git ls-remote`.
 *
 * **Details**
 *
 * `ref` is the FULL refname as advertised (`refs/heads/main`,
 * `refs/tags/v1`), including the `^{}` suffix on an annotated tag's peeled
 * entry — an annotated tag appears twice, once as the tag object and once
 * peeled to its commit.
 *
 * **Example** (Read an advertised tag name)
 *
 * ```ts
 * import { LsRemoteEntry } from "@beep/git/Git";
 *
 * const entry = LsRemoteEntry.make({ sha: "abc", ref: "refs/tags/v1^{}" });
 * console.log(LsRemoteEntry.shortName(entry.ref)); // v1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LsRemoteEntry extends S.Opaque<LsRemoteEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The sha the advertised ref points at. */
    sha: S.String.pipe($I.annoteKey("LsRemoteEntry.sha", { description: "The sha the advertised ref points at." })),
    /** The full advertised refname, `^{}` peel suffix included. */
    ref: S.String.pipe(
      $I.annoteKey("LsRemoteEntry.ref", { description: "The full advertised refname, `^{}` peel suffix included." })
    ),
  }).pipe($I.annoteSchema("LsRemoteEntry", { description: "One ref a remote advertises, from `git ls-remote`." }))
) {
  /**
   * The human-facing short name of an advertised refname: the
   * `refs/heads/` / `refs/tags/` / `refs/remotes/` prefix and any `^{}`
   * peel suffix stripped (`refs/tags/v1^{}` → `v1`).
   *
   * **Example** (Strip the peeled tag suffix)
   *
   * ```ts
   * import { LsRemoteEntry } from "@beep/git/Git";
   *
   * console.log(LsRemoteEntry.shortName("refs/tags/v1^{}")); // v1
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  static readonly shortName = (ref: string): string => {
    const base = Str.endsWith("^{}")(ref) ? Str.slice(0, -3)(ref) : ref;
    for (const prefix of ["refs/heads/", "refs/tags/", "refs/remotes/"]) {
      if (Str.startsWith(prefix)(base)) {
        return Str.slice(prefix.length)(base);
      }
    }
    return base;
  };

  /**
   * The entries whose short name is a NEAR MISS for `ref`: not an exact
   * match, but ending in `ref` right behind a separator (`@`, `/`, `-`,
   * `_`) — the monorepo-prefixed-tag case, where a caller asks for
   * `4.0.0` and the remote advertises `effect@4.0.0`.
   *
   * **Details**
   *
   * A pure, decode-side helper for validate-before-mutate flows: run
   * `lsRemote`, look for the wanted ref, and when it is absent hand the
   * listing to this to compute a suggestion. Deliberately a helper on the
   * ENTRY value rather than behavior baked into the service — the service
   * returns the full listing and the caller owns the matching policy. An
   * annotated tag's peeled `^{}` entry shares its base short name, so a
   * near miss on such a tag can surface both of its entries.
   *
   * **Example** (Suggest a package-prefixed tag)
   *
   * ```ts
   * import { LsRemoteEntry } from "@beep/git/Git";
   *
   * const entries = [LsRemoteEntry.make({ sha: "abc", ref: "refs/tags/effect@4.0.0" })];
   * console.log(LsRemoteEntry.nearMatches(entries, "4.0.0")[0]?.ref); // refs/tags/effect@4.0.0
   * ```
   *
   * @category filtering
   * @since 0.0.0
   */
  static readonly nearMatches: {
    (entries: ReadonlyArray<LsRemoteEntry>, ref: string): ReadonlyArray<LsRemoteEntry>;
    (ref: string): (entries: ReadonlyArray<LsRemoteEntry>) => ReadonlyArray<LsRemoteEntry>;
  } = dual(2, (entries: ReadonlyArray<LsRemoteEntry>, ref: string): ReadonlyArray<LsRemoteEntry> => {
    const separators = ["@", "/", "-", "_"];
    return A.filter(entries, (entry) => {
      const short = LsRemoteEntry.shortName(entry.ref);
      if (short === ref || !Str.endsWith(ref)(short)) {
        return false;
      }
      return separators.includes(Str.slice(short.length - ref.length - 1, short.length - ref.length)(short));
    });
  });
}

/**
 * Parses `git ls-remote` output: one `<sha>\t<refname>` line per advertised
 * ref. Line-based deliberately — refnames cannot contain a newline (or a
 * tab), so the split is safe without a `-z` mode (which `ls-remote` does not
 * offer).
 */
const parseLsRemote = (output: string): ReadonlyArray<LsRemoteEntry> =>
  pipe(
    Str.split("\n")(output),
    A.filter((line) => line.length > 0),
    A.map((line) => {
      const tabIndex = pipe(line, Str.indexOf("\t"), O.getOrElse(constant(-1)));
      return LsRemoteEntry.make({
        sha: Str.slice(0, tabIndex)(line),
        ref: Str.slice(tabIndex + 1)(line),
      });
    })
  );

/**
 * One stash entry, from `git stash list`.
 *
 * **Example** (Represent a stash selector)
 *
 * ```ts
 * import { StashEntry } from "@beep/git/Git";
 *
 * const entry = StashEntry.make({ ref: "stash@{0}", sha: "abc", message: "On main: save work" });
 * console.log(entry.ref); // stash@{0}
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class StashEntry extends S.Opaque<StashEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The reflog selector (`stash@{0}`) — the index other stash methods take. */
    ref: S.String.pipe(
      $I.annoteKey("StashEntry.ref", {
        description: "The reflog selector (`stash@{0}`) — the index other stash methods take.",
      })
    ),
    /** The stash commit's sha. */
    sha: S.String.pipe($I.annoteKey("StashEntry.sha", { description: "The stash commit's sha." })),
    /** The reflog subject: `WIP on <branch>: ...` or `On <branch>: <message>`. */
    message: S.String.pipe(
      $I.annoteKey("StashEntry.message", {
        description: "The reflog subject: `WIP on <branch>: ...` or `On <branch>: <message>`.",
      })
    ),
  }).pipe($I.annoteSchema("StashEntry", { description: "One stash entry, from `git stash list`." }))
) {}

/**
 * Parses `git stash list -z --format=%gd%x1f%H%x1f%gs` output: NUL-terminated
 * records of unit-separated (`\x1f`) fields. Reflog subjects are single-line
 * and cannot contain either separator byte.
 */
const parseStashList = (output: string): ReadonlyArray<StashEntry> =>
  A.map(parseNulSeparated(output), (record) => {
    const [ref = "", sha = "", ...rest] = Str.split("\u001f")(record);
    return StashEntry.make({ ref, sha, message: A.join(rest, "\u001f") });
  });

/**
 * One local (or remote-tracking) branch, from `git branch --list`.
 *
 * **Example** (Represent the current branch)
 *
 * ```ts
 * import { BranchEntry } from "@beep/git/Git";
 *
 * const entry = BranchEntry.make({ name: "main", sha: "abc", current: true });
 * console.log(entry.name, entry.current); // main true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class BranchEntry extends S.Opaque<BranchEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The short branch name (`main`, or `origin/main` for a remote branch). */
    name: S.String.pipe(
      $I.annoteKey("BranchEntry.name", {
        description: "The short branch name (`main`, or `origin/main` for a remote branch).",
      })
    ),
    /** The branch tip's sha. */
    sha: S.String.pipe($I.annoteKey("BranchEntry.sha", { description: "The branch tip's sha." })),
    /** Whether this branch is checked out in the current working tree. */
    current: S.Boolean.pipe(
      $I.annoteKey("BranchEntry.current", {
        description: "Whether this branch is checked out in the current working tree.",
      })
    ),
  }).pipe(
    $I.annoteSchema("BranchEntry", { description: "One local (or remote-tracking) branch, from `git branch --list`." })
  )
) {}

/**
 * Parses `git branch --list --format=%(HEAD)%00%(refname:short)%00%(objectname)`
 * output: newline-separated records (refnames cannot contain newlines) of
 * NUL-separated fields. The `%(HEAD)` marker is `*` for the checked-out
 * branch; anything else (` `, or `+` for a branch checked out in a linked
 * worktree) is not-current.
 */
const parseBranchList = (output: string): ReadonlyArray<BranchEntry> =>
  pipe(
    Str.split("\n")(output),
    A.filter((line) => line.length > 0),
    A.map((line) => {
      const [marker = "", name = "", sha = ""] = Str.split("\0")(line);
      return BranchEntry.make({ name, sha, current: marker === "*" });
    })
  );

/**
 * One ref, from `git for-each-ref`.
 *
 * **Example** (Represent an annotated tag object)
 *
 * ```ts
 * import { RefEntry } from "@beep/git/Git";
 *
 * const entry = RefEntry.make({ ref: "refs/tags/v1", sha: "abc", objectType: "tag" });
 * console.log(entry.objectType); // tag
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class RefEntry extends S.Opaque<RefEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The full refname (`refs/tags/v1`). */
    ref: S.String.pipe($I.annoteKey("RefEntry.ref", { description: "The full refname (`refs/tags/v1`)." })),
    /** The sha of the object the ref points at. */
    sha: S.String.pipe($I.annoteKey("RefEntry.sha", { description: "The sha of the object the ref points at." })),
    /**
     * The pointed-at object's type. An annotated tag is `tag` (the tag
     * object itself, not its target commit).
     */
    objectType: S.Literals(["commit", "tag", "tree", "blob"]).pipe(
      $I.annoteKey("RefEntry.objectType", {
        description:
          "The pointed-at object's type. An annotated tag is `tag` (the tag object itself, not its target commit).",
      })
    ),
  }).pipe($I.annoteSchema("RefEntry", { description: "One ref, from `git for-each-ref`." }))
) {}

const refEntryInput = S.Struct(RefEntry.fields);

/**
 * Parses `git for-each-ref --format=%(refname)%00%(objectname)%00%(objecttype)`
 * output: newline-separated records (refnames cannot contain newlines) of
 * NUL-separated fields.
 */
const parseForEachRef = (output: string): ReadonlyArray<RefEntry> =>
  pipe(
    Str.split("\n")(output),
    A.filter((line) => line.length > 0),
    A.map((line) => {
      const [ref = "", sha = "", objectType = "commit"] = Str.split("\0")(line);
      // Our own fixed format only ever emits git's four object types.
      const parsed = {
        ref,
        sha,
        objectType,
      };
      S.asserts(refEntryInput, parsed);
      return RefEntry.make(parsed);
    })
  );

/**
 * One configuration entry, from `git config --list`.
 *
 * **Example** (Represent a valueless config key)
 *
 * ```ts
 * import { ConfigListEntry } from "@beep/git/Git";
 *
 * const entry = ConfigListEntry.make({ key: "core.bare", value: "" });
 * console.log(entry.value === ""); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ConfigListEntry extends S.Opaque<ConfigListEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The canonical dotted key (`section.subsection.key`). */
    key: S.String.pipe(
      $I.annoteKey("ConfigListEntry.key", { description: "The canonical dotted key (`section.subsection.key`)." })
    ),
    /**
     * The raw value. A valueless key (git's boolean-true shorthand,
     * `[section]` + bare `key`) surfaces as the empty string — distinguish it
     * with `configGetAll` if the difference matters.
     */
    value: S.String.pipe(
      $I.annoteKey("ConfigListEntry.value", {
        description:
          "The raw value. A valueless key (git's boolean-true shorthand, `[section]` + bare `key`) surfaces as the empty string — distinguish it with `configGetAll` if the difference matters.",
      })
    ),
  }).pipe($I.annoteSchema("ConfigListEntry", { description: "One configuration entry, from `git config --list`." }))
) {}

/**
 * Parses `git config --list -z` output: NUL-terminated records, key separated
 * from value by the FIRST newline (a config value may itself contain
 * newlines — the reason `-z` is load-bearing). A record with no newline is a
 * valueless boolean-shorthand key.
 */
const parseConfigList = (output: string): ReadonlyArray<ConfigListEntry> =>
  A.map(parseNulSeparated(output), (record) => {
    const newlineIndex = pipe(record, Str.indexOf("\n"), O.getOrElse(constant(-1)));
    return newlineIndex === -1
      ? ConfigListEntry.make({ key: record, value: "" })
      : ConfigListEntry.make({
          key: Str.slice(0, newlineIndex)(record),
          value: Str.slice(newlineIndex + 1)(record),
        });
  });

/**
 * One working tree, from `git worktree list --porcelain`.
 *
 * **Example** (Represent a detached worktree)
 *
 * ```ts
 * import { WorktreeEntry } from "@beep/git/Git";
 *
 * const entry = WorktreeEntry.make({ path: "/repo", head: "abc", detached: true, bare: false });
 * console.log(entry.detached); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WorktreeEntry extends S.Opaque<WorktreeEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The working tree's absolute path. */
    path: S.String.pipe($I.annoteKey("WorktreeEntry.path", { description: "The working tree's absolute path." })),
    /** The checked-out commit sha; absent for a bare repository entry. */
    head: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.head", {
        description: "The checked-out commit sha; absent for a bare repository entry.",
      })
    ),
    /** The checked-out branch's full refname; absent when detached or bare. */
    branch: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.branch", {
        description: "The checked-out branch's full refname; absent when detached or bare.",
      })
    ),
    /** Whether the working tree is in detached-HEAD state. */
    detached: S.Boolean.pipe(
      $I.annoteKey("WorktreeEntry.detached", { description: "Whether the working tree is in detached-HEAD state." })
    ),
    /** Whether the entry is the bare repository itself. */
    bare: S.Boolean.pipe(
      $I.annoteKey("WorktreeEntry.bare", { description: "Whether the entry is the bare repository itself." })
    ),
    /** Present when the worktree is locked; holds the lock reason (possibly empty). */
    locked: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.locked", {
        description: "Present when the worktree is locked; holds the lock reason (possibly empty).",
      })
    ),
    /** Present when the worktree is prunable; holds the reason (possibly empty). */
    prunable: S.optionalKey(S.String).pipe(
      $I.annoteKey("WorktreeEntry.prunable", {
        description: "Present when the worktree is prunable; holds the reason (possibly empty).",
      })
    ),
  }).pipe($I.annoteSchema("WorktreeEntry", { description: "One working tree, from `git worktree list --porcelain`." }))
) {}

/** The attributes of the worktree entry being read, before it is flushed. */
interface WorktreeDraft {
  bare: boolean;
  branch: string | undefined;
  detached: boolean;
  head: string | undefined;
  locked: string | undefined;
  path: string | undefined;
  prunable: string | undefined;
}

const emptyWorktreeDraft = (): WorktreeDraft => ({
  bare: false,
  branch: undefined,
  detached: false,
  head: undefined,
  locked: undefined,
  path: undefined,
  prunable: undefined,
});

/** Emits the drafted entry; a draft without a `worktree` line emits nothing. */
const flushWorktree = (draft: WorktreeDraft, entries: Array<WorktreeEntry>): void => {
  const { bare, branch, detached, head, locked, path, prunable } = draft;
  if (path === undefined) return;
  entries.push(
    WorktreeEntry.make({
      path,
      detached,
      bare,
      ...O.getSomesStruct({ head: O.fromUndefinedOr(head) }),
      ...O.getSomesStruct({ branch: O.fromUndefinedOr(branch) }),
      ...O.getSomesStruct({ locked: O.fromUndefinedOr(locked) }),
      ...O.getSomesStruct({ prunable: O.fromUndefinedOr(prunable) }),
    })
  );
};

/** `<prefix><value>` attributes and the draft field each one fills. */
const WORKTREE_VALUE_ATTRIBUTES = [
  ["worktree ", "path"],
  ["HEAD ", "head"],
  ["branch ", "branch"],
] as const;

/** Annotations carrying an optional reason: bare `locked` records `""`. */
const WORKTREE_ANNOTATIONS = ["locked", "prunable"] as const;

/** Folds one non-blank porcelain attribute into the draft; unknown attributes are ignored. */
const applyWorktreeAttribute = (draft: WorktreeDraft, attribute: string): void => {
  if (attribute === "detached" || attribute === "bare") {
    draft[attribute] = true;
    return;
  }
  const valued = A.findFirst(WORKTREE_VALUE_ATTRIBUTES, ([prefix]) => Str.startsWith(prefix)(attribute));
  if (O.isSome(valued)) {
    draft[valued.value[1]] = Str.slice(valued.value[0].length)(attribute);
    return;
  }
  const annotation = A.findFirst(
    WORKTREE_ANNOTATIONS,
    (name) => attribute === name || Str.startsWith(`${name} `)(attribute)
  );
  if (O.isSome(annotation)) draft[annotation.value] = Str.slice(annotation.value.length + 1)(attribute);
};

/**
 * Parses `git worktree list --porcelain -z` output: NUL-terminated attribute
 * lines, one blank attribute terminating each entry. Attribute vocabulary:
 * `worktree <path>`, `HEAD <sha>`, `branch <ref>`, and the flag/annotation
 * attributes `detached`, `bare`, `locked [<reason>]`, `prunable [<reason>]`.
 */
const parseWorktreeList = (output: string): ReadonlyArray<WorktreeEntry> => {
  const entries: Array<WorktreeEntry> = [];
  let draft = emptyWorktreeDraft();
  for (const attribute of Str.split("\0")(output)) {
    if (attribute === "") {
      flushWorktree(draft, entries);
      draft = emptyWorktreeDraft();
    } else {
      applyWorktreeAttribute(draft, attribute);
    }
  }
  flushWorktree(draft, entries);
  return entries;
};

/**
 * One index (staging area) entry, from `git ls-files --stage`.
 *
 * **Details**
 *
 * The index-side sibling of {@link LsTreeEntry}: this is the ONLY place a
 * staged-but-uncommitted gitlink (`mode` `160000`) is visible — `lsTree`
 * reads the committed tree and misses exactly that window.
 *
 * **Example** (Represent an unresolved index stage)
 *
 * ```ts
 * import { LsFilesEntry } from "@beep/git/Git";
 *
 * const entry = LsFilesEntry.make({ mode: "100644", oid: "abc", stage: 2, path: "file.ts" });
 * console.log(entry.stage); // 2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LsFilesEntry extends S.Opaque<LsFilesEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The entry's file mode, e.g. `100644` — `160000` for a gitlink. */
    mode: S.String.pipe(
      $I.annoteKey("LsFilesEntry.mode", {
        description: "The entry's file mode, e.g. `100644` — `160000` for a gitlink.",
      })
    ),
    /** The staged object id. */
    oid: S.String.pipe($I.annoteKey("LsFilesEntry.oid", { description: "The staged object id." })),
    /** The merge stage: `0` normally; `1`/`2`/`3` during an unresolved merge. */
    stage: S.Finite.pipe(
      $I.annoteKey("LsFilesEntry.stage", {
        description: "The merge stage: `0` normally; `1`/`2`/`3` during an unresolved merge.",
      })
    ),
    /** The entry's path, relative to `cwd`. May contain spaces or newlines. */
    path: S.String.pipe(
      $I.annoteKey("LsFilesEntry.path", {
        description: "The entry's path, relative to `cwd`. May contain spaces or newlines.",
      })
    ),
  }).pipe(
    $I.annoteSchema("LsFilesEntry", { description: "One index (staging area) entry, from `git ls-files --stage`." })
  )
) {}

/**
 * Parses `git ls-files --stage -z` output: each NUL-terminated entry is
 * `<mode> <oid> <stage>\t<path>`. `path` is everything after the first tab,
 * so a path containing spaces or newlines is preserved intact — the same
 * split rule as `parseLsTree`.
 */
const parseLsFiles = (output: string): ReadonlyArray<LsFilesEntry> =>
  A.map(parseNulSeparated(output), (entry) => {
    const tabIndex = pipe(entry, Str.indexOf("\t"), O.getOrElse(constant(-1)));
    const header = Str.split(Str.slice(0, tabIndex)(entry), " ");
    return LsFilesEntry.make({
      mode: header[0],
      oid: header[1] ?? "",
      stage: Number(header[2] ?? "0"),
      path: Str.slice(tabIndex + 1)(entry),
    });
  });

/**
 * Refuse a caller-supplied ref or range that git would parse as an option.
 *
 * **Details**
 *
 * Refs are caller-controlled and land in git's argv as positional entries; a
 * value beginning with `-` is read as a flag instead — `checkout("-b")` would
 * CREATE a branch. A bare `--` separator is not a safe fix for every command
 * (it switches `checkout` into pathspec mode), so option-like values are
 * refused outright, before any spawn, as a typed {@link GitCommandError}.
 * `show`'s `path` needs no guard: it is fused after the ref into one
 * `ref:path` token, which cannot begin with `-` unless the ref does.
 *
 * `sensitive` values get the same check but a REDACTED report: a refused
 * sensitive positional (a `configSet` value) must not leak into
 * `GitCommandError.args`/`detail` any more than a spawned one may — the
 * redaction policy applies to guard rejections too.
 */
/** `values` followed by `optional` when it is defined — the argv refs a call actually passes. */
const withDefined = (values: ReadonlyArray<string>, optional: string | undefined): ReadonlyArray<string> =>
  optional === undefined ? values : [...values, optional];

const rejectOptionLikeRefs: {
  (cwd: string, refs: ReadonlyArray<string>, sensitive?: ReadonlyArray<string>): Effect.Effect<void, GitCommandError>;
  (
    refs: ReadonlyArray<string>,
    sensitive?: ReadonlyArray<string>
  ): (cwd: string) => Effect.Effect<void, GitCommandError>;
} = dual(
  hasStringSubject,
  (
    cwd: string,
    refs: ReadonlyArray<string>,
    sensitive: ReadonlyArray<string> = []
  ): Effect.Effect<void, GitCommandError> => {
    const offending = A.findFirst(refs, (ref) => Str.startsWith("-")(ref));
    if (O.isSome(offending)) {
      return encodeJsonString(offending.value).pipe(
        Effect.orDie,
        Effect.flatMap((encoded) =>
          Effect.fail(
            GitCommandError.make({
              kind: "refused",
              args: [offending.value],
              cwd,
              stderr: "",
              detail: `refused a ref argument git would parse as an option: ${encoded}`,
            })
          )
        )
      );
    }
    return A.every(sensitive, (value) => !Str.startsWith("-")(value))
      ? Effect.void
      : Effect.fail(
          GitCommandError.make({
            kind: "refused",
            args: ["<redacted>"],
            cwd,
            stderr: "",
            detail: "refused a sensitive argument git would parse as an option (value redacted)",
          })
        );
  }
);

/**
 * Refuse a caller-supplied numeric index/limit that is not a non-negative
 * integer.
 *
 * **Details**
 *
 * Every relational comparison against `NaN` is `false`, so a bare
 * `value < 0` guard admits `NaN` (and a fractional value truncates nothing —
 * it rides straight into the argv as `stash@{1.5}` / `--max-count=NaN`).
 * Integrality and range are therefore checked together, pre-spawn, as a
 * typed refusal.
 */
const rejectNonNaturalNumber: {
  (cwd: string, label: string, value: number | undefined): Effect.Effect<void, GitCommandError>;
  (label: string, value: number | undefined): (cwd: string) => Effect.Effect<void, GitCommandError>;
} = dual(
  3,
  (cwd: string, label: string, value: number | undefined): Effect.Effect<void, GitCommandError> =>
    value === undefined || isNonNegativeInteger(value)
      ? Effect.void
      : Effect.fail(
          GitCommandError.make({
            kind: "refused",
            args: [String(value)],
            cwd,
            stderr: "",
            detail: `refused ${label}: expected a non-negative integer, received ${value}`,
          })
        )
);

/**
 * The ssh-related environment, read once at layer construction. None of these
 * can change under a running service, so none is re-read per call — unlike
 * their git-config counterparts, which are repository-local.
 */
const SshFromEnv = S.Struct({
  /** `GIT_SSH_COMMAND` — a full command line; the first rung. */
  command: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.command", { description: "GIT_SSH_COMMAND, a full command line with highest precedence." })
  ),
  /** `GIT_SSH` — a program name with no argument support; the third rung. */
  program: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.program", { description: "GIT_SSH, a program name with no argument support." })
  ),
  /** `GIT_SSH_VARIANT` — overrides git's basename inference of the grammar. */
  variant: S.Option(S.String).pipe(
    $I.annoteKey("SshFromEnv.variant", {
      description: "GIT_SSH_VARIANT, overriding basename inference of the SSH grammar.",
    })
  ),
}).pipe(
  $I.annoteSchema("SshFromEnv", {
    description: "The optional SSH environment settings captured at layer construction.",
  })
);
type SshFromEnv = typeof SshFromEnv.Type;

/** The `{ index }` option the stash pop/apply/drop members accept. */
type StashIndexOptions = { readonly index?: number };

/** Records the stash index on the current span and refuses one that is not a natural number. */
const guardStashIndex = (cwd: string, index: number | undefined): Effect.Effect<void, GitCommandError> =>
  Effect.andThen(
    Effect.annotateCurrentSpan({ cwd, index: index ?? 0 }),
    rejectNonNaturalNumber(cwd, "a stash index", index)
  );

/**
 * The two outcome arms every classification mode maps identically: a missing
 * repository fails `NotARepositoryError`, and a classified failure fails with
 * its own `GitCommandError`.
 */
const repositoryFailureArms = (cwd: string) => ({
  notARepository: () => Effect.fail(NotARepositoryError.make({ cwd })),
  failure: (classified: { readonly error: GitCommandError }) => Effect.fail(classified.error),
});

/**
 * {@link repositoryFailureArms} plus the common `unknownRef` arm, which fails
 * `UnknownRefError` naming `ref` as the reference that did not resolve.
 */
const refFailureArms = (cwd: string, ref: string) => ({
  ...repositoryFailureArms(cwd),
  unknownRef: () => Effect.fail(UnknownRefError.make({ ref, cwd })),
});

/** Builds the `Git.Service` shape over an already-resolved `ChildProcessSpawner`. */
const make: {
  (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"], ssh: SshFromEnv): GitShape;
  (ssh: SshFromEnv): (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]) => GitShape;
} = dual(2, (spawner: ChildProcessSpawner.ChildProcessSpawner["Service"], ssh: SshFromEnv): GitShape => {
  const runFor: RunFor = dual(
    3,
    <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K): Effect.Effect<ClassifiedFor<K>> =>
      runClassified(invocation, cwd, kind, BASE_ENV).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      )
  );

  /** One `git config --get <key>` at `cwd`; unset and failure both read as `""`. */
  const readConfig: {
    (cwd: string, key: string): Effect.Effect<string>;
    (key: string): (cwd: string) => Effect.Effect<string>;
  } = dual(
    2,
    (cwd: string, key: string): Effect.Effect<string> =>
      Effect.map(runFor(GitCommand.configGet(key), cwd, "quiet"), (classified) =>
        classified._tag === "success" ? Str.trim(classified.output) : ""
      )
  );

  /**
   * Resolves the spawn environment for a member that reaches a remote,
   * following git's OWN precedence order rather than a simplification of it:
   * `GIT_SSH_COMMAND` \> `core.sshCommand` \> `GIT_SSH` \> plain `ssh` (each
   * rung verified against git 2.55).
   *
   * **Details**
   *
   * The config reads are why this is per-call rather than per-service:
   * `core.sshCommand` and `ssh.variant` are both repository-local, while one
   * `Git` instance serves every `cwd` a caller hands it. Each is skipped when
   * its environment counterpart already decides the answer, and the two run
   * concurrently, so the common case costs one round trip on a member about
   * to touch the network anyway.
   *
   * They deliberately run through `runFor` (BASE_ENV, no ssh pin): a local
   * config read needs no ssh, and routing them through the network path would
   * recurse.
   */
  const resolveSshEnv = Effect.fnUntraced(function* (cwd: string) {
    const [fromConfig, variantFromConfig] = yield* Effect.all(
      [
        O.isSome(ssh.command) ? Effect.succeed("") : readConfig(cwd, "core.sshCommand"),
        O.isSome(ssh.variant) ? Effect.succeed("") : readConfig(cwd, "ssh.variant"),
      ],
      { concurrency: "unbounded" }
    );

    // The variant decides the argument GRAMMAR, so it is checked first: a
    // non-OpenSSH variant means `-o BatchMode=yes` is not a thing git's ssh
    // invocation understands, whatever the command happens to be named.
    const variant = pipe(
      ssh.variant,
      O.getOrElse(() => variantFromConfig),
      Str.trim,
      Str.toLowerCase
    );
    if (!HashSet.has(OPENSSH_VARIANTS, variant)) {
      return { ...BASE_ENV };
    }

    const command = Str.trim(O.getOrElse(ssh.command, () => fromConfig));
    if (command !== "") {
      return sshEnv(command);
    }
    // No COMMAND anywhere, so GIT_SSH is the deciding rung if it is set. It
    // names a program and takes no arguments, so pinning anything here would
    // displace it rather than extend it — decline instead.
    if (O.isSome(ssh.program)) {
      return { ...BASE_ENV };
    }
    return sshEnv("ssh");
  });

  /**
   * `runFor` for a member that reaches a remote. Everything else spawns with
   * `BASE_ENV` alone — a member that never invokes ssh has no business
   * pinning an ssh command, and would pay the config read for nothing.
   */
  const runForNetwork: RunFor = dual(
    3,
    Effect.fnUntraced(function* <K extends ClassifyKind>(invocation: GitInvocation, cwd: string, kind: K) {
      const env = yield* resolveSshEnv(cwd);
      return yield* runClassified(invocation, cwd, kind, env).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner)
      );
    })
  );

  const show: GitShape["show"] = dual(
    3,
    Effect.fn("Git.show")(function* (cwd: string, ref: string, path: string) {
      yield* Effect.annotateCurrentSpan({ cwd, ref, path });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.show(ref, path), cwd, "show");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(classified.output),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const lsTree: GitShape["lsTree"] = dual(
    stringAt(1),
    Effect.fn("Git.lsTree")(function* (
      cwd: string,
      ref: string,
      options?: { readonly pathspec?: ReadonlyArray<string> }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, ref });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.lsTree(ref, options?.pathspec ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseLsTree(classified.output)),
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const refExists: GitShape["refExists"] = dual(
    2,
    Effect.fn("Git.refExists")(function* (cwd: string, ref: string) {
      yield* Effect.annotateCurrentSpan({ cwd, ref });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.refExists(ref), cwd, "refExists");
      return yield* Match.valueTags(classified, {
        success: () => Effect.succeed(true),
        refMissing: () => Effect.succeed(false),
        ...repositoryFailureArms(cwd),
        unknownRef: // A ref that doesn't resolve IS the negative answer this method
          // promises — never an error, and never a defect.
          () => Effect.succeed(false),
      });
    })
  );

  const mergeBase: GitShape["mergeBase"] = dual(
    3,
    Effect.fn("Git.mergeBase")(function* (cwd: string, a: string, b: string) {
      yield* Effect.annotateCurrentSpan({ cwd, a, b });
      yield* rejectOptionLikeRefs(cwd, [a, b]);
      const classified = yield* runFor(GitCommand.mergeBase(a, b), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(Str.trim(classified.output)),
        ...refFailureArms(cwd, `${a}...${b}`),
      });
    })
  );

  const mergeBaseOption: GitShape["mergeBaseOption"] = dual(
    3,
    Effect.fn("Git.mergeBaseOption")(function* (cwd: string, a: string, b: string) {
      yield* Effect.annotateCurrentSpan({ cwd, a, b });
      yield* rejectOptionLikeRefs(cwd, [a, b]);
      // "quiet" kind: no common ancestor is a SILENT exit 1 (probed against
      // git 2.54) — the legitimate "these histories are disjoint" answer,
      // degraded to Option.none. An unknown ref still exits 128 with a
      // `Not a valid object name` stderr and stays UnknownRefError; a NOISY
      // exit 1 stays a loud GitCommandError.
      const classified = yield* runFor(GitCommand.mergeBase(a, b), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(Str.trim(classified.output)),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, `${a}...${b}`),
      });
    })
  );

  const changedFiles: GitShape["changedFiles"] = dual(
    2,
    Effect.fn("Git.changedFiles")(function* (
      cwd: string,
      options: {
        readonly base: string;
        readonly head: string;
        readonly relative?: boolean;
      }
    ) {
      const relative = options.relative ?? false;
      yield* Effect.annotateCurrentSpan({
        cwd,
        base: options.base,
        head: options.head,
        relative,
      });
      yield* rejectOptionLikeRefs(cwd, [options.base, options.head]);
      const classified = yield* runFor(GitCommand.changedFiles(options.base, options.head, relative), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseNulSeparated(classified.output)),
        ...refFailureArms(cwd, `${options.base}...${options.head}`),
      });
    })
  );

  // Runs a NUL-separated, ref-free path listing (the working-tree queries) and
  // classifies through the shared path. No ref is involved, so `unknownRef`
  // cannot arise in practice — it is handled defensively to keep the match
  // exhaustive and the error channel uniform with the ref-taking methods.
  const collectPaths: {
    (
      method: string,
      invocation: GitInvocation,
      cwd: string
    ): Effect.Effect<ReadonlyArray<string>, NotARepositoryError | UnknownRefError | GitCommandError>;
    (
      invocation: GitInvocation,
      cwd: string
    ): (
      method: string
    ) => Effect.Effect<ReadonlyArray<string>, NotARepositoryError | UnknownRefError | GitCommandError>;
  } = dual(
    3,
    Effect.fnUntraced(function* (_method: string, invocation: GitInvocation, cwd: string) {
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseNulSeparated(classified.output)),
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  const unstagedChanges: GitShape["unstagedChanges"] = dual(
    hasStringSubject,
    Effect.fn("Git.unstagedChanges")(function* (cwd: string, options?: { readonly relative?: boolean }) {
      const relative = options?.relative ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, relative });
      return yield* collectPaths("Git.unstagedChanges", GitCommand.unstagedChanges(relative), cwd);
    })
  );

  const stagedChanges: GitShape["stagedChanges"] = dual(
    hasStringSubject,
    Effect.fn("Git.stagedChanges")(function* (cwd: string, options?: { readonly relative?: boolean }) {
      const relative = options?.relative ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, relative });
      return yield* collectPaths("Git.stagedChanges", GitCommand.stagedChanges(relative), cwd);
    })
  );

  const untrackedFiles: GitShape["untrackedFiles"] = dual(
    hasStringSubject,
    Effect.fn("Git.untrackedFiles")(function* (cwd: string, options?: { readonly relative?: boolean }) {
      const relative = options?.relative ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, relative });
      return yield* collectPaths("Git.untrackedFiles", GitCommand.untrackedFiles(relative), cwd);
    })
  );

  const workingChanges: GitShape["workingChanges"] = dual(
    hasStringSubject,
    Effect.fn("Git.workingChanges")(function* (cwd: string, options?: { readonly relative?: boolean }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        relative: options?.relative ?? false,
      });
      const unstaged = yield* unstagedChanges(cwd, options);
      const staged = yield* stagedChanges(cwd, options);
      const untracked = yield* untrackedFiles(cwd, options);
      return A.dedupe([...unstaged, ...staged, ...untracked]);
    })
  );

  const nameStatus: GitShape["nameStatus"] = dual(
    2,
    Effect.fn("Git.nameStatus")(function* (
      cwd: string,
      options: {
        readonly base: string;
        readonly head?: string;
        readonly relative?: boolean;
      }
    ) {
      const relative = options.relative ?? false;
      yield* Effect.annotateCurrentSpan({
        cwd,
        base: options.base,
        head: options.head ?? "(working tree)",
        relative,
      });
      yield* rejectOptionLikeRefs(cwd, options.head === undefined ? [options.base] : [options.base, options.head]);
      const classified = yield* runFor(GitCommand.nameStatus(options.base, options.head, relative), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseNameStatus(classified.output)),
        ...refFailureArms(cwd, options.head === undefined ? options.base : `${options.base}...${options.head}`),
      });
    })
  );

  const revParse: GitShape["revParse"] = dual(
    2,
    Effect.fn("Git.revParse")(function* (cwd: string, ref: string) {
      yield* Effect.annotateCurrentSpan({ cwd, ref });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.revParse(ref), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(Str.trim(classified.output)),
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const checkout: GitShape["checkout"] = dual(
    stringAt(1),
    Effect.fn("Git.checkout")(function* (cwd: string, ref: string, options?: { readonly detach?: boolean }) {
      const detach = options?.detach ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, ref, detach });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      const classified = yield* runFor(GitCommand.checkout(ref, detach), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, ref),
      });
    })
  );

  const reset: GitShape["reset"] = dual(
    hasStringSubject,
    Effect.fn("Git.reset")(function* (
      cwd: string,
      options?: {
        readonly mode?: "soft" | "mixed" | "hard";
        readonly ref?: string;
      }
    ) {
      const { mode = "mixed", ref } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, mode, ref: ref ?? "HEAD" });
      yield* rejectOptionLikeRefs(cwd, withDefined([], ref));
      const classified = yield* runFor(GitCommand.reset(mode, ref), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, ref ?? "HEAD"),
      });
    })
  );

  const clean: GitShape["clean"] = dual(
    hasStringSubject,
    Effect.fn("Git.clean")(function* (
      cwd: string,
      options?: {
        readonly directories?: boolean;
        readonly ignored?: boolean;
        readonly paths?: ReadonlyArray<string>;
      }
    ) {
      const directories = options?.directories ?? false;
      const ignored = options?.ignored ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, directories, ignored });
      const classified = yield* runFor(GitCommand.clean(directories, ignored, options?.paths ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  const restore: GitShape["restore"] = dual(
    hasStringSubject,
    Effect.fn("Git.restore")(function* (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly source?: string;
        readonly staged?: boolean;
        readonly worktree?: boolean;
      }
    ) {
      const { source, staged = false, worktree = false } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, count: paths.length, source: source ?? "(index)" });
      yield* rejectOptionLikeRefs(cwd, withDefined([], source));
      const classified = yield* runFor(GitCommand.restore(paths, source, staged, worktree), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, source ?? "working tree"),
      });
    })
  );

  const branchCreate: GitShape["branchCreate"] = dual(
    stringAt(1),
    Effect.fn("Git.branchCreate")(function* (
      cwd: string,
      name: string,
      options?: {
        readonly startPoint?: string;
        readonly checkout?: boolean;
        readonly force?: boolean;
      }
    ) {
      const { checkout: checkoutBranch = false, force = false, startPoint } = options ?? {};
      yield* Effect.annotateCurrentSpan({
        cwd,
        name,
        startPoint: startPoint ?? "HEAD",
        checkout: checkoutBranch,
        force,
      });
      yield* rejectOptionLikeRefs(cwd, withDefined([name], startPoint));
      const classified = yield* runFor(
        GitCommand.branchCreate(name, startPoint, checkoutBranch, force),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, startPoint ?? name),
      });
    })
  );

  const branchDelete: GitShape["branchDelete"] = dual(
    stringAt(1),
    Effect.fn("Git.branchDelete")(function* (cwd: string, name: string, options?: { readonly force?: boolean }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        name,
        force: options?.force ?? false,
      });
      yield* rejectOptionLikeRefs(cwd, [name]);
      const classified = yield* runFor(GitCommand.branchDelete(name, options?.force ?? false), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, name),
      });
    })
  );

  const isShallow = Effect.fn("Git.isShallow")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const classified = yield* runFor(GitCommand.isShallow(), cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: // rev-parse --is-shallow-repository prints exactly "true" or "false".
        (classified) => Effect.succeed(Str.trim(classified.output) === "true"),
      ...refFailureArms(cwd, "HEAD"),
    });
  });

  const fetchUnshallow: GitShape["fetchUnshallow"] = dual(
    hasStringSubject,
    Effect.fn("Git.fetchUnshallow")(function* (cwd: string, options?: { readonly remote?: string }) {
      const remote = options?.remote ?? "origin";
      yield* Effect.annotateCurrentSpan({ cwd });
      yield* rejectOptionLikeRefs(cwd, [remote]);
      const classified = yield* runForNetwork(GitCommand.fetchUnshallow(remote), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "--unshallow"),
      });
    })
  );

  const fetch: GitShape["fetch"] = dual(
    2,
    Effect.fn("Git.fetch")(function* (
      cwd: string,
      options: {
        readonly ref: string;
        readonly remote?: string;
        readonly depth?: number;
        readonly tag?: boolean;
        readonly unshallow?: boolean;
      }
    ) {
      const remote = options.remote ?? "origin";
      const tag = options.tag ?? false;
      const unshallow = options.unshallow ?? false;
      yield* Effect.annotateCurrentSpan({
        cwd,
        ref: options.ref,
        tag,
        unshallow,
      });
      yield* rejectOptionLikeRefs(cwd, [remote, options.ref]);
      yield* rejectNonNaturalNumber(cwd, "a fetch depth", options.depth);
      if (unshallow && options.depth !== undefined) {
        // git itself rejects the pair (`--depth and --unshallow cannot be used
        // together`, exit 128) — refused typed pre-spawn, the submoduleDeinit
        // constraint-refusal precedent.
        return yield* GitCommandError.make({
          kind: "refused",
          args: ["--unshallow", "--depth", String(options.depth)],
          cwd,
          stderr: "",
          detail: "refused: fetch cannot combine unshallow with depth (git rejects the pair)",
        });
      }
      const classified = yield* runForNetwork(
        GitCommand.fetch(remote, options.ref, options.depth, tag, unshallow),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, options.ref),
      });
    })
  );

  const fetchAny: GitShape["fetchAny"] = dual(
    2,
    Effect.fn("Git.fetchAny")(function* (
      cwd: string,
      options: {
        readonly ref: string;
        readonly remote?: string;
        readonly depth?: number;
      }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, ref: options.ref });
      return yield* fetch(cwd, { ...options, tag: true }).pipe(
        // UnknownRefError is the typed "not a tag on the remote" signal; a
        // GitCommandError keeps unclassified tag-form stderr shapes on the
        // fallback path too. NotARepositoryError deliberately propagates —
        // the plain form would fail identically, so the retry is pure waste.
        // A refused GitCommandError (kind "refused") is a pre-spawn guard
        // rejection — an option-like remote or ref — that the plain form's own
        // guard would reproduce identically: it short-circuits here rather than
        // routing through a phantom fallback and re-rejecting. Routing on `kind`
        // is why fetchAny no longer duplicates the guard up front.
        Effect.catchTag(["UnknownRefError", "GitCommandError"], (error) =>
          error._tag === "GitCommandError" && error.kind === "refused" ? Effect.fail(error) : fetch(cwd, options)
        )
      );
    })
  );

  const submoduleUpdate: GitShape["submoduleUpdate"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleUpdate")(function* (
      cwd: string,
      options?: {
        readonly init?: boolean;
        readonly depth?: number;
        readonly paths?: ReadonlyArray<string>;
        readonly checkout?: boolean;
        readonly remote?: boolean;
        readonly fetch?: false;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ) {
      const {
        checkout = false,
        depth,
        fetch,
        force = false,
        init = false,
        paths = [],
        recursive = false,
        remote = false,
      } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, init, checkout });
      yield* rejectNonNaturalNumber(cwd, "a submodule update depth", depth);
      const classified = yield* runForNetwork(
        GitCommand.submoduleUpdate(init, depth, paths, {
          checkout,
          remote,
          recursive,
          force,
          // exactOptionalPropertyTypes: `fetch` only exists when the caller
          // asked for --no-fetch; an explicit undefined is not assignable.
          ...(fetch === false ? { fetch: false as const } : {}),
        }),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule update"),
      });
    })
  );

  const submoduleAdd: GitShape["submoduleAdd"] = dual(
    2,
    Effect.fn("Git.submoduleAdd")(function* (
      cwd: string,
      options: {
        readonly url: string;
        readonly path: string;
        readonly depth?: number;
      }
    ) {
      // The url is deliberately NOT annotated: a URL can embed userinfo, and
      // span annotations carry stable identifiers only (the redaction policy).
      yield* Effect.annotateCurrentSpan({ cwd, path: options.path });
      yield* rejectNonNaturalNumber(cwd, "a submodule add depth", options.depth);
      const classified = yield* runForNetwork(
        GitCommand.submoduleAdd(options.url, options.path, options.depth),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, options.path),
      });
    })
  );

  const sparseCheckoutSet: GitShape["sparseCheckoutSet"] = dual(
    3,
    Effect.fn("Git.sparseCheckoutSet")(function* (
      cwd: string,
      patterns: ReadonlyArray<string>,
      options: { readonly cone: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, cone: options.cone });
      yield* rejectOptionLikeRefs(cwd, patterns);
      const classified = yield* runFor(GitCommand.sparseCheckoutSet(patterns, options.cone), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "sparse-checkout"),
      });
    })
  );

  const configSet: GitShape["configSet"] = dual(
    stringAt(2),
    Effect.fn("Git.configSet")(function* (
      cwd: string,
      key: string,
      value: string,
      options?: { readonly file?: string }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        file: options?.file ?? "(repository config)",
      });
      // git config has no documented -- separator, so key, value AND file are all
      // guarded — a leading-dash value is refused typed rather than risking git
      // reading it as a flag. Recorded limitation: a legitimate "-..." config
      // value cannot be written through this method. The value rides the
      // SENSITIVE arm: a refused config value is reported as <redacted>, never
      // echoed into the error (the redaction policy).
      yield* rejectOptionLikeRefs(cwd, [key, ...(options?.file !== undefined ? [options.file] : [])], [value]);
      const classified = yield* runFor(GitCommand.configSet(key, value, options?.file), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, key),
      });
    })
  );

  const add: GitShape["add"] = dual(
    2,
    Effect.fn("Git.add")(function* (cwd: string, paths: ReadonlyArray<string>) {
      yield* Effect.annotateCurrentSpan({ cwd, count: paths.length });
      const classified = yield* runFor(GitCommand.add(paths), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "working tree"),
      });
    })
  );

  const defaultBranch: GitShape["defaultBranch"] = dual(
    hasStringSubject,
    Effect.fn("Git.defaultBranch")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
      }
    ) {
      const remote = options?.remote ?? "origin";
      yield* Effect.annotateCurrentSpan({ cwd, remote });
      yield* rejectOptionLikeRefs(cwd, [remote]);
      const classified = yield* runFor(GitCommand.defaultBranch(remote), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: (classified) => {
          const short = Str.trim(classified.output);
          const prefix = `${remote}/`;
          return Effect.succeedSome(Str.startsWith(prefix)(short) ? Str.slice(prefix.length)(short) : short);
        },
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, `refs/remotes/${remote}/HEAD`),
      });
    })
  );

  const currentBranch = Effect.fn("Git.currentBranch")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const classified = yield* runFor(GitCommand.currentBranch(), cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: (classified) => {
        const name = Str.trim(classified.output);
        // A detached HEAD answers with the literal string "HEAD" (exit 0) —
        // "no current branch" is the honest typed answer, not a fake name.
        return Effect.succeed(name === "HEAD" ? O.none() : O.some(name));
      },
      ...refFailureArms(cwd, "HEAD"),
    });
  });

  const repoRoot = Effect.fn("Git.repoRoot")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const classified = yield* runFor(GitCommand.repoRoot(), cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: (classified) => Effect.succeed(Str.trim(classified.output)),
      ...refFailureArms(cwd, "working tree"),
    });
  });

  const commonDir = Effect.fn("Git.commonDir")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const invocation = GitCommand.commonDir();
    const classified = yield* runFor(invocation, cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: Effect.fnUntraced(function* (classified) {
        // Strip only git's terminating newline, never `trim`: the answer is an
        // identity, and a directory name may end in whitespace.
        const answer = Str.replace(/\n$/, "")(classified.output);
        // git before 2.31 does not know --path-format: rev-parse echoes the flag
        // to stdout, answers the relative form on the next line, and exits 0.
        if (Str.startsWith("-")(answer)) {
          return yield* GitCommandError.make({
            kind: "failed",
            args: invocation.redactedArgs,
            cwd,
            stderr: "",
            detail: `unparseable common-dir output (--path-format needs git 2.31 or later): ${yield* encodeJsonString(answer).pipe(Effect.orDie)}`,
          });
        }
        return answer;
      }),
      unknownRef: () => Effect.die('Git.commonDir: unexpected classification "unknownRef"'),
      ...repositoryFailureArms(cwd),
    });
  });

  const configGet: GitShape["configGet"] = dual(
    stringAt(1),
    Effect.fn("Git.configGet")(function* (cwd: string, key: string, options?: { readonly scope?: GitConfigScope }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        scope: options?.scope ?? "(merged)",
      });
      yield* rejectOptionLikeRefs(cwd, [key]);
      const classified = yield* runFor(GitCommand.configGet(key, options?.scope), cwd, "quiet");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(Str.trim(classified.output)),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, key),
      });
    })
  );

  const remoteUrl: GitShape["remoteUrl"] = dual(
    hasStringSubject,
    Effect.fn("Git.remoteUrl")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
      }
    ) {
      const remote = options?.remote ?? "origin";
      yield* Effect.annotateCurrentSpan({ cwd, remote });
      yield* rejectOptionLikeRefs(cwd, [remote]);
      const classified = yield* runFor(GitCommand.remoteUrl(remote), cwd, "noSuchRemote");
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeedSome(Str.trim(classified.output)),
        absent: () => Effect.succeedNone,
        ...refFailureArms(cwd, remote),
      });
    })
  );

  const commitInfo = Effect.fn("Git.commitInfo")(function* (cwd: string, ref?: string) {
    const target = ref ?? "HEAD";
    yield* Effect.annotateCurrentSpan({ cwd, ref: target });
    yield* rejectOptionLikeRefs(cwd, [target]);
    const invocation = GitCommand.commitInfo(target);
    const classified = yield* runFor(invocation, cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: (classified) =>
        Effect.fromOption(parseCommitInfo(classified.output), () =>
          GitCommandError.make({
            kind: "failed",
            args: invocation.redactedArgs,
            cwd,
            stderr: "",
            detail: "unparseable commitInfo output: expected two NUL separators and a valid signature status",
          })
        ),
      ...refFailureArms(cwd, target),
    });
  });

  const log: GitShape["log"] = dual(
    hasStringSubject,
    Effect.fn("Git.log")(function* (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly follow?: boolean;
        readonly limit?: number;
        readonly firstParentDiffMerges?: boolean;
      }
    ) {
      const { firstParentDiffMerges = false, follow = false, limit, paths = [] } = options ?? {};
      // Path VALUES are stable identifiers, but a pathspec can be long and is
      // caller-controlled; the count is what a trace needs to correlate.
      yield* Effect.annotateCurrentSpan({ cwd, paths: paths.length, follow });
      yield* rejectNonNaturalNumber(cwd, "a log limit", limit);
      const invocation = GitCommand.log(paths, follow, limit, firstParentDiffMerges);
      if (follow && paths.length !== 1) {
        // git's own restriction, refused pre-spawn: `--follow` walks ONE
        // path's history, and git's own diagnostic for the violation is an
        // unclassifiable usage error.
        return yield* GitCommandError.make({
          kind: "refused",
          args: invocation.redactedArgs,
          cwd,
          stderr: "",
          detail: `refused --follow: git follows exactly one path, received ${paths.length}`,
        });
      }
      const classified = yield* runFor(invocation, cwd, "log");
      return yield* Match.valueTags(classified, {
        success: Effect.fnUntraced(function* (classified) {
          const parsed = parseLog(classified.output);
          if (Result.isFailure(parsed)) {
            return yield* GitCommandError.make({
              kind: "failed",
              args: invocation.redactedArgs,
              cwd,
              stderr: "",
              detail: `unparseable log output: ${parsed.failure}`,
            });
          }
          return parsed.success;
        }),
        absent: () => {
          // An unborn HEAD — however this git spells it — has no history,
          // which is the empty log, never a failure. `Git.log` takes no ref,
          // so there is no ref for an UnknownRefError to name and the error
          // is absent from this member's union by construction.
          const empty: ReadonlyArray<CommitLogEntry> = [];
          return Effect.succeed(empty);
        },
        ...repositoryFailureArms(cwd),
        unknownRef: () => {
          // An unborn HEAD — however this git spells it — has no history,
          // which is the empty log, never a failure. `Git.log` takes no ref,
          // so there is no ref for an UnknownRefError to name and the error
          // is absent from this member's union by construction.
          const empty: ReadonlyArray<CommitLogEntry> = [];
          return Effect.succeed(empty);
        },
      });
    })
  );

  const status = Effect.fn("Git.status")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    const classified = yield* runFor(GitCommand.status(), cwd, "generic");
    return yield* Match.valueTags(classified, {
      success: (classified) => Effect.succeed(parseStatus(classified.output)),
      ...refFailureArms(cwd, "working tree"),
    });
  });

  const submoduleStatus: GitShape["submoduleStatus"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleStatus")(function* (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        recursive: options?.recursive ?? false,
      });
      const classified = yield* runFor(
        GitCommand.submoduleStatus(options?.paths ?? [], options?.recursive ?? false),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parseSubmoduleStatus(classified.output)),
        ...refFailureArms(cwd, "submodule status"),
      });
    })
  );

  const submoduleInit: GitShape["submoduleInit"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleInit")(function* (cwd: string, options?: { readonly paths?: ReadonlyArray<string> }) {
      yield* Effect.annotateCurrentSpan({ cwd });
      const classified = yield* runFor(GitCommand.submoduleInit(options?.paths ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule init"),
      });
    })
  );

  const submoduleDeinit: GitShape["submoduleDeinit"] = dual(
    2,
    Effect.fn("Git.submoduleDeinit")(function* (
      cwd: string,
      options: {
        readonly paths?: ReadonlyArray<string>;
        readonly all?: boolean;
        readonly force?: boolean;
      }
    ) {
      const paths = options.paths ?? [];
      const all = options.all ?? false;
      yield* Effect.annotateCurrentSpan({ cwd, all, count: paths.length });
      if (!all && paths.length === 0) {
        // git itself refuses deinit with neither --all nor a pathspec; refusing
        // pre-spawn keeps the contract explicit and spawn-free.
        return yield* GitCommandError.make({
          kind: "refused",
          args: ["submodule", "deinit"],
          cwd,
          stderr: "",
          detail: "refused: submoduleDeinit needs either paths or all: true",
        });
      }
      const classified = yield* runFor(GitCommand.submoduleDeinit(paths, all, options.force ?? false), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule deinit"),
      });
    })
  );

  const submoduleSync: GitShape["submoduleSync"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleSync")(function* (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        recursive: options?.recursive ?? false,
      });
      const classified = yield* runFor(
        GitCommand.submoduleSync(options?.paths ?? [], options?.recursive ?? false),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule sync"),
      });
    })
  );

  const submoduleSetUrl: GitShape["submoduleSetUrl"] = dual(
    3,
    Effect.fn("Git.submoduleSetUrl")(function* (cwd: string, path: string, url: string) {
      // The url is deliberately NOT annotated: a URL can embed userinfo, and
      // span annotations carry stable identifiers only (the redaction policy).
      yield* Effect.annotateCurrentSpan({ cwd, path });
      const classified = yield* runFor(GitCommand.submoduleSetUrl(path, url), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, path),
      });
    })
  );

  const submoduleSetBranch: GitShape["submoduleSetBranch"] = dual(
    stringAt(1),
    Effect.fn("Git.submoduleSetBranch")(function* (cwd: string, path: string, options?: { readonly branch?: string }) {
      const branch = options?.branch;
      yield* Effect.annotateCurrentSpan({
        cwd,
        path,
        branch: branch ?? "(default)",
      });
      if (branch !== undefined) {
        yield* rejectOptionLikeRefs(cwd, [branch]);
      }
      const classified = yield* runFor(GitCommand.submoduleSetBranch(path, branch), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, branch ?? path),
      });
    })
  );

  const submoduleAbsorbgitdirs: GitShape["submoduleAbsorbgitdirs"] = dual(
    hasStringSubject,
    Effect.fn("Git.submoduleAbsorbgitdirs")(function* (
      cwd: string,
      options?: { readonly paths?: ReadonlyArray<string> }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd });
      const classified = yield* runFor(GitCommand.submoduleAbsorbgitdirs(options?.paths ?? []), cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, "submodule absorbgitdirs"),
      });
    })
  );

  const submoduleForeach: GitShape["submoduleForeach"] = dual(
    stringAt(1),
    Effect.fn("Git.submoduleForeach")(function* (
      cwd: string,
      command: string,
      options?: { readonly recursive?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        recursive: options?.recursive ?? false,
      });
      // The command is a positional git would read as a flag if it led with a
      // dash — the same option-injection guard as refs.
      yield* rejectOptionLikeRefs(cwd, [command]);
      const classified = yield* runFor(
        GitCommand.submoduleForeach(command, options?.recursive ?? false),
        cwd,
        "generic"
      );
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(classified.output),
        ...refFailureArms(cwd, "submodule foreach"),
      });
    })
  );

  // Runs a void-returning invocation and classifies through the shared path,
  // mapping `unknownRef` to the given ref label — the shared shape of every
  // mutating method with no method-specific classification rows.
  const runVoid: {
    (
      method: string,
      invocation: GitInvocation,
      cwd: string,
      refLabel: string
    ): Effect.Effect<void, NotARepositoryError | UnknownRefError | GitCommandError>;
    (
      invocation: GitInvocation,
      cwd: string,
      refLabel: string
    ): (method: string) => Effect.Effect<void, NotARepositoryError | UnknownRefError | GitCommandError>;
  } = dual(
    4,
    Effect.fnUntraced(function* (_method: string, invocation: GitInvocation, cwd: string, refLabel: string) {
      const classified = yield* runFor(invocation, cwd, "generic");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, refLabel),
      });
    })
  );

  // Runs a parse-returning invocation and classifies through the shared path.
  // `absent` handles the `"quiet"` kind's silent-exit-1 degrade (an unset
  // config key, a no-paths-ignored check-ignore run).
  const runParsed: {
    <A>(
      method: string,
      invocation: GitInvocation,
      cwd: string,
      refLabel: string,
      kind: "generic" | "quiet",
      parse: (output: string) => A,
      network?: boolean
    ): Effect.Effect<A, NotARepositoryError | UnknownRefError | GitCommandError>;
    <A>(
      invocation: GitInvocation,
      cwd: string,
      refLabel: string,
      kind: "generic" | "quiet",
      parse: (output: string) => A,
      network?: boolean
    ): (method: string) => Effect.Effect<A, NotARepositoryError | UnknownRefError | GitCommandError>;
  } = dual(
    hasStringSubject,
    Effect.fnUntraced(function* <A>(
      _method: string,
      invocation: GitInvocation,
      cwd: string,
      refLabel: string,
      kind: "generic" | "quiet",
      parse: (output: string) => A,
      /** Whether this member reaches a remote and so needs the ssh pin resolved. */
      network = false
    ) {
      const classified = yield* (network ? runForNetwork : runFor)(invocation, cwd, kind);
      return yield* Match.valueTags(classified, {
        success: (classified) => Effect.succeed(parse(classified.output)),
        absent: () => Effect.succeed(parse("")),
        ...refFailureArms(cwd, refLabel),
      });
    })
  );

  const lsRemote: GitShape["lsRemote"] = dual(
    stringAt(1),
    Effect.fn("Git.lsRemote")(function* (
      cwd: string,
      remote: string,
      options?: {
        readonly heads?: boolean;
        readonly tags?: boolean;
        readonly patterns?: ReadonlyArray<string>;
      }
    ) {
      // The remote is deliberately NOT annotated: it may be a URL embedding
      // userinfo, and span annotations carry stable identifiers only.
      const { heads = false, patterns = [], tags = false } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, heads, tags, patterns: patterns.length });
      yield* rejectOptionLikeRefs(cwd, [remote, ...patterns]);
      return yield* runParsed(
        "Git.lsRemote",
        GitCommand.lsRemote(remote, heads, tags, patterns),
        cwd,
        "ls-remote",
        "generic",
        parseLsRemote,
        true
      );
    })
  );

  const remoteAdd: GitShape["remoteAdd"] = dual(
    3,
    Effect.fn("Git.remoteAdd")(function* (cwd: string, name: string, url: string) {
      // The url is deliberately NOT annotated.
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name, url]);
      return yield* runVoid("Git.remoteAdd", GitCommand.remoteAdd(name, url), cwd, name);
    })
  );

  const remoteRemove: GitShape["remoteRemove"] = dual(
    2,
    Effect.fn("Git.remoteRemove")(function* (cwd: string, name: string) {
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name]);
      return yield* runVoid("Git.remoteRemove", GitCommand.remoteRemove(name), cwd, name);
    })
  );

  const remoteSetUrl: GitShape["remoteSetUrl"] = dual(
    3,
    Effect.fn("Git.remoteSetUrl")(function* (cwd: string, name: string, url: string) {
      // The url is deliberately NOT annotated.
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name, url]);
      return yield* runVoid("Git.remoteSetUrl", GitCommand.remoteSetUrl(name, url), cwd, name);
    })
  );

  const stashPush: GitShape["stashPush"] = dual(
    hasStringSubject,
    Effect.fn("Git.stashPush")(function* (
      cwd: string,
      options?: {
        readonly message?: string;
        readonly includeUntracked?: boolean;
        readonly paths?: ReadonlyArray<string>;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        includeUntracked: options?.includeUntracked ?? false,
      });
      return yield* runVoid(
        "Git.stashPush",
        GitCommand.stashPush(options?.message, options?.includeUntracked ?? false, options?.paths ?? []),
        cwd,
        "stash"
      );
    })
  );

  /** The data-first form of a merge-shaped stash member (`stashPop`, `stashApply`). */
  type StashRestore = (
    cwd: string,
    options?: { readonly index?: number }
  ) => Effect.Effect<
    void,
    GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
  >;

  // The shared body of stashPop and stashApply — the two merge-shaped stash
  // operations, whose conflict/dirty stderr classifies exactly like a pull's.
  const stashRestore: {
    (method: string, invocation: (index?: number) => GitInvocation): StashRestore;
    (invocation: (index?: number) => GitInvocation): (method: string) => StashRestore;
  } = dual(
    2,
    (method: string, invocation: (index?: number) => GitInvocation): StashRestore =>
      Effect.fn(method)(function* (cwd: string, options?: StashIndexOptions) {
        yield* guardStashIndex(cwd, options?.index);
        const classified = yield* runFor(invocation(options?.index), cwd, "merge");
        return yield* Match.valueTags(classified, {
          success: () => Effect.void,
          ...refFailureArms(cwd, "stash"),
          mergeConflict: () => Effect.fail(MergeConflictError.make({ cwd })),
          dirtyWorktree: () => Effect.fail(DirtyWorktreeError.make({ cwd })),
        });
      })
  );

  const stashPop: GitShape["stashPop"] = dual(hasStringSubject, stashRestore("Git.stashPop", GitCommand.stashPop));
  const stashApply: GitShape["stashApply"] = dual(
    hasStringSubject,
    stashRestore("Git.stashApply", GitCommand.stashApply)
  );

  const stashDrop: GitShape["stashDrop"] = dual(
    hasStringSubject,
    Effect.fn("Git.stashDrop")(function* (cwd: string, options?: StashIndexOptions) {
      yield* guardStashIndex(cwd, options?.index);
      return yield* runVoid("Git.stashDrop", GitCommand.stashDrop(options?.index), cwd, "stash");
    })
  );

  const stashList = Effect.fn("Git.stashList")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    return yield* runParsed("Git.stashList", GitCommand.stashList(), cwd, "stash", "generic", parseStashList);
  });

  const branchList: GitShape["branchList"] = dual(
    hasStringSubject,
    Effect.fn("Git.branchList")(function* (
      cwd: string,
      options?: { readonly remotes?: boolean; readonly all?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        remotes: options?.remotes ?? false,
        all: options?.all ?? false,
      });
      return yield* runParsed(
        "Git.branchList",
        GitCommand.branchList(options?.remotes ?? false, options?.all ?? false),
        cwd,
        "branches",
        "generic",
        parseBranchList
      );
    })
  );

  const tagCreate: GitShape["tagCreate"] = dual(
    stringAt(1),
    Effect.fn("Git.tagCreate")(function* (
      cwd: string,
      name: string,
      options?: {
        readonly ref?: string;
        readonly message?: string;
        readonly force?: boolean;
      }
    ) {
      const { force = false, message, ref } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, name, ref: ref ?? "HEAD", force });
      yield* rejectOptionLikeRefs(cwd, withDefined([name], ref));
      return yield* runVoid("Git.tagCreate", GitCommand.tagCreate(name, ref, message, force), cwd, ref ?? name);
    })
  );

  const tagDelete: GitShape["tagDelete"] = dual(
    2,
    Effect.fn("Git.tagDelete")(function* (cwd: string, name: string) {
      yield* Effect.annotateCurrentSpan({ cwd, name });
      yield* rejectOptionLikeRefs(cwd, [name]);
      return yield* runVoid("Git.tagDelete", GitCommand.tagDelete(name), cwd, name);
    })
  );

  const tagList: GitShape["tagList"] = dual(
    hasStringSubject,
    Effect.fn("Git.tagList")(function* (
      cwd: string,
      options?: {
        readonly pattern?: string;
      }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd });
      yield* rejectOptionLikeRefs(cwd, options?.pattern !== undefined ? [options.pattern] : []);
      return yield* runParsed("Git.tagList", GitCommand.tagList(options?.pattern), cwd, "tags", "generic", (output) =>
        A.filter(Str.split("\n")(output), (line) => line.length > 0)
      );
    })
  );

  const forEachRef: GitShape["forEachRef"] = dual(
    hasStringSubject,
    Effect.fn("Git.forEachRef")(function* (cwd: string, options?: { readonly patterns?: ReadonlyArray<string> }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        patterns: (options?.patterns ?? []).length,
      });
      yield* rejectOptionLikeRefs(cwd, options?.patterns ?? []);
      return yield* runParsed(
        "Git.forEachRef",
        GitCommand.forEachRef(options?.patterns ?? []),
        cwd,
        "for-each-ref",
        "generic",
        parseForEachRef
      );
    })
  );

  const revList: GitShape["revList"] = dual(
    stringAt(1),
    Effect.fn("Git.revList")(function* (
      cwd: string,
      ref: string,
      options?: { readonly limit?: number; readonly firstParent?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        ref,
        firstParent: options?.firstParent ?? false,
      });
      yield* rejectOptionLikeRefs(cwd, [ref]);
      yield* rejectNonNaturalNumber(cwd, "a rev-list limit", options?.limit);
      return yield* runParsed(
        "Git.revList",
        GitCommand.revList(ref, options?.limit, options?.firstParent ?? false),
        cwd,
        ref,
        "generic",
        (output) => A.filter(Str.split("\n")(output), (line) => line.length > 0)
      );
    })
  );

  const commit: GitShape["commit"] = dual(
    stringAt(1),
    Effect.fn("Git.commit")(function* (
      cwd: string,
      message: string,
      options?: {
        readonly all?: boolean;
        readonly allowEmpty?: boolean;
        readonly amend?: boolean;
        readonly author?: string;
      }
    ) {
      const { all = false, allowEmpty = false, amend = false, author } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, amend });
      return yield* runVoid("Git.commit", GitCommand.commit(message, all, allowEmpty, amend, author), cwd, "HEAD");
    })
  );

  const push: GitShape["push"] = dual(
    hasStringSubject,
    Effect.fn("Git.push")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly refspec?: string;
        readonly force?: boolean;
        readonly forceWithLease?: boolean;
        readonly tags?: boolean;
        readonly setUpstream?: boolean;
      }
    ) {
      const {
        force = false,
        forceWithLease = false,
        refspec,
        remote = "origin",
        setUpstream = false,
        tags = false,
      } = options ?? {};
      // The remote is deliberately NOT annotated: it may be a URL.
      yield* Effect.annotateCurrentSpan({ cwd, refspec: refspec ?? "(current branch)", forceWithLease });
      yield* rejectOptionLikeRefs(cwd, withDefined([remote], refspec));
      const classified = yield* runForNetwork(
        GitCommand.push(remote, refspec, force, forceWithLease, tags, setUpstream),
        cwd,
        "push"
      );
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, refspec ?? "HEAD"),
        nonFastForward: () =>
          Effect.fail(NonFastForwardError.make({ cwd, ...O.getSomesStruct({ refspec: O.fromUndefinedOr(refspec) }) })),
      });
    })
  );

  const pull: GitShape["pull"] = dual(
    hasStringSubject,
    Effect.fn("Git.pull")(function* (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly ref?: string;
        readonly rebase?: boolean;
        readonly ffOnly?: boolean;
      }
    ) {
      const { ffOnly = false, rebase = false, ref, remote = "origin" } = options ?? {};
      // The remote is deliberately NOT annotated: it may be a URL.
      yield* Effect.annotateCurrentSpan({ cwd, ref: ref ?? "(upstream)", rebase });
      yield* rejectOptionLikeRefs(cwd, withDefined([remote], ref));
      const classified = yield* runForNetwork(GitCommand.pull(remote, ref, rebase, ffOnly), cwd, "merge");
      return yield* Match.valueTags(classified, {
        success: () => Effect.void,
        ...refFailureArms(cwd, ref ?? "(upstream)"),
        mergeConflict: () => Effect.fail(MergeConflictError.make({ cwd })),
        dirtyWorktree: () => Effect.fail(DirtyWorktreeError.make({ cwd })),
      });
    })
  );

  const configList: GitShape["configList"] = dual(
    hasStringSubject,
    Effect.fn("Git.configList")(function* (
      cwd: string,
      options?: { readonly file?: string; readonly scope?: GitConfigScope }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        file: options?.file ?? "(repository config)",
        scope: options?.scope ?? "(merged)",
      });
      yield* rejectOptionLikeRefs(cwd, options?.file !== undefined ? [options.file] : []);
      return yield* runParsed(
        "Git.configList",
        GitCommand.configList(options?.file, options?.scope),
        cwd,
        "config",
        "generic",
        parseConfigList
      );
    })
  );

  const configGetAll: GitShape["configGetAll"] = dual(
    stringAt(1),
    Effect.fn("Git.configGetAll")(function* (cwd: string, key: string, options?: { readonly file?: string }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        file: options?.file ?? "(repository config)",
      });
      yield* rejectOptionLikeRefs(cwd, [key, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runParsed(
        "Git.configGetAll",
        GitCommand.configGetAll(key, options?.file),
        cwd,
        key,
        "quiet",
        parseConfigGetAll
      );
    })
  );

  const configUnset: GitShape["configUnset"] = dual(
    stringAt(1),
    Effect.fn("Git.configUnset")(function* (
      cwd: string,
      key: string,
      options?: { readonly file?: string; readonly all?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        key,
        file: options?.file ?? "(repository config)",
      });
      yield* rejectOptionLikeRefs(cwd, [key, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runVoid(
        "Git.configUnset",
        GitCommand.configUnset(key, options?.file, options?.all ?? false),
        cwd,
        key
      );
    })
  );

  const configRemoveSection: GitShape["configRemoveSection"] = dual(
    stringAt(1),
    Effect.fn("Git.configRemoveSection")(function* (
      cwd: string,
      section: string,
      options?: { readonly file?: string }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        section,
        file: options?.file ?? "(repository config)",
      });
      // git config has no documented -- separator, so section AND file are both
      // guarded — the configSet/configUnset posture.
      yield* rejectOptionLikeRefs(cwd, [section, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runVoid(
        "Git.configRemoveSection",
        GitCommand.configRemoveSection(section, options?.file),
        cwd,
        section
      );
    })
  );

  const configRenameSection: GitShape["configRenameSection"] = dual(
    stringAt(2),
    Effect.fn("Git.configRenameSection")(function* (
      cwd: string,
      oldName: string,
      newName: string,
      options?: { readonly file?: string }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        oldName,
        newName,
        file: options?.file ?? "(repository config)",
      });
      yield* rejectOptionLikeRefs(cwd, [oldName, newName, ...(options?.file !== undefined ? [options.file] : [])]);
      return yield* runVoid(
        "Git.configRenameSection",
        GitCommand.configRenameSection(oldName, newName, options?.file),
        cwd,
        oldName
      );
    })
  );

  const rm: GitShape["rm"] = dual(
    hasStringSubject,
    Effect.fn("Git.rm")(function* (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly cached?: boolean;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        count: paths.length,
        cached: options?.cached ?? false,
      });
      return yield* runVoid(
        "Git.rm",
        GitCommand.rm(paths, options?.cached ?? false, options?.recursive ?? false, options?.force ?? false),
        cwd,
        "working tree"
      );
    })
  );

  const mv: GitShape["mv"] = dual(
    stringAt(2),
    Effect.fn("Git.mv")(function* (
      cwd: string,
      source: string,
      destination: string,
      options?: { readonly force?: boolean }
    ) {
      yield* Effect.annotateCurrentSpan({ cwd, source, destination });
      return yield* runVoid("Git.mv", GitCommand.mv(source, destination, options?.force ?? false), cwd, "working tree");
    })
  );

  const checkIgnore: GitShape["checkIgnore"] = dual(
    2,
    Effect.fn("Git.checkIgnore")(function* (cwd: string, paths: ReadonlyArray<string>) {
      yield* Effect.annotateCurrentSpan({ cwd, count: paths.length });
      return yield* runParsed(
        "Git.checkIgnore",
        GitCommand.checkIgnore(paths),
        cwd,
        "check-ignore",
        "quiet",
        parseNulSeparated
      );
    })
  );

  const worktreeAdd: GitShape["worktreeAdd"] = dual(
    stringAt(1),
    Effect.fn("Git.worktreeAdd")(function* (
      cwd: string,
      path: string,
      options?: {
        readonly ref?: string;
        readonly detach?: boolean;
        readonly force?: boolean;
      }
    ) {
      const { detach = false, force = false, ref } = options ?? {};
      yield* Effect.annotateCurrentSpan({ cwd, path, ref: ref ?? "(default)" });
      yield* rejectOptionLikeRefs(cwd, withDefined([path], ref));
      return yield* runVoid("Git.worktreeAdd", GitCommand.worktreeAdd(path, ref, detach, force), cwd, ref ?? path);
    })
  );

  const worktreeList = Effect.fn("Git.worktreeList")(function* (cwd: string) {
    yield* Effect.annotateCurrentSpan({ cwd });
    return yield* runParsed(
      "Git.worktreeList",
      GitCommand.worktreeList(),
      cwd,
      "worktrees",
      "generic",
      parseWorktreeList
    );
  });

  const worktreeRemove: GitShape["worktreeRemove"] = dual(
    stringAt(1),
    Effect.fn("Git.worktreeRemove")(function* (cwd: string, path: string, options?: { readonly force?: boolean }) {
      yield* Effect.annotateCurrentSpan({ cwd, path });
      yield* rejectOptionLikeRefs(cwd, [path]);
      return yield* runVoid("Git.worktreeRemove", GitCommand.worktreeRemove(path, options?.force ?? false), cwd, path);
    })
  );

  const lsFiles: GitShape["lsFiles"] = dual(
    hasStringSubject,
    Effect.fn("Git.lsFiles")(function* (cwd: string, options?: { readonly pathspec?: ReadonlyArray<string> }) {
      yield* Effect.annotateCurrentSpan({
        cwd,
        patterns: (options?.pathspec ?? []).length,
      });
      return yield* runParsed(
        "Git.lsFiles",
        GitCommand.lsFiles(options?.pathspec ?? []),
        cwd,
        "index",
        "generic",
        parseLsFiles
      );
    })
  );

  return {
    add,
    branchCreate,
    branchDelete,
    branchList,
    changedFiles,
    checkIgnore,
    checkout,
    clean,
    commit,
    commitInfo,
    commonDir,
    configGet,
    configGetAll,
    configList,
    configRemoveSection,
    configRenameSection,
    configSet,
    configUnset,
    currentBranch,
    defaultBranch,
    fetch,
    fetchAny,
    fetchUnshallow,
    forEachRef,
    isShallow,
    log,
    lsFiles,
    lsRemote,
    lsTree,
    mergeBase,
    mergeBaseOption,
    mv,
    nameStatus,
    pull,
    push,
    refExists,
    remoteAdd,
    remoteRemove,
    remoteSetUrl,
    remoteUrl,
    repoRoot,
    reset,
    restore,
    revList,
    revParse,
    rm,
    show,
    sparseCheckoutSet,
    stagedChanges,
    stashApply,
    stashDrop,
    stashList,
    stashPop,
    stashPush,
    status,
    submoduleAbsorbgitdirs,
    submoduleAdd,
    submoduleDeinit,
    submoduleForeach,
    submoduleInit,
    submoduleSetBranch,
    submoduleSetUrl,
    submoduleStatus,
    submoduleSync,
    submoduleUpdate,
    tagCreate,
    tagDelete,
    tagList,
    unstagedChanges,
    untrackedFiles,
    workingChanges,
    worktreeAdd,
    worktreeList,
    worktreeRemove,
  };
});

/**
 * The {@link Git} service shape.
 *
 * **Details**
 *
 * Exported so a consumer can type a variable, field or test fake holding the
 * service without re-declaring the surface — `Layer.succeed(Git, fake)`
 * accepts any `GitShape`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface GitShape {
  /**
   * Mutating: `git add -- <paths...>` — stages `paths` in the index for
   * the next commit.
   */
  readonly add: {
    (
      cwd: string,
      paths: ReadonlyArray<string>
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git branch [-f] <name> [<start-point>]` — creates a branch,
   * optionally from `options.startPoint`; `options.checkout` switches to it
   * on creation (`git checkout -b <name> [<start-point>]`), and
   * `options.force` resets the branch if it already exists (`branch -f`,
   * or `checkout -B` with `checkout`).
   *
   * **Details**
   *
   * Branch creation is a branch-member concern, not a `checkout` option:
   * `checkout`'s contract stays "move to an existing ref" with its
   * option-like-ref refusal intact. Both `name` and `startPoint` are
   * guarded — an option-like value is refused typed before any spawn.
   *
   * `force` with `checkout` replaces the delete-then-create longhand — a
   * swallowed `branchDelete(force: true)` followed by a plain create —
   * which papers over a real edge: `git branch -D` refuses to delete the
   * currently checked-out branch, so on a runner already sitting on that
   * branch the swallowed delete fails and the create then fails for real.
   * `checkout -B` handles both states in one invocation.
   */
  readonly branchCreate: {
    (
      cwd: string,
      name: string,
      options?: {
        readonly startPoint?: string;
        readonly checkout?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      options?: {
        readonly startPoint?: string;
        readonly checkout?: boolean;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git branch -d <name>` (or `-D` with `options.force`) —
   * deletes a local branch. The default `-d` refuses a branch that is not
   * fully merged — a typed `GitCommandError`, which is usually the honest
   * answer; `force: true` deletes regardless.
   */
  readonly branchDelete: {
    (
      cwd: string,
      name: string,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git branch --list [--remotes | --all]` — every branch as a
   * {@link BranchEntry} (short name, tip sha, current marker), via the
   * NUL-separated for-each-ref format. `all` wins when both flags are set.
   */
  readonly branchList: {
    (
      cwd: string,
      options?: { readonly remotes?: boolean; readonly all?: boolean }
    ): Effect.Effect<ReadonlyArray<BranchEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remotes?: boolean;
      readonly all?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<BranchEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --name-only -z [--relative] <base>...<head>` — the paths that
   * differ. Pass `relative: true` to report paths relative to `cwd` and
   * exclude changes outside it (a workspace nested in a larger repository).
   */
  readonly changedFiles: {
    (
      cwd: string,
      options: {
        readonly base: string;
        readonly head: string;
        readonly relative?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly base: string;
      readonly head: string;
      readonly relative?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git check-ignore -z --stdin` — the subset of `paths` git would ignore,
   * predicate-shaped: paths in, the ignored ones back. Paths are fed via
   * STDIN (NUL-separated both directions), so nothing caller-controlled
   * enters the argv and special-character paths survive unquoted. No path
   * ignored degrades to the empty array, never an error.
   */
  readonly checkIgnore: {
    (
      cwd: string,
      paths: ReadonlyArray<string>
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>
    ): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git checkout [--detach] <ref>` — moves the working tree
   * (and, for a branch ref, `HEAD`) to `ref`; `options.detach` checks it out
   * in detached-HEAD state instead of updating a branch.
   * Real git reports an unknown ref to checkout as a pathspec error, which
   * classifies as `GitCommandError` rather than `UnknownRefError`; the
   * `UnknownRefError` arm remains declared for the stderr shapes that do match.
   */
  readonly checkout: {
    (
      cwd: string,
      ref: string,
      options?: { readonly detach?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly detach?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git clean --force [-d] [-x] [-- <paths>...]` — deletes
   * untracked files (and, with `options.directories`, untracked directories;
   * with `options.ignored`, ignored files too), optionally scoped to
   * `options.paths`.
   *
   * **Details**
   *
   * `--force` is unconditional: this member exists so a consumer can restore
   * a tree to a known state before retrying a non-idempotent operation, and
   * without it git refuses to clean under the default `clean.requireForce`
   * config — **a clean that silently did nothing corrupts the retry**. Any
   * non-zero exit fails loudly as `GitCommandError`.
   */
  readonly clean: {
    (
      cwd: string,
      options?: {
        readonly directories?: boolean;
        readonly ignored?: boolean;
        readonly paths?: ReadonlyArray<string>;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly directories?: boolean;
      readonly ignored?: boolean;
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git commit [--all] [--allow-empty] [--amend] [--author=<author>] -m <message>`
   * — records a commit. The message rides argv; committer identity comes
   * from the caller's ENVIRONMENT (the pins this service applies are the
   * locale and the non-interactive set — never an identity), and
   * `options.author` is the explicit `--author=`
   * override. "Nothing to commit" fails loudly as {@link GitCommandError}.
   */
  readonly commit: {
    (
      cwd: string,
      message: string,
      options?: {
        readonly all?: boolean;
        readonly allowEmpty?: boolean;
        readonly amend?: boolean;
        readonly author?: string;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      message: string,
      options?: {
        readonly all?: boolean;
        readonly allowEmpty?: boolean;
        readonly amend?: boolean;
        readonly author?: string;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git log -1 --format=%H%x00%G?%x00%B <ref>` — a single commit's sha,
   * signature verdict and raw (untrimmed) message. `ref` defaults to `HEAD`.
   */
  readonly commitInfo: (
    cwd: string,
    ref?: string
  ) => Effect.Effect<CommitInfo, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * `git rev-parse --path-format=absolute --git-common-dir` — the absolute,
   * symlink-resolved directory a repository shares with all of its linked
   * worktrees, with git's terminating newline removed.
   *
   * **Details**
   *
   * Repository identity that holds across worktrees: every checkout of one
   * repository — the main worktree, any subdirectory, any linked worktree,
   * and any path reached through a symlink — answers the same string, so two
   * results compare with `===`. `repoRoot` cannot serve here, because each
   * worktree has its own toplevel. A bare repository answers its own
   * directory. Only git's terminating newline is removed, so a path ending in
   * whitespace keeps it.
   *
   * Needs git 2.31 or later. An older git echoes the unknown
   * `--path-format` flag and exits 0; that answer fails as a
   * `GitCommandError` (`kind: "failed"`) rather than passing as an identity.
   */
  readonly commonDir: (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError>;
  /**
   * `git config [--<scope>] --get <key>` — the trimmed value, or `Option.none`
   * when the key is unset.
   *
   * **Details**
   *
   * With no `scope` this reads the MERGED configuration, so a globally set key
   * answers here even when this repository declares nothing. Pass
   * `{ scope: "local" }` to ask what this checkout itself declares — see
   * `Git.configList` for why the distinction matters.
   */
  readonly configGet: {
    (
      cwd: string,
      key: string,
      options?: { readonly scope?: GitConfigScope }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      options?: { readonly scope?: GitConfigScope }
    ): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git config [-f <file>] --get-all -z <key>` — every value of a
   * (possibly multi-valued) key, in order. An unset key degrades to the
   * empty array, never an error — the multi-valued sibling of `configGet`'s
   * `Option.none`.
   */
  readonly configGetAll: {
    (
      cwd: string,
      key: string,
      options?: { readonly file?: string }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git config [-f <file>] [--<scope>] --list -z` — every configuration entry
   * in scope (or in `options.file` only) as {@link ConfigListEntry} values.
   * `-z` keeps multi-line values lossless.
   *
   * **Gotchas**
   *
   * **With no `scope`, this reads the MERGED configuration** — repository-local
   * plus global plus system. That is right for "what is the effective value"
   * and wrong for "what does this checkout declare": a globally set key
   * otherwise shadows a decision that is really about one repository, and an
   * enumerate-then-remove flow reads more broadly than
   * `Git.configRemoveSection` writes, which defaults to the local file.
   * Pass `{ scope: "local" }` for the precise read.
   *
   * `file` and `scope` both select a source and git accepts only one — passing
   * both fails typed as a {@link GitCommandError} rather than silently
   * preferring either.
   */
  readonly configList: {
    (
      cwd: string,
      options?: { readonly file?: string; readonly scope?: GitConfigScope }
    ): Effect.Effect<ReadonlyArray<ConfigListEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly file?: string;
      readonly scope?: GitConfigScope;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<ConfigListEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] --remove-section <section>` — removes
   * a whole configuration section (every key under it, and the header) from
   * the live config, or from `options.file`. The section-level sibling of
   * `configUnset` — clearing a stale `submodule.<name>` registration is one
   * invocation instead of a key-by-key probe-and-unset. Removing a section
   * that does not exist fails LOUDLY (git exits 128,
   * `fatal: no such section`) — the `configUnset` posture; probe with
   * `configList` first when idempotency is wanted.
   */
  readonly configRemoveSection: {
    (
      cwd: string,
      section: string,
      options?: { readonly file?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      section: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] --rename-section <old> <new>` —
   * renames a configuration section, carrying every key under it across.
   * Renaming a section that does not exist fails LOUDLY (git exits 128,
   * `fatal: no such section`) — the same posture as `configRemoveSection`.
   */
  readonly configRenameSection: {
    (
      cwd: string,
      oldName: string,
      newName: string,
      options?: { readonly file?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      oldName: string,
      newName: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] <key> <value>` — writes `value` for
   * `key` into the repository config, or into `options.file` when given
   * (e.g. `.gitmodules`).
   *
   * **Details**
   *
   * **The write is repository-LOCAL, always.** A bare
   * `git config <key> <value>` writes the checkout's own `.git/config`, and
   * this method emits no scope flag, so the setting applies to every later git
   * command in that checkout and reaches nothing outside it. That asymmetry with
   * `Git.configList` and `Git.configGet` — whose omitted `scope`
   * means the MERGED read — is deliberate rather than an oversight: a read
   * has a defensible "effective value" default, and a write does not. Writing
   * global or system config would leak a setting onto a shared machine or a
   * CI runner for every unrelated step in the job, so it is not offered here
   * at all rather than hidden behind an option that is easy to pass by
   * accident.
   *
   * The value never surfaces in an error: a failing `configSet` carries
   * `<redacted>` in `GitCommandError.args` and `.message`, and the method's
   * span annotates `key` and `file` only.
   */
  readonly configSet: {
    (
      cwd: string,
      key: string,
      value: string,
      options?: { readonly file?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      value: string,
      options?: { readonly file?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git config [-f <file>] (--unset | --unset-all) <key>` —
   * removes `key` (or, with `options.all`, every value of a multi-valued
   * key). Unsetting a key that was never set fails LOUDLY (git exits 5) —
   * an unset that silently did nothing is indistinguishable from one that
   * worked; probe with `configGet` first when idempotency is wanted.
   */
  readonly configUnset: {
    (
      cwd: string,
      key: string,
      options?: { readonly file?: string; readonly all?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      key: string,
      options?: { readonly file?: string; readonly all?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --abbrev-ref HEAD` — the current branch name, or
   * `Option.none` when `HEAD` is detached (the literal answer `"HEAD"`
   * degrades to the typed absence rather than a fake branch name).
   */
  readonly currentBranch: (
    cwd: string
  ) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * `git symbolic-ref --quiet --short refs/remotes/<remote>/HEAD` — the
   * bare branch name, remote prefix stripped, or `Option.none` when the
   * remote's HEAD is unset — run `git remote set-head` to set it.
   */
  readonly defaultBranch: {
    (
      cwd: string,
      options?: { readonly remote?: string }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remote?: string;
    }): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git fetch [--depth <n>] [--unshallow] <remote> [tag] <ref>` —
   * fetches `options.ref` from `options.remote` (default `origin`) into the
   * local object database, optionally shallow (`options.depth`), unshallowing
   * (`options.unshallow`), and/or as a tag (`options.tag`). A ref the remote
   * does not have surfaces as `UnknownRefError` — the typed signal a
   * tag-then-branch fetch fallback can branch on.
   *
   * **Details**
   *
   * `options.ref` also accepts a full refspec (`src:dst`, optionally
   * `+`-prefixed), passed through verbatim — never guessed at or
   * transformed. Under a single-branch clone (`actions/checkout`'s default
   * `fetch-depth: 1` shape) a bare-ref fetch updates only `FETCH_HEAD` and
   * never creates the remote-tracking ref, so
   * `+refs/heads/<b>:refs/remotes/origin/<b>` is the spelling that
   * materializes `origin/<b>`.
   *
   * `options.unshallow` follows `fetchUnshallow`'s caller-guards rule: git
   * rejects `--unshallow` in a non-shallow repository (a loud
   * `GitCommandError`, deliberately untolerated) — probe with `isShallow`
   * first. Combining it with `options.depth` is refused typed, pre-spawn,
   * exactly as git itself would reject the pair.
   */
  readonly fetch: {
    (
      cwd: string,
      options: {
        readonly ref: string;
        readonly remote?: string;
        readonly depth?: number;
        readonly tag?: boolean;
        readonly unshallow?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly ref: string;
      readonly remote?: string;
      readonly depth?: number;
      readonly tag?: boolean;
      readonly unshallow?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: fetches `options.ref` from `options.remote` (default
   * `origin`) without knowing whether it names a tag — the tag form
   * (`git fetch [--depth <n>] <remote> tag <ref>`) runs first, and when it
   * fails as `UnknownRefError` (the typed "not a tag on the remote"
   * signal) or any `GitCommandError`, the plain form
   * (`git fetch [--depth <n>] <remote> <ref>`) runs as the fallback.
   *
   * **Details**
   *
   * `NotARepositoryError` from the tag attempt propagates immediately —
   * the plain form would fail identically. When both attempts fail, the
   * PLAIN fetch's error surfaces; the tag attempt's failure is discarded.
   */
  readonly fetchAny: {
    (
      cwd: string,
      options: {
        readonly ref: string;
        readonly remote?: string;
        readonly depth?: number;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly ref: string;
      readonly remote?: string;
      readonly depth?: number;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git fetch --unshallow <remote>` — converts a shallow clone
   * into a complete one by fetching all missing history from
   * `options.remote` (default `origin`).
   *
   * **Details**
   *
   * `--unshallow` is a distinct mode, not a depth value: **git rejects it in
   * a repository that is not shallow**, with
   * `--unshallow on a complete repository does not make sense` — and this
   * method deliberately does NOT tolerate that; the failure surfaces typed
   * as `GitCommandError`, because swallowing it would also swallow every
   * other fetch failure shape. The caller owns the guard: probe with
   * `isShallow` first and skip the fetch when the repository is already
   * complete.
   */
  readonly fetchUnshallow: {
    (
      cwd: string,
      options?: { readonly remote?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remote?: string;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git for-each-ref [<patterns>...]` — every matching ref as a
   * {@link RefEntry} (full refname, sha, object type), via this package's
   * fixed `%(refname)%00%(objectname)%00%(objecttype)` format.
   */
  readonly forEachRef: {
    (
      cwd: string,
      options?: { readonly patterns?: ReadonlyArray<string> }
    ): Effect.Effect<ReadonlyArray<RefEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly patterns?: ReadonlyArray<string>;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<RefEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --is-shallow-repository` — whether the repository is a
   * shallow clone.
   *
   * **Details**
   *
   * A dedicated predicate, deliberately not folded into `revParse`: that
   * method's contract is "resolve this REF"; this one takes no ref and
   * answers a repository-shape question. The intended pairing is
   * `isShallow` → `fetchUnshallow`.
   */
  readonly isShallow: (cwd: string) => Effect.Effect<boolean, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * `git log -z --format=... --name-only [flags] [-- pathspec]` — the commit
   * history reachable from `HEAD`, newest first, each entry carrying its sha,
   * both dates, its author identity and the paths it touched. The full argv,
   * flag by flag, is on `GitCommand.log`.
   *
   * **Details**
   *
   * Scoped by `paths` (a git pathspec, relative to `cwd`) and, with
   * `follow: true`, walked ACROSS renames — git's `--follow`, which requires
   * exactly one path and is refused pre-spawn as a `"refused"`
   * `GitCommandError` otherwise. `limit` becomes `--max-count`, so
   * `limit: 0` is the empty listing rather than the whole history. A merge
   * commit contributes an entry with EMPTY `paths` unless
   * `firstParentDiffMerges` is set, which asks git for the first-parent diff
   * and so lists a merge that actually changed something (a conflict
   * resolution) while still hiding one TREESAME to its first parent.
   * **`follow: true` and merge commits do not combine**: `--follow`
   * linearizes the walk and drops merges outright (probed against git 2.54),
   * so a followed listing is not a superset of the unfollowed one — it trades
   * the merges away for the pre-rename history.
   *
   * An unborn `HEAD` and a pathspec no commit ever touched are both the
   * EMPTY listing, not a failure — which is why `UnknownRefError` is absent
   * from this member's error union while every other read carries it. This
   * is the one read whose result depends on the ORDER of history rather than
   * a single tree, and the one that decodes dates: see `CommitLogEntry` for
   * what the UTC decoding does and does not preserve.
   */
  readonly log: {
    (
      cwd: string,
      options?: {
        /** A git pathspec scoping the walk; `--follow` requires exactly one entry. */
        readonly paths?: ReadonlyArray<string>;
        /** Follow the single path across renames (git's `--follow`). Default `false`. */
        readonly follow?: boolean;
        /** `--max-count`: at most this many commits. `0` is the empty listing. */
        readonly limit?: number;
        /** `--diff-merges=first-parent`: give merge commits a path listing. Default `false`. */
        readonly firstParentDiffMerges?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<CommitLogEntry>, GitCommandError | NotARepositoryError>;
    (options?: {
      /** A git pathspec scoping the walk; `--follow` requires exactly one entry. */
      readonly paths?: ReadonlyArray<string>;
      /** Follow the single path across renames (git's `--follow`). Default `false`. */
      readonly follow?: boolean;
      /** `--max-count`: at most this many commits. `0` is the empty listing. */
      readonly limit?: number;
      /** `--diff-merges=first-parent`: give merge commits a path listing. Default `false`. */
      readonly firstParentDiffMerges?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<CommitLogEntry>, GitCommandError | NotARepositoryError>;
  };
  /**
   * `git ls-files --stage -z [-- <pathspec>...]` — every INDEX entry as an
   * {@link LsFilesEntry} (mode, oid, merge stage, path), optionally scoped
   * to `options.pathspec`.
   *
   * **Details**
   *
   * The index-side sibling of `lsTree`: the only read that sees a
   * staged-but-uncommitted gitlink (`160000 <oid> 0 <path>`) — the state a
   * stage-without-commit window (a submodule pin/add) deliberately
   * produces, which a HEAD-side `lsTree` misreports.
   */
  readonly lsFiles: {
    (
      cwd: string,
      options?: { readonly pathspec?: ReadonlyArray<string> }
    ): Effect.Effect<ReadonlyArray<LsFilesEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly pathspec?: ReadonlyArray<string>;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<LsFilesEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git ls-remote [--heads] [--tags] <remote> [<patterns>...]` — the refs
   * `remote` advertises, as {@link LsRemoteEntry} values, optionally
   * filtered to branch heads and/or tags and/or shell-glob patterns.
   *
   * **Details**
   *
   * The one read that talks to the NETWORK. Auth failure and an unreachable
   * remote stay {@link GitCommandError} deliberately — no consumer branches
   * on them, so they carry no dedicated type. The validate-before-mutate
   * consumer story: look for the wanted ref in the listing, and on a miss
   * hand the entries to `LsRemoteEntry.nearMatches` for a suggestion (the
   * monorepo-prefixed-tag case, `effect@<ref>`). `remote` may be a URL; an
   * embedded credential never surfaces in an error value.
   */
  readonly lsRemote: {
    (
      cwd: string,
      remote: string,
      options?: {
        readonly heads?: boolean;
        readonly tags?: boolean;
        readonly patterns?: ReadonlyArray<string>;
      }
    ): Effect.Effect<ReadonlyArray<LsRemoteEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      remote: string,
      options?: {
        readonly heads?: boolean;
        readonly tags?: boolean;
        readonly patterns?: ReadonlyArray<string>;
      }
    ): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<LsRemoteEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git ls-tree -r -z <ref> [-- <pathspec>...]` — every path in the tree at
   * `ref`, recursively, optionally scoped to `pathspec`.
   */
  readonly lsTree: {
    (
      cwd: string,
      ref: string,
      options?: { readonly pathspec?: ReadonlyArray<string> }
    ): Effect.Effect<ReadonlyArray<LsTreeEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly pathspec?: ReadonlyArray<string> }
    ): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<LsTreeEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git merge-base <a> <b>` — the best common ancestor commit, trimmed.
   * For when absence is EXCEPTIONAL: two refs with no common ancestor fail
   * loudly as `GitCommandError` (git's silent exit 1 rides the generic
   * failure arm). When "no common ancestor" is a legitimate answer at your
   * call site — a reachability probe — use `mergeBaseOption` instead.
   */
  readonly mergeBase: {
    (cwd: string, a: string, b: string): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      a: string,
      b: string
    ): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git merge-base <a> <b>` — the best common ancestor commit, trimmed, as
   * a PROBE: two refs with no common ancestor (disjoint histories — a
   * grafted CI clone, an orphan branch) answer `Option.none`, never an
   * error, because git signals that case as a silent exit 1. An unknown ref
   * is still a real failure (`UnknownRefError`), and a noisy exit 1 stays a
   * loud `GitCommandError`. The sibling of `mergeBase`, which fails loudly
   * when the ancestor is absent.
   *
   * **Details**
   *
   * The value is a plain sha string — no decode or brand step. A caller
   * that only wants reachability ("do these histories connect?") reads the
   * boolean directly: `Option.isSome(yield* git.mergeBaseOption(cwd, a, b))`.
   */
  readonly mergeBaseOption: {
    (
      cwd: string,
      a: string,
      b: string
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      a: string,
      b: string
    ): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git mv [--force] -- <source> <destination>` — moves or
   * renames a tracked path, updating the index and the working tree
   * together.
   */
  readonly mv: {
    (
      cwd: string,
      source: string,
      destination: string,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      source: string,
      destination: string,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git diff --name-status -z [--relative] [<base> | <base>...<head>]` —
   * the changed paths with their status codes. `head` omitted diffs the
   * working tree against `base`; `head` present diffs the merge-base range.
   */
  readonly nameStatus: {
    (
      cwd: string,
      options: {
        readonly base: string;
        readonly head?: string;
        readonly relative?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<NameStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly base: string;
      readonly head?: string;
      readonly relative?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<NameStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git pull [--rebase] [--ff-only] <remote> [<ref>]` — fetches
   * and integrates.
   *
   * **Details**
   *
   * The two branchable failures are typed: {@link DirtyWorktreeError} when
   * local modifications block the merge before it starts (the tree is
   * untouched — commit or stash first), and {@link MergeConflictError} when
   * the merge stopped on conflicts (markers are in the tree; resolve or
   * abort). `remote` may be a URL; an embedded credential never surfaces in
   * an error value.
   */
  readonly pull: {
    (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly ref?: string;
        readonly rebase?: boolean;
        readonly ffOnly?: boolean;
      }
    ): Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
    (options?: {
      readonly remote?: string;
      readonly ref?: string;
      readonly rebase?: boolean;
      readonly ffOnly?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
  };
  /**
   * Mutating: `git push [--force | --force-with-lease] [--tags] [--set-upstream] <remote> [<refspec>]`
   * — updates remote refs.
   *
   * **Details**
   *
   * A rejected push — the remote moved (`fetch first` /
   * `non-fast-forward`), or a `--force-with-lease` lease failure
   * (`stale info`) — fails typed as {@link NonFastForwardError}, the signal
   * a fetch-then-retry fallback branches on. Every other failure stays
   * {@link GitCommandError}. `remote` may be a URL; an embedded credential
   * never surfaces in an error value.
   */
  readonly push: {
    (
      cwd: string,
      options?: {
        readonly remote?: string;
        readonly refspec?: string;
        readonly force?: boolean;
        readonly forceWithLease?: boolean;
        readonly tags?: boolean;
        readonly setUpstream?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError | NonFastForwardError>;
    (options?: {
      readonly remote?: string;
      readonly refspec?: string;
      readonly force?: boolean;
      readonly forceWithLease?: boolean;
      readonly tags?: boolean;
      readonly setUpstream?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError | NonFastForwardError>;
  };
  /** `git cat-file -e <ref>` — whether `ref` resolves to an existing object. */
  readonly refExists: {
    (cwd: string, ref: string): Effect.Effect<boolean, GitCommandError | NotARepositoryError>;
    (ref: string): (cwd: string) => Effect.Effect<boolean, GitCommandError | NotARepositoryError>;
  };
  /**
   * Mutating: `git remote add <name> <url>` — registers a new remote.
   * `url`'s embedded credential (if any) never surfaces in an error value,
   * and the method's span annotates `name` only.
   */
  readonly remoteAdd: {
    (
      cwd: string,
      name: string,
      url: string
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      url: string
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git remote remove <name>` — deletes a remote, its
   * remote-tracking refs and its configuration. A missing remote fails
   * loudly as {@link GitCommandError} — probe with `remoteUrl` first when
   * idempotency is wanted.
   */
  readonly remoteRemove: {
    (cwd: string, name: string): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (name: string): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git remote set-url <name> <url>` — rewrites a remote's fetch
   * URL. `url`'s embedded credential (if any) never surfaces in an error
   * value, and the method's span annotates `name` only.
   */
  readonly remoteSetUrl: {
    (
      cwd: string,
      name: string,
      url: string
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      url: string
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git remote get-url <remote>` — the trimmed URL, or `Option.none` when the remote does not exist. */
  readonly remoteUrl: {
    (
      cwd: string,
      options?: { readonly remote?: string }
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly remote?: string;
    }): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-parse --show-toplevel` — the absolute repository root path, trimmed.
   *
   * **Gotchas**
   *
   * The path is PHYSICAL: git resolves symlinks, so it need not match the
   * spelling the caller reached the repository by (every macOS tmpdir:
   * `/var` → `/private/var`). Bound an upward walk by it with
   * `@beep/walker`'s `Walker.ascendWithin`, never `Walker.ascend`'s
   * lexical `stopAt`. For identity across worktrees, use `commonDir`.
   */
  readonly repoRoot: (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git reset --soft|--mixed|--hard [<ref>]` — moves `HEAD` (and,
   * per `options.mode`, the index and working tree) to `options.ref`
   * (default `HEAD`, i.e. unstage/discard against the current commit).
   *
   * **Details**
   *
   * The restore-before-retry primitive: **a failed reset fails loudly and
   * typed** (`GitCommandError` on any non-zero exit), never a silent no-op —
   * a reset that silently did nothing would hand a retry of a
   * non-idempotent operation the same dirty tree. `mode` defaults to
   * `"mixed"` (git's own default), emitted explicitly in the argv.
   *
   * `mode: "hard"` is destructive and legitimately reached for: after
   * committing through an out-of-band channel (e.g. the GitHub Data API,
   * which writes the commit server-side), `reset --hard origin/<branch>`
   * is how the local tree is synchronized to the commit it never made.
   */
  readonly reset: {
    (
      cwd: string,
      options?: {
        readonly mode?: "soft" | "mixed" | "hard";
        readonly ref?: string;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly mode?: "soft" | "mixed" | "hard";
      readonly ref?: string;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git restore [--source <ref>] [--staged] [--worktree] -- <paths...>`
   * — restores `paths` from the index, or from `options.source`. The
   * `checkout -- .`-shaped operation: `restore(cwd, ["."])` discards all
   * unstaged working-tree changes.
   *
   * **Details**
   *
   * A separate member deliberately, because `checkout`'s option-injection
   * guard refuses `--` and option-like refs by design and stays that way.
   * `restore`'s paths always sit behind a literal `--`, so they are
   * injection-safe by construction; only `options.source` is a guarded ref.
   * With neither `staged` nor `worktree` set, git restores the working tree.
   */
  readonly restore: {
    (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly source?: string;
        readonly staged?: boolean;
        readonly worktree?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>,
      options?: {
        readonly source?: string;
        readonly staged?: boolean;
        readonly worktree?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git rev-list [--max-count=<n>] [--first-parent] <ref>` — the commit
   * shas reachable from `ref` (which may be a range, `main..feat`), newest
   * first. A non-integer `options.limit` is refused typed before any spawn.
   */
  readonly revList: {
    (
      cwd: string,
      ref: string,
      options?: { readonly limit?: number; readonly firstParent?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      options?: { readonly limit?: number; readonly firstParent?: boolean }
    ): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git rev-parse --verify <ref>` — resolves `ref` to its full object id, trimmed. */
  readonly revParse: {
    (cwd: string, ref: string): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (ref: string): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git rm [--cached] [-r] [--force] -- <paths...>` — removes
   * `paths` from the index and (without `options.cached`) the working tree.
   * `cached: true` is the unstage-but-keep-file form a submodule removal
   * sequence needs.
   */
  readonly rm: {
    (
      cwd: string,
      paths: ReadonlyArray<string>,
      options?: {
        readonly cached?: boolean;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      paths: ReadonlyArray<string>,
      options?: {
        readonly cached?: boolean;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git show <ref>:<path>` — the contents of `path` at `ref`, or `Option.none` if absent there. */
  readonly show: {
    (
      cwd: string,
      ref: string,
      path: string
    ): Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      ref: string,
      path: string
    ): (cwd: string) => Effect.Effect<O.Option<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git sparse-checkout set (--cone | --no-cone) <patterns...>`
   * — rewrites which paths are checked out in the working tree to
   * `patterns`, in cone mode or full pattern mode per `options.cone`.
   */
  readonly sparseCheckoutSet: {
    (
      cwd: string,
      patterns: ReadonlyArray<string>,
      options: { readonly cone: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      patterns: ReadonlyArray<string>,
      options: { readonly cone: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git diff --name-only -z [--relative] --cached` — the staged paths. */
  readonly stagedChanges: {
    (
      cwd: string,
      options?: { readonly relative?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git stash apply [stash@{n}]` — applies a stash entry and
   * keeps it on the stack. Fails exactly like `stashPop`
   * ({@link DirtyWorktreeError} / {@link MergeConflictError} are the
   * branchable shapes).
   */
  readonly stashApply: {
    (
      cwd: string,
      options?: { readonly index?: number }
    ): Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
    (options?: {
      readonly index?: number;
    }): (
      cwd: string
    ) => Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
  };
  /**
   * Mutating: `git stash drop [stash@{n}]` — deletes a stash entry
   * (`options.index`, default the latest) without applying it.
   */
  readonly stashDrop: {
    (
      cwd: string,
      options?: { readonly index?: number }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly index?: number;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git stash list -z --format=%gd%x1f%H%x1f%gs` — every stash entry as a
   * {@link StashEntry} (reflog selector, sha, subject). The entry's
   * position in the returned array IS its current index — `entries[2]` is
   * `stash@{2}` — which is what the index-taking stash methods consume.
   */
  readonly stashList: (
    cwd: string
  ) => Effect.Effect<ReadonlyArray<StashEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git stash pop [stash@{n}]` — applies a stash entry
   * (`options.index`, default the latest) and drops it on success.
   *
   * **Details**
   *
   * The two branchable failures are typed: {@link DirtyWorktreeError} when
   * local changes would be overwritten (the tree is untouched), and
   * {@link MergeConflictError} when the apply stopped on conflicts — in
   * that case the stash entry is KEPT, and the caller owns resolving. A
   * non-integer index is refused typed before any spawn.
   */
  readonly stashPop: {
    (
      cwd: string,
      options?: { readonly index?: number }
    ): Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
    (options?: {
      readonly index?: number;
    }): (
      cwd: string
    ) => Effect.Effect<
      void,
      GitCommandError | NotARepositoryError | UnknownRefError | MergeConflictError | DirtyWorktreeError
    >;
  };
  /**
   * Mutating: `git stash push [--include-untracked] [-m <message>] [-- <paths>...]`
   * — saves the working-tree (and index) state onto the stash stack and
   * resets the tree to `HEAD`.
   */
  readonly stashPush: {
    (
      cwd: string,
      options?: {
        readonly message?: string;
        readonly includeUntracked?: boolean;
        readonly paths?: ReadonlyArray<string>;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly message?: string;
      readonly includeUntracked?: boolean;
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git status --porcelain -z` — the working tree's porcelain status listing. */
  readonly status: (
    cwd: string
  ) => Effect.Effect<ReadonlyArray<StatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git submodule absorbgitdirs [-- <paths>...]` — moves each
   * submodule's embedded `.git` directory into the superproject's
   * `.git/modules/` and leaves a gitfile pointer behind.
   */
  readonly submoduleAbsorbgitdirs: {
    (
      cwd: string,
      options?: { readonly paths?: ReadonlyArray<string> }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule add [--depth <n>] -- <url> <path>` —
   * registers and initializes a new submodule at `options.path`, cloned
   * from `options.url`, optionally shallow.
   */
  readonly submoduleAdd: {
    (
      cwd: string,
      options: {
        readonly url: string;
        readonly path: string;
        readonly depth?: number;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly url: string;
      readonly path: string;
      readonly depth?: number;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule deinit [--force] (--all | -- <paths>...)` —
   * unregisters submodules: clears their working trees and removes their
   * `.git/config` registration. Requires either `options.paths` or
   * `options.all: true`; neither is refused typed before any spawn, exactly
   * as git itself would refuse it. `options.force` discards local changes
   * in the submodule working tree.
   */
  readonly submoduleDeinit: {
    (
      cwd: string,
      options: {
        readonly paths?: ReadonlyArray<string>;
        readonly all?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options: {
      readonly paths?: ReadonlyArray<string>;
      readonly all?: boolean;
      readonly force?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule foreach [--recursive] <command>` — runs one
   * shell command string in every checked-out submodule and returns the
   * collected stdout. The command can mutate anything, which is why the
   * method is marked mutating regardless of what it runs; a command
   * beginning with `-` is refused typed before any spawn.
   */
  readonly submoduleForeach: {
    (
      cwd: string,
      command: string,
      options?: { readonly recursive?: boolean }
    ): Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      command: string,
      options?: { readonly recursive?: boolean }
    ): (cwd: string) => Effect.Effect<string, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule init [-- <paths>...]` — registers submodules
   * from `.gitmodules` into `.git/config` (all of them, or only
   * `options.paths`) without cloning or checking anything out.
   */
  readonly submoduleInit: {
    (
      cwd: string,
      options?: { readonly paths?: ReadonlyArray<string> }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule set-branch (--branch <branch> | --default) -- <path>`
   * — records the branch the submodule tracks in `.gitmodules`, or clears
   * it back to the default when `options.branch` is omitted.
   */
  readonly submoduleSetBranch: {
    (
      cwd: string,
      path: string,
      options?: { readonly branch?: string }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      options?: { readonly branch?: string }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule set-url -- <path> <url>` — rewrites the
   * submodule's URL in `.gitmodules` and synchronizes it into `.git/config`.
   *
   * **Details**
   *
   * The url never surfaces raw in an error — an embedded `userinfo@`
   * credential is masked in `GitCommandError.args`/`.message` — and the
   * method's span annotates `cwd` and `path` only.
   */
  readonly submoduleSetUrl: {
    (
      cwd: string,
      path: string,
      url: string
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      url: string
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git submodule status [--recursive] [-- <paths>...]` — one
   * {@link SubmoduleStatusEntry} per registered submodule, decoding git's
   * state prefix (`current` / `uninitialized` / `outOfSync` / `conflict`).
   *
   * **Details**
   *
   * The output is line-based (git offers no `-z` mode here), so a submodule
   * path containing a newline would corrupt the parse — a git-imposed
   * limitation, recorded on the entry class.
   */
  readonly submoduleStatus: {
    (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ): Effect.Effect<ReadonlyArray<SubmoduleStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
      readonly recursive?: boolean;
    }): (
      cwd: string
    ) => Effect.Effect<ReadonlyArray<SubmoduleStatusEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git submodule sync [--recursive] [-- <paths>...]` — re-copies
   * each submodule's URL from `.gitmodules` into `.git/config` (and the
   * submodule's own `remote.origin.url`), so a `.gitmodules` URL change
   * actually reaches git's live configuration.
   */
  readonly submoduleSync: {
    (
      cwd: string,
      options?: {
        readonly paths?: ReadonlyArray<string>;
        readonly recursive?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly paths?: ReadonlyArray<string>;
      readonly recursive?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating:
   * `git submodule update [--init] [--checkout] [--remote] [--no-fetch] [--recursive] [--force] [--depth <n>] [-- <paths>...]`
   * — updates registered submodules in the working tree, optionally
   * initializing them (`options.init`), with an optional depth limit and
   * scoped to `options.paths`.
   *
   * **Details**
   *
   * `options.checkout` is the documented override for a
   * `submodule.<name>.update = none` configuration — without it, updating
   * such a submodule silently no-ops (git reports success and checks out
   * nothing). `options.fetch` accepts only the literal `false` (emitting
   * `--no-fetch`): the default already fetches and git has no positive
   * spelling. `options.remote` tracks the remote branch's tip instead of
   * the recorded sha; `options.recursive` descends into nested submodules;
   * `options.force` discards local changes in the submodule working tree.
   */
  readonly submoduleUpdate: {
    (
      cwd: string,
      options?: {
        readonly init?: boolean;
        readonly depth?: number;
        readonly paths?: ReadonlyArray<string>;
        readonly checkout?: boolean;
        readonly remote?: boolean;
        readonly fetch?: false;
        readonly recursive?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly init?: boolean;
      readonly depth?: number;
      readonly paths?: ReadonlyArray<string>;
      readonly checkout?: boolean;
      readonly remote?: boolean;
      readonly fetch?: false;
      readonly recursive?: boolean;
      readonly force?: boolean;
    }): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git tag [--force] [-m <message>] <name> [<ref>]` — creates a
   * lightweight tag at `options.ref` (default `HEAD`), or an annotated one
   * when `options.message` is given. An existing tag fails loudly unless
   * `options.force` is set.
   */
  readonly tagCreate: {
    (
      cwd: string,
      name: string,
      options?: {
        readonly ref?: string;
        readonly message?: string;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      name: string,
      options?: {
        readonly ref?: string;
        readonly message?: string;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** Mutating: `git tag --delete <name>` — deletes a local tag. */
  readonly tagDelete: {
    (cwd: string, name: string): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (name: string): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git tag --list [<pattern>]` — tag names, optionally filtered by a
   * shell-glob `options.pattern`.
   */
  readonly tagList: {
    (
      cwd: string,
      options?: { readonly pattern?: string }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly pattern?: string;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git diff --name-only -z [--relative]` — the unstaged working-tree paths. */
  readonly unstagedChanges: {
    (
      cwd: string,
      options?: { readonly relative?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /** `git ls-files --others --exclude-standard -z [--full-name]` — the untracked paths. */
  readonly untrackedFiles: {
    (
      cwd: string,
      options?: { readonly relative?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * The union of unstaged, staged and untracked working-tree paths —
   * `git diff --name-only -z [--relative]`, `--cached`, and
   * `git ls-files --others --exclude-standard -z`, deduplicated. Pass
   * `relative: true` for `cwd`-relative diff paths (`ls-files` reports
   * `cwd`-relative paths by default too; when `relative` is `false`,
   * `--full-name` makes it repo-root-relative instead, matching the
   * un-`--relative` diffs). No ref is involved, so it never fails `UnknownRefError`.
   */
  readonly workingChanges: {
    (
      cwd: string,
      options?: { readonly relative?: boolean }
    ): Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
    (options?: {
      readonly relative?: boolean;
    }): (cwd: string) => Effect.Effect<ReadonlyArray<string>, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * Mutating: `git worktree add [--force] [--detach] <path> [<ref>]` —
   * creates a linked working tree at `path`, checked out at `options.ref`
   * (or a branch named after `path`'s basename).
   */
  readonly worktreeAdd: {
    (
      cwd: string,
      path: string,
      options?: {
        readonly ref?: string;
        readonly detach?: boolean;
        readonly force?: boolean;
      }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      options?: {
        readonly ref?: string;
        readonly detach?: boolean;
        readonly force?: boolean;
      }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
  /**
   * `git worktree list --porcelain -z` — every working tree (the main one
   * first) as a {@link WorktreeEntry}.
   */
  readonly worktreeList: (
    cwd: string
  ) => Effect.Effect<ReadonlyArray<WorktreeEntry>, GitCommandError | NotARepositoryError | UnknownRefError>;
  /**
   * Mutating: `git worktree remove [--force] <path>` — removes a linked
   * working tree. A dirty worktree fails loudly unless `options.force` is
   * set.
   */
  readonly worktreeRemove: {
    (
      cwd: string,
      path: string,
      options?: { readonly force?: boolean }
    ): Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
    (
      path: string,
      options?: { readonly force?: boolean }
    ): (cwd: string) => Effect.Effect<void, GitCommandError | NotARepositoryError | UnknownRefError>;
  };
}

/**
 * The data-first signature of every {@link GitShape} member: what a
 * {@link Git.makeTest} stub implements.
 *
 * **Details**
 *
 * The pipeable members of `GitShape` are overloaded (data-first and
 * data-last). A stub writes only the data-first form; `makeTest` derives the
 * data-last form with the same `dual` dispatch the live layer uses. Members
 * with a single signature pass through unchanged.
 *
 * **Example** (Type a stub for an overloaded member)
 *
 * ```ts
 * import type { GitStubs } from "@beep/git/Git";
 * import * as Effect from "effect/Effect";
 *
 * const revParse: GitStubs["revParse"] = (_cwd, ref) => Effect.succeed(`sha-of-${ref}`);
 * console.log(Effect.runSync(revParse("/repo", "HEAD"))); // sha-of-HEAD
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type GitStubs = {
  readonly [K in keyof GitShape]: GitShape[K] extends {
    (...args: infer DataFirstArgs): infer DataFirstResult;
    (...args: infer _DataLastArgs): infer _DataLastResult;
  }
    ? (...args: DataFirstArgs) => DataFirstResult
    : GitShape[K];
};

/**
 * A test double invoked a Git method without an explicit stub.
 *
 * **Example** (Identify an unstubbed method defect)
 *
 * ```ts
 * import { NotStubbedError } from "@beep/git/Git";
 *
 * const defect = NotStubbedError.make({ message: "A Git method needs a stub." });
 * console.log(defect._tag, defect.message); // NotStubbedError A Git method needs a stub.
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class NotStubbedError extends S.TaggedError<NotStubbedError, { readonly brand: unique symbol }>(
  $I`NotStubbedError`
)(
  "NotStubbedError",
  { message: S.String },
  $I.annoteError<NotStubbedError>("NotStubbedError", {
    description: "A Git test double method was invoked without an explicit stub.",
  })
) {}

/**
 * The default for every {@link Git.makeTest} method a test did not stub: a
 * defect naming the method, so an unexercised call fails loudly instead of
 * succeeding with a lie or failing with a dishonest typed error.
 */
const notStubbed =
  (method: string) =>
  (..._args: ReadonlyArray<unknown>) =>
    Effect.die(
      NotStubbedError.make({
        message: `Git.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override.`,
      })
    );

/** The caller's stub for `method`, or the defect-raising placeholder that names it. */
const stubOf = <K extends keyof GitStubs>(
  overrides: Partial<GitStubs>,
  method: K
): GitStubs[K] | ReturnType<typeof notStubbed> => overrides[method] ?? notStubbed(method);

/**
 * Typed git introspection over core's `ChildProcessSpawner`: read a
 * repository's state at any ref without checking it out (including the
 * network read `lsRemote` and the index read `lsFiles`), plus the mutating
 * tier — checkout/fetch, the working-tree restore trio and stash, branches
 * and tags, remotes, worktrees, commit/push/pull, submodules,
 * sparse-checkout, config writes and staging — that changes it. Every
 * mutating method's TSDoc opens with the literal word `Mutating:`.
 *
 * **Details**
 *
 * Every method takes `cwd` explicitly and classifies git's stderr/exit-code
 * taxonomy exactly once, in this module's private `classify` step — a
 * spawn-level `PlatformError` and `Cause.TimeoutError` never escape a `Git`
 * method; every failure surfaces as {@link GitCommandError},
 * {@link NotARepositoryError}, {@link UnknownRefError}, or one of the three
 * consumer-branchable classifications ({@link NonFastForwardError} from
 * `push`; {@link MergeConflictError} and {@link DirtyWorktreeError} from the
 * merge-shaped `pull` / `stashPop` / `stashApply`), or degrades to the
 * documented non-error (`Option.none`, `false`, the empty array).
 *
 * Every method whose TSDoc opens "Mutating:" changes the working tree,
 * `HEAD`, the index, the repository config, the object database and
 * remote-tracking refs (`fetch`), or a submodule. None of it is
 * safe to run concurrently against the same `cwd`; nothing here serializes
 * that — a caller running two mutating calls (or a mutating call alongside a
 * read) against one `cwd` at once owns the race.
 *
 * **Every spawn already runs under a 30 s timeout** (this module's
 * `GIT_TIMEOUT`): a command that has not answered in time fails as a
 * {@link GitCommandError} with `detail` set to `"timed out after 30s"`.
 *
 * That ceiling is per run, not per member call. The network-touching members
 * (`lsRemote`, `fetch`, `fetchUnshallow`, `push`, `pull`, `submoduleAdd`,
 * `submoduleUpdate`) first resolve their ssh command with up to two concurrent
 * local `git config` reads, each bounded separately, so their worst case is
 * 60 s; `fetchAny`, which runs `fetch` twice, is 120 s. A consumer merely
 * duplicating a 30 s layer buys nothing but two ceilings racing each other;
 * one whose budget is tighter than the figures above still needs its own.
 *
 * **Redaction policy (documented, not just convention).** Error values
 * persist only the constructor's REDACTED argv (see `GitCommandError.args`),
 * and span annotations carry stable identifiers only — `cwd`, refs, keys,
 * paths, remote names — never config values and never URLs, which can embed
 * userinfo.
 *
 * **Example** (Read the repository root, current branch, and changed files)
 *
 * ```ts
 * import { Git } from "@beep/git/Git";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const program = Effect.gen(function* () {
 *   const git = yield* Git;
 *   const root = yield* git.repoRoot(process.cwd());
 *   const branch = yield* git.currentBranch(root); // Option.none() when detached
 *   const changed = yield* git.changedFiles(root, { base: "origin/main", head: "HEAD" });
 *   return { root, branch: O.getOrNull(branch), changed };
 * });
 *
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class Git extends Context.Service<Git, GitShape>()($I`Git`) {
  /**
   * Builds the live service shape: resolves `ChildProcessSpawner` and reads the
   * ambient ssh environment once — every method's `R` is `never`.
   *
   * **Details**
   *
   * The same construction {@link Git.layer} runs, as a plain effect. A caller
   * that adopts one or two `Git` reads inside a module whose own requirements
   * already include `ChildProcessSpawner` provides it with
   * `Effect.provideServiceEffect(Git, Git.make)` instead of providing a layer
   * below the application edge.
   *
   * **Example** (Provide the service for one read)
   *
   * ```ts
   * import { Git } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const root = Git.use((git) => git.repoRoot("/repo")).pipe(Effect.provideServiceEffect(Git, Git.make));
   * console.log(Effect.isEffect(root)); // true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly make: Effect.Effect<GitShape, never, ChildProcessSpawner.ChildProcessSpawner> = Effect.gen(
    function* () {
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      // The AMBIENT ENVIRONMENT is read ONCE, here, and never again — it
      // cannot change under a running service. The read goes through
      // ConfigProvider (whose default is `fromEnv()`) rather than
      // `process.env`, so a test provides a provider instead of mutating the
      // environment and `src/` keeps its zero-`node:` boundary. A blank value
      // is treated as absent — an exported-but-empty GIT_SSH_COMMAND is not
      // an ssh configuration worth preserving.
      //
      // `core.sshCommand` is NOT read here: it is repository-local, so it
      // belongs to a cwd rather than to the service, and is resolved per
      // network-touching call instead.
      // A source-level ConfigError degrades to "absent" rather than escaping:
      // the layer's error channel is `never` by contract, and an unreadable
      // provider is answered with the pin that cannot hang.
      const read = (name: string) =>
        Config.String(name).pipe(
          Config.option,
          Effect.orElseSucceed(O.none<string>),
          // A blank value is treated as absent — an exported-but-empty
          // variable is not a configuration worth preserving.
          Effect.map(O.filter((value) => Str.trim(value) !== ""))
        );
      const [command, program, variant] = yield* Effect.all(
        [read("GIT_SSH_COMMAND"), read("GIT_SSH"), read("GIT_SSH_VARIANT")],
        { concurrency: "unbounded" }
      );
      return make(spawner, { command, program, variant });
    }
  );

  /**
   * Resolves `ChildProcessSpawner` once, at construction — every method's `R` is `never`.
   *
   * **Example** (Compose a live repository query)
   *
   * ```ts
   * import { Git } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const program = Effect.gen(function* () {
   *   const git = yield* Git;
   *   return yield* git.repoRoot("/repo");
   * }).pipe(Effect.provide(Git.layer));
   * console.log(Effect.isEffect(program)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Git, never, ChildProcessSpawner.ChildProcessSpawner> = Layer.effect(
    this,
    this.make
  );

  /**
   * An in-memory test double of the service shape: stub only the methods the
   * test exercises, every other method **dies** with a defect naming itself.
   *
   * **Gotchas**
   *
   * Unlike `WorkspaceDiscovery.makeTest`, **no method here has an honest
   * default** — the shape is unrelated git operations, and a
   * fabricated answer for any of them (an empty tree, a made-up sha, a silent
   * no-op `checkout`) would leak into consumer logic as fact. So every
   * unstubbed method fails loudly as a defect
   * (`Git.makeTest: <name>() was called but not stubbed`) rather than
   * succeeding with a lie or failing with a dishonest typed error — which is
   * also what makes the double a proof that a test touches *nothing but* the
   * methods it stubbed.
   *
   * The double deliberately models **none** of the live service's semantics:
   * no stderr classification, no option-injection guard (an option-like ref a
   * stub accepts would be refused live), no environment pinning, no timeout,
   * and no `./`-vs-bare path resolution on `show` — a stub answers exactly
   * what it is told and nothing else. A suite exercising any of those wants
   * `Git.layer` over a mocked `ChildProcessSpawner` (or real git) instead.
   *
   * **Example** (Stub file contents with a Git test double)
   *
   * ```ts
   * import { Git } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   * import * as O from "effect/Option";
   *
   * const double = Git.makeTest({
   *   show: (_cwd, _ref, path) =>
   *     Effect.succeed(path === "./package.json" ? O.some("{}") : O.none()),
   * });
   * // `double.show(...)` answers; `double.status(...)` dies, named.
   * console.log(O.getOrNull(Effect.runSync(double.show("/repo", "HEAD", "./package.json")))); // {}
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<GitStubs> = {}): GitShape => ({
    show: dual(3, stubOf(overrides, "show")),
    lsTree: dual(stringAt(1), stubOf(overrides, "lsTree")),
    refExists: dual(2, stubOf(overrides, "refExists")),
    mergeBase: dual(3, stubOf(overrides, "mergeBase")),
    mergeBaseOption: dual(3, stubOf(overrides, "mergeBaseOption")),
    changedFiles: dual(2, stubOf(overrides, "changedFiles")),
    workingChanges: dual(hasStringSubject, stubOf(overrides, "workingChanges")),
    revParse: dual(2, stubOf(overrides, "revParse")),
    checkout: dual(stringAt(1), stubOf(overrides, "checkout")),
    fetch: dual(2, stubOf(overrides, "fetch")),
    fetchAny: dual(2, stubOf(overrides, "fetchAny")),
    fetchUnshallow: dual(hasStringSubject, stubOf(overrides, "fetchUnshallow")),
    isShallow: stubOf(overrides, "isShallow"),
    reset: dual(hasStringSubject, stubOf(overrides, "reset")),
    clean: dual(hasStringSubject, stubOf(overrides, "clean")),
    restore: dual(hasStringSubject, stubOf(overrides, "restore")),
    branchCreate: dual(stringAt(1), stubOf(overrides, "branchCreate")),
    branchDelete: dual(stringAt(1), stubOf(overrides, "branchDelete")),
    submoduleUpdate: dual(hasStringSubject, stubOf(overrides, "submoduleUpdate")),
    submoduleAdd: dual(2, stubOf(overrides, "submoduleAdd")),
    submoduleStatus: dual(hasStringSubject, stubOf(overrides, "submoduleStatus")),
    submoduleInit: dual(hasStringSubject, stubOf(overrides, "submoduleInit")),
    submoduleDeinit: dual(2, stubOf(overrides, "submoduleDeinit")),
    submoduleSync: dual(hasStringSubject, stubOf(overrides, "submoduleSync")),
    submoduleSetUrl: dual(3, stubOf(overrides, "submoduleSetUrl")),
    submoduleSetBranch: dual(stringAt(1), stubOf(overrides, "submoduleSetBranch")),
    submoduleAbsorbgitdirs: dual(hasStringSubject, stubOf(overrides, "submoduleAbsorbgitdirs")),
    submoduleForeach: dual(stringAt(1), stubOf(overrides, "submoduleForeach")),
    sparseCheckoutSet: dual(3, stubOf(overrides, "sparseCheckoutSet")),
    configSet: dual(stringAt(2), stubOf(overrides, "configSet")),
    add: dual(2, stubOf(overrides, "add")),
    nameStatus: dual(2, stubOf(overrides, "nameStatus")),
    unstagedChanges: dual(hasStringSubject, stubOf(overrides, "unstagedChanges")),
    stagedChanges: dual(hasStringSubject, stubOf(overrides, "stagedChanges")),
    untrackedFiles: dual(hasStringSubject, stubOf(overrides, "untrackedFiles")),
    defaultBranch: dual(hasStringSubject, stubOf(overrides, "defaultBranch")),
    currentBranch: stubOf(overrides, "currentBranch"),
    repoRoot: stubOf(overrides, "repoRoot"),
    commonDir: stubOf(overrides, "commonDir"),
    configGet: dual(stringAt(1), stubOf(overrides, "configGet")),
    remoteUrl: dual(hasStringSubject, stubOf(overrides, "remoteUrl")),
    commitInfo: stubOf(overrides, "commitInfo"),
    log: dual(hasStringSubject, stubOf(overrides, "log")),
    status: stubOf(overrides, "status"),
    lsRemote: dual(stringAt(1), stubOf(overrides, "lsRemote")),
    remoteAdd: dual(3, stubOf(overrides, "remoteAdd")),
    remoteRemove: dual(2, stubOf(overrides, "remoteRemove")),
    remoteSetUrl: dual(3, stubOf(overrides, "remoteSetUrl")),
    stashPush: dual(hasStringSubject, stubOf(overrides, "stashPush")),
    stashPop: dual(hasStringSubject, stubOf(overrides, "stashPop")),
    stashApply: dual(hasStringSubject, stubOf(overrides, "stashApply")),
    stashDrop: dual(hasStringSubject, stubOf(overrides, "stashDrop")),
    stashList: stubOf(overrides, "stashList"),
    branchList: dual(hasStringSubject, stubOf(overrides, "branchList")),
    tagCreate: dual(stringAt(1), stubOf(overrides, "tagCreate")),
    tagDelete: dual(2, stubOf(overrides, "tagDelete")),
    tagList: dual(hasStringSubject, stubOf(overrides, "tagList")),
    forEachRef: dual(hasStringSubject, stubOf(overrides, "forEachRef")),
    revList: dual(stringAt(1), stubOf(overrides, "revList")),
    commit: dual(stringAt(1), stubOf(overrides, "commit")),
    push: dual(hasStringSubject, stubOf(overrides, "push")),
    pull: dual(hasStringSubject, stubOf(overrides, "pull")),
    configList: dual(hasStringSubject, stubOf(overrides, "configList")),
    configGetAll: dual(stringAt(1), stubOf(overrides, "configGetAll")),
    configUnset: dual(stringAt(1), stubOf(overrides, "configUnset")),
    configRemoveSection: dual(stringAt(1), stubOf(overrides, "configRemoveSection")),
    configRenameSection: dual(stringAt(2), stubOf(overrides, "configRenameSection")),
    rm: dual(hasStringSubject, stubOf(overrides, "rm")),
    mv: dual(stringAt(2), stubOf(overrides, "mv")),
    checkIgnore: dual(2, stubOf(overrides, "checkIgnore")),
    worktreeAdd: dual(stringAt(1), stubOf(overrides, "worktreeAdd")),
    worktreeList: stubOf(overrides, "worktreeList"),
    worktreeRemove: dual(stringAt(1), stubOf(overrides, "worktreeRemove")),
    lsFiles: dual(hasStringSubject, stubOf(overrides, "lsFiles")),
  });

  /**
   * The test layer: {@link Git.makeTest} behind `Layer.succeed`, so a suite
   * provides only the methods it exercises.
   *
   * **Gotchas**
   *
   * A parameterized layer factory mints a **fresh reference per call**, and
   * layers memoize by reference — bind the result to a `const` and reuse it
   * rather than calling `layerTest(...)` at each composition site.
   *
   * **Example** (Provide a Git test layer with a stubbed tree listing)
   *
   * ```ts
   * import { Git, LsTreeEntry } from "@beep/git/Git";
   * import * as Effect from "effect/Effect";
   *
   * const TestGit = Git.layerTest({
   *   lsTree: () =>
   *     Effect.succeed([
   *       LsTreeEntry.make({ mode: "100644", type: "blob", oid: "0".repeat(40), path: "package.json" }),
   *     ]),
   * });
   * const program = Effect.gen(function* () {
   *   const git = yield* Git;
   *   const entries = yield* git.lsTree("/repo", "HEAD");
   *   return entries[0]?.path;
   * });
   * console.log(Effect.runSync(program.pipe(Effect.provide(TestGit)))); // package.json
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (overrides: Partial<GitStubs> = {}): Layer.Layer<Git> =>
    Layer.succeed(Git, Git.makeTest(overrides));
}
