# Fleet Mirror Spec

Graduated from [`explorations/fleet-coordination`](../../explorations/fleet-coordination/README.md)
on 2026-08-06. Non-goals below are seeded from that packet's `BRIEF.md` no-gos;
constraints from its rabbit holes; the decision log from its `DECISIONS.md`.
Back-links, never copies — the exploration remains the authority for *why*.

## Objective

`beep worktree fleet` renders a **read-only, derived** view of every checkout
sharing this repository's origin, so an agent can see duplicate work and moved
base state without any agent posting anything.

**Rung 1 (this packet) is derivation only.** The command exists, the three
signals are correct, and a human runs it. Ambient delivery through
`AgentBrief.fleet` is rung 2 and is **blocked** until speed-loop PR-I lands that
field; it is a non-goal here.

Observable end state: on a workstation with several checkouts, `beep worktree
fleet` reports, per checkout, its branch, head, dirty count, liveness, whether it
conflicts with ground-truth `main`, and whether `main` has moved onto a measured
policy path — with every field either **measured or `unknown`**, never inferred.

## Non-Goals

Seeded from `BRIEF.md` no-gos. These are prohibitions, not deferrals-in-disguise;
each was decided in the exploration's grill.

- **No claim registry, no mutual exclusion, no leases, no enforcement.** The
  mirror is read-only. `FleetClaim`'s shape stays reserved for a later decision.
- **No ambient delivery.** No `AgentBrief.fleet` emission, no hook wiring, no
  epoch-gated re-pulse — all rung 2, gated on PR-I.
