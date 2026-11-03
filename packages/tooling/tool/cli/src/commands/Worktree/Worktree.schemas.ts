/**
 * Schema family for the Worktree command suite.
 *
 * Leaf module (Goals-family pattern): it imports nothing from the command or
 * service modules, so `Fleet.service.ts`, `Fleet.command.ts`, and
 * `Worktree.command.ts` can all depend on it without forming an import cycle.
 * Hosts the `git worktree list --porcelain` row and parser shared by `doctor`
 * and the fleet scan, plus the fleet-mirror schema family.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { PosInt } from "@beep/repo-cli-kit/schema/PosInt";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { IsoDateTimeString } from "@beep/skill-contract";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ProcessPid } from "../../internal/repo-run/ProcessTable.ts";
import type { WorktreeEntry } from "@beep/git/Git";

const $I = $RepoCliId.create("commands/Worktree/Worktree.schemas");

const TrimmedNonEmptyString = S.Trim.check(S.isNonEmpty({ message: "String must not be empty" }));

const REFS_HEADS_PREFIX = "refs/heads/";

/**
 * One parsed entry from `git worktree list --porcelain`.
 *
 * **Example** (Construct a listing entry)
 *
 * ```ts
 * import { WorktreeListEntry } from "@beep/repo-cli/commands/Worktree"
 *
 * const entry = WorktreeListEntry.make({
 *   path: "/repo",
 *   head: "abc123",
 *   branch: "main",
 *   detached: false,
 *   locked: false,
 *   prunable: false,
 * })
 * console.log(entry.path)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeListEntry extends S.Opaque<WorktreeListEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString.check(S.isPattern(/^[^\x00-\x1f\x7f]+$/u)),
    head: S.NullOr(S.String),
    branch: S.NullOr(S.String),
    detached: S.Boolean,
    locked: S.Boolean,
    prunable: S.Boolean,
  }).pipe(
    $I.annoteSchema("WorktreeListEntry", {
      description: "One parsed entry from git worktree list --porcelain.",
    })
  )
) {}

/**
 * Why a worktree retirement needed preservation before removal.
 *
 * **Example** (Identify combined residue)
 *
 * ```ts
 * import { WorktreeResidueReason } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WorktreeResidueReason.Enum["dirty+unpushed"]) // "dirty+unpushed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreeResidueReason = LiteralKit(["dirty", "unpushed-commits", "dirty+unpushed", "clean"]).pipe(
  $I.annoteSchema("WorktreeResidueReason", {
    description: "Reason a worktree retirement did or did not require residue preservation.",
  })
);

/**
 * Decoded worktree-residue reason.
 *
 * @see {@link WorktreeResidueReason} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeResidueReason = typeof WorktreeResidueReason.Type;

/**
 * Preservation step reported when archive retirement fails before removal.
 *
 * **Example** (Name a failed preservation step)
 *
 * ```ts
 * import { WorktreePreservationStep } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(WorktreePreservationStep.Enum["create-archive-ref"]) // "create-archive-ref"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreePreservationStep = LiteralKit([
  "inspect-head",
  "inspect-residue",
  "inspect-submodules",
  "inspect-origin-main",
  "inspect-upstream",
  "resolve-residue-root",
  "create-archive-ref",
  "prepare-residue",
  "write-tracked-patch",
  "copy-untracked-files",
  "preserve-beep-material",
  "restore-beep-material",
  "write-manifest",
]).pipe(
  $I.annoteSchema("WorktreePreservationStep", {
    description: "Named preservation step that can abort archive retirement before worktree removal.",
  })
);

/**
 * Decoded worktree-preservation step.
 *
 * @see {@link WorktreePreservationStep} for the runtime schema and literal helpers.
 * @category type-level
 * @since 0.0.0
 */
export type WorktreePreservationStep = typeof WorktreePreservationStep.Type;

const worktreeRepositoryHashPattern = /^[0-9a-f]{12}$/u;

