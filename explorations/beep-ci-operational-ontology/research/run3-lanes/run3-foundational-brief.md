# Run-3 foundational seat brief (one Codex context per batch)

You are the FOUNDATIONAL ANALYSIS seat of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for
`beep-ci-ops`, executing skill step 4 (`.claude/skills/ontology-foundational-auditor`) in a
fresh context. Your launch message names your BATCH (a slug prefix). HEAD is the frozen run
pin; run no `git` command that writes; edit nothing except the records you create under
`$WORK/foundational/`.

Paths: `SKILL=.claude/skills/ontology-foundational-auditor`, `SHARED=.claude/skills/_shared`,
`ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`, `WORK=$ONT/work`.

## Inputs and outputs (skill step 4)

- Read `$SKILL/prompts/ufo-analysis.md` in full and obey it.
- CONTRACTS: `$SHARED/schemas/identity-card.schema.yaml`,
  `$SHARED/schemas/foundational-analysis.schema.yaml`, `$SHARED/foundational-analysis.md`,
  `$SHARED/ontoclean-rules.yaml`.
- INPUT FILES: every hypothesis `$WORK/hypotheses/dh-<PREFIX>-*.yaml` whose slug starts with
  your BATCH prefix, plus the observation records they cite (`$WORK/observations/`,
  `$WORK/prose-observations/`). The CQ suite is
  `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`.
- SURVIVORS ONLY: analyze a hypothesis iff `null_hypothesis.rejected: true` with a
  discriminator AND `representation_status` is `domain_referent` or `information_artifact`.
  Non-survivors get no records (they disposition at the index later). List them in your final
  message.
- OUTPUT: for each survivor, ONE IdentityCard `$WORK/foundational/ic-<slug>-<nnn>.yaml`
  (`id: "ic:<slug>:<nnn>"`) and ONE FoundationalAnalysis
  `$WORK/foundational/fa-<slug>-<nnn>.yaml` (`id: "fa:<slug>:<nnn>"`), both carrying the
  `hypothesis_ref`. Use the hypothesis's own slug and number for the pair (hypothesis
  `dh:ver-failure-signature:001` yields `ic:ver-failure-signature:001` and
  `fa:ver-failure-signature:001`) so ids never collide across parallel batches.

## Run-3 rules that bind this seat

1. Every analysis states identity criterion, rigidity, dependence, temporality, category,
   the spec-vs-execution, world-vs-information, and role-vs-bearer tests, the strongest
   counterexample, and remaining rival models. `unresolved` is legal everywhere;
   `explicitly_deferred` requires `needed_evidence` naming a concrete missing observation.
2. Evidence cited must be observation ids from this run (`so:`/`po:`) or CQ ids. Do not cite
   DECISIONS.md, ratifications, the intake docket, or archives, and do not read
   `$WORK/alternative/` or `$WORK/proposals/`.
3. Capture provenance (`ownerRef*`, `security_resanitization*`, `corpus_*`, `capture_*`,
   `generator_*`) is never an identity criterion. Synthetic records
   (`corpus/run3b-synthetic/`) may bound a lifecycle; say `provenance: synthetic` where used.
4. Grain discipline: a recorded classification (signature), a recorded occurrence (event), a
   binding at an instant, and a governing specification are different grains; the card must
   say which one the referent is and what individuates it.
5. Validate before you stop:
   `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python $SKILL/scripts/validate_artifacts.py $ONT`
   from the repo root. The 68 "prior unresolved observation ... NO row" violations are
   expected. Any violation naming an `ic-`/`fa-` file with your prefix is yours: fix and
   re-run until none remain. Never edit another batch's records.
6. Final message: prefix, survivors analyzed, non-survivors skipped (ids), category tally, and
   every `explicitly_deferred` with its `needed_evidence`.
