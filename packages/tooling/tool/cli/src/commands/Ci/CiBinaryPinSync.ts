/**
 * `beep ci binary-pin-sync`: keep the open pin-bump branch mergeable with main.
 *
 * **Details**
 *
 * `beep-ci-binary.yml` opens one pin-bump pull request on the
 * `ci/beep-ci-pin-bump` branch. Once that branch pins the newest release and
 * its pull request is open, nothing used to push to it again, so every pin
 * that landed on main after the branch was cut left it behind main or in
 * conflict with it, with no signal. This command runs in a checkout of the
 * branch head. It merges main into the branch and resolves the pin file to
 * main's text with exactly the two pinned lines (`BEEP_CI_RELEASE_TAG`,
 * `BEEP_CI_SHA256`) set. The workflow then pushes the result without force,
 * so the pull request keeps its number and its review history. A merge that
 * would carry workflow files cannot be pushed by the pin-bump App, so a
 * branch holding only the pin is superseded by a fresh pull request instead.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git, GitOptions, MergeConflictError } from "@beep/git/Git";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { CI_BINARY_PIN_FILE, CiBinaryPin, decodeCiBinaryPinFlags, rewriteCiBinaryPin } from "./CiBinaryPin.ts";

const $I = $RepoCliId.create("commands/Ci/CiBinaryPinSync");

/**
 * **Details**
 *
 * - `stale`: the branch pins an older release than the one resolved, or the
 *   right tag with another sha256, and updating it to main carries no
 *   workflow file. Nothing changed; the workflow re-runs the pin bump, which
 *   retitles the pull request for the new release.
 * - `current`: the branch already contains main and pins the resolved
 *   release (or a newer one). Nothing changed and nothing is pushed.
 * - `merged`: the branch was behind main or in conflict with it. Main is now
 *   merged in with the pin resolved, and the workflow pushes the new head.
 * - `supersede`: merging main into the branch, or updating a stale branch
 *   to main, would carry `.github/workflows` changes, which the pin-bump App
 *   (no `workflows` permission) may not push onto an existing branch, and the
 *   branch holds nothing but the pin. The checkout is left as it was; the
 *   workflow closes the pull request as superseded and opens a fresh one from
 *   main, with the branch's pin (or, for a stale branch, the newest release).
 * - `blocked`: the sync cannot heal the branch (a conflict outside the pin
 *   file, or a workflow-carrying merge or stale update onto a branch that
 *   holds more than the pin; the stale reason names the newer release that is
 *   waiting). The checkout is left as it was and the workflow reports it once.
 *
 * A stale branch is bumped by create-pull-request, which force-updates it to main plus the pin
 * commit. That update carries every workflow change main made since the branch was cut, which the
 * pin-bump App (no `workflows` permission) may not push onto an existing branch, so a pin-only
 * branch is superseded with the newest release instead. A branch holding anything else is blocked
 * while that release waits, with or without workflow changes, because the rebuild would discard it.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { CiBinaryPinSyncOutcome } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 *
 * console.log(CiBinaryPinSyncOutcome.is.supersede("supersede")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiBinaryPinSyncOutcome = LiteralKit(["stale", "current", "merged", "supersede", "blocked"]).pipe(
  $I.annoteSchema("CiBinaryPinSyncOutcome", {
    title: "CI Binary Pin Sync Outcome",
    description:
      "What the pin-bump branch sync decided: nothing, a merge of main, a superseding pull request, or a block.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CiBinaryPinSyncOutcome = typeof CiBinaryPinSyncOutcome.Type;

/**
 * The decision of one pin-bump branch sync: the outcome, the pin the branch keeps, and why it is blocked.
 *
 * **Example** (Build a result)
 *
 * ```ts
 * import { CiBinaryPinSyncResult } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 * import * as O from "effect/Option"
 *
 * const result = CiBinaryPinSyncResult.make({ outcome: "stale", pin: O.none(), reason: O.none(), pinOnly: false })
 * console.log(result.outcome) // "stale"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiBinaryPinSyncResult extends S.Opaque<CiBinaryPinSyncResult, { readonly brand: unique symbol }>()(
  S.Struct({
    outcome: CiBinaryPinSyncOutcome,
    pin: S.Option(CiBinaryPin).pipe(
      $I.annoteKey("CiBinaryPinSyncResult.pin", {
        description: "The pin the branch keeps: the resolved release, or a newer one the branch already held.",
      })
    ),
    reason: S.Option(S.String).pipe(
      $I.annoteKey("CiBinaryPinSyncResult.reason", { description: "Why a blocked branch cannot be healed." })
    ),
    pinOnly: S.Boolean.pipe(
      $I.annoteKey("CiBinaryPinSyncResult.pinOnly", {
        description:
          "Whether the branch holds nothing beyond the pin, so a create-pull-request rebuild from main loses nothing.",
      })
    ),
  }).pipe($I.annoteSchema("CiBinaryPinSyncResult", { description: "The decision of one pin-bump branch sync." }))
) {}

const syncResult = (
  outcome: CiBinaryPinSyncOutcome,
  pin: O.Option<CiBinaryPin>,
  reason = O.none<string>(),
  pinOnly = false
) => CiBinaryPinSyncResult.make({ outcome, pin, reason, pinOnly });

const WORKFLOWS_PATH = ".github/workflows";

/**
 * One row of `gh release list --json tagName,createdAt`.
 *
 * **Example** (Decode a release row)
 *
 * ```ts
 * import { BeepCiRelease } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(BeepCiRelease)({
 *   tagName: "beep-ci-a56516d6d309",
 *   createdAt: "2026-11-18T00:00:00Z",
 * })
 * console.log(typeof program) // "object"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BeepCiRelease extends S.Opaque<BeepCiRelease, { readonly brand: unique symbol }>()(
  S.Struct({
    tagName: S.String.pipe($I.annoteKey("BeepCiRelease.tagName", { description: "The release tag." })),
    createdAt: S.DateTimeUtcFromString.pipe(
      $I.annoteKey("BeepCiRelease.createdAt", { description: "When the release was created." })
    ),
  }).pipe(
    $I.annoteSchema("BeepCiRelease", {
      description: "A published release's tag and creation time, the order that decides which release is newer.",
    })
  )
) {}

const decodeReleases = S.decodeUnknownEffect(S.fromJsonString(S.Array(BeepCiRelease)));
const decodeCiBinaryPin = S.decodeUnknownEffect(CiBinaryPin);

const createdAt = (releases: ReadonlyArray<BeepCiRelease>, tag: string) =>
  O.map(
    A.findFirst(releases, (release) => release.tagName === tag),
    (release) => release.createdAt
  );

const orderedAt = Effect.fnUntraced(function* (releases: ReadonlyArray<BeepCiRelease>, tag: string) {
  const at = createdAt(releases, tag);
  if (O.isNone(at)) {
    return yield* CiCommandError.make({
      message: `${tag} is not in the release list, so whether it is newer cannot be decided; nothing was changed.`,
    });
  }
  const ties = A.filter(
    releases,
    (release) => release.tagName !== tag && DateTime.Equivalence(release.createdAt, at.value)
  );
  if (A.isReadonlyArrayNonEmpty(ties)) {
    return yield* CiCommandError.make({
      message: `${tag} shares its creation time with ${A.join(
        A.map(ties, (release) => release.tagName),
        ", "
      )}, so the release order is ambiguous; nothing was changed.`,
    });
  }
  return at.value;
});

const isUnmergedCode = S.is(S.Literals(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]));
const isUnmerged = (entry: { readonly x: string; readonly y: string }): boolean =>
  isUnmergedCode(`${entry.x}${entry.y}`);

/**
 * **Example** (Describe a sync request)
 *
 * ```ts
 * import { CiBinaryPinSyncRequest } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 *
 * console.log(typeof CiBinaryPinSyncRequest.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiBinaryPinSyncRequest extends S.Opaque<CiBinaryPinSyncRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String.pipe(
      $I.annoteKey("CiBinaryPinSyncRequest.cwd", {
        description: "A checkout of the pin-bump branch head (a detached worktree in the workflow).",
      })
    ),
    base: S.String.pipe(
      $I.annoteKey("CiBinaryPinSyncRequest.base", { description: "The ref to merge in, such as origin/main." })
    ),
    pin: CiBinaryPin,
    releases: S.Array(BeepCiRelease).pipe(
      $I.annoteKey("CiBinaryPinSyncRequest.releases", {
        description: "Every beep-ci-* release with its creation time.",
      })
    ),
    file: S.String.pipe($I.annoteKey("CiBinaryPinSyncRequest.file", { description: "The pin file, relative to cwd." })),
    output: S.Option(S.String).pipe(
      $I.annoteKey("CiBinaryPinSyncRequest.output", {
        description: "A file to append the decision to, written inside the rollback scope of a merge.",
      })
    ),
  }).pipe($I.annoteSchema("CiBinaryPinSyncRequest", { description: "The inputs of one pin-bump branch sync." }))
) {}

const gitFailure =
  (request: CiBinaryPinSyncRequest) =>
  (cause: { readonly message: string }): CiCommandError =>
    CiCommandError.make({ cause, message: `git failed in ${request.cwd}: ${cause.message}` });

const readPinFile = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.resolve(request.cwd, request.file);
  const present = yield* fs.exists(file).pipe(Effect.mapError(CiCommandError.new(`Failed to read ${file}.`)));
  if (!present) {
    return O.none<string>();
  }
  const text = yield* fs.readFileString(file).pipe(Effect.mapError(CiCommandError.new(`Failed to read ${file}.`)));
  return O.some(text);
});

const resolveSyncTarget = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const newestAt = yield* orderedAt(request.releases, request.pin.tag);
  const branchText = yield* readPinFile(request);
  if (O.isNone(branchText)) {
    return O.none<CiBinaryPin>();
  }
  const branch = yield* rewriteCiBinaryPin(branchText.value, request.pin).pipe(Effect.option);
  if (O.isNone(branch)) {
    return O.none<CiBinaryPin>();
  }
  const { previousTag, previousSha256 } = branch.value;
  if (previousTag === request.pin.tag && previousSha256 === request.pin.sha256) {
    return O.some(request.pin);
  }
  const branchPin = yield* decodeCiBinaryPin({ tag: previousTag, sha256: previousSha256 }).pipe(Effect.option);
  if (O.isNone(branchPin) || branchPin.value.tag === request.pin.tag) {
    return O.none<CiBinaryPin>();
  }
  const branchAt = yield* orderedAt(request.releases, branchPin.value.tag);
  return DateTime.isGreaterThan(branchAt, newestAt) ? branchPin : O.none<CiBinaryPin>();
});

const mergeBase = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const path = yield* Path.Path;
  const conflicted = yield* git.pull(request.cwd, { remote: ".", ref: request.base }).pipe(
    Effect.as(false),
    Effect.catchIf(S.is(MergeConflictError), () => Effect.succeed(true)),
    Effect.mapError(gitFailure(request))
  );
  const status = conflicted ? yield* git.status(request.cwd).pipe(Effect.mapError(gitFailure(request))) : [];
  const pinFile = path.resolve(request.cwd, request.file);
  const outside = A.filter(status, (entry) => isUnmerged(entry) && path.resolve(request.cwd, entry.path) !== pinFile);
  return { conflicted, outside: A.map(outside, (entry) => entry.path) };
});

const commitResolvedPin = Effect.fnUntraced(function* (
  request: CiBinaryPinSyncRequest,
  target: CiBinaryPin,
  conflicted: boolean
) {
  const git = yield* Git;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const baseFile = yield* git.show(request.cwd, request.base, request.file).pipe(Effect.mapError(gitFailure(request)));
  if (O.isNone(baseFile)) {
    return yield* CiCommandError.make({ message: `${request.base} has no ${request.file}.` });
  }
  const resolved = yield* rewriteCiBinaryPin(baseFile.value, target);
  const merged = yield* readPinFile(request);
  if (!conflicted && O.exists(merged, (text) => text === resolved.text)) {
    return;
  }
  const file = path.resolve(request.cwd, request.file);
  yield* fs.writeFileString(file, resolved.text).pipe(Effect.mapError(CiCommandError.new(`Failed to write ${file}.`)));
  yield* git.add(request.cwd, [request.file]).pipe(Effect.mapError(gitFailure(request)));
  const message = conflicted
    ? `Merge ${request.base} into the pin-bump branch, keeping the pin at ${target.tag}`
    : `ci: keep the beep CI binary pin at ${target.tag}`;
  yield* git.commit(request.cwd, message, { noVerify: true }).pipe(Effect.mapError(gitFailure(request)));
});

const pinFileBeyondPinLines = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const forkPoint = yield* git.mergeBase(request.cwd, request.base, "HEAD").pipe(Effect.mapError(gitFailure(request)));
  const forkText = yield* git.show(request.cwd, forkPoint, request.file).pipe(Effect.mapError(gitFailure(request)));
  const branchFile = yield* readPinFile(request);
  const branchText = O.filter(branchFile, (text) => Str.isNonEmpty(Str.trim(text)));
  if (O.isNone(branchText)) {
    return false;
  }
  const pinned = (text: string) =>
    rewriteCiBinaryPin(text, request.pin).pipe(
      Effect.map((rewritten) => rewritten.text),
      Effect.option
    );
  const branchPinned = yield* pinned(branchText.value);
  const forkPinned = yield* O.match(forkText, { onNone: () => Effect.succeedNone, onSome: pinned });
  return !O.exists(O.all([forkPinned, branchPinned]), ([fork, branch]) => fork === branch);
});

const beyondPinLinesReason = (request: CiBinaryPinSyncRequest) =>
  `${request.file} differs from its merge-base version outside the two pinned lines`;

const branchExtras = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const changed = yield* git
    .changedFiles(request.cwd, { base: request.base, head: "HEAD" })
    .pipe(Effect.mapError(gitFailure(request)));
  const others = A.filter(changed, (file) => file !== request.file);
  const beyond = yield* pinFileBeyondPinLines(request);
  return beyond ? A.append(others, beyondPinLinesReason(request)) : others;
});

const classifyStale = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const extras = yield* branchExtras(request);
  if (A.isReadonlyArrayNonEmpty(extras)) {
    return syncResult(
      "blocked",
      O.none(),
      O.some(
        `a newer release ${request.pin.tag} is waiting, but the branch holds changes besides the pin (${A.join(extras, ", ")}), which bumping it would discard`
      )
    );
  }
  const workflows = yield* git
    .changedFiles(request.cwd, { base: "HEAD", head: request.base, twoDot: true, pathspec: [WORKFLOWS_PATH] })
    .pipe(Effect.mapError(gitFailure(request)));
  return A.isReadonlyArrayEmpty(workflows)
    ? syncResult("stale", O.none(), O.none(), true)
    : syncResult("supersede", O.some(request.pin), O.none(), true);
});

const classifyMerge = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest, before: string, pin: CiBinaryPin) {
  const git = yield* Git;
  const workflows = yield* git
    .changedFiles(request.cwd, { base: before, head: "HEAD", twoDot: true, pathspec: [WORKFLOWS_PATH] })
    .pipe(Effect.mapError(gitFailure(request)));
  if (A.isReadonlyArrayEmpty(workflows)) {
    return syncResult("merged", O.some(pin));
  }
  const changed = yield* git
    .changedFiles(request.cwd, { base: request.base, head: "HEAD", twoDot: true })
    .pipe(Effect.mapError(gitFailure(request)));
  const extra = A.filter(changed, (file) => file !== request.file);
  return A.isReadonlyArrayEmpty(extra)
    ? syncResult("supersede", O.some(pin))
    : syncResult(
        "blocked",
        O.some(pin),
        O.some(
          `merging ${request.base} carries workflow changes (${A.join(workflows, ", ")}), which the pin-bump App cannot push, and the branch holds changes besides the pin (${A.join(extra, ", ")}), so it cannot be superseded`
        )
      );
});

const renderSyncOutput = (result: CiBinaryPinSyncResult): string =>
  A.join(
    [
      `outcome=${result.outcome}`,
      ...O.match(result.pin, { onNone: () => [], onSome: (pin) => [`tag=${pin.tag}`, `sha256=${pin.sha256}`] }),
      ...O.match(result.reason, {
        onNone: () => [],
        onSome: (reason) => [`reason=${Str.replace(/[\r\n]+/gu, " ")(reason)}`],
      }),
      `pin_only=${result.pinOnly}`,
      "",
    ],
    "\n"
  );

const publish = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest, result: CiBinaryPinSyncResult) {
  if (O.isNone(request.output)) {
    return;
  }
  const output = request.output.value;
  const fs = yield* FileSystem.FileSystem;
  yield* fs
    .writeFileString(output, renderSyncOutput(result), { flag: "a" })
    .pipe(Effect.mapError(CiCommandError.new(`Failed to write ${output}.`)));
});

const finish = (request: CiBinaryPinSyncRequest, result: CiBinaryPinSyncResult) =>
  Effect.as(publish(request, result), result);

const mergeAndClassify = Effect.fnUntraced(function* (
  request: CiBinaryPinSyncRequest,
  before: string,
  target: CiBinaryPin
) {
  const merge = yield* mergeBase(request);
  if (A.isReadonlyArrayNonEmpty(merge.outside)) {
    return syncResult(
      "blocked",
      O.some(target),
      O.some(`merging ${request.base} conflicts outside ${request.file}: ${A.join(merge.outside, ", ")}`)
    );
  }
  yield* commitResolvedPin(request, target, merge.conflicted);
  return yield* classifyMerge(request, before, target);
});

/**
 * Rewrite a `git <args>` command to `git -c core.hooksPath=<hooks> <args>`, leaving any other command as it is.
 *
 * **Details**
 *
 * The per-invocation config outranks the repository's own `core.hooksPath`
 * and `.git/hooks`, so with an empty `hooks` directory git has no hook to
 * run. It rewrites the argv of a command the `Git` kit already built, so it
 * adds no git operation of its own. A command that is not a plain `git`
 * invocation, such as a pipeline, passes through unchanged.
 *
 * The sync's merge commit is a bot commit made in a separate checkout of the pin-bump branch, which
 * has no `node_modules` for lefthook's commitlint-loading commit-msg hook, so `git pull` once
 * stopped with "Not committing merge" (Beep CI Binary run 44657799060). Every sync git call runs
 * through a `Git` whose spawner applies this, covering commit-msg, pre-merge-commit, post-merge and
 * any other hook, whatever installed them.
 *
 * **Example** (Disable hooks on one git command)
 *
 * ```ts
 * import { withHooksPath } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 * import * as ChildProcess from "effect/process/ChildProcess"
 *
 * const command = withHooksPath("/tmp/no-hooks")(ChildProcess.make`git status`)
 * console.log(command._tag) // "StandardCommand"
 * ```
 *
 * @param hooks - An empty directory for `core.hooksPath`.
 * @returns The command transformer.
 * @category combinators
 * @since 0.0.0
 */
