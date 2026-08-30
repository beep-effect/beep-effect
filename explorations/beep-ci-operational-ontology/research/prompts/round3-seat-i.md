# Round-3 Seat I — grill-ruling application audit + disposition-map audit (codex, MAX reasoning)

You are the disposition auditor for round 3 (the last round) of the pre-S4 review loop
in `explorations/beep-ci-operational-ontology`. Round-2 seat G proved this packet once
recorded repairs that were circular or unlanded — your job is to catch any recurrence
at the whole-loop level. You VERIFY CLAIMS AGAINST THE TREE; you do not re-argue
rulings.

## Audit 1 — the 12 grill rulings → landed artifacts

Read `DECISIONS.md` entries titled "final pre-S4 grill" (rounds 1–3; the 2026-08-28
combined entry too). For EVERY ruling, locate the artifact change that implements it
in the current tree and record the mapping (ruling → file + anchor). Rulings:
scheduling trio Must CQs; ScheduleProposal + hasScope; FULL normalization gate via the
`ontology-foundational-auditor` skill; renames + vernacular altLabels + three splits;
two-kind admission law; CQ-010 tri-split; closure contract (closed-world.yaml now,
SHACL at S6); starvation invariant; corpus rebase (verify: `git merge-base
--is-ancestor debbbb51f7 HEAD` — you may run READ-ONLY git commands, never mutating
ones); kpi-measurement-rules.md; cache-posture + cost-charging Should CQs;
observational naming (OperationalChangeEvent, iv-870 re-tag in
`research/control-interventions.yaml`). A ruling with NO landed artifact, a PARTIAL
landing, or a landing that contradicts the ruling text is a BLOCKER.

## Audit 2 — round-1/2 disposition maps vs the tree

Walk `research/reviews/pre-s4/round1-triage.md` and `round2-triage.md`. Every finding
marked FIXED must be verifiably fixed in the CURRENT artifacts (the application pass
rewrote several surfaces — a fix that the rewrite silently dropped is a regression
BLOCKER). Every finding marked deferred/won't-fix must still be honestly recorded.
Spot-check at least: the round-2 seat E executed repairs (CQ-004 UNION arms, CQ-006
invalidated-discharge exclusion, CQ-012 decomposed-vs-window counts + HAVING, CQ-013
OPTIONAL lane join), the seat F reality corrections (full-proof-only checkout
exclusion, topo-sort spelling in the lane contract, adoption-qualified membership),
and the seat G circularity fix (CQ-019's closed scope-provenance — now two-arm).

## Audit 3 — internal consistency of the packet surface

Counts and cross-references: ORSD §5.2/§6 vs actual YAML/CSV counts; README "Next
Open Question" + Trail vs reality; manifest openQuestions; traceability matrix and
test manifest freshness (regenerate mentally from competency-questions.yaml — the
regen script is `research/scripts/regen_cq_artifacts.py`; you may run it ONLY in
check-mode reasoning, do not overwrite); s4-lane-contract frozen-input list vs the
files that actually exist; every relative link in the edited docs resolves.

## Rules

- Report BLOCKER / WARN / NOTE, each with claim + exact file:line evidence. Write to
  `explorations/beep-ci-operational-ontology/research/reviews/pre-s4/round3-seat-i.md`
  (create early, append as you go). Touch NO other file. No mutating git commands.
- Include the full ruling→artifact mapping table in the report even where everything
  landed — that table IS the audit's deliverable.
- Final message: one-line pointer to the report + blocker/warn counts.
