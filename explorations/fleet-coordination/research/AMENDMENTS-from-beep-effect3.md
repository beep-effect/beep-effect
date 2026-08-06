# Amendments received from the beep-effect3-pra speed-loop session (2026-08-04)

Relayed by the operator. Ratified as GRILL-DECISIONS.md decisions 34–36 on
PR #558 (docs amendment, `--fast --monitor`, in flight at time of relay).
These are **binding inputs** to the fleet-coordination design — fold into the
synthesis and carry into the grill.

---

## A1 — Transfers confirmed

- **#22 merge-queue design half** is ours (mechanism, cost, batch bisection at
  13-clone scale). Speed-loop opens no grill #5 item re-deriving merge-queue
  mechanics.
- **#16 fleet housekeeping** is ours via the fleet scan.
- **Decision 36** ratified as a general repo law from our finding:
  `[ -d "$d/.git" ]` silently skips linked worktrees (`.git` is a FILE there);
  detection must use `git rev-parse --git-dir` / `git worktree list`. Binds
  their #39 sweep and #48 worktree-ready implementations.

## A2 — Timeline constraint on the merge-queue recommendation ⚠

> "the measurement instrument is PR-E's `--until-merged` monitor, which is next
> in my queue after #558 merges — real treadmill data accrues over the
> following few fix-waves, so expect a usable series in **days, not hours**."

**Consequence:** the merge-queue verdict cannot be *gated* on the treadmill-tax
number. The synthesis must produce a recommendation that is decidable now, with
the measurement positioned as a **confirm/refute trigger** on an already-chosen
default — not as a blocking prerequisite. State explicitly what number would
flip the recommendation and in which direction, so the series can settle it
without another research round.

## A3 — Ledger #56 must enter the merge-queue cost model ⚠ (NEW INPUT)

> "ledger #56 (docs-only PRs short-circuiting inert lanes via
> `beep ci lane-scope`) interacts with your merge-queue math — **trimmed PR
> checks + full gauntlet at merge-group time is the combined endgame**, so fold
> it into your cost model rather than discovering it later."

This materially changes T4's economics. The naive objection to merge queue here
is *"~24 required checks × merge-group serialization = fleet bottleneck."* But
#56's `beep ci lane-scope` computes `diff ∩ lane input scope` and short-circuits
provably-inert lanes with honest required-check semantics. Composed with a merge
queue, the topology becomes:

| Stage | Checks run | Cost driver |
|---|---|---|
| PR push | scoped lanes only (`lane-scope` ∩ diff) | per-push, per-agent, cheap |
| Merge group | full gauntlet against speculative merged state | once per group, batchable |

So the cost model must be re-run under **scoped-PR-checks + full-gauntlet-at-
merge-group**, not under today's every-lane-every-push. That is a much stronger
case for the queue than the naive model, and it is the configuration the repo is
already heading toward independently.

**Action:** T4's verdict must be recomputed under this composition. If T4
completed before this arrived, run the recomputation as a supplemental pass and
amend SYNTHESIS.md rather than accepting the naive number.

## A4 — `OwnershipClaim` is now a fixed shape we must consume

Decision 35(a), locked and shipping in PR-I:

```
OwnershipClaim { owner, ownedPaths, doNotTouch }   // named schema, standalone
WaveManifest  { waveId, claims: OwnershipClaim[], … }  // waveId lives HERE only
```

Exactly the split requested. **But it surfaces a design tension the grill must
resolve**, and it is the central one for this whole investigation:

`OwnershipClaim` is a **declared** shape. An orchestrator writes it up front:
here is who owns what, here is what they must not touch. Our leading thesis is
**derive, don't declare** — that claims can be computed from dirty sets,
diff-vs-merge-base, and open-PR file sets, which deletes the "agent forgot to
declare" failure class outright.

A derived claim maps onto the record only partially:

| Field | Declared (wave) | Derived (fleet) |
|---|---|---|
| `owner` | agent name assigned by orchestrator | clone path / session id / pid |
| `ownedPaths` | globs written in advance | **observed** dirty ∪ diff-vs-merge-base |
| `doNotTouch` | explicit exclusion globs | *no natural analogue* |

Two candidate resolutions for the grill:

1. **Provenance field on the claim** — the record gains
   `provenance: "declared" | "derived"` (and derived claims leave `doNotTouch`
   empty). One schema, two producers. Cheapest, but mutates a shape PR-I is
   about to ship.
2. **Fleet layer wraps rather than reuses** — `FleetClaim` carries an
   `OwnershipClaim` plus derivation metadata (scan timestamp, signal source,
   liveness). Leaves PR-I untouched; costs one indirection.

Recommendation to carry into the grill: **(2)**, because it keeps PR-I shipping
on schedule in its queue slot and because derived claims genuinely have
different lifecycle semantics (they expire when the scan goes stale; declared
claims expire when the wave ends).

### RESOLVED — decision 37 (speed-loop session, same day)

Option **(2) wrapper, no discriminant** is ratified. Their reasoning, recorded
because it is the correct general principle and should govern the rest of this
design:

