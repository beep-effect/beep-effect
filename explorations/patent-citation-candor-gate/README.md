# Patent Citation Candor Gate

## Status

Stage: `align`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Every patent-reference occurrence becomes a source-versioned, evidence-grounded
`PatentCitationEvent`, and filing promotion stays blocked until every current
AI-discovered event carries an attorney-owned `CandorDisposition` — converting
the duty of candor from an ambient risk into an explicit, auditable gate. First
wedge of the signed-off
[`legal-patent-kg-deepening`](../legal-patent-kg-deepening/README.md) routing
matrix (2026-08-01 reconciliation grill; phase-2 grill 2026-08-04).

## Next Open Question

Shape the BRIEF (stage 3): problem, appetite, fat-marker sketch honoring the
four align boundaries in [`DECISIONS.md`](./DECISIONS.md) — rung 1 is the
failing `CandorPolicy` test (event + judgment-only disposition + derived
no-stored-closure gate over exact observation versions), rung 2 the immutable
IDS fact records; continuing-application matrix and 1.97(e) certification
predicates are named no-gos; the CFR-vs-MPEP source-version precedence caveat
(Lane B Q10) becomes a BRIEF constraint.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): cluster row, nuggets, deepened play, cautions.
3. [`RESEARCH.md`](./RESEARCH.md) - stage-1 synthesis over the two lane artifacts.
4. [`research/01-repo-surfaces.md`](./research/01-repo-surfaces.md) / [`research/02-candor-legal-frame.md`](./research/02-candor-legal-frame.md) - the lanes.
5. [`DECISIONS.md`](./DECISIONS.md) - grill log: phase-2 wedge decisions + the four 2026-08-04 align decisions and deferrals.
6. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

- 2026-08-04: packet opened from the phase-2 /grill-with-docs session; CAPTURE
  seeded from the parent routing-seed cluster ("Patent citation events and
  candor disposition"), nuggets `T2-F2`/`T3-F7`/`ADHD-1`, and the deepened
  ADHD-1 Focus play; wedge-scoped decisions (research lanes, dependency
  posture, orchestration, PR staging) pre-seeded into DECISIONS.
- 2026-08-04: both research lanes ran codex-only (Sol xhigh) — repo-surface
  inventory and candor legal frame; the fabricated Therasense Wikipedia URL
  was caught by the lane's source honesty and replaced with the en banc
  opinion capture; `RESEARCH.md` synthesized over both lanes (PR #550
  review); six source captures preserved under gitignored `assets/vendor/`.
- 2026-08-04: align session with Benjamin — four branches closed (locator
  law-owned; hard fact/judgment split; derived no-stored-closure gate;
  core-first scope with rung-2 fact records) plus explicit deferrals with
  owners. Stage capture → align; manifest openQuestions cleared. Next: BRIEF.
