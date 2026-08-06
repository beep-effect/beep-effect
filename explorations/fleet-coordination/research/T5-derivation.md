# T5 — What can be DERIVED for free, and where it lives

**Date:** 2026-08-04
**Machine:** DankStation (CachyOS, 32c/128GB), single user `elpresidank`
**Fleet root:** `/home/elpresidank/YeeBois/projects/`
**Method:** every number below was measured on the live fleet at the time of writing.
Raw artifacts under
`/tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/56137bb3-d54a-4063-823e-aa7d138b6574/scratchpad/fleet-coord/`.

---

## Bottom line

**Everything the fleet coordinator needs is already on disk. Zero agent
cooperation is required, and the full derivation pass costs ~1.1 s in a bash
prototype and would cost ~150–250 ms implemented in-process.**

Three findings dominate:

1. **The fleet is its own remote-ref cache.** `origin/main` is a per-checkout
   cached ref. Right now 5 clones + 19 of their worktrees (24 of 69 checkouts)
   do not even hold the object for the current `origin/main`. Taking
   `max(origin/main)` across the fleet gives a fresher view of `main` than any
   individual clone, with **zero network I/O**.
2. **`git merge-tree --write-tree` is the Mode-B oracle.** It predicts, offline
   and without touching any working tree, exactly which in-flight branch will
   conflict with the incoming base. It found **13 real conflicts** across the
   live fleet in 2.27 s — including two sibling worktrees of the same P1 wave
   both hard-conflicting on the same manifest file.
