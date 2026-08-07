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
| `epistemic-contradiction-detection` | The detective for the existing triage judge: deterministic typed direct-conflict detection over a belief-view snapshot, producing against triage's shipped sealed contract. | none (consumes a shipped schema; does **not** block on triage closing or on belief-view revision) | `ContradictionCandidate` / `ContradictionAssessment` (`packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts`); `LiteralKit` (`@beep/schema`) for conflict classes; NET-NEW: the detector service + golden vectors |
| `agentic-governance-laws` | Own three repo-wide governance laws with enforcement: minting-ceiling (Rule 5), per-edge lifetime caps with recorded stop reasons, law-scanner non-vacuity. | non-vacuity slice cites the `LawScan` fix that lands in the amendment-application pass | TierGate (runtime clamp half of Rule 5); `LawScan.ts` / `Laws.command.ts` scan machinery; `LiteralKit` (`@beep/schema`) for `StopReason`; NET-NEW: ceiling declaration schema, per-edge cap declarations, non-vacuity assertions + violating fixtures |

Everything else the mining produced travels as amendments
([`research/AMENDMENTS.json`](./research/AMENDMENTS.json)) routed to the packets that already own
the territory — deliberately not re-listed here (Q1: dissolve, exactly two graduations).

## Sequencing

Per the BRIEF's PR ladder: this packet's docs-PR (graduation) → spec-delta amendments docs-PR
(carries the Q10 standards paragraph) → code-change amendment PRs (WinkCorpus tie-break, DocText
bracket, LawScan non-vacuity fix) → the two goal packets implement.

- **`epistemic-contradiction-detection` is the first bet** — small appetite, produces against an
  already-shipped contract, no upstream dependency.
- **`agentic-governance-laws` follows the amendment pass** — its non-vacuity first slice states
  the law, ships the deliberately-vacuous fixture, and cites the already-landed `LawScan` fix as
  proof the law is enforceable (one landing, not two). Rule 5 schema and per-edge caps have no
  such dependency and may start alongside A.

## First Vertical Slice

For `epistemic-contradiction-detection`: exact-negation detection only, as a pure function of a
golden belief-view snapshot fixture, emitting valid `ContradictionCandidate` values with the
documented per-class constant confidence — proven by golden vectors landing in the same PR as any
determinism declaration (Q6). A user/agent can point the detector at a snapshot containing a
planted negation pair and see it surface as a triage candidate; nothing auto-resolves.

## Open Risks Inherited From The Brief

- Detection heuristics / ML scoring: any tuned threshold in a design doc means scope escaped.
- Extending `ContradictionCandidate`: triage owns the schema and has not closed; extension is a
  negotiation, never a detector-side edit.
- Graded sensitivity taxonomy: Q5 chose binary-at-egress; not part of either graduation.
- Adherence instrument: Q8 ordered it after caps; designing deviation metrics now stalls the law.
- Envelope contract as a built thing: Q10 says standards paragraph; a packet would rot
  fake-active with no consuming format.
- Modality taxonomy completeness: adopt MATRES as-published; extensions belong to belief-view
  revision (Q9).
