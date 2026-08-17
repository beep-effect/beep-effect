# Exploration & Goal Packet System Redesign

## Status

Stage: `graduate`
Status: `graduated`

Graduated 2026-08-17: MAP ratified with amendments;
[`goals/packet-control-plane-core`](../../goals/packet-control-plane-core/README.md)
scaffolded as the only promised-now candidate. Candidates 2–4 are gated
re-entry candidates (gates in the MAP ratification amendments); the React
viewer stays gated on KSA static-v1 daily-use evidence. A fired gate reopens
this packet at `decompose`.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The packet system is stricter about packet shape and lifecycle labels than
about design completeness, legal transitions, traceability, and proof that
implementation matches design. Redesign it: strict pre-code design gates,
derived (not stored) readiness, control-plane event chains, evidence receipts,
and externally verifiable approvals — without turning the fuzzy front end into
BDUF ceremony.

## Next Open Question

Does the operator approve [`MAP.md`](./MAP.md) as the goal boundaries,
dependencies, capability composition, sequencing, and first vertical slice?
No goals are scaffolded until that review passes.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/2026-08-10-notion-strict-planning-three-pass.md`](./research/2026-08-10-notion-strict-planning-three-pass.md) - three-pass Notion proposal (imported).
4. [`research/2026-08-10-codex-deep-research-redesign.md`](./research/2026-08-10-codex-deep-research-redesign.md) - Codex deep-research revision (imported).
5. [`RESEARCH.md`](./RESEARCH.md) - synthesis of imports + six Grok lanes (stage 1).
6. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
7. [`BRIEF.md`](./BRIEF.md) - operator-ratified shaped pitch.
8. [`MAP.md`](./MAP.md) - decomposition awaiting operator review.

## Trail

- 2026-08-13 (final ceremony): operator signed off `BRIEF.md`; stage advanced
  to `decompose` and `MAP.md` was drafted from D1-D16 plus live capability
  verification. MAP review is the next gate; no goal was scaffolded.

- 2026-08-13 (ceremony): drafted `BRIEF.md` from CAPTURE, RESEARCH, and
  D1-D16; stage advanced to `shape`. Operator BRIEF review is next.

- 2026-08-10: packets-app capture added (read-only pulse/kanban/DAG UI; the
  operator's "what do I do next" bottleneck); lane 7 dispatched with the
  output-contract fix and returned
  (`research/grok/reports/7-packets-dashboard.md`); synthesis added to
  RESEARCH.md; align reopened for the app frontier.
- 2026-08-10: grilling core fix applied from the comparison's suggestion #1 —
  new repo-adapted `/grilling` skill (frontier rounds, AskUserQuestion
  delivery, packet DECISIONS/manifest binding); grill-with-docs re-pointed
  at it; /explore align flipped to frontier rounds. Other ports deferred
  (disposition in the comparison doc §4).
- 2026-08-10: post-align research expansion — Pocock skills comparison +
  vendored-skill drift audit landed (`research/2026-08-10-pocock-skills-comparison.md`):
  /grilling frontier-rounds protocol missing locally (grill-me pointer
  dangles), two-axis code-review identified as the packet's conformance
  critic shape.
- 2026-08-10: align grill completed in-session — all eleven questions
  resolved as D1–D11 (per-event CAS store; docs-PR approval anchor; derived
  stage pair; computed tier floor + recorded override; design gate as 5th
  graduation check; ATLAS + README status blocks generated first;
  OPPORTUNITIES promotion; one packet-core behind existing CLI groups;
  self-hosting pilot; two-phase done; four flow metrics). Ready for shape.
- 2026-08-10: all six Grok lanes returned (reports in `research/grok/reports/`,
  raw transcripts in `research/grok/raw/`); `RESEARCH.md` synthesis written
  (10 convergent findings, tensions, capability inventory, 11-question grill
  agenda); stage advanced to align; grill opened.
- 2026-08-10: packet opened; capture seeded from the Notion three-pass page +
  Codex deep-research revision (both copied to `research/`); six Grok CLI
  headless research lanes dispatched (web + GitHub + x.com); stage set to
  research.