3. **The correct home is not a new capability.** It is a widening of the
   enumeration in `beep worktree doctor` plus a `fleet` section on PR-I's
   `AgentBrief` (#52). The schemas to share are `WorktreeDoctorEntry` and
   `WaveManifest`. See §8.

---

## 1. Fleet shape (measured)

`ls -d beep-effect*` is **wrong**. It finds 51 checkouts and misses 18.

The authoritative enumerator is: real `.git` **directories** → filter by
`origin` remote URL → `git worktree list --porcelain` from each.

```bash
for c in "$ROOT"/*/; do
  [ -d "$c/.git" ] || continue                       # real clone, not a worktree
  url=$(git -C "$c" remote get-url origin 2>/dev/null)
  case "$url" in *beep-effect/beep-effect*) ;; *) continue;; esac
  git -C "$c" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}'
done | sort -u
```

**Cost: 50 ms. Result: 69 checkouts** (14 clones + 55 linked worktrees).

Why the naive glob fails, in three distinct ways:

| Trap | Effect | Fix |
|---|---|---|
| `.git` is a **file** in a worktree | `-d .git` misses all 55 worktrees; `-e .git` finds them but can't tell clone from worktree | `-d` ⇒ clone, `-f` ⇒ worktree |
| `.claude/worktrees/*` live **inside** clones | glob on `projects/beep-effect*` misses 18 checkouts | `git worktree list` from each clone |
| `beep-effect-logic` / `beep-effect-logos` have `origin = /…/beep-effect9` (local forks, 10 364 commits behind) | they pollute the fleet with a foreign `origin/main` | filter on remote URL |

The last one is not hypothetical — those two clones report
`origin/main = 03d2f4ab62` and would corrupt any `max(origin/main)` consensus.

---

## 2. Signal inventory

Each row: exact command, measured cost, failure modes.

### 2.1 Branch / HEAD / ahead-behind — **FREE, RELIABLE**

```bash
git -C "$d" rev-parse --abbrev-ref HEAD          # branch (or "HEAD" if detached)
git -C "$d" rev-parse HEAD                       # sha
git -C "$d" rev-parse origin/main                # cached remote ref
git -C "$d" rev-list --left-right --count origin/main...HEAD
```

**Cost: 4–8 ms per checkout, warm page cache.**

Failure modes:
- Detached HEAD reports the literal string `HEAD` as branch — 6 of 69 checkouts
  are detached; you need `git worktree list --porcelain` (which reports
  `detached`) or `symbolic-ref -q HEAD` to distinguish.
- **`origin/main` is a lie of unknown age.** See §3 — this is the single most
  load-bearing failure mode in the whole inventory.
- `origin/main` may not exist (a clone that never fetched) → empty string, must
  be `Option`-typed, not defaulted.

### 2.2 Dirty set, staged vs unstaged — **FREE, RELIABLE**

```bash
git -C "$d" status --porcelain=v1 -uall     # X Y path  — X=index, Y=worktree
git -C "$d" diff --cached --name-only        # staged only
```

**Cost: 15–25 ms per checkout** (largest observed: 92 dirty files in
`beep-effect11`, still 21 ms).

Failure modes:
- **`-uall` is mandatory.** Default `status --porcelain` collapses untracked
  directories to a single `dir/` entry; a new package's 40 files show as one
  path and the collision matrix silently under-reports.
- Rename entries are `old -> new`; you must split or you index a non-existent path.
- Paths containing spaces/quotes are C-quoted (`"a b.ts"`) — strip quotes.
- Concurrency: `status` takes `.git/index.lock` in some paths. A scanner running
  while an agent is mid-`git add` can transiently fail. Treat a failed probe as
  `unknown`, never as `clean`.

### 2.3 Intended change surface (diff vs merge-base) — **FREE, CAVEATED**

```bash
mb=$(git -C "$d" merge-base origin/main HEAD)
git -C "$d" diff --name-only "$mb"..HEAD
```

**Cost: 2–15 ms.** Note `origin/main...HEAD` (three-dot) is equivalent and
one call, but the explicit merge-base is worth having for the report.

Failure modes:
- **Stale-base inflation.** `beep-effect2` reports **1051** files in its
  branch diff because its `origin/main` is behind and the branch has absorbed a
  merge. A checkout with a months-stale `origin/main` (e.g. `beep-effect4`, base
  `afa59892fc` from 2026-04) reports garbage. Always report the base sha and its
  age alongside the count.
- **Vendored surfaces dominate the noise.** 7 checkouts "collide" on
  `.repos/effect/packages/effect/src/Schema.ts` — that is a vendored reference
  pin moving, not two agents editing the same file. A path filter
  (`!.repos/**`, `!node_modules/**`) is required before the matrix is meaningful.

### 2.4 Conflict prediction — **FREE, AND THE BEST SIGNAL AVAILABLE**

```bash
git -C "$d" merge-tree --write-tree --name-only HEAD <target-sha>
# exit 0 = clean merge; exit 1 = conflict, stdout lists conflicted paths
```

**Cost: ~50 ms per checkout** (2.27 s for 44 checkouts serially).
Touches no working tree, no index, no HEAD. Writes only loose objects to the
shared ODB. Safe to run against a checkout an agent is actively editing.

Failure modes:
- Requires the target object to be present locally. **24 of 69 checkouts could
  not run it** because they have never fetched the current `origin/main` —
  which is itself the signal (see §3).
- Writes objects into the shared object database; on a worktree that means the
  parent clone's ODB grows. Harmless (gc reclaims) but worth knowing.
- Available since git 2.38. Verified working here.

This is the primitive that turns Mode B from "broadcast a warning and hope"
into "compute the blast radius exactly."

### 2.5 Worktree vs clone topology — **FREE, RELIABLE**

```bash
git -C "$d" worktree list --porcelain     # 1 ms — worktree/HEAD/branch/detached/locked/prunable
git -C "$d" rev-parse --git-dir           # worktree: <clone>/.git/worktrees/<name>
git -C "$d" rev-parse --git-common-dir    # worktree: <clone>/.git   ← the shared one
```

Failure mode already hit by the orchestrator, confirmed here:
`/…/beep-effect3-pra/.git` is **`ASCII text`** containing
`gitdir: /…/beep-effect3/.git/worktrees/beep-effect3-pra`.
`-d .git` misses every worktree.

Second-order trap: **`FETCH_HEAD` lives in `--git-common-dir`, not `--git-dir`.**
Reading `$(git rev-parse --git-dir)/FETCH_HEAD` in a worktree returns nothing
(observed: 8 worktrees reported `FETCH_HEAD=0`). Use `--git-common-dir`.

### 2.6 Live agent detection — **FREE, AND IT WORKS**

Three independent signals; you need all three, because each misses a real case.

**(a) Process cwd.** Authoritative when it fires.

```bash
for p in /proc/[0-9]*; do
  cwd=$(readlink "$p/cwd" 2>/dev/null) || continue
  case "$cwd" in /home/elpresidank/YeeBois/projects/beep-effect*) echo "${p#/proc/}  $cwd";; esac
done
```

Measured live at scan time:

| PID | cwd | argv |
|---|---|---|
| 197785 | `beep-effect5` | `claude --dangerously-skip-permissions --effort ultracode` |
| 1459945 | `beep-effect10` | `claude … --resume LEGAL_PATENT_ONTOLOGY_RESEARCH_EXTRACTION` |
| 1532529 | `beep-effect` | `claude … --resume KNOWLEDGE_SURFACE_AUDIT_AND_AUTOMATION` |
| 1661715 | `beep-effect3` | `claude … --resume SPEED_UP_YEET_QUALITY_CHECKS_ORIGINAL` |
| 3806810 | `beep-effect8` | `claude --dangerously-skip-permissions --effort ultracode` |
| 1831969 | `beep-effect11` | `codex --yolo` |
| 3313800 | `beep-effect2` | `codex --yolo` |

**Cost: 890 ms in bash (1541 PIDs, one `readlink` fork each) — 6.8 ms in Bun**
(`readdirSync("/proc")` + `readlinkSync`, measured three runs: 6.9/6.8/6.7 ms).
The 130× gap is pure fork overhead; the syscall cost is negligible. **Any
implementation must do this in-process.**

Failure modes:
- `basename(readlink /proc/<pid>/exe)` for Claude Code resolves to the version
  string (`2.1.221`), not `claude`. Discriminate on `/proc/<pid>/comm` or argv[0],
  not the exe basename.
- **Agent cwd ≠ work target.** PID 1661715's cwd is `beep-effect3`, but its
  live `zsh -c` child was running
  `cd …/beep-effect3-pra && bun run beep yeet publish …`. Scanning only agent
  processes attributes the work to the wrong checkout.
  **Fix: scan *every* PID's cwd, not just agent PIDs.** That found 103–213
  processes inside the fleet, including 8 in `beep-effect3-pra` and 11 in
  `beep-effect-worktrees/p1-execution-plan` — two checkouts with no agent
  process of their own but active work.
- `/proc/<pid>/cwd` is unreadable for other users' processes. Single-user
  machine ⇒ non-issue here, and out of scope by the brief.

**(b) Claude Code transcript mtime.** `~/.claude/projects/<mangled-path>/*.jsonl`,
where the mangle is `s:[/_.]:-:g` on the absolute cwd.

```bash
find "$HOME/.claude/projects/$(mangle "$d")" -maxdepth 1 -name '*.jsonl' -printf '%T@\n' | sort -rn | head -1
```

Measured ages at scan time — this tracks the live PIDs exactly:
`beep-effect8` 0 s · `beep-effect5` 16 s · `beep-effect10` 68 s ·
`beep-effect` 529 s · `beep-effect3` 757 s · then a cliff to 34 049 s.

Failure modes:
- **Misses Codex entirely.** `beep-effect2` shows a 34 049 s-stale Claude
  transcript while a `codex --yolo` process is live in it right now.
- Mangling is lossy: `/a/b_c` and `/a/b-c` and `/a/b.c` collide. Cheap and
  fine in practice, but the mapping is not injective — do not treat a
  transcript hit as proof of path.
- Empty session dirs exist (`no matches found` for 10 of them) — must be
  tolerated, not treated as an error.

**(c) Codex rollout `cwd`.** `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`.
The **first line** is a `session_meta` record carrying the launch cwd:

```json
{"timestamp":"…","type":"session_meta","payload":{"session_id":"019fcccf-…",
 "cwd":"/home/elpresidank/YeeBois/projects/beep-effect11","originator":"codex-tui", …}}
```

`head -c 400 <file>` is enough to extract it. Measured: `beep-effect11` 1 s,
`beep-effect2` 3 s — the two live codex sessions, correctly attributed.

Failure modes:
- 7 282 rollout files exist. Only scan today's directory (and yesterday's for
  midnight-crossing sessions), newest-first, bounded (`head -40`).
