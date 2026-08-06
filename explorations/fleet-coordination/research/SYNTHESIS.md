# SYNTHESIS — fleet coordination for 13 agent sessions on one workstation

**Date:** 2026-08-04 · **Inputs:** T1 prior-art, T2 theory, T3 delivery-vector,
T4 merge-queue, T5 derivation, plus adversarial verification of all five.
**Scope:** one machine, N parallel checkouts of one monorepo. Cross-machine out.

Every number in this document is the **post-verification** value. Where a track's
figure was refuted, the refuted figure does not appear.

---

## 1. Bottom line

**Build — but build a mirror, not a message board, and buy nothing.** The single
smallest thing worth building first is a **read-only derived fleet view**
(`beep worktree fleet`, ~250 lines) delivered through the **already-locked**
`AgentBrief.fleet` field, because every input it needs is on disk, it requires
zero agent cooperation, and it has no protocol for anyone to forget. Before any
of that, spend thirty minutes on two facts this research killed: **`law-pulse.sh`
has never reached the model** (PostToolUse plain stdout is transcript-only) and
**`lefthook.yml` has no `pre-push` stage**, so `beep yeet` is a convention, not a
gate — which invalidates the "enforce at yeet" recommendation in three of five
tracks. Do **not** buy `hcom` (the fleet is not mixed, the push channel is already
in-harness and free), and do **not** enable GitHub merge queue yet (2 open PRs,
median 1 commit of base drift, and a full-repo gauntlet on `main` that passes
19% of the time — a queue would jam the fleet, not schedule it). The honest
finding underneath all of it: **four of the five live collisions on this machine
are sibling worktrees of one wave contending on one generated file** — that is an
intra-wave partition problem with an owner and a PR slot already, not a fleet
coordination problem.

---

## 2. What survived verification — and what died

### 2.1 Killed assumptions (read these first)

| # | Assumption | Status | Consequence |
|---|---|---|---|
| K1 | `law-pulse.sh` is a proven push channel | **DEAD.** `PostToolUse` + plain stdout + exit 0 produces `hook_success` only; the model never sees it. Verified twice (probe + independent re-probe): `plain = UNKNOWN`, `json = BETA-222`. No-op since 2026-07-05. | T1, T4, T5 all cite it as the delivery proof. It is a 3-line fix, and nothing can be evaluated until it is real. |
| K2 | "Every agent passes through `beep yeet` before pushing" | **DEAD.** `lefthook.yml` defines `pre-commit`, `commit-msg`, `post-merge` — **no `pre-push`**. The installed `.git/hooks/pre-push` shells to lefthook and is a no-op. `git push && gh pr create` bypasses yeet entirely. | T1 rec 3, T2 recs 1+2, and T4's entire "a gate has no delivery problem" argument are administrative controls by their own Hillel Wayne test. Fixable in ~10 lines. |
| K3 | The fleet is mixed Claude + Codex, so a cross-harness transport must be bought | **DEAD as stated.** `~/.zshrc:157-164` — `claudex` and `claudeg` both exec the **Claude Code binary** through a local proxy with different `--model`. There is no Codex CLI in the wrapper set. Codex appears only as ad-hoc `codex --yolo` sessions (2 live) and codex-companion children spawned *from* Claude sessions. | Kills one of the two stated reasons `hcom` "earns its place". Claude Code's hook surface covers the interactive fleet uniformly, for free. |
| K4 | `flock` is released by the kernel on holder death — "the single strongest argument for staying single-machine" | **DEAD.** Released only when the **last descendant holding the inherited fd** closes it. Reproduced: SIGKILL the holder, leave one child alive, `lslocks` still shows the lock held. This fleet orphans `bun`/`turbo` children constantly. | T2's headline primitive collapses. And a `flock` held inside a short-lived CLI invocation cannot span a claim that lasts hours — lock lifetime ≠ claim lifetime. |
| K5 | "Mode B broadcast has no prior art anywhere; the field explicitly rejected it" | **DEAD, and a citation-integrity failure.** The quoted phrase "No broadcast by design" does not appear in the MCP Agent Mail README. That product ships a Human Overseer composer with select-all, contact-policy bypass, and a mandatory pause-work preamble. Claude Code's own Agent Teams ships a file-locked shared claim list and auto-delivered mailboxes. | The defensible negative is narrower and still useful: **nobody wires broadcast to a base-branch-landing event and delivers it by push.** |
| K6 | T4's P0 policy-surface staleness guard is "the highest value-per-effort item" | **DEAD on calibration.** 52.6% of the last 253 first-parent `main` commits touch the proposed 14-path surface (package.json 38%, packages/tooling 34%, bun.lock 31%, tsconfig 29%) — while the surfaces that actually cause Mode B are rare (biome.json* 4.0%, turbo.json 5.1%) and `.beep/**` is **untracked** (0.0%, contains no laws). Hard-fails 53% of publishes at 1 commit behind, 98% at 5. | As specified it reproduces the treadmill it was meant to kill, on one shared 32-core box. Must be narrowed ~10x or replaced. |
| K7 | Merge queue is the mechanical answer worth adopting now | **DEAD at this repo's measured shape.** 2 open PRs (Little's law: 1.8–3.0 concurrent) ⇒ merge groups are single-entry ⇒ speculation buys nothing. Median base drift at merge is **1 commit** (p90 2, 33% zero) — the `strict=false` hole is one commit wide, not days. And main's full-repo gauntlet passes **19%** of the time (39 success / 167 failure / 40 cancelled, 30d). | A queue makes an 81%-red gauntlet the only path to main for 13 agents. Defer behind a named trigger. |
| K8 | "PR checks already detect Mode B, because checkout uses `refs/pull/N/merge`" | **DEAD.** The merge ref is real, but lane bodies run `--affected --base origin/main`, so `git diff origin/main...HEAD` against that merge commit yields exactly the PR's own files. A biome/tsconfig/turbo change on main that breaks a package the PR never touched is in the tree but **not in the affected set**. And no run is triggered by base movement at all. | Detection is *not* solved. This was T4's premise for rejecting `strict=true`, and it is false. |
| K9 | T5's fleet measurements | **NUMBERS DEAD, METHOD ALIVE.** 25 conflicts not 13; 11 clones not 14; the zero-network `max(origin/main)` consensus targeted `186d155d5d`, while true remote main was `458187262f` — held by **0 of 69** checkouts. The specified change-surface-disjointness pre-filter drops **12 of 25** real conflicts (48% false negative). | A category error: conflicts arise from everything since the **merge-base**, not from the target commit's diff. And the "zero network I/O" constraint is self-imposed — one `git ls-remote` costs 0.72–0.97s and makes the answer correct. |

