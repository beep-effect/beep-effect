# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `fleet-root-registry` | One fleet-root setting read by every path-dependent CLI surface, plus the authored seat/lane registry joined onto the derived fleet mirror; `beep worktree fleet` output unchanged, a new joined view added; mirror undercount explained or fixed. | none | reuse `goals/fleet-mirror` (`beep worktree fleet`); extend `commands/Yeet/internal/Economics.ts` (`projectsRootOf`, `fleetCandidates`), `commands/Worktree/Worktree.service.ts:996` managed root; NET-NEW registry schema + store under `~/.local/state/beep` |
| `lane-bootstrap` | `beep worktree add` creates a lane under `lanes/`, registers it, installs (verifying Bun's hardlink backend), wires the shared `TURBO_CACHE_DIR`, seeds graft from the ops seat when present, else the owning seat; adopts desktop-app and Codex lanes on sight. | `fleet-root-registry` | extend `commands/Worktree/`; reuse `~/.cache/beep/turbo`, `~/.cache/beep/bun-install-cache`, `beep graft deep` sibling seed; NET-NEW adoption pass |
| `ops-seat-timers` | Create `seats/ops`; re-render every user timer (`research install-timers`, `graft deep install-timer`, `refs install-timer`, residue-reap, tmpfs-reap, portfolio-watch, ai-metrics forwarder) against it via the `--refresh` forms; renderers read the fleet root instead of a baked clone. | `fleet-root-registry` | reuse `docs/runbooks/systemd-timers.md` renderers; extend unit renderers to take the fleet root; NET-NEW: portfolio-watch and residue/tmpfs units gain a renderer (today hand-written) |
| `legacy-drain` | Register `projects/beep-effect*` clones as role `legacy`; add the drainable class (no open PR, no `beep-proof-*` unit, confirmed not live, clean, no local-only refs unless bundled, no registered worktrees for a clone, past grace) to residue-reap; archive `beep-effect-cutover`; reap in waves with the timer hosts last; rewrite `standards/git-worktrees.md` for seats and lanes. | `fleet-root-registry`, `lane-bootstrap`, `ops-seat-timers` | extend `internal/repo-run/ResidueReap.ts` reap classes; reuse `yeet sweep --retire` live-checkout fence, `beep worktree remove --archive`; doctrine: `standards/git-worktrees.md` |
| `ai-metrics-raw-retention` | Age-based compress or offload of `~/.local/state/beep/ai-metrics/raw` once `derived` is proven reproducible from it; retention window and offload target decided in-goal; raw stays source of record and the restore drill keeps working on compacted data. | `ops-seat-timers` | extend `goals/ai-metrics-stack` (P7 retention posture, encrypted raw archive); NET-NEW compaction job rendered as a timer on the ops seat |

Second fleet: `beep-effect-private` needs no goal. `fleet-root-registry` must
make the fleet root per repository; the private clone then moves to
`projects/beep-private/seats/main` by hand when its lanes are idle.

## Sequencing

1. `fleet-root-registry` first. Everything else reads the setting and writes
   the registry; nothing moves until discovery sees both the new root and the
   legacy roots.
2. `lane-bootstrap` and `ops-seat-timers` in parallel. Bootstrap makes new
   work land in `lanes/`; timers make the three infra clones retirable.
3. `legacy-drain` once both land. It is the only goal that deletes anything
   and it needs the registry's drainable predicate and the ops seat in place.
4. `ai-metrics-raw-retention` depends on `ops-seat-timers` because its
   compaction timer renders on the ops seat. Its research and
   reproducibility proof may start alongside step 2; it closes after the
   ops seat exists.

Optional and out of this map: the bare object store. It is a re-entry point
once the registry has run for a while and `git-common-dir` consumers are
enumerated; a fired gate reopens this packet at `decompose`.

## First Vertical Slice

`fleet-root-registry` lands when, on this workstation:

- `BEEP_FLEET_ROOT` (or its config-file equivalent) is set to
  `~/YeeBois/projects/beep` with `~/YeeBois/projects` listed as a legacy
  root;
- `mkdir -p ~/YeeBois/projects/beep/{seats,lanes}` plus a fresh clone at
  `seats/main` is discovered by `beep worktree fleet` alongside the 223
  legacy checkouts;
- the joined view prints, for this very lane
  (`beep-effect8-worktrees/agent-fleet-layout`), its mirror facts plus
  authored role `legacy-lane`, slug `agent-fleet-layout`, and the PR number;
- the 35-directory `beep-effect0-worktrees` count matches `git worktree
  list` or the discrepancy has a named cause in the goal's reflection.

Verification: `bun run beep worktree fleet --json` before and after, diffed;
the registry file decodes against its schema; package-verify on
`@beep/repo-cli` (or whichever package owns `commands/Worktree`).

## Open Risks Inherited From The Brief

- Mirror undercount of `beep-effect0-worktrees` is unexplained; drain reads
  `git worktree list` per seat until it is.
- `git-common-dir` consumers (`yeet sweep --retire`, Codex `--add-dir`, the
  live-checkout fence) must keep resolving after lanes move to a flat dir.
- Desktop app and Codex choose their own worktree roots; adopt, never fight.
- Detached proof units bake lane paths; the reaper checks units before trees.
- `unknown` liveness (205 of 223 at census) blocks a drain; it never counts as idle.
- Local-only branches, tags and stashes are bundled and verified before a checkout is removed; a clone drains only after its registered worktrees.
- Compacted ai-metrics raw must stay restorable; the restore drill is part of acceptance.
- The fleet root is per repository or the private fleet is invisible.
- A shared `TURBO_CACHE_DIR` across seats needs the reap's size cap.
- Timer re-render touches installed units; only the `--refresh` forms are
  agent-permitted, and the units are snapshots until re-rendered.
