# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to the
implementing goal packet. Shaped 2026-08-05 inside the five align boundaries in
DECISIONS.md (D1-D5 plus the four disposals); grounded in RESEARCH.md and the
five research lanes. Deliberately short — the load-bearing section is No-Gos,
because this packet's research killed more than it built.
-->

## Problem

Roughly thirteen clones of this monorepo run on one workstation, each hosting an
independent agent session with no view of the others. Two failure modes recur.

**Mode A** — several agents independently fix the same broken `main`, burning
duplicate tokens and colliding at merge time. Measured at open: five live
collision pairs, of which **only one is intra-wave**. Three cross clone
boundaries that no `WaveManifest` can see, and one is a cross-clone *source*
collision on `OntologyMcpTransport.ts` that neither #60 nor #49 touches.

**Mode B** — one agent lands a repo-wide change and every other agent's in-flight
PR rots. Mode B is the harder half and the reason this packet exists in its
current shape: **it produces no textual conflict**, so every conflict-based
instrument is structurally blind to it. PR lanes run `--affected --base
origin/main`, so base-side breakage in an untouched package is invisible, and no
run is triggered by base movement at all.

A specimen landed mid-packet. #551 changed `Yeet/internal/Handler.ts` on
2026-08-04 such that every `yeet publish` without `--monitor` — the documented
default — exits non-zero after a completely successful publish. Nothing
conflicted. The landing session shipped with `--fast --monitor`, the one flag
combination that never reaches the broken branch, so it was green on the author's
path and broken on everyone else's. It was found a day later by tripping it. That
is the entire cost function: the tax is paid by whoever collides, not by whoever
lands.

The operator's framing was a message board. The research says build a **mirror**:
every input already sits on disk, so nothing needs to be posted, and there is no
protocol for anyone to forget. **Derive early, deliver ambiently, enforce late.**

## Appetite

**One small goal packet, one to two focused days, starting when PR-I merges.**

The sequencing is structural, not merely collision-avoidance: D4 makes
`AgentBrief.fleet` the delivery vehicle, and that field ships in PR-I. Building
ahead of it means building the mirror against a surface that does not exist yet.

Budget-busting looks like the derivation scan not producing a correct fleet
snapshot inside day one. The cut is signal 3 — ship signals 1 and 2, which need
zero calibration, and let the policy surface land later. Never cut the
epoch-stamping or the read-only posture to make the budget.

## Solution Sketch

Two independent deliverables. The first does not depend on the second.

