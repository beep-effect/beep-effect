# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

All entries 2026-10-05, settled in one `/grill-with-docs` session (five
rounds via AskUserQuestion, recommended answer first). The operator took the
recommendation on every question except where noted.

## 2026-10-05 — unit-of-organization

**Question:** Is the primary unit the clone (seat) or the lane (worktree carrying one packet or PR)?

**Answer:** Lane-first. A lane registry is the source of truth; clones become a small fixed pool of role-named seats.

**Rationale:** 223 checkouts, 18 live. The numbered clones multiplied because nothing recorded which clone held what; the registry removes that pressure. Rejected: clone-first (sprawl returns), lane-only with no seats (WebStorm and tinkering lose a stable home).

## 2026-10-05 — git-topology

**Question:** One `.git` per seat, or a single bare object store with every seat and lane as a worktree?

**Answer:** Per-seat clones now; evaluate a bare store as a later phase once the registry exists.

**Rationale:** `yeet sweep --retire`, `git-common-dir` resolution and Codex `--add-dir` all assume clone-plus-sibling. Rework before any disk win would block the whole packet. Rejected: bare store day one (reworks three contracts first), ruling bare out forever (22 x 2.7 GB `.git` is real cost).

## 2026-10-05 — fleet-root-path

**Question:** New root at `~/YeeBois/beep-effect` as proposed, or under `projects/`?

**Answer:** Under `~/YeeBois/projects/` with a new namespace (working name `projects/beep/{seats,lanes}`) and a single fleet-root setting the CLI and timers read.

**Rationale:** `yeet sweep --fleet`, five user units and portfolio-watch all discover via the projects root; a root outside it is invisible until discovery is parameterized anyway. Rejected: `~/YeeBois/beep-effect` as a hard requirement (operator confirmed it was "somewhere clean", not the path), flat rename only (keeps the glob-by-prefix sprawl).

## 2026-10-05 — migration-posture

**Question:** How do the 22 old clones and their running agents move?

**Answer:** Greenfield plus drain-on-empty. Old clones are registered read-only and decommissioned by the reaper when they have no open PR, no active proof job and no dirty lane. Timer-hosting clones (`0`, `5`, `7`) re-point last.

**Rationale:** Two detached proof jobs and 18 live checkouts exist right now. Rejected: hard cutover date (drops in-flight work), migrate in place (highest interruption risk).

## 2026-10-05 — lane-home

**Question:** Flat fleet `lanes/` directory or per-seat `<seat>-worktrees` as today?

**Answer:** Flat `lanes/<slug>`; the owning seat is a registry fact, not a path fact.

**Rationale:** One place to list, reap and open. Six `-worktrees` roots are already empty and 11 ad hoc sibling worktrees ignore the convention. Requires the worktree service to stop deriving the root from the seat basename (`Worktree.service.ts:996`). Rejected: per-seat roots (status quo), `lanes/<seat>/<slug>` (path encodes a fact the registry owns).

## 2026-10-05 — desktop-app-lanes

**Question:** Policy for lanes the desktop app creates under `<clone>/.claude/worktrees` (15 exist)?

**Answer:** Allowed as ephemeral and auto-adopted into the registry; same drain rule as every lane.

**Rationale:** Fighting the app's placement is fragile; adopting is cheap because the fleet mirror already scans them. Rejected: forbidding (depends on app settings), ignoring (silent disk growth).

## 2026-10-05 — lane-disposability

**Question:** Is anything in a lane's `.beep` (qa, ci, yeet, inbox) irreplaceable?

**Answer:** No. Lanes are disposable. Anything worth keeping is committed to the packet or exported to `~/.local/state/beep` before retire.

**Rationale:** Enables a one-command reaper and makes "never lose work" a property of the commit and export discipline rather than of disk hygiene. Rejected: QA-evidence export step (operator confirmed evidence that matters is already in packets or PRs).

## 2026-10-05 — deps-disk

**Question:** Strategy for 88 GB of per-lane `node_modules`?

**Answer:** Every lane installs from the shared Bun install cache with Bun's hardlink or clonefile backend; measure actual dedupe on one lane before relying on it.

**Rationale:** The cache already exists (6.5 GB). Rejected: reaping only (12 finished-looking lanes in `beep-effect2-worktrees` show reaping lags), shared `node_modules` via symlink (breaks on any dependency bump).

## 2026-10-05 — seats

**Question:** How many seats, named how?

**Answer:** About five, role-named: `main` (operator WebStorm seat), `ops` (owns every timer, tracks `main` only, nobody tinkers in it), plus `a`, `b`, `c` for chat starts.

**Rationale:** Names say what a seat is for; the registry says what is in it. Rejected: numbered seats (back to `beep-effect<x>`), 8+ seats (no evidence of that peak).

## 2026-10-05 — ops-seat-timers

**Question:** Consolidate the timers spread across `beep-effect0/5/7`?

**Answer:** One ops seat owns all timers; every renderer re-renders against it.

**Rationale:** Drain-on-empty cannot retire a clone that hosts a timer. Rejected: a bare non-seat checkout for ops (a sixth kind of thing), leaving timers in place (contradicts drain).

## 2026-10-05 — telemetry-weight

**Question:** ai-metrics state is 29 GB. What does this packet decide about it?

**Answer:** Census plus a per-class retention policy, no data loss, and confirm the forwarder is clone-agnostic so the new layout needs no telemetry change.

