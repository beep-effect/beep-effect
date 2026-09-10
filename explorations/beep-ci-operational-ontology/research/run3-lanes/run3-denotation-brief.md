# Run-3 denotation seat brief (one Codex context per batch)

You are the DENOTATION seat of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for the
`beep-ci-ops` ontology, executing the skill `.claude/skills/ontology-foundational-auditor`
step 3 in a fresh context. Your launch message names your BATCH file and your SLUG PREFIX.
Work only inside this checkout; HEAD is the frozen run pin and must not change. Do not run
any `git` command that writes. Do not edit anything except the records you create under
`$WORK/hypotheses/`.

Paths (repo-relative): `SKILL=.claude/skills/ontology-foundational-auditor`,
`SHARED=.claude/skills/_shared`,
`ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`, `WORK=$ONT/work`.

## Role prompt (verbatim from `$SKILL/prompts/denotation.md`; read that file first)

Read `$SKILL/prompts/denotation.md` in full and obey it. Then:

- CONTRACTS: `$SHARED/schemas/denotation-hypothesis.schema.yaml`,
  `$SHARED/foundational-analysis.md` (six laws, admission discipline).
- INPUT FILES: exactly the observation records listed in your BATCH file (one repo-relative
  path per line; SourceObservations `so-*.yaml` and ProseObservations `po-*.yaml`). Read
  every one. You may read `$WORK/run-manifest.yaml` and the CQ suite; nothing else is input.
- CQ suite: `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`
  (26 CQs; cite CQ ids only in `cq_warrants`).
- OUTPUT: one DenotationHypothesis per file into `$WORK/hypotheses/dh-<slug>-<nnn>.yaml`,
  `id: "dh:<slug>:<nnn>"`. Every slug you mint MUST start with your SLUG PREFIX followed by a
  hyphen (for example prefix `ver` gives `dh:ver-failure-signature:001`). Other seats run in
  parallel with other prefixes; duplicate ids are checked globally and fail the run.

## Run-3 rules that bind this seat

1. **Totality.** Every observation id in your batch must appear in `observation_refs` of at
   least one hypothesis you write. Group observations that share one candidate referent into
   one hypothesis (a nonce chain, a checkout binding class, a failure-signature class, an
   emitted term). A null-standing result is still a hypothesis
   (`representation_status: implementation_artifact_only`, `null_hypothesis.rejected: false`).
2. **Capture provenance is not domain vocabulary.** These members describe the capture or
   its repair, never the operational domain, and warrant no referent: `ownerRef`,
   `ownerRefVariant`, `security_resanitization*`, `corpus_commit`, `corpus_tree`,
   `corpus_base`, `capture_*`, `complete_within`, `generator_*`, `provenance: synthetic`
   labels, path/host placeholder tokens. Say so in the null rationale when they dominate a
   record; do not mint referents for them.
3. **Synthetic evidence stays labeled.** Records from `corpus/run3b-synthetic/` come from a
   fixture-driven scenario (DECISIONS run-3 Ruling 10/19). They may ground lifecycle
   boundaries; note `provenance: synthetic` in the hypothesis rationale wherever cited.
4. **Two captures of the same journals.** `run3-fleet` and `run3b-fleet` are Stage A and
   Stage B captures of the same admission roots at different instants. Denote what your
   batch shows; do not assume the other capture. The synthesis seat consolidates.
5. **Discriminators must be observation-backed.** Quote the fact (predicate/object or the
   prose quote) that would be false under the null. Emitted RDF typing, a journal event
   whose absence would change a scheduler decision, or a binding that changes cache
   admissibility qualify; naming, ids, and doc comments never do.
6. **Do not read** `$WORK/foundational/`, `$WORK/alternative/`, `$WORK/proposals/`, the
   archives under `ontology/extraction/s4/archives/`, DECISIONS.md, or the intake docket.
   This seat sees observations, contracts, and CQs only.
7. **Validate before you stop.** Run
   `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python $SKILL/scripts/validate_artifacts.py $ONT`
   from the repo root. Sixty-eight violations of the form "prior unresolved observation ...
   has NO row in this run's index" are expected at this stage and are not yours. Any
   violation naming a `dh-` file with your prefix is yours: fix it and re-run until none
   remain. Never edit records with another prefix.
8. Final message: your prefix, the count of hypotheses written, the count of observations
   covered, and the representation-status tally.
