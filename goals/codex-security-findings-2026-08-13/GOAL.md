# Codex Security Findings (2026-08-13)

Repo root: the current working directory. Do not assume an absolute path.

Outcome: fix and close the 15 Codex Cloud security findings captured on
2026-08-13 for `kriegcloud/beep-effect`: 6 High, 5 Medium, 1 Low, 3 Informational.
Ship the remaining fixes through Yeet-driven mergeable PRs, merge them, then
resolve the exact captured Codex IDs until no packet-applicable finding remains
open.

Read first:

- `goals/codex-security-findings-2026-08-13/README.md`
- `goals/codex-security-findings-2026-08-13/SPEC.md`
- `goals/codex-security-findings-2026-08-13/PLAN.md`
- `goals/codex-security-findings-2026-08-13/ops/manifest.json`
- `goals/codex-security-findings-2026-08-13/ops/triage.json`
- `goals/codex-security-findings-2026-08-13/findings/INDEX.md`
- `goals/codex-security-findings-2026-08-13/research/QUALITY_REVIEW.md`

Then read `AGENTS.md`, required skills, and standards governing each target.
Repo law outranks packet prose.

Scope:

- In: sanitized packet evidence, current-HEAD validation, minimal root-cause
  remediation, focused regression checks, Yeet proof/publication/monitoring,
  merge, and post-merge Chrome closure.
- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,
  unrelated cleanup, weakened quality/security gates.

Current position: P2/P3 are complete for all 15 findings. PRs #681 (`CSF-002`),
#685 (`CSF-007`), and #688 (`CSF-010`) are merged. CSF-009 PR #697 and CSF-014
PR #696 passed full Yeet verify 21/21, are pushed, and are open/unmerged under
hosted monitoring; hosted green is not yet claimed. CSF-012, CSF-013, and
CSF-015 have prepared fixes but are not merged. CSF-013 has focused 7/7 proof
after merging current main into its branch, and full Yeet is running. CSF-011
was already fixed. The prior 13-finding quality ledger contains 42 repaired reviewer and
gate items; focused proof for CSF-014 and CSF-015 is recorded in their finding
records. Post-merge baseline regeneration and the 15-lane aggregate audit are
green. The final refresh used `origin/main` `642331b86c` and merge HEAD
`8337a21710`; two compatibility reviewers returned literal `0 changes
suggested`.
CSF-001, CSF-003, CSF-004, CSF-005, CSF-006, and CSF-008 remain confirmed
`remediate` items blocked on runner admission/workload-identity architecture
and external GitHub organization runner-group/AWS deployment proof.

Rules:

<!-- codex-findings-refresh:start -->
Refresh reconciliation complete: all 15 records are validated and lane-assigned;
the original 13 records retain their prior triage and proof.
<!-- codex-findings-refresh:end -->

1. Default every item to `remediate`; use `already-fixed` or `false-positive`
   only with strict current-HEAD proof in the finding and triage ledger.
2. Apply Effect-first and schema-first repo law. Search live source and barrels
   before adding helpers; reuse canonical path-safety and bounds primitives.
3. Fix shared causes once. Add one focused regression check per executable-code
   finding, merging tests only where the same root cause is exercised.
4. Keep raw report bodies ignored under `raw/`. Tracked records may contain only
   sanitized metadata, summaries, decisions, changed files, and proof.
5. Run focused tests, affected package checks, packet validation, then Yeet
   repair/verify. Publish intentional narrow PRs and monitor through mergeable.
6. After merge, close only the exact 15-ID allowlist in Codex as Already fixed
   (or the evidence-backed invalid reason) and verify zero packet-open findings.
7. Treat PRs #681, #685, and #688 as merged; treat PRs #696 and #697 as open,
   unmerged, and under hosted monitoring. Do not claim hosted green or merge
   for them, and do not publish held findings without new authorization.

Stop if the signed-in CSV export is unavailable, tracked evidence contains secret
or raw-path material, a fix needs an out-of-packet architecture decision, or the
same blocker repeats after reasonable investigation.
