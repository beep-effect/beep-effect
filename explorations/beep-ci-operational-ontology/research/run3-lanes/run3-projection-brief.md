# Run-3 S5/S6 projection brief (closeout lane; runs after sitting 3 and the post-scribe gate)

You are the PROJECTION lane of auditor run 3 for `beep-ci-ops`, a fresh Codex context. Run no
`git` command that writes. You edit only: `ontology/extraction/s5/DISPOSITIONS.yaml`,
`ontology/extraction/s6/PREDICATES.yaml`, `ontology/docs/s6-abox-contract.md` (a dated note,
never a rewrite of its historical sections), and, only if the S5 taxonomy contract requires it
for a ratified NEW class or property, `ontology/extraction/s5/TAXONOMY.yaml`; plus the two
path fixes in item 3. Paths are relative to `explorations/beep-ci-operational-ontology/`.

## Why

The run-2 closeout never projected four accepted ratifications into the S5/S6 status surface
(rat-032 FailureSignature, rat-033 VerificationAttempt, rat-037 dependsOnTransitive, rat-039
VerificationLane reuse); the run-3 launch relocated all run-2 ratifications to the shelter and
carried the projection as a closeout item (`ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-03T02:46:18Z.README.md`,
2026-09-09 note; `research/auditor-run3-intake.md` carry-forwards). Run 3's own ratifications
(rat-053 onward, under `ontology/extraction/s4/beep-ci-ops/governance/ratifications/`) need the
same projection. One verified pass covers both.

## Rules

1. Read `ontology/docs/s5-taxonomy-contract.md` and `ontology/docs/s6-abox-contract.md` first:
   they define the row shapes (`ruling ∈ {accepted-via, merged-into, rejected, parked-run-2,
   deferred-s6}` with `join_ref`, `justification`; predicate `status ∈ {ratified, provisional,
   parked-run-2, seed-only}` with `term_ref`) and what TAXONOMY.yaml membership means. Mirror
   the existing `accepted-via rat-0NN` rows exactly.
2. For each ratification (the four run-2 ones from
   `ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.governance/ratifications/`
   and every run-3 one): find the DISPOSITIONS candidate row(s) and PREDICATES entries for the
   term; set `ruling: accepted-via`, `join_ref: rat-0NN`, and a justification quoting the
   verbatim decision's substance and the sitting (DECISIONS.md entry name). A flagged
   acceptance keeps its flag text in the justification. A reuse mapping onto an already-ratified
   term projects as `accepted-via` on the candidate that was mapped, with `join_ref` naming both
   the ratification and the ratified term. Rejections project as `rejected` with the rejection
   ledger id. Do not touch rows the ratifications do not name.
3. Path fixes queued from the pin commit (Heavy/Lint Policy `knowledge:semantic-delta`):
   in `ontology/extraction/s4/beep-ci-ops/work-run2/impl-report.md` the reference to
   `.../beep-ci-ops/work/review-audit/validity-report.md` becomes the archive path
   `.../s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.work/review-audit/validity-report.md`;
   in `ontology/extraction/s4/beep-ci-ops/runs/orun-2026-09-03T02:46:18Z.README.md` the bare
   `explorations/beep-ci-operational-ontology/ontology/docs/s6-abox-contract.md` becomes
   `explorations/beep-ci-operational-ontology/ontology/docs/s6-abox-contract.md`.
4. Proofs, from the repo root (`bun` at `~/.local/share/mise/installs/bun/1.4.2/bin`, Python via
   `UV_CACHE_DIR=~/.cache/beep/uv-cache uv run --offline --python 3.12 --with pyyaml`): every
   script under `ontology/extraction/s5/scripts/` and `ontology/extraction/s6/scripts/` that
   verifies the status files (read their headers; run the verify/check modes, never a
   regenerate that rewrites frozen artifacts); `research/scripts/validate_packet.py`;
   `bun run beep knowledge semantic-delta` must report zero introduced findings; the CQ suite
   runner `research/scripts/run_cq_suite.py` stays green. Residue scan on every edited file.
5. Final message: a table of ratification → file → row edited, the proof commands with their
   verdict lines, and anything you could not project (with the reason).
