# Run-3 lane brief — PR #1041 review fixes (Greptile, 2026-09-09)

Lane: Codex (`gpt-6-astra`, xhigh); Fable reviews and pushes. Steward: Benjamin. Work ONLY
in `~/YeeBois/projects/beep-effect8-worktrees/run2-residue-repair` (branch
`fix/run2-fleet-residue-repair`, PR #1041) on top of the existing commits. Commit (stage by
path; never `git add -A`); never push, never touch the PR, never edit DECISIONS.md, `run3-*`,
`run3b-*`, or their generators.

## Findings and verdicts

- **G1 — HELD (`etl_fleet_corpus.py` ~271): cross-host replay retains residue.** The Ruling 23
  repair and the residue scan derive the hostname digest from the CURRENT runtime hostname,
  so a pin captured on host A and replayed on host B keeps host A's digest and still verifies.
  Fix: match the STRUCTURAL form instead — inside proof-lock directory names
  (`beep-yeet-proof-locks-<12 hex>-uid-<n>`), replace any 12-hex digest with `<host>` and any
  uid with `uid-<uid>`, and make the scan reject the structural form with a raw digest or uid
  regardless of the machine running it. Keep the runtime-hostname checks as an additional
  guard. Tests: a fixture with a foreign digest is repaired and the raw form fails the scan on
  this host.
- **G2 — HELD (`goals/codex-security-findings-2026-09-08/research/scripts/resanitize-corpora.py`
  ~148-151): explicit `--source-ref` replay duplicates receipts.** Re-running the documented
  replay against an already-repaired destination appends another Ruling 23 record whose
  `superseded_manifest_sha256` points at the prior repaired manifest. Fix: after computing the
  repaired payloads, if every payload byte equals the destination's current bytes AND the
  latest `security_resanitization` record already carries the same finding and classes, return
  "verified unchanged" without appending; test the second run for byte-identical output and an
  unchanged receipt list. Keep #1037's behaviour for genuinely new repairs.

Re-run the repair only if G1 changes bytes in the 29 files (it should not: the current host's
digest is the one present); if the manifest changes, record why. Then: run-2 verifier, the 10
repair tests plus #1037's 38, residue scans (structural form included), packet validator, CQ
suite, `knowledge refs --check`, detached-worktree verify. Append `## Review fixes (Greptile)`
to `research/run3-lanes/run2-residue-repair-report.md`.

Commit: `fix(explorations): make the run-2 residue repair host-independent and idempotent`,
body lines under 100 characters.