export const withHooksPath =
  (hooks: string) =>
  (command: ChildProcess.Command): ChildProcess.Command =>
    ChildProcess.isStandardCommand(command) && command.command === "git"
      ? // biome-ignore lint/plugin/no-hand-rolled-git-gh-spawn: KEEP (D-23), reason above
        ChildProcess.make("git", ["-c", `core.hooksPath=${hooks}`, ...command.args], command.options)
      : command;

const withoutRepoHooks = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const hooks = yield* fs
        .makeTempDirectoryScoped({ prefix: "beep-pin-sync-hooks-" })
        .pipe(Effect.mapError(CiCommandError.new("Failed to create the empty hooks directory.")));
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const hookless = ChildProcessSpawner.make((command) => spawner.spawn(withHooksPath(hooks)(command)));
      const git = yield* Git.makeWith(GitOptions.make({})).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, hookless)
      );
      return yield* Effect.provideService(effect, Git, git);
    })
  );

/**
 * Merge `base` into a pin-bump branch checkout when it is behind or in conflict, never moving the pin backwards.
 *
 * **Details**
 *
 * The branch's pin decides the target. The resolved release (same tag and
 * sha256) is kept. A newer release (by creation time) is kept as it is, so
 * the sync only merges main. Anything else is `stale` and nothing changes.
 * When `base` is already an ancestor of `HEAD` the result is `current`.
 * Otherwise `git pull . <base>` merges it, and the pin file becomes `base`'s
 * text with the two pinned lines set to the target. A merge that carries no
 * `.github/workflows` file is `merged` and left to push. One that does is
 * `supersede` when the merged branch differs from `base` only in the pin
 * file, and `blocked` otherwise; a conflict outside the pin file is
 * `blocked` too. `supersede` and `blocked` reset the checkout to its
 * pre-merge head, and so does every failure after the merge starts, so no
 * conflict markers or `MERGE_HEAD` are left behind. A branch tag the release
 * list does not hold, or one sharing its creation time with another
 * release, fails before anything changes: its order cannot be decided. Every git call runs with
 * `-c core.hooksPath=<an empty temporary directory>`: the merge is a bot commit with git's fixed
 * message, so the checkout's commit-msg, pre-merge-commit and post-merge hooks never run (the
 * repository's lefthook commit-msg hook needs that checkout's own `node_modules`). The checkout needs `pull.rebase=false`, a committer
 * identity, and enough history for a merge base.
 *
 * An unordered tag fails closed rather than reading as older, which would let a reset move a pin
 * backwards, and the resolved release itself must be listed with an unambiguous creation time
 * before anything is decided, the exact-match fast path included. A missing pin file, or one whose
 * two lines do not parse, holds no release to keep and is stale like an older one. The sync refuses
 * a checkout with any local change before touching it, because the restore is `reset --hard`. It
 * stops before merging when the pin file differs from its merge-base version outside the two pinned
 * lines (a human edit the resolution would overwrite or a supersede would delete); a side whose pin
 * lines do not parse, or a pin file the merge base lacks, counts as differing, while a deleted or
 * empty pin file is the broken pin itself and holds nothing beyond it. Git treats ignored files as
 * expendable, so a file already at a path the base newly tracks is refused, and with rename
 * detection off a file main moved shows its destination as an added path. Paths compare after
 * normalization, so `./a/b` and `x/../a/b` equal git's `a/b`.
 *
 * The pin rewrite also concludes the merge commit after a conflict. A clean merge can still take
 * main's older pin lines, when the branch's pin lines equal its merge base's and main then changed
 * them, so the pin is rewritten and committed then too; pin-only was checked first, so those two
 * lines are the only difference. A workflow-carrying merge can only replace the branch, which is
 * safe only while the branch holds nothing but the pin: the files changed since the merge base
 * other than the pin file, plus the pin file when it differs outside its pinned lines. A restore
 * that fails too is reported with the typed failure. A git or file system failure keeps the
 * redacted argv (a URL's userinfo never survives it), the exit code and git's stderr, and the sync
 * sends no URL at all.
 *
 * **Example** (Sync a branch checkout)
 *
 * ```ts
 * import { syncCiBinaryPinBranch } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 *
 * console.log(typeof syncCiBinaryPinBranch) // "function"
 * ```
 *
 * @param request - The checkout, base ref, resolved release and release list.
 * @returns The decision; `merged` leaves a new local head to push.
 * @category use-cases
 * @since 0.0.0
 */