/**
 * Stable short SHA-256 identity used to namespace one repository's residue.
 *
 * **Example** (Construct a repository namespace hash)
 *
 * ```ts
 * import { WorktreeRepositoryHash } from "@beep/repo-cli/commands/Worktree"
 *
 * const hash = WorktreeRepositoryHash.make("0123456789ab")
 * console.log(hash.length) // 12
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const WorktreeRepositoryHash = S.String.check(
  S.isPattern(
    worktreeRepositoryHashPattern,
    $I.annote("WorktreeRepositoryHashCheck", {
      title: "Worktree repository hash",
      description: "A lowercase 12-hex prefix of the absolute main-checkout SHA-256 digest.",
      message: "Worktree repository hash must contain exactly 12 lowercase hexadecimal characters",
    })
  )
).pipe(
  S.brand("WorktreeRepositoryHash"),
  $I.annoteSchema("WorktreeRepositoryHash", {
    description: "Stable 12-hex repository identity recorded in worktree residue manifests.",
  })
);

/**
 * Decoded short repository identity used by archive residue paths.
 *
 * @see {@link WorktreeRepositoryHash} for the runtime schema and constructor.
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeRepositoryHash = typeof WorktreeRepositoryHash.Type;

/**
 * Evidence that settled whether a branch tip was pushed once its configured
 * upstream was pruned.
 *
 * **Details**
 *
 * A pruned upstream leaves no `<ref>..HEAD` range to count, so the verdict
 * records what answered in its place. `ancestor-of-base` proves the tip is
 * reachable from the named remote default branch; `merged-pull-request`
 * proves GitHub merged a pull request whose head is exactly this tip;
 * `unverified` means neither was proven. These verdicts record evidence beside
 * the count-derived preservation decision; they do not override it. A
 * squash-merged tip still gets an archive ref when its commits are absent from
 * the default branch, even with `merged-pull-request` evidence. Only
 * `ancestor-of-base` has a zero base count, allowing clean removal when no
 * other residue needs preservation.
 *
 * **Example** (Recognize a merged-pull-request verdict)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WorktreeUpstreamVerdict } from "@beep/repo-cli/commands/Worktree"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const verdict: WorktreeUpstreamVerdict = { _tag: "merged-pull-request", number: PosInt.make(1098) }
 * console.log(WorktreeUpstreamVerdict.guards["merged-pull-request"](verdict)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreeUpstreamVerdict = S.TaggedUnion({
  "ancestor-of-base": { base: S.NonEmptyString },
  "merged-pull-request": { number: PosInt },
  unverified: {},
}).pipe(
  $I.annoteSchema("WorktreeUpstreamVerdict", {
    description: "Evidence that decided whether a branch tip was pushed once its configured upstream was pruned.",
  })
);

/**
 * Decoded upstream-verdict union.
 *
 * @see {@link WorktreeUpstreamVerdict} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeUpstreamVerdict = typeof WorktreeUpstreamVerdict.Type;

/**
 * Where a branch's configured upstream stands when unpushed commits are counted.
 *
 * **Details**
 *
 * `unset` covers detached checkouts and branches without an upstream. `live`
 * names an upstream ref that resolves, so `<ref>..HEAD` can be counted.
 * `pruned` names an upstream that branch configuration still points at but
 * that no longer exists locally: `git fetch --prune` drops
 * `refs/remotes/origin/<branch>` once the hosted branch is deleted after a
 * merge, so the {@link WorktreeUpstreamVerdict} records what answered in its
 * place.
 *
 * **Example** (Describe a pruned upstream)
 *
 * ```ts
 * import { WorktreeUpstreamState } from "@beep/repo-cli/commands/Worktree"
 *
 * const state: WorktreeUpstreamState = {
 *   _tag: "pruned",
 *   ref: "refs/remotes/origin/feat/feature-x",
 *   verdict: { _tag: "unverified" },
 * }
 * console.log(state._tag) // "pruned"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreeUpstreamState = S.TaggedUnion({
  unset: {},
  live: { ref: S.String },
  pruned: { ref: S.String, verdict: WorktreeUpstreamVerdict },
}).pipe(
  $I.annoteSchema("WorktreeUpstreamState", {
    description:
      "A branch's configured upstream as the unpushed-commit probe sees it: unset, live, or pruned after a merge with the verdict that answered instead.",
  })
);

/**
 * Decoded upstream-state union.
 *
 * @see {@link WorktreeUpstreamState} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeUpstreamState = typeof WorktreeUpstreamState.Type;

/**
 * One git-ignored `.beep` entry an archive retirement preserved, with the tree
 * digest that proves its copy or move and its restore.
 *
 * **Details**
 *
 * `digest` is the SHA-256 of the entry's sorted tree listing: one line per
 * path with its kind, and for files the size and content SHA-256, for symbolic
 * links the target. `files` and `bytes` count regular files.
 *
 * **Example** (Record a preserved entry)
 *
 * ```ts
 * import { WorktreeBeepMaterialEntry } from "@beep/repo-cli/commands/Worktree"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const entry = WorktreeBeepMaterialEntry.make({
 *   name: "fallow",
 *   files: 1,
 *   bytes: 16,
 *   digest: Sha256Hex.make("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
 * })
 * console.log(entry.name) // fallow
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeBeepMaterialEntry extends S.Opaque<WorktreeBeepMaterialEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    name: TrimmedNonEmptyString,
    files: S.Natural,
    bytes: S.Natural,
    digest: Sha256Hex,
  }).pipe(
    $I.annoteSchema("WorktreeBeepMaterialEntry", {
      description: "A preserved git-ignored .beep entry with its file count, byte size and verified tree digest.",
    })
  )
) {}

/**
 * Durable receipt for worktree state preserved before archive removal.
 *
 * **Details**
 *
 * `branch` is absent for detached worktrees and `patchPath` is absent when no
 * tracked changes differed from `HEAD`. Untracked paths remain repository
 * relative so they can be copied back without rewriting their layout.
 * `upstream` keeps the branch-upstream state the residue decision was made
 * under, so a remote branch pruned after its merge is documented next to the
 * commits it left behind. Older manifests that omit `upstream` decode as
 * `unset`; their archived files and commit references remain readable.
 *
 * **Example** (Describe archived untracked residue)
 *
 * ```ts
 * import { WorktreeRepositoryHash, WorktreeResidueManifest } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const manifest = WorktreeResidueManifest.make({
 *   name: "feature-x",
 *   branch: O.some("feat/feature-x"),
 *   head: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
 *   archivedAt: "2026-09-02T12:34:56.000Z",
 *   archiveRef: "refs/archive/worktrees/feature-x/20260902-123456",
 *   repositoryHash: WorktreeRepositoryHash.make("0123456789ab"),
 *   patchPath: O.none(),
 *   untrackedFiles: ["notes.txt"],
 *   residueRoot: "/home/operator/.cache/beep/worktree-residue/repo-0123456789ab/feature-x-20260902-123456",
 *   reason: "unpushed-commits",
 *   upstream: { _tag: "live", ref: "refs/remotes/origin/feat/feature-x" },
 * })
 * console.log(manifest.untrackedFiles.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeResidueManifest extends S.Opaque<WorktreeResidueManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: TrimmedNonEmptyString,
    branch: S.OptionFromNullOr(S.String),
    head: GitObjectId,
    archivedAt: IsoDateTimeString,
    archiveRef: S.NonEmptyString,
    repositoryHash: WorktreeRepositoryHash,
    patchPath: S.OptionFromNullOr(S.String),
    untrackedFiles: S.Array(S.String),
    materialEntries: S.Array(WorktreeBeepMaterialEntry).pipe(
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultKey(Effect.succeed([]))
    ),
    residueRoot: S.String,
    reason: WorktreeResidueReason,
    upstream: WorktreeUpstreamState.pipe(
      S.withDecodingDefaultKey(Effect.succeed(WorktreeUpstreamState.cases.unset.make({})))
    ),
  }).pipe(
    $I.annoteSchema("WorktreeResidueManifest", {
      description:
        "Durable receipt for a worktree HEAD, tracked patch, copied untracked files, preserved `.beep` material entries, and branch-upstream state preserved before removal.",
    })
  )
) {}

/**
 * Deterministic archive-ref and residue paths for one retirement attempt.
 *
 * **Example** (Construct a retirement layout)
 *
 * ```ts
 * import { WorktreeArchivePlan } from "@beep/repo-cli/commands/Worktree"
 *
 * const plan = WorktreeArchivePlan.make({
 *   archiveRef: "refs/archive/worktrees/feature-x/20260902-123456",
 *   residueRoot: "/cache/repo-0123456789ab/feature-x-20260902-123456",
 *   patchPath: "/cache/repo-0123456789ab/feature-x-20260902-123456/tracked.patch",
 *   untrackedRoot: "/cache/repo-0123456789ab/feature-x-20260902-123456/untracked",
 *   materialRoot: "/cache/repo-0123456789ab/feature-x-20260902-123456/beep-material",
 *   manifestPath: "/cache/repo-0123456789ab/feature-x-20260902-123456/manifest.json",
 * })
 * console.log(plan.manifestPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeArchivePlan extends S.Opaque<WorktreeArchivePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    archiveRef: S.NonEmptyString,
    residueRoot: S.String,
    patchPath: S.String,
    untrackedRoot: S.String,
    materialRoot: S.String,
    manifestPath: S.String,
  }).pipe(
    $I.annoteSchema("WorktreeArchivePlan", {
      description: "Deterministic archive reference and filesystem layout for one worktree retirement attempt.",
    })
  )
) {}

/**
 * The variable an agent harness exports to name its session process, and the pid it claims.
 *
 * **Details**
 *
 * Claude Code exports `CLAUDE_PID=<its own pid>` to every tool shell it
 * spawns. The archive fence does not take the claim on faith: it accepts the
 * pid only when the entry immediately before that session in the nearest-first
 * ancestry chain (toward index 0 and the invoker) still carries this marker
 * in its initial environment, which init, the desktop host, or a pid
 * copied from another shell can never satisfy.
 *
 * **Example** (Name a session)
 *
 * ```ts
 * import { WorktreeSessionMarker } from "@beep/repo-cli/commands/Worktree"
 *
 * const marker = WorktreeSessionMarker.make({ name: "CLAUDE_PID", pid: 4242 })
 * console.log(marker.name) // "CLAUDE_PID"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeSessionMarker extends S.Opaque<WorktreeSessionMarker, { readonly brand: unique symbol }>()(
  S.Struct({
    name: TrimmedNonEmptyString,
    pid: ProcessPid,
  }).pipe(
    $I.annoteSchema("WorktreeSessionMarker", {
      description: "Environment variable a harness exports to its children, and the session pid it claims to carry.",
    })
  )
) {}

/**
 * The processes the archive fence may exempt on the invoker's behalf.
 *
 * **Details**
 *
 * Present on a request, it exempts the invoker's own ancestry (the CLI, its
 * shell, the agent session above them): they are the party asking for the
 * removal, not writers whose later output the archive could lose.
 * `sessionMarker` widens that to the whole subtree of one of those
 * ancestors, the agent session process, so the helpers it spawned into the
 * lane (MCP servers, tool shells, its own background jobs) count as the same
 * party. The fence proves the marker against `/proc` before honouring it, so
 * a stale, foreign, or universal-ancestor value never widens the fence.
 * `selfRetirement` says the invoker started inside the checkout it is
 * retiring, which is a session closing its own lane. Only then does the fence
 * also leave an idle Claude Desktop Terminal panel shell standing in it; a
 * retirement of some other lane (`--lane` from a sibling or the clone) keeps
 * that shell blocking, because it may belong to a session still using the lane.
 *
 * **Example** (Exempt the invoker and its session subtree)
 *
 * ```ts
 * import { WorktreeInvokerExemption, WorktreeSessionMarker } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const exemption = WorktreeInvokerExemption.make({
 *   sessionMarker: O.some(WorktreeSessionMarker.make({ name: "CLAUDE_PID", pid: 4242 })),
 *   selfRetirement: true,
 * })
 * console.log(O.isSome(exemption.sessionMarker)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeInvokerExemption extends S.Opaque<WorktreeInvokerExemption, { readonly brand: unique symbol }>()(
  S.Struct({
    sessionMarker: S.OptionFromNullOr(WorktreeSessionMarker),
    selfRetirement: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("WorktreeInvokerExemption", {
      description:
        "Exemption the archive fence grants the invoker: its own ancestry, the subtree of the session process a harness marker proves, and, for a lane retiring itself, an idle desktop Terminal panel shell.",
    })
  )
) {}

/**
 * Fully resolved request accepted by the worktree-removal service.
 *
 * **Details**
 *
 * `expectedHead` pins the authority under which the removal was decided: when
 * present, the service re-reads the checkout HEAD at removal time and refuses
 * the entire removal — no worktree removal, no branch deletion — if it no
 * longer equals this object id. Archive mode fences the checkout with an
 * atomic rename before capturing residue, so the archive is complete with
 * respect to everything that arrived before the fence, refuses while any
 * same-uid process still holds the fenced copy by cwd or open descriptor (a
 * writer the archive could not see; a process holding only an inotify watch
 * cannot write and is named in the receipt instead), and the branch ref
 * itself always falls to an atomic `git update-ref -d` compare-and-swap on
 * the archived head — an advance at any point up to the final ref update
 * fails the deletion instead of orphaning commits; directory removal never
 * touches the shared object store.
 *
 * `exemptInvoker` selects the explicit ancestry and harness-marker proof used
 * by Yeet. It takes precedence over `exemptInvokerSession`, even when its
 * marker cannot be proven. Callers that omit `exemptInvoker` may request
 * command-name inference with `exemptInvokerSession`; without either request,
 * every attached process remains a holder. An `exemptInvoker` with
 * `selfRetirement` also leaves an idle Claude Desktop Terminal panel shell
 * that stands in the checkout only by cwd and stays quiet from the first fence
 * scan to the last (the receipt's `idleTerminalShells` names it); one running
 * a command, or one that woke between the scans, still blocks.
 *
 * **Example** (Request archive retirement)
 *
 * ```ts
 * import { WorktreeRemovalRequest } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const request = WorktreeRemovalRequest.make({
 *   name: "feature-x",
 *   targetPath: "/repo-worktrees/feature-x",
 *   mainCheckout: "/repo",
 *   branch: O.some("feat/feature-x"),
 *   archive: true,
 *   deleteBranch: false,
 *   expectedHead: O.none(),
 * })
 * console.log(request.archive) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeRemovalRequest extends S.Opaque<WorktreeRemovalRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: TrimmedNonEmptyString.check(S.isPattern(/^(?!\.{1,2}$)[^/\\\x00-\x1f\x7f]+$/u)),
    targetPath: S.NonEmptyString.check(S.isPattern(/^[^\x00-\x1f\x7f]+$/u)),
    mainCheckout: S.String,
    branch: S.OptionFromNullOr(S.String),
    archive: S.Boolean,
    deleteBranch: S.Boolean,
    expectedHead: S.OptionFromNullOr(GitObjectId),
    // `yeet sweep --retire` retires the lane its own shell, session, and the
    // session's helpers stand in; they are the invoker, not writers the
    // archive could lose.
    exemptInvoker: S.optionalKey(WorktreeInvokerExemption),
    // Callers may explicitly request command-name inference when no
    // `exemptInvoker` proof is supplied. An explicit proof always takes precedence,
    // including when its marker cannot be proven. A recognized session-command root exempts its subtree. A chain-top
    // fallback exempts only the invoking ancestry, retaining sibling holders.
    // Exempt children must finish their writes before archive capture.
    exemptInvokerSession: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("WorktreeRemovalRequest", {
      description:
        "Resolved worktree removal request, optionally pinned to the HEAD object id its authority was decided under.",
    })
  )
) {}

/**
 * Answer of the unpushed-commit probe shared by doctor and archive retirement.
 *
 * **Details**
 *
 * `baseRange` is the comparison against the remote default branch
 * (`origin/<default>..HEAD`, or plain `HEAD` when that ref is absent). When
 * `upstream` is `pruned`, no upstream range could be counted, so `baseRange`
 * decided `unpushed` on its own instead of aborting the probe and the pruned
 * state carries the verdict that proved (or failed to prove) the tip pushed.
 *
 * **Example** (Record a probe that fell back to the default branch)
 *
 * ```ts
 * import { WorktreeUnpushedInspection } from "@beep/repo-cli/commands/Worktree"
 *
 * const inspection = WorktreeUnpushedInspection.make({
 *   unpushed: false,
 *   baseRange: "origin/main..HEAD",
 *   upstream: {
 *     _tag: "pruned",
 *     ref: "refs/remotes/origin/feat/feature-x",
 *     verdict: { _tag: "ancestor-of-base", base: "origin/main" },
 *   },
 * })
 * console.log(inspection.upstream._tag) // "pruned"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeUnpushedInspection extends S.Opaque<
  WorktreeUnpushedInspection,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    unpushed: S.Boolean,
    baseRange: S.String,
    upstream: WorktreeUpstreamState,
  }).pipe(
    $I.annoteSchema("WorktreeUnpushedInspection", {
      description:
        "Whether HEAD holds commits absent from the remote default branch or the branch upstream, with the ranges that answered.",
    })
  )
) {}

/**
 * A process the archive fence found watching the checkout through inotify and left running.
 *
 * **Details**
 *
 * An editor's file watcher (WebStorm's `fsnotifier`, for one) holds an
 * inotify watch on every directory of the tree it watches. A watch is a
 * subscription to events, not a handle: nothing can be written through it,
 * so the fence names the watcher instead of refusing. `command` is the
 * kernel's short executable name, `None` when it could not be read.
 *
 * **Example** (Name an editor watcher)
 *
 * ```ts
 * import { WorktreeInotifyWatcher } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const watcher = WorktreeInotifyWatcher.make({ pid: 2966722, command: O.some("fsnotifier") })
 * console.log(watcher.pid) // 2966722
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeInotifyWatcher extends S.Opaque<WorktreeInotifyWatcher, { readonly brand: unique symbol }>()(
  S.Struct({
    pid: ProcessPid,
    command: S.OptionFromNullOr(S.String),
  }).pipe(
    $I.annoteSchema("WorktreeInotifyWatcher", {
      description: "A process holding only an inotify watch on a retired checkout, with its kernel command name.",
    })
  )
) {}

/**
 * How long the archive fence waits out an inotify watcher re-walking the fenced tree.
 *
 * **Details**
 *
 * The fence renames the checkout aside, and a recursive watcher (an editor's
 * `fsnotifier`) answers a directory moved inside its tree by walking the
 * moved tree again, opening each directory to add its watch. Those directory
 * descriptors are handles, so the fence does not exempt them: it scans again
 * every `interval`, at most `attempts` scans in all, until the watcher holds
 * nothing but its watches, and refuses if the walk outlasts the budget.
 *
 * **Example** (A quick policy for tests)
 *
 * ```ts
 * import { WorktreeFenceSettlePolicy } from "@beep/repo-cli/commands/Worktree"
 * import * as Duration from "effect/Duration"
 *
 * const policy = WorktreeFenceSettlePolicy.make({ interval: Duration.millis(10), attempts: 3 })
 * console.log(policy.attempts) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeFenceSettlePolicy extends S.Opaque<WorktreeFenceSettlePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    interval: S.Duration,
    attempts: PosInt,
  }).pipe(
    $I.annoteSchema("WorktreeFenceSettlePolicy", {
      description:
        "Spacing and scan budget the archive fence uses to wait out an inotify watcher walking the fenced tree.",
    })
  )
) {}

/**
 * Result returned after a worktree removal completes.
 *
 * **Details**
 *
 * `manifest` is present only when archive mode found dirty state or unpushed
 * commits. Clean archive removals therefore leave no residue directory.
 * `unpushedInspection` records how archive mode judged unpushed commits and
 * is absent for legacy removals, which never inspect them.
 * `idleTerminalShells` names the idle Claude Desktop Terminal panel shells the
 * archive fence left standing in the checkout: the checkout was removed under
 * them, so each one's working directory is now gone.
 * `inotifyWatchers` names the processes the fence found holding only an
 * inotify watch on the checkout, which it left running and warns about
 * instead of refusing.
 *
 * **Example** (Represent a clean archive removal)
 *
 * ```ts
 * import { WorktreeRemovalReceipt } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const receipt = WorktreeRemovalReceipt.make({
 *   targetPath: "/repo-worktrees/feature-x",
 *   branch: O.some("feat/feature-x"),
 *   reason: "clean",
 *   manifest: O.none(),
 *   branchDeleted: false,
 * })
 * console.log(O.isNone(receipt.manifest)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeRemovalReceipt extends S.Opaque<WorktreeRemovalReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    targetPath: S.String,
    branch: S.OptionFromNullOr(S.String),
    reason: WorktreeResidueReason,
    manifest: S.OptionFromNullOr(WorktreeResidueManifest),
    branchDeleted: S.Boolean,
    unpushedInspection: S.OptionFromNullOr(WorktreeUnpushedInspection).pipe(
      S.withConstructorDefault(Effect.succeedNone),
      S.withDecodingDefaultKey(Effect.succeed(null))
    ),
    idleTerminalShells: ArrayKeyDefaultEmpty(ProcessPid),
    inotifyWatchers: ArrayKeyDefaultEmpty(WorktreeInotifyWatcher),
  }).pipe(
    $I.annoteSchema("WorktreeRemovalReceipt", {
      description: "Completed worktree removal receipt with optional preserved residue manifest.",
    })
  )
) {}

const stripRefsHeads = (ref: string): string =>
  Str.startsWith(REFS_HEADS_PREFIX)(ref) ? Str.slice(REFS_HEADS_PREFIX.length)(ref) : ref;

const isWorktreeListPath = S.is(WorktreeListEntry.fields.path);

/**
 * Map one `Git.worktreeList` entry onto the Worktree command's listing shape.
 *
 * **Details**
 *
 * The kit's `WorktreeEntry` keeps the branch as its full refname and models an absent head or
 * branch as a missing key; the command's `WorktreeListEntry` strips `refs/heads/` and uses `null`,
 * the shape its reports and receipts serialize. A path carrying a control character is excluded
 * from managed worktree operations, as the retired porcelain parser excluded it, so the result is
 * `None` for such an entry. The kit's listing is fail-closed (`parseWorktreeList`), which is where
 * the parser's own NUL-delimiter refusal went (repo-cli-gh-git-consolidation W2, SPEC D-10).
 *
 * **Example** (Map a branch entry)
 *
 * ```ts
 * import { WorktreeEntry } from "@beep/git/Git"
 * import { worktreeListEntryFromGit } from "@beep/repo-cli/commands/Worktree"
 * import * as O from "effect/Option"
 *
 * const entry = worktreeListEntryFromGit(
 *   WorktreeEntry.make({
 *     path: "/repo",
 *     head: "1111111111111111111111111111111111111111",
 *     branch: "refs/heads/main",
 *     detached: false,
 *     bare: false,
 *     prunable: false,
 *   })
 * )
 * console.log(O.map(entry, (listed) => listed.branch)) // Some("main")
 * ```
 *
 * @param entry - One entry of the kit's `worktree list --porcelain -z` reading.
 * @returns The command's listing entry, or `None` for a path with control characters.
 * @category parsing
 * @since 0.0.0
 */
