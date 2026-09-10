# Run-3 index-closing brief (skill step 9; orchestration lane after sitting 3)

You are the INDEX lane of auditor run 3 (`orun-2026-09-10T02:10:52Z`) for `beep-ci-ops`, a
fresh Codex context. HEAD is the frozen run pin; run no `git` command that writes. You create
exactly `$WORK/dispositions.index.yaml` and, for every steward rejection the launch message
names, `$WORK/rejections/rej-<nnn>.yaml`. You never edit a seat record, a ratification, or a
review. Withdrawn/deferred proposals and their reviews have ALREADY been removed by the
orchestrator before you run (run-1/run-2 close precedent); treat a chain whose proposal file is
absent as withdrawn.

Paths: `ONT=explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops`,
`WORK=$ONT/work`, `SKILL=.claude/skills/ontology-foundational-auditor`, `SHARED=.claude/skills/_shared`.

## Contract (validator v14, skill step 9)

`work/dispositions.index.yaml` is a LIST of rows, EXACTLY one per observation id: every
`so:`/`po:` id under `$WORK/observations/` and `$WORK/prose-observations/` (216 rows) PLUS
every prior unresolved row carried from `runs/orun-2026-09-03T02:46:18Z.index.yaml` (68 rows,
`carried_from_prior: true`). Row keys, matching the prior index's shape: `observation`,
`outcome` (`irrelevant` | `mapped` | `proposed` | `unresolved`), `ref` (for `mapped`/`proposed`:
an `otp:` id present in this run; `mapped` requires that proposal to carry
`reuse.exact_reuse_found: true`), `reason` (required for `irrelevant`: concrete, scope-grounded,
never a bare "out of scope"), `needed_evidence` + `since: "2026-09-10"` (required for
`unresolved`), `carried_from_prior` (boolean; present and true only on the 68 carried rows).
Read `$SKILL/SKILL.md` step 9 and the validator's index checks (`validate_artifacts.py`,
search for `dispositions.index`) before writing; the validator enforces totality, uniqueness,
ref resolution, verbatim-repark rejection, and the 50% unresolved-fraction gate.

## Rules for the 216 run-3 observation rows

Walk each observation through its chain: the hypothesis(es) citing it in `$WORK/hypotheses/`,
the `ic-`/`fa-` pair, the proposal (if present) and its latest review, and the ratification
in `$ONT/governance/ratifications/` (rat-053 onward) if one exists.

- `proposed` with `ref: otp:<...>` when the observation's chain ends in a proposal that is
  present and ratified (accept) or submitted flagged (accept with deferral). If a proposal
  carries `reuse.exact_reuse_found: true`, the outcome is `mapped` with the same ref.
- `irrelevant` with the hypothesis's own null rationale as `reason` when the chain's null
  hypothesis stands (`representation_status: implementation_artifact_only`) or the
  foundational seat skipped it as a non-survivor; quote the concrete grounds (capture
  provenance, wrapper, flattened projection, setting without governing use).
- `unresolved` with `needed_evidence` when the chain is deferred (hypothesis
  `representation_status: unresolved`, an `explicitly_deferred` analysis with no proposal, a
  withdrawn proposal, or a steward rejection): copy the named missing evidence from the
  analysis, the withdrawal note in the sitting entries, or the rejection rationale; never
  invent evidence and never reuse a prior row's wording verbatim.
- An observation cited by several chains takes the strongest outcome in the order
  `proposed`/`mapped` > `unresolved` > `irrelevant`, with `ref`/`reason` from that chain.

## Rules for the 68 carried rows

Take them from `$WORK/sittings/carried-clusters.yaml` exactly as sitting 2 ratified
(`work/sittings/sitting-2-decisions-entry.md`): the 14 retirements become `irrelevant` with
the cluster's reason (re-identification names the run-3 observation id), the 54 parks become
`unresolved` with the cluster's NEW needed_evidence and `since: "2026-09-10"`. Every carried
row keeps its prior `observation` id and `carried_from_prior: true`.

## Rejections

For each steward rejection named in the launch message write
`$WORK/rejections/rej-<nnn>.yaml` per the validator's rejection-ledger join (id,
proposal_ref, substantive rationale copied from the ratification's verbatim decision).

## Proof

Run `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml python $SKILL/scripts/validate_artifacts.py $ONT --gate --repo .`
from the repo root and iterate until the only remaining output is the ratification summary
and flags (no VIOLATIONS). If the unresolved fraction exceeds 50%, stop and report the exact
fraction; the orchestrator adds the steward-ratified waiver to the manifest. Final message:
row totals by outcome (run-3 rows and carried rows separately), the unresolved fraction, the
refs used, and the gate verdict line verbatim.
