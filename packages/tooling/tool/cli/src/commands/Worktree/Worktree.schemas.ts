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
import { LiteralKit, NonEmptyTrimmedStr } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import { ISOStr } from "@beep/schema/Timestamp";
import { A, Str } from "@beep/utils";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Worktree/Worktree.schemas");

const REFS_HEADS_PREFIX = "refs/heads/";
const WORKTREE_PREFIX = "worktree ";

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
export class WorktreeListEntry extends S.Class<WorktreeListEntry>($I`WorktreeListEntry`)(
  {
    path: S.String,
    head: S.NullOr(S.String),
    branch: S.NullOr(S.String),
    detached: S.Boolean,
    locked: S.Boolean,
    prunable: S.Boolean,
  },
  $I.annote("WorktreeListEntry", {
    description: "One parsed entry from git worktree list --porcelain.",
  })
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
export const WorktreeResidueReason = LiteralKit(["dirty", "unpushed-commits", "dirty+unpushed", "clean"]).annotate(
  $I.annote("WorktreeResidueReason", {
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
  "write-manifest",
]).annotate(
  $I.annote("WorktreePreservationStep", {
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
  S.isPattern(worktreeRepositoryHashPattern, {
    identifier: $I`WorktreeRepositoryHashCheck`,
    title: "Worktree repository hash",
    description: "A lowercase 12-hex prefix of the absolute main-checkout SHA-256 digest.",
    message: "Worktree repository hash must contain exactly 12 lowercase hexadecimal characters",
  })
)
  .annotate({
    toArbitrary: () => (fc) => fc.stringMatching(worktreeRepositoryHashPattern),
  })
  .pipe(
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
 * Durable receipt for worktree state preserved before archive removal.
 *
 * **Details**
 *
 * `branch` is absent for detached worktrees and `patchPath` is absent when no
 * tracked changes differed from `HEAD`. Untracked paths remain repository
 * relative so they can be copied back without rewriting their layout.
 *
 * **Example** (Describe archived untracked residue)
 *
 * ```ts
 * import { WorktreeRepositoryHash, WorktreeResidueManifest } from "@beep/repo-cli/commands/Worktree"
 * import { NonEmptyTrimmedStr } from "@beep/schema"
 * import { ISOStr } from "@beep/schema/Timestamp"
 * import * as O from "effect/Option"
 *
 * const manifest = WorktreeResidueManifest.make({
 *   name: NonEmptyTrimmedStr.make("feature-x"),
 *   branch: O.some("feat/feature-x"),
 *   head: "1ed08f66df016a18c6d7d56bd97aa778912cb37b",
 *   archivedAt: ISOStr.make(NonEmptyTrimmedStr.make("2026-09-02T12:34:56.000Z")),
 *   archiveRef: "refs/archive/worktrees/feature-x/20260902-123456",
 *   repositoryHash: WorktreeRepositoryHash.make("0123456789ab"),
 *   patchPath: O.none(),
 *   untrackedFiles: ["notes.txt"],
 *   residueRoot: "/home/operator/.cache/beep/worktree-residue/repo-0123456789ab/feature-x-20260902-123456",
 *   reason: "unpushed-commits",
 * })
 * console.log(manifest.untrackedFiles.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeResidueManifest extends S.Class<WorktreeResidueManifest>($I`WorktreeResidueManifest`)(
  {
    name: NonEmptyTrimmedStr,
    branch: S.OptionFromNullOr(S.String),
    head: GitObjectId,
    archivedAt: ISOStr,
    archiveRef: S.NonEmptyString,
    repositoryHash: WorktreeRepositoryHash,
    patchPath: S.OptionFromNullOr(S.String),
    untrackedFiles: S.Array(S.String),
    residueRoot: S.String,
    reason: WorktreeResidueReason,
  },
  $I.annote("WorktreeResidueManifest", {
    description:
      "Durable receipt for a worktree HEAD, tracked patch, and copied untracked files preserved before removal.",
  })
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
 *   manifestPath: "/cache/repo-0123456789ab/feature-x-20260902-123456/manifest.json",
 * })
 * console.log(plan.manifestPath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeArchivePlan extends S.Class<WorktreeArchivePlan>($I`WorktreeArchivePlan`)(
  {
    archiveRef: S.NonEmptyString,
    residueRoot: S.String,
    patchPath: S.String,
    untrackedRoot: S.String,
    manifestPath: S.String,
  },
  $I.annote("WorktreeArchivePlan", {
    description: "Deterministic archive reference and filesystem layout for one worktree retirement attempt.",
  })
) {}

/**
 * Fully resolved request accepted by the worktree-removal service.
 *
 * **Example** (Request archive retirement)
 *
 * ```ts
 * import { WorktreeRemovalRequest } from "@beep/repo-cli/commands/Worktree"
 * import { NonEmptyTrimmedStr } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const request = WorktreeRemovalRequest.make({
 *   name: NonEmptyTrimmedStr.make("feature-x"),
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
 * **Details**
 *
 * `expectedHead` pins the authority under which the removal was decided: when
 * present, the service re-reads the checkout HEAD at removal time and refuses
 * the entire removal — no worktree removal, no branch deletion — if it no
 * longer equals this object id.
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeRemovalRequest extends S.Class<WorktreeRemovalRequest>($I`WorktreeRemovalRequest`)(
  {
    name: NonEmptyTrimmedStr,
    targetPath: S.String,
    mainCheckout: S.String,
    branch: S.OptionFromNullOr(S.String),
    archive: S.Boolean,
    deleteBranch: S.Boolean,
    expectedHead: S.OptionFromNullOr(GitObjectId),
  },
  $I.annote("WorktreeRemovalRequest", {
    description:
      "Resolved worktree removal request, optionally pinned to the HEAD object id its authority was decided under.",
  })
) {}

/**
 * Result returned after a worktree removal completes.
 *
 * **Details**
 *
 * `manifest` is present only when archive mode found dirty state or unpushed
 * commits. Clean archive removals therefore leave no residue directory.
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
export class WorktreeRemovalReceipt extends S.Class<WorktreeRemovalReceipt>($I`WorktreeRemovalReceipt`)(
  {
    targetPath: S.String,
    branch: S.OptionFromNullOr(S.String),
    reason: WorktreeResidueReason,
    manifest: S.OptionFromNullOr(WorktreeResidueManifest),
    branchDeleted: S.Boolean,
  },
  $I.annote("WorktreeRemovalReceipt", {
    description: "Completed worktree removal receipt with optional preserved residue manifest.",
  })
) {}

type PorcelainAccumulator = {
  path: string;
  head: string | null;
  branch: string | null;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
};

const stripRefsHeads = (ref: string): string =>
  Str.startsWith(REFS_HEADS_PREFIX)(ref) ? ref.slice(REFS_HEADS_PREFIX.length) : ref;

const accumulatorEntry = (accumulator: PorcelainAccumulator): WorktreeListEntry =>
  WorktreeListEntry.make({
    path: accumulator.path,
    head: accumulator.head,
    branch: accumulator.branch,
    detached: accumulator.detached,
    locked: accumulator.locked,
    prunable: accumulator.prunable,
  });

const applyPorcelainAttribute = (current: PorcelainAccumulator, line: string): void => {
  if (Str.startsWith("HEAD ")(line)) {
    current.head = line.slice("HEAD ".length);
  } else if (Str.startsWith("branch ")(line)) {
    current.branch = stripRefsHeads(line.slice("branch ".length));
  } else if (line === "detached") {
    current.detached = true;
  } else if (line === "locked" || Str.startsWith("locked ")(line)) {
    current.locked = true;
  } else if (line === "prunable" || Str.startsWith("prunable ")(line)) {
    current.prunable = true;
  }
};

type PorcelainBlock = {
  readonly path: string;
  readonly attributes: Array<string>;
};

// Group porcelain lines into one block per `worktree ` header; lines before the first header have no block and are dropped.
const porcelainBlocks = (lines: ReadonlyArray<string>): ReadonlyArray<PorcelainBlock> => {
  const blocks: Array<PorcelainBlock> = [];
  for (const line of lines) {
    if (Str.startsWith(WORKTREE_PREFIX)(line)) {
      blocks.push({ path: line.slice(WORKTREE_PREFIX.length), attributes: [] });
      continue;
    }
    const current = blocks[blocks.length - 1];
    if (current !== undefined) {
      current.attributes.push(line);
    }
  }
  return blocks;
};

const blockEntry = (block: PorcelainBlock): WorktreeListEntry => {
  const accumulator: PorcelainAccumulator = {
    path: block.path,
    head: null,
    branch: null,
    detached: false,
    locked: false,
    prunable: false,
  };
  for (const line of block.attributes) {
    applyPorcelainAttribute(accumulator, line);
  }
  return accumulatorEntry(accumulator);
};

/**
 * Parse `git worktree list --porcelain` output into structured entries.
 *
 * **Example** (Parse a single-worktree listing)
 *
 * ```ts
 * import { parseWorktreePorcelain } from "@beep/repo-cli/commands/Worktree"
 *
 * const entries = parseWorktreePorcelain("worktree /repo\nHEAD abc123\nbranch refs/heads/main\n")
 * console.log(entries.length)
 * ```
 *
 * @param porcelain - Raw stdout from `git worktree list --porcelain`.
 * @returns One entry per worktree block, in listing order.
 * @category parsing
 * @since 0.0.0
 */
export const parseWorktreePorcelain = (porcelain: string): ReadonlyArray<WorktreeListEntry> =>
  A.map(porcelainBlocks(Str.split(Str.trimEnd(porcelain), "\n")), blockEntry);

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
export class FleetSessionRegistryEntry extends S.Class<FleetSessionRegistryEntry>($I`FleetSessionRegistryEntry`)(
  {
    pid: S.Finite,
    procStart: S.String,
    cwd: S.String,
  },
  $I.annote("FleetSessionRegistryEntry", {
    description:
      "The pid, procStart reuse guard, and working directory the fleet liveness probe reads from one Claude Code session-registry entry.",
  })
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
export class FleetLivenessReadings extends S.Class<FleetLivenessReadings>($I`FleetLivenessReadings`)(
  {
    processMatches: S.Finite,
    processScanComplete: S.Boolean,
    sessionMatches: S.Finite,
    transcript: FleetProbeReading,
    worktreeMtime: FleetProbeReading,
  },
  $I.annote("FleetLivenessReadings", {
    description: "Probe readings the liveness classifier consumes for one checkout.",
  })
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
export class FleetLivenessVerdict extends S.Class<FleetLivenessVerdict>($I`FleetLivenessVerdict`)(
  {
    status: FleetLiveness,
    evidence: S.Array(FleetLivenessProbe),
  },
  $I.annote("FleetLivenessVerdict", {
    description: "A checkout's classified liveness status and the probes that evidenced it.",
  })
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
export class FleetScanOptions extends S.Class<FleetScanOptions>($I`FleetScanOptions`)(
  {
    startFrom: S.optionalKey(S.String),
    fleetRoot: S.optionalKey(S.String),
    originUrl: S.optionalKey(S.String),
    scannerDir: S.optionalKey(S.String),
    targetRef: S.optionalKey(S.String),
    livenessWindowSeconds: S.optionalKey(S.Finite),
    homeDir: S.optionalKey(S.String),
  },
  $I.annote("FleetScanOptions", {
    description: "Optional overrides for one fleet-mirror scan; every field defaults from the invoking repository.",
  })
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
export class FleetCheckout extends S.Class<FleetCheckout>($I`FleetCheckout`)(
  {
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
  },
  $I.annote("FleetCheckout", {
    description:
      "Derived fleet-mirror row for one checkout: measured git facts, three-state liveness, conflict prediction, and policy movement, with null encoding unknown.",
  })
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
export class FleetContestedPath extends S.Class<FleetContestedPath>($I`FleetContestedPath`)(
  {
    path: S.String,
    checkouts: S.Array(S.String),
  },
  $I.annote("FleetContestedPath", {
    description: "A repository path present in the change surface of two or more fleet checkouts.",
  })
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
export class FleetEpochTarget extends S.Class<FleetEpochTarget>($I`FleetEpochTarget`)(
  {
    ref: S.String,
    sha: S.NullOr(S.String),
    materialized: S.Boolean,
  },
  $I.annote("FleetEpochTarget", {
    description: "Ground-truth ref the fleet scan evaluated against, and whether its object is materialized locally.",
  })
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
export class FleetScanCoverage extends S.Class<FleetScanCoverage>($I`FleetScanCoverage`)(
  {
    clonesDiscovered: S.Finite,
    checkoutsDiscovered: S.Finite,
    checkoutsDegraded: S.Finite,
    processesScanned: S.Finite,
    processesUnreadable: S.Finite,
  },
  $I.annote("FleetScanCoverage", {
    description:
      "Scan coverage counts: discovered clones and checkouts, rows carrying probe-failure unknowns, and process-scan readability.",
  })
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
export class FleetSnapshot extends S.Class<FleetSnapshot>($I`FleetSnapshot`)(
  {
    fleetRoot: S.String,
    originUrl: S.String,
    scannedAt: S.String,
    target: FleetEpochTarget,
    coverage: FleetScanCoverage,
    checkouts: S.Array(FleetCheckout),
    contestedPaths: S.Array(FleetContestedPath),
  },
  $I.annote("FleetSnapshot", {
    description:
      "Read-only derived view of every checkout sharing this origin: rows, contested paths, epoch target, and scan coverage.",
  })
) {}
