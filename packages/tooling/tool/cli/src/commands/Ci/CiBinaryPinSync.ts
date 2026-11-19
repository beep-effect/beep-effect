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
 * so the pull request keeps its number and its review history.
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
 * What `beep ci binary-pin-sync` did to the pin-bump branch checkout.
 *
 * **Details**
 *
 * - `stale`: the branch pins an older release than the one resolved, or the
 *   right tag with another sha256. Nothing changed; the workflow re-runs the
 *   pin bump, which retitles the pull request for the new release.
 * - `current`: the branch already contains main and pins the resolved
 *   release (or a newer one). Nothing changed and nothing is pushed.
 * - `merged`: the branch was behind main or in conflict with it. Main is now
 *   merged in with the pin resolved, and the workflow pushes the new head.
 *
 * **Example** (Check an outcome)
 *
 * ```ts
 * import { CiBinaryPinSyncOutcome } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync"
 *
 * console.log(CiBinaryPinSyncOutcome.is.merged("merged")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiBinaryPinSyncOutcome = LiteralKit(["stale", "current", "merged"]).pipe(
  $I.annoteSchema("CiBinaryPinSyncOutcome", {
    title: "CI Binary Pin Sync Outcome",
    description: "What the pin-bump branch sync did: nothing (stale or current) or a merge of main.",
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

// A pin is newer only when both releases are listed and the branch's was created later.
const isNewerRelease = (releases: ReadonlyArray<BeepCiRelease>, candidate: string, than: string): boolean =>
  O.match(O.all([createdAt(releases, candidate), createdAt(releases, than)]), {
    onNone: () => false,
    onSome: ([candidateAt, thanAt]) => DateTime.isGreaterThan(candidateAt, thanAt),
  });

// `git status` porcelain codes for an unmerged path: either side `U`, or both added / both deleted.
const isUnmerged = (entry: { readonly x: string; readonly y: string }): boolean =>
  entry.x === "U" || entry.y === "U" || (entry.x === entry.y && (entry.x === "A" || entry.x === "D"));

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
// release (the sync then only merges main under it); otherwise none, which is `stale`.
const resolveSyncTarget = Effect.fnUntraced(function* (request: CiBinaryPinSyncRequest) {
  const branchText = yield* readPinFile(request);
  const branch = yield* rewriteCiBinaryPin(branchText, request.pin);
  if (branch.previousTag === request.pin.tag && branch.previousSha256 === request.pin.sha256) {
    return O.some(request.pin);
  }
  const branchPin = yield* decodeCiBinaryPin({ tag: branch.previousTag, sha256: branch.previousSha256 }).pipe(
    Effect.option
  );
  return O.filter(branchPin, (pin) => isNewerRelease(request.releases, pin.tag, request.pin.tag));
});

// Merge the base ref in; true when the merge stopped on conflicts, which must all be in the pin file.
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
  const others = A.filter(status, (entry) => isUnmerged(entry) && path.resolve(request.cwd, entry.path) !== pinFile);
  if (A.isReadonlyArrayNonEmpty(others)) {
    const paths = A.join(
      A.map(others, (entry) => entry.path),
      ", "
    );
    return yield* CiCommandError.make({
      message: `Merging ${request.base} conflicts outside ${request.file}: ${paths}. Nothing was committed; resolve the pin-bump branch by hand.`,
    });
  }
  return conflicted;
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

/**
 * Merge `base` into a pin-bump branch checkout when it is behind or in conflict, never moving the pin backwards.
 *
 * **Details**
 *
 * The branch's pin decides the target. The resolved release (same tag and
 * sha256) is kept. A newer release (by creation time) is kept as it is, so
 * the sync only merges main. Anything else is `stale` and nothing changes.
 * When `base` is already an ancestor of `HEAD` the result is `current`.
 * Otherwise `git pull . <base>` merges it. A conflict is resolved only in the
 * pin file: the merged file is `base`'s text with the two pinned lines set to
 * the target. A conflict in any other path fails with a `CiCommandError` and
 * nothing is committed. The checkout needs `pull.rebase=false`, a committer
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
 * @returns The outcome; `merged` leaves a new local head to push.
 * @category use-cases
 * @since 0.0.0
 */
export const syncCiBinaryPinBranch = Effect.fn("Ci.syncCiBinaryPinBranch")(function* (request: CiBinaryPinSyncRequest) {
  const git = yield* Git;
  const target = yield* resolveSyncTarget(request);
  if (O.isNone(target)) {
    return "stale" satisfies CiBinaryPinSyncOutcome;
  }
  const containsBase = yield* git
    .isAncestor(request.cwd, request.base, "HEAD")
    .pipe(Effect.mapError(gitFailure(request)));
  if (containsBase) {
    return "current" satisfies CiBinaryPinSyncOutcome;
  }
  const conflicted = yield* mergeBase(request);
  yield* commitResolvedPin(request, target.value, conflicted);
  return "merged" satisfies CiBinaryPinSyncOutcome;
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
  const outcome = yield* syncCiBinaryPinBranch(
    CiBinaryPinSyncRequest.make({ cwd: options.cwd, base: options.base, pin, releases, file: options.file })
  );
  yield* O.match(options.output, {
    onNone: () => Effect.void,
    onSome: (output) =>
      fs
        .writeFileString(output, `outcome=${outcome}\n`, { flag: "a" })
        .pipe(Effect.mapError(CiCommandError.new(`Failed to write ${output}.`))),
  });
  yield* Console.log(`${options.cwd}: pin-bump branch sync against ${options.base}: ${outcome}.`);
});

/**
 * `beep ci binary-pin-sync --cwd <checkout> --tag <beep-ci-...> --sha256 <hex> --releases <json> [--base <ref>] [--output <file>]`.
 *
 * **Details**
 *
 * Runs {@link syncCiBinaryPinBranch} and appends `outcome=<stale|current|merged>`
 * to `--output` (the step's `$GITHUB_OUTPUT` style file) when given. It never
 * pushes; the workflow pushes a `merged` head with the pin-bump App token.
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
      Flag.withDescription("File to append outcome=<stale|current|merged> to")
    ),
  },
  (options) => runBinaryPinSync(options).pipe(Effect.catchTag("CiCommandError", reportCiCommandError))
).pipe(Command.withDescription("Merge main into the pin-bump branch checkout without moving its pin backwards"));
