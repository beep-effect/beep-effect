# Run-3 denotation consolidation brief (admission chains → kind-level hypotheses)

You are a DENOTATION seat of auditor run 3 (`orun-2026-09-10T02:10:52Z`), skill step 3 of
`.claude/skills/ontology-foundational-auditor`, in a fresh context. Your launch message names
your OUTPUT PREFIX (`adm` or `admb`) and the two SOURCE PREFIXES whose hypotheses you consolidate.
HEAD is the frozen run pin; run no `git` command that writes; create files only under
`$WORK/hypotheses/` with your OUTPUT PREFIX; delete nothing (the orchestrator retires the source
records after verifying coverage).

Paths: `SKILL=.claude/skills/ontology-foundational-auditor`, `SHARED=.claude/skills/_shared`,
`ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`, `WORK=$ONT/work`.

## Why this pass exists

The first denotation pass over the admission-journal batches wrote one hypothesis per nonce
chain (one per observation record). A nonce chain is an individual: one request's enqueue,
grant, withdrawal, eviction, or release history. Denotation hypotheses are about candidate
REFERENT KINDS that observations instantiate (the kind of thing a `SeatRequest`, a grant, a
withdrawal, an eviction, a release, a journal, a protocol switch is), so the per-chain records
are the wrong grain for the foundational and adversary seats. Consolidate them.

## Inputs

- Read `$SKILL/prompts/denotation.md` in full and obey it; contracts
  `$SHARED/schemas/denotation-hypothesis.schema.yaml`, `$SHARED/foundational-analysis.md`.
- SOURCE hypotheses: `$WORK/hypotheses/dh-<SOURCE1>-*.yaml` and `dh-<SOURCE2>-*.yaml`. Read all
  of them; they carry the observation ids, the chain facts already quoted, and the first-pass
  representation statuses (which disagreed across batches: one batch read the chains as
  `domain_referent`, another as `information_artifact`).
- The observations they cite (`$WORK/observations/so-*.yaml`): read them where you need to
  verify a discriminator quote. Every observation id cited by a source hypothesis is in scope.
- CQ suite: `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`.
- Do not read `$WORK/foundational/`, `$WORK/alternative/`, `$WORK/proposals/`, archives,
  DECISIONS.md, or the intake docket.

## Output

Kind-level DenotationHypothesis records `$WORK/hypotheses/dh-<PREFIX>-<kind-slug>-<nnn>.yaml`,
`id: "dh:<PREFIX>-<kind-slug>:<nnn>"`, one per candidate referent kind (or information-artifact
kind, or implementation-only artifact) that the chains instantiate. Expect on the order of
five to fifteen records, not fifty. Rules:

1. **Totality.** Every observation id cited by any source hypothesis appears in
   `observation_refs` of at least one of your records. A chain that instantiates several kinds
   (a request that was enqueued, granted, then released) is cited by each kind's record.
2. **Grain.** State in `proposed_referent.description` what an instance of the kind is and
   which journal events bound it. Distinguish the request from its grant, the grant from its
   release, a withdrawal from an eviction, the lease-eviction from the ticket-eviction, and the
   journal record from what it records. Do not merge kinds because they share fields.
3. **Rivalry carried, not erased.** Where the two source batches disagreed on
   `representation_status` for the same kind, decide from the evidence and put the other
   reading in `alternatives` with `plausibility: viable`; say what would discriminate.
4. **Discriminators are re-verified.** Quote the observation-backed fact (predicate/object
   pairs in the cited `so-` record) that would be false under the null. Copying a source
   hypothesis's discriminator without opening the cited observation is forbidden.
5. **Capture provenance is not domain vocabulary** (`ownerRef*`, `security_resanitization*`,
   `corpus_*`, `capture_*`, `generator_*`, placeholder tokens). Synthetic records are not in
   these batches; do not cite them.
6. **Validate before you stop:**
   `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python $SKILL/scripts/validate_artifacts.py $ONT`
   from the repo root. The 68 "prior unresolved observation ... NO row" violations are expected.
   Any violation naming a `dh-<PREFIX>-` file is yours: fix and re-run until none remain.
7. Final message: records written (ids with representation status), observations covered
   (count, must equal the union of the source batches), the kinds where the source batches
   disagreed and how you resolved each, and the source records you consider superseded (all
   of them, unless one carries a referent your records do not).
