/**
 * Live terminal-lane probe for residue reap: git, GitHub, `/proc` and the session ledger.
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
import { invokerAncestryPids, isRegisteredWorktree, scanProcessAttachments } from "../../../internal/repo-run/index.ts";
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

// A failed check ends the proof the way a missing fact does.
const holds = (condition: boolean) => (condition ? Effect.void : Effect.fromOption(O.none()));

// The checkout's toplevel, git dir and common dir; only a registered linked worktree passes.
const linkedLayout = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const git = yield* Git;
  // Any git failure ends the proof, as a missing fact does.
  const toplevel = yield* fs.realPath(yield* git.repoRoot(checkout));
  const gitDir = yield* fs.realPath(yield* git.gitDir(checkout));
  const commonDir = yield* fs.realPath(yield* git.commonDir(checkout));
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
  // A detached HEAD has no branch: `None` ends the proof as symbolic-ref's failure did.
  const git = yield* Git;
  const branch = yield* Effect.fromOption(yield* git.currentBranch(checkout));
  const head = yield* decodeGitObjectId(yield* git.revParse(checkout, "HEAD"));
  yield* holds(
    A.isReadonlyArrayEmpty(
      yield* git.status(checkout, { noOptionalLocks: true, untrackedFiles: "all", ignoreSubmodules: "none" })
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
 * or descends from it. Every git, `/proc`, ledger or GitHub failure answers
 * `None`. `pullRequests` defaults to {@link mergedPullRequestsForBranch} (the
 * branch's merged pull requests through the GitHub REST API); tests substitute
 * a fixture source.
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
 * Live terminal-lane probe layer over git, GitHub, `/proc` and the live session ledger.
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
