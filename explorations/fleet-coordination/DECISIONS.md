# Decisions — fleet coordination

Align-stage log. Dated question → answer → rationale. Research backing lives in
[`RESEARCH.md`](./RESEARCH.md) and [`research/SYNTHESIS.md`](./research/SYNTHESIS.md);
cross-session rulings in [`research/AMENDMENTS-from-beep-effect3.md`](./research/AMENDMENTS-from-beep-effect3.md).

---

## 2026-08-04 — Grill #1 (nine questions, five locked, four disposed)

### D1. Build mandate: P0.5 + the fleet mirror. No claim registry.

**Question.** Is the mandate "ship the generated-file fix and stop", or that plus
a derived fleet view?

**Answer.** Both. Ship #60's regeneration rule as **repo-wide policy** (not a
`WaveManifest` carve-out), and build the read-only derived fleet view. Explicitly
**not** in scope: claim registry, mutual exclusion, enforcement.

**Rationale — a correction to the synthesis.** SYNTHESIS §1 claims *"four of the
five live collisions are sibling worktrees of one wave contending on one
generated file — that is an intra-wave partition problem with an owner already."*
Re-reading its own evidence (T5 §4.2) refutes this:

| Pair | File | Intra-wave? |
|---|---|---|
| `beep-effect` × `beep-effect11` | `apps/professional-desktop/server/OntologyMcpTransport.ts` | No — **and not generated** |
| `beep-effect11` × `beep-effect2` | `goals/INDEX.md` | No — two separate clones |
| `p1-execution-plan` × `p1-manifest-capabilities` | wave `ops/manifest.json` | **Yes** |
| `p1-manifest-caps` × `beep-effect2` | `goals/INDEX.md` | No |
| `p1-manifest-caps` × `beep-effect11` | `goals/INDEX.md` | No |

Four of five are generated-aggregate contention — that holds. But **only one of
five is intra-wave**. Three cross clone boundaries no `WaveManifest` can see, and
one is a genuine cross-clone source collision that neither #60 nor #49 touches.

Two consequences: #49's shared bucket covers **1 of 4** generated-file collisions,
not 4 — so the generalizing part is #60's regeneration rule, which must be
repo-wide; and the "already owned, don't build the mirror" argument is
substantially weaker than the synthesis stated. The evidence points the other way.

**Supersedes** SYNTHESIS §1 and §4 P0.5 as written.

---

### D2. Q0 pre-push enforcement: hand to speed-loop PR-G, do not fix here.

**Question.** The `pre-push` mechanism is three-quarters built and unwired. Wire
it here, ship it advisory, or hand it off?

**Answer.** Hand the spec to speed-loop **PR-G** (preflight parity), which
already owns push-time posture and `--push-anyway`. This packet ships only the
`law-pulse.sh` fix.

**Rationale.** The fix edits `Yeet/internal/Handler.ts` and `Planner.ts`. PR-E is
actively building `yeet merge`, `yeet sweep`, `monitor --until-merged`, and
`yeet reply` in those exact files, and T5's conflict scan already shows
`beep-effect3/.claude/worktrees/vigilant-mclaren-c9b1de` predicting conflicts in
`Handler.ts` and `Verdict.ts` **right now**. Editing yeet internals from this
clone is precisely the collision this packet exists to prevent; applying the
thesis to ourselves is the honest move.