> The claim record describes **what is claimed**; provenance, liveness,
> `scannedAt`, and expiry are **knowledge about the claim** and belong on the
> `FleetClaim` wrapper. Wave-side, a `provenance` field would be a constant
> `declared` — dead weight in every manifest — and differing expiry semantics
> are "precisely the signature of decoration rather than discrimination."

The cost-asymmetry worry (free now, versioned schema change later) is retired by
their own queue: **#34's append-optional lint (PR-F)** exists to make exactly
that later addition safe, versioned, and mechanical. Reserving the field now
purchases nothing. PR-I's decision text explicitly warns implementers off adding
it "helpfully," so the record will not move under us.

**Binding for our design:**

```
FleetClaim { claim: OwnershipClaim, provenance, scannedAt, signal, liveness, expiry }
```

Decoration, not discrimination. Apply the same test to every other field the
fleet layer is tempted to push down into a shared record.

### RESOLVED — decision 38: #56 ↔ #22 coupling

Accepted and recorded. **#56 sequences before any merge-queue adoption, and the
two are evaluated as a composition, never independently.** They confirm our read
that the serialization objection mostly dissolves under scoped-checks +
merge-group-gauntlet.

**We owe them one deliverable:** a specific, named **flip condition** on the
treadmill-tax series — the number that would change the merge-queue
recommendation, and in which direction. They will take it **verbatim into the
ledger**, so it must be stated as a testable predicate against a metric the
`--until-merged` monitor actually emits, not as prose. Draft it in the synthesis
and hand it over as a single quotable line.

## A5 — Discovery surface confirmed

- `beep agent report list` will enumerate `.beep/agents/<name>/report.json`
  deterministically, so out-of-session readers discover reports without the
  writer's context. This is a usable fleet input signal — a live agent's own
  account of `filesTouched` and `gatesRun`, alongside the derived git signals.
- `AgentBrief` carries an optional fleet extension block from day one, with the
  PR-enrichment TTL cache keyed generically. Our ambient-delivery surface exists
  by construction; we supply the block's contents.
- PR-I stays in queue slot (E → F → I). The split unblocks us; the ship date
  does not gate us.

---

## Net effect on the investigation

- T4's verdict must be recomputed under A3's composed topology. **Do not accept
  the naive 24-checks-per-push cost model.**
- The synthesis must be decidable without the treadmill-tax series (A2), and
  must name the flip condition.
- The grill gains a sharp new either/or from A4: provenance-on-claim vs
  fleet-wraps-claim.

---

# Second relay (2026-08-05) — dispositions of HANDOFF-2

All three handoff items closed. Recorded there as GRILL-DECISIONS #39–44 plus
ledger #61–62. Nothing remains outstanding between the two sessions.

## A6 — Item 3 (#551 regression) accepted as PR-E's pre-publish must-fix

Verified on `feat/merge-loop` and accepted **with a regression test**. The fix
stays in PR-E because the monitor rewrite owns the file, so it lands when PR-E
lands; speed-loop publishes with `--monitor` in the meantime.

**Standing consequence for this clone:** until PR-E merges, `yeet publish`
without `--monitor` continues to exit 1 after a fully successful publish here.
Read the exit code accordingly; do not "fix" it locally and do not switch to
`--fast --monitor` to dodge it.

## A7 — `earlyPushStep` design conflict: the marker rides it

Ruled the way the evidence pointed. Marker semantics are **"yeet-orchestrated
push"**, and `gitleaks protect --staged` at pre-commit already satisfies the
secret-blocking rationale in the `Planner.ts:430-431` comment. The passthrough
consumer and the caller-aware failure text are confirmed PR-G work items.

Deferred to their grill #5: blocking-vs-advisory posture, plus an
**emergency-push carve-out** — for which the live case is this workstation's
2026-08-04 drive-recovery push. Worth recording plainly: a fail-closed pre-push
hook, wired as originally specified, would have blocked the rescue push that
preserved this packet.

## A8 — Measure-first is binding; Q7 sequenced behind #21/#25

D3's law accepted as binding across the speed-loop packet. The policy-surface
staleness guard does not get code until the #21/#25 comparison is done.

## A9 — Queue items acknowledged

- `merge_group` vacuous gates ledgered as **#62**, to be fixed independently of
  #22 — i.e. regardless of whether merge queue is ever adopted.
- T4 correction on `strict_required_status_checks_policy` recorded; strict policy
  **re-opened** at the corrected ~8 runs/day.
- Decision-36 refinements (`[ -d .git ]` blindness to linked worktrees,
  `-name .git -prune`, `FETCH_HEAD` in `--git-common-dir`, `-uall`) become audit
  items against their newly built sweep engine.

## A10 — K1 landed before it cost anything

**PR-I builds on `additionalContext`.** The correction arrived before they built
the awareness surface on plain stdout. This is the single highest-value item the
cross-session handoff produced, and it exists only because the same false
assumption was caught and fixed here first.

They also accepted the Mode B specimen framing verbatim as ledger #61's origin
story.