export const syncCiBinaryPinBranch = Effect.fn("Ci.syncCiBinaryPinBranch")(function* (input: CiBinaryPinSyncRequest) {
  return yield* withoutRepoHooks(syncBranch(input));
});

const syncBranch = Effect.fnUntraced(function* (input: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const request = CiBinaryPinSyncRequest.make({
    cwd: input.cwd,
    base: input.base,
    pin: input.pin,
    releases: input.releases,
    file: path.relative(input.cwd, path.resolve(input.cwd, input.file)),
    output: input.output,
  });
  const dirty = yield* git.status(request.cwd).pipe(Effect.mapError(gitFailure(request)));
  if (A.isReadonlyArrayNonEmpty(dirty)) {
    return yield* CiCommandError.make({
      message: `${request.cwd} has local changes (${A.join(
        A.map(dirty, (entry) => entry.path),
        ", "
      )}); the sync needs a clean checkout of the pin-bump branch, so nothing was changed.`,
    });
  }
  const target = yield* resolveSyncTarget(request);
  if (O.isNone(target)) {
    const stale = yield* classifyStale(request);
    return yield* finish(request, stale);
  }
  const containsBase = yield* git
    .isAncestor(request.cwd, request.base, "HEAD")
    .pipe(Effect.mapError(gitFailure(request)));
  const extras = yield* branchExtras(request);
  const pinOnly = A.isReadonlyArrayEmpty(extras);
  if (containsBase) {
    return yield* finish(request, syncResult("current", target, O.none(), pinOnly));
  }
  const beyond = yield* pinFileBeyondPinLines(request);
  if (beyond) {
    return yield* finish(request, syncResult("blocked", target, O.some(beyondPinLinesReason(request))));
  }
  const incoming = yield* git
    .changedFiles(request.cwd, { base: "HEAD", head: request.base, twoDot: true, diffFilter: "A", noRenames: true })
    .pipe(Effect.mapError(gitFailure(request)));
  const occupied = yield* Effect.filter(incoming, (file) =>
    fs.exists(path.join(request.cwd, file)).pipe(Effect.mapError(gitFailure(request)))
  );
  if (A.isReadonlyArrayNonEmpty(occupied)) {
    return yield* CiCommandError.make({
      message: `${request.cwd} has untracked or ignored files at paths the merge would add (${A.join(occupied, ", ")}); nothing was changed.`,
    });
  }
  const before = yield* git.revParse(request.cwd, "HEAD").pipe(Effect.mapError(gitFailure(request)));
  const restore = git.reset(request.cwd, { mode: "hard", ref: before }).pipe(Effect.mapError(gitFailure(request)));
  const restoreFailure = yield* Ref.make(O.none<CiCommandError>());
  const restoreOnExit = restore.pipe(Effect.catch((resetError) => Ref.set(restoreFailure, O.some(resetError))));
  const withRestoreReport = (error: CiCommandError) =>
    Effect.flatMap(Ref.get(restoreFailure), (failed) =>
      Effect.fail(
        O.match(failed, {
          onNone: () => error,
          onSome: (resetError) =>
            CiCommandError.make({
              message: `${error.message} Restoring ${before} also failed (${resetError.message}); the checkout may be mid-merge.`,
            }),
        })
      )
    );
  const result = yield* mergeAndClassify(request, before, target.value).pipe(
    Effect.map((merged) => syncResult(merged.outcome, merged.pin, merged.reason, pinOnly)),
    Effect.tap((merged) => (merged.outcome === "merged" ? publish(request, merged) : Effect.void)),
    Effect.onError(() => restoreOnExit),
    Effect.catch(withRestoreReport)
  );
  if (result.outcome !== "merged") {
    yield* restore;
    yield* publish(request, result);
  }
  return result;
});

