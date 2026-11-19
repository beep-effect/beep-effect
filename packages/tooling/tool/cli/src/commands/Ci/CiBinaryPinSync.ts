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
import { Git, MergeConflictError } from "@beep/git/Git";
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
import * as S from "effect/Schema";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import { CI_BINARY_PIN_FILE, CiBinaryPin, decodeCiBinaryPinFlags, rewriteCiBinaryPin } from "./CiBinaryPin.ts";

const $I = $RepoCliId.create("commands/Ci/CiBinaryPinSync");

/**
 * What `beep ci binary-pin-sync` decided for the pin-bump branch checkout.
 *
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
 * Type for {@link CiBinaryPinSyncOutcome}.
 *
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
 * const result = CiBinaryPinSyncResult.make({ outcome: "stale", pin: O.none(), reason: O.none() })
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
  }).pipe($I.annoteSchema("CiBinaryPinSyncResult", { description: "The decision of one pin-bump branch sync." }))
) {}

const syncResult = (outcome: CiBinaryPinSyncOutcome, pin: O.Option<CiBinaryPin>, reason = O.none<string>()) =>
  CiBinaryPinSyncResult.make({ outcome, pin, reason });

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

// The creation time of a listed release. An unlisted tag, or a creation time another release shares,
// cannot be ordered, so it fails closed instead of reading as "older" (which would let a reset move a
// pin backwards).
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

// The `git status` porcelain XY codes of an unmerged path (git-status(1), "Unmerged").
const isUnmergedCode = S.is(S.Literals(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]));
const isUnmerged = (entry: { readonly x: string; readonly y: string }): boolean =>
  isUnmergedCode(`${entry.x}${entry.y}`);

/**
 * The inputs of one pin-bump branch sync.
 *
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
  }).pipe($I.annoteSchema("CiBinaryPinSyncRequest", { description: "The inputs of one pin-bump branch sync." }))
) {}

const gitFailure = (request: CiBinaryPinSyncRequest) => CiCommandError.new(`git failed in ${request.cwd}.`);

const readPinFile = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.resolve(request.cwd, request.file);
  return yield* fs.readFileString(file).pipe(Effect.mapError(CiCommandError.new(`Failed to read ${file}.`)));
});

// The resolved release when the branch pins it exactly; the branch's own pin when it is a newer
// release (the sync then only merges main under it); otherwise none, which is `stale`. A branch tag
// the release list does not hold, or a tied creation time, fails: nothing is changed.
const resolveSyncTarget = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const branchText = yield* readPinFile(request);
  const branch = yield* rewriteCiBinaryPin(branchText, request.pin);
  if (branch.previousTag === request.pin.tag && branch.previousSha256 === request.pin.sha256) {
    return O.some(request.pin);
  }
  const branchPin = yield* decodeCiBinaryPin({ tag: branch.previousTag, sha256: branch.previousSha256 }).pipe(
    Effect.option
  );
  const newestAt = yield* orderedAt(request.releases, request.pin.tag);
  if (O.isNone(branchPin) || branchPin.value.tag === request.pin.tag) {
    return O.none<CiBinaryPin>();
  }
  const branchAt = yield* orderedAt(request.releases, branchPin.value.tag);
  return DateTime.isGreaterThan(branchAt, newestAt) ? branchPin : O.none<CiBinaryPin>();
});

// Merge the base ref in. Returns whether the merge stopped on conflicts and the conflicted paths
// outside the pin file, which the sync cannot resolve.
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

// Set the pin file to the base's text with only the two pinned lines changed, and commit when that
// differs from the merged file (always after a conflict, which concludes the merge commit).
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
  if (!conflicted && merged === resolved.text) {
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

// What the branch holds beyond main: files changed since the merge base other than the pin file, and
// whether the pin file differs from the merge base outside the two pinned lines.
const branchExtras = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const changed = yield* git
    .changedFiles(request.cwd, { base: request.base, head: "HEAD" })
    .pipe(Effect.mapError(gitFailure(request)));
  const others = A.filter(changed, (file) => file !== request.file);
  const forkPoint = yield* git.mergeBase(request.cwd, request.base, "HEAD").pipe(Effect.mapError(gitFailure(request)));
  const forkText = yield* git.show(request.cwd, forkPoint, request.file).pipe(Effect.mapError(gitFailure(request)));
  const branchText = yield* readPinFile(request);
  const branchPinned = yield* rewriteCiBinaryPin(branchText, request.pin);
  const forkPinned = yield* O.match(forkText, {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: (text) => Effect.map(rewriteCiBinaryPin(text, request.pin), (rewritten) => O.some(rewritten.text)),
  });
  // Rewriting both sides to the same pin leaves only the differences outside the two pinned lines.
  const pinLinesOnly = O.exists(forkPinned, (text) => text === branchPinned.text);
  return pinLinesOnly ? others : A.append(others, `${request.file} beyond the two pinned lines`);
});

// A stale branch is bumped by create-pull-request, which force-updates it to main plus the pin commit.
// That update carries every workflow change main made since the branch was cut, which the pin-bump App
// (no `workflows` permission) may not push onto an existing branch: a pin-only branch is superseded
// with the newest release instead, and one holding anything else is blocked while that release waits.
const classifyStale = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const workflows = yield* git
    .changedFiles(request.cwd, { base: "HEAD", head: request.base, twoDot: true, pathspec: [WORKFLOWS_PATH] })
    .pipe(Effect.mapError(gitFailure(request)));
  if (A.isReadonlyArrayEmpty(workflows)) {
    return syncResult("stale", O.none());
  }
  const extras = yield* branchExtras(request);
  return A.isReadonlyArrayEmpty(extras)
    ? syncResult("supersede", O.some(request.pin))
    : syncResult(
        "blocked",
        O.none(),
        O.some(
          `a newer release ${request.pin.tag} is waiting, but updating the branch to it carries workflow changes (${A.join(workflows, ", ")}), which the pin-bump App cannot push, and the branch holds changes besides the pin (${A.join(extras, ", ")}), so it cannot be superseded`
        )
      );
});

// After the merge: a merge that carries no workflow file is pushed as is. One that does can only
// replace the branch, which is safe only while the branch holds nothing but the pin.
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

// Merge the base in and decide; a conflict outside the pin file is `blocked` before anything commits.
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
 * release, fails before anything changes: its order cannot be decided. The checkout needs `pull.rebase=false`, a committer
 * identity, and enough history for a merge base.
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
export const syncCiBinaryPinBranch = Effect.fn("Ci.syncCiBinaryPinBranch")(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const target = yield* resolveSyncTarget(request);
  if (O.isNone(target)) {
    return yield* classifyStale(request);
  }
  const containsBase = yield* git
    .isAncestor(request.cwd, request.base, "HEAD")
    .pipe(Effect.mapError(gitFailure(request)));
  if (containsBase) {
    return syncResult("current", target);
  }
  const before = yield* git.revParse(request.cwd, "HEAD").pipe(Effect.mapError(gitFailure(request)));
  // `reset --hard` to the pre-merge head also ends an unfinished merge (conflict markers, MERGE_HEAD).
  const restore = git.reset(request.cwd, { mode: "hard", ref: before }).pipe(Effect.mapError(gitFailure(request)));
  const result = yield* mergeAndClassify(request, before, target.value).pipe(
    Effect.onError(() => Effect.ignore(restore))
  );
  if (result.outcome !== "merged") {
    yield* restore;
  }
  return result;
});

// `key=value` lines for the workflow step; the pin is the one a superseding pull request carries.
const renderSyncOutput = (result: CiBinaryPinSyncResult): string =>
  A.join(
    [
      `outcome=${result.outcome}`,
      ...O.match(result.pin, { onNone: () => [], onSome: (pin) => [`tag=${pin.tag}`, `sha256=${pin.sha256}`] }),
      ...O.match(result.reason, { onNone: () => [], onSome: (reason) => [`reason=${reason}`] }),
      "",
    ],
    "\n"
  );

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
    CiBinaryPinSyncRequest.make({ cwd: options.cwd, base: options.base, pin, releases, file: options.file })
  );
  yield* O.match(options.output, {
    onNone: () => Effect.void,
    onSome: (output) =>
      fs
        .writeFileString(output, renderSyncOutput(result), { flag: "a" })
        .pipe(Effect.mapError(CiCommandError.new(`Failed to write ${output}.`))),
  });
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
