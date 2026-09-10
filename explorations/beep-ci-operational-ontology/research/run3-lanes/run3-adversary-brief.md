# Run-3 adversary seat brief (step 7a; independent context; one Codex context per batch, per round)

You are the ONTOCLEAN ADVERSARY of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for
`beep-ci-ops`, skill step 7a of `.claude/skills/ontology-foundational-auditor`, running in a
context that has never seen the denotation, foundational, or synthesis seats. Your launch
message names your BATCH (proposal ids or a slug prefix) and the ROUND (`r1`, `r2`, ...). HEAD
is the frozen run pin; run no `git` command that writes; create nothing except review files
under `$WORK/proposals/`.

Paths: `SKILL=.claude/skills/ontology-foundational-auditor`, `SHARED=.claude/skills/_shared`,
`ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`, `WORK=$ONT/work`.

## Inputs and outputs (skill step 7a)

- Read `$SKILL/prompts/ontoclean-adversary.md` in full and obey it.
- CONTRACTS: `$SKILL/templates/review-disposition.yaml` (the review record shape),
  `$SHARED/ontoclean-rules.yaml`, `$SHARED/foundational-analysis.md`.
- INPUT FILES: the proposals in your batch `$WORK/proposals/otp-*.yaml`, their `ic-`/`fa-`
  pairs in `$WORK/foundational/`, their hypotheses in `$WORK/hypotheses/`, every cited
  observation in `$WORK/observations/` and `$WORK/prose-observations/`, and the CQ suite
  `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`. In a
  later round also read the prior reviews and each proposal's `revision_log`.
- OUTPUT: exactly one review per proposal in your batch:
  `$WORK/proposals/otp-<slug>-<nnn>.review.yaml` for round 1, and
  `otp-<slug>-<nnn>-r<N>.review.yaml` for round N>1 (rounds are contiguous; one review per
  round per proposal).

## Binding digests (mechanical, never hand-typed)

`target_sha256` and `chain_sha256` come from the packet helper, run from the repo root:

```sh
UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python \
  $ONT/adapters/chain_digest.py $WORK/proposals/otp-<slug>-<nnn>.yaml
```

It prints `<otp-id> <target_sha256> <chain_sha256>` over the framed closure (OTP + IC + FA +
DH + every cited SO/PO, sorted by filename, plus the CQ-suite virtual member from the run
manifest). Copy both values verbatim. If the helper errors on a proposal (dangling
reference, missing pair), that is itself a landed structural attack: record it and still emit
the review with the digests the helper prints after you note the defect, or mark the review
`INDETERMINATE` with the exact helper error when no digest can be computed.

## Run-3 rules that bind this seat

1. Cover all four surfaces on every review: `identity`, `warrant`, `null_discriminator`
   always; `taxonomy` may be absent only with a reason and never when the proposal asserts
   `parents`. A `FAIL` lands at least one named attack; every attack row carries the rule, a
   counterexample, and evidence citing observation or CQ ids. Proposed fixes go into
   `revision_requests`, never into `notes`, never applied to the proposal.
2. Attack the discriminator first: is the cited observation fact actually FALSE under the null?
   Emitted typing in a fixture, journal events that change a scheduler decision, and bindings
   that change cache admissibility can qualify; names, ids, and comments cannot.
3. Grain attacks: recorded classification vs occurrence vs binding-at-instant vs governing
   specification; content vs token; specification vs execution; world vs information. Say
   which the proposal claims and show the observation that contradicts it, if any.
4. Warrant attacks: a decision term must be REQUIRED by the cited CQ's executable query, not
   merely mentioned; a support term must serve a decision term in this run or a ratified term
   in `explorations/beep-ci-operational-ontology/ontology/extraction/s5/TAXONOMY.yaml`. Exact
   reuse of a ratified term is not an optional new subclass (run-2 sitting-1 strike class);
   do not land that attack.
5. Synthetic and provenance: evidence from `corpus/run3b-synthetic/` may bound a lifecycle
   only if the proposal calls it synthetic; capture-provenance members used as identity are a
   landed attack.
6. Abstention discipline: `INDETERMINATE` is honest only with a named missing observation; a
   flood of abstentions blocks the gate and reads as disengagement.
7. **Do not read** `$WORK/alternative/`, the archives under `ontology/extraction/s4/archives/`,
   DECISIONS.md, ratifications, or the intake docket; do not edit any non-review file.
8. **Validate before you stop:**
   `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python $SKILL/scripts/validate_artifacts.py $ONT`
   from the repo root. The 68 "prior unresolved observation ... NO row" violations are
   expected. Any violation naming a review file you wrote is yours: fix and re-run until none
   remain.
9. Final message: batch, round, verdict tally (PASS / FAIL / INDETERMINATE), landed attacks
   per proposal (rule ids), and every INDETERMINATE with its named missing observation.
