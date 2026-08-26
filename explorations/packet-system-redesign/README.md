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

The candidate-2/3 gate condition ("fold contract stabilizing: first slice
proven, advisory self-hosting running") is satisfied on main evidence, and
closing `packet-control-plane-core` frees the Machinery lane slot. Which
reopener executes first at `decompose`: the fleet convention-migration
campaign (named in the goal's PLAN P5, rubric `beep explore --check`, still
unchartered) or candidate 2 — and does that campaign live as its own goal
packet or fold into candidate 3?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/2026-08-10-notion-strict-planning-three-pass.md`](./research/2026-08-10-notion-strict-planning-three-pass.md) - three-pass Notion proposal (imported).
4. [`research/2026-08-10-codex-deep-research-redesign.md`](./research/2026-08-10-codex-deep-research-redesign.md) - Codex deep-research revision (imported).
5. [`RESEARCH.md`](./RESEARCH.md) - synthesis of imports + six Grok lanes (stage 1).
6. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
7. [`BRIEF.md`](./BRIEF.md) - operator-ratified shaped pitch.
8. [`MAP.md`](./MAP.md) - ratified decomposition + amendment record (A–G).

## Trail

- 2026-08-25 (review follow-up, #830): MAP queued-amendments intro corrected
  to name all three amendments (H, I, J) and cite both evidence notes — the
  AgentO mapping for H/I and the ontology-tooling recon for J. Next Open
  Question unchanged: the Session B grill ratifies or rejects H/I/J.
- 2026-08-25 (research, post-graduation): AgentO (ESWC 2026) read against
  the packet system; mapping note landed at
  `research/2026-08-25-agento-ontology-mapping.md`. Two amendment candidates
  queued in `MAP.md` for the Session B grill (H: typed `PacketWorkPlan` with
  rendered launchers, candidate 3; I: JSON-LD projection lane on PROV-O /
  P-Plan IRIs, candidates 3–4) plus the paper's translate-review-amend-rerun
  recipe as the fleet campaign's method. Same day: reader/verifier recon of
  ontoskills, open-ontologies and mykg
  (`research/2026-08-25-ontology-tooling-recon.md`) queued Amendment J
  (gate certificates, candidates 2 and 4) and four campaign method notes
  (probe-shape migration, Violation/Warning tiers, drift classification,
  fleet-wide lint). Not ratified; no packet opened.

- 2026-08-24 (pre-close review): five-lens adversarial review of the shipped
  first slice grilled with the operator; MAP Amendments D–G recorded
  (tolerant reader + raw-canonical digest, dual-stage genesis + no-backfill
  law, tip-only trace, fork-applier staging + opt-in freeze). Close train
  locked: this docs PR, then P3 rung 4 (pre-close hardening), then P5 close
  through the guarded writer.

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