### 2.2 Load-bearing survivors

**Delivery physics (the hard constraints).**
- Model-context injection in a live session is **hook-only and
  `additionalContext`-only**. `hook_success` ≠ context. Only
  `hook_additional_context` / `hook_blocking_error` reach the model.
- `PreToolUse` → `permissionDecision: "deny"` **works even under
  `--dangerously-skip-permissions`** (fresh probe: write blocked, model told).
  This is the only pre-write enforcement vector in either harness.
- **`FileChanged` fires inside a session blocked mid-`Bash`-call**, driven by an
  external process write (fresh probe: hook fired at 11:11:48 while the agent
  was inside a 30s sleep loop). It cannot inject — but it can **run code**. A
  busy agent is *unreachable for words, reachable for actions*. This reopens a
  Mode-B mitigation T3 declared impossible.
- Injected context is **replayed verbatim** on `--continue`/`--resume`. Bulletins
  must be epoch-stamped facts, never "as of now" statements.
- Codex hooks exist and inject, but trust is **per-absolute-path, per-hash,
  interactive, and fails open** — a changed hook silently stops enforcing, and
  `codex exec` cannot prompt for trust at all. Never build a lock whose Codex
  half fails open.

**Derivation (what is free).**
- `git merge-tree --write-tree --name-only HEAD <target>` is a real offline
  Mode-B oracle: no worktree/index/HEAD mutation, safe against a checkout an
  agent is actively editing, ~50–65 ms each. **It works on unpushed branches,
  which a merge queue never sees.** Its blindness: HEAD only, so uncommitted work
  is invisible (18 dirty files in beep-effect2 right now).
- `/proc/<pid>/cwd` scan: 890 ms in bash, **6.8 ms in Bun**. Liveness is directly
  observable on one machine — the thing 50 years of leases literature works
  hardest to approximate. Scan *every* PID, not just agent PIDs: agent cwd ≠ work
  target (one agent's cwd was beep-effect3 while its child ran `yeet publish` in
  beep-effect3-pra).
- Enumeration law: `.git` is a **file** in linked worktrees; `[ -d .git ]` misses
  all 58. Already ratified as grill decision 36.
- `find -maxdepth 2 -not -path '*/.git/*'` does **not** exclude `.git` itself —
  gave a 100%-false-positive liveness signal fleet-wide. Use `-name .git -prune`.