**1. Regeneration rule, repo-wide (#60).** Four of five measured collisions are
contention on generated aggregates. The rule that generalizes is "regenerate,
never hand-merge" applied as **repo-wide policy**, not as a `WaveManifest`
carve-out — #49's shared bucket covers 1 of those 4, because the other three
cross clone boundaries a wave manifest cannot see.

**2. A read-only fleet mirror.** Derived at fire against a cached epoch file that
any clone refreshes when it fetches; no daemon, no registry, no enforcement.
Design order is schema → `Context.Service` contract → implementation.

Signals it carries (D3):

| Signal | Catches | Calibration |
|---|---|---|
| 1. Live dirty/diff overlap across checkouts | Mode A | none |
| 2. `git merge-tree --write-tree --name-only` vs ground-truth main | stale checkouts | none |
| 3. Main moved onto a **measured** policy path | **Mode B** | measured list only |

Delivery and posture (D4, as amended): `SessionStart` is the delivery *moment*,
but the directive is selected by **measured worktree state** — `git status
--porcelain -uall` empty means act-now, non-empty means epoch-stamped facts plus
**defer-to-checkpoint**, and a failed probe means defer. The event itself proves
nothing about the tree: it fires on `resume`, `clear`, `compact`, and `fork` too.
Every bulletin is an epoch-stamped fact, because injected context is replayed
verbatim on `--continue`/`--resume`. Silence when the epoch is unchanged costs
zero tokens.

**Binding law across every signal (D4 + D5 amendments): each field is either
measured or `unknown`.** Nothing is inferred from a proxy, and nothing defaults
to the safe-sounding value — a falsely-`clean` or falsely-`dormant` field is a
silent miss, which is strictly worse than an absent one.

Liveness (D5) suppresses signal 2 and **labels** signal 1 — a dormant checkout
holding 57 uncommitted files is not noise, it is the largest uncommitted change
surface in the fleet. Live = `/proc` cwd across all PIDs ∪ transcript mtime
< 900 s ∪ worktree mtime < 900 s.

Composed capabilities, not new ones: `beep worktree doctor` (widen its
enumeration to all checkouts sharing the origin URL), `AgentBrief.fleet` (PR-I,
reserved), `OwnershipClaim` (PR-I — wrapped, never rebuilt), `beep agent report
list` (PR-I, for a live agent's own account of `filesTouched`). Net new surface
for the whole program is one widened enumeration, one schema row
(`FleetCheckout`), one field on a locked schema, and one subcommand.

**First implementation rung (the proof):** the mirror derives a fleet snapshot in
which the #551 specimen would have fired — main moved onto a measured policy path
while a clone held an in-flight branch that never touched the changed file.

## Rabbit Holes

- **Policy-surface calibration.** Bounded by D3's law: no path enters unmeasured.
  Measure against commit frequency on first-parent `main`; do not curate by
  intuition. The 14-path list that intuition produced touched 52.6% of the last
  253 commits.
- **`/proc` is not uniformly readable, and unreadable ≠ dormant.** Observed
  2026-08-05: root-owned processes return `EACCES` on the cwd symlink even though
  the entry lists. Per the D5 amendment, liveness has three states and `unknown`
  renders as **silence**, never as `dormant` — reporting ignorance as a fact is
  how a suppressed signal 2 becomes a silent miss. The snapshot states its own
  coverage so a partial scan is legible as partial.
- **`merge-tree` needs the target *object*, not its SHA.** `git ls-remote` gives
  the SHA only, clones do not share object databases, and the true remote tip was
  held by **0 of 69 checkouts** at scan time — so signal 2 is unavailable exactly
  when main has just moved, which is the whole Mode B trigger. Fetch the target
  once per epoch into a dedicated scanner ODB before predicting anything; report
  `unknown` until it is materialized.
- **The PR→checkout join is one-to-many.** Git's checkout exclusivity is scoped
  to one repository and its linked worktrees, not across independent clones —
  and independent clones are this fleet. The same branch name can be checked out
  in several at once (and `git worktree add --force` breaks it even within one).
  Disambiguate by head-repository identity plus commit SHA; never by branch name
  alone.
- **Cross-clone git reads have sharp edges.** `FETCH_HEAD` lives in
  `--git-common-dir`, not `--git-dir`. `status --porcelain` without `-uall`
  collapses a new package's 40 files into one path. `[ -d .git ]` misses every
  linked worktree, and `find -maxdepth 2 -not -path '*/.git/*'` does not exclude
  `.git` itself — use `-name .git -prune`. `gh api` needs `--paginate` on PR file
  lists or any PR over 100 files silently reads as touching fewer.
- **Correlated salience.** Mode A may partly be thirteen agents with identical
  ranking functions reading identical `CLAUDE.md` and identical red CI, not
  collapsed degrees of freedom. A mirror does not fix identical rankings; a
  deterministic per-clone tiebreak would. Out of scope here, but do not claim
  Mode A is closed.
- **Do not let the mirror become a gate.** Applying Wayne's test to this design's
  own output is the standing instruction: the moment a derived view starts
  blocking, it inherits every calibration failure the research already killed.

## No-Gos

- **No claim registry, no mutual exclusion, no leases, no enforcement** (D1). The
  mirror is read-only. `FleetClaim`'s shape stays reserved for a later decision;
  when it is built, the claim record describes *what* is claimed while
  provenance, liveness, `scannedAt`, and expiry live on the wrapper (decision 37).
- **No `PreToolUse` deny** (Q1). Its `Edit|Write` matcher misses every
  Bash-mediated write — heredocs, `sed -i`, `git apply`, and this repo's own
  mandated codegen — and the denied-agent retry loop is unbudgeted. Revisit only
  on a measured Mode A recurrence *on file paths*.
- **No watcher daemon** (Q3). `main` is PR-only, so merges land server-side and no
  local `post-merge` hook fires anywhere in the fleet at that moment.
- **No merge queue and no `strict_required_status_checks_policy`** (Q6) until the
  delivered flip condition holds — the binding blocker is main's full-repo
  gauntlet passing ≥80% over 14 days, measured at **19%** (39/206).
- **No unmeasured path in the policy surface**, ever (D3).
- **No plain-stdout hook channel.** `additionalContext` only; plain stdout
  reaches the model on `UserPromptSubmit`, `UserPromptExpansion`, and
  `SessionStart` alone.
- **No `claude agents --json` as the liveness source** (D5) — observed
  multi-day-old zombie entries with no pid, and `status` 23 minutes stale while
  actively running.
- **No editing `Yeet/internal/*` from this packet** (D2, Q7, and item 3 of
  HANDOFF-2). Pre-push wiring, the staleness guard, and the #551 regression are
  all handed to speed-loop; PR-E owns that surface.
- **No cross-machine coordination** — operator ruling at open. One filesystem,
  one kernel, one user.
- **No new package**; everything lands in existing tooling packages.
- **No `flock`-based liveness.** The kernel releases it only when the last
  descendant holding the inherited fd closes it, and this fleet orphans
  `bun`/`turbo` children constantly. Lock lifetime is not claim lifetime.
