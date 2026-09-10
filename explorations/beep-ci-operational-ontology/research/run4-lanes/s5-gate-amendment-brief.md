# S5 gate amendment + run-2/run-3 projection brief (one lane, one PR)

You are a Codex implementation lane in the checkout `beep-effect8-worktrees/s5-gate-amendment`
(branch `chore/s5-gate-amendment` off main). Do not run `git add`, `git commit`, `git stash`,
`git checkout --`, or `git switch`; leave the tree dirty and list every touched path in your
report. The orchestrator stages by name and commits. Paths below are relative to
`explorations/beep-ci-operational-ontology/` unless they start with `research/scripts`,
`.claude/`, or `packages/`. Use Bun 1.4.2 from the session PATH. Set `UV_CACHE_DIR` to
the operator-provided cache in the shell environment, then use
`uv run --offline --python 3.12 --with pyyaml[,rdflib,pyshacl,pyoxigraph] python`.

## Authority (read first; do not re-litigate)

`DECISIONS.md` section "2026-09-10 — S5 gate amendment (four rulings)" (the last entry), plus
"run-3 sitting 3" (the 18 ratifications and their flags), "run-2 sitting 3" (rat-032..052),
and `ontology/docs/s6-abox-contract.md` §6 (the recorded block). Ratification records:
`ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-053..070.yaml` (run 3, live)
and `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-032..052.yaml`
(run 2). Proposals: live `ontology/extraction/s4/beep-ci-ops/work/proposals/otp-*.yaml` (run 3)
and the archived `.../archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/proposals/` (run 2),
`orun-2026-08-29T08:20:55Z.work/proposals/` (run 1).

## Part A — gate amendment (`research/scripts/validate_packet.py`)

1. **Ruling 1 — required set.** Extend the `--s5` taxonomy derivation: for every proposal file
   under the live work tree and every `archives/beep-ci-ops/orun-*.work/proposals/` shelter, if a
   ratification (live or in any `orun-*.governance/ratifications/` shelter) has
   `proposal_ref == proposal.id` and `decision: accept`, the proposal's `term.local_name` joins
   the required set. Run 1's existing derivation is unchanged. Bind by proposal id, never by
   name; a ratification whose `proposal_sha256` does not match the proposal bytes on disk is a
   blocker (digest-fresh authority). Validate the new TAXONOMY fields: `ratification` must name a
   ratification on disk or in the shelters whose accepted proposal's `term.local_name` equals the
   record's `term`; `flags` is an optional non-empty string.
2. **Ruling 2 — S6 tripwire.** Replace `len(ratified_classes) != 18` with a named superset
   check: enumerate the eighteen classes that TAXONOMY.yaml holds at `origin/main` today (read
   them from `git show origin/main:<path>`; they are the S6-era set), require every one to be
   present as `kind: class`, and allow additional ratified classes. Keep the typing law untouched.
3. **Ruling 3 — later ratifications.** Accept an optional additive `later_ratifications:` list
   on DISPOSITIONS candidate rows; every member must be a ratification on disk or in the
   shelters; `join_ref` stays a single bare id and its existing check stays.
4. Keep every other rule; keep the script's structure and messages; add unit-style self-checks
   only if the script already has a pattern for them. Run all modes: default, `--s5`, `--s6`.

## Part B — contract amendments (dated sections, no rewrite of history)

- `ontology/docs/s5-taxonomy-contract.md`: append "## 2026-09-10 amendment" recording Rulings
  1 and 3 (record fields `ratification`/`flags`; `later_ratifications`; required-set rule).
- `ontology/docs/s6-abox-contract.md`: append to §6 (or a §7) the Ruling-2 superset rule and
  state that the block recorded in §6 is discharged by this change.

## Part C — projection pass

- `ontology/extraction/s5/TAXONOMY.yaml`: append one record per accepted NEW term from run 2
  (rat-032 FailureSignature, rat-033 VerificationAttempt, rat-037 dependsOnTransitive, rat-039
  VerificationLane reuse — read each ratification and its proposal for kind, parents, rigidity,
  identity_ref, parameters; parents only when the proposal asserts them and the parent is
  accepted) and from run 3 (every rat-053..070 whose term is not already a TAXONOMY term:
  ScheduleStep, hasStep, stepIndex, schedulesSeatRequest, hasScopeTag, VerificationEpisode,
  hasCurrentProposal, AdmissionProjectionSpecification, hasProjectionSpecification, and any
  other), each with `ratification:` and `flags:` (the deferral clause of the verbatim decision).
  For accepts that REUSE an existing TAXONOMY term (SeatGrant, SeatRequest, ScheduleProposal,
  admissionChargeTokens, hasOriginKey, VerificationAttempt if already present after the run-2
  row, VerificationResultArtifact): add `ratification`/`flags` only if the record has none, else
  leave the record and rely on DISPOSITIONS `later_ratifications`.
- `ontology/extraction/s5/DISPOSITIONS.yaml`: rows for candidates that a run-2/run-3
  ratification accepted and that read `parked-run-2` (FailureSignature seq 12, VerificationAttempt
  seq 22, and any other) become `ruling: accepted-via`, `join_ref: rat-0NN`, justification
  quoting the sitting; rows already `accepted-via` whose term was re-ratified gain
  `later_ratifications: [...]` with the reuse grain in the justification. Never invent candidate
  rows; terms with no S4 candidate (VerificationLane, hasStep, ...) are TAXONOMY-only.
- `ontology/extraction/s6/PREDICATES.yaml`: predicates now in TAXONOMY flip to
  `status: ratified` with `term_ref: TAXONOMY.yaml#<name>`; do not touch predicates the
  ratifications do not name; keep `used_by` accurate.
- `ontology/docs/s6-abox-contract.md` §5's "VerificationLane placement waits for run 2" gets a
  one-line dated pointer to rat-039 (do not rewrite the section).

## Proofs (all from the repo root; paste verdict lines in the report)

- `validate_packet.py` default, `--s5`, `--s6` → `0 blockers` each.
- Every verify/check mode under `ontology/extraction/s5/scripts/` and `s6/scripts/`
  (`apply_s6_dispositions.py --check`, `run_shacl.py`, and whatever else the READMEs name; never
  a regenerate that rewrites frozen artifacts) → green.
- `research/scripts/run_cq_suite.py` → 0 failures.
- `bun run beep knowledge semantic-delta` → `introduced (0)` (scans HEAD: report it as advisory
  until the orchestrator commits, but run it) and `bun run beep knowledge refs --check` → no
  live gated observations (never write home-relative or absolute host paths into any packet file).
- Residue scan (home paths, user name, hostnames, numeric user identifiers) over every touched file.
- Typos on touched files.

## Report

Write `research/run4-lanes/s5-gate-amendment-report.md` (create the directory; also copy this
brief there as `s5-gate-amendment-brief.md`): what changed per file (a table of ratification →
file → record), the proof verdict lines verbatim, blockers, and a final `### Files` list.
