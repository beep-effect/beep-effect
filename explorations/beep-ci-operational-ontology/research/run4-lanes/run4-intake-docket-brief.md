# Auditor run-4 intake docket brief (one lane, one PR, pre-pin draft)

You are a Codex implementation lane in the checkout `beep-effect8-worktrees/run4-intake-docket`
(branch `chore/ciops-run4-intake-docket` off main `e16e7a9297`). Do not run `git add`,
`git commit`, `git stash`, `git checkout --`, or `git switch`; leave the tree dirty and list every
touched path in your report. The orchestrator stages by name and commits. Paths below are relative
to `explorations/beep-ci-operational-ontology/` unless they start with `research/scripts`,
`.claude/`, `goals/`, or `packages/`. Use Bun 1.4.2 from the session PATH. Set `UV_CACHE_DIR` to
the operator-provided cache in the shell environment, then use
`uv run --offline --python 3.12 --with pyyaml python` for any Python.

## Authority (read first; never re-litigate a ruling)

- `DECISIONS.md` entries dated 2026-09-09 "auditor run-3 launch (two rulings)" and 2026-09-10
  "run-3 sitting 1", "sitting 2", "sitting 3", and "S5 gate amendment (four rulings)"; the run-3
  corpora design grill (2026-09-03, sixteen rulings) and Stage B grill (2026-09-08) carry as
  precedent. Rulings 6, 14, 15, 16, 17, 19, 22, 23 by number are the ones the run-3 docket cites.
