# Codex Security Findings (2026-09-08) Plan

## Status

Status: `active`. Eleven findings merged in PR #1026; CSF-012 is implemented for the authorized follow-up PR. Full proof, hosted acceptance, merge, and external closure remain required. Final evidence is recorded on PR #1026.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture the full signed-in CSV snapshot. | 12 IDs reconcile: 1 Medium, 3 Low, 8 Informational. |
| P2 validate | complete | Validate newly captured reports at current HEAD. | All twelve have a verdict and disposition. |
| P3 lane-partition | complete | Assign newly captured findings to disjoint root-cause lanes. | Corpus redaction is assigned to L9; prior lanes remain intact. |
| P4 remediate | complete | Fix all real findings with focused checks. | Changed files and passing targeted proof recorded per finding. |
| P5 repo-proof | in-progress | Run packet validation and Yeet repair/verify. | No packet drift; local proof green. |
| P6 publish | complete | Publish one intentional PR through Yeet. | Exact branch head pushed and PR opened. |
| P7 monitor | in-progress | Close hosted checks and actionable reviews. | PR green and mergeable. |
| P8 merge-and-close | pending | Merge and close captured findings. | PR merged; all 12 IDs resolved. |
| P9 close | in-progress | Record evidence, reflection, and lifecycle. | Reflection lands in PR #1026; actual merge and exact-ID closure evidence is retained on that PR. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-09-08/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-09-08/ops/manifest.json
jq . goals/codex-security-findings-2026-09-08/ops/triage.json
test "$(find goals/codex-security-findings-2026-09-08/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 12
git diff --check -- goals/codex-security-findings-2026-09-08
```
