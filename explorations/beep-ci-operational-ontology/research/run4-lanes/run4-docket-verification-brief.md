# Run-4 intake docket verification brief (one adversarial lane)

You are a Codex verification lane in the checkout `beep-effect8-worktrees/run4-docket-verify`
(branch `chore/ciops-run4-docket-verify` off main, which carries PR #1095). Do not run `git add`,
`git commit`, `git stash`, `git checkout --`, or `git switch`; leave the tree dirty and list every
touched path in your report. The orchestrator stages by name and commits. Paths are relative to
`explorations/beep-ci-operational-ontology/` unless they start with `.claude/`, `goals/`, or
`research/scripts`. Use Bun 1.4.2 from the session PATH. Set `UV_CACHE_DIR` to the operator-provided
cache in the shell environment, then use `uv run --offline --python 3.12 --with pyyaml python`.

## Why

`research/auditor-run4-intake.md` was authored by the orchestrator, not a lane, and its first
review found three real defects (a reversed rat-067/rat-068 binding, three Queue B evidence quotes
truncated by a clipped read, and a C4 fallback contradicting the gate), all fixed in
`30781ba7ef`. Run 4 will consume this docket at its pin. Your job is to try to break it: every
factual claim in it must be checked against the record it cites, and anything that would send a
run-4 seat or the pin lane to the wrong ratification, term, row, cluster, quote, count, digest or
ruling is a blocking finding.

## Records of authority (read these, not the docket's paraphrase of them)

- `ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-10T02:10:52Z.index.yaml` (rows, outcomes,
  `needed_evidence`, `carried_from_prior`, `since`) and its sha256[:12].
- `ontology/extraction/s4/beep-ci-ops/work/sittings/carried-clusters.yaml` (cluster ids/names and
  the `rows` mapping of prior observation ids to clusters), `carried-rows-docket.md`,
  `ratification-docket.md` (per-proposal decisions and the journal-entry duty),
  `withdrawals-bind-ver-r1.yaml`, `withdrawals-ver-r2.yaml`, `withdrawals-sitting-3.yaml`,
  `sitting-{1,2,3}-decisions-entry.md`.
- Ratifications: live `ontology/extraction/s4/beep-ci-ops/governance/ratifications/rat-053..070.yaml`
  (`proposal_ref`, `verbatim_decision`), archived run-2
  `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/rat-032..052.yaml`,
  and the run-2 `…orun-2026-09-03T02:46:18Z.work/sittings/ratification-docket.yaml` (`evidence_quote`).
- `ontology/extraction/s5/TAXONOMY.yaml` (`ratification`, `flags` per record) and
  `ontology/extraction/s5/DISPOSITIONS.yaml` (`later_ratifications`), `ontology/extraction/s6/PREDICATES.yaml`.
- `DECISIONS.md` entries: run-3 corpora design grill (2026-09-03), Stage B grill (2026-09-08),
  residue rulings (2026-09-09), run-3 launch (2026-09-09), run-3 sittings 1–3 (2026-09-10), S5
  gate amendment (2026-09-10). Every "Ruling N" the docket cites must exist and say what the
  docket says it says.
- `research/auditor-run3-intake.md` (format template and the carried facts the docket re-states),
  `ontology/extraction/s4/beep-ci-ops/work-run3/impl-report.md`,
  `research/run3-lanes/handoff-2026-09-10.md`.
- `.claude/skills/ontology-foundational-auditor/` (v15: `scripts/validate_artifacts.py`,
  `REVIEW-HISTORY.md`, `prompts/denotation.md`, `SKILL.md`) and `.claude/skills/_shared/`
  (the framed contracts digest, computed exactly as `check_manifest` does).
- `goals/time-to-certainty/PLAN.md` (C-track checkboxes).
- `ontology/extraction/s4/beep-ci-ops/corpus/etl_run3b_fleet_corpus.py` (`admission_sources()`),
  and the run3b/run3 corpus manifests for the counts the docket quotes.

## What to verify (every item, with evidence)

1. **Prior-run chain.** Recompute the index digest; recount rows by outcome and by
   live/carried; confirm the 84 + 54 split and the 216/68 populations.
2. **Queue C totality and placement.** Re-run an independent totality check (every `unresolved`
   id exactly once, no strays). Then for EVERY row: is its bucket (C(i)–C(iii) by evidence text;
   C(iv) by the sitting-2 cluster mapping) consistent with the index's `needed_evidence` and the
   `carried-clusters.yaml` membership? Is each bucket's "what run 3 showed / what run 4 must add"
   posture faithful to the sitting-2 rulings and the index text, or does it invent, drop, or
   contradict a duty? Are the three "no unresolved rows remain" clusters really empty?
3. **Queue A.** Every TAXONOMY record with `flags` is listed once with the right `ratification`
   id and the flag text verbatim; the rat-053..070 → proposal → term bindings in the prose match
   `proposal_ref`; the `later_ratifications` claims match DISPOSITIONS.yaml.
4. **Queue B.** The six `verbatim_decision` and `evidence_quote` texts are complete and verbatim;
   the routing (C4-gated vs contract/governance duty) matches sitting-3 Ruling 3 and Ruling 17;
   nothing the run-3 docket carried as a duty has been dropped.
5. **Queue D.** The eight withdrawals, their receipt files and named evidence match the receipts;
   the organic eviction census can be reproduced from `admission_sources()` roots (counts only);
   the run3b-fleet comparison numbers match its manifest.
6. **Queues E/F, non-triggers, engine deltas.** Rulings cited exist and are paraphrased
   correctly; digests quoted match the working tree; the follow-up list matches the impl report
   and the #1092 review record; "Not in scope" mirrors the run-3 docket.
7. **Gate section and session surface.** The C4 checkbox state matches PLAN.md; the README's Next
   Open Question, Trail entry and `ops/manifest.json` open question agree with the docket and
   with each other (no stale "PR pending" wording now that #1095 is merged).
8. **Format.** Section order and voice follow the run-3 docket; markdown lists render (blank line
   before every id list); no host paths, user names, hostnames or numeric user ids anywhere.

## Output

- Apply a correction directly in `research/auditor-run4-intake.md` (and README/manifest if item 7
  finds drift) ONLY when the record you quote makes the fix unambiguous; keep every id list
  mechanically derived (never hand-edit an id). Anything judgmental (a posture you would word
  differently, a routing you would argue with) goes in the report as a finding, not an edit.
- Write `research/run4-lanes/run4-docket-verification-report.md`: a findings table (id, severity
  BLOCKING / MINOR / CONFIRMED-OK, docket line, the record and quote that decides it, the fix
  applied or proposed), the reproduced digest/census/totality outputs verbatim, the checks you
  ran per item above with their verdict lines, blockers, and a final `### Files` list. If you
  edited the docket, re-run the totality check and paste it.
- Proofs on touched files: `typos`, residue scan, and `bun run beep explore atlas --check` only if
  README/manifest changed (run `--write` first; the atlas is a git-ignored local projection).