- `research/run3-lanes/handoff-2026-09-10.md` (run-4 intake items), the run-3 report
  `ontology/extraction/s4/beep-ci-ops/work-run3/impl-report.md` (its "Upstream skill follow-ups
  queued" table and the withdrawal list), and `research/auditor-run3-intake.md`, which is the
  FORMAT TEMPLATE: same section order and voice (prior-run chain block, queues by source with
  per-row evidence duties, non-triggers and carry-forwards, engine deltas, capture provenance
  conventions, not in scope).
- Steward rulings of 2026-09-11 (orchestrator grill and PR #1092 review): the docket is written
  now as a PRE-PIN DRAFT and re-verified at launch; engine follow-ups queued for a later pin are
  NDJSON configuration support, historical archive-path handling, and index rows that can
  reference more than one proposal per observation (or a proposal-coverage rule); auditor skill
  v15 (merged in #1092: required per-seat `effort` on the manifest contract, denotation grain +
  empty-candidate clause) is the engine the pin will freeze.
- Run 4 proper is gated on `goals/time-to-certainty` C4 (the proof-ledger writer). Read that
  packet's `PLAN.md` and record the exact checkbox state of C3.3–C3.6, C4a, C4, C5 at this commit.

## Deliverable: `research/auditor-run4-intake.md`

Open with a "Pre-pin draft" paragraph: assembled 2026-09-11 from main `e16e7a9297`, no pin commit
exists yet, every count below must be re-verified at the run-4 pin, and queue placement is an
instruction to review evidence, not ratification. Then, in the template's order:

1. **Prior-run chain (validator-enforced).** The manifest block the run-4 `work/run-manifest.yaml`
   must carry: `first_run: false`, `prior_index: runs/orun-2026-09-10T02:10:52Z.index.yaml`,
   `prior_index_sha256_12: b9c140ccd31b`. RECOMPUTE the 12-hex digest from the committed index
   bytes and print both; if they differ, stop and report. Census the index rows by outcome and
   by live-versus-carried (expected 284 rows: 37 proposed / 77 mapped / 138 unresolved /
   32 irrelevant; live 216, carried 68) and state the run-3 gate arithmetic (84/198 = 42%, no
   waiver) as historical authority only. State that the run-4 manifest also records
   `agents.<role>.effort` (v15) and the v15 validator/contract digests at the pin.
2. **Queue A: flagged accepts' deferrals.** One entry per TAXONOMY record in
   `ontology/extraction/s5/TAXONOMY.yaml` that carries `flags`, quoting the flag verbatim, the
   ratification id, and the evidence duty it names (ordering cluster rat-053..065: token-charge
   repricing, rule-versus-application identity, demand continuity, episode unity; recorded-value
   reuse rat-066..070 and the run-2 flagged reuses rat-047..052 as their records state). Route
   each to the corpus or contract that could discharge it; mark the ones that wait on C4.
3. **Queue B: Ruling-17 and run-2 flag items rat-047..052.** Quote each `verbatim_decision` and
   evidence requirement (records live in
   `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/`);
   rat-047/048/051/052 re-parked under Ruling 17 pending C4; rat-049 (verification-plan
   continuity) and rat-050 (priority-class registry authority) as contract/governance duties with
   what would discharge them.
4. **Queue C: every unresolved index row exactly once** (138 = 84 live + 54 carried). Copy the id
   census mechanically from the index; bucket rows as corpus-addressable, amendment-gated,
   governance-parked, or eviction-evidence; for each bucket state the run-4 routing and the
   FRESH `needed_evidence` posture required by the manifest rule that verbatim re-parking is
   rejected (name what run 3 showed and what run 4 must add; sitting-2 Rulings 2 and 3 are the
   source for the 54 carried rows). Prove totality with a script: every `unresolved` id in the
   index appears once in the docket and nothing else does; paste the counts.
5. **Queue D: the eight withdrawn proposals** (AdmissionJournalEntry, CheckoutCacheBindingRecord,
   AdmissionGrantTermination, AdmissionRequestTermination, ExecutionDurationAssertion, the
   synthetic SeatGrant and SeatRequest operational readings, the VerificationResultArtifact
   content-snapshot rival) with their receipts
   (`work/sittings/withdrawals-bind-ver-r1.yaml`, `withdrawals-ver-r2.yaml`,
   `withdrawals-sitting-3.yaml`, and the journal-entry duty in `work/sittings/ratification-docket.md`)
   and the named evidence each needs. For the organic lease/ticket-eviction evidence: census,
   counts only, whether organic eviction rows now exist in the admission histories that
   `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py` reads (read its source
   for the input roots; do NOT run a capture, create a pin, or write outside the packet's
   `research/`); state the Stage C capture as the run-4 launch step that rides those mechanics.
6. **Queue E: CQ-019 / CQ-020 leftovers.** Object-valued `hasScope`/`Scope` park with the
   no-punning record; `schedulesWorkUnit` as the historical arm-3 carrier; anything the run-3
   docket's Queue D and sitting-3 Ruling 4 left open. No CQ, seed, or fixture edits.
7. **Queue F: S6 POLICY provenance convention.** Docket the authorized later change adopting
   `corpus_tree`/`corpus_base` and current-tree citations for
   `ontology/extraction/s6/POLICY.yaml`'s `corpus_commit` convention; do not edit POLICY.yaml.
8. **Non-triggers and carry-forwards** (TS adapter non-trigger, S8 IRI deferral under Ruling 15,
   seats follow the launch entry: Codex seats gpt-6-astra at `max` per the 2026-08-27 packet
   directive, blinded seat headless grok-4.6, adversary in an independent context) and
   **Engine deltas since run 3**: validator v15 `.claude/skills/ontology-foundational-auditor/`
   (seat-effort field + family; denotation grain and empty-candidate clause; digests to be pinned
   at launch, print the current validator sha256[:12] and the framed contracts digest exactly as
   `check_manifest` computes them, marked informational), and the three queued follow-ups above
   as NOT in this pin unless a later amendment lands first. Keep the capture-provenance
   conventions table. **Not in scope** mirrors the run-3 docket plus: no edits under
   `ontology/extraction/`, `.claude/`, or `goals/`.

## Packet session surface (explorations/AGENTS.md law)

- `ops/manifest.json`: `updated` → `2026-09-11`; open question 1 → PR #1092 MERGED as
  `e16e7a9297`, the intake docket drafted (this lane), run 4 gated on C4 with the checkbox state
  you recorded.
- `README.md` "Next Open Question": item 1 becomes the merged #1092 line, item 2 points at the
  drafted docket; append one dated Trail entry (2026-09-11, newest first) for this docket PR.
- Run `bun run beep explore atlas --write` then `--check` (the atlas is a git-ignored local
  projection; only README/manifest changes are yours).

## Proofs (from the repo root; paste verdict lines in the report)

- Prior-index digest recomputation and the row census script output.
- Queue C totality script output (every unresolved id once; zero strays).
- `research/scripts/validate_packet.py` default, `--s5`, `--s6` → 0 blockers (nothing under
  `ontology/extraction/` changes, so these are regression checks).
- `bun run beep knowledge semantic-delta` (advisory before commit) and
  `bun run beep knowledge refs --check` → 0 live gated observations; never write home-relative or
  absolute host paths, user names, hostnames, or numeric user identifiers into any file.
- `bun run beep explore atlas --check` green after `--write`.
- Residue scan over touched files; `typos` on touched files.

## Report

Write `research/run4-lanes/run4-intake-docket-report.md`: what was assembled per queue (counts),
the C4 checkbox state, the organic-eviction census, the proof verdict lines verbatim, blockers,
and a final `### Files` list.
