/**
 * Live terminal-lane probe for residue reap: git, `gh`, `/proc` and the session ledger.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isPathWithinRoot } from "@beep/file-processing/PathSafety";
import { GitObjectId } from "@beep/schema/Conformance";
import { thunkFalse } from "@beep/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  invokerAncestryPids,
  isRegisteredWorktree,
  ResidueTerminalLaneAuthority,
  ResidueTerminalLaneProbe,
  runRepoCommandCapture,
  scanProcessAttachments,
} from "../../../internal/repo-run/index.ts";
import { openSessionRows } from "../../Session/Session.schemas.ts";
import { layerSessionLedgerLive, SessionLedger } from "../../Session/SessionLedger.service.ts";
import { mergedPullRequestsForBranch } from "../../Worktree/Worktree.service.ts";
import { detectPrRepository } from "../../Yeet/internal/ProvenanceFooter.ts";
import type * as Config from "effect/Config";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ResidueTerminalLaneProbeShape } from "../../../internal/repo-run/index.ts";
import type { WorktreeMergedPullRequest } from "../../Worktree/Worktree.service.ts";

const decodeGitObjectId = S.decodeUnknownEffect(GitObjectId);

/**
 * Source of a branch's merged pull requests, newest first; `None` when it cannot answer.
 *
 * **Example** (Describe a source with no merged pull requests)
 *
 * ```ts
 * import type { ResidueTerminalLanePullRequests } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * const none: ResidueTerminalLanePullRequests = () => Effect.succeedSome([])
 * console.log(Effect.isEffect(none("/work/lane", "feat/lane"))) // true
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export type ResidueTerminalLanePullRequests = (
  cwd: string,
  branch: string
) => Effect.Effect<
  O.Option<ReadonlyArray<WorktreeMergedPullRequest>>,
  never,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
>;

type ProbeRequirements =
  | Crypto.Crypto
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | SessionLedger;

// Trimmed stdout of a clean, untruncated zero-exit git run; a NoSuchElementError otherwise.
const gitOutput = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const capture = yield* runRepoCommandCapture("git", args, cwd);
  return yield* Effect.fromOption(
    O.liftPredicate(capture, (result) => N.Equivalence(result.exitCode, 0) && !result.truncated)
  ).pipe(Effect.map((result) => Str.trim(result.output)));
});

// A failed check ends the proof the way a missing fact does.
const holds = (condition: boolean) => (condition ? Effect.void : Effect.fromOption(O.none()));

// The checkout's toplevel, git dir and common dir; only a registered linked worktree passes.
const linkedLayout = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const lines = Str.split(
    yield* gitOutput(checkout, [
      "rev-parse",
      "--path-format=absolute",
      "--show-toplevel",
      "--git-dir",
      "--git-common-dir",
    ]),
    "\n"
  );
  const toplevel = yield* fs.realPath(yield* Effect.fromOption(A.get(lines, 0)));
  const gitDir = yield* fs.realPath(yield* Effect.fromOption(A.get(lines, 1)));
  const commonDir = yield* fs.realPath(yield* Effect.fromOption(A.get(lines, 2)));
  yield* holds(Str.Equivalence(toplevel, checkout) && !Str.Equivalence(gitDir, commonDir));
  yield* holds(O.getOrElse(yield* isRegisteredWorktree(checkout, checkout), thunkFalse));
  return commonDir;
});

// Processes whose cwd is inside the checkout, minus the invoking CLI and its ancestry.
const liveProcessCount = Effect.fnUntraced(function* (checkout: string) {
  const attachments = yield* Effect.fromOption(yield* scanProcessAttachments({ directory: checkout, kinds: ["cwd"] }));
  const ancestry = yield* invokerAncestryPids();
  return A.length(A.filter(attachments, (attachment) => !HashSet.has(ancestry, attachment.pid)));
});

// Open session-ledger rows (newest row per checkout not `done`) naming the checkout or a path inside it.
const liveSessionRowCount = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledger = yield* SessionLedger;
  const rows = openSessionRows(yield* ledger.list(yield* detectPrRepository(checkout)));
  const named = yield* Effect.filter(rows, (row) =>
    fs.realPath(row.checkout).pipe(
      Effect.orElseSucceed(() => path.resolve(row.checkout)),
      Effect.map((resolved) => isPathWithinRoot(checkout, resolved))
    )
  );
  return A.length(named);
});

const ancestorOf = (checkout: string, head: string) => (pullRequest: WorktreeMergedPullRequest) =>
  runRepoCommandCapture("git", ["merge-base", "--is-ancestor", head, pullRequest.headRefOid], checkout).pipe(
    Effect.map((capture) => N.Equivalence(capture.exitCode, 0)),
    Effect.orElseSucceed(thunkFalse)
  );

const proveTerminalLane = Effect.fnUntraced(function* (
  checkoutRoot: string,
  pullRequests: ResidueTerminalLanePullRequests
) {
  const fs = yield* FileSystem.FileSystem;
  const checkout = yield* fs.realPath(checkoutRoot);
  const commonDir = yield* linkedLayout(checkout);
  const branch = yield* gitOutput(checkout, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  const head = yield* decodeGitObjectId(yield* gitOutput(checkout, ["rev-parse", "--verify", "HEAD"]));
  yield* holds(
    Str.isEmpty(
      yield* gitOutput(checkout, [
        "--no-optional-locks",
        "status",
        "--porcelain",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ])
    )
  );
  yield* holds(N.Equivalence(yield* liveProcessCount(checkout), 0));
  yield* holds(N.Equivalence(yield* liveSessionRowCount(checkout), 0));
  const merged = yield* Effect.fromOption(yield* pullRequests(checkout, branch));
  const equal = A.findFirst(merged, (pullRequest) => Str.Equivalence(pullRequest.headRefOid, head));
  const proof = O.isSome(equal)
    ? O.some({ pullRequest: equal.value, headRelation: "equal" as const })
    : O.map(yield* Effect.findFirst(merged, ancestorOf(checkout, head)), (pullRequest) => ({
        pullRequest,
        headRelation: "ancestor" as const,
      }));
  const { pullRequest, headRelation } = yield* Effect.fromOption(proof);
  return ResidueTerminalLaneAuthority.make({
    checkoutRoot,
    commonDir,
    branch,
    pullRequest: pullRequest.number,
    pullRequestHead: yield* decodeGitObjectId(pullRequest.headRefOid),
    head,
    headRelation,
    verifiedAt: yield* DateTime.now,
  });
});

/**
 * Build the live terminal-lane probe.
 *
 * **Details**
 *
 * `verify` proves, in order: the checkout is a registered linked worktree (not
 * the primary clone) on a branch, its tree is clean, no process outside the
 * invoking CLI's ancestry has its cwd inside it, no open session-ledger row
 * names it, and its branch has a merged pull request whose head equals HEAD
 * or descends from it. Every git, `/proc`, ledger or `gh` failure answers
 * `None`. `pullRequests` defaults to
 * `gh pr list --head <branch> --state merged`; tests substitute a fixture source.
 *
 * **Example** (Build the probe effect)
 *
 * ```ts
 * import { makeResidueTerminalLaneProbe } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeResidueTerminalLaneProbe())) // true
 * ```
 *
 * @param pullRequests - Source of a branch's merged pull requests.
 * @returns The probe service, capturing the platform services and session ledger it reads.
 * @category constructors
 * @since 0.0.0
 */