- Codex Desktop kernels record their target in **argv**, not cwd:
  `node …/kernel.js --session-id … --working-dir /…/beep-effect10`. A cwd-only
  scan attributes those to `/opt/codex-desktop`.

**(d) Working-tree mtime.** The cross-agent fallback, and the one with a
**hard trap**:

```bash
# WRONG — `-not -path '*/.git/*'` does not exclude `.git` itself
find "$d" -maxdepth 2 -not -path '*/.git/*' -printf '%T@\n' | sort -rn | head -1

# RIGHT
find "$d" -maxdepth 2 -name .git -prune -o -name node_modules -prune -o -printf '%T@\n' | sort -rn | head -1
```

With the wrong form, **every clone in the fleet reported a uniform 31 s / 106 s
age** — the `.git` directory entry itself, touched by background fetches. That is
a 100 %-false-positive liveness signal across the whole fleet. With the correct
prune, the signal is clean and matches reality: `beep-effect` 6 s,
`beep-effect3` 9 s, `beep-effect3-pra` 11 s, `p1-execution-plan` 29 s, then
`beep-effect4`/`beep-effect9` drop out entirely as genuinely dormant.

### 2.7 Open PRs and their file sets — **CHEAP, NETWORKED**

```bash
gh api 'repos/beep-effect/beep-effect/pulls?state=open&per_page=100' \
   --jq '.[] | [.number,.head.ref,.user.login,.updated_at] | @tsv'   # 370 ms
gh api --paginate 'repos/beep-effect/beep-effect/pulls/<n>/files?per_page=100' \
   --jq '.[].filename'                                              # 440 ms
# --paginate is REQUIRED, not an optimization: without it the response caps at
# the first 100 files and the derived PR scope silently omits the rest, so a
# large PR reads as colliding with nobody. --jq is applied per page, so the
# filename projection above still works under pagination.
```

