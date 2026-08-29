# Handoff: fleet-coordination research is taking ledger items off your plate

**From:** Claude session in `~/YeeBois/projects/beep-effect5` (branch `main`, clean)
**To:** the speed-loop session in `~/YeeBois/projects/beep-effect3-pra` (branch `docs/speed-loop-grill-4`, HEAD `2fe9a5d7a2`)
**Date:** 2026-08-04
**Why you're getting this as a paste-able blob:** because the thing this
research is about does not exist yet. There is no channel between us. That is
the point.

---

## What I'm doing

The operator opened a design investigation into **cross-clone agent
coordination**: ~13 clones of this monorepo on one workstation, each with an
independent agent session, producing two recurring failures —

- **Mode A** — several agents independently fix the same broken `main`,
  burning duplicate tokens and colliding at merge time.
- **Mode B** — one agent lands a repo-wide policy change (lint rule, gate,
  schema requiredness) and every other agent's in-flight PR rots.

Five research tracks are running now (prior art / blackboard-lease theory /
Claude Code + Codex delivery-vector feasibility / merge-queue-as-the-mechanical-
alternative / repo derivation surface), each adversarially verified, then
synthesized. A `/grill-with-docs` session will lock decisions afterward.
Deliverables land in this session's scratchpad; the packet home will be an
`explorations/` packet, graduated per the usual pipeline.

Cross-machine coordination is explicitly OUT of scope (operator ruling) — all
clones share one filesystem, so the baseline candidate is a shared local
directory plus `flock`, not a broker.

---

## Items I am TAKING off your plate

### 1. `#22` — GitHub merge-queue evaluation → **taken (design half)**

Ledger status: *"triggers on E-wave monitor data (treadmill tax quantified),
pairs with deferred lane consolidation"* (GRILL-DECISIONS #21).

Merge queue is the strongest **competitor** to building any coordination layer
at all — Zuul-style speculative execution tests each PR against the future
merged state, which is a mechanical cure for Mode B rather than a social one.
My track T4 is running that evaluation right now: merge-group semantics against
our ~24 required checks, batching and bisection behaviour under a 13-agent
fleet, Mergify/Aviator/Graphite/Trunk comparison, plus the lighter partial
answers (auto-rebase bots, stacked PRs, and whether `yeet`'s existing
verify-against-fresh-main already covers most of Mode B).

**What you keep:** the *measurement*. My evaluation is mechanism-and-cost; it
cannot produce the treadmill-tax number, which only E-wave monitor data gives.
Keep #22's trigger for that datum and I'll supply the analysis it feeds.

**What you should not do:** open a grill #5 docket item that re-derives merge
queue mechanics from scratch. Ping this session instead.

### 2. `#16` — fleet housekeeping (28+ clones, stale since June) → **taken**

Ledger status: unowned. My track T5 is enumerating every clone and worktree,
measuring branch/dirty/ahead-behind/lockfile staleness and per-clone liveness
(live agent process vs dormant checkout), and building a live collision matrix
as evidence. The staleness/prune inventory falls out of that scan for free, and
a `beep fleet` surface is the natural home for the prune pass.

**Note the correction already found:** the naive `[ -d "$d/.git" ]` clone test
silently skips worktrees — `.git` is a *file* there. Any fleet enumeration you
write elsewhere needs `git worktree list` per clone or it under-counts.

---

## Items where I am RESERVING SCHEMA — please do not lock these alone

These are yours, they stay yours, but the fleet work will almost certainly want
to share their shapes. Locking them wave-scoped now risks a break later.

### 3. `#49` — WaveManifest + `beep wave lint` (PR-I, decision 28) — **strongest overlap**

Your locked design: `.beep/waves/<id>/manifest.json`, glob ownership with
most-specific-claim-wins, a shared bucket, drift = dirty files outside all
claims, attribution by joining with `#45` reports, report-only posture with a
signaling exit code.

That is **a claim registry**. The fleet board is the same object with the scope
widened from *one orchestrator's wave inside one clone* to *all clones, all
sessions, no orchestrator*. Concretely, a wave manifest looks like a fleet claim
set with `waveId` populated and `scope = <this clone>`.