export const makeResidueTerminalLaneProbe = Effect.fnUntraced(function* (
  pullRequests: ResidueTerminalLanePullRequests = mergedPullRequestsForBranch
): Effect.fn.Return<ResidueTerminalLaneProbeShape, never, ProbeRequirements> {
  const context = yield* Effect.context<ProbeRequirements>();
  return ResidueTerminalLaneProbe.of({
    verify: Effect.fn("ResidueTerminalLaneProbe.verify")((checkoutRoot: string) =>
      proveTerminalLane(checkoutRoot, pullRequests).pipe(Effect.option, Effect.provideContext(context))
    ),
  });
});

/**
 * Live terminal-lane probe layer over git, `gh`, `/proc` and the live session ledger.
 *
 * **Details**
 *
 * The layer fails with the session ledger's `ConfigError` when the ledger
 * location cannot be resolved, the same configuration residue reap already
 * needs for `HOME`.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { ResidueTerminalLaneProbeLive } from "@beep/repo-cli/test/Quality"
 *
 * console.log(typeof ResidueTerminalLaneProbeLive) // "object"
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ResidueTerminalLaneProbeLive: Layer.Layer<
  ResidueTerminalLaneProbe,
  Config.ConfigError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> = Layer.effect(ResidueTerminalLaneProbe, makeResidueTerminalLaneProbe()).pipe(Layer.provide(layerSessionLedgerLive));