**Rationale:** It is the real "tens of gigabytes" the capture attributed to `.beep`. Rejected: out of scope (it is the operator's stated frustration), relocate to a bigger disk (defers the question).

## 2026-10-05 — registry-implementation

**Question:** What implements the lane registry?

**Answer (amended same day):** A schema-first, file-backed authored layer under `~/.local/state/beep`, joined onto the existing derived fleet mirror (`beep worktree fleet`, goal `fleet-mirror`). The registry authors only what git cannot derive: seat role, lane slug and packet, drain status, retention exemptions. Command group name (`beep fleet` vs under `worktree`) is left to the goal.

**Rationale:** Round 3 first chose a new `beep fleet` group; research then found `fleet-mirror` already derives 223 checkouts including `~/.codex/worktrees`. Two sources of truth for checkout facts were rejected. Folding authored fields into `worktree fleet` was rejected because its SPEC is read-only and derived by design. Hand-maintained YAML rejected (drifts within a week).

## 2026-10-05 — outliers

**Question:** `beep-effect-private` (24 GB) and `beep-effect-cutover`?

**Answer:** Census them; decide in `shape`. A stale duplicate drains like any clone; anything non-public gets a home outside the fleet.

**Rationale:** Memory `beep-effect-private-duplicate` already flags it as a duplicate; verify before acting. Rejected: making it a seat, ignoring it.

## 2026-10-05 — shared-caches

**Question:** Target for cross-checkout caches (graft seed, turbo, bun)?

**Answer:** Every lane reads shared caches by default: lane bootstrap sets the shared `TURBO_CACHE_DIR`, consumes the graft seed from the ops seat, installs from the shared Bun cache. Per-lane cache dirs become empty by construction.

**Rationale:** The shared turbo dir exists and is already the default for CLI-driven turbo runs and direnv shells (corrected in review; see `RESEARCH.md`); bootstrap closes the remaining invocation paths. Rejected: graft per lane (640 MB each), status quo plus reaping.

## 2026-10-05 — packet-home-and-slug

**Question:** Where is this packet created and what is its slug?

**Answer:** Lane `beep-effect8-worktrees/agent-fleet-layout` on branch `explore/agent-fleet-layout`, slug `agent-fleet-layout`, draft PR.

**Rationale:** `main` is PR-only and `beep-effect8` may be in use. Created under the old `-worktrees` convention one last time because the fleet directory does not exist yet.

## 2026-10-05 — scope-guard

**Question:** Include `standards/git-worktrees.md` and `docs/runbooks/systemd-timers.md` rewrites now?

**Answer:** No. Census, decisions and decomposition only. Doc rewrites belong to the graduated goals.

**Rationale:** Doctrine should land with the code that enforces it. Rejected: doc drafts in this PR.

## 2026-10-05 — external-landscape

**Question:** What do other multi-agent monorepo operators do (bare store + worktrees; Bun hardlink dedupe; turbo cache across checkouts)?

**Answer:** Resolved in the second session; see `RESEARCH.md` "External Landscape". Deferred at align, closed before shape.

**Rationale:** Bare-store pattern confirmed as the later phase's shape; Bun hardlinks confirmed as Linux default; Turborepo confirmed to share cache across linked worktrees of one seat only.

## 2026-10-05 — deps-disk — AMENDED

**Question:** Does the shared-Bun-cache decision still buy anything?

**Answer:** Bun already hardlinks every lane's `node_modules` against its cache (link count 20 on sampled files; 4.1 GB hardlinked, 0 GB unique in this lane). The 88 GB across lanes is distinct dependency versions held open by stale lanes. The lever is drain-on-empty, plus one bootstrap check that a lane's install stays on the hardlink backend. No install-backend work is in scope.

**Rationale:** Measured, not assumed. Rejected: building a shared-install feature that duplicates Bun's default.

## 2026-10-05 — outliers — RESOLVED

**Question:** `beep-effect-private` and `beep-effect-cutover`?

**Answer:** `beep-effect-private` is a different repository (private duplicate with upstream sync), so it is its own fleet beside this one, never a seat or lane of it; the fleet-root config must allow more than one fleet. `beep-effect-cutover` is 1.1 MB of July notes; archive into `~/.local/state/beep` or the research tree, then remove.

**Rationale:** Census showed a separate `origin`, clean tree, 16 GB of app build output. Rejected: treating it as a seat (wrong repo), ignoring it (24 GB).

## 2026-10-05 — telemetry-retention-shape

**Question:** Which ai-metrics class carries the weight and what is the retention shape?

**Answer:** `raw` (22 GB, 97% older than 30 days). Retention = compress or offload `raw` by age once `derived` is proven reproducible from it; `derived`, `mirror`, `config-snapshots` untouched. Exact window is a goal decision.

**Rationale:** Measured per class. Rejected: deleting raw outright (forwarder provenance), relocating the whole root.

## 2026-10-05 — review-amendments (PR #1418)

**Question:** Which reviewer findings change the shaped contract?

**Answer:** Five. (1) The drainable predicate gains three conditions: liveness must be confirmed not-live (`unknown` blocks), no local-only branches, tags or stashes unless bundled first, and a clone drains only after every worktree registered to it. (2) `legacy-drain` also depends on `lane-bootstrap`. (3) `ai-metrics-raw-retention` depends on `ops-seat-timers` and must keep the restore drill working on compacted data. (4) `lane-bootstrap` seeds graft from the ops seat when present and from the owning seat otherwise, so it does not depend on the ops seat. (5) The ops-seat acceptance check covers the named timer-backed units and excludes transient `beep-proof-*` units.

**Rationale:** The census itself shows 205 of 223 checkouts with `unknown` liveness and 11 ad hoc worktrees, so "not reported live" and "clean tree" are not safe proxies for "nothing to lose". Rejected: keeping retention independent (its timer needs the ops seat), making `lane-bootstrap` wait on the ops seat (would serialize the two parallel goals).
