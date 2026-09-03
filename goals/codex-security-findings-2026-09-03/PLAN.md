# Codex Security Findings (2026-09-03) Plan

## Status

Status: `active`. All 12 findings are validated and remediated; packet and
repository proof are in progress. Scanner closure remains gated on PR merge.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture all live findings via the signed-in CSV export. | 12 IDs reconcile: 12 Informational. |
| P2 validate | complete | Reproduce each report at current HEAD. | All 12 findings confirmed with remediate dispositions and owner surfaces. |
| P3 lane-partition | complete | Group shared root causes and disjoint paths. | Seven lanes recorded; shared provenance and photo roots are consolidated. |
| P4 remediate | complete | Fix all real findings with focused checks. | All 12 remediations and focused regression checks are implemented. |
| P5 repo-proof | in progress | Run packet validation and Yeet repair/verify. | No packet drift; local proof green. |
| P6 publish | pending | Publish one intentional PR through Yeet. | Exact branch head pushed and PR opened. |
| P7 monitor | pending | Close hosted checks and actionable reviews. | PR green and mergeable. |
| P8 merge-and-close | pending | Merge and close captured findings. | PR merged; all 12 IDs resolved. |
| P9 close | pending | Record evidence, reflection, and lifecycle. | Packet set to `completed-retained` in the same closeout PR state. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-09-03/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-09-03/ops/manifest.json
jq . goals/codex-security-findings-2026-09-03/ops/triage.json
test "$(find goals/codex-security-findings-2026-09-03/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 12
git diff --check -- goals/codex-security-findings-2026-09-03
```
