# Execution friction

## 2026-10-28 — Separate full compiler census from publication preflight

- **Work:** requalify the String migration against the current compiler graph.
- **Evidence:** the canonical full local proof passed all 25 cheap-gates lanes,
  but spent more than twenty minutes in preflight before dispatching Check.
  The regenerated documentation ratchet alone took 449 seconds.
- **Resolution:** apply the existing constrained-compute publication route,
  preserve the successful gate evidence, and run the full Check lane separately
  under the existing admission scheduler. Do not report the cancelled full proof
  as successful.
- **Prevention:** plan the exact acceptance command at launch; distinguish the
  full compiler census from affected-file readiness and whole-repository proof.
