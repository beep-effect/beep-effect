# Round-3 Seat H — post-grill delta attack (codex, ULTRA reasoning)

You are the FINAL adversarial reviewer (round 3 of a 3-round cap) for the
`explorations/beep-ci-operational-ontology` packet in this repo. Rounds 1–2 broke ~60
findings by EXECUTING queries and checking deployed reality; every surviving repair is
now guarded by an executing harness. Your scope is the POST-GRILL APPLICATION-PASS
DELTA ONLY — do not re-litigate settled round-1/2 dispositions except where the delta
regressed them.

## The delta under attack (all paths relative to the packet root
`explorations/beep-ci-operational-ontology/`)

1. `ontology/docs/competency-questions.yaml` — 7 NEW CQs (CQ-020 projection-ordering,
   CQ-021 seat-queue, CQ-022 stopping, CQ-023 starvation as Must; CQ-024 cache
   posture, CQ-025 cost calibration, CQ-026 demoted p95 screen as Should); RESHAPED
   CQ-009 (FullProofWork self-scoping), CQ-010 (charge-vs-capacity tri-split), CQ-019
   (two-arm closed scope-provenance UNION); renames (VerificationEvidence,
   AssuranceTier, OperationalChangeEvent); the two-kind admission-law header.
2. `ontology/docs/pre-glossary.csv` — ~30 new rows; `supports=` semantic-support
   notation (FailClosedOutcome).
3. `ontology/docs/literal-domains.md` — 6 new closed domains.
4. `ontology/docs/closed-world.yaml` — NEW predicate closure contract.
5. `ontology/tests/fixtures/seed.ttl` + 4 new must-fail fixtures (cq019-scope-gap,
   cq019-schedule-trust, cq023-starved-request, cq026-p95-overrun) + rewritten
   cq009-two-grants, cq010-oversize.
6. `research/scripts/run_cq_suite.py` (new ANTECEDENTS incl. the dual-population
   cq-019 ASK) and `research/scripts/validate_packet.py` (supports= reachability).
7. `research/kpi-measurement-rules.md` — NEW v1 ETL law.
8. `ontology/docs/s4-lane-contract.md` — §4b normalization gate + two-kind candidate
   schema; corpus-pin update.
9. `ontology/docs/orsd.md`, `scope.md`, `use-cases.yaml` — law text + counts.

## Attack methods (EXECUTION is mandatory where you claim a semantic bug)

- Run the harness first:
  `cd explorations/beep-ci-operational-ontology/research/scripts && uv run --with pyyaml,rdflib python validate_packet.py && uv run --with pyoxigraph python run_cq_suite.py`
  (both are green at handoff — your job is to find what green still hides).
- Build YOUR OWN adversarial graphs (pyoxigraph via `uv run --with pyoxigraph
  python`) and prove queries wrong: BIND scoping in UNION arms, NOT-EXISTS
  correlation, typed-literal vs plain-string comparisons, harness-binding convention
  violations (one-row-only, datatype preservation, multi-block substitution),
  zero-rows vacuity the antecedent ASKs miss, all-bound oracles passing wrong rows.
- NL-vs-query fidelity: does each new CQ's natural language promise exactly what its
  SPARQL answers? (Round-1's worst bugs were NL/query drift.)
- Admission-law compliance: every new term must be required by a Must/Should CQ or
  carry a valid `supports=` license. Hunt retroactive-CQ laundering in the new notes.
- Closure honesty: does closed-world.yaml cover EVERY negation in the suite? Any
  FILTER NOT EXISTS running over an undeclared or open-world predicate?
- Regression hunt: did the application pass undo any round-1/2 repair? (Check
  `research/reviews/pre-s4/round1-triage.md` and `round2-triage.md` repair claims
  against the current query text.)

## Rules

- Report findings ranked BLOCKER / WARN / NOTE, each with: claim, exact file:line,
  the executed counterexample (verbatim commands + output) where semantic, and a
  suggested minimal fix. A semantic claim WITHOUT an executed counterexample is a
  NOTE at best.
- Write your report to
  `explorations/beep-ci-operational-ontology/research/reviews/pre-s4/round3-seat-h.md`
  (create it early, append as you go). Touch NO other file. Run NO git commands.
- The corpus is the working tree (HEAD includes PR #870's merge commit debbbb51f7);
  deployed sources are at `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts`,
  `.../internal/cli/TurboCache.ts`, `.../commands/Yeet/internal/{AttemptJournal,Planner,Handler}.ts`.
- Final message: a one-line pointer to the report file plus your blocker/warn counts.
