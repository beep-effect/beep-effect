/**
 * Live terminal-lane probe for residue reap: git, `gh`, `/proc` and the session ledger.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isPathWithinRoot } from "@beep/file-processing/PathSafety";
import { Git } from "@beep/git/Git";
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
  runRepoCommandCapture,
  scanProcessAttachments,
} from "../../../internal/repo-run/index.ts";
import { openSessionRows } from "../../Session/Session.schemas.ts";
import { layerSessionLedgerLive, SessionLedger } from "../../Session/SessionLedger.service.ts";
import { detectPrRepository } from "../../Yeet/internal/ProvenanceFooter.ts";
import { mergedPullRequestsForBranch } from "../Worktree.service.ts";
import { ResidueTerminalLaneAuthority } from "./ResidueReap.schemas.ts";
import { ResidueTerminalLaneProbe } from "./ResidueTerminalLane.ts";
import type * as Config from "effect/Config";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { WorktreeMergedPullRequest } from "../Worktree.service.ts";
import type { ResidueTerminalLaneProbeShape } from "./ResidueTerminalLane.ts";

const decodeGitObjectId = S.decodeUnknownEffect(GitObjectId);

/**
 * Source of a branch's merged pull requests, newest first; `None` when it cannot answer.
 *
 * **Example** (Describe a source with no merged pull requests)
 *
 * ```ts
 * import type { ResidueTerminalLanePullRequests } from "@beep/repo-cli/test/Worktree"
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
  Digest.Digest | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
>;

type ProbeRequirements =
  | Digest.Digest
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | Git
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
  const gitOutput1 = yield* gitOutput(checkout, [
    "rev-parse",
    "--path-format=absolute",
    "--show-toplevel",
    "--git-dir",
    "--git-common-dir",
  ]);
  const lines = Str.split(gitOutput1, "\n");
  const fromOption2 = yield* Effect.fromOption(A.get(lines, 0));
  const toplevel = yield* fs.realPath(fromOption2);
  const fromOption3 = yield* Effect.fromOption(A.get(lines, 1));
  const gitDir = yield* fs.realPath(fromOption3);
  const fromOption4 = yield* Effect.fromOption(A.get(lines, 2));
  const commonDir = yield* fs.realPath(fromOption4);
  yield* holds(Str.Equivalence(toplevel, checkout) && !Str.Equivalence(gitDir, commonDir));
  const isRegisteredWorktree5 = yield* isRegisteredWorktree(checkout, checkout);
  yield* holds(O.getOrElse(isRegisteredWorktree5, thunkFalse));
  return commonDir;
});

// Processes whose cwd is inside the checkout, minus the invoking CLI and its ancestry.
const liveProcessCount = Effect.fnUntraced(function* (checkout: string) {
  const scanProcessAttachments6 = yield* scanProcessAttachments({ directory: checkout, kinds: ["cwd"] });
  const attachments = yield* Effect.fromOption(scanProcessAttachments6);
  const ancestry = yield* invokerAncestryPids();
  return A.length(A.filter(attachments, (attachment) => !HashSet.has(ancestry, attachment.pid)));
});

// Open session-ledger rows (newest row per checkout not `done`) naming the checkout or a path inside it.
const liveSessionRowCount = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const ledger = yield* SessionLedger;
  const detectPrRepository13 = yield* detectPrRepository(checkout);
  const list7 = yield* ledger.list(detectPrRepository13);
  const rows = openSessionRows(list7);
  const named = yield* Effect.filter(rows, (row) =>
    fs.realPath(row.checkout).pipe(
      Effect.orElseSucceed(() => path.resolve(row.checkout)),
      Effect.map((resolved) => isPathWithinRoot(checkout, resolved))
    )
  );
  return A.length(named);
});

const ancestorOf = (checkout: string, head: string) => (pullRequest: WorktreeMergedPullRequest) =>
  Effect.flatMap(Git, (git) => git.isAncestor(checkout, head, pullRequest.headRefOid)).pipe(
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
  const gitOutput8 = yield* gitOutput(checkout, ["rev-parse", "--verify", "HEAD"]);
  const head = yield* decodeGitObjectId(gitOutput8);
  const gitOutput9 = yield* gitOutput(checkout, [
    "--no-optional-locks",
    "status",
    "--porcelain",
    "--untracked-files=all",
    "--ignore-submodules=none",
  ]);
  yield* holds(Str.isEmpty(gitOutput9));
  const liveProcessCount10 = yield* liveProcessCount(checkout);
  yield* holds(N.Equivalence(liveProcessCount10, 0));
  const liveSessionRowCount11 = yield* liveSessionRowCount(checkout);
  yield* holds(N.Equivalence(liveSessionRowCount11, 0));
  const pullRequests12 = yield* pullRequests(checkout, branch);
  const merged = yield* Effect.fromOption(pullRequests12);
  const equal = A.findFirst(merged, (pullRequest) => Str.Equivalence(pullRequest.headRefOid, head));
  const proof = O.isSome(equal)
    ? O.some({ pullRequest: equal.value, headRelation: "equal" as const })
    : yield* Effect.map(Effect.findFirst(merged, ancestorOf(checkout, head)), (value) =>
        O.map(value, (pullRequest) => ({
          pullRequest,
          headRelation: "ancestor" as const,
        }))
      );
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
 * import { makeResidueTerminalLaneProbe } from "@beep/repo-cli/test/Worktree"
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
 * import { ResidueTerminalLaneProbeLive } from "@beep/repo-cli/test/Worktree"
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
  | Digest.Digest
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | FileSystem.FileSystem
  | Path.Path
  | Git
> = Layer.effect(ResidueTerminalLaneProbe, makeResidueTerminalLaneProbe()).pipe(Layer.provide(layerSessionLedgerLive));