export const worktreeListEntryFromGit = (entry: WorktreeEntry): O.Option<WorktreeListEntry> =>
  O.map(O.liftPredicate(entry.path, isWorktreeListPath), (path) =>
    WorktreeListEntry.make({
      path,
      head: O.getOrNull(O.fromUndefinedOr(entry.head)),
      branch: O.getOrNull(O.map(O.fromUndefinedOr(entry.branch), stripRefsHeads)),
      detached: entry.detached,
      locked: P.isNotUndefined(entry.locked),
      prunable: entry.prunable,
    })
  );

/**
 * Map a whole `Git.worktreeList` reading onto the Worktree command's listing shape.
 *
 * **Example** (Drop a hostile path from the listing)
 *
 * ```ts
 * import { WorktreeEntry } from "@beep/git/Git"
 * import { worktreeListEntriesFromGit } from "@beep/repo-cli/commands/Worktree"
 *
 * const entries = worktreeListEntriesFromGit([
 *   WorktreeEntry.make({ path: "/repo", detached: false, bare: false, prunable: false }),
 *   WorktreeEntry.make({ path: "/repo\n/unrelated", detached: true, bare: false, prunable: false }),
 * ])
 * console.log(entries.length) // 1
 * ```
 *
 * @param entries - The kit's listing, first entry the main working tree.
 * @returns The command's listing entries, in git's order, hostile paths excluded.
 * @category parsing
 * @since 0.0.0
 */
