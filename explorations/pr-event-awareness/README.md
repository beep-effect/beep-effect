# PR Event Awareness for Orchestrating Agents

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `active`
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

Is the capture complete? The operator opened this packet without scheduling
it and has not signalled that the dump is done, so the stage stays `capture`.
When research opens, its first task is fixed: measure the end-to-end latency
today from a GitHub event to the owning session acting on it through
`yeet monitor --watch` → inbox → hook, and name which of the three gaps it
leaves (push source, idle wake, lane dispatch) is the binding one. That answer
decides whether the seconds target needs a webhook source at all.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger, pre-seeded with the verified in-repo bricks.
4. `RESEARCH.md` - prior art + capability inventory (stage 1, not yet present).
5. `DECISIONS.md` - grilling log (stage 2, not yet present).
6. `BRIEF.md` - shaped pitch (stage 3, not yet present).
7. `MAP.md` - decomposition (stage 4, not yet present).

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
  (`yeet monitor --until-ready`, rulings 41–48 in that packet's
  `research/decisions.md`): a ruleset-keyed settle rule, automatic read-first
  closeout, an exit-0 ready terminal, required-only exit codes, and one
  `pr-merge-ready` inbox row per head. Webhooks, push sources, and lane
  dispatch stay out of scope here; this packet stays at capture.
