# Codex Security Findings (2026-10-20) Plan

## Status

Status: `active`.

The original eight Cloud findings and 123 dependency alert IDs are resolved:
all eight Cloud IDs are Fixed, 121 dependency alerts are fixed, and two are
explicitly withdrawn. Original remediation merged in PR #1930; the seven
linked October 28 Cloud findings merged in PR #2333 and are also Fixed.
Final reconciliation and 20 supplemental dependency fixes are published in
PR [#2389](https://github.com/beep-effect/beep-effect/pull/2389).
See [current evidence](research/2026-10-31-revalidation.md). The remaining
acceptance work is the final PR's hosted readiness, merge, supplemental alert
closure, and derived completion receipts for both packets.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture all live findings via the signed-in CSV export. | 8 IDs reconcile: 3 Low, 5 Informational. |
| P2 validate | complete | Validate full detail evidence and source reachability; retain exploit limits. | Every item has strict verdict, disposition, rationale, and owner surface. |
| P3 lane-partition | complete | Group shared root causes and disjoint paths. | Lanes recorded without overlapping file ownership. |
| P4 remediate | complete | Fix all real findings with focused checks. | Changed files and passing targeted proof recorded per finding. |
| P5 repo-proof | in-progress | Run packet validation and Yeet repair/verify. | No packet drift; local proof green. |
| P6 publish | complete | Publish one intentional PR through Yeet. | Exact branch head pushed and PR opened. |
| P7 monitor | in-progress | Close hosted checks and actionable reviews. | PR green and mergeable. |
| P8 merge-and-close | pending | Merge and close captured findings. | PR merged; all 8 IDs resolved. |
| P9 close | pending | Record evidence, reflection, and lifecycle. | Final addendum and derived `completed-retained` receipt recorded only after merge and exact-ID closure. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-10-20/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-10-20/ops/manifest.json
jq . goals/codex-security-findings-2026-10-20/ops/triage.json
test "$(find goals/codex-security-findings-2026-10-20/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 8
git diff --check -- goals/codex-security-findings-2026-10-20
```

## Expanded dependency work

All 123 captured alert IDs in `ops/dependabot.json` have been revalidated as
resolved, separately from the eight Cloud identities. Twenty additional
Dependency alerts (#450–#469) are tracked in the October 28 packet and fixed
by PR #2389; their external closure remains post-merge.

## Closeout ordering

The original remediation and external closure are complete. P5/P7 represent
final reconciliation proof for PR #2389. P8 also includes the supplemental
dependency merge and external closure; publication alone does not satisfy it.
P9 records final exact-ID evidence and runs `goals completion refresh` after
merge. The manifest's prospective closeout derives `completed-retained` from
verified head-bound acceptance evidence; do not prematurely flip its declared
active status. The October 31 reflection is retained with this final PR.
