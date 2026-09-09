# Run-3 lane brief — reconcile the run-2 repair branch with main after PR #1037

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and publishes. Steward: Benjamin.
This branch (`fix/run2-fleet-residue-repair`, based on `ace139cf4e`) repaired the run-2 fleet
pin in place under Ruling 23 (commit `93fedc1f94`). Main has since taken PR #1037 (CSF-013,
`22063e7b6d`), which edited `etl_fleet_corpus.py` (process-member variant removal, escaped-key
and properties checks, finding attribution before replay), `run2-fleet/MANIFEST.yaml` (a
CSF-013 record), and `goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py`.
Both sides are right; keep both.

Work ONLY in this worktree (`~/YeeBois/projects/beep-effect8-worktrees/run2-residue-repair`).
Commit (stage by path; never `git add -A`); never push, never open a PR, never rebase or
force, never touch `run3-*`, `run3b-*`, their generators, or `DECISIONS.md`.

## Required

1. `git merge origin/main` (merge commit). Resolve `etl_fleet_corpus.py` and the resanitize
   script as BOTH sides; resolve `run2-fleet/MANIFEST.yaml` by taking main's, then re-running
   this branch's repair so the manifest carries BOTH the CSF-013 record from #1037 and the
   Ruling 23 record in the order the generator emits them. If #1037's "explicit finding
   attribution before replay" rule needs an attribution for the Ruling 23 repair, supply one
   citing Ruling 23 (no CSF id) and record the choice.
2. Verify: run-2 verifier PASS; the branch's 9-test suite plus #1037's tests green; residue
   scans (hostname digest, `uid-[0-9]+`, `/home/`, raw pids, escaped keys) zero; corpus diff
   versus main limited to the 29 repaired files + manifest; detached-worktree verify at the
   committed HEAD; packet validator + CQ suite; `bun run beep knowledge refs --check`.
3. Append `## Reconciliation with #1037` to `research/run3-lanes/run2-residue-repair-report.md`.
   Commits: `chore(explorations): merge main into the run-2 residue repair after #1037`, then
   `fix(explorations): re-run the run-2 pin repair on the merged generator` if bytes changed.