**Handoff contents (spec'd, not implemented):**

1. `lefthook.yml` gains a `pre-push` stage running `bun run beep yeet pre-push-hook`.
2. `runPrePushHookMode` must honor `BEEP_YEET_REUSE_PRE_PUSH_PROOF=1` as
   passthrough. The marker is planted on `pushStep` (`Planner.ts:442`) and **no
   consumer reads it**; a test asserts only that the plan emits it. Without this,
   `publish --fast --monitor` self-blocks — it omits the proof step entirely
   (`Planner.ts:610`).
3. **Open design conflict for them to settle:** `earlyPushStep` deliberately omits
   the marker (`Planner.ts:430-431` — *"--no-verify would publish unverified
   content to the remote before any hook could block secrets"*), but it pushes
   **before** the proof step, so a wired hook blocks `--start-pr-early` by
   construction. Wanting hooks to run there and wanting them to assert a full
   proof are incompatible as written. Note that `gitleaks protect --staged` already
   runs at **pre-commit**, so the secret-blocking rationale is satisfied earlier
   in the pipeline.
4. `assertReusableVerifiedState`'s error text says *"yeet publish
   --reuse-verified found stale proof state"* — wrong context when invoked as a
   hook. A #50 teach-at-point-of-failure fix.

---

### D3. Q4 signals: all three, with the policy surface measured, never guessed.

**Question.** Which signals does the mirror carry, given signal 3 is the only
real Mode B detector but is the one needing a curated path list?

**Answer.** All three. Signals 1 and 2 ship immediately (zero calibration).
Signal 3 ships with its surface **derived by measuring commit frequency against
the last ~250 first-parent `main` commits** — a path enters the surface only if it
clears the frequency bar.

| Signal | Catches | Volume today | Calibration |
|---|---|---|---|
| 1. Live dirty/diff overlap | Mode A | 5 real pairs | none |
| 2. `merge-tree` vs ground-truth main | stale checkouts | 25 of ~44 ungated → ~0 live | none |
| 3. Main moved onto a policy path | **Mode B** | narrow ≈ 4–5% of commits | **measured list** |

**Rationale.** Two things the synthesis stated but never connected. First,
liveness gating does not merely reduce signal 2's noise — it nearly *eliminates*
signal 2: none of the 9 live checkouts appear anywhere in the 25-checkout
conflict table. Signal 2 is a stale-checkout detector, not a working-agent alarm.
Second, and decisively, **signal 2 is structurally the wrong instrument for Mode
B** — this is K8 restated: a policy change that breaks your CI produces *no
textual conflict at all*. Conflict-gating filters out exactly the case Mode B is
defined by. Only signal 3 catches it.

The measure-first rule is the direct remedy for K6, which died precisely by
guessing a surface: the proposed 14-path list touched 52.6% of recent main
commits and would hard-fail 53% of publishes at one commit behind. Measured,
`biome.json*` (4.0%) and `turbo.json` (5.1%) pass; `package.json` (38%) and
`bun.lock` (31%) fail. **Law: no path enters the policy surface unmeasured.**

---

### D4. Q5 receipt posture: split by delivery point.

**Question.** What does an agent see and do on receipt?

**Answer.** `SessionStart` (tree clean, acting is safe) → facts plus an act-now
recommendation. Mid-session re-pulse (tree may be dirty, acting is unsafe) →
epoch-stamped facts plus an explicit **defer-to-checkpoint** instruction. Same
data, opposite directive, matched to whether acting is safe.

**Rationale.** Mode B's entire value is mid-session delivery — the agent who
starts clean and would otherwise learn at hosted CI three hours later. But a
mid-session bulletin arrives with a dirty worktree, where "rebase now" is a
dangerous instruction. `SessionStart` fires on a clean tree, where it is not.
Facts-only was rejected as cutting against the repo's own teach-at-point-of-failure
doctrine (#30/#50); `SessionStart`-only was rejected because it structurally
fails the primary Mode B case.

**Fixed constraint, not a choice:** injected context is **replayed verbatim** on
`--continue`/`--resume`. Every bulletin must be an epoch-stamped fact ("main was
at `abc123` as of 11:04"), never "main just moved." Silence when the epoch is
unchanged costs zero tokens.

---

### D5. Q2 liveness: filter signal 2, annotate signal 1.

**Question.** Does liveness filter output or annotate it, and what counts as live?

**Answer.** Liveness **suppresses** signal 2 and **labels** signal 1. Live =
`/proc` cwd across **all** PIDs (primary, non-decaying) ∪ transcript mtime < 900 s
∪ worktree mtime < 900 s. **Not** `claude agents --json`.

**Rationale.** The synthesis said "gate every output on liveness" uniformly; the
two signals want different treatment. A dormant checkout that conflicts with main
is just a stale branch nobody will hit — suppress it. But `beep-effect11` holds
**57 uncommitted files**; if its agent walks away that work still exists and still
collides the moment anyone resumes it. Suppressing it hides the largest
uncommitted change surface in the fleet. Annotation preserves the signal without
reintroducing the 57%-conflict alert fatigue that filtering signal 2 removes.

On the definition: `claude agents --json` is disqualified by measurement —
multi-day-old zombie entries with no pid, and `status` observed 23 minutes stale
while actively running. `/proc` gives a live process unambiguously and does not
decay while an agent thinks for 12 minutes; the mtime signals cover the
idle-agent-with-no-children gap. The scan must cover **every** PID, not just agent
PIDs: one agent's cwd was `beep-effect3` while its child ran `yeet publish` in
`beep-effect3-pra`.

---

### Disposed without a separate question

**Q1 — first enforcement site.** Resolved by composition: D1 puts enforcement out
of scope for the fleet mirror, and D2 hands pre-push to PR-G. `PreToolUse` deny
stays unbuilt; revisit only on a measured Mode A recurrence **on file paths**,
per the research's own condition. Its known defects stand recorded: the
`Edit|Write` matcher misses every Bash-mediated write (heredocs, `sed -i`,
`git apply`, `beep architecture`, `beep yeet repair`), and the denied-agent retry
loop is unbudgeted.

**Q3 — Mode B trigger.** Settled by elimination, not preference. `main` is
PR-only, so merges land **server-side**; no local `post-merge` hook fires anywhere
in the fleet at that moment, and `yeet publish` fires at PR-open, potentially
hours before the merge. A watcher daemon fails the "must beat a shared dir on its
own merits" bar. **Derived at fire, against a cached epoch file any clone refreshes
when it fetches.**

**Q6 — merge-time freshness.** Neither `strict_required_status_checks_policy` nor
merge queue, now. The flip condition was delivered to speed-loop verbatim for
their ledger (#22), and their decision 38 couples #56 before any adoption. Recorded
correction against T4: `strict=true` does **not** rebase anything — roughly one
extra run per merged PR, not the thundering herd T4 rejected by conflating it with
an auto-rebase bot. Independently and regardless of adoption: `merge_group`
degrades commitlint to one commit and gitleaks to `-1` with the base-pinned
scanner config bypassed (`check.yml:599-609`, `:657-681`).

**Q7 — policy-surface staleness guard.** Handed to speed-loop with D3's
measure-first law attached, by the same reasoning as D2 (yeet surface, actively
edited by PR-E). Our recommendation: **compare against #21/#25 before building
it** — the synthesis records that tree-keyed proof reuse attacks the same
re-verify tax with no ruleset change and no vendor, and that **no track ever
compared them**. If #25 is viable, the guard is redundant.

**Q8 — claim subject.** Moot under D1 (no claim registry). The shape stays
reserved: when a registry is eventually built, `FleetClaim` must be able to carry
either a path set or a work item, per ledger #57 and decision 37's principle —
the claim record describes *what is claimed*; provenance, liveness, `scannedAt`,
and expiry are knowledge *about* the claim and belong on the wrapper.

---

## 2026-08-05 — Amendment to D5: liveness has a third state

**Trigger.** Two independent findings on the same day.

Measured here: `/proc/<pid>/cwd` is **not universally readable**. Root-owned
processes return `EACCES` on the symlink read even though the entry lists. D5's
scan therefore cannot observe every PID, and its earlier phrasing — "degrade,
don't throw" — was too weak, because it left open the option of degrading into a
*dormant* verdict.

Read in `block/buzz`'s own postmortem (`docs/welcome-kickoff-silent-failures.md`,
[`T1` addendum](./research/T1-prior-art.md)): the distinction the code was missing
was between *"the agent crashed"* — a fact, worth announcing — and *"no intro
yet"* — **not** a fact, but ignorance. Their conclusion: **"announcing ignorance
on a deadline is what produces the wrong story,"** and the corrective principle
**"facts decide, timers are a last-resort backstop."**

**Amendment.** The liveness scan classifies into **three** states, not two:

| State | Meaning | Mirror behavior |
|---|---|---|
| `live` | a fact — observed process, or mtime inside the window | filter/label per D5 |
| `dormant` | a fact — scanned, readable, nothing found | filter/label per D5 |
| `unknown` | **ignorance** — the entry could not be read | **silence** |

**`unknown` is never rendered as `dormant`.** An unreadable checkout is not a
dormant one, and reporting it as dormant is announcing ignorance as fact — the
exact defect the mirror exists to avoid, since a suppressed signal 2 on a
falsely-dormant checkout is a silent miss. The snapshot must also state its own
coverage, so a partial scan is legible as partial.

This composes with D4's replay rule: an epoch-stamped fact may say "not observed
as of 11:04"; it may never say "idle."

---

## 2026-08-05 — Amendment to D4: the directive comes from `git status`, not the event

**Trigger.** PR #562 review (codex connector, `DECISIONS.md:122`).

**Defect.** D4 reads *"`SessionStart` (tree clean, acting is safe)"*. The event
does not carry that guarantee. Its matcher is
`startup|resume|clear|compact|fork` — recorded in this packet's own
[`T3-delivery-vector.md`](./research/T3-delivery-vector.md) §"Event" table — so
it fires on **resume, clear, compact, and fork**, all of which routinely happen
in an already-dirty checkout. An act-now directive keyed to the event can
therefore tell an agent to rebase over uncommitted work: precisely the operation
D4's mid-session branch exists to prevent.

**Amendment.** The receipt posture is selected by **measured worktree state**,
never by which hook fired:

- `git status --porcelain -uall` is empty → act-now recommendation.
- Non-empty → epoch-stamped facts plus the defer-to-checkpoint instruction.
- The status probe itself fails (`.git/index.lock` contention, unreadable) →
  **defer**, per the D5 amendment's fail-to-`unknown` rule.

`SessionStart` remains the right *delivery moment* — it is the cheapest ambient
injection point. It is simply not evidence about the tree. Note `-uall` is
required: without it untracked directories collapse and a checkout holding a
whole new package reads as one path (SYNTHESIS load-bearing item 9).

**Standing rule, from two amendments in one day.** Both the D5 and D4 defects are
the same error — *inferring a fact from a proxy instead of measuring it*
(`claude agents --json` for liveness; a hook event for cleanliness). Combined
with the fact/ignorance distinction, this generalizes to a law the build must
follow: **every field in the fleet snapshot is either measured, or `unknown`.
Nothing is inferred from a proxy, and nothing defaults to the safe-sounding
value.**