const runBinaryPinSync = Effect.fn("Ci.binaryPinSync")(function* (options: {
  readonly tag: string;
  readonly sha256: string;
  readonly releases: string;
  readonly cwd: string;
  readonly base: string;
  readonly file: string;
  readonly output: O.Option<string>;
}) {
  const pin = yield* decodeCiBinaryPinFlags(options);
  const fs = yield* FileSystem.FileSystem;
  const releases = yield* fs.readFileString(options.releases).pipe(
    Effect.mapError(CiCommandError.new(`Failed to read ${options.releases}.`)),
    Effect.flatMap(decodeReleases),
    Effect.mapError((error) =>
      S.is(CiCommandError)(error) ? error : CiCommandError.make({ message: `Invalid release list: ${error.message}` })
    )
  );
  const result = yield* syncCiBinaryPinBranch(
    CiBinaryPinSyncRequest.make({
      cwd: options.cwd,
      base: options.base,
      pin,
      releases,
      file: options.file,
      output: options.output,
    })
  );
  yield* Console.log(`${options.cwd}: pin-bump branch sync against ${options.base}: ${result.outcome}.`);
});

/**
 * `beep ci binary-pin-sync --cwd <checkout> --tag <beep-ci-...> --sha256 <hex> --releases <json> [--base <ref>] [--output <file>]`.
 *
 * **Details**
 *
 * Runs {@link syncCiBinaryPinBranch} and appends `outcome=<...>`, the kept
 * pin (`tag=`, `sha256=`) and a blocked `reason=` to `--output` (a
 * `$GITHUB_OUTPUT` style file) when given. It never pushes: the workflow
 * pushes a `merged` head with the pin-bump App token, and supersedes or
 * reports the other outcomes.
 *
 * The pin written is the one a superseding pull request carries, and line breaks in a reason (a
 * path may hold one) are flattened so it stays one `reason=` record.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciBinaryPinSyncCommand } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 *
 * console.log(ciBinaryPinSyncCommand.name) // "binary-pin-sync"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciBinaryPinSyncCommand = Command.make(
  "binary-pin-sync",
  {
    tag: Flag.String("tag").pipe(Flag.withDescription("Newest release tag (beep-ci-<12 hex>)")),
    sha256: Flag.String("sha256").pipe(Flag.withDescription("sha256 of the newest release's beep-linux-x64 asset")),
    releases: Flag.String("releases").pipe(
      Flag.withDescription("JSON file from `gh release list --json tagName,createdAt` (beep-ci-* rows)")
    ),
    cwd: Flag.String("cwd").pipe(Flag.withDescription("Checkout of the pin-bump branch head")),
    base: Flag.String("base").pipe(Flag.withDefault("origin/main"), Flag.withDescription("Ref to merge in")),
    file: Flag.String("file").pipe(
      Flag.withDefault(CI_BINARY_PIN_FILE),
      Flag.withDescription("Pin file, relative to --cwd")
    ),
    output: Flag.String("output").pipe(
      Flag.optional,
      Flag.withDescription("File to append outcome=, tag=, sha256= and reason= lines to")
    ),
  },
  (options) => runBinaryPinSync(options).pipe(Effect.catchTag("CiCommandError", reportCiCommandError))
).pipe(Command.withDescription("Merge main into the pin-bump branch checkout without moving its pin backwards"));
