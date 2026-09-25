# PR Event Awareness for Orchestrating Agents

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

An orchestrating agent babysitting a PR should know within seconds when the
PR goes conflicted, a review comment lands, or a CI job fails, and should be
able to route actionable work to fixer lanes without a human relaying it,
coalesced per head and attributed before dispatch rather than one lane per
event. During the time-to-certainty C3 closeout train the operator was the
notification path three times.

## Next Open Question

None. Graduated 2026-09-25 into
[`goals/yeet-pr-events`](../../goals/yeet-pr-events/README.md) (lifecycle
`paused`; activate with `bun run beep goals set-status yeet-pr-events active`
and launch `/goal follow the instructions in goals/yeet-pr-events/GOAL.md`).
The goal carries the brief as `SPEC.md` (no-gos as non-goals, rabbit holes as
constraints, D1-D38 as its decision log, back-links not copies), the map as
`PLAN.md` (W1-W10 in three PR-sized slices), and this ledger as
`research/SOURCES.md`. Two gated candidates stay in [`MAP.md`](./MAP.md) as
re-entry points — the webhook receiver (fires when the W1 timeline shows
event-to-row latency hurts) and owner takeover (fires when the escalation
ledger shows dead-owner PRs going unresumed); a fired gate reopens this
packet at `decompose`. The W7 socket-probe record lands under `research/`
here when the goal runs it.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - stage 1 (2026-09-24): cited external landscape,
   refreshed in-repo inventory, harness-side primitives, first end-to-end
   measurement, binding-gap analysis and the align frontier.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger: every URL
   RESEARCH.md cites with licence discipline, the brick table, cross-links.
5. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2): D1-D15 from the
   2026-09-24 align rounds, D16-D27 plus repo-locked facts from the
   2026-09-25 grill-with-docs round, and the design tree after each.
6. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, drafted, walked through
   and confirmed 2026-09-25).
7. [`MAP.md`](./MAP.md) - decomposition (stage 4, 2026-09-25): one
   promised-now goal in ten cited workstreams, sequencing, first vertical
   slice, inherited risks, two gated re-entry candidates.
8. [`goals/yeet-pr-events`](../../goals/yeet-pr-events/README.md) - the
   graduated goal packet (2026-09-25).

## Trail

- 2026-09-12: packet opened from the C3 closeout session. Captured the
  operator's spark and proposal (webhook → proxy → message to the PR-owning
  session → sub-agent fan-out), the orchestrator's assessment, the evidence
  from the #1102/#1126/#1130/#1131 train, and a live-checkout inventory
  showing that the ship-velocity A1–A3 bricks plus the resume footer and
  session registry already cover polling, transition typing, inbox
  convergence, wave coalescing, and owner lookup; A4 takeover was retired by
  operator PR #921 and is not live (appended correction in CAPTURE). The
  reframed gap is push source + idle wake + lane dispatch. Capture stays open
  until the operator signals the dump is done; nothing is scheduled.
- 2026-09-16: the polling half of the reframed gap is being built as
  [`goals/time-to-certainty`](../../goals/time-to-certainty/PLAN.md) item B7
  (`yeet monitor --until-ready`, rulings 41–49 in that packet's
  `research/decisions.md`): a ruleset-keyed settle rule, automatic read-first
  closeout, an exit-0 ready terminal, required-only exit codes, and one
  `pr-merge-ready` inbox row per head. Webhooks, push sources, and lane
  dispatch stay out of scope here; this packet stays at capture.