Rate limit at scan time: **core 4995/5000 remaining, graphql 4992/5000**.
REST budget is a non-issue at any sane cadence (10 open PRs polled every 60 s =
600 req/h against 5000). The memory's GraphQL warning is respected: everything
polled here is REST. Reserve GraphQL for one-shot review-thread queries
(consistent with speed-loop decision #20's carve-out).

Failure modes:
- Only signal in the inventory that needs network. Must degrade to
  "PR facts unavailable" rather than fail the scan.
- Branch → checkout join is by `head.ref`. ⚠ **Corrected 2026-08-05.** This
  originally read *"a branch can be checked out in at most one worktree — so the
  join is a clean 1:1 when it matches at all."* Git's checkout exclusivity is
  scoped to **one repository and its linked worktrees**, not across independent
  clones — and independent clones are this fleet's entire topology, so the same
  branch name can legitimately be checked out in several of them at once. Even
  within one repository, `git worktree add --force` exists precisely to
  "checkout `<branch>` even if already checked out in other worktree."
  **The join is one-to-many.** Retain every match and disambiguate by head
  *repository* identity (remote URL) plus head commit SHA; a name-only join
  attributes PR facts to the wrong checkout. Observed at scan time with 2 PRs
  open (#557 `docs/candor-wedge-brief` ↔ `beep-effect10`, #556
  `knowledge-surface-p1-followup-554` ↔
  `beep-effect-worktrees/p1-execution-plan`), where both happened to be unique —
  which is why the false 1:1 assumption survived measurement.

### 2.8 Lockfile / turbo / node_modules staleness — **FREE**

```bash
git -C "$d" log -1 --format=%H -- bun.lock        # lockfile commit
stat -c %Y "$d/bun.lock" "$d/node_modules/.bin"   # install recency
git -C "$d" rev-parse --git-common-dir            # → shared vs isolated turbo cache
```

`bun.lock` is the single most contested file in the fleet (20 checkouts), and a
lock-moving `main` is the documented cause of phantom failures
(memory: `stale-node-modules-phantom-failures`). Derivation is exact:
`mtime(bun.lock) > mtime(node_modules/.bin)` ⇒ install needed.

---

## 3. FINDING: `origin/main` diverges across the fleet — and that IS the Mode-B signal

Measured `origin/main` per checkout, grouped:

| `origin/main` | committer date | checkouts |
|---|---|---|
| `186d155d5d` | 2026-08-04 15:30:52 | `beep-effect`, `beep-effect2`, `beep-effect3`, `beep-effect10`, `beep-effect11` + all their worktrees (**45**) |
| `63737c4abd` | 2026-08-04 14:35:50 | `beep-effect5`, `beep-effect6`, `beep-effect7`, `beep-effect8`, `beep-effect9` + their worktrees (**23**) |
| `afa59892fc` | 2026-04-03 | `beep-effect4` (**1**) |

`186d155d5d` is PR **#555** `feat(goals): add capability schema slice to goal
manifest`, merged ~100 s after the last fleet-wide background fetch. Only the
clones with **live agents running yeet** re-fetched afterwards.

Consequence, verified by `git cat-file -e`:

```
63737c4abd  has-object=no  beep-effect5          ← this session's own clone
63737c4abd  has-object=no  beep-effect6 … beep-effect9
63737c4abd  has-object=no  beep-effect6-contradiction-pr, beep-effect7-write-wall,
                           beep-effect8/.claude/worktrees/pr-531-mergeable, … (24 total)
```

**24 of 69 checkouts do not hold the object for current `origin/main`.** They
cannot even *ask* whether they conflict with it. Five of them are top-level
clones sitting on `main`, believing they are up to date.

The derivation is free: **fleet-consensus `origin/main` = the newest
`origin/main` across all checkouts sharing the GitHub remote.** No network call.
A checkout whose `origin/main` ≠ consensus is provably behind, and the diff of
what it is missing is available locally *from a sibling clone's object store*.

What #555 changed:

```
.changeset/knowledge-surface-p1-manifest-capabilities.md
goals/INDEX.md
goals/knowledge-surface-automation/ops/manifest.json
goals/knowledge-surface-automation/research/p1-report-manifest-capabilities.md
packages/tooling/tool/cli/src/commands/Goals/Goals.schemas.ts
packages/tooling/tool/cli/test/goals-manifest-capabilities.test.ts
standards/jsdoc-totals.regression-baseline.jsonc     ← repo-wide gate baseline
```

`standards/jsdoc-totals.regression-baseline.jsonc` is exactly the Mode-B
archetype: a repo-wide ratchet baseline whose movement breaks unrelated
in-flight PRs.

---

## 4. LIVE COLLISION MATRIX (measured 2026-08-04)

Change surface per checkout = `status --porcelain -uall` ∪
`diff --name-only merge-base(origin/main,HEAD)..HEAD`.
69 checkouts, 7 653 total path entries, **1 055 files claimed by more than one
checkout**, **426 colliding pairs**.

### 4.1 Most-contested files (vendored `.repos/**` excluded)

| # checkouts | file |
|---|---|
| 20 | `bun.lock` |
| 16 | `goals/INDEX.md` |
| 13 | `package.json` |
| 9 | `tsconfig.json` |
| 7 | `apps/professional-desktop/src/App.tsx` |
| 6 | `standards/schema-first.inventory.jsonc` |
| 6 | `standards/fallow.boundaries.generated.jsonc` |
| 6 | `standards/dual-arity.inventory.jsonc` |
| 6 | `.github/workflows/check.yml` |
| 5 | `standards/jsdoc-documentation.inventory.jsonc` |
| 4 | `standards/jsdoc-totals.regression-baseline.jsonc` |

The top of this list is not a coincidence: **every high-contention file is a
generated aggregate, a lockfile, or a ratchet baseline** — precisely the
"shared bucket" that PR-I decision #28 already carves out of `WaveManifest`
ownership. Derivation says that carve-out is correct and gives it the exact
membership list, measured rather than guessed.

### 4.2 Live-only pairs (the ones that matter today)

Live set (process-cwd ∪ transcript <900 s ∪ correctly-pruned worktree mtime <900 s):
`beep-effect`, `beep-effect2`, `beep-effect3`, `beep-effect3-pra`,
`beep-effect8`, `beep-effect10`, `beep-effect11`,
`beep-effect-worktrees/p1-execution-plan`,
`beep-effect-worktrees/p1-manifest-capabilities`.

```
beep-effect          X  beep-effect11                (1)  apps/professional-desktop/server/OntologyMcpTransport.ts
beep-effect11        X  beep-effect2                 (1)  goals/INDEX.md
p1-execution-plan    X  p1-manifest-capabilities     (1)  goals/knowledge-surface-automation/ops/manifest.json
p1-manifest-caps     X  beep-effect2                 (1)  goals/INDEX.md
p1-manifest-caps     X  beep-effect11                (1)  goals/INDEX.md
```

The third row is the money shot: **`p1-execution-plan` (PR #556, open) and
`p1-manifest-capabilities` (PR #555, merged 15 minutes earlier) both write
`goals/knowledge-surface-automation/ops/manifest.json`.** Two sibling worktrees
of the same P1 wave, contending on one file, with nothing in the setup telling
either one.

### 4.3 Conflict prediction against fleet-consensus main (the real answer)

`git merge-tree --write-tree --name-only HEAD 186d155d5d`, run across all 69
checkouts. **2.27 s total.** 24 skipped (no object — see §3). Of the 45 that
could be evaluated, **13 predict a conflict:**

| checkout | conflicting paths (head) |
|---|---|
| `p1-semantic-delta` | **`goals/knowledge-surface-automation/ops/manifest.json` — CONFLICT (content)** |
| `p1-skills-provenance` | **`goals/knowledge-surface-automation/ops/manifest.json` — CONFLICT (content)** |
| `adhd-skill-followup` | `standards/dual-arity.inventory.jsonc` — CONFLICT (modify/delete) |
| `recorded-qa-followup` | `.cspell/tech-terms.txt` — CONFLICT (modify/delete); `goals/INDEX.md` |
| `osv-effect-snapshot-advisory` | `osv-scanner.toml` — CONFLICT (content) |
| `tagged-error-equivalence` | `…/TaggedErrorClass.errors.ts`, `standards/jsdoc-documentation.inventory.*` |
| `vigilant-mclaren-c9b1de` | `…/Yeet/internal/Handler.ts`, `…/Yeet/internal/Verdict.ts`, `…/Quality/internal/GithubChecks.ts` |
| `p1-property-lane` | `.github/workflows/check.yml`, `apps/professional-desktop/package.json` |
| `pr-531-lint-oom` | `.repos/effect/**` (vendored pin — filterable noise) |
| `ontology-dock-m4` | `.claude/skills/browser-qa-loop/SKILL.md`, `goals/INDEX.md` |
| `pulse-publish` | `goals/INDEX.md`, `goals/harness-otel-adoption/ops/manifest.json` |
| `epic-mahavira-6a2edc`, `p1-deps-audit-fix` | `bun.lock`, `package.json` |
| `repos-pin-sync` | `.gitleaks.toml`, `.repos/effect/**` |

Two of these — `adhd-skill-followup` and `recorded-qa-followup` — are
**modify/delete** conflicts caused by *decision 4 of the locked grill*
("lint:markdown and cspell → deleted", "dual-arity → deleted entirely"). Those
branches are editing files that repo policy has already removed on `main`. That
is Mode B in its purest form, and it was derivable the instant the deletion
landed.

**Verdict: the derivation approach works, decisively.** It produced a specific,
actionable, verifiable answer for 45 of 69 checkouts, and for the other 24 it
produced the *more* important answer ("you are behind and cannot even evaluate
this").

---

## 5. Scan cost

All timings on the live 69-checkout fleet, warm page cache, `xargs -P 16`.

| Stage | Bash prototype | Notes |
|---|---|---|
| Enumerate (14 clones → `worktree list` → filter) | **50 ms** | serial; already trivial |
| Git facts (branch/HEAD/origin-main/ahead-behind) × 69 | **190–210 ms** | 1.71 s at `-P 1`; 8× speedup from parallelism |
| Change surfaces (`status -uall` + merge-base diff) × 69 | **310 ms** | |
| `/proc` cwd scan (1 541 PIDs) | **890 ms** bash / **6.8 ms** Bun | 130× fork overhead |
| Inverted index → contested files (awk, 7 653 entries) | **10 ms** | |
| Naive pairwise `comm` (69×69 = 2 346 pairs) | **2 060 ms** | ← **do not do this** |
| **Integrated pass (enumerate + facts + surfaces + proc + index)** | **1.10–1.15 s** | measured 3×: 1.15 / 1.10 / 1.14 |
| Conflict prediction (`merge-tree` × 45) | **2.27 s** | serial; the only expensive stage |

**The integrated pass is already inside the 2 s budget** (1.1 s), and that is a
bash prototype paying a fork per syscall. Two changes take it to ~150–250 ms:

1. **In-process syscalls.** The `/proc` scan alone: 890 ms → 6.8 ms (measured in
   Bun, three runs). Same applies to every `stat`/`readlink`.
2. **Inverted index, never pairwise.** Build `HashMap<path, HashSet<checkout>>`
   in one O(total-files) pass — **10 ms** for 7 653 entries — and derive pairs
   from buckets with >1 member. The naive O(n²) `comm` costs 2 060 ms for the
   identical answer. (Repo law already mandates `effect/HashMap` /
   `effect/HashSet` here.)

### Caching strategy (needed only for `merge-tree`)

`merge-tree` is the one stage that cannot be made cheap, and it is also the one
stage that is **perfectly memoizable**: its result is a pure function of the
pair `(HEAD_sha, target_sha)`. Neither changes unless someone commits or
`main` moves.

- Cache key: `${HEAD}:${target}` → `{ conflict: boolean, paths: string[] }`.
- Store: one shared JSON/NDJSON file under the fleet state dir, `flock`-guarded.
- Invalidation: none needed — sha pairs are immutable. Bound by LRU/size.
- Expected hit rate: very high. In a 69-checkout fleet, HEADs change a few
  times an hour and `main` moves a few times a day; the cross product churns
  slowly.
- Cheap pre-filter: skip `merge-tree` entirely when the checkout's change
  surface is disjoint from the target commit's file set — a set intersection
  costing microseconds. On this fleet that pre-filter eliminates 24 of 45
  candidates outright.

Second-tier cache for the git facts: key on
`stat(.git/HEAD).mtime + stat(.git/index).mtime + stat(<common-dir>/refs/remotes/origin/main).mtime`.
When all three are unchanged, reuse the cached row. Combined with the above,
a steady-state rescan is dominated by ~69 `stat` calls — **single-digit
milliseconds**.

---

## 6. What derivation CANNOT see

Honest boundary, so the design does not over-claim:

- **Intent.** The scanner sees `p1-semantic-delta` and `p1-skills-provenance`
  both editing one manifest. It cannot tell whether that is a wave partition
  working as designed or two agents duplicating each other. Mode A's "is this
  redundant?" needs one declared bit, or an LLM judging the two diffs.
- **Future surface.** An agent that has *decided* to fix a broken lint rule but
  has not written a byte yet is invisible. Derivation is retrospective by
  construction; the earliest it fires is the first `Write`. That is still far
  earlier than PR-open, which is where collisions surface today.
- **Which agent, semantically.** `--resume KNOWLEDGE_SURFACE_AUDIT_AND_AUTOMATION`
  in argv is a lucky gift, not a contract. Codex sessions carry no equivalent.
- **In-session context.** Whether an agent has already been *told* about a
  collision is not on disk. That is the delivery problem, not the derivation
  problem.

---

## 7. Overlap with work already designed or locked

### 7.1 `goals/speed-loop/research/OPPORTUNITIES.md` + `GRILL-DECISIONS.md`

Read at `/home/elpresidank/YeeBois/projects/beep-effect3-pra/goals/speed-loop/research/`.
PR-I "agent kit" is **locked** by decisions 16, 26, 27, 28, 29.

| Item | Status | Relation to fleet derivation |
|---|---|---|
| **#45 `beep agent report`** (decisions 16, 27) | LOCKED. Packet at `.beep/agents/<name>/report.json`: `agentName`, `waveId?`, `status`, `filesTouched`, `gatesRun{command,exitCode,excerpt,durationMs}`, `outOfScope`, `openQuestions`, `opportunities{kind,text}`. `check` validates schema + **file-claim drift**. | **Direct overlap.** `filesTouched` is *declared*; derivation computes the same set for free and can verify it. `check --prove` is the declared-vs-observed reconciliation. Fleet layer supplies the observed side. |
| **#48 `beep worktree ready`** (decisions 16, 29) | LOCKED. Idempotent create-or-refresh; new branches cut from `origin/main` **after fetch**; `bun install` iff `bun.lock` hash ≠ per-worktree stamp; finishes by emitting the #52 brief. | **Direct overlap.** "cut after fetch" is the per-checkout fix for §3's staleness. Fleet consensus makes the fetch decision *provable* instead of unconditional, and the lockfile-hash stamp is exactly §2.8. |
| **#49 wave manifests + `beep wave lint`** (decisions 16, 28) | LOCKED. `.beep/waves/<id>/manifest.json`: glob ownership, most-specific claim wins, **shared bucket (changesets, lockfile)**; drift = dirty files outside all claims; attribution joins manifest with #45 reports; report-only with signaling exit code. | **This is the schema.** Same shape, same drift verdict — differing only in whether ownership is *declared by an orchestrator* or *observed across checkouts*. §4.1 measures the shared bucket empirically. |
| **#52 `beep agent brief`** (decisions 16, 26) | LOCKED. `AgentBrief` S.Class → fenced-markdown render + `--json`. Contents: env facts, **git facts**, **PR facts**, boundaries, scratchpad path, gate commands, needs-operator LiteralKit. PR enrichment default-on behind a short-TTL per-branch cache, `--no-remote` opt-out. | **This is the delivery vehicle.** A `fleet` section is a natural field, and the short-TTL remote cache pattern is exactly the §5 caching strategy. |
| **#39 `yeet sweep`** (decision 14b) | LOCKED into PR-E. `SweepPlan` + `SweepReport`, `--plan` dry-run, worktree-aware rails, FF-only main update, `bun install` when lockfile moved. | Sweep is the *per-clone* remedy for staleness. Fleet consensus tells you **which** clones need it without visiting them — sweep currently only fires on the clone that just merged. |
| **#42 `monitor --until-merged` + `mergeReady`** (decision 14c) | LOCKED into PR-E. | Its merged-detection is the natural **trigger** for a fleet broadcast: the moment a merge is observed is the moment every other checkout's `merge-tree` prediction should be recomputed. |
| **#16 fleet housekeeping** | UNOWNED, Wave-2 candidate. Verbatim: *"28+ clones, several stale since June… fewer accidental concurrent-writer surprises (tonight's twin-session event)"*. | The only ledger item that names the fleet. This track supersedes it: **69 checkouts**, not 28, and staleness is measurable rather than eyeballed. |
| **#22 evaluate GitHub merge queue** | DEFERRED (decision 21): *"triggers on E-wave monitor data (treadmill tax quantified)"*. | Merge queue is the **hosted** answer to Mode B and it is explicitly out of scope for local coordination. `merge-tree` is the free local approximation, and it works on unpushed branches — which a merge queue never sees. Complementary, not competing. |
| **#53 permission-envelope-aware handoffs** | LOCKED into #52's brief. | Nothing here needs new permissions: all signals are read-only, local, single-user. Worth stating in the brief's needs-operator list that fleet remediation (`git fetch` in someone else's clone) is a **suggestion**, never an action. |
| **#54 sub-agent reflection harvest** | LOCKED (decision 23), structured home = #45's `opportunities` field. | Same delivery problem, same schema home. |

### 7.2 `explorations/agent-governance-control-plane/`

Status: distilled to a `CAPTURE.md` seed on 2026-07-14; the six-document design
corpus was deleted and lives only in history. Its durable seeds are:
one ordered canon, every law has an owner and a proof surface, explicit
authority by role, structured blockers, gated lifecycle, exceptions expire.

Relevance: **the packet's own `## Do not assume` section warns that its command
matrix is not current.** Fleet derivation should not revive it. The one seed
that transfers is *"every law has an owner and a proof surface"* — a derived
collision report is a proof surface for the (currently unwritten) law
"disjoint file sets per lane" that `standards/git-worktrees.md` states as prose.

### 7.3 `explorations/agent-execution-sandbox/`

Has a full `DECISIONS.md`, `BRIEF.md`, and 10 research files including
`06-repo-records-governance-seams.md` (execution-record ledger) and
`05-repo-execution-authority-surfaces.md` (grants/policy decision seam).

Relevance: **adjacent, not overlapping.** That packet governs *what an agent is
permitted to do*; this track derives *what agents are actually doing*. The one
real seam: an execution-record ledger, if it lands, is a superset of the
liveness signal — but it requires agent cooperation (records are written by the
executor), which is precisely what derivation avoids. **Derivation should not
wait on it, and should not be folded into it.**

### 7.4 `explorations/agent-effectiveness-pulse/` and `agent-pipeline-velocity/`

Both graduated (BRIEF/DECISIONS/MAP present). `agent-pipeline-velocity` C4 is
the origin of `.claude/hooks/law-pulse.sh` — the cited delivery precedent
(arXiv 2605.10039, ~5.6 % lower adherence odds per generated function). Its
implementation is the template:

```bash
# per-user AND per-checkout counter, in shared tmp, outside every checkout
counter="${TMPDIR:-/tmp}/beep-law-pulse-$(id -u)-$(printf '%s' "$PWD" | cksum | cut -d' ' -f1)"
```

It already writes shared-filesystem state keyed by checkout, registered as
`PostToolUse` in `.claude/settings.json`, always exits 0, emits ~30 tokens every
5th edit. **A fleet pulse is the same hook with a different payload.**

### 7.5 `standards/git-worktrees.md`

Exists, 200+ lines. Two directly relevant sections:

- **`## Shared Multi-Agent Worktrees`** states the law in prose:
  *"Serialize same-file writers up front (disjoint file sets per lane); if two
  lanes must touch one file, hand the file to one lane and have the other send a
  follow-up message."* Evidence: 2026-07-25 `epistemic-bitemporal-edge-core`
  five-lane closeout. **This is Mode A's law, already written, with zero
  enforcement.** §4 is the enforcement surface.
- **`## Migration From Duplicate Clones`** declares sibling worktrees the
  default and duplicate clones legacy. Reality check: **14 clones and 55
  worktrees**. The standard's own tooling section documents
  `bun run beep worktree {new,remove,doctor}` as resolving
  `<main-checkout>-worktrees` from git metadata — i.e. **single-clone scoped by
  design**. The standard needs a fleet section either way.

---

## 8. RECOMMENDATION: extend PR-I's agent kit — do not build a new capability

**Recommendation: extend. Specifically, three surgical additions to already-locked
PR-I surfaces, plus one widened enumeration in the existing `Worktree` family.
No new `Fleet` command family.**

### Why extend, not build new

1. **The schema already exists and is locked.** Decision 28's `WaveManifest`
   — glob ownership, most-specific claim wins, shared bucket, drift =
   files outside all claims, report-only with a signaling exit code — is a
   *complete* description of the collision matrix. The only difference is the
   source of the ownership claims: declared by an orchestrator (`beep wave lint`)
   versus observed across checkouts (fleet scan). **Two producers, one schema,
   one verdict renderer.** Building a parallel `FleetCollision` schema would
   fork the drift semantics and guarantee they diverge.

2. **The delivery vehicle already exists and is locked.** Decision 26's
   `AgentBrief` already carries git facts + PR facts, already renders both
   fenced-markdown and `--json`, and already has a short-TTL remote cache with a
   `--no-remote` opt-out. The hard constraint from the brief — *LLM agents do not
   poll; information must be injected* — is solved by `AgentBrief` for
   session-start delivery and by `law-pulse.sh` for mid-session delivery.
   **Both channels already exist. Neither needs a new capability to carry a
   fleet section.**

3. **A per-checkout report row already exists.** `WorktreeDoctorEntry`
   (`Worktree.command.ts:238`) is:
   `{ path, branch: NullOr(String), detached, locked, prunable, clean, changeCount, hasEnv, hasNodeModules }`
   — literally the fleet scan's per-checkout row minus four fields. And
   `worktree doctor` is *already* read-only, *already* enumerates via
   `worktree list --porcelain`, *already* parses `detached`/`locked`/`prunable`.
   **The fleet scan is `worktree doctor` with the enumeration widened from
   `<main>-worktrees/*` to `all clones sharing origin URL`.**

4. **A new `Fleet` family would sit at the wrong altitude.** Every other command
   family in `commands/` (26 of them) is repo-scoped. A fleet family is the only
   one whose subject is *the machine*, and it would have no natural home for its
   state: `.beep/*` is **gitignored and per-checkout** (`.gitignore:106-107`), so
   PR-I's `.beep/agents/` and `.beep/waves/` artifacts are structurally invisible
   across checkouts. Fleet state must live **outside every checkout** — and the
   existing precedent for that is `law-pulse.sh`'s `${TMPDIR}/beep-…-$(id -u)-…`,
   not a command family.

5. **Every remediation is already an owned command.** "You are behind" →
   `yeet sweep` (#39, locked). "Provision cleanly" → `worktree ready` (#48,
   locked). "You are drifting" → `wave lint` (#49, locked). Fleet derivation
   produces *findings*; it needs no actions of its own. A capability that only
   produces findings and routes them to existing commands is a **data source**,
   not a capability.

### The specific shared schema

**`WaveManifest` / its drift verdict (decision 28) is the schema to share**, with
`WorktreeDoctorEntry` as the per-checkout row it is computed from.

Concretely, in `packages/tooling/tool/cli/src/commands/`:

```
Worktree/
  Worktree.command.ts     # existing: WorktreeDoctorEntry, WorktreeDoctorReport
  Worktree.schemas.ts     # NEW — extract the doctor schemas here (Goals/ pattern),
                          #   add FleetCheckout extends WorktreeDoctorEntry:
                          #     originMain: S.optionalKey(S.String)
                          #     originMainCommittedAt: S.optionalKey(S.Number)
                          #     ahead: S.Finite, behind: S.Finite
                          #     changeSurface: S.Array(S.String)   ← dirty ∪ branch diff
                          #     liveness: FleetLiveness             ← §2.6, three signals
  Fleet.ts                # NEW subcommand file, same shape as Goals/Doctor.ts:
                          #   `beep worktree fleet [--json] [--conflicts]`
```

`FleetLiveness` as a `LiteralKit` internal domain
(`["active","recent","dormant","unknown"]`) plus the evidence that produced it —
per repo law, `LiteralKit`, never a hand-rolled union.

And in PR-I's kit:

- **`AgentBrief` gains a `fleet` field** (decision 26 already establishes brief
  contents and the TTL cache): consensus `origin/main` vs mine, a needs-fetch
  boolean, the conflict prediction for my HEAD, and the ≤5 live checkouts whose
  change surface intersects mine. Rendered in the fenced markdown block agents
  already paste. **This is the Mode-A and Mode-B delivery, and it costs one
  field on a locked schema.**
- **`beep wave lint` gains a second producer.** Same `WaveManifest` drift
  verdict; ownership claims derived from observed change surfaces instead of a
  written manifest. Decision 28's report-only posture with a signaling exit code
  carries over unchanged.
- **`beep agent report`'s `filesTouched`** becomes verifiable without
  `--prove`: the derived surface *is* the observed ground truth.

### What must NOT be extended

Do not put fleet state in `.beep/`. It is gitignored and per-checkout — every
checkout would keep a private, divergent view. Fleet state belongs in one
shared directory outside all checkouts (`${XDG_STATE_HOME:-~/.local/state}/beep/fleet/`),
`flock`-guarded, matching the brief's stated free baseline and the existing
`law-pulse.sh` precedent.

### Sequencing

Fits the locked queue with no reordering: **PR-E → PR-B ∥ → PR-F → PR-I → …**

- The `Fleet.ts` read-only scan can land **any time** (additive subcommand on an
  existing family, no schema shared yet, no dependencies).
- The `AgentBrief.fleet` field and the `wave lint` second producer land **inside
  PR-I**, where those schemas are already being authored — zero rework, and the
  definition-of-done rider (decision 16: each command ships its awareness
  surface in the same PR) already forces the `standards/git-worktrees.md` fleet
  section and the AGENTS.md tool-routing line.

---

## 9. Evidence block — reproduction

```bash
SP=/tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/56137bb3-d54a-4063-823e-aa7d138b6574/scratchpad/fleet-coord

$SP/enumerate.sh            # 69 checkouts, 50 ms
$SP/fleet-scan-full.sh      # integrated pass, 1.10–1.15 s (measured 3×)
$SP/proc-scan.sh            # 103 in-fleet processes, 890 ms bash
zsh -ic "cd $SP && bun run proc-scan.ts"   # same scan, 6.8 ms

# fleet-consensus origin/main
for d in $(cat $SP/f.txt); do git -C "$d" log -1 --format='%ct %h' origin/main 2>/dev/null; done \
  | sort -rn | head -1                       # → 1785857452 186d155d5d

# who is missing it
for d in $(cat $SP/f.txt); do
  git -C "$d" cat-file -e 186d155d5d 2>/dev/null || echo "STALE $d"
done                                          # → 24 checkouts

# conflict prediction
for d in $(cat $SP/f.txt); do
  git -C "$d" cat-file -e 186d155d5d 2>/dev/null || continue
  git -C "$d" merge-tree --write-tree --name-only HEAD 186d155d5d >/dev/null 2>&1 \
    || echo "CONFLICT $d"
done                                          # → 13 conflicts, 2.27 s
```

Artifacts: `f.txt` (fleet), `s2/*.files` (per-checkout change surfaces),
`hot2.tsv` (inverted index, 1 055 contested files), `collisions.tsv`
(426 pairs), `liveness.tsv`, `proc.tsv`, `prs.tsv`.