- **No `PreToolUse` deny.** Its `Edit|Write` matcher misses every Bash-mediated
  write (heredocs, `sed -i`, `git apply`, this repo's own mandated codegen), and
  the denied-agent retry loop is unbudgeted.
- **No watcher daemon.** `main` is PR-only, so merges land server-side and no
  local `post-merge` hook fires anywhere in the fleet at that moment.
- **No merge queue, no `strict_required_status_checks_policy`.** Blocked on a
  named flip condition whose binding term — main's full-repo gauntlet passing
  ≥80% over 14 days — measured **19%** (39/206).
- **No unmeasured path in the policy surface**, ever.
- **No `claude agents --json` as a liveness source** — observed multi-day-old
  zombie entries with no pid, and `status` 23 minutes stale while actively
  running.
- **No `flock`-based liveness.** The kernel releases it only when the last
  descendant holding the inherited fd closes it, and this fleet orphans
  `bun`/`turbo` children constantly. Lock lifetime is not claim lifetime.
- **No editing `Yeet/internal/*`.** Pre-push wiring, the policy-surface staleness
  guard, and the #551 regression all belong to speed-loop (PR-E/PR-G).
- **No cross-machine coordination.** One filesystem, one kernel, one user.
- **No new package.** Everything lands in existing tooling packages.
- **No modification of `beep worktree doctor`'s single-clone row schema.**

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Worktree/` — the new `fleet`
  subcommand, its schemas, and the derivation service.
- Its test file(s) under the same package's `test/`.
- Nothing else. Net-new surface is **one widened enumeration, one schema row, one
  subcommand, one cache directory**.

## Constraints

Seeded from `BRIEF.md` rabbit holes plus the exploration's amended decisions.

### The binding law

**Every field in the snapshot is either measured or `unknown`.** Nothing is
inferred from a proxy, and nothing defaults to the safe-sounding value — a
falsely-`clean` or falsely-`dormant` field is a *silent miss*, which is strictly
worse than an absent one. This law was derived twice in the exploration, from two
independent defects (D4 and D5 amendments), and it governs every signal here.

### Liveness has three states

`live | dormant | unknown`. `live` and `dormant` are facts; `unknown` is
ignorance and renders as **silence**, never as `dormant`. `/proc/<pid>/cwd` is
**not universally readable** — root-owned processes return `EACCES` on the
symlink read even though the entry lists — so the scan degrades and **reports its
own coverage** so a partial scan is legible as partial. The scan must cover
*every* PID, not just agent PIDs: one agent's cwd was `beep-effect3` while its
child ran `yeet publish` in `beep-effect3-pra`.

Live = `/proc` cwd over all readable PIDs ∪ transcript mtime < 900 s ∪ worktree
mtime < 900 s.

### `merge-tree` needs the target *object*, not its SHA

`git ls-remote` returns a SHA; `git merge-tree` needs the commit and its trees
present locally, and clones do not share object databases. True remote `main` was
held by **0 of 69 checkouts** at scan time, so signal 2 is unavailable exactly
when `main` has just moved — which is the entire Mode B trigger. Fetch the target
**once per epoch** into a dedicated scanner object database, then predict. Until
the object is materialized, signal 2 reports `unknown`, never `clean`.

### The PR→checkout join is one-to-many

Git's checkout exclusivity is scoped to one repository and its linked worktrees,
**not across independent clones** — and independent clones are this fleet's
topology, so the same branch name can be checked out in several at once
(`git worktree add --force` breaks it even within one repository). Retain every
match and disambiguate by head-repository identity plus commit SHA. A name-only
join attributes PR facts to the wrong checkout.

### Signal 3's policy surface is measured, never guessed

A path enters the surface only by clearing a commit-frequency bar measured
against recent first-parent `main` commits. The intuition-built 14-path list
touched **52.6%** of the last 253 commits and would have hard-failed 53% of
publishes at one commit behind. Measured, `biome.json*` (4.0%) and `turbo.json`
(5.1%) clear it; `package.json` (38%), `packages/tooling` (34%), `bun.lock`
(31%), and `tsconfig` (29%) do not, and `.beep/**` is untracked.

### Cross-clone git reads have sharp edges

- `FETCH_HEAD` lives in `--git-common-dir`, not `--git-dir` — reads from a linked
  worktree silently return nothing.
- `status --porcelain` **without `-uall`** collapses untracked directories, so a
  checkout holding a whole new package reads as one path.
- `[ -d .git ]` misses every linked worktree; `find -maxdepth 2 -not -path
  '*/.git/*'` does **not** exclude `.git` itself — use `-name .git -prune`.
- `gh api` needs `--paginate` on PR file lists or any PR over 100 files silently
  reads as touching fewer.
- Treat a failed probe as `unknown`, never `clean`: `merge-tree --write-tree`
  writes loose objects into shared ODBs while agents commit, and `status` can
  fail transiently on `.git/index.lock`.
- Path-filter vendored surfaces (`.repos/**`) before the collision matrix.

### Repo law

- Design order is **schema → `Context.Service` contract → implementation**.
- Effect v4 only; `effect/HashMap` / `effect/HashSet` over native `Map`/`Set`.
- Effect-returning generators use `Effect.fn` / `Effect.fnUntraced`.
- No change-surface disjointness pre-filter on `merge-tree` — measured **48%**
  false negatives, because conflicts arise from everything since the merge-base.

## Acceptance Criteria

- [ ] A `FleetCheckout` schema exists with liveness as a three-member
      `LiteralKit` domain (`live | dormant | unknown`) and every derived field
      expressible as `unknown`.
- [ ] A `Context.Service` derives the fleet snapshot: enumerates checkouts
      sharing the origin URL, classifies liveness, materializes the epoch target
      into the scanner ODB, runs `merge-tree` per live checkout, and evaluates
      policy-path movement against a measured surface.
- [ ] The snapshot reports its own scan coverage, so a partial scan is legible as
      partial rather than as a complete clean result.
- [ ] `beep worktree fleet` renders the snapshot read-only and writes nothing to
      any checkout other than the scanner ODB cache.
- [ ] **The proof test:** a test reconstructing the #551 shape — `main` moves
      onto a measured policy path while a checkout holds an in-flight branch that
      never touched the changed file — asserts **signal 3 fires** and **signals 1
      and 2 stay silent**, because that collision has no textual conflict.
- [ ] A test asserts an unreadable `/proc` entry yields `unknown`, never
      `dormant`.
- [ ] A test asserts an unmaterialized `merge-tree` target yields `unknown`,
      never `clean`.
- [ ] `beep worktree doctor` behavior and its row schema are unchanged.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/fleet-mirror/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/fleet-mirror/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/fleet-mirror` | Passes |
| Repo proof | `bun run beep yeet verify` | Green |
| Mode B proof test | the #551-shape test above | Fails before the signal-3 implementation, passes after |
| Doctor untouched | `beep worktree doctor` output diff vs pre-change | Identical |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope — in particular, any pull toward
  claims, enforcement, or ambient delivery.
- A signal cannot be made correct without inferring a field from a proxy. Report
  rather than infer.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Decision Log Seed

From [`explorations/fleet-coordination/DECISIONS.md`](../../explorations/fleet-coordination/DECISIONS.md)
— the authority; summarized here only for routing.

| Ref | Decision |
| --- | --- |
| D1 | Build mandate is the repo-wide regeneration rule plus a read-only mirror. No claim registry. |
| D2 | Q0 pre-push enforcement handed to speed-loop PR-G, not fixed here. |
| D3 | All three signals ship; signal 3's surface is measured, never guessed. |
| D4 (amended) | Receipt posture derives from `git status`, not from which hook fired. Rung 2. |
| D5 (amended) | Liveness filters signal 2, labels signal 1, and has a third `unknown` state. |
| 2026-08-06 | Rung 1 starts now; rung 2 waits for PR-I. Derivation depends on nothing unmerged. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
