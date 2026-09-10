# Run-3 synthesis seat brief (steps 5+6; one Codex context per batch; revision passes reuse it)

You are the SYNTHESIS seat of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for `beep-ci-ops`,
executing skill steps 5 (reuse) and 6 (propose) of `.claude/skills/ontology-foundational-auditor`
in a fresh context. Your launch message names your BATCH (a slug prefix, or `all`) and whether
this is the FIRST PASS or a REVISION PASS. HEAD is the frozen run pin; run no `git` command that
writes; edit nothing except records you create or revise under `$WORK/proposals/`.

Paths: `SKILL=.claude/skills/ontology-foundational-auditor`, `SHARED=.claude/skills/_shared`,
`ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`, `WORK=$ONT/work`.

## Inputs and outputs (skill steps 5+6)

- Read `$SKILL/prompts/synthesis.md` in full and obey it.
- CONTRACTS: `$SHARED/schemas/ontology-term-proposal.schema.yaml`,
  `$SHARED/foundational-analysis.md`, `$SHARED/naming-conventions.md`.
- INPUT FILES: `$WORK/hypotheses/dh-<PREFIX>-*.yaml` and their `$WORK/foundational/ic-`/`fa-`
  pairs (your batch; `all` means every batch), plus the cited observations under
  `$WORK/observations/` and `$WORK/prose-observations/`.
- CQ suite: `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`.
- REUSE inventory (step 5): the ratified taxonomy
  `explorations/beep-ci-operational-ontology/ontology/extraction/s5/TAXONOMY.yaml` (38 ratified
  terms; exact-name reuse of a ratified term is a proposal with `reuse.exact_reuse_found: true`
  and the mapping, never an index shortcut) and the scout reuse report
  `explorations/beep-ci-operational-ontology/research/r2-reuse-scan.md` (external vocabularies).
- OUTPUT: one OntologyTermProposal per file `$WORK/proposals/otp-<slug>-<nnn>.yaml`
  (`id: "otp:<slug>:<nnn>"`, `status: proposed`). Use the analyzed chain's slug and number
  (`fa:ver-failure-signature:001` yields `otp:ver-failure-signature:001`); when one chain
  yields two rival proposals, number the second `:002` and cross-reference both in
  `open_issues`.

## Run-3 rules that bind this seat

1. **Warrants.** Decision terms cite the CQ ids the term is REQUIRED to answer (a CQ that
   merely mentions a word warrants nothing). Support terms cite the decision terms they serve,
   never a CQ, never themselves, never another support term.
2. **Rivals become proposals.** If the foundational analysis lists a still-viable rival model,
   emit BOTH proposals or one proposal plus an explicit steward-choice open issue. Parking a
   rival silently in `open_issues` is the forbidden merge.
3. **Cluster awareness without steering.** The provisional `ciops-prov:` emission terms are
   evidence (the emission fixture and Turtle sites are observations); whether they are
   referents is your analysis. If your batch's chains ground several terms that only make
   sense together (a proposal whose identity or warrant depends on another proposal), say so
   in `open_issues` naming the other proposal ids so the steward can ratify or park them
   together.
4. **Grain and provenance.** Recorded values are information objects unless an observation
   shows a process; capture provenance members (`ownerRef*`, `security_resanitization*`,
   `corpus_*`, `capture_*`, `generator_*`) never enter a proposal; synthetic evidence is named
   as synthetic in the proposal text where it is the only case.
5. **Revision pass only.** Input additionally includes the prior proposals and every review
   `$WORK/proposals/otp-*.review.yaml` (all rounds). A revised proposal keeps its id, changes
   bytes only where a landed attack demands it, and appends a `revision_log` entry naming the
   FAILed review's target digest and every landed rule it answers. Struck attacks (the steward's
   validity audit, given in your launch message when it exists) are not answered. A
   whitespace tweak is not a revision. Withdrawals are proposals you delete only when the
   launch message authorizes deletion; otherwise leave them and list them.
6. **Do not read** `$WORK/alternative/` (blinded seat) or the archives under
   `ontology/extraction/s4/archives/`; do not cite DECISIONS.md or ratifications as evidence.
7. **Validate before you stop:**
   `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python $SKILL/scripts/validate_artifacts.py $ONT`
   from the repo root. The 68 "prior unresolved observation ... NO row" violations are expected;
   violations about proposals lacking reviews are expected before the adversary runs. Any
   violation naming an `otp-` file with your prefix is yours: fix and re-run until none remain.
8. Final message: prefix, proposals written (ids), reuse proposals (ids and mapped ratified
   terms), rival pairs, open cluster dependencies, and every chain you did not propose from
   (id and one-line reason).