export const worktreeListEntriesFromGit = (entries: ReadonlyArray<WorktreeEntry>): ReadonlyArray<WorktreeListEntry> =>
  A.getSomes(A.map(entries, worktreeListEntryFromGit));

/**
 * Number of seconds within which measured activity classifies a checkout as
 * `live`.
 *
 * **Details**
 *
 * Applied uniformly to the transcript-mtime and worktree-mtime probes. The
 * process-cwd and claude-session probes are instantaneous and do not use a
 * window.
 *
 * **Example** (Read the liveness window)
 *
 * ```ts
 * import { FLEET_LIVENESS_WINDOW_SECONDS } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FLEET_LIVENESS_WINDOW_SECONDS) // 900
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FLEET_LIVENESS_WINDOW_SECONDS = 900;

/**
 * The measured policy surface evaluated by the fleet mirror's signal 3.
 *
 * **Details**
 *
 * Every entry cleared the commit-frequency bar measured in
 * `goals/fleet-mirror/research/p0-policy-surface-measurement.md` over the
 * pinned window `be6c67e959..9d2b12cc67` (300 first-parent `main` commits,
 * 2026-07-01 → 2026-08-06): individually ≤7.3% of commits, union 23.7%, and
 * back-tested to fire on three of three observed Mode B specimens. Entries are
 * git pathspecs with default wildcard magic — the same form the measurement
 * used — so `*` may cross directory separators.
 *
 * **Gotchas**
 *
 * No path enters this surface unmeasured; additions re-run the measurement and
 * record new pinned SHAs beside their numbers. The surface calibrates a
 * bulletin, not a gate — it must not gate anything without being re-measured
 * against the gate's cost function.
 *
 * **Example** (Read the measured surface)
 *
 * ```ts
 * import { FLEET_POLICY_SURFACE } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FLEET_POLICY_SURFACE.includes("turbo.json")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FLEET_POLICY_SURFACE = [
  "biome.json*",
  "turbo.json",
  ".gitleaks.toml",
  "commitlint.config.*",
  "lefthook.yml",
  ".oxlintrc.json",
  ".changeset/config.json",
  ".github/workflows/**",
  ".github/actions/**",
  "packages/tooling/tool/cli/src/commands/Yeet/**",
  ".claude/hooks/**",
  ".claude/skills/**",
  ".claude/settings.json",
  "CLAUDE.md",
  "AGENTS.md",
  ".patterns/**",
] as const;

/**
 * Liveness domain for a fleet checkout.
 *
 * **Details**
 *
 * `live` and `dormant` are measured facts; `unknown` is ignorance — a probe
 * failed or covered only part of its domain. `unknown` must never collapse
 * into `dormant`: a falsely-dormant checkout is a silent miss, strictly worse
 * than an absent reading.
 *
 * **Example** (Read a liveness member)
 *
 * ```ts
 * import { FleetLiveness } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FleetLiveness.Enum.live) // "live"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetLiveness = LiteralKit(["live", "dormant", "unknown"]).pipe(
  $I.annoteSchema("FleetLiveness", {
    description: "Three-state liveness domain: live and dormant are measured facts; unknown is ignorance.",
  })
);

/**
 * Decoded liveness member union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetLiveness = typeof FleetLiveness.Type;

/**
 * The probe that produced a `live` liveness verdict.
 *
 * **Details**
 *
 * `claude-session` is the session-registry probe: a registry entry under
 * `~/.claude/sessions/` whose PID survived the `procStart` reuse guard and
 * whose recorded working directory sits at or under the checkout. It carries
 * no PID — the probe member is evidence of *how* liveness was measured, not a
 * handle to the session.
 *
 * **Example** (Read a probe member)
 *
 * ```ts
 * import { FleetLivenessProbe } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FleetLivenessProbe.Enum["process-cwd"]) // "process-cwd"
 * console.log(FleetLivenessProbe.Enum["claude-session"]) // "claude-session"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetLivenessProbe = LiteralKit([
  "process-cwd",
  "transcript-mtime",
  "worktree-mtime",
  "claude-session",
]).pipe(
  $I.annoteSchema("FleetLivenessProbe", {
    description: "The probe that produced a live liveness verdict.",
  })
);

/**
 * Decoded liveness-probe member union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetLivenessProbe = typeof FleetLivenessProbe.Type;

/**
 * The fields the fleet liveness probe consumes from one on-disk Claude Code
 * session-registry entry (`~/.claude/sessions/<pid>.json`).
 *
 * **Details**
 *
 * The registry entry carries many more fields; decoding tolerates and drops
 * them. `procStart` is the PID-reuse guard: it must equal field 22
 * (`starttime`) of `/proc/<pid>/stat`, or the entry is a stale file over a
 * recycled PID and contributes nothing.
 *
 * **Gotchas**
 *
 * A registry entry proves a session *existed* with this PID and working
 * directory — only the `/proc` starttime comparison upgrades that to "is
 * still running". Never treat a decoded entry as liveness by itself.
 *
 * **Example** (Construct a registry entry)
 *
 * ```ts
 * import { FleetSessionRegistryEntry } from "@beep/repo-cli/commands/Worktree"
 *
 * const entry = FleetSessionRegistryEntry.make({
 *   pid: 244216,
 *   procStart: "220635",
 *   cwd: "/projects/beep-effect",
 * })
 * console.log(entry.procStart) // "220635"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetSessionRegistryEntry extends S.Opaque<FleetSessionRegistryEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    pid: S.Finite,
    procStart: S.String,
    cwd: S.String,
  }).pipe(
    $I.annoteSchema("FleetSessionRegistryEntry", {
      description:
        "The pid, procStart reuse guard, and working directory the fleet liveness probe reads from one Claude Code session-registry entry.",
    })
  )
) {}

/**
 * One probe's reading during liveness classification.
 *
 * **Details**
 *
 * `measured` carries the age in seconds of the newest observed activity;
 * `absent` is the measured fact that no activity trace exists; `failed` means
 * the probe could not measure — and must degrade to `unknown`, never to
 * `dormant`.
 *
 * **Example** (Construct a failed reading)
 *
 * ```ts
 * import { FleetProbeReading } from "@beep/repo-cli/commands/Worktree"
 *
 * const reading: FleetProbeReading = { _tag: "failed" }
 * console.log(reading._tag) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetProbeReading = S.Union([
  S.TaggedStruct("measured", { ageSeconds: S.Finite }),
  S.TaggedStruct("absent", {}),
  S.TaggedStruct("failed", {}),
]).pipe(
  $I.annoteSchema("FleetProbeReading", {
    description:
      "One liveness probe's reading: a measured activity age, the measured absence of any trace, or a failed probe.",
  })
);

/**
 * Decoded probe-reading union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetProbeReading = typeof FleetProbeReading.Type;

/**
 * Inputs to the liveness classifier for one checkout.
 *
 * **Details**
 *
 * `processMatches` counts readable processes whose working directory sits
 * inside the checkout; `processScanComplete` is `false` when any process's
 * working directory was unreadable, because an unreadable process could be
 * inside this checkout. `sessionMatches` counts session-registry entries that
 * survived the `procStart` reuse guard and whose recorded working directory
 * sits at or under the checkout — a positive-only probe, so `0` never
 * contributes toward `dormant`: the registry covers Claude Code sessions
 * only, never codex sessions, editors, or a human with a dirty tree.
 *
 * **Example** (Readings that leave liveness unknown)
 *
 * ```ts
 * import { FleetLivenessReadings } from "@beep/repo-cli/commands/Worktree"
 *
 * const readings = FleetLivenessReadings.make({
 *   processMatches: 0,
 *   processScanComplete: false,
 *   sessionMatches: 0,
 *   transcript: { _tag: "absent" },
 *   worktreeMtime: { _tag: "measured", ageSeconds: 86_400 },
 * })
 * console.log(readings.processScanComplete) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLivenessReadings extends S.Opaque<FleetLivenessReadings, { readonly brand: unique symbol }>()(
  S.Struct({
    processMatches: S.Finite,
    processScanComplete: S.Boolean,
    sessionMatches: S.Finite,
    transcript: FleetProbeReading,
    worktreeMtime: FleetProbeReading,
  }).pipe(
    $I.annoteSchema("FleetLivenessReadings", {
      description: "Probe readings the liveness classifier consumes for one checkout.",
    })
  )
) {}

/**
 * A classified liveness status plus the probes that produced it.
 *
 * **Details**
 *
 * `evidence` is empty for both `dormant` and `unknown`: neither is produced by
 * a probe firing, so there is nothing to cite.
 *
 * **Example** (Construct a live verdict)
 *
 * ```ts
 * import { FleetLivenessVerdict } from "@beep/repo-cli/commands/Worktree"
 *
 * const verdict = FleetLivenessVerdict.make({ status: "live", evidence: ["worktree-mtime"] })
 * console.log(verdict.evidence.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetLivenessVerdict extends S.Opaque<FleetLivenessVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    status: FleetLiveness,
    evidence: S.Array(FleetLivenessProbe),
  }).pipe(
    $I.annoteSchema("FleetLivenessVerdict", {
      description: "A checkout's classified liveness status and the probes that evidenced it.",
    })
  )
) {}

/**
 * Options accepted by the fleet-mirror derivation scan.
 *
 * **Details**
 *
 * Every field is optional and defaults from the invoking repository: the fleet
 * root is the parent directory of the current clone, the origin URL comes from
 * `git remote get-url origin`, and the scanner object database lives under the
 * user cache directory. Tests inject scratch equivalents.
 *
 * **Example** (Scan the invoking repository's own fleet)
 *
 * ```ts
 * import { FleetScanOptions } from "@beep/repo-cli/commands/Worktree"
 *
 * const options = FleetScanOptions.make({ targetRef: "main" })
 * console.log(options.targetRef) // "main"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetScanOptions extends S.Opaque<FleetScanOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    startFrom: S.optionalKey(S.String),
    fleetRoot: S.optionalKey(S.String),
    originUrl: S.optionalKey(S.String),
    scannerDir: S.optionalKey(S.String),
    targetRef: S.optionalKey(S.String),
    livenessWindowSeconds: S.optionalKey(S.Finite),
    homeDir: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("FleetScanOptions", {
      description: "Optional overrides for one fleet-mirror scan; every field defaults from the invoking repository.",
    })
  )
) {}

/**
 * Conflict-prediction domain for a fleet checkout (signal 2).
 *
 * **Details**
 *
 * `clean` and `conflict` are `git merge-tree --write-tree` verdicts against
 * the materialized epoch target. `unknown` means the prediction was not
 * measured — never that the merge is clean.
 *
 * **Example** (Read a conflict member)
 *
 * ```ts
 * import { FleetConflictStatus } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FleetConflictStatus.Enum.unknown) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetConflictStatus = LiteralKit(["clean", "conflict", "unknown"]).pipe(
  $I.annoteSchema("FleetConflictStatus", {
    description: "merge-tree verdict domain: clean and conflict are measured; unknown is never a clean claim.",
  })
);

/**
 * Decoded conflict-status member union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetConflictStatus = typeof FleetConflictStatus.Type;

/**
 * Policy-movement domain for a fleet checkout (signal 3).
 *
 * **Details**
 *
 * `moved` means `main` gained commits touching the measured policy surface
 * between this checkout's merge base and the epoch target. This is the only
 * Mode B detector: that collision produces no textual conflict, so signals 1
 * and 2 are structurally blind to it.
 *
 * **Example** (Read a movement member)
 *
 * ```ts
 * import { FleetPolicyMovement } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FleetPolicyMovement.Enum.moved) // "moved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetPolicyMovement = LiteralKit(["moved", "unmoved", "unknown"]).pipe(
  $I.annoteSchema("FleetPolicyMovement", {
    description: "Policy-surface movement domain for signal 3, the fleet mirror's only Mode B detector.",
  })
);

/**
 * Decoded policy-movement member union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetPolicyMovement = typeof FleetPolicyMovement.Type;

/**
 * Why a derived fleet field reads `unknown` instead of a measured value.
 *
 * **Example** (Read an unknown-reason member)
 *
 * ```ts
 * import { FleetUnknownReason } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FleetUnknownReason.Enum["target-unmaterialized"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetUnknownReason = LiteralKit([
  "target-unmaterialized",
  "head-unknown",
  "not-live",
  "probe-failed",
]).pipe(
  $I.annoteSchema("FleetUnknownReason", {
    description: "Why a derived fleet field reads unknown instead of a measured value.",
  })
);

/**
 * Decoded unknown-reason member union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetUnknownReason = typeof FleetUnknownReason.Type;

/**
 * Whether a fleet checkout is a standalone clone or a linked worktree.
 *
 * **Example** (Read a kind member)
 *
 * ```ts
 * import { FleetCheckoutKind } from "@beep/repo-cli/commands/Worktree"
 *
 * console.log(FleetCheckoutKind.Enum.clone) // "clone"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetCheckoutKind = LiteralKit(["clone", "linked-worktree"]).pipe(
  $I.annoteSchema("FleetCheckoutKind", {
    description: "Whether a fleet checkout is a standalone clone or a linked worktree.",
  })
);

/**
 * Decoded checkout-kind member union.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetCheckoutKind = typeof FleetCheckoutKind.Type;

/**
 * One derived row of the fleet mirror: everything the scan measured about a
 * single checkout sharing this repository's origin.
 *
 * **Details**
 *
 * Every derived field is either measured or `unknown` — `S.NullOr` scalars
 * encode `unknown` as `null`, and the status domains carry an explicit
 * `unknown` member. Nothing defaults to the safe-sounding value: `branch` is
 * `null` with `detached: true` for the detached *fact*, and `null` with
 * `detached: null` when enumeration itself failed.
 *
 * **Example** (Construct a fully-unknown row)
 *
 * ```ts
 * import { FleetCheckout } from "@beep/repo-cli/commands/Worktree"
 *
 * const row = FleetCheckout.make({
 *   path: "/projects/beep-effect-sibling",
 *   kind: "clone",
 *   branch: null,
 *   detached: null,
 *   head: null,
 *   dirtyCount: null,
 *   mergeBase: null,
 *   branchDiffCount: null,
 *   liveness: "unknown",
 *   livenessEvidence: [],
 *   conflict: "unknown",
 *   conflictReason: "head-unknown",
 *   conflictPaths: [],
 *   policyMovement: "unknown",
 *   policyReason: "head-unknown",
 *   policyPaths: [],
 * })
 * console.log(row.liveness) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetCheckout extends S.Opaque<FleetCheckout, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    kind: FleetCheckoutKind,
    branch: S.NullOr(S.String),
    detached: S.NullOr(S.Boolean),
    head: S.NullOr(S.String),
    dirtyCount: S.NullOr(S.Finite),
    mergeBase: S.NullOr(S.String),
    branchDiffCount: S.NullOr(S.Finite),
    liveness: FleetLiveness,
    livenessEvidence: S.Array(FleetLivenessProbe),
    conflict: FleetConflictStatus,
    conflictReason: S.NullOr(FleetUnknownReason),
    conflictPaths: S.Array(S.String),
    policyMovement: FleetPolicyMovement,
    policyReason: S.NullOr(FleetUnknownReason),
    policyPaths: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("FleetCheckout", {
      description:
        "Derived fleet-mirror row for one checkout: measured git facts, three-state liveness, conflict prediction, and policy movement, with null encoding unknown.",
    })
  )
) {}

/**
 * One path claimed by the change surfaces of more than one checkout
 * (signal 1, Mode A).
 *
 * **Example** (Construct a contested path)
 *
 * ```ts
 * import { FleetContestedPath } from "@beep/repo-cli/commands/Worktree"
 *
 * const contested = FleetContestedPath.make({
 *   path: "goals/INDEX.md",
 *   checkouts: ["/projects/a", "/projects/b"],
 * })
 * console.log(contested.checkouts.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetContestedPath extends S.Opaque<FleetContestedPath, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    checkouts: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("FleetContestedPath", {
      description: "A repository path present in the change surface of two or more fleet checkouts.",
    })
  )
) {}

/**
 * The epoch target the scan measured signals 2 and 3 against.
 *
 * **Details**
 *
 * `sha` is `null` when the remote ref could not be resolved. `materialized`
 * reports whether the commit object is present in the scanner object
 * database — `git merge-tree` needs the object, not its SHA, and until it is
 * materialized both downstream signals report `unknown`, never `clean`.
 *
 * **Example** (Construct an unresolved target)
 *
 * ```ts
 * import { FleetEpochTarget } from "@beep/repo-cli/commands/Worktree"
 *
 * const target = FleetEpochTarget.make({ ref: "main", sha: null, materialized: false })
 * console.log(target.materialized) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetEpochTarget extends S.Opaque<FleetEpochTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    ref: S.String,
    sha: S.NullOr(S.String),
    materialized: S.Boolean,
  }).pipe(
    $I.annoteSchema("FleetEpochTarget", {
      description: "Ground-truth ref the fleet scan evaluated against, and whether its object is materialized locally.",
    })
  )
) {}

/**
 * Coverage accounting for one fleet scan, so a partial scan is legible as
 * partial rather than as a complete clean result.
 *
 * **Example** (Construct a coverage report)
 *
 * ```ts
 * import { FleetScanCoverage } from "@beep/repo-cli/commands/Worktree"
 *
 * const coverage = FleetScanCoverage.make({
 *   clonesDiscovered: 2,
 *   checkoutsDiscovered: 5,
 *   checkoutsDegraded: 1,
 *   processesScanned: 1200,
 *   processesUnreadable: 3,
 * })
 * console.log(coverage.checkoutsDegraded) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetScanCoverage extends S.Opaque<FleetScanCoverage, { readonly brand: unique symbol }>()(
  S.Struct({
    clonesDiscovered: S.Finite,
    checkoutsDiscovered: S.Finite,
    checkoutsDegraded: S.Finite,
    processesScanned: S.Finite,
    processesUnreadable: S.Finite,
  }).pipe(
    $I.annoteSchema("FleetScanCoverage", {
      description:
        "Scan coverage counts: discovered clones and checkouts, rows carrying probe-failure unknowns, and process-scan readability.",
    })
  )
) {}

/**
 * The read-only fleet snapshot produced by one derivation scan.
 *
 * **Details**
 *
 * Contested paths are computed over every checkout's change surface; join
 * them with each row's `liveness` to separate active contention from stale
 * residue — liveness labels signal 1, it does not filter it.
 *
 * **Example** (Construct an empty snapshot)
 *
 * ```ts
 * import { FleetEpochTarget, FleetScanCoverage, FleetSnapshot } from "@beep/repo-cli/commands/Worktree"
 *
 * const snapshot = FleetSnapshot.make({
 *   fleetRoot: "/projects",
 *   originUrl: "https://github.com/beep-effect/beep-effect.git",
 *   scannedAt: "2026-08-06T00:00:00.000Z",
 *   target: FleetEpochTarget.make({ ref: "main", sha: null, materialized: false }),
 *   coverage: FleetScanCoverage.make({
 *     clonesDiscovered: 0,
 *     checkoutsDiscovered: 0,
 *     checkoutsDegraded: 0,
 *     processesScanned: 0,
 *     processesUnreadable: 0,
 *   }),
 *   checkouts: [],
 *   contestedPaths: [],
 * })
 * console.log(snapshot.checkouts.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetSnapshot extends S.Opaque<FleetSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    fleetRoot: S.String,
    originUrl: S.String,
    scannedAt: S.String,
    target: FleetEpochTarget,
    coverage: FleetScanCoverage,
    checkouts: S.Array(FleetCheckout),
    contestedPaths: S.Array(FleetContestedPath),
  }).pipe(
    $I.annoteSchema("FleetSnapshot", {
      description:
        "Read-only derived view of every checkout sharing this origin: rows, contested paths, epoch target, and scan coverage.",
    })
  )
) {}
