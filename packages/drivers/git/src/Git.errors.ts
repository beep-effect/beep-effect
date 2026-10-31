/**
 * Git failure contracts shared by process classification and service callers.
 *
 * **Details**
 *
 * The original Git identity scope is retained so moving a declaration does not
 * change its schema identifier or interned symbol. Git.ts re-exports these same
 * constructors for existing consumers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GitId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $GitId.create("Git");

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
 * ```ts import.meta.vitest name="Inspect a failed invocation"
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
   * ```ts import.meta.vitest name="Render the failure message"
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
 * ```ts import.meta.vitest name="Identify a directory outside a repository"
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
   * ```ts import.meta.vitest name="Render the failure message"
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
 * ```ts import.meta.vitest name="Identify an unresolved ref"
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
   * ```ts import.meta.vitest name="Render the failure message"
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
 * ```ts import.meta.vitest name="Inspect a rejected refspec"
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
   * ```ts import.meta.vitest name="Render the failure message"
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
 * ```ts import.meta.vitest name="Inspect a conflicted merge"
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
   * ```ts import.meta.vitest name="Render the failure message"
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
 * ```ts import.meta.vitest name="Inspect a blocked merge"
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
   * ```ts import.meta.vitest name="Render the failure message"
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
 * A test double invoked a Git method without an explicit stub.
 *
 * **Example** (Identify an unstubbed method defect)
 *
 * ```ts import.meta.vitest name="Identify an unstubbed method defect"
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
