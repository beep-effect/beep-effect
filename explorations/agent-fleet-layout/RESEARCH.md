# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape (2026-10-05, second session)

- **Bun install backend.** Bun copies packages from its global cache into
  `node_modules` with the fastest syscall available: hardlinks on Linux and
  Windows (the default), `clonefile` on macOS, `copyfile` as fallback; the
  `--backend` flag selects it. With hardlinks a package version exists once on
  disk no matter how many projects install it.
  Source: [Bun docs, global cache](https://bun.com/docs/pm/global-cache).
  Measured here: every file sampled in a lane's `node_modules/effect` has link
  count 20, and a full walk of this lane's `node_modules` found 4.1 GB
  hardlinked and 0.0 GB unique. The shared-cache decision is already the
  default behavior; the 88 GB across lanes is distinct package versions
  accumulated by stale lanes, not duplication.
- **Turborepo cache and worktrees.** With no `cacheDir` set, Turborepo detects
  a linked worktree and redirects its cache to the main worktree's
  `.turbo/cache`, so branches in linked worktrees share hits; an explicit
  `cacheDir` disables that. Separate clones never share.
  Source: [Turborepo caching](https://turborepo.dev/docs/core-concepts/caching),
  [configuration reference](https://turborepo.dev/docs/reference/configuration).
  This repo's `turbo.json` sets no `cacheDir`, so lanes already share their
  seat's cache; seats do not share with each other unless `TURBO_CACHE_DIR`
  points at `~/.cache/beep/turbo` (today only the reap unit sets it).
- **Bare-repo worktree layout.** The common pattern for parallel agents is one
  bare object store (`.bare/`), a `.git` file pointing at it, and one
  directory per branch checkout, each agent in its own worktree sharing
  objects and refs. Conflicts move to merge time where normal git tooling
  sees them. pnpm documents the same shape for its content-addressable store.
  Sources: [pnpm, git worktrees](https://pnpm.io/git-worktrees),
  [noqta, worktrees for parallel agents](https://noqta.tn/en/blog/git-worktrees-parallel-ai-coding-agents-guide-2026),
  [Augment Code guide](https://www.augmentcode.com/guides/git-worktrees-parallel-ai-agent-execution).
  Fit: matches the deferred bare-store phase; no license concern (patterns,
  not code).

## Deferred Items Resolved (2026-10-05, second session)

- **`beep-effect0-worktrees` mismatch.** 35 directories, 36 worktrees
  registered to `beep-effect0` (34 of the directories plus `beep-effect0`
  itself and `beep-effect-worktrees/pr-1138`). The one unregistered directory,
  `pr1371-r10-9951f493`, is a worktree of `beep-effect2`. Two lessons: a
  path under `<x>-worktrees` does not prove `<x>` owns it (supports "seat is
  a registry fact"), and the fleet mirror attributed only 1 of these 35 to
  that root, so the mirror's per-root grouping undercounts. Fleet-mirror
  defect candidate; verify in the registry goal before trusting mirror
  counts for drain decisions.
- **`beep-effect-private`.** Not a duplicate clone of this repo: `origin` is
  `beep-effect/beep-effect-private`, a separate private repo with an
  `upstream` sync (memory `beep-effect-private-duplicate`). Clean, 0 commits
  ahead, 24 GB of which 16 GB is `apps/` build output. It is a different
  fleet with its own three lanes; it gets a home beside, not inside, the
  beep-effect fleet.
- **`beep-effect-cutover`.** 1.1 MB of July 2026 census and cutover notes
  plus `.idea`. Archive candidate, not a checkout.
- **ai-metrics data root (29 GB).** `raw` 22 GB in 10,047 files, 9,733 of
  them older than 30 days; `derived` 5.3 GB; `mirror` 1.1 GB;
  `config-snapshots` 161 MB; everything else under 1 MB. Retention lever is
  `raw` by age (compress or offload, never delete without the derived set
  confirmed reproducible).
- **Filesystem.** `/home` is a single btrfs volume, so hardlinks and
  reflinks work across every seat, lane and cache.

## Workstation Census (2026-10-05)

Measured with `du --apparent-size`, `git worktree list`, `systemctl --user`,
and `bun run beep worktree fleet --json` (full table in
[`research/fleet-census-2026-10-05.md`](./research/fleet-census-2026-10-05.md)).

### Checkouts

| Fact | Value |
| --- | --- |
| Operator clones (`beep-effect`, `beep-effect0`, `beep-effect2..22`, `beep-effect-private`) | 23 |
| Checkouts discovered by `beep worktree fleet` | 223 across 21 clones |
| Live (an agent process holds it) | 18 |
| Lanes in `beep-effect2-worktrees` | 95 (143 GB) |
| Lanes in `beep-effect-worktrees` | 36 (38 GB) |
| `.claude/worktrees/*` lanes created by the desktop app | 15 |
| Ad hoc sibling worktrees outside any `-worktrees` root (`beep-effect8-s5`, `beep-effect16-widen2`, `beep-effect19-openai-driver`, `beep-effect2-proof`, ...) | 11 |
| Empty `-worktrees` roots | 6 (`beep-effect10/11/17/19/22/8-s5`) |
| Codex-owned lanes under `~/.codex/worktrees/` | 8 |

The capture says "`beep-effect0` is for cross-clone graft and coordination".
Measured: `beep-graft-deep-refresh` and `beep-refs-refresh` run from
`beep-effect0`, but `beep-residue-reap`, `beep-tmpfs-reap` and
`beep-portfolio-watch` run from `beep-effect5`, and `beep-research-daily` and
`beep-research-repo-card` run from `beep-effect7`. Three clones carry infra;
none is drainable until its timers are re-rendered elsewhere.

`beep-effect0-worktrees` holds 35 directories (36 GB) but the fleet mirror
attributes only one checkout to it; reconcile against `git -C beep-effect0
worktree list` (36 rows) in `shape`. Either the mirror skips something or most
of those directories are orphaned trees.

### Disk

| Class | Where | Size |
| --- | --- | --- |
| Lane `node_modules` | `beep-effect*-worktrees/*/node_modules` | 88 GB |
| Clone `node_modules` | `beep-effect*/node_modules` | 20 GB |
| ai-metrics data root | `~/.local/state/beep/ai-metrics` | 29 GB |
| Bun install cache | `~/.cache/beep/bun-install-cache` | 6.5 GB |
| `.git` per clone | e.g. `beep-effect/.git` | 2.7 GB |
| `graft/` per checkout | e.g. `beep-effect/graft` | 640 MB |
| `.beep` per clone (largest) | `beep-effect2/.beep` | 1.1 GB |
| `.beep` per clone (typical) | `beep-effect8/.beep` | 239 MB (`professional-desktop` 117 MB, `qa` 77 MB, `ci` 21 MB) |
| `.turbo` per clone | `beep-effect/.turbo` | 364 MB |
| `~/.cache/beep/turbo` (shared `TURBO_CACHE_DIR`) | | 252 MB |
| `agent-evidence` (hook events) | `~/.local/state/beep/agent-evidence` | 447 MB |

Correction to the capture: in-clone `.beep` is not the tens-of-gigabytes
problem. The weight is per-lane `node_modules` and the ai-metrics data root.

### Path-dependent surfaces

| Surface | Path assumption | Location |
| --- | --- | --- |
| Worktree service managed root | `<dirname(mainCheckout)>/<basename>-worktrees` | `packages/tooling/tool/cli/src/commands/Worktree/Worktree.service.ts:996`, `Worktree.constants.ts:15` |
| `yeet sweep --fleet` candidates | every `beep-effect*` dir, `beep-effect*-worktrees/*`, and `<clone>/.claude/worktrees/*` under the projects root (ruling 73) | `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts:654-700`, `Yeet.command.ts:1276` |
| `beep worktree fleet` | `fleetRoot` = parent of the repo root; also scans `~/.codex/worktrees` | `goals/fleet-mirror`, `commands/Worktree/` |
| Residue reap | `codexRoot/worktrees`, `beep-cache-disposable` classes | `packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts:1601-1625` |
| User units with a baked checkout | `beep-graft-deep-refresh`, `beep-refs-refresh` -> `beep-effect0`; `beep-residue-reap`, `beep-tmpfs-reap`, `beep-portfolio-watch` -> `beep-effect5`; `beep-research-daily`, `beep-research-repo-card` -> `beep-effect7` | `systemctl --user cat <unit>` |
| Detached proof jobs | `beep-proof-<jobId>.service` bakes the lane path at submit time | two active today (`beep-effect5-worktrees/patent-document-schema-close`, `beep-effect2-worktrees/codec-statics-closeout`) |
| Workstation config | `~/.config/beep/{ai-metrics.env,turbo-cache.env,models.yaml,cognee.env}` | clone-agnostic |
| Workstation state | `~/.local/state/beep/{ai-metrics,agent-evidence,yeet,models,refs}`, `~/.local/state/beep-psi` | clone-agnostic |
| Standard | `standards/git-worktrees.md` documents `<checkout-root>-worktrees` and `.claude/worktrees` as the two legal homes | |

## In-Repo Capability Inventory

| Capability | Status | Where |
| --- | --- | --- |
| Derived fleet mirror (per-checkout branch, head, dirty, liveness, conflict prediction, policy movement) | EXISTS, completed-retained | `goals/fleet-mirror`, `bun run beep worktree fleet --json` |
| Worktree lifecycle (`add`, `remove --archive`, `list`) with sibling-root derivation | EXISTS | `packages/tooling/tool/cli/src/commands/Worktree/` |
| Lane retirement after merge (`yeet sweep --retire`, live-checkout fence) | EXISTS | `commands/Yeet/`, memory `agent-post-merge-closeout` |
| Fleet-wide residue reap (aged previews, turbo runs, qualification views, codex sessions) | EXISTS, timer on `beep-effect5` | `internal/repo-run/ResidueReap.ts` |
| tmpfs janitor | EXISTS (dry-run by default) | `beep quality tmpfs-reap` |
| Timer renderers with agent-allowed `--refresh` | EXISTS | `beep research install-timers --refresh`, `beep graft deep install-timer --refresh`, `beep refs install-timer --refresh`; `docs/runbooks/systemd-timers.md` |
| Shared turbo cache dir | EXISTS, used only by the reap unit | `TURBO_CACHE_DIR=~/.cache/beep/turbo` |
| Shared Bun install cache | EXISTS as a directory | `~/.cache/beep/bun-install-cache` (6.5 GB); whether lanes install from it is unverified |
| Authored seat/lane registry (seat role, lane slug, packet, drain status, retention exemptions) | NOT FOUND | NET-NEW, to be an authored layer joined onto the fleet mirror |
| Fleet-root configuration (`BEEP_FLEET_ROOT` or equivalent) | NOT FOUND | NET-NEW; today derived from the repo root's parent |
| Lane bootstrap that wires shared caches by default | NOT FOUND | NET-NEW |
| ai-metrics retention policy | NOT FOUND | data root grows unbounded at 29 GB |

## Constraints Discovered

- Lanes under `/tmp` are forbidden (tmpfs is zram-backed memory); agent
  worktrees belong in a sibling root (`AGENTS.md`, Quality Operator).
- `yeet sweep --retire` and Codex `--add-dir` recipes rely on
  `git rev-parse --git-common-dir` resolving to the owning clone's `.git`;
  any topology change must keep that resolvable.
- Detached proof services bake absolute lane paths at submit time, so a lane
  with an active `beep-proof-*` unit must never be moved.
- `fleet-mirror` SPEC is read-only and derived by design; authored facts
  belong beside it, not inside it.
- Oppold corpus material never enters a clone, lane, or shared cache
  (`~/.claude/rules/oip-confidentiality.md`).
- Three operator clones (`0`, `5`, `7`) host timers; draining them is gated
  on re-rendering those units from the ops seat.