**Ask:** when you implement #49, define the ownership-claim record as its own
named schema, independent of the wave envelope that carries it — so a fleet
registry can reuse the claim shape rather than fork it. Do not bake `waveId` or
the wave path into the claim itself. If you'd rather hold #49's implementation
until the grill lands, that also works; the operator's call.

**Two live questions the fleet work will bring back to #49:**
- Report-only vs blocking. Your decision 28 says report-only, no blocking hook.
  For *within-wave* drift that's right. For *cross-clone* collisions the answer
  may differ, because nobody is watching the exit code. Expect that to be
  re-litigated at fleet scope only — I am not asking you to change #49's
  posture.
- Claims are currently **declared**. A large part of my thesis is that they can
  be **derived** (dirty sets, diff-vs-merge-base, open-PR file sets), which
  removes the "agent forgot to declare" failure class entirely. If derivation
  works, `wave lint` could stop asking orchestrators to hand-write ownership
  globs for anything the filesystem already knows.

### 4. `#52` — `beep agent brief` (PR-I, decision 26) — **rider reserved**

The brief is the single most natural ambient delivery surface for fleet state:
alongside env/git/PR facts it should carry *"3 other clones are active; 1 has
overlapping dirty files; 2 open bulletins affect paths you're likely to touch."*

**Ask:** leave the `AgentBrief` S.Class open to an optional fleet block, and
keep the short-TTL per-branch cache you already specified generic enough that a
fleet scan can ride it (a full fleet scan is the same cost class as the PR
enrichment you're already caching). No design change needed today.

### 5. `#45` — `beep agent report` (PR-I, decision 27) — **adjacent, one small ask**

`.beep/agents/<name>/report.json` is per-clone, which is right. A fleet index
will want to read every clone's reports to answer "what did the agent in
beep-effect11 actually touch?" That works as specified as long as the path stays
predictable and clone-relative. **Just don't move it under a gitignored
session-scoped or PID-scoped directory** — keep it discoverable from outside the
session that wrote it.

---

## Items I am explicitly NOT touching

- `#39` `yeet sweep` and `#42` `--until-merged`/`mergeReady` (PR-E, decision 14)
  — stale-clone drift is a *third* failure mode (clones diverging on shared
  authored state) and it is already yours. I ruled it out of my scope on
  purpose so we don't build two answers to it.
- `#48` `beep worktree ready` (decision 29) — yours. Noting only that it is the
  natural *registration* point for a clone joining the fleet, if a registry ends
  up existing.
- Everything in PR-B / PR-C / PR-F / PR-G / PR-H.

---

## Live evidence for the operator, harvested while scoping this

Recorded here so it can go into OPPORTUNITIES.md from whichever session owns
the ledger file (which is you — this clone's copy is stale, see below):

1. **The ledger file itself is desynced across clones.** This clone's
   `goals/speed-loop/research/OPPORTUNITIES.md` is **294 lines**; yours is
   **539**. A session pointed at "the opportunities ledger" in the wrong clone
   reasons from a document that is 245 lines out of date. Mode C in the flesh.
2. **Three clones are concurrently dirty right now:** `beep-effect11` (57 files,
   `security/codex-findings-2026-08-04`), `beep-effect2` (5 files,
   `chore/effect-jsdoc-quality`), `beep-effect` (3 files,
   `chore/knowledge-surface-unmerged-followup`) — none of them can see the
   others.
3. **`law-pulse.sh` is an existence proof.** `.claude/hooks/law-pulse.sh`
   (PostToolUse on `Edit|Write`, ~30 tokens every 5th edit) already demonstrates
   a working push channel into a running agent's context. The fleet board's
   delivery problem is plumbing, not research — which is why track T3 is
   mapping the full hook surface rather than asking whether push is possible.

---

## What I need from you (nothing blocking)

Reply in whatever channel the operator relays, or just leave a note in the
packet:

1. Ack that `#22`'s design half and `#16` are off your plate.
2. Confirm whether you'd rather (a) implement `#49` now with the claim record
   split out as its own schema, or (b) hold `#49` until the fleet grill lands.
   I recommend (a) — it unblocks PR-I and costs you one extra named schema.
3. Flag anything in PR-E/PR-I you think I've mis-scoped. If `yeet sweep` already
   intends to cover cross-clone staleness beyond the merged-PR path, say so and
   I'll stay further away from it.
