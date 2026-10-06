# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

One monorepo, one workstation, 223 checkouts in 23 operator clones, 18 of
them live. The operator opens WebStorm in a numbered clone and starts agent
chats from it; agents then pick a worktree by convention. The convention has
three legal homes (`<clone>-worktrees/*`, `<clone>/.claude/worktrees/*`,
`~/.codex/worktrees/*`) and eleven illegal ones, six empty worktree roots,
lanes whose path names a clone that does not own them, and timers spread
across three clones so none of them can be retired. Nothing records which
lane belongs to which packet, PR or job, so "is this safe to delete" is
answered by a human reading directory names. Disk follows: 88 GB of
dependency versions held open by stale lanes and 22 GB of raw telemetry
nobody has a retention rule for.

Why now: the fleet mirror (`beep worktree fleet`) shipped, so checkout facts
are derivable; the operator is about to start fresh anyway; and every new
numbered clone makes the drain harder.

## Appetite

One exploration packet graduating into four or five small goal packets,
each a single PR. The migration is a drain measured in weeks, not a cutover
weekend. Nothing here may interrupt a live checkout or an active
`beep-proof-*` job. Budget: a few agent sessions per goal; no new services,
no new daemons, one new config value.

## Solution Sketch

### Layout

```
$HOME/YeeBois/projects/beep/                 fleet root (one per repository)
  seats/
    main/        operator WebStorm seat; tracks main; agents may help here
    ops/         owns every user timer; tracks main; nobody tinkers
    a/ b/ c/     chat-start seats; agents branch lanes off them
  lanes/
    <slug>/      one lane per packet or PR; git worktree of some seat
$HOME/YeeBois/projects/beep-private/         second fleet for beep-effect-private
```

A seat is a full clone with its own `.git`. A lane is a linked worktree of
exactly one seat; which seat is a registry fact, not a path fact. Lanes are
disposable by rule: anything worth keeping is committed to the packet or
exported to `~/.local/state/beep` before retire.

### Registry (authored) over mirror (derived)

`beep worktree fleet` keeps deriving what git and `/proc` know: path, branch,
head, dirty count, liveness, conflict, policy movement. A new authored
registry under `~/.local/state/beep` adds only what cannot be derived:

| field | source |
| --- | --- |
| seat role (`main`, `ops`, chat) | operator |
| lane slug, packet, PR | agent at lane creation (`beep worktree add`) or adoption |
| drain status (`active`, `draining`, `retired`) | reaper |
| retention exemptions | operator |

A join command renders both as one view. The desktop app's
`.claude/worktrees` lanes and Codex's `~/.codex/worktrees` lanes are adopted
on sight by the same scan the mirror already performs.

### One fleet-root setting

`yeet sweep --fleet`, the worktree service's managed root, residue-reap and
the timer renderers all derive "where the fleet is" today from the repo
root's parent or a baked `WorkingDirectory`. Replace that with one setting
(working name `BEEP_FLEET_ROOT`, default `$HOME/YeeBois/projects/beep`) that the
CLI reads and the unit renderers bake. A fleet root may also list sibling
legacy roots so discovery sees `projects/beep-effect*` until the drain ends.

### Lane bootstrap

`beep worktree add` becomes the only sanctioned way to create a lane and
does four things: create the worktree under `lanes/`, register it, install
dependencies (Bun hardlinks by default; the bootstrap only verifies the
backend), and point `TURBO_CACHE_DIR` at `~/.cache/beep/turbo` so seats and
lanes share one cache. The graft index is seeded from the ops seat when it exists, otherwise from the lane's owning seat.

### Drain-on-empty

The reaper gains one class: a checkout is drainable only when all of these hold past a grace window: no open PR; no active `beep-proof-*` unit; liveness confirmed not-live (an `unknown` liveness reading blocks the drain until a readable check confirms inactivity); a clean tree; no local-only work (every local branch, tag and stash is reachable from a remote ref, or has first been preserved in a `git bundle` under `~/.local/state/beep`); and, for a clone, no linked worktree still registered to it (owned lanes retire before their clone, checked with `git worktree list`, because removing the clone removes the `.git` store those lanes live in). Legacy clones are
registered read-only with role `legacy` on day one and drain under the same
rule. The three timer hosts drain last, after every renderer has been
re-rendered against `seats/ops`.

### Telemetry retention

ai-metrics `raw` (22 GB, 97% older than 30 days) gets an age-based compress
or offload step once `derived` is shown reproducible from it. The forwarder
is clone-agnostic already; the new layout needs no telemetry change.

## Rabbit Holes

- **Mirror undercount.** The fleet mirror attributed 1 of 35
  `beep-effect0-worktrees` directories to that root. Until that is explained,
  drain decisions must read `git worktree list` from every seat, not the
  mirror's grouping. Inherited by the registry goal.
- **`git-common-dir` contracts.** `yeet sweep --retire`, the live-checkout
  fence and Codex `--add-dir` resolve the owning `.git` through git. Moving
  lanes to a flat directory keeps that resolvable; a later bare store does
  not without rework. Bare store stays a later phase.
- **Desktop app placement.** The app decides where its worktrees go. Adopt,
  never fight; if a future app setting allows a root, point it at `lanes/`.
- **Baked unit paths.** Detached proof units bake the lane path at submit
  time. A lane with an active unit is never moved or reaped; the reaper
  checks units before trees.
- **Second fleet.** `beep-effect-private` is a different repository. The
  fleet-root setting must be per repository, or the private fleet is
  invisible to its own tooling.
- **Turbo cache coherence.** Sharing `TURBO_CACHE_DIR` across seats on
  different commits is safe by hash design, but the shared dir then needs
  the existing reap's size cap applied to it.

## No-Gos

- No single bare object store in this packet (later phase, after the
  registry exists).
- No move of any live checkout, dirty lane, or lane with an active proof
  unit; no hard cutover date.
- No rewrite of `standards/git-worktrees.md` or
  `docs/runbooks/systemd-timers.md` here; each graduated goal lands its own
  doctrine with its code.
- No deletion of ai-metrics `raw` data; compress or offload only.
- No new install backend or shared `node_modules` scheme; Bun's hardlinks
  already do this.
- No cross-machine fleet; one filesystem, one user (inherited from
  `fleet-coordination`).
- Nothing from the Oppold corpus, client documents or secrets enters a seat,
  lane or shared cache.
