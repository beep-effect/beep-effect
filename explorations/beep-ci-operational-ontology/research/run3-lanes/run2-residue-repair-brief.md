# Run-3 lane brief — run-2 fleet pin residue repair (separate PR, lands after #1040)

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and publishes. Steward: Benjamin.
Steward ruling (2026-09-09): the run-2 pin was ratified by auditor run 2, so Ruling 22's
refresh path does not apply; repair it IN PLACE under the repair mechanics that PR #1032
(CSF-012) added to `etl_fleet_corpus.py` — no recapture, every other byte preserved, the
run-2 ratification chain intact.

Work ONLY in `~/YeeBois/projects/beep-effect8-worktrees/run2-residue-repair` (branch
`fix/run2-fleet-residue-repair`, from `origin/main`). Commit (stage by path; never
`git add -A`); never push, never open a PR. Do not touch `run3-*`, `run3b-*`, their
generators, or `DECISIONS.md`.

## Facts

- `ontology/extraction/s4/beep-ci-ops/corpus/run2-fleet/`: 29 files contain the
  `sha12(hostname)` digest and 29 contain `uid-<n>` tokens, both inside quoted proof-lock
  directory names (`beep-yeet-proof-locks-<sha12(host)>-uid-<uid>`) in retained messages.
  No literal hostname, no `/home/`. The run-2 generator's residue scan never covered these
  classes; the Stage A/B generators redact them to `<host>` and `uid-<uid>` (see
  `redact_string` in `etl_run3b_fleet_corpus.py` on main).
- #1032 gave `etl_fleet_corpus.py` a repair mode with `--source-ref` replay,
  `security_resanitization` manifest entries, and generator-provenance checks against Git
  history. Read that diff (`git log --oneline -3 -- <generator>`, `git show`) and the packet
  `goals/codex-security-findings-2026-09-08/` before editing.

## Required

1. Extend the run-2 generator's repair rules with the two classes (hostname digest computed
   at run time, never written; generic `uid-<n>`), applied ONLY through the repair path so an
   ordinary verify of the committed pin still passes before and after; extend its residue scan
   to fail on both classes; extend `test_run3_generators.py` or the run-2 generator's own
   tests (whichever #1032 used) with positives and negatives.
2. Run the repair against the committed pin; the manifest gains a second
   `security_resanitization` entry citing this ruling and the two classes; projections and
   integrity receipts regenerate; capture history, custody references, and every unaffected
   byte are preserved (prove with a before/after diff limited to the 29 files + manifest).
3. Verify: run-2 verifier PASS; independent scans for the hostname digest, `uid-[0-9]+`,
   `/home/`, raw pids: zero; packet validator + CQ suite green; `bun run beep knowledge refs
   --check` after commit; detached-worktree verify at the committed HEAD.
4. Bookkeeping: OPPORTUNITIES receipt (run-2 scanner classes lagged the later generators);
   README Trail line; do not edit DECISIONS.md (Fable records the ruling).

## Report and commit

Report: `explorations/beep-ci-operational-ontology/research/run3-lanes/run2-residue-repair-report.md`
(commit it). Commit message: `fix(explorations): repair hostname-digest and uid residue in the run-2 fleet pin`,
body lines under 100 characters.