**Theory (what to keep).**
- Observe ≠ claim (Linda's `rd` vs `in`). If reading the work list is
  indistinguishable from taking it, Mode A is unsolved by construction.
- **Claim keys must be mechanically derived** (check name, rule id, path, PR #),
  never prose. Two agents describe one broken rule differently and both claim.
- Engineering control > administrative control, and the test is Wayne's: *does
  breaking it take effort, or does following it take effort?* Apply it to this
  design's own recommendations — that is how K2 was found.
- Registered-interest push beats scanning; emit a **terse delta** and let the
  agent decide whether to spend a call on the detail (Hearsay-II two-stage
  trigger). `law-pulse.sh`'s shape is right; its output channel is wrong.
- A flock-guarded counter *is* a correct gapless monotonic sequencer at 13-way
  contention (~6 lines). Useful — even though flock is the wrong claim primitive.

**Mechanics (verified in source, ship on their own merits).**
- `merge_group` degrades **commitlint to one commit** (check.yml:599-609) and
  **gitleaks to `-1` with the base-pinned scanner-config hardening bypassed**
  (:657-681). Both are required security-relevant gates that would pass
  vacuously. This is the strongest reason not to flip the ruleset casually.
- No *required* job is event-gated (`pr-size` and `build` carry `if:` and neither
  is required), and the verify matrix already reports skipped lanes — the repo
  accidentally dodged the classic merge-queue trap.

### 2.3 The adjudication that matters most

Three tracks (T1, T2, T4) converged on "enforce at `beep yeet`, it is the
chokepoint every agent passes through." **It isn't** (K2), and even once it is,
it is the *latest possible* point — `publish` fires after the duplicate spend
Mode A exists to prevent. Meanwhile T3's verifier found the earliest point that
actually exists (`PreToolUse` deny) and T5 found that the *information* is
computable before anyone writes anything. So the design order inverts:
**derive early, deliver ambiently, enforce late** — not "enforce at the gate and
call it coordination."

---

## 3. The design space, as five genuinely different options

### Option A — Don't build a board: partition at dispatch

**What it is.** The operator dispatches all sessions. Assign disjoint
file/package ownership *at task assignment*, in the prompt, before any agent
starts. Make `beep wave lint` (#49, already locked in PR-I) the proof surface,
and put every generated aggregate in its shared bucket.

**Failure modes.** Mode A: attacks it at the **only** point where the spend has
not happened. Kills the planned-work half completely. Mode B: nothing.

**Delivery vector.** The prompt. Zero infrastructure, zero transport, zero hooks.

**Cost.** ~0. `wave lint` is already designed, locked, and slotted.

**Risks.** Pure administrative control — it depends on the operator's dispatch
discipline, and it is silent on *unplanned* work ("I noticed main is red"), which
is exactly the Mode A the operator described. It also cannot represent work
items, only paths (ledger #57 names this gap from trench evidence).

**Right answer when:** most fleet work is operator-dispatched wave work. On the
measured evidence it largely is — 4 of 5 live collisions are intra-wave.

---

### Option B — The mirror: read-only derived fleet view, no claims

**What it is.** Widen `beep worktree doctor`'s enumeration from
`<main>-worktrees/*` to all clones sharing the origin URL. Per checkout compute:
branch/HEAD/ahead-behind, dirty ∪ branch-diff change surface, `merge-tree`
conflict against **ground-truth** main (one `git ls-remote`, not consensus), and
liveness from `/proc` PID + start-time. **Gate every output on liveness.** Ship
it as `beep worktree fleet [--json] [--conflicts]` and as a `fleet` field on
`AgentBrief` (locked, decision 35b). No claim registry, no mutual exclusion, no
enforcement — a computed view, not a protocol.

**Failure modes.** Mode B: **substantially solved at the informational level** —
you learn your base moved and whether you conflict, locally, in seconds, before
CI, and on unpushed branches. Mode A: partial — you see live neighbors whose
change surface intersects yours, but only after they have written a byte
(derivation is retrospective by construction). Still far earlier than PR-open.

**Delivery vector.** `AgentBrief` at SessionStart (locked delivery vehicle) +
an epoch-gated `PostToolBatch` re-pulse folded into the fixed law-pulse hook.
Silence costs zero tokens.

**Cost.** ~1–2 days on top of PR-I. One widened enumeration, one new schema row
(`FleetCheckout` = `WorktreeDoctorEntry` + 5 fields), one field on a locked
schema. Scan budget: 1.17 s bash integrated pass + 2.97 s merge-tree; ~250 ms
in-process with the `/proc` scan and inverted index done in Bun.

**Risks.** **Alert fatigue is the binding risk** — 25 of 44 evaluable checkouts
(57%) conflict against main; ungated, this is muted in week one. Liveness gating
collapses it to 1. No dedup/acknowledgment state exists ("has this agent already
been told" is not on disk). Cross-clone `merge-tree` needs the target object and
clones do not share ODBs — needs `git fetch <sibling-path>` or
`objects/info/alternates`, which no track specified.

**Right answer when:** you want the highest information-per-line-of-code and you
are willing to let agents act on findings rather than be stopped. **This is the
recommendation.**

---

### Option C — The coordinator: minted claims + pre-write block

**What it is.** Option B plus a real claim layer. A `FleetClaim` record (wrapping
the provenance-free `OwnershipClaim` per ratified decision 37) minted under
`flock` into `${XDG_STATE_HOME:-~/.local/state}/beep/fleet/`, keyed by derived
identifiers, **reclaimed on observed process death via PID + start-time** (not
TTL, not flock lifetime). Enforced at two sites: `PreToolUse` on `Edit|Write`
returning `deny`/`ask`, and a **new lefthook `pre-push` stage** running
`beep yeet pre-push-hook` so the gate is mandatory rather than conventional.

**Failure modes.** Mode A: the earliest mechanical prevention that exists — a
second agent is stopped *before* the duplicate write. Mode B: same as B, plus a
hard hold at push.

**Delivery vector.** `PreToolUse` (both harnesses) + the pre-push gate.

**Cost.** ~3–5 days, plus hook distribution across 11 clones (the repo **denies**
`Edit(**/.claude/settings.json)`), plus Codex trust rollout (N interactive
approvals, re-armed on every hook edit).

**Risks — and they are serious.**
- `matcher: "Edit|Write"` is an exact-string list. It misses **every
  Bash-mediated write**: heredocs, `sed -i`, `git apply`, and this repo's own
  mandated codegen (`bun run beep architecture`, `beep yeet repair`) which writes
  dozens of files inside one Bash call whose paths are unknowable pre-hoc. In a
  codegen-heavy monorepo that is not a minority path.
- The docs explicitly warn hooks are the wrong tool for hard allow/deny and that
  the `if:` filter fails open on unparseable Bash.
- Codex hook trust fails open — the Codex half of a mutual-exclusion primitive
  can silently stop enforcing.
- A `deny` with a reason the agent cannot satisfy is a **retry loop that burns
  more tokens than the duplicate work it prevented**. No track budgeted this.
- Claims are path-keyed; the fleet's real duplication is **semantic** (two clones
  on the same goal packet, the same lint policy) and surfaces as different files
  converging on one concern.

**Right answer when:** Mode A recurs *after* Option A + B are in place, and the
recurrence is measurably on file paths rather than work items.

---

### Option D — Mechanical immunity only: gates, no coordination

**What it is.** T4's program, recalibrated. (1) Narrow `enforceBaseFreshness`
from T4's 14-path surface to a **true policy surface** — `biome.json*`,
`turbo.json`, the effect-laws allowlist snapshot, tsconfig *strictness* changes —
measured at ~4–5% of commits, with `subCategory: "stale-policy-surface"` so
verdict attribution separates "your diff is wrong" from "the world moved".
(2) Ship #56 scoped PR checks. (3) Ship #60's generated-path → regenerate-command
map. (4) Defer the merge queue behind a named trigger.

**Failure modes.** Mode B: the correctness half, plus local-seconds discovery
instead of 15-minutes-of-CI. Mode A: **~0% of the token spend** — every gate
fires after the duplicate work exists.

**Delivery vector.** None needed. Gates act on the *artifact*, not the agent.

**Cost.** An afternoon for the guard; #56 is its own small PR.

**Risks.** Calibration is the entire game — get the surface wrong and you ship
K6. It does nothing for the operator's stated primary pain. And the repo's own
ledger has a strictly better answer nobody compared it against: **#21 input-hash
proof-carrying jobs** and **#25 prove-the-merged-object** attack the re-verify
tax directly, without a ruleset change or a vendor.

**Right answer when:** you want the smallest possible surface and you accept
that duplicate spend is not addressed. Ship the narrow guard and #60 regardless;
they are cheap and orthogonal.

---

### Option E — Buy a transport (`hcom`) or adopt an external product

**What it is.** `hcom` (MIT, Rust, single binary, global `~/.hcom`, mid-turn
injection, PTY wake of idle agents) as the push bus; build claim semantics on top.
Or MCP Agent Mail / Gastown / Beads for the semantics.

**Verdict: REJECT, with a named revisit trigger.**
- The fleet is **not mixed** (K3), so Codex parity — one of the two stated
  reasons to buy — evaporates.
- The unique capability, waking an *idle* agent by PTY, is near-worthless here:
  `UserPromptSubmit` and `SessionStart` both support `additionalContext`, so an
  idle agent receives the message the instant the operator next engages it.
  Pre-emptive wake only earns its cost for **autonomous** agents with no operator.
- 418 stars, one maintainer, a README security section conceding "enrollment is
  total trust — a peer can launch, kill, and drive agents via RPC", and it
  installs hooks into `~/` config dirs, colliding with existing hook governance.
- Global-by-default is sold as an upside; it is a tradeoff. Every agent in every
  unrelated project on the machine joins one bus.
- MCP Agent Mail / Gastown fail the "must beat shared-dir + flock on its own
  merits" bar: a daemon, 38 MCP tools, a TUI and a web UI, or Dolt + tmux
  services + its own agent lifecycle.

**Right answer when:** the fleet spans machines, or agents run autonomously with
no operator present. Both are out of scope by constraint today.

**Worth reading before building, though:** Claude Code's own **Agent Teams**
(v2.1.32) ships a shared task list where "task claiming uses file locking",
dependency-aware auto-unblocking, per-agent JSON mailboxes with automatic
delivery, and `TaskCreated`/`TaskCompleted`/`TeammateIdle` hooks. It does not fit
as-is (one team per session, fixed lead, lead owns the lifecycle, split panes
unsupported in Ghostty, no broadcast) — but it is the first-party reference
design and the strongest confirming data point for work-item granularity.

---

## 4. Recommended sequence

### P0 — today, ~40 minutes, $0

1. **Fix `law-pulse.sh`.** Replace the bare `echo` with
   `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"…"}}`.
   Three lines. Independent of everything here; it is a live bug in a repo law
   surface, and no push design can be evaluated until the channel is real.
2. **Add a `pre-push` stage to `lefthook.yml`** running
   `bun run beep yeet pre-push-hook`. Ten lines. This converts `beep yeet` from a
   norm into an engineering control and makes every "enforce at the gate"
   recommendation in this research *true* rather than assumed.

### P0.5 — the cheapest thing that would have prevented the actual incidents

**Ship ledger #60's generated-path → regenerate-command map (a ~20-line data
file), and put every generated aggregate into `WaveManifest`'s shared bucket
(#49, already locked).**

The measured evidence: the top of the collision matrix is `bun.lock` (20
checkouts), `goals/INDEX.md` (16), `package.json` (13), and the wave manifest
JSONs. The *live* collisions are: `p1-execution-plan` × `p1-manifest-capabilities`
on `goals/knowledge-surface-automation/ops/manifest.json`; three more pairs on
`goals/INDEX.md`; and `p1-semantic-delta` + `p1-skills-provenance` both
conflicting with main on that same manifest. Ledger #60 records the operator-
reported incident verbatim: *"my INDEX.md heal raced the operator's #555 heal."*

**None of these needed a message board.** They needed (a) the file assigned to
one lane, and (b) a rule that generated aggregates resolve by **regeneration, not
merging**. Zero new capability, zero delivery problem, already in the queue.

### P1 — this week, inside PR-I, ~1–2 days

3. **`beep worktree fleet`** (Option B), with four corrections to T5's spec:
   one `git ls-remote origin refs/heads/main` for ground truth (0.9 s once, not a
   consensus that is currently wrong for all 69 checkouts) — ⚠ **but see the
   object-availability correction below: `ls-remote` alone is not sufficient**;
   **liveness gating before reporting** (9 live, not 69); `/proc` and the
   inverted index in-process (6.8 ms, not 890 ms); and **no change-surface
   pre-filter on `merge-tree`** —
   it is a category error with a 48% false-negative rate. Cache `merge-tree` on
   the immutable `${HEAD}:${target}` pair only.

   ⚠ **Object-availability correction (2026-08-05).** `git ls-remote` returns a
   **SHA, not the object**, and `git merge-tree` needs the commit and its trees
   present in the repository it runs in. This synthesis records both halves of
   the problem without connecting them: §2.2 K9 shows true remote main was held
   by **0 of 69 checkouts**, and load-bearing item 11 states that cross-clone
   `merge-tree` needs the target object because clones do not share ODBs. Taken
   together, signal 2 is **unavailable at exactly the moment it matters** — the
   instant main moves and nothing has fetched it, which is the whole Mode B
   trigger. `ls-remote` establishes *what* the target is; it does not make the
   target usable.

   The scan must therefore materialize the object before predicting anything:
   fetch the target once into a **dedicated scanner object database** (or fetch
   into each evaluated clone explicitly), then run `merge-tree` against it. One
   fetch per epoch amortizes across all checkouts, so this is a startup cost, not
   a per-checkout one. Until the object is present, signal 2 reports **`unknown`,
   never `clean`** — the D5-amendment rule, which load-bearing item 12 already
   demands for transient probe failures.
4. **`AgentBrief.fleet`** — the field decision 35b already reserved: consensus vs
   my `origin/main`, needs-fetch, my conflict prediction, and the ≤5 **live**
   checkouts intersecting my change surface.
5. **Epoch-gated re-pulse** on `PostToolBatch` (Claude) / `PostToolUse` (Codex),
   folded into the fixed law-pulse hook. Emit nothing when the epoch is unchanged.

### P2 — evidence-gated

6. **Narrow policy-surface staleness guard** in `yeet` — but *measure the
   hard-fail rate on the last 250 main commits before shipping it*. If it exceeds
   ~10% of publishes, do not ship it; ship #21/#25 tree-keyed proof reuse instead.
7. **Fleet housekeeping (#16)** — but reframed. 25 checkouts are behind; **23 of
   them have no live writer**. This is a disk-hygiene item, not a coordination
   item, and the inventory is now derivable rather than eyeballed.
8. **`FileChanged` external actuator** — the one genuinely new capability the
   verification produced. Experiment only: it can abort a doomed 30-minute build
   whose base just moved, or stage the payload the next `PreToolUse` injects.
   Powerful and unproven; do not put it on a critical path.

### Never (or: not until a stated trigger fires)

- **Never** build a claims journal an agent must remember to append to. It fails
  Wayne's test on day one, and this repo already cites the within-session
  adherence-decay finding as its reason for `law-pulse` existing at all.
- **Never** buy an external coordination product while the fleet is one machine,
  one operator, one harness. Revisit on: cross-machine, or autonomous agents.
- **Never** enable GitHub merge queue before **all three** of: #56 scoped PR
  checks landed; main's push-run pass rate ≥80% over 14 days (today: 19%);
  concurrent open PRs ≥5 (today: 2). Fix the `merge_group` commitlint/gitleaks
  degradation *before* the ruleset flip regardless.
- **Never** build a `Fleet` command family. Every other command family is
  repo-scoped; fleet state has no home in `.beep/` (gitignored, per-checkout).
- **Never** put fleet state inside a checkout.

---

## 5. Open questions for the grill

Each is a real either/or that research cannot settle. My recommendation follows
each; argue with it.

**Q1 — First enforcement site: lefthook `pre-push` running `yeet pre-push-hook`,
or `PreToolUse` `Edit|Write` deny?**
*Recommend `pre-push` first.* It is ten lines, harness-agnostic, covers Codex and
every Bash-mediated write, and it makes K2 false. `PreToolUse` deny is the only
*early* vector but it misses codegen and heredocs, fails open on Codex, and its
denied-agent retry loop is unbudgeted. Add it only after a measured Mode A
recurrence on file paths.

**Q2 — Claim liveness primitive: PID + start-time observed reclamation, `flock`,
or TTL + heartbeat?**
*Recommend PID + start-time.* `flock` is refuted twice over (orphaned-child fds
hold it after the agent dies; it cannot span a claim outliving the CLI
invocation). TTL is refuted by agent-scale pauses — any TTL short enough to
reclaim a dead claim falsely expires a 12-minute-thinking agent. On one machine
liveness is *directly observable* at 6.8 ms; this is the primitive the
single-machine constraint actually hands you, and no track evaluated it.

**Q3 — Mode B trigger: a GitHub-side watcher on merge, a `yeet publish`
post-step, or derived at every brief/hook fire?**
*Recommend derived-at-fire.* `main` is PR-only, so merges land **server-side** —
no local `post-merge` hook fires anywhere in the fleet at that moment. `yeet
publish` fires at PR-open, potentially hours before the merge, so it cannot
announce a landing. One `git ls-remote` at session start plus an epoch file any
clone updates when it fetches needs no watcher process at all.

**Q4 — Broadcast relevance filter: fire on every landing, or only when
`merge-tree` predicts a conflict for this checkout?**
*Recommend the union: textual conflict **OR** the landed commit touched the
narrow policy surface.* Conflict-gating alone is a trap — it filters out exactly
the case that defines Mode B (a policy change that breaks you with **no** textual
conflict). Ungated is worse: 57% of evaluable checkouts conflict, so it is muted
in week one. Both filters, unioned, and liveness-gated on top.

**Q5 — What does an agent DO on receipt: flag-only, or hard-block?**
*Recommend flag-only in-session, hard-block at the gate.* `additionalContext`
cannot pause a turn, and "rebase now" delivered mid-edit with a dirty worktree is
a dangerous instruction. Record it in the brief, act at the next natural
checkpoint, and let the (now mandatory) `pre-push` gate be the only thing that
says no. **If this is not decided, broadcast may be strictly worse than doing
nothing.**

**Q6 — Merge-time freshness: `strict_required_status_checks_policy: true`,
merge queue after #56, or neither?**
*Recommend neither now, and name the flip condition (decision 38 already asks for
it).* Note the correction that cuts against T4: `strict=true` does **not** rebase
anything — it costs ~1 extra run per merged PR (~8/day), not the 67–208/day herd
T4 rejected by conflating it with an auto-rebase bot. And given K8, it closes a
real hole. It is the cheap candidate — but it must wait until main's gauntlet is
reliably green, because at a 19% pass rate any freshness requirement becomes a
rebase treadmill on one shared workstation.

**Q7 — Policy-surface guard: narrow (~4–5% of commits), broad (T4's 52.6%), or
don't ship it and do #21/#25 instead?**
*Recommend narrow, gated on a measured hard-fail rate under 10%.* #25
(prove-the-merged-object: proofs keyed to tree hashes survive pushes and rebases)
is strictly better and subsumes both — but it is not an afternoon, and the narrow
guard is.

**Q8 — Claim subject: file paths, or work items?**
*Recommend paths now, work items reserved.* Ledger #57 records the trench
evidence: *"The fleet session's `OwnershipClaim` covers FILES; nothing covers
WORK ITEMS: ledger entries, design reservations, and their deadlines live in
prose."* T1 reached the same conclusion from prior art (Beads' insight: the
duplicate-fix problem is about **intent**, not bytes) and Agent Teams confirms it
first-party. Paths are derivable today; work items are not. Design `FleetClaim`
so its subject can be either — then ship the path case.

---

## 6. Overlap map — extend, do not stand alone

**This work should extend PR-I. Three of the four decisions it needs are already
ratified.**

| Locked work | Relation | Action |
|---|---|---|
| **PR-I "agent kit"** (decision 16) | **This is the home.** | Extend |
| **#52 `beep agent brief`** (dec. 26, 35b) | Locked `AgentBrief` S.Class, fenced-markdown + `--json`, generic TTL cache, **fleet extension block reserved from day one**. | Add the `fleet` field. Zero new surface. |
| **#49 wave manifests + `beep wave lint`** (dec. 28) | `WaveManifest` glob ownership + shared bucket + drift verdict is a *complete* description of the collision matrix. Only the ownership **source** differs (declared vs observed). | Second producer, same schema, same verdict renderer. **§4.1's measured contention list is the shared bucket's membership, no longer guessed.** |
| **#45 `beep agent report`** (dec. 27) | `filesTouched` is declared; derivation computes the same set for free. | The derived surface becomes the observed ground truth `check` validates against. |
| **#48 `beep worktree ready`** (dec. 29) | "New branches cut from `origin/main` **after fetch**" is the per-checkout fix for fleet staleness; the lockfile-hash stamp is the install-staleness signal. | Consensus makes the fetch decision *provable* instead of unconditional. Add: refuse to hand out a worktree that already has a live in-fleet process (6.8 ms to check) — this is the fix for the reported twin-session event. |
| **#39 `yeet sweep`** (dec. 14b, PR-E) | The per-clone remedy for staleness; today it only fires on the clone that just merged. | Fleet scan tells you **which** clones need it without visiting them. Route, don't rebuild. |
| **#42 `monitor --until-merged`** (dec. 14c, PR-E) | Its merged-detection is the natural **recompute trigger** for every other checkout's conflict prediction. | Wire as trigger. |
| **#16 fleet housekeeping** | Transferred to this session by **decision 34**. | Deliver the inventory — and reframe it: 25 stale, **23 with no writer**. Disk hygiene, not coordination. |
| **#22 merge queue** | Design half owned here by **decision 34**; **decision 38** already couples it behind #56. | Deliver the **flip condition** (Q6), not an adoption. |
| **#56 scoped PR checks** | Sequences before #22 (dec. 38). | Additionally justified by K8: `--affected` is exactly why PR runs miss Mode B, so #56's lane-scope machinery is also where a Mode-B-aware full lane belongs. |
| **#21 / #25 proof reuse** | **Never evaluated by any track**, and the strongest in-repo alternative to both the queue and the staleness guard. | Compare explicitly at the grill (Q7). |
| **#57 work-item claims** | Explicitly filed as *"input to the fleet grill; fleet-owned design."* | Answer it (Q8). Reserve the shape; ship paths. |
| **#60 generated-file regeneration** | Elevated from a rider to **P0.5** — it is the cheapest fix for every measured collision. | Ship it. |
| **#53 permission-envelope handoffs** | Fleet remediation (`git fetch` in someone else's clone) must be a **suggestion, never an action**. | Add to the needs-operator LiteralKit. |
| **#54 reflection harvest** | Same delivery problem, same schema home (#45's `opportunities`). | No change. |
| **Decision 37** (OwnershipClaim provenance-free; fleet wraps) | Already ratified, and T2 independently endorsed it on semantic grounds: declared claims expire **by clock**, derived claims expire **by re-observation** — two different Gray & Cheriton mechanisms that must not share one invalidation rule. | Confirm. Implementers: do not add `provenance` "helpfully." |
| **Decision 36** (worktree detection law) | Already ratified from a fleet finding. | Audit remaining `[ -d .git ]` sites. |
| **`standards/git-worktrees.md`** | States *"disjoint file sets per lane"* as prose with **zero enforcement**. | `wave lint` is its proof surface; the standard needs a fleet section either way. |

**Net new surface for the whole fleet program: one widened enumeration, one
schema row (`FleetCheckout`), one wrapper (`FleetClaim`), one field on a locked
schema, one subcommand.** Everything else routes into commands that already have
owners and PR slots.

---

## 7. Harvested opportunities (ledger-ready)

**Live bugs / immediate fixes**
1. `law-pulse.sh` emits plain stdout from `PostToolUse` and never reaches the model — emit `hookSpecificOutput.additionalContext` (3 lines, no-op since 2026-07-05).
2. `lefthook.yml` has no `pre-push` stage, so `beep yeet` is bypassable by `git push` — add one running `beep yeet pre-push-hook`.
3. `merge_group` degrades commitlint to one commit and gitleaks to `-1` with the base-pinned scanner config bypassed (check.yml:599-609, :657-681) — fix before any ruleset flip.
4. `beep worktree ready` should refuse a worktree that already has a live in-fleet process (`/proc` cwd, 6.8 ms) — the direct fix for the twin-session event.

**Derivation / scanning craft**
5. `git ls-remote origin refs/heads/main` (0.7–0.9 s, once) is ground truth; cross-checkout `max(origin/main)` consensus was wrong for all 69 checkouts.
6. `/proc` cwd scan: 890 ms bash vs 6.8 ms Bun — any fleet scan must be in-process; scan every PID, not just agent PIDs (agent cwd ≠ work target).
7. `find -maxdepth 2 -not -path '*/.git/*'` does not exclude `.git` itself — 100% false-positive liveness fleet-wide; use `-name .git -prune`.
8. `FETCH_HEAD` lives in `--git-common-dir`, not `--git-dir` — reads from a worktree silently return nothing.
9. `status --porcelain` without `-uall` collapses untracked directories — a new package's 40 files count as one path and the collision matrix under-reports.
10. Change-surface disjointness is **not** a valid `merge-tree` pre-filter (48% false negatives) — conflicts arise from everything since the merge-base.
11. Cross-clone `merge-tree` needs the target object and clones do not share ODBs — needs `git fetch <sibling-path>` or `objects/info/alternates`.
12. Scanner concurrency is untested: `merge-tree --write-tree` writes loose objects into shared ODBs while agents commit (triggers `gc --auto`), and `status` can fail transiently on `.git/index.lock` — treat a failed probe as `unknown`, never `clean`.
13. Vendored surfaces (`.repos/**`) dominate collision noise — path-filter before the matrix is meaningful.

**Harness / delivery**
14. `PreToolUse` `permissionDecision: "deny"` works even under `--dangerously-skip-permissions` — the only pre-write enforcement vector.
15. `FileChanged` fires inside a session blocked mid-`Bash`-call from an external write — an actuator inside a busy agent (runs code; cannot inject).
16. `FileChanged`/`SessionStart`/`CwdChanged` accept a `watchPaths` array of **absolute paths** — the "literal filenames in cwd only" limitation is wrong.
17. `matcher: "Edit|Write"` misses every Bash-mediated write (heredoc, `sed -i`, `git apply`, `beep architecture`, `beep yeet repair`) — a majority path in a codegen-heavy monorepo.
18. Codex hook trust is per-absolute-path, per-hash, interactive, and **fails open**; `codex exec` cannot prompt for trust at all.
19. `claude agents --json` is not a liveness source — multi-day-old zombie `background` entries with no pid, and `status` observed 23 min stale while actively running.
20. `hook_success` vs `hook_additional_context` in the transcript is the only proof of model visibility; `--include-hook-events` telemetry proves nothing.
21. Injected context is replayed verbatim on `--continue`/`--resume` — bulletins must be epoch-stamped facts, not "as of now" statements.
22. Hook distribution across 11 clones is undesigned: the repo **denies** `Edit(**/.claude/settings.json)`, hooks merge (not replace) across layers, and there is no rollout or rollback story.
23. Injection token cost was measured non-monotonically and is unusable — do not quote a per-char figure; gate on an epoch so silence is free.

**Locking / theory**
24. POSIX `fcntl(F_SETLK)` loses a lock on any unrelated `open`+`close` of the same path — use `flock` or OFD locks.
25. `flock` is **not** released on holder death when a forked child inherits the fd — `O_CLOEXEC`, and never leak lock fds into background children.
26. A flock-guarded counter is a correct gapless monotonic sequencer at 13-way contention (~6 lines) — reusable even though flock is the wrong claim primitive.
27. Lock lifetime ≠ claim lifetime: no long-lived process in this architecture can hold an fd for a claim that spans hours.

**CI / cost shape**
28. Main's full-repo push gauntlet passes **19%** of the time (39/206, 30 d) — this gates every "make X the only path to main" proposal.
29. Concurrent open PRs measure ~1.8–3.0 (2 observed; Little's law on ~250 merges/30 d at p50 1.4 h) — every deep-queue assumption is void.
30. Median base drift at merge is 1 commit (p90 2, 33% zero) — the `strict=false` hole is one commit wide.
31. `--affected` scoping means PR checks do **not** detect base-side policy breakage in untouched packages — "PRs already test against fresh main" is false.
32. 52.6% of main commits touch T4's proposed policy surface (biome.json* only 4.0%, turbo.json 5.1%, `.beep/**` 0.0% and untracked) — calibrate any hard-fail guard against measured commit frequency first.
33. Push-vs-PR gauntlet delta is ~20% (18.8 vs 15.6 min p50), not 40–200% — and push runs additionally execute `build`, which `merge_group` would not.
34. `strict_required_status_checks_policy: true` does not rebase anything — ~1 extra run per merged PR, not a thundering herd; the auto-rebase-bot rejection does not transfer to it.
35. #21/#25 tree-keyed proof reuse attacks the re-verify tax with no ruleset change and no vendor, and was never compared against the staleness guard.
36. Blacksmith spend already >$50/week with #24 planning self-hosted runners — cost any CI-multiplying proposal against that trajectory.

**Design gaps still open**
37. No design exists for what an agent **does** on receipt of a mid-turn bulletin — `additionalContext` cannot pause a turn.
38. No dedup or acknowledgment state for fleet findings — "has this agent already been told" is not on disk.
39. Claims are path-keyed but the fleet's real duplication is semantic (same goal packet, same lint policy, same barrel) — ledger #57 names this from trench evidence.
40. Mode A may be **correlated salience** (13 agents reading identical `CLAUDE.md`, identical red CI, identical goals packets rank the same option first) rather than collapsed degrees of freedom — neither a lock nor a wider work surface fixes identical ranking functions; a deterministic per-clone tiebreak would.
41. Resource contention may be the dominant single-machine failure — 13 clones share one 32-core box, one turbo cache, one GitHub rate limit; that is admission control and cache partitioning, not work-item claims.
42. Claude Code native **Agent Teams** (v2.1.32) ships file-locked task claiming, auto-delivered per-agent mailboxes, and `TaskCreated`/`TaskCompleted`/`TeammateIdle` hooks — first-party reference design; read before building.
43. `beep worktree doctor` is single-clone scoped by design and `standards/git-worktrees.md` states "disjoint file sets per lane" as prose with zero enforcement — both need a fleet section.
