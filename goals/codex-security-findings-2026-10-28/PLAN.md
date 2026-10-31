# Codex Security Findings (2026-10-28) Plan

## Status

Status: `active`, with prospective `completed-retained` closeout.

All seven Cloud findings merged in PR #2333 and are verified Fixed. Twenty
additional dependency alerts are appended in `ops/dependabot.json`; the
resolver-generated fixes and scoped proof are published in PR #2389.
Final hosted readiness, merge, exact external dependency closure and completion
receipts remain required. See [current evidence](research/2026-10-31-closeout.md).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture all live findings via the signed-in CSV export. | 7 IDs reconcile: 1 Low, 6 Informational. |
| P2 validate | complete | Reproduce each report at current HEAD. | Every item has strict verdict, disposition, rationale, and owner surface. |
| P3 lane-partition | complete | Group shared root causes and disjoint paths. | Lanes recorded without overlapping file ownership. |
| P4 remediate | complete | Fix all real findings with focused checks. | Changed files and passing targeted proof recorded per finding. |
| P5 repo-proof | in-progress | Repair inherited policy-tooling blockers; run focused regressions, independent review, packet validation and Yeet proof. | No packet drift; scoped proof green; canonical generated outputs checked. |
| P6 publish | complete | Publish one intentional PR through Yeet. | Exact branch head pushed and PR opened. |
| P7 monitor | in-progress | Close hosted checks and actionable reviews on the final repaired head. | Canonical strict readiness true, including Fallow and Lint Policy; review window elapsed. |
| P8 merge-and-close | pending | Merge and close captured findings. | Final PR merged; all 7 Cloud IDs and 20 supplemental dependency IDs resolved. |
| P9 close | pending | Record evidence, reflection, and lifecycle. | Verified post-merge receipt derives `completed-retained`; reflection and exact-ID evidence retained. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-10-28/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-10-28/ops/manifest.json
jq . goals/codex-security-findings-2026-10-28/ops/triage.json
test "$(find goals/codex-security-findings-2026-10-28/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 7
git diff --check -- goals/codex-security-findings-2026-10-28
```

## Historical execution update — 2026-10-28

All seven complete Cloud reports were reviewed and their source defects validated.
Controls and focused regressions are implemented. See
[qualification evidence](research/qualification.md). Hosted Windows execution,
remaining repository proof, publication, merge and exact-ID closure are pending.
This supplemental packet is part of the resumed
[October 20 goal](../codex-security-findings-2026-10-20/GOAL.md).

## Supplemental scanning acceptance — October 31

The broader authenticated inventory also found four stale CodeQL alerts and
five secret-scanning alerts. Their separate sanitized catalog is
`ops/scanning.json`, with source validation and exact closure reasons in
`research/2026-10-31-scanning.md`. All nine must be resolved with evidence,
without accepted risk, before final completion. Preserve the original seven
Cloud IDs and twenty dependency IDs.
