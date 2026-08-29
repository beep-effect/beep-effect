# Map

<!--
Stage 4. Decomposition into candidate goal packets. This is the graduation
surface: the definition-of-ready in explorations/README.md is checked against
this file. Every major component cites an existing repo capability or is
explicitly marked NET-NEW.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| [`patent-citation-candor-gate`](../../goals/patent-citation-candor-gate/README.md) — **COMPLETED** | Fail closed on candor-sensitive citation promotion. | none | Completed goal packet and shipped law-practice surface. |
| [`legal-position-relator-runtime`](../../goals/legal-position-relator-runtime/README.md) — **COMPLETED** | Execute typed legal-position relators and contradiction semantics. | candor precedent where composed | Completed goal packet with P1/P2 evidence logs and reflection. |
| [`patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) — **ALIGNED 2026-08-13** | Shape an append-only drafting episode ledger and support-set promotion gate. | completed candor and relator contracts | Exploration backlink; all six align questions resolved. |
| `uspto-patent-driver-depth` — **QUEUED RE-ENTRY** | Deepen the approved FunctionalUnit / public-USPTO prosecution-data wedge. | Operator call and accumulated trigger, including episode-ledger Q5 benchmark path over `uspto-prosecution-read` | Existing approved routing row; goal not scaffolded. |
| `legal-rule-time-identity` — **ROUTED, FUTURE** | Receive the ELI temporal/FRBR donor profile. | Operator call on hub cadence | Research asset routed through `lynx-lkg-ontology-grounding`; model reimplementation only. |

## Sequencing

Candor and relator are complete. Episode-ledger shaping follows its closed align
gate in its own packet. `uspto-patent-driver-depth` stays queued; a fired
trigger reopens this hub at `decompose`. `legal-rule-time-identity` opens only
on operator call.

## First Vertical Slice

Already delivered by the completed candor wedge and relator runtime. Remaining
work is routed through the episode packet or explicit hub re-entry.

## Open Risks Inherited From The Brief

- Do not auto-open either queued goal.
- Preserve the episode-ledger Q5 public-USPTO benchmark path as an accumulating
  trigger for `uspto-patent-driver-depth`.
- Keep ELI reference-only and route model reimplementation through the Lynx
  packet's future-goal decision.
