# Exploration & Goal Packet System Redesign

## Status

Stage: `decompose`
Status: `active`

Graduated 2026-08-17 with `goals/packet-control-plane-core` as the sole
promised-now candidate. **Reopened at `decompose` 2026-08-26** on the ratified
convention: the candidate-2/3 gate condition was satisfied on main evidence and
`packet-control-plane-core` reached its close train, so the Session B grill
chartered the fleet convention-migration campaign as candidate 6 and ruled on
the three amendment candidates queued 2026-08-25 (D17–D23). The candidate-2/3
stabilization gate fired with that close — they are eligible, but D17 sequences
candidate 6 first and the Amendment G stream freeze caps their fleet-facing
scope until its applier ships; candidate 4 still gates on observed self-hosting
friction, and the React viewer stays gated on KSA static-v1 daily-use
evidence.

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The packet system is stricter about packet shape and lifecycle labels than
about design completeness, legal transitions, traceability, and proof that
implementation matches design. Redesign it: strict pre-code design gates,
derived (not stored) readiness, control-plane event chains, evidence receipts,
and externally verifiable approvals — without turning the fuzzy front end into
BDUF ceremony.

## Next Open Question

Two, both created by the Session B rulings.

Amendment J (D22) now lands in the existing `@beep/skill-contract` kernel
rather than in any candidate of this MAP, so no packet owns it. Does the
completed `skill-contract-kernel` packet reopen for a v2, does candidate 6
carry it as a rung — its migration needs honest gate verdicts on every wave
anyway — or does it open as its own goal packet?

And what is candidate 6's first vertical slice: the fork-repair applier alone,
proving Amendment G's rung 0 against the committed fork fixture and lifting the
opt-in freeze, or the applier plus the first migration wave so the translator's
shape is proven against real half-migrated manifests before the fleet sees it?

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`research/2026-08-10-notion-strict-planning-three-pass.md`](./research/2026-08-10-notion-strict-planning-three-pass.md) - three-pass Notion proposal (imported).
4. [`research/2026-08-10-codex-deep-research-redesign.md`](./research/2026-08-10-codex-deep-research-redesign.md) - Codex deep-research revision (imported).
5. [`RESEARCH.md`](./RESEARCH.md) - synthesis of imports + six Grok lanes (stage 1).
6. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2).
7. [`BRIEF.md`](./BRIEF.md) - operator-ratified shaped pitch.
8. [`MAP.md`](./MAP.md) - ratified decomposition + amendment record (A–G, Session B).
9. [`research/2026-08-26-session-b/README.md`](./research/2026-08-26-session-b/README.md) - Session B lane index (evidence for D17–D23).

## Trail

- 2026-08-26 (Session B grill, reopened at decompose): seven research lanes ran
  before the grill — three repo audits on GPT-5.6 Sol at xhigh, three web
  prior-art sweeps on Grok, and the rung-4 implementation lane — with reports
  under `research/2026-08-26-session-b/`. The grill chartered the fleet
  convention-migration campaign as **candidate 6**, its own goal packet and the
  first decompose reopener, because Amendment G makes the repair applier its
  rung 0 and freezes fleet `ops/events/` opt-in until that ships (census: 1 of
  225 manifest-bearing packets carries a stream; 226 packet directories, with
  `explorations/_gold-intake` carrying no manifest). Of the three queued amendments, **H** is
  ratified reshaped — the typed `PacketWorkPlan` lands, the `GOAL.md` render
  does not, and model/effort stay out of the plan; **I** is **rejected**, its
  PROV-O/P-Plan/AgentO spine refuted by the projects that shipped it, with a
  named-consumer-gated schema.org/RO-Crate successor requeued; **J** is ratified
  reshaped and pulled forward out of this MAP entirely, onto the
  `@beep/skill-contract` kernel with EARL/ACT outcomes and a reach aggregate.
  The in-toto deferral is scoped to signing and verification (D23). Decisions
  D17–D23.
- 2026-08-26 (close + reopen): `packet-control-plane-core` closed
  `completed-retained` — rung-4 pre-close hardening merged as #848, the flip
  executed through the guarded writer as stream event 4, closeout reflection
  and friction receipts landed in the goal packet. The satisfied candidate-2/3
  gate reopened this packet at `decompose` in the same PR, per the ratified
  convention and the same-PR flip law. The Session B grill already ran; its
  rulings (queued amendments H/I/J, fleet-campaign charter) are recorded in a
  separate docs PR so decisions stay reviewable apart from the closeout.
- 2026-08-25 (review follow-up, #830): MAP queued-amendments intro corrected
  to name all three amendments (H, I, J) and cite both evidence notes — the
  AgentO mapping for H/I and the ontology-tooling recon for J. Next Open
  Question unchanged (which decompose reopener executes first); the Session B
  grill separately ratifies or rejects H/I/J.
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
