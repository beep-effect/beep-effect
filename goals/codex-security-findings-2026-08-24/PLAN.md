# Codex Security Findings (2026-08-24) Plan

## Status

Status: `active`. P2 validation and repo-side P3 remediation happened in the
capture PR itself. All 19 findings are validated; 15 are remediated repo-side
with focused proof, and 4 remain an explicit handoff to the
runner-admission/workload-identity arc. P5 repository proof is next.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |
| P1 capture | complete | Capture all live findings via the signed-in CSV export. | 19 IDs reconcile: 5 High, 4 Medium, 5 Low, 5 Informational. |
| P2 validate | complete | Reproduce each report at current HEAD. | All 19 items have strict verdict, disposition, rationale, and owner surface. |
| P3 lane-partition | complete | Group shared root causes and disjoint paths. | All 19 items are assigned to 12 remediation lanes. |
| P4 remediate | complete | Fix or transfer all real findings with focused checks. | Fifteen repo-side fixes are recorded; four runner findings have a named receiving arc and required external proof. |
| P5 repo-proof | pending | Run packet validation and Yeet repair/verify. | No packet drift; local proof green. |
| P6 publish | pending | Publish one intentional PR through Yeet. | Exact branch head pushed and PR opened. |
| P7 monitor | pending | Close hosted checks and actionable reviews. | PR green and mergeable. |
| P8 merge-and-close | pending | Merge and close captured findings. | PR merged; all 19 IDs resolved. |
| P9 close | pending | Record evidence, reflection, and lifecycle. | Packet set to `completed-retained` in the same closeout PR state. |

## Execution Rules

- Validate before repairing; classify failures as introduced, inherited,
  unrelated, or environment-only.
- Prefer one shared root-cause fix when multiple reports traverse the same code.
- Keep global files and ledgers serialized.
- Use focused tests first, then package checks, then Yeet.
- Never stage ignored raw evidence.

## Runner architecture handoff

CSF-001, CSF-004, CSF-005, and CSF-006 remain confirmed and dispositioned
`remediate`. They are not accepted risk or dashboard closure. Complete repair
requires a trust boundary outside pull-request-editable workflow content and no
usable cloud identity during runner jobs. The runner-admission/workload-identity
arc owns these findings until organization-owned controls and external GitHub
runner-group/AWS deployment proof verify the resulting boundary.

## Fleet deployment follow-up

The repository changes for CSF-003 and CSF-009 are complete, but fleet
acceptance still requires this AWS evidence:

1. Bake a fresh runner AMI with `bun run beep runners bake` and the production
   region, subnet, and security-group inputs. Retain the generated report and
   require its bake-complete marker.
2. Apply the report's `pulumiPinCommand`, deploy the controller change to the
   shadow fleet, and confirm that the new AMI is the configured runner image.
3. Run `goals/ci-fleet-endgame/ops/redteam-verify.sh <deployed-ref>`. Require
   exactly one PASS for Gates A, B, C, D, and `E_RUNNER_IMDS_HOOK`, then verify
   runner deregistration and EC2 teardown with operator AWS credentials.
4. Inspect the deployed worker's setup-action log. The baked fast path may be
   accepted only after the Bun binary and sealed-cache ownership, mode, and
   digest checks pass.

Local proof covers generated script content, Pulumi input content, YAML syntax,
and gate accounting. It does not prove AL2023 ownership after a real bake,
registration ordering during live boot, or deployed IMDS behavior.

## Packet Verification

```sh
test "$(wc -m < goals/codex-security-findings-2026-08-24/GOAL.md)" -le 4000
jq . goals/codex-security-findings-2026-08-24/ops/manifest.json
jq . goals/codex-security-findings-2026-08-24/ops/triage.json
test "$(find goals/codex-security-findings-2026-08-24/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = 19
git diff --check -- goals/codex-security-findings-2026-08-24
```