- 2026-09-24: resumed via `/explore` with no new capture material after the
  operator was told that invocation starts research; treated the 2026-09-12/15
  dump as complete and advanced capture -> research. Research ran as an
  18-agent fan-out (four in-repo readers, four external researchers, one
  read-only measurement agent, eight adversarial verifiers, one synthesizer;
  all Opus 5): `RESEARCH.md` (external landscape with 106 cited URLs, refreshed
  inventory, harness-side primitives, measurement) and `research/SOURCES.md`
  §3-§5 refreshed. What moved the picture: the repository's only webhook is the
  CI autoscaler's `workflow_job` hook (GitHub -> receiver median 2.08 s, n=41),
  so none of the three spark events has a push source; `yeet monitor
  --until-ready --detach`, the canonical recipe and the only mode ever run
  detached (6 of 6 monitor jobs), writes only `pr-merge-ready` and has no
  producer for a required red, a review thread or a conflict (zero `base-drift`
  rows across 1,051 rows in 64 checkouts); the desktop app already wakes a
  bound session on exactly those three events (`set_monitor auto_fix`); 163 of
  803 session-registry rows are unresumable because the proof-job env allowlist
  drops both harness session ids. Binding gap: event capture in the mode agents
  actually run. Advanced research -> align; the eleven align questions are in
  the manifest. The orchestrator's own pre-fact push-to-ready timeline for one
  PR was rejected by the measurement agent as unverifiable and is not in
  RESEARCH.md.
- 2026-09-24 (later): align ran as three grilling rounds through
  AskUserQuestion (5 + 5 + 5 questions, recommended answer first; every
  recommendation accepted), D1-D15 in `DECISIONS.md`. Shape of the design:
  Yeet-side durable capture with `--until-ready` as the producer (new
  `base-conflict` P0 and `pr-comment` P1 rows, wave record extended to
  conflicts, 30 s cadence kept), a SessionStart-spawned session-owned inbox
  tail as the idle-wake sender, human escalation when no owner is live, the
  orchestrator dispatching sub-agents, the poll kept with a webhook receiver
  and automatic takeover as MAP gates, both harness session ids forwarded
  through the proof-job allowlist, and the measurement slice first.
  Frontier empty; advanced align -> shape. Outside the packet: ack-directory
  pruning as its own small PR (D5).
- 2026-09-25: the workstation restarted mid-audit; the grill-with-docs
  Workflow (three Opus audits — doctrine, code cross-reference, sibling
  packets — each with a skeptic verifier) resumed from its journal. Thirty-
  seven findings, none unsupported. Three AskUserQuestion rounds locked
  D16-D27 (every recommendation accepted); the rest was locked from the repo
  (no architecture or glossary entry, `checkout` not `lane`, S.Class rows on
  the grandfathered union, additive `firstSeenAt`, D14 reworded without a
  model directive, D15's hold window corrected to the workstation's 10 m).
  RESEARCH.md finding 20 corrected (thread and drift capsules do carry
  `prNumber`; both readers already supersede them). Records placed outside
  the packet: proposed amendments under ttc rulings 39/41/42/46/48 (round 22)
  and a ttc PLAN B7 note; ship-velocity SPEC A1 and PLAN A1 annotations.
  `BRIEF.md` drafted; stage stays `shape` pending the operator's review.
- 2026-09-25 (later): walked `BRIEF.md` section by section with the operator
  under `/grill-with-docs` (three AskUserQuestion rounds, eleven questions,
  every recommendation accepted; D28-D38 in `DECISIONS.md`). Repo checks
  first: the exit table has only 0 and 1, SessionStart has no matcher, a
  systemd unit cannot emit OSC 777, D9's snapshot collapse was missing from
  the brief, and no Yeet runbook exists. Brief updated in place; stage stays
  `shape` pending the operator's final confirmation.
- 2026-09-25 (decompose): the operator advanced the packet ("next step"),
  which closes shape with the brief confirmed. `MAP.md` written: one
  promised-now goal `yeet-pr-events` (W1-W6 producer, W7-W8 delivery gated on
  the probe, W9 escalation, W10 post-measurement collapse), first vertical
  slice = the producer PR's own babysit, fourteen inherited risks, two gated
  re-entry candidates with carried constraints, capability check passed
  (every workstream cites a brick by file:line). Manifest stage `decompose`.
  Next: graduate.
- 2026-09-25 (graduate): definition-of-ready passed on all four points;
  scaffolded `goals/yeet-pr-events/` from `goals/_template` (README, SPEC,
  PLAN, GOAL launcher, manifest, carried `research/SOURCES.md`, history
  template) as `paused`; cross-linked both manifests; status `graduated`.
  Everything still uncommitted on the primary clone's `main`.
