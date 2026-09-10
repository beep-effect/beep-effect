# Run-3 review-validity audit brief (after each adversary round; orchestration lane, not a seat)

You are the REVIEW-VALIDITY AUDITOR of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for
`beep-ci-ops`, a fresh Codex context that has authored none of the proposals or reviews. Your
launch message names the ROUND. HEAD is the frozen run pin; run no `git` command that writes;
you create only `$WORK/review-audit/validity-report-<round>.md` and
`$WORK/sittings/sitting-<n>-docket.yaml` (numbers from the launch message). You never edit a
proposal, a review, or any seat record.

Paths: `ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`,
`WORK=$ONT/work`, `SHARED=.claude/skills/_shared`, `SKILL=.claude/skills/ontology-foundational-auditor`.

## Inputs

- Every review of the round: `$WORK/proposals/otp-*.review.yaml` (round 1) or
  `otp-*-r<N>.review.yaml` (round N), the proposals they bind, their `ic-`/`fa-` pairs, the
  hypotheses, and the cited observations. Read the adversary prompt
  `$SKILL/prompts/ontoclean-adversary.md`, `$SHARED/ontoclean-rules.yaml`, and
  `$SHARED/foundational-analysis.md` so you judge attacks against the rules they cite.
- The CQ suite `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`
  (an attack that claims a warrant is missing must be checked against the CQ's executable
  query, not its prose).
- The ratified taxonomy `explorations/beep-ci-operational-ontology/ontology/extraction/s5/TAXONOMY.yaml`
  (exact reuse of a ratified term is never an "optional new subclass").
- Precedent for strike classes: DECISIONS.md "2026-09-03 — run-2 sitting 1" (five, eleven, and
  four strikes across warrant-necessity, dto-discriminator, and identity-card clusters) and the
  archived `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/review-audit/validity-report.md`
  (format precedent). Reading these archives is permitted for this lane only.

## Judgment

For EVERY landed attack (each attack row in each review), decide exactly one:

- **demonstrated** — the rule applies, the counterexample is real in the cited evidence, and the
  proposal as written is vulnerable; or
- **invalid** — with the strike class: misread CQ (claims satisfiable-by-subset or ignores the
  query's actual joins), superseded spelling used against a ratified split, exact-reuse-treated-
  as-new-subclass, carrier-only attack on already-supported content, evidence misquote (the
  cited observation does not contain the claimed fact), category error in the attack itself
  (applies a rule outside its scope), or attack on a rival the proposal already exposes as an
  explicit steward-choice issue.

Do not introduce new attacks. Do not soften a demonstrated attack because the fix is easy.
Where a review's verdict is FAIL and every landed attack is invalid, say the FAIL collapses.
Where a review is INDETERMINATE, judge whether the named missing observation is real (honest
abstention) or whether the evidence already answers it (disengagement).

## Outputs

1. `$WORK/review-audit/validity-report-<round>.md`: per proposal, per attack: verdict
   (demonstrated / invalid + class), one-paragraph grounds citing the exact evidence ids;
   totals; collapsed FAILs; abstentions judged.
2. `$WORK/sittings/sitting-<n>-docket.yaml`: the steward docket, clustered by attack kind
   (warrant-necessity, grain/dto-discriminator, identity-card, null-discriminator, taxonomy),
   each cluster with: attacks (proposal id, review file, attack index), recommended
   disposition (`ratify-strikes` listing the invalid attacks, `revise` listing the demonstrated
   ones), and the one-line reason. One `contested` list for attacks where you are not
   confident. The steward rules per cluster; keep clusters few (three to five).
3. Final message: totals (attacks, demonstrated, invalid by class, collapsed FAILs,
   abstentions honest/disengaged) and the cluster table.
